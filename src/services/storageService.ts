
import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, User, CaseMovement, SearchResult, OfficeMember, EmailSettings } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { notificationService } from './notificationService';
import { MOCK_CLIENTS, MOCK_CASES, MOCK_TASKS, MOCK_FINANCIALS, MOCK_OFFICES as MOCK_OFFICES_DATA } from './mockData';

const TABLE_NAMES = {
  CLIENTS: 'clients',
  CASES: 'cases',
  TASKS: 'tasks',
  FINANCIAL: 'financial',
  DOCUMENTS: 'documents',
  OFFICES: 'offices',
  OFFICE_MEMBERS: 'office_members',
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

export const MOCK_OFFICES: Office[] = [];

class StorageService {
  
  constructor() {
    this.seedDatabase();
  }

  private async getUserSession(): Promise<{ userId: string | null, officeId: string | null }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
            const storedUser = localStorage.getItem('@JurisControl:user');
            const localUser = storedUser ? JSON.parse(storedUser) : null;
            return { userId: data.session.user.id, officeId: localUser?.currentOfficeId || null };
        }
      } catch {}
    }
    // Fallback Local
    const stored = localStorage.getItem('@JurisControl:user');
    if (stored) {
        const u = JSON.parse(stored);
        return { userId: u.id, officeId: u.currentOfficeId || null };
    }
    return { userId: 'local-user', officeId: null };
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
    if (!officeId) return [];
    return items.filter(item => item.officeId === officeId);
  }

  // =================================================================================
  // ESCRITÓRIOS (OFFICES)
  // =================================================================================

  async getOffices(): Promise<Office[]> {
    if (isSupabaseConfigured && supabase) {
      try {
          const session = await this.getUserSession();
          if (!session.userId) return [];

          const { data: memberships, error: memError } = await supabase
            .from(TABLE_NAMES.OFFICE_MEMBERS)
            .select(`
                role, 
                permissions, 
                office:offices (
                  id, name, handle, location, owner_id, logo_url, created_at, area_of_activity
                )
            `)
            .eq('user_id', session.userId);

          if (memError) throw memError;
          if (!memberships || memberships.length === 0) return [];

          return memberships.map((m: any) => {
              const o = m.office;
              return {
                  id: o.id,
                  name: o.name,
                  handle: o.handle,
                  location: o.location,
                  ownerId: o.owner_id,
                  logoUrl: o.logo_url,
                  createdAt: o.created_at,
                  areaOfActivity: o.area_of_activity,
                  members: [{
                      userId: session.userId!,
                      name: 'Você',
                      role: m.role,
                      permissions: m.permissions || {}
                  } as OfficeMember]
              };
          });
      } catch (e) {
          console.error("Error fetching offices:", e);
          return [];
      }
    } else {
      return this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
    }
  }

  async getOfficeById(id: string): Promise<Office | undefined> {
    if (isSupabaseConfigured && supabase) {
       try {
           const { data: office, error: offError } = await supabase
               .from(TABLE_NAMES.OFFICES)
               .select('*')
               .eq('id', id)
               .single();
           
           if (offError || !office) return undefined;

           // Join com Profiles para pegar dados reais dos membros
           const { data: membersData, error: memError } = await supabase
               .from(TABLE_NAMES.OFFICE_MEMBERS)
               .select(`
                  id, user_id, role, permissions, joined_at,
                  profile:profiles ( full_name, email, avatar_url, username )
               `)
               .eq('office_id', id);

           if (memError) throw memError;

           const members: OfficeMember[] = (membersData || []).map((m: any) => ({
               id: m.id,
               userId: m.user_id,
               name: m.profile?.full_name || 'Usuário',
               email: m.profile?.email,
               avatarUrl: m.profile?.avatar_url,
               role: m.role,
               permissions: m.permissions,
               joinedAt: m.joined_at
           }));

           return {
               id: office.id,
               name: office.name,
               handle: office.handle,
               location: office.location,
               ownerId: office.owner_id,
               logoUrl: office.logo_url,
               createdAt: office.created_at,
               areaOfActivity: office.area_of_activity,
               social: office.social,
               members: members
           };
       } catch { return undefined; }
    }
    const offices = await this.getOffices();
    return offices.find(o => o.id === id);
  }
  
  async saveOffice(office: Office): Promise<void> {
    if (isSupabaseConfigured && supabase) {
        // Atualiza dados do escritório
        const officePayload = {
            id: office.id,
            name: office.name,
            handle: office.handle,
            location: office.location,
            owner_id: office.ownerId,
            logo_url: office.logoUrl,
            created_at: office.createdAt,
            area_of_activity: office.areaOfActivity,
            social: office.social
        };
        await supabase.from(TABLE_NAMES.OFFICES).upsert(officePayload);

        // Atualiza permissões/roles dos membros
        for (const member of office.members) {
            await supabase.from(TABLE_NAMES.OFFICE_MEMBERS)
                .update({ 
                    role: member.role, 
                    permissions: member.permissions 
                })
                .eq('office_id', office.id)
                .eq('user_id', member.userId);
        }

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

  async createOffice(officeData: Partial<Office>, explicitOwnerId?: string, userDetails?: { name: string, email: string }): Promise<Office> {
      const session = await this.getUserSession();
      const userId = explicitOwnerId || session.userId || 'local';
      
      let userName = userDetails?.name || 'User';
      let userEmail = userDetails?.email || '';
      
      if (!userDetails) {
          const storedUser = localStorage.getItem('@JurisControl:user');
          const localUser = storedUser ? JSON.parse(storedUser) : null;
          if (localUser) {
              userName = localUser.name;
              userEmail = localUser.email;
          }
      }

      let handle = officeData.handle || `@office${Date.now()}`;
      if (!handle.startsWith('@')) handle = '@' + handle;
      handle = handle.toLowerCase();

      if (isSupabaseConfigured && supabase) {
          await this.ensureProfileExists();
          
          const payload = {
              name: officeData.name || 'Novo Escritório',
              handle: handle,
              location: officeData.location || 'Brasil',
              owner_id: userId,
              social: {}
          };

          const { data, error } = await supabase.from(TABLE_NAMES.OFFICES).insert(payload).select().single();
          
          if (error) {
              if (error.code === '23505') throw new Error("Este identificador (@handle) já está em uso.");
              throw new Error(error.message);
          }
          
          this.logActivity(`Criou novo escritório (Supabase): ${payload.name}`);
          
          return {
              id: data.id,
              name: data.name,
              handle: data.handle,
              location: data.location,
              ownerId: data.owner_id,
              createdAt: data.created_at,
              members: [{ 
                  userId: userId, 
                  name: userName, 
                  email: userEmail, 
                  role: 'Admin', 
                  permissions: { financial: true, cases: true, documents: true, settings: true } 
              } as OfficeMember],
              social: data.social
          } as Office;

      } else {
          const offices = this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
          if (offices.some(o => o.handle.toLowerCase() === handle.toLowerCase())) {
            throw new Error("Este identificador de escritório (@handle) já está em uso.");
          }

          const newOffice: Office = {
              id: `office-${Date.now()}`,
              name: officeData.name || 'Novo Escritório',
              handle,
              location: officeData.location || 'Brasil',
              ownerId: userId,
              createdAt: new Date().toISOString(),
              members: [{ userId, name: userName, email: userEmail, role: 'Admin', permissions: { financial: true, cases: true, documents: true, settings: true } } as OfficeMember],
              social: {}
          };
          offices.push(newOffice);
          this.setLocal(LOCAL_KEYS.OFFICES, offices);
          return newOffice;
      }
  }

  async joinOffice(handle: string): Promise<Office> {
      if (isSupabaseConfigured && supabase) {
          const session = await this.getUserSession();
          if (!session.userId) throw new Error("Login necessário.");
          await this.ensureProfileExists();
          
          const { data: office, error } = await supabase.from(TABLE_NAMES.OFFICES).select('id, name, owner_id, handle').eq('handle', handle).single();
          
          if (error || !office) {
              throw new Error("Escritório não encontrado ou acesso restrito.");
          }
          
          const { data: existing } = await supabase.from(TABLE_NAMES.OFFICE_MEMBERS)
                .select('id')
                .eq('office_id', office.id)
                .eq('user_id', session.userId)
                .maybeSingle();

          if (!existing) {
              const { error: joinError } = await supabase.from(TABLE_NAMES.OFFICE_MEMBERS).insert({ 
                  office_id: office.id, 
                  user_id: session.userId, 
                  role: 'Advogado',
                  permissions: { financial: false, cases: true, documents: true, settings: false }
              });
              
              if (joinError) throw new Error("Não foi possível entrar no escritório.");
          }

          this.logActivity(`Entrou no escritório: ${office.name}`);
          
          return { 
              id: office.id, 
              name: office.name, 
              handle: handle, 
              ownerId: office.owner_id, 
              location: '', 
              members: [] 
          };

      } else {
          const offices = this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
          const targetOffice = offices.find(o => o.handle.toLowerCase() === handle.toLowerCase());
          if (!targetOffice) throw new Error("Escritório não encontrado.");
          return targetOffice;
      }
  }

  async removeMemberFromOffice(officeId: string, userIdToRemove: string) {
      if (isSupabaseConfigured && supabase) {
          await supabase.from(TABLE_NAMES.OFFICE_MEMBERS)
              .delete()
              .eq('office_id', officeId)
              .eq('user_id', userIdToRemove);
              
          this.logActivity(`Removeu membro do escritório.`);
      }
  }

  async inviteUserToOffice(officeId: string, identifier: string): Promise<boolean> {
     if (isSupabaseConfigured && supabase) {
         let query = supabase.from(TABLE_NAMES.PROFILES).select('id');
         
         if (identifier.includes('@') && !identifier.startsWith('@')) {
             query = query.eq('email', identifier);
         } else {
             const username = identifier.startsWith('@') ? identifier : '@' + identifier;
             query = query.eq('username', username);
         }
         
         const { data: userFound, error } = await query.maybeSingle();
         
         if (error || !userFound) {
             throw new Error("Usuário não encontrado na plataforma. Peça para ele se cadastrar primeiro.");
         }

         const { data: existing } = await supabase.from(TABLE_NAMES.OFFICE_MEMBERS)
             .select('id')
             .eq('office_id', officeId)
             .eq('user_id', userFound.id)
             .maybeSingle();
             
         if (existing) {
             throw new Error("Este usuário já é membro do escritório.");
         }

         const { error: insertError } = await supabase.from(TABLE_NAMES.OFFICE_MEMBERS).insert({
             office_id: officeId,
             user_id: userFound.id,
             role: 'Advogado',
             permissions: { financial: false, cases: true, documents: true, settings: false }
         });

         if (insertError) throw new Error("Erro ao adicionar membro.");
         
         this.logActivity(`Convidou usuário ${identifier} para o escritório.`);
         return true;
     } else {
         await new Promise(resolve => setTimeout(resolve, 800));
         return true; 
     }
  }

  // --- Clientes ---
  async getClients(): Promise<Client[]> {
    return this.genericGet(TABLE_NAMES.CLIENTS, LOCAL_KEYS.CLIENTS);
  }

  async saveClient(client: Client) { return this.genericSave(TABLE_NAMES.CLIENTS, LOCAL_KEYS.CLIENTS, client); }
  async deleteClient(id: string) { return this.genericDelete(TABLE_NAMES.CLIENTS, LOCAL_KEYS.CLIENTS, id); }

  // --- Processos (Cases) ---
  async getCases(): Promise<LegalCase[]> {
    if (isSupabaseConfigured && supabase) {
        const s = await this.getUserSession();
        if(!s.officeId) return [];
        const { data, error } = await supabase
            .from(TABLE_NAMES.CASES)
            .select('*, client:clients(*)')
            .eq('office_id', s.officeId);
            
        if(error) {
            console.error("Error fetching cases:", error);
            return [];
        }
        
        return (data || []).map((item: any) => ({
            ...item,
            client: item.client // Ensure mapping is correct
        })) as LegalCase[];
    }
    return this.genericGet(TABLE_NAMES.CASES, LOCAL_KEYS.CASES);
  }

  async getCaseById(id: string): Promise<LegalCase | undefined> {
    if (isSupabaseConfigured && supabase) {
        const s = await this.getUserSession();
        if(!s.officeId) return undefined;
        const { data, error } = await supabase
            .from(TABLE_NAMES.CASES)
            .select('*, client:clients(*)')
            .eq('id', id)
            .eq('office_id', s.officeId)
            .single();
            
        if(error || !data) return undefined;
        return { ...data, client: data.client } as LegalCase;
    }
    const cases = await this.getCases();
    return cases.find(c => c.id === id);
  }

  async getCasesPaginated(
    page: number = 1, 
    limit: number = 20, 
    searchTerm: string = '', 
    statusFilter: string | null = null,
    categoryFilter: string | null = null, 
    dateRange: { start: string, end: string } | null = null
  ): Promise<{ data: LegalCase[], total: number }> {
    const allCases = await this.getCases();
    
    let filtered = allCases;

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

  async saveCase(c: LegalCase) { return this.genericSave(TABLE_NAMES.CASES, LOCAL_KEYS.CASES, c); }
  async deleteCase(id: string) { return this.genericDelete(TABLE_NAMES.CASES, LOCAL_KEYS.CASES, id); }

  // --- Tarefas ---
  async getTasks(): Promise<Task[]> { return this.genericGet(TABLE_NAMES.TASKS, LOCAL_KEYS.TASKS); }
  async getTasksByCaseId(id: string) { return (await this.getTasks()).filter(t=>t.caseId===id); }
  async saveTask(t: Task) { return this.genericSave(TABLE_NAMES.TASKS, LOCAL_KEYS.TASKS, t); }
  async deleteTask(id: string) { return this.genericDelete(TABLE_NAMES.TASKS, LOCAL_KEYS.TASKS, id); }

  // --- Financeiro ---
  async getFinancials(): Promise<FinancialRecord[]> { return this.genericGet(TABLE_NAMES.FINANCIAL, LOCAL_KEYS.FINANCIAL); }
  async getFinancialsByCaseId(id: string) { return (await this.getFinancials()).filter(f=>f.caseId===id); }
  async saveFinancial(f: FinancialRecord) { return this.genericSave(TABLE_NAMES.FINANCIAL, LOCAL_KEYS.FINANCIAL, f); }

  // --- Documentos ---
  async getDocuments(): Promise<SystemDocument[]> { return this.genericGet(TABLE_NAMES.DOCUMENTS, LOCAL_KEYS.DOCUMENTS); }
  async getDocumentsByCaseId(id: string) { return (await this.getDocuments()).filter(d=>d.caseId===id); }
  async saveDocument(d: SystemDocument) { return this.genericSave(TABLE_NAMES.DOCUMENTS, LOCAL_KEYS.DOCUMENTS, d); }
  async deleteDocument(id: string) { return this.genericDelete(TABLE_NAMES.DOCUMENTS, LOCAL_KEYS.DOCUMENTS, id); }
  
  async saveSmartMovement(caseId: string, movement: CaseMovement, tasks: Task[], doc: SystemDocument) { 
      const kase = await this.getCaseById(caseId); 
      if(kase) { 
          kase.movements = [movement, ...(kase.movements||[])]; 
          await this.saveCase(kase); 
          await this.saveDocument(doc);
          for(const t of tasks) await this.saveTask(t);
      }
  }

  // --- Account Mgmt ---
  async checkAccountStatus(userId: string): Promise<{ deleted_at: string | null }> {
    if (isSupabaseConfigured && supabase) {
        try {
            const { data } = await supabase.from(TABLE_NAMES.PROFILES).select('deleted_at').eq('id', userId).maybeSingle();
            return data || { deleted_at: null };
        } catch { return { deleted_at: null }; }
    }
    return { deleted_at: null };
  }

  async deleteAccount() {
    const session = await this.getUserSession();
    if (!session.userId) return;
    if (isSupabaseConfigured && supabase) {
      try { const { error } = await supabase.rpc('delete_own_account'); if (!error) { await supabase.auth.signOut(); localStorage.clear(); return; } } catch {}
      await supabase.auth.signOut();
    }
    localStorage.clear();
  }

  async reactivateAccount() {
      if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.rpc('reactivate_own_account');
          if (error) {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) { await supabase.from(TABLE_NAMES.PROFILES).update({ deleted_at: null }).eq('id', user.id); await this.ensureProfileExists(); }
          }
      }
  }

  getLogs(): ActivityLog[] { try { return JSON.parse(localStorage.getItem(LOCAL_KEYS.LOGS) || '[]'); } catch { return []; } }
  logActivity(action: string, status: 'Success' | 'Failed' | 'Warning' = 'Success') {
    if (isSupabaseConfigured && supabase) {
        this.getUserSession().then(s => {
            if (s.userId) {
                supabase!.from(TABLE_NAMES.LOGS).insert([{ user_id: s.userId, action, status, device: navigator.userAgent, ip: 'IP', date: new Date().toISOString() }]).then(() => {});
            }
        });
    }
  }

  // --- Dashboard ---
  async getDashboardSummary(): Promise<DashboardData> {
    const [allCases, allTasks] = await Promise.all([this.getCases(), this.getTasks()]);
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
    const upcomingHearings = allCases.filter(c => c.nextHearing).slice(0, 4); 
    const recentMovements = allCases.flatMap(c => (c.movements || []).map(m => ({ id: m.id, caseId: c.id, caseTitle: c.title, description: m.description, date: m.date, type: m.type }))).slice(0, 5);
    return {
        counts: { activeCases, wonCases, pendingCases, hearings, highPriorityTasks },
        charts: { caseDistribution },
        lists: { upcomingHearings, todaysAgenda: [], recentMovements }
    };
  }

  async searchGlobal(query: string): Promise<SearchResult[]> { 
      const lower = query.toLowerCase();
      const [clients, cases] = await Promise.all([this.getClients(), this.getCases()]);
      const res: SearchResult[] = [];
      clients.filter(c => c.name.toLowerCase().includes(lower)).forEach(c => res.push({ id: c.id, type: 'client', title: c.name, subtitle: c.type, url: `/clients/${c.id}` }));
      cases.filter(c => c.title.toLowerCase().includes(lower)).forEach(c => res.push({ id: c.id, type: 'case', title: c.title, subtitle: c.cnj, url: `/cases/${c.id}` }));
      return res.slice(0, 5);
  }

  getSettings(): AppSettings {
      try {
          const s = localStorage.getItem(LOCAL_KEYS.SETTINGS);
          return s ? JSON.parse(s) : { general: { language: 'pt-BR', dateFormat: 'DD/MM/YYYY', compactMode: false, dataJudApiKey: '' }, notifications: { email: true, desktop: true, sound: false, dailyDigest: false }, emailPreferences: { enabled: false, frequency: 'immediate', categories: { deadlines: true, processes: true, events: true, financial: false, marketing: true }, deadlineAlerts: { sevenDays: true, threeDays: true, oneDay: true, onDueDate: true } }, automation: { autoArchiveWonCases: false, autoSaveDrafts: true } };
      } catch { return {} as any; }
  }
  saveSettings(settings: AppSettings) { localStorage.setItem(LOCAL_KEYS.SETTINGS, JSON.stringify(settings)); }
  async checkRealtimeAlerts() {}
  async seedDatabase() { if (!this.getLocal(LOCAL_KEYS.CLIENTS, null)) { this.setLocal(LOCAL_KEYS.CLIENTS, MOCK_CLIENTS); this.setLocal(LOCAL_KEYS.CASES, MOCK_CASES); this.setLocal(LOCAL_KEYS.TASKS, MOCK_TASKS); this.setLocal(LOCAL_KEYS.FINANCIAL, MOCK_FINANCIALS); this.setLocal(LOCAL_KEYS.OFFICES, MOCK_OFFICES_DATA); } }
  factoryReset() { localStorage.clear(); window.location.reload(); }

  // Helpers
  private async genericGet(table: string, key: string): Promise<any[]> {
      if (isSupabaseConfigured && supabase) {
          const s = await this.getUserSession();
          if(!s.officeId) return [];
          const { data } = await supabase.from(table).select('*').eq('office_id', s.officeId);
          return data || [];
      }
      const s = await this.getUserSession();
      const all = this.getLocal<any[]>(key, []);
      return s.officeId ? this.filterByOffice(all, s.officeId) : all;
  }
  private async genericSave(table: string, key: string, item: any) {
      const s = await this.getUserSession();
      if (isSupabaseConfigured && supabase) {
          if(!s.officeId) throw new Error("Sessão inválida");
          const payload = { ...item, office_id: s.officeId, user_id: s.userId };
          await supabase.from(table).upsert(payload);
      } else {
          const list = this.getLocal<any[]>(key, []);
          item.officeId = s.officeId || 'office-1';
          const idx = list.findIndex(x => x.id === item.id);
          if (idx >= 0) list[idx] = item; else { if(!item.id) item.id = `${Date.now()}`; list.push(item); }
          this.setLocal(key, list);
      }
  }
  private async genericDelete(table: string, key: string, id: string) {
      if (isSupabaseConfigured && supabase) {
          const s = await this.getUserSession();
          if(!s.officeId) return;
          await supabase.from(table).delete().eq('id', id).eq('office_id', s.officeId);
      } else {
          const list = this.getLocal<any[]>(key, []);
          this.setLocal(key, list.filter(x => x.id !== id));
      }
  }
}

export const storageService = new StorageService();
