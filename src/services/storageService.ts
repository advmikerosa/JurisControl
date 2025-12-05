
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

           const { data: membersData, error: memError } = await supabase
               .from(TABLE_NAMES.OFFICE_MEMBERS)
               .select('id, user_id, role, permissions, joined_at')
               .eq('office_id', id);

           if (memError) throw memError;

           const members: OfficeMember[] = (membersData || []).map((m: any) => ({
               id: m.id,
               userId: m.user_id,
               name: 'Membro',
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

  async createOffice(officeData: Partial<Office>, explicitUserId?: string, userDetails?: { name: string, email: string }): Promise<Office> {
      const session = await this.getUserSession();
      const userId = explicitUserId || session.userId || 'local';
      
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
          if (error) throw error;
          
          return {
              id: data.id,
              name: data.name,
              handle: data.handle,
              ownerId: data.owner_id,
              location: data.location,
              members: [{ userId: userId, name: userName, email: userEmail, role: 'Admin', permissions: { financial: true, cases: true, documents: true, settings: true } } as OfficeMember],
              createdAt: data.created_at
          };
      } else {
          const offices = this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
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
          const { data: office, error } = await supabase.from(TABLE_NAMES.OFFICES).select('id, name, owner_id').eq('handle', handle).single();
          if (error || !office) throw new Error("Escritório não encontrado.");
          
          await supabase.from(TABLE_NAMES.OFFICE_MEMBERS).insert({ office_id: office.id, user_id: session.userId, role: 'Advogado' });
          return { id: office.id, name: office.name, handle: handle, ownerId: office.owner_id, location: '', members: [] };
      } else {
          const offices = this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
          const office = offices.find(o => o.handle === handle);
          if (!office) throw new Error("Escritório não encontrado.");
          return office;
      }
  }

  async saveOffice(office: Office) {
      if (isSupabaseConfigured && supabase) {
          await supabase.from(TABLE_NAMES.OFFICES).update({ name: office.name, location: office.location, area_of_activity: office.areaOfActivity, logo_url: office.logoUrl, social: office.social }).eq('id', office.id);
      } else {
          const offices = this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
          const index = offices.findIndex(o => o.id === office.id);
          if (index >= 0) { offices[index] = office; this.setLocal(LOCAL_KEYS.OFFICES, offices); }
      }
  }

  async inviteUserToOffice(officeId: string, userHandle: string): Promise<boolean> {
     return true; 
  }

  // --- Clientes ---
  async getClients(): Promise<Client[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const session = await this.getUserSession();
        if (!session.officeId) return [];

        const { data, error } = await supabase
          .from(TABLE_NAMES.CLIENTS)
          .select('id, name, type, status, email, phone, address, city, state, avatar_url, cpf, cnpj, corporate_name, created_at, tags')
          .eq('office_id', session.officeId)
          .order('name');
        
        if (error) throw error;
        
        return (data || []).map((c: any) => ({
            id: c.id,
            officeId: session.officeId!,
            name: c.name,
            type: c.type,
            status: c.status,
            email: c.email || '',
            phone: c.phone || '',
            address: c.address || '', 
            city: c.city || '',
            state: c.state || '',
            avatarUrl: c.avatar_url || '',
            cpf: c.cpf || '',
            cnpj: c.cnpj || '',
            corporateName: c.corporate_name || '',
            createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '',
            tags: c.tags || [],
            alerts: [],
            documents: [],
            history: [] 
        })) as Client[];
      } catch (error) { 
        return []; 
      }
    } else {
      const all = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
      const session = await this.getUserSession();
      return session.officeId ? this.filterByOffice(all, session.officeId) : all;
    }
  }
  
  // --- Processos (Cases) ---
  async getCases(): Promise<LegalCase[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const session = await this.getUserSession();
        if (!session.officeId) return [];

        const { data, error } = await supabase
          .from(TABLE_NAMES.CASES)
          .select(`
            id, cnj, title, status, category, phase, value,
            responsible_lawyer, court, next_hearing, created_at,
            last_update, description, movements,
            client:clients!cases_client_id_fkey(id, name, type, avatar_url)
          `)
          .eq('office_id', session.officeId);
        
        if (error) throw error;
        
        const mappedData = (data || []).map((item: any) => {
          const clientData = item.client;
          const mappedClient = clientData ? {
              id: clientData.id,
              name: clientData.name,
              type: clientData.type,
              avatarUrl: clientData.avatar_url
          } : { id: 'unknown', name: 'Cliente Desconhecido', type: 'PF', avatarUrl: '' };

          return {
            id: item.id,
            officeId: session.officeId!,
            cnj: item.cnj,
            title: item.title,
            status: item.status,
            category: item.category,
            phase: item.phase,
            value: Number(item.value),
            responsibleLawyer: item.responsible_lawyer,
            court: item.court,
            nextHearing: item.next_hearing,
            distributionDate: item.created_at,
            description: item.description,
            movements: item.movements, 
            lastUpdate: item.last_update,
            client: mappedClient
          };
        });

        return mappedData as LegalCase[];
      } catch (e) { 
        return []; 
      }
    } else {
      const all = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
      const session = await this.getUserSession();
      return session.officeId ? this.filterByOffice(all, session.officeId) : all;
    }
  }

  async getCaseById(id: string): Promise<LegalCase | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const session = await this.getUserSession();
        if (!session.officeId) return null;

        const { data, error } = await supabase
          .from(TABLE_NAMES.CASES)
          .select(`*, client:clients!cases_client_id_fkey(*)`)
          .eq('id', id)
          .eq('office_id', session.officeId)
          .single();
        
        if (error) throw error;
        
        const clientData = data.client;
        const mappedClient = clientData ? {
            id: clientData.id,
            name: clientData.name,
            type: clientData.type,
            avatarUrl: clientData.avatar_url,
            email: clientData.email,
            phone: clientData.phone
        } : { id: 'unknown', name: 'Cliente Desconhecido' };

        return {
            id: data.id,
            officeId: data.office_id,
            cnj: data.cnj,
            title: data.title,
            status: data.status,
            category: data.category,
            phase: data.phase,
            value: Number(data.value),
            responsibleLawyer: data.responsible_lawyer,
            court: data.court,
            nextHearing: data.next_hearing,
            distributionDate: data.created_at,
            description: data.description,
            movements: data.movements,
            changeLog: data.change_log,
            lastUpdate: data.last_update,
            client: mappedClient
        } as LegalCase;
      } catch (e) { 
        return null; 
      }
    } else {
      const cases = await this.getCases();
      return cases.find(c => c.id === id) || null;
    }
  }

  async getCasesPaginated(page: number, limit: number, searchTerm: string, statusFilter: any, categoryFilter: any, dateRange: any) {
      const allCases = await this.getCases();
      let filtered = allCases;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        filtered = filtered.filter(c => c.title.toLowerCase().includes(lower) || c.cnj.includes(lower) || c.client.name.toLowerCase().includes(lower));
      }
      if (statusFilter && statusFilter !== 'Todos') filtered = filtered.filter(c => c.status === statusFilter);
      if (categoryFilter && categoryFilter !== 'Todos') filtered = filtered.filter(c => c.category === categoryFilter);
      if (dateRange && dateRange.start && dateRange.end) {
          filtered = filtered.filter(c => { const d = c.lastUpdate ? c.lastUpdate.split('T')[0] : ''; return d >= dateRange.start && d <= dateRange.end; });
      }
      const start = (page - 1) * limit;
      return { data: filtered.slice(start, start + limit), total: filtered.length };
  }

  // --- CRUD Genérico ---
  async saveClient(client: Client) { return this.genericSave(TABLE_NAMES.CLIENTS, LOCAL_KEYS.CLIENTS, client); }
  async deleteClient(id: string) { return this.genericDelete(TABLE_NAMES.CLIENTS, LOCAL_KEYS.CLIENTS, id); }
  async saveCase(c: LegalCase) { return this.genericSave(TABLE_NAMES.CASES, LOCAL_KEYS.CASES, c); }
  async deleteCase(id: string) { return this.genericDelete(TABLE_NAMES.CASES, LOCAL_KEYS.CASES, id); }
  async getTasks(): Promise<Task[]> { return this.genericGet(TABLE_NAMES.TASKS, LOCAL_KEYS.TASKS); }
  async getTasksByCaseId(id: string) { return (await this.getTasks()).filter(t=>t.caseId===id); }
  async saveTask(t: Task) { return this.genericSave(TABLE_NAMES.TASKS, LOCAL_KEYS.TASKS, t); }
  async deleteTask(id: string) { return this.genericDelete(TABLE_NAMES.TASKS, LOCAL_KEYS.TASKS, id); }
  async getFinancials(): Promise<FinancialRecord[]> { return this.genericGet(TABLE_NAMES.FINANCIAL, LOCAL_KEYS.FINANCIAL); }
  async getFinancialsByCaseId(id: string) { return (await this.getFinancials()).filter(f=>f.caseId===id); }
  async saveFinancial(f: FinancialRecord) { return this.genericSave(TABLE_NAMES.FINANCIAL, LOCAL_KEYS.FINANCIAL, f); }
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
          return s ? JSON.parse(s) : { general: { language: 'pt-BR', dateFormat: 'DD/MM/YYYY', compactMode: false, dataJudApiKey: '' }, notifications: { email: true, desktop: true, sound: false, dailyDigest: false }, automation: { autoArchiveWonCases: false, autoSaveDrafts: true } };
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
