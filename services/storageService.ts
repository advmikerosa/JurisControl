
import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, User, CaseMovement, SearchResult, OfficeMember } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { notificationService } from './notificationService';

const TABLE_NAMES = {
  CLIENTS: 'clients',
  CASES: 'cases',
  TASKS: 'tasks',
  FINANCIAL: 'financial',
  DOCUMENTS: 'documents',
  OFFICES: 'offices',
  PROFILES: 'profiles',
  LOGS: 'activity_logs',
};

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

// Configuração Inicial Vazia
export const MOCK_OFFICES: Office[] = [];

class StorageService {
  
  private async getUserId(): Promise<string> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      return data.session?.user?.id || 'anon';
    }
    const stored = localStorage.getItem('@JurisControl:user');
    return stored ? JSON.parse(stored).id : 'local-user';
  }

  private getCurrentUser(): User | null {
    try {
      const stored = localStorage.getItem('@JurisControl:user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  }

  // --- Clientes ---
  async getClients(): Promise<Client[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        const { data, error } = await supabase
          .from(TABLE_NAMES.CLIENTS)
          .select('id, name, type, status, email, phone, city, state, avatarUrl, cpf, cnpj, corporateName, createdAt, tags, alerts, notes, documents, history')
          .eq('user_id', userId)
          .order('name');
        
        if (error) throw error;
        return (data as unknown) as Client[];
      } catch (error) { 
        console.error("Supabase Error (getClients):", error); 
        return []; 
      }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.CLIENTS) || '[]');
    }
  }
  
  async saveClient(client: Client) {
    const userId = await this.getUserId();

    if (isSupabaseConfigured && supabase) {
      const payload = { ...client, user_id: userId };
      const { id, ...insertPayload } = payload;
      
      if (id && !id.startsWith('cli-')) {
        await supabase.from(TABLE_NAMES.CLIENTS).upsert(payload);
      } else {
        await supabase.from(TABLE_NAMES.CLIENTS).insert([insertPayload]);
      }
      this.logActivity(`Salvou cliente: ${client.name}`);
    } else {
      const list = await this.getClients();
      const idx = list.findIndex(i => i.id === client.id);
      if (idx >= 0) {
          list[idx] = client;
      } else {
          if (!client.id) client.id = `cli-${Date.now()}`;
          list.unshift({ ...client, userId });
      }
      localStorage.setItem(LOCAL_KEYS.CLIENTS, JSON.stringify(list));
      this.logActivity(`Salvou cliente: ${client.name}`);
    }
  }

  async deleteClient(id: string) {
    const cases = await this.getCases();
    const hasActiveCases = cases.some(c => c.client.id === id && c.status !== CaseStatus.ARCHIVED);
    
    if (hasActiveCases) {
        throw new Error("BLOQUEIO: Não é possível excluir este cliente pois ele possui processos ativos.");
    }

    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      await supabase.from(TABLE_NAMES.CLIENTS).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getClients();
      localStorage.setItem(LOCAL_KEYS.CLIENTS, JSON.stringify(list.filter(i => i.id !== id)));
    }
    this.logActivity(`Excluiu cliente ID: ${id}`, 'Warning');
  }

  // --- Processos (Cases) ---
  async getCases(): Promise<LegalCase[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        const { data, error } = await supabase
          .from(TABLE_NAMES.CASES)
          .select(`*, client:clients(*)`)
          .eq('user_id', userId);
        if (error) throw error;
        
        const mappedData = (data || []).map((item: any) => {
          const clientObj = Array.isArray(item.client) ? item.client[0] : item.client;
          return {
            ...item,
            client: clientObj || { id: 'unknown', name: 'Cliente Desconhecido', type: 'PF', avatarUrl: '' }
          };
        });

        return mappedData as unknown as LegalCase[];
      } catch (e) { 
        console.error("Supabase Error (getCases):", e); 
        return []; 
      }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.CASES) || '[]');
    }
  }

  async getCaseById(id: string): Promise<LegalCase | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        const { data, error } = await supabase
          .from(TABLE_NAMES.CASES)
          .select(`*, client:clients(*)`)
          .eq('id', id)
          .eq('user_id', userId)
          .single();
        
        if (error) throw error;
        
        const mappedItem = {
            ...data,
            client: Array.isArray(data.client) ? data.client[0] : (data.client || { id: 'unknown', name: 'Cliente Desconhecido' })
        };

        return mappedItem as unknown as LegalCase;
      } catch (e) { 
        return null; 
      }
    } else {
      const cases = await this.getCases();
      return cases.find(c => c.id === id) || null;
    }
  }

  async getCasesPaginated(
    page: number = 1, 
    limit: number = 20, 
    searchTerm: string = '', 
    statusFilter: string | null = null,
    categoryFilter: string | null = null, 
    dateRange: { start: string, end: string } | null = null
  ): Promise<{ data: LegalCase[], total: number }> {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        let query = supabase
          .from(TABLE_NAMES.CASES)
          .select(`*, client:clients!inner(id, name, type, avatarUrl)`, { count: 'exact' })
          .eq('user_id', userId);

        if (searchTerm) {
          query = query.or(`title.ilike.%${searchTerm}%,cnj.ilike.%${searchTerm}%,client.name.ilike.%${searchTerm}%`);
        }
        if (statusFilter && statusFilter !== 'Todos') {
          query = query.eq('status', statusFilter);
        }
        if (categoryFilter && categoryFilter !== 'Todos') {
          query = query.eq('category', categoryFilter);
        }
        if (dateRange && dateRange.start && dateRange.end) {
           query = query.gte('lastUpdate', dateRange.start).lte('lastUpdate', dateRange.end);
        }

        const { data, count, error } = await query.range(start, end).order('lastUpdate', { ascending: false });
        
        if (error) return { data: [], total: 0 };
        
        const mappedData = (data || []).map((item: any) => {
            const c = Array.isArray(item.client) ? item.client[0] : item.client;
            return {
                ...item,
                client: c || { id: 'unknown', name: 'Cliente Removido', type: 'PF', avatarUrl: '' }
            };
        });

        return { data: mappedData as unknown as LegalCase[], total: count || 0 };
      } catch {
        return { data: [], total: 0 };
      }
    } else {
      try {
        let allCases = JSON.parse(localStorage.getItem(LOCAL_KEYS.CASES) || '[]') as LegalCase[];
        if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase();
          allCases = allCases.filter(c => 
            c.title.toLowerCase().includes(lowerSearch) || 
            c.cnj.includes(lowerSearch) ||
            c.client.name.toLowerCase().includes(lowerSearch)
          );
        }
        if (statusFilter && statusFilter !== 'Todos') allCases = allCases.filter(c => c.status === statusFilter);
        if (categoryFilter && categoryFilter !== 'Todos') allCases = allCases.filter(c => c.category === categoryFilter);
        if (dateRange && dateRange.start && dateRange.end) {
          allCases = allCases.filter(c => {
             if (!c.lastUpdate) return false;
             const dateStr = c.lastUpdate.split('T')[0];
             return dateStr >= dateRange.start && dateStr <= dateRange.end;
          });
        }
        allCases.sort((a, b) => new Date(b.lastUpdate || 0).getTime() - new Date(a.lastUpdate || 0).getTime());
        return { data: allCases.slice(start, end + 1), total: allCases.length };
      } catch { return { data: [], total: 0 }; }
    }
  }

  async saveCase(legalCase: LegalCase) {
    const userId = await this.getUserId();
    legalCase.lastUpdate = new Date().toISOString();
    
    if (isSupabaseConfigured && supabase) {
      const { id, client, ...rest } = legalCase;
      const payload: any = {
        ...rest,
        user_id: userId,
        client_id: client.id,
      };
      
      if (id && !id.startsWith('case-')) {
        await supabase.from(TABLE_NAMES.CASES).upsert({ id, ...payload });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: tempId, ...insertPayload } = payload;
        await supabase.from(TABLE_NAMES.CASES).insert([insertPayload]);
      }
      this.logActivity(`Salvou processo: ${legalCase.title}`);
    } else {
      const list = await this.getCases();
      const idx = list.findIndex(i => i.id === legalCase.id);
      if (idx >= 0) {
          list[idx] = legalCase;
      } else {
          if (!legalCase.id) legalCase.id = `case-${Date.now()}`;
          list.push({ ...legalCase, userId });
      }
      localStorage.setItem(LOCAL_KEYS.CASES, JSON.stringify(list));
      this.logActivity(`Salvou processo: ${legalCase.title}`);
    }
  }

  async deleteCase(id: string) {
    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      await supabase.from(TABLE_NAMES.CASES).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getCases();
      localStorage.setItem(LOCAL_KEYS.CASES, JSON.stringify(list.filter(i => i.id !== id)));
    }
    this.logActivity(`Excluiu processo ID: ${id}`, 'Warning');
  }

  // --- Tarefas ---
  async getTasks(): Promise<Task[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        const { data } = await supabase.from(TABLE_NAMES.TASKS).select('*').eq('user_id', userId);
        return (data || []) as Task[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.TASKS) || '[]');
    }
  }

  async getTasksByCaseId(caseId: string): Promise<Task[]> {
    if (isSupabaseConfigured && supabase) {
        const userId = await this.getUserId();
        const { data } = await supabase.from(TABLE_NAMES.TASKS).select('*').eq('caseId', caseId).eq('user_id', userId);
        return (data || []) as Task[];
    } else {
        const tasks = await this.getTasks();
        return tasks.filter(t => t.caseId === caseId);
    }
  }
  
  async saveTask(task: Task) {
    const userId = await this.getUserId();
    if (isSupabaseConfigured && supabase) {
      const { id, ...rest } = task;
      const payload = { ...rest, user_id: userId };
      if (id && !id.startsWith('task-')) {
        await supabase.from(TABLE_NAMES.TASKS).upsert({ id, ...payload });
      } else {
        await supabase.from(TABLE_NAMES.TASKS).insert([payload]);
      }
    } else {
      const list = await this.getTasks();
      const idx = list.findIndex(i => i.id === task.id);
      if (idx >= 0) list[idx] = task;
      else {
          if(!task.id) task.id = `task-${Date.now()}`;
          list.push(task);
      }
      localStorage.setItem(LOCAL_KEYS.TASKS, JSON.stringify(list));
    }
  }
  
  async deleteTask(id: string) {
    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      await supabase.from(TABLE_NAMES.TASKS).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getTasks();
      localStorage.setItem(LOCAL_KEYS.TASKS, JSON.stringify(list.filter(i => i.id !== id)));
    }
  }

  // --- Financeiro ---
  async getFinancials(): Promise<FinancialRecord[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        const { data } = await supabase.from(TABLE_NAMES.FINANCIAL).select('*').eq('user_id', userId);
        return (data || []) as FinancialRecord[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.FINANCIAL) || '[]');
    }
  }

  async getFinancialsByCaseId(caseId: string): Promise<FinancialRecord[]> {
    if (isSupabaseConfigured && supabase) {
        const userId = await this.getUserId();
        const { data } = await supabase.from(TABLE_NAMES.FINANCIAL).select('*').eq('caseId', caseId).eq('user_id', userId);
        return (data || []) as FinancialRecord[];
    } else {
        const fins = await this.getFinancials();
        return fins.filter(f => f.caseId === caseId);
    }
  }
  
  async saveFinancial(record: FinancialRecord) {
    const userId = await this.getUserId();
    if (isSupabaseConfigured && supabase) {
      const { id, ...rest } = record;
      const payload = { ...rest, user_id: userId };
      if (id && !id.startsWith('trans-')) {
        await supabase.from(TABLE_NAMES.FINANCIAL).upsert({ id, ...payload });
      } else {
        await supabase.from(TABLE_NAMES.FINANCIAL).insert([payload]);
      }
    } else {
      const list = await this.getFinancials();
      const idx = list.findIndex(i => i.id === record.id);
      if (idx >= 0) list[idx] = record;
      else {
          if(!record.id) record.id = `trans-${Date.now()}`;
          list.push(record);
      }
      localStorage.setItem(LOCAL_KEYS.FINANCIAL, JSON.stringify(list));
    }
  }

  // --- Documentos ---
  async getDocuments(): Promise<SystemDocument[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        const { data } = await supabase.from(TABLE_NAMES.DOCUMENTS).select('*').eq('user_id', userId);
        return (data || []) as SystemDocument[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.DOCUMENTS) || '[]');
    }
  }

  async getDocumentsByCaseId(caseId: string): Promise<SystemDocument[]> {
    if (isSupabaseConfigured && supabase) {
        const userId = await this.getUserId();
        const { data } = await supabase.from(TABLE_NAMES.DOCUMENTS).select('*').eq('caseId', caseId).eq('user_id', userId);
        return (data || []) as SystemDocument[];
    } else {
        const docs = await this.getDocuments();
        return docs.filter(d => d.caseId === caseId);
    }
  }

  async saveDocument(docData: SystemDocument) {
    const userId = await this.getUserId();
    if (isSupabaseConfigured && supabase) {
      const { id, ...rest } = docData;
      const payload = { ...rest, user_id: userId };
      await supabase.from(TABLE_NAMES.DOCUMENTS).insert([{ id, ...payload }]);
    } else {
      const list = await this.getDocuments();
      list.unshift({ ...docData, userId });
      localStorage.setItem(LOCAL_KEYS.DOCUMENTS, JSON.stringify(list));
    }
    this.logActivity(`Upload de documento: ${docData.name}`);
  }

  async deleteDocument(id: string) {
    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      await supabase.from(TABLE_NAMES.DOCUMENTS).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getDocuments();
      localStorage.setItem(LOCAL_KEYS.DOCUMENTS, JSON.stringify(list.filter(i => i.id !== id)));
    }
  }

  // --- Escritórios (Office Management) ---
  async getOffices(): Promise<Office[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from(TABLE_NAMES.OFFICES).select('*');
      if (error) return [];

      return (data || []).map((o: any) => ({
          ...o,
          ownerId: o.owner_id,
          logoUrl: o.logo_url,
          createdAt: o.created_at,
          areaOfActivity: o.area_of_activity,
          members: o.members || []
      }));
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.OFFICES) || '[]');
    }
  }

  async getOfficeById(id: string): Promise<Office | undefined> {
    if (isSupabaseConfigured && supabase) {
       const { data, error } = await supabase.from(TABLE_NAMES.OFFICES).select('*').eq('id', id).single();
       if (error || !data) return undefined;
       return {
          ...data,
          ownerId: data.owner_id,
          logoUrl: data.logo_url,
          createdAt: data.created_at,
          areaOfActivity: data.area_of_activity,
          members: data.members || []
       };
    }
    const offices = await this.getOffices();
    return offices.find(o => o.id === id);
  }
  
  async saveOffice(office: Office): Promise<void> {
    if (isSupabaseConfigured && supabase) {
        const { id, ownerId, logoUrl, createdAt, areaOfActivity, members, ...rest } = office;
        const payload = {
            ...rest,
            id,
            owner_id: ownerId,
            logo_url: logoUrl,
            created_at: createdAt,
            area_of_activity: areaOfActivity,
            members: members
        };
        
        await supabase.from(TABLE_NAMES.OFFICES).upsert(payload);
        this.logActivity(`Atualizou escritório: ${office.name}`);
    } else {
        const offices = await this.getOffices();
        const index = offices.findIndex(o => o.id === office.id);
        if (index >= 0) {
          offices[index] = office;
          localStorage.setItem(LOCAL_KEYS.OFFICES, JSON.stringify(offices));
          this.logActivity(`Atualizou dados do escritório: ${office.name}`);
        }
    }
  }

  585
  (officeData: Partial<Office>): Promise<Office> {
    const userId = await this.getUserId();
    // Fallback if user is null in localStorage (prevents crash)
    const userStr = localStorage.getItem('@JurisControl:user');
    // FIX: Check if userStr exists before parsing, and use defensive optional chaining later
    const user = userStr ? JSON.parse(userStr) : { name: 'Admin', email: 'admin@email.com', avatar: '' };

    let handle = officeData.handle || `@office${Date.now()}`;
    if (!handle.startsWith('@')) handle = '@' + handle;

    if (isSupabaseConfigured && supabase) {
        const { count } = await supabase.from(TABLE_NAMES.OFFICES).select('id', { count: 'exact', head: true }).eq('handle', handle);
        if (count && count > 0) throw new Error("Este identificador (@handle) já está em uso.");

        const newOffice = {
            name: officeData.name || 'Novo Escritório',
            handle: handle,
            location: officeData.location || 'Brasil',
            owner_id: userId,
            created_at: new Date().toISOString(),
            members: [{
                userId: userId,
                name: user?.name || 'User', // FIX: Optional chaining
                email: user?.email || '',
                avatarUrl: user?.avatar || '',
                role: 'Admin',
                permissions: { financial: true, cases: true, documents: true, settings: true }
            }]
        };

        const { data, error } = await supabase.from(TABLE_NAMES.OFFICES).insert(newOffice).select().single();
        if (error) throw new Error(error.message);
        
        this.logActivity(`Criou novo escritório (Supabase): ${newOffice.name}`);
        return {
            ...data,
            ownerId: data.owner_id,
            createdAt: data.created_at,
            members: data.members
        } as Office;

    } else {
        const offices = await this.getOffices();
        if (offices.some(o => o.handle.toLowerCase() === handle.toLowerCase())) {
          throw new Error("Este identificador de escritório (@handle) já está em uso.");
        }

        const newOffice: Office = {
          id: `office-${Date.now()}`,
          name: officeData.name || 'Novo Escritório',
          handle: handle,
          location: officeData.location || 'Brasil',
          ownerId: userId,
          members: [
            {
              userId: userId,
              name: user?.name || 'User', // FIX: Optional chaining
              email: user?.email || '',
              avatarUrl: user?.avatar || '',
              role: 'Admin',
              permissions: { financial: true, cases: true, documents: true, settings: true }
            }
          ],
          createdAt: new Date().toISOString()
        };

        const updatedOffices = [...offices, newOffice];
        localStorage.setItem(LOCAL_KEYS.OFFICES, JSON.stringify(updatedOffices));
        this.logActivity(`Criou novo escritório: ${newOffice.name}`);
        return newOffice;
    }
  }

  async joinOffice(officeHandle: string): Promise<Office> {
    if (isSupabaseConfigured && supabase) {
        const { data: office, error } = await supabase.from(TABLE_NAMES.OFFICES).select('*').eq('handle', officeHandle).single();
        if (error || !office) throw new Error("Escritório não encontrado.");

        const userId = await this.getUserId();
        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user?.user_metadata || {};

        const members = office.members || [];
        if (members.some((m: any) => m.userId === userId)) {
            return {
                ...office,
                ownerId: office.owner_id,
                createdAt: office.created_at,
                members
            };
        }

        const newMember: OfficeMember = {
             userId: userId,
             name: u.full_name || 'Novo Membro',
             email: session?.user?.email || '',
             avatarUrl: u.avatar_url || '',
             role: 'Advogado',
             permissions: { financial: false, cases: true, documents: true, settings: false }
        };
        
        const updatedMembers = [...members, newMember];
        
        const { error: updateError } = await supabase
            .from(TABLE_NAMES.OFFICES)
            .update({ members: updatedMembers })
            .eq('id', office.id);
            
        if (updateError) throw updateError;

        this.logActivity(`Entrou no escritório: ${office.name}`);
        return {
            ...office,
            ownerId: office.owner_id,
            createdAt: office.created_at,
            members: updatedMembers
        };

    } else {
        const offices = await this.getOffices();
        const targetOffice = offices.find(o => o.handle.toLowerCase() === officeHandle.toLowerCase());
        if (!targetOffice) throw new Error("Escritório não encontrado com este identificador.");

        const userId = await this.getUserId();
        const userStr = localStorage.getItem('@JurisControl:user');
        const user = userStr ? JSON.parse(userStr) : { name: 'Novo Membro', email: '', avatar: '', id: 'temp-id', username: '', provider: 'email', offices: [], twoFactorEnabled: false, emailVerified: false, phone: '', oab: '', role: 'Advogado' };
        
        if (!targetOffice.members.some(m => m.userId === userId)) {
           targetOffice.members.push({
             userId: userId,
             name: user?.name || 'Novo Membro', // FIX: Optional chaining
             email: user?.email || '',
             avatarUrl: user?.avatar || '',
             role: 'Advogado',
             permissions: { financial: false, cases: true, documents: true, settings: false }
           });
           const updatedOffices = offices.map(o => o.id === targetOffice.id ? targetOffice : o);
           localStorage.setItem(LOCAL_KEYS.OFFICES, JSON.stringify(updatedOffices));
           this.logActivity(`Entrou no escritório: ${targetOffice.name}`);
        }
        return targetOffice;
    }
  }

  async inviteUserToOffice(officeId: string, userHandle: string): Promise<boolean> {
     if (!userHandle.startsWith('@')) throw new Error("O nome de usuário deve começar com @.");
     await new Promise(resolve => setTimeout(resolve, 800));
     return true; 
  }

  // --- Utils & Logs ---
  getLogs(): ActivityLog[] { 
    try { return JSON.parse(localStorage.getItem(LOCAL_KEYS.LOGS) || '[]'); } catch { return []; }
  }
  
  logActivity(action: string, status: 'Success' | 'Failed' | 'Warning' = 'Success') {
    if (isSupabaseConfigured && supabase) {
        this.getUserId().then(uid => {
            supabase!.from(TABLE_NAMES.LOGS).insert([{
                user_id: uid,
                action,
                status,
                device: navigator.userAgent,
                ip: 'IP_PLACEHOLDER'
            }]).then(({ error }) => {
                if(error) console.warn("Failed to log to Supabase", error);
            });
        });
    } else {
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
        localStorage.setItem(LOCAL_KEYS.LOGS, JSON.stringify(logs.slice(0, 50)));
    }
  }

  getSettings(): AppSettings {
      try {
          const s = localStorage.getItem(LOCAL_KEYS.SETTINGS);
          const parsed = s ? JSON.parse(s) : {};
          
          return {
            general: parsed.general || { language: 'pt-BR', dateFormat: 'DD/MM/YYYY', compactMode: false },
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
      localStorage.setItem(LOCAL_KEYS.SETTINGS, JSON.stringify(settings));
      if (isSupabaseConfigured && supabase) {
          this.getUserId().then(uid => {
              supabase!.from(TABLE_NAMES.PROFILES).update({ settings }).eq('id', uid);
          });
      }
  }

  async getDashboardSummary(): Promise<DashboardData> {
    const [allCases, allTasks] = await Promise.all([
      this.getCases(),
      this.getTasks()
    ]);

    let activeCases = 0, wonCases = 0, pendingCases = 0, archivedCases = 0, hearings = 0;
    
    for (const c of allCases) {
        if (c.status === CaseStatus.ACTIVE) activeCases++;
        else if (c.status === CaseStatus.WON) wonCases++;
        else if (c.status === CaseStatus.PENDING) pendingCases++;
        else if (c.status === CaseStatus.ARCHIVED) archivedCases++;
        
        if (c.nextHearing) hearings++;
    }

    const highPriorityTasks = allTasks.filter(t => t.priority === 'Alta' && t.status !== 'Concluído').length;

    const caseDistribution = [
        { name: 'Ativos', value: activeCases, color: '#818cf8' },
        { name: 'Pendentes', value: pendingCases, color: '#fbbf24' },
        { name: 'Ganhos', value: wonCases, color: '#34d399' },
        { name: 'Arquivados', value: archivedCases, color: '#94a3b8' },
    ];

    const upcomingHearings = allCases
        .filter(c => c.nextHearing)
        .sort((a, b) => {
            if (!a.nextHearing || !b.nextHearing) return 0;
            const [dA, mA, yA] = a.nextHearing.split('/').map(Number);
            const [dB, mB, yB] = b.nextHearing.split('/').map(Number);
            return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
        })
        .slice(0, 4); 

    const todayStr = new Date().toLocaleDateString('pt-BR');
    const todaysAgenda = [
        ...allTasks.filter(t => t.dueDate === todayStr && t.status !== 'Concluído').map(t => ({ type: 'task' as const, title: t.title, sub: 'Prazo Fatal', id: t.id })),
        ...allCases.filter(c => c.nextHearing === todayStr).map(c => ({ type: 'hearing' as const, title: c.title, sub: 'Audiência', id: c.id }))
    ].slice(0, 5);

    const recentMovements = allCases
      .flatMap(c => (c.movements || []).map(m => ({
        id: m.id,
        caseId: c.id,
        caseTitle: c.title,
        description: m.description,
        date: m.date,
        type: m.type,
        sortTime: (() => {
           try {
             const [day, month, year] = m.date.split(' ')[0].split('/');
             return new Date(`${year}-${month}-${day}`).getTime();
           } catch { return 0; }
        })()
      })))
      .sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0))
      .slice(0, 5)
      .map(({ sortTime, ...rest }) => rest);

    return {
        counts: { activeCases, wonCases, pendingCases, hearings, highPriorityTasks },
        charts: { caseDistribution },
        lists: { upcomingHearings, todaysAgenda, recentMovements }
    };
  }

  async searchGlobal(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];
    
    const lowerQuery = query.toLowerCase();
    const [clients, cases, tasks] = await Promise.all([
        this.getClients(),
        this.getCases(),
        this.getTasks()
    ]);

    const results: SearchResult[] = [];

    for (const c of clients) {
        if (c.name.toLowerCase().includes(lowerQuery) || 
            c.email.toLowerCase().includes(lowerQuery) || 
            (c.cpf && c.cpf.includes(lowerQuery)) || 
            (c.cnpj && c.cnpj.includes(lowerQuery))) {
            results.push({
                id: c.id,
                type: 'client',
                title: c.name,
                subtitle: c.type === 'PF' ? c.cpf : c.cnpj,
                url: `/clients/${c.id}`
            });
        }
    }

    for (const c of cases) {
        if (c.title.toLowerCase().includes(lowerQuery) || 
            c.cnj.includes(lowerQuery) || 
            c.client.name.toLowerCase().includes(lowerQuery)) {
            results.push({
                id: c.id,
                type: 'case',
                title: c.title,
                subtitle: `CNJ: ${c.cnj} • ${c.client.name}`,
                url: `/cases/${c.id}`
            });
        }
    }

    for (const t of tasks) {
        if (t.title.toLowerCase().includes(lowerQuery)) {
            results.push({
                id: t.id,
                type: 'task',
                title: t.title,
                subtitle: `Vence: ${t.dueDate} • ${t.status}`,
                url: '/crm'
            });
        }
    }

    return results.slice(0, 8);
  }

  // Não preenche mais o banco com dados de teste
  async seedDatabase() {
    // void intentionally
  }

  async runAutomations() {
    await this.checkDeadlines();
  }

  async checkDeadlines() {
    const lastCheck = localStorage.getItem(LOCAL_KEYS.LAST_CHECK);
    const today = new Date();
    const todayStr = today.toDateString();

    if (lastCheck === todayStr) return;

    const tasks = await this.getTasks();
    const cases = await this.getCases();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isDate = (dateStr: string, targetDate: Date) => {
       if (!dateStr) return false;
       const [d, m, y] = dateStr.split('/').map(Number);
       if (!d || !m || !y) return false;
       return d === targetDate.getDate() && m === targetDate.getMonth() + 1 && y === targetDate.getFullYear();
    };

    for (const task of tasks) {
        if (task.status !== 'Concluído' && isDate(task.dueDate, tomorrow)) {
            notificationService.notify('Prazo de Tarefa Próximo', `A tarefa "${task.title}" vence amanhã (${task.dueDate}).`, 'warning');
        }
    }

    for (const legalCase of cases) {
        if (legalCase.status === CaseStatus.ACTIVE && legalCase.nextHearing && isDate(legalCase.nextHearing, tomorrow)) {
            notificationService.notify('Audiência Amanhã', `Audiência do processo "${legalCase.title}" agendada para amanhã.`, 'warning');
        }
    }

    localStorage.setItem(LOCAL_KEYS.LAST_CHECK, todayStr);
  }
  
  factoryReset() {
    localStorage.clear();
    // Se houver supabase, a lógica seria diferente, mas o cliente web não tem permissão para limpar o DB de produção.
    // Isso é apenas para limpar o estado local do app.
    window.location.reload();
  }
}

export const storageService = new StorageService();
