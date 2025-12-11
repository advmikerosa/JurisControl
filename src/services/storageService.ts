
import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, CaseMovement, SearchResult, OfficeMember } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { MOCK_CLIENTS, MOCK_CASES, MOCK_TASKS, MOCK_FINANCIALS, MOCK_OFFICES as MOCK_OFFICES_DATA } from './mockData';
import { notificationService } from './notificationService';
import { emailService } from './emailService';
import { parseSafeDate } from '../utils/formatters';
import { cacheService } from './cacheService'; // NEW

const TABLE_NAMES = {
  CLIENTS: 'clients',
  CASES: 'cases',
  TASKS: 'tasks',
  FINANCIAL: 'financial',
  DOCUMENTS: 'documents',
  OFFICES: 'offices',
  PROFILES: 'profiles',
  LOGS: 'activity_logs',
  DATAJUD_LOGS: 'datajud_api_access_log'
};

const STORAGE_BUCKET = 'documents';

const LOCAL_KEYS = {
  CLIENTS: '@JurisControl:clients',
  CASES: '@JurisControl:cases',
  TASKS: '@JurisControl:tasks',
  FINANCIAL: '@JurisControl:financial',
  DOCUMENTS: '@JurisControl:documents',
  OFFICES: '@JurisControl:offices',
  LAST_CHECK: '@JurisControl:lastCheck',
  SETTINGS: '@JurisControl:settings',
  LOGS: '@JurisControl:logs',
};

export const MOCK_OFFICES: Office[] = MOCK_OFFICES_DATA;

class StorageService {
  
  constructor() {
    this.seedDatabase();
  }

  // --- Helper Methods ---

  public async getUserId(): Promise<string | null> {
    const session = await this.getUserSession();
    return session.userId;
  }

  private async getUserSession(): Promise<{ userId: string | null, officeId: string | null }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
            const storedUser = localStorage.getItem('@JurisControl:user');
            const localUser = storedUser ? JSON.parse(storedUser) : null;
            // Prioritize local selection for instant UI switch, then metadata
            const officeId = localUser?.currentOfficeId || data.session.user.user_metadata?.currentOfficeId || null;
            return { userId: data.session.user.id, officeId };
        }
      } catch (error) {
        console.error("Session retrieval error:", error);
      }
    }
    const stored = localStorage.getItem('@JurisControl:user');
    if (stored) {
        const u = JSON.parse(stored);
        return { userId: u.id, officeId: u.currentOfficeId || null };
    }
    return { userId: 'local-user', officeId: 'office-1' }; 
  }

  private getLocal<T>(key: string, defaultValue: T): T {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch {
        return defaultValue;
    }
  }

  private setLocal<T>(key: string, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error("Error saving to localStorage", e);
    }
  }

  private filterByOffice<T extends { officeId?: string }>(items: T[], officeId: string): T[] {
    if (!officeId) return items;
    return items.filter(item => item.officeId === officeId || !item.officeId);
  }

  public async ensureProfileExists(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from(TABLE_NAMES.PROFILES)
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

        if (!data) {
            const payload = {
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || 'Usuário Recuperado',
                username: user.user_metadata?.username || `@user_${user.id.substring(0,8)}`,
                created_at: new Date().toISOString()
            };
            await supabase.from(TABLE_NAMES.PROFILES).insert(payload);
        }
    } catch (e) {
        console.error("Erro no check de perfil:", e);
    }
  }

  async checkAccountStatus(uid: string) {
      if (isSupabaseConfigured && supabase) {
          try {
            const { data } = await supabase.from(TABLE_NAMES.PROFILES).select('deleted_at').eq('id', uid).single();
            return data || { deleted_at: null };
          } catch {
            return { deleted_at: null };
          }
      }
      return { deleted_at: null };
  }

  async reactivateAccount() {
    const userId = await this.getUserId();
    if (!userId) return;
    
    if (isSupabaseConfigured && supabase) {
        // Usa RPC se disponível ou update direto
        try {
            await supabase.rpc('reactivate_own_account');
        } catch {
            await supabase.from(TABLE_NAMES.PROFILES).update({ deleted_at: null }).eq('id', userId);
        }
    }
  }

  /**
   * Executa a exclusão de conta.
   * CORREÇÃO: Utiliza RPC (Transação no banco) para evitar dados parciais.
   */
  async deleteAccount() {
    const userId = await this.getUserId();
    
    if (isSupabaseConfigured && supabase) {
      if (!userId) return;
      
      // Tenta executar via RPC (Atomic Transaction)
      const { error } = await supabase.rpc('delete_own_account');
      
      if (error) {
          console.warn("RPC delete_own_account failed or missing, falling back to manual cascade deletion.", error);
          // Fallback manual (menos seguro, mas funcional se a RPC não existir)
          const tables = [
            TABLE_NAMES.LOGS,
            TABLE_NAMES.FINANCIAL,
            TABLE_NAMES.TASKS,
            TABLE_NAMES.DOCUMENTS,
            TABLE_NAMES.CASES,
            TABLE_NAMES.CLIENTS,
            TABLE_NAMES.PROFILES
          ];

          for (const table of tables) {
            try {
                await supabase.from(table).delete().eq('user_id', userId);
            } catch (e) {
                console.error(`Error deleting from ${table}`, e);
            }
          }
      }
      
    } else {
      localStorage.clear();
    }
  }

  // --- Generic CRUD ---

  private async genericGet<T extends { officeId?: string }>(table: string, key: string, cacheKeyPrefix?: string): Promise<T[]> {
      const s = await this.getUserSession();
      
      if (isSupabaseConfigured && supabase) {
          if(!s.officeId) return [];

          // CACHE LAYER
          if (cacheKeyPrefix) {
             const cacheKey = `${cacheKeyPrefix}:${s.officeId}`;
             const cached = cacheService.get<T[]>(cacheKey);
             if (cached) return cached;
          }

          const { data } = await supabase.from(table).select('*').eq('office_id', s.officeId);
          
          if (data && cacheKeyPrefix) {
             cacheService.set(`${cacheKeyPrefix}:${s.officeId}`, data, 300); // 5 min cache
          }

          return (data || []) as T[];
      }

      const all = this.getLocal<T[]>(key, []);
      return s.officeId ? this.filterByOffice(all, s.officeId) : all;
  }

  // --- Clients ---

  async getClients(): Promise<Client[]> {
    return this.genericGet(TABLE_NAMES.CLIENTS, LOCAL_KEYS.CLIENTS, 'CLIENTS_LIST');
  }

  async saveClient(client: Client) {
    const s = await this.getUserSession();
    const clientToSave = { 
        ...client, 
        officeId: s.officeId || 'office-1', 
        userId: s.userId || 'local' 
    };

    if (isSupabaseConfigured && supabase) {
      const { id, ...rest } = clientToSave;
      const payload = { ...rest, id: id && !id.startsWith('cli-') ? id : undefined }; 
      await supabase.from(TABLE_NAMES.CLIENTS).upsert(payload);
      cacheService.invalidatePattern('CLIENTS_LIST'); // INVALIDATE CACHE
    } else {
      const list = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
      const idx = list.findIndex(i => i.id === client.id);
      if (idx >= 0) {
          list[idx] = clientToSave;
      } else {
          list.unshift(clientToSave);
      }
      this.setLocal(LOCAL_KEYS.CLIENTS, list);
    }
    this.logActivity(`Salvou cliente: ${client.name}`);
  }

  async deleteClient(id: string) {
    const cases = await this.getCases();
    const hasActiveCases = cases.some(c => c.client.id === id && c.status !== CaseStatus.ARCHIVED);
    if (hasActiveCases) throw new Error("BLOQUEIO: Cliente possui processos ativos.");

    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.CLIENTS).delete().eq('id', id);
      cacheService.invalidatePattern('CLIENTS_LIST');
    } else {
      const list = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
      this.setLocal(LOCAL_KEYS.CLIENTS, list.filter(i => i.id !== id));
    }
    this.logActivity(`Excluiu cliente ID: ${id}`, 'Warning');
  }

  // --- Cases ---

  async getCases(): Promise<LegalCase[]> {
    return this.genericGet(TABLE_NAMES.CASES, LOCAL_KEYS.CASES, 'CASES_LIST');
  }

  async getCaseById(id: string): Promise<LegalCase | null> {
    if (isSupabaseConfigured && supabase) {
        // Try Cache first
        const cacheKey = `CASE:${id}`;
        const cached = cacheService.get<LegalCase>(cacheKey);
        if (cached) return cached;

        const { data } = await supabase.from(TABLE_NAMES.CASES).select('*, client:clients(*)').eq('id', id).single();
        if (data && data.client) {
            if (Array.isArray(data.client)) data.client = data.client[0];
            cacheService.set(cacheKey, data, 600); // 10 min cache for single case
        }
        return data as LegalCase;
    }
    const cases = await this.getCases();
    return cases.find(c => c.id === id) || null;
  }

  // Optimized Server-Side Pagination
  async getCasesPaginated(
    page: number = 1, 
    limit: number = 20, 
    searchTerm: string = '', 
    statusFilter: string | null = null, 
    categoryFilter: string | null = null, 
    dateRange: { start: string, end: string } | null = null
  ): Promise<{ data: LegalCase[], total: number }> {
    
    if (isSupabaseConfigured && supabase) {
        const s = await this.getUserSession();
        if(!s.officeId) return { data: [], total: 0 };

        // IMPLEMENTAÇÃO DE BUSCA OTIMIZADA (FULL TEXT SEARCH RPC)
        if (searchTerm.length > 2) {
           try {
             // Tenta usar a RPC de Full Text Search se existir
             const { data, error } = await supabase.rpc('search_cases', {
                search_query: searchTerm,
                filter_office_id: s.officeId,
                limit_count: limit
             });
             if (!error && data) {
                 // Busca clientes associados para os resultados (N+1 optimization simple)
                 const clientIds = data.map((c: any) => c.client_id);
                 const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
                 
                 const mapped = data.map((c: any) => ({
                    ...c,
                    client: clients?.find((cl: any) => cl.id === c.client_id) || { name: '...' }
                 }));
                 return { data: mapped, total: mapped.length };
             }
           } catch (e) {
             console.warn("FTS RPC failed, falling back to standard query");
           }
        }

        let query = supabase
            .from(TABLE_NAMES.CASES)
            .select('*, client:clients(id, name)', { count: 'exact' })
            .eq('office_id', s.officeId);

        // Apply filters directly to DB query
        if (searchTerm) {
           query = query.or(`title.ilike.%${searchTerm}%,cnj.ilike.%${searchTerm}%,responsible_lawyer.ilike.%${searchTerm}%`);
        }
        
        if (statusFilter && statusFilter !== 'Todos') {
            query = query.eq('status', statusFilter);
        }
        
        if (categoryFilter && categoryFilter !== 'Todos') {
            query = query.eq('category', categoryFilter);
        }
        
        if (dateRange && dateRange.start && dateRange.end) {
            query = query.gte('last_update', dateRange.start).lte('last_update', dateRange.end);
        }

        const start = (page - 1) * limit;
        const { data, count, error } = await query
            .order('last_update', { ascending: false })
            .range(start, start + limit - 1);

        if (error) {
            console.error("Pagination error:", error);
            return { data: [], total: 0 };
        }

        // Mapear dados retornados para garantir formato correto do objeto client
        const mappedData = (data as any[]).map(item => ({
            ...item,
            client: Array.isArray(item.client) ? item.client[0] : item.client || { name: 'Desconhecido' }
        }));

        return { data: (mappedData as LegalCase[]), total: count || 0 };
    } 
    
    // Fallback: Client-side filtering for Local/Demo mode
    let filtered = await this.getCases();

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(lower) || 
        c.cnj.includes(lower) || 
        c.client.name.toLowerCase().includes(lower)
      );
    }
    if (statusFilter && statusFilter !== 'Todos') filtered = filtered.filter(c => c.status === statusFilter);
    if (categoryFilter && categoryFilter !== 'Todos') filtered = filtered.filter(c => c.category === categoryFilter);
    if (dateRange && dateRange.start && dateRange.end) {
        filtered = filtered.filter(c => {
            const d = c.lastUpdate ? c.lastUpdate.split('T')[0] : '';
            return d >= dateRange.start && d <= dateRange.end;
        });
    }

    const start = (page - 1) * limit;
    return {
        data: filtered.slice(start, start + limit),
        total: filtered.length
    };
  }

  async saveCase(legalCase: LegalCase) {
    const s = await this.getUserSession();
    const caseToSave = { 
        ...legalCase, 
        officeId: s.officeId || 'office-1', 
        userId: s.userId || 'local',
        lastUpdate: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      // Remover objeto client aninhado para salvar (Supabase usa apenas client_id como FK)
      const { client, ...payload } = caseToSave;
      const dataToSave = { 
          ...payload, 
          client_id: client?.id 
      };
      
      const { error } = await supabase.from(TABLE_NAMES.CASES).upsert(dataToSave);
      if (error) throw error;
      cacheService.invalidatePattern('CASES_LIST'); // Invalidate
      cacheService.del(`CASE:${legalCase.id}`);
    } else {
      const list = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
      const idx = list.findIndex(i => i.id === legalCase.id);
      if (idx >= 0) {
          list[idx] = caseToSave;
      } else {
          if (!caseToSave.id) caseToSave.id = `case-${Date.now()}`;
          list.push(caseToSave);
      }
      this.setLocal(LOCAL_KEYS.CASES, list);
    }
    this.logActivity(`Salvou processo: ${legalCase.title}`);
  }

  async deleteCase(id: string) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.CASES).delete().eq('id', id);
      cacheService.invalidatePattern('CASES_LIST');
      cacheService.del(`CASE:${id}`);
    } else {
      const list = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
      this.setLocal(LOCAL_KEYS.CASES, list.filter(i => i.id !== id));
    }
    this.logActivity(`Excluiu processo ID: ${id}`, 'Warning');
  }

  // --- Tasks ---

  async getTasks(): Promise<Task[]> {
    return this.genericGet(TABLE_NAMES.TASKS, LOCAL_KEYS.TASKS, 'TASKS_LIST');
  }

  async getTasksByCaseId(caseId: string): Promise<Task[]> {
    const tasks = await this.getTasks();
    return tasks.filter(t => t.caseId === caseId);
  }

  async saveTask(task: Task) {
    const s = await this.getUserSession();
    const taskToSave = { ...task, officeId: s.officeId || 'office-1' };
    
    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.TASKS).upsert(taskToSave);
      cacheService.invalidatePattern('TASKS_LIST');
    } else {
      const list = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
      const idx = list.findIndex(i => i.id === task.id);
      if (idx >= 0) list[idx] = taskToSave;
      else {
          list.push(taskToSave);
      }
      this.setLocal(LOCAL_KEYS.TASKS, list);
    }
  }

  async deleteTask(id: string) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.TASKS).delete().eq('id', id);
      cacheService.invalidatePattern('TASKS_LIST');
    } else {
      const list = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
      this.setLocal(LOCAL_KEYS.TASKS, list.filter(i => i.id !== id));
    }
  }

  // --- Financial ---

  async getFinancials(): Promise<FinancialRecord[]> {
    return this.genericGet(TABLE_NAMES.FINANCIAL, LOCAL_KEYS.FINANCIAL, 'FINANCIAL_LIST');
  }

  async getFinancialsByCaseId(caseId: string): Promise<FinancialRecord[]> {
    const fins = await this.getFinancials();
    return fins.filter(f => f.caseId === caseId);
  }

  async saveFinancial(record: FinancialRecord) {
    const s = await this.getUserSession();
    const recToSave = { ...record, officeId: s.officeId || 'office-1' };

    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.FINANCIAL).upsert(recToSave);
      cacheService.invalidatePattern('FINANCIAL_LIST');
      cacheService.invalidatePattern('DASHBOARD'); // Dashboard relies on financials
    } else {
      const list = this.getLocal<FinancialRecord[]>(LOCAL_KEYS.FINANCIAL, []);
      const idx = list.findIndex(i => i.id === record.id);
      if (idx >= 0) list[idx] = recToSave;
      else {
          list.push(recToSave);
      }
      this.setLocal(LOCAL_KEYS.FINANCIAL, list);
    }
  }

  // --- Documents ---

  async getDocuments(): Promise<SystemDocument[]> {
    return this.genericGet(TABLE_NAMES.DOCUMENTS, LOCAL_KEYS.DOCUMENTS, 'DOCUMENTS_LIST');
  }

  async getDocumentsByCaseId(caseId: string): Promise<SystemDocument[]> {
    const docs = await this.getDocuments();
    return docs.filter(d => d.caseId === caseId);
  }

  async saveDocument(docData: SystemDocument, file?: File) {
    const s = await this.getUserSession();
    let finalDoc = { ...docData, officeId: s.officeId || 'office-1', userId: s.userId || undefined };

    if (isSupabaseConfigured && supabase) {
        // Upload File to Bucket logic
        if (file) {
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${s.officeId}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Save path to DB
                finalDoc = { ...finalDoc, storagePath: filePath } as any; // Type assertion if needed
            } catch (e) {
                console.error("Failed to upload file to storage bucket:", e);
                // Não salva metadados se o upload falhar para evitar inconsistência
                throw new Error("Falha no upload do arquivo. O documento não foi salvo.");
            }
        }
        
        await supabase.from(TABLE_NAMES.DOCUMENTS).insert(finalDoc);
        cacheService.invalidatePattern('DOCUMENTS_LIST');
    } else {
      // Mock mode saves metadata only
      const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
      list.unshift(finalDoc);
      this.setLocal(LOCAL_KEYS.DOCUMENTS, list);
    }
    this.logActivity(`Upload de documento: ${docData.name}`);
  }

  async deleteDocument(id: string) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.DOCUMENTS).delete().eq('id', id);
      cacheService.invalidatePattern('DOCUMENTS_LIST');
    } else {
      const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
      this.setLocal(LOCAL_KEYS.DOCUMENTS, list.filter(i => i.id !== id));
    }
  }

  // --- Offices ---

  async getOffices(): Promise<Office[]> {
    if (isSupabaseConfigured && supabase) {
        try {
            const { data, error } = await supabase.from(TABLE_NAMES.OFFICES).select('*');
            if (error) throw error;
            return data as Office[];
        } catch { return []; }
    }
    return this.getLocal(LOCAL_KEYS.OFFICES, []);
  }

  async getOfficeById(id: string): Promise<Office | undefined> {
    const offices = await this.getOffices();
    return offices.find(o => o.id === id);
  }

  async saveOffice(office: Office): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.OFFICES).upsert(office);
    } else {
      const offices = await this.getOffices();
      const index = offices.findIndex(o => o.id === office.id);
      if (index >= 0) {
        offices[index] = office;
        this.setLocal(LOCAL_KEYS.OFFICES, offices);
      }
    }
    this.logActivity(`Atualizou dados do escritório: ${office.name}`);
  }

  async createOffice(officeData: Partial<Office>, explicitOwnerId?: string, userData?: {name?: string, email?: string}): Promise<Office> {
    const userId = explicitOwnerId || (await this.getUserSession()).userId;
    // Mock user data fallback
    const user = { name: userData?.name || 'Admin', email: userData?.email || 'admin@email.com', avatar: '' };

    let handle = officeData.handle || `@office${Date.now()}`;
    if (!handle.startsWith('@')) handle = '@' + handle;

    const offices = await this.getOffices();
    if (!isSupabaseConfigured && offices.some(o => o.handle.toLowerCase() === handle.toLowerCase())) {
      throw new Error("Este identificador de escritório (@handle) já está em uso.");
    }

    const newOffice: Office = {
      id: `office-${Date.now()}`,
      name: officeData.name || 'Novo Escritório',
      handle: handle,
      location: officeData.location || 'Brasil',
      ownerId: userId || 'local',
      members: [
        {
          userId: userId || 'local',
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar,
          role: 'Admin',
          permissions: { financial: true, cases: true, documents: true, settings: true }
        }
      ],
      createdAt: new Date().toISOString(),
      social: {}
    };

    if (isSupabaseConfigured && supabase) {
       await supabase.from(TABLE_NAMES.OFFICES).insert(newOffice);
    } else {
       const updatedOffices = [...offices, newOffice];
       this.setLocal(LOCAL_KEYS.OFFICES, updatedOffices);
    }
    
    this.logActivity(`Criou novo escritório: ${newOffice.name}`);
    return newOffice;
  }

  async joinOffice(officeHandle: string): Promise<Office> {
    const offices = await this.getOffices();
    const targetOffice = offices.find(o => o.handle.toLowerCase() === officeHandle.toLowerCase());
    
    if (!targetOffice && !isSupabaseConfigured) throw new Error("Escritório não encontrado com este identificador.");

    const userId = (await this.getUserSession()).userId;
    const storedUser = localStorage.getItem('@JurisControl:user');
    const user = storedUser ? JSON.parse(storedUser) : { name: 'Novo Membro', email: '', avatar: '' };
    
    if (targetOffice && !targetOffice.members.some(m => m.userId === userId)) {
       const newMember = {
         userId: userId || 'local',
         name: user.name || 'Novo Membro',
         email: user.email || '',
         avatarUrl: user.avatar || '',
         role: 'Advogado',
         permissions: { financial: false, cases: true, documents: true, settings: false }
       };
       targetOffice.members.push(newMember as OfficeMember);
       
       if (isSupabaseConfigured && supabase) {
          // Sync logic via SQL trigger or direct insert to member table
          await supabase.from('office_members').insert({
              office_id: targetOffice.id,
              user_id: userId,
              role: 'Advogado'
          });
       } else {
          const updatedOffices = offices.map(o => o.id === targetOffice.id ? targetOffice : o);
          this.setLocal(LOCAL_KEYS.OFFICES, updatedOffices);
       }
       this.logActivity(`Entrou no escritório: ${targetOffice.name}`);
    }
    return targetOffice || { id: 'error', name: 'Error', handle: '', ownerId: '', location: '', members: [] };
  }

  async inviteUserToOffice(officeId: string, userHandle: string): Promise<boolean> {
     if (!userHandle.startsWith('@')) throw new Error("O nome de usuário deve começar com @.");
     await new Promise(resolve => setTimeout(resolve, 800)); // Simulating API call
     return true; 
  }

  async removeMemberFromOffice(officeId: string, userId: string) {
    const offices = await this.getOffices();
    const office = offices.find(o => o.id === officeId);
    if (office) {
        office.members = office.members.filter(m => m.userId !== userId);
        this.saveOffice(office);
    }
  }

  // --- Settings & Logs ---

  getSettings(): AppSettings {
      try {
          const s = localStorage.getItem(LOCAL_KEYS.SETTINGS);
          const parsed = s ? JSON.parse(s) : {};
          return {
            general: parsed.general || { language: 'pt-BR', dateFormat: 'DD/MM/YYYY', compactMode: false, dataJudApiKey: '' },
            notifications: parsed.notifications || { email: true, desktop: true, sound: false, dailyDigest: false },
            emailPreferences: parsed.emailPreferences || {
                enabled: false,
                frequency: 'immediate',
                categories: { deadlines: true, processes: true, events: true, financial: false, marketing: true },
                deadlineAlerts: { sevenDays: true, threeDays: true, oneDay: true, onDueDate: true }
            },
            automation: parsed.automation || { autoArchiveWonCases: false, autoSaveDrafts: true }
          };
      } catch { return {} as any; }
  }

  saveSettings(settings: AppSettings) {
      this.setLocal(LOCAL_KEYS.SETTINGS, settings);
  }

  getLogs(): ActivityLog[] { 
    return this.getLocal(LOCAL_KEYS.LOGS, []);
  }
  
  logActivity(action: string, status: 'Success' | 'Failed' | 'Warning' = 'Success') {
    const logs = this.getLogs();
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      action,
      date: new Date().toLocaleString('pt-BR'),
      device: navigator.userAgent.split(')')[0] + ')',
      ip: '127.0.0.1', 
      status
    };
    logs.unshift(newLog);
    this.setLocal(LOCAL_KEYS.LOGS, logs.slice(0, 50));
  }

  // --- Realtime & Dashboard ---

  async checkRealtimeAlerts() {
    const lastCheck = localStorage.getItem(LOCAL_KEYS.LAST_CHECK);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // Safe ISO date YYYY-MM-DD

    if (lastCheck === todayStr) return;

    const tasks = await this.getTasks();
    const settings = this.getSettings();
    
    const userStr = localStorage.getItem('@JurisControl:user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user) return;

    const getDiffDays = (targetDate: Date) => {
        // Zera as horas para comparar apenas datas
        const d1 = new Date(targetDate); d1.setHours(0,0,0,0);
        const d2 = new Date(today); d2.setHours(0,0,0,0);
        
        const diffTime = d1.getTime() - d2.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    };

    for (const task of tasks) {
        if (task.status === 'Concluído') continue;
        const dueDate = parseSafeDate(task.dueDate);
        if (isNaN(dueDate.getTime())) continue;
        
        const diff = getDiffDays(dueDate);
        
        const alerts = settings.emailPreferences?.deadlineAlerts;
        let shouldAlert = false;

        // Lógica de alerta mais permissiva
        if (diff === 0 && alerts?.onDueDate) shouldAlert = true;
        if (diff === 1 && alerts?.oneDay) shouldAlert = true;
        if (diff === 3 && alerts?.threeDays) shouldAlert = true;
        if (diff === 7 && alerts?.sevenDays) shouldAlert = true;

        if (shouldAlert) {
            notificationService.notify('Prazo de Tarefa', `A tarefa "${task.title}" vence ${diff === 0 ? 'hoje' : `em ${diff} dias`}.`, 'warning');
        }
    }

    localStorage.setItem(LOCAL_KEYS.LAST_CHECK, todayStr);
  }

  // DASHBOARD CACHED
  async getDashboardSummary(): Promise<DashboardData> {
    const s = await this.getUserSession();
    
    // Tenta usar cache primeiro
    if (s.officeId) {
        const cached = cacheService.get<DashboardData>(`DASHBOARD:${s.officeId}`);
        if (cached) return cached;
    }

    // Se estiver no Supabase, tentamos usar Materialized Views (via RPC ou select direto se configurado)
    if (isSupabaseConfigured && supabase && s.officeId) {
       try {
         // Tentativa de usar a materialized view via query direta
         // Nota: O RLS na materialized view pode ser tricky, geralmente se usa RPC
         const { data: mvData } = await supabase.from('mv_financial_summary').select('*').eq('office_id', s.officeId).maybeSingle();
         
         // Se tivermos dados da MV, usamos parte deles para compor o dashboard
         // (Isso é uma otimização parcial, pois o dashboard tem dados de várias fontes)
       } catch (e) {
         // Silenciosamente ignora se a MV não existir
       }
    }

    const [allCases, allTasks] = await Promise.all([
      this.getCases(),
      this.getTasks()
    ]);

    let activeCases = 0, wonCases = 0, pendingCases = 0, hearings = 0;
    
    for (const c of allCases) {
        if (c.status === CaseStatus.ACTIVE) activeCases++;
        else if (c.status === CaseStatus.WON) wonCases++;
        else if (c.status === CaseStatus.PENDING) pendingCases++;
        
        if (c.nextHearing) hearings++;
    }

    const highPriorityTasks = allTasks.filter(t => t.priority === 'Alta' && t.status !== 'Concluído').length;

    const caseDistribution = [
        { name: 'Ativos', value: activeCases, color: '#818cf8' },
        { name: 'Pendentes', value: pendingCases, color: '#fbbf24' },
        { name: 'Ganhos', value: wonCases, color: '#34d399' },
    ];

    const upcomingHearings = allCases
        .filter(c => c.nextHearing)
        .sort((a, b) => {
            const dateA = parseSafeDate(a.nextHearing || '');
            const dateB = parseSafeDate(b.nextHearing || '');
            return dateA.getTime() - dateB.getTime();
        })
        .slice(0, 4); 

    const todayStr = new Date().toLocaleDateString('pt-BR');
    
    const isDateToday = (dateString: string) => {
       const d = parseSafeDate(dateString);
       const today = new Date();
       return d.getDate() === today.getDate() && 
              d.getMonth() === today.getMonth() && 
              d.getFullYear() === today.getFullYear();
    };

    const todaysAgenda = [
        ...allTasks.filter(t => isDateToday(t.dueDate) && t.status !== 'Concluído').map(t => ({ type: 'task' as const, title: t.title, sub: 'Prazo Fatal', id: t.id })),
        ...allCases.filter(c => isDateToday(c.nextHearing || '')).map(c => ({ type: 'hearing' as const, title: c.title, sub: 'Audiência', id: c.id }))
    ].slice(0, 5);

    const result = {
        counts: { activeCases, wonCases, pendingCases, hearings, highPriorityTasks },
        charts: { caseDistribution },
        lists: { upcomingHearings, todaysAgenda, recentMovements: [] } 
    };

    if (s.officeId) {
        cacheService.set(`DASHBOARD:${s.officeId}`, result, 120); // 2 min cache
    }

    return result;
  }

  // Optimized Search Global with FTS Fallback
  async searchGlobal(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];
    
    const s = await this.getUserSession();
    if (!s.officeId) return [];

    const cacheKey = `SEARCH:${s.officeId}:${query}`;
    const cached = cacheService.get<SearchResult[]>(cacheKey);
    if (cached) return cached;

    // Otimização: Uso de features nativas do Supabase para busca
    if (isSupabaseConfigured && supabase) {
        const results: SearchResult[] = [];
        const limit = 5;

        // Tentar RPC de Full Text Search para casos
        try {
            const { data: casesFTS } = await supabase.rpc('search_cases', {
                search_query: query,
                filter_office_id: s.officeId,
                limit_count: 5
            });
            
            if (casesFTS) {
                results.push(...casesFTS.map((c: any) => ({
                    id: c.id, type: 'case' as const, title: c.title, subtitle: `CNJ: ${c.cnj}`, url: `/cases/${c.id}`
                })));
            }
        } catch {
            // Fallback para ILIKE se RPC falhar ou não existir
             const { data: casesRes } = await supabase.from(TABLE_NAMES.CASES)
                .select('id, title, cnj, client:clients(name)')
                .eq('office_id', s.officeId)
                .or(`title.ilike.%${query}%,cnj.ilike.%${query}%`)
                .limit(limit);
             
             if (casesRes) {
                results.push(...casesRes.map((c: any) => ({
                    id: c.id, type: 'case' as const, title: c.title, subtitle: `CNJ: ${c.cnj}`, url: `/cases/${c.id}`
                })));
             }
        }

        // Clients Search
        const { data: clientsRes } = await supabase.from(TABLE_NAMES.CLIENTS)
                .select('id, name, cpf, cnpj')
                .eq('office_id', s.officeId)
                .ilike('name', `%${query}%`)
                .limit(limit);

        if (clientsRes) {
            results.push(...clientsRes.map((c: any) => ({
                id: c.id, type: 'client' as const, title: c.name, subtitle: c.cpf || c.cnpj, url: `/clients/${c.id}`
            })));
        }

        // Tasks Search
        const { data: tasksRes } = await supabase.from(TABLE_NAMES.TASKS)
                .select('id, title, due_date, status')
                .eq('office_id', s.officeId)
                .ilike('title', `%${query}%`)
                .limit(limit);
        
        if (tasksRes) {
            results.push(...tasksRes.map((t: any) => ({
                id: t.id, type: 'task' as const, title: t.title, subtitle: `Vence: ${t.due_date}`, url: '/crm'
            })));
        }

        const finalResults = Array.from(new Map(results.map(item => [item.id, item])).values());
        cacheService.set(cacheKey, finalResults, 60); // 1 min cache para search
        return finalResults;
    }

    // Fallback Local
    const lowerQuery = query.toLowerCase();
    const [clients, cases, tasks] = await Promise.all([this.getClients(), this.getCases(), this.getTasks()]);

    const results: SearchResult[] = [];

    for (const c of clients) {
        if (c.name.toLowerCase().includes(lowerQuery) || (c.email || '').toLowerCase().includes(lowerQuery)) {
            results.push({ id: c.id, type: 'client', title: c.name, subtitle: c.type === 'PF' ? c.cpf : c.cnpj, url: `/clients/${c.id}` });
        }
    }
    for (const c of cases) {
        if (c.title.toLowerCase().includes(lowerQuery) || c.cnj.includes(lowerQuery)) {
            results.push({ id: c.id, type: 'case', title: c.title, subtitle: `CNJ: ${c.cnj}`, url: `/cases/${c.id}` });
        }
    }
    for (const t of tasks) {
        if (t.title.toLowerCase().includes(lowerQuery)) {
            results.push({ id: t.id, type: 'task', title: t.title, subtitle: `Status: ${t.status}`, url: '/crm' });
        }
    }
    
    return results.slice(0, 8);
  }

  async seedDatabase() {
    const clients = await this.getClients();
    if (clients.length === 0) {
        this.setLocal(LOCAL_KEYS.CLIENTS, MOCK_CLIENTS);
        this.setLocal(LOCAL_KEYS.CASES, MOCK_CASES);
        this.setLocal(LOCAL_KEYS.TASKS, MOCK_TASKS);
        this.setLocal(LOCAL_KEYS.FINANCIAL, MOCK_FINANCIALS);
        this.setLocal(LOCAL_KEYS.OFFICES, MOCK_OFFICES_DATA);
    }
  }

  factoryReset() {
    localStorage.clear();
    window.location.reload();
  }

  // --- DataJud Security & Sync ---

  private decryptDataJudKey(encrypted: string): string {
      // TODO: Implementar lógica real de decriptação (ex: AES-GCM via Web Crypto API)
      // Por enquanto, retornamos o valor como está (assumindo que o chamador lida com isso ou é apenas base64)
      return encrypted;
  }

  /**
   * Salva a API Key do DataJud de forma segura (encriptada) no perfil do usuário.
   * Substitui o armazenamento em texto plano no JSON de settings.
   */
  async saveDataJudApiKey(encryptedKey: string, keyHash: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
        // Fallback: Em modo offline/demo, mantemos no settings local (simulação)
        const currentSettings = this.getSettings();
        currentSettings.general.dataJudApiKey = encryptedKey; 
        this.saveSettings(currentSettings);
        return;
    }

    const userId = await this.getUserId();
    if (!userId) throw new Error("Usuário não autenticado");

    // Atualizar chave encriptada no profile
    const { error } = await supabase
      .from(TABLE_NAMES.PROFILES)
      .update({
        datajud_api_key_encrypted: encryptedKey,
        datajud_api_key_hash: keyHash,
        datajud_key_created_at: new Date().toISOString()
      } as any)
      .eq('id', userId);

    if (error) throw error;

    // Log de operação
    this.logActivity('Atualizou chave DataJud');
  }

  async getDataJudApiKey(): Promise<string | null> {
    if (!isSupabaseConfigured || !supabase) {
      // Fallback: localStorage
      const settings = this.getSettings();
      return settings.general.dataJudApiKey || null;
    }

    const userId = await this.getUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from(TABLE_NAMES.PROFILES)
      .select('datajud_api_key_encrypted')
      .eq('id', userId)
      .single();

    if (error || !data?.datajud_api_key_encrypted) return null;

    // Descriptografar antes de retornar
    return this.decryptDataJudKey(data.datajud_api_key_encrypted);
  }

  // --- DataJud Audit & Logging ---

  /**
   * Registra todas as interações com a API do DataJud para auditoria de segurança.
   */
  async logDataJudAccess(
    endpoint: string,
    cnj: string,
    statusCode: number,
    errorMessage?: string
  ): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return; // Modo Demo ignora logs no banco

    try {
        const userId = await this.getUserId();
        if (!userId) return;

        const { error } = await supabase
        .from(TABLE_NAMES.DATAJUD_LOGS)
        .insert([{
            user_id: userId,
            endpoint_used: endpoint,
            cnj_searched: cnj,
            status_code: statusCode,
            error_message: errorMessage || null,
            ip_address: '0.0.0.0', // Em produção, isso seria preenchido pelo backend ou Edge Function
            user_agent: navigator.userAgent
        }]);

        if (error) console.warn("Falha ao registrar log de acesso DataJud:", error.message);
    } catch (e) {
        console.error("Erro crítico ao logar acesso DataJud:", e);
    }
  }
}

export const storageService = new StorageService();
