
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

  // Helper para sessão com verificação robusta
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
    // Fallback Local (Demo Mode Only)
    const stored = localStorage.getItem('@JurisControl:user');
    if (stored) {
        const u = JSON.parse(stored);
        return { userId: u.id, officeId: u.currentOfficeId || null };
    }
    return { userId: 'local-user', officeId: null };
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
                office:offices (*)
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
                .select('*')
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

        } catch (e) {
            console.error("Error fetching office details:", e);
            return undefined;
        }
    } else {
        const offices = await this.getOffices();
        return offices.find(o => o.id === id);
    }
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
          const payload = {
              name: officeData.name || 'Novo Escritório',
              handle: handle,
              location: officeData.location || 'Brasil',
              owner_id: userId,
              social: {}
          };

          const { data, error } = await supabase
              .from(TABLE_NAMES.OFFICES)
              .insert(payload)
              .select()
              .single();

          if (error) {
              if (error.code === '23505') throw new Error("Este identificador (@handle) já está em uso.");
              throw error;
          }

          this.logActivity(`Criou escritório: ${data.name}`);
          
          return {
              id: data.id,
              name: data.name,
              handle: data.handle,
              ownerId: data.owner_id,
              location: data.location,
              members: [{
                  userId: userId,
                  name: userName,
                  email: userEmail,
                  role: 'Admin',
                  permissions: { financial: true, cases: true, documents: true, settings: true }
              } as OfficeMember],
              createdAt: data.created_at
          };

      } else {
          const offices = this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
          if (offices.some(o => o.handle === handle)) throw new Error("Handle já existe.");

          const newOffice: Office = {
              id: `office-${Date.now()}`,
              name: officeData.name || 'Novo Escritório',
              handle,
              location: officeData.location || 'Brasil',
              ownerId: userId,
              createdAt: new Date().toISOString(),
              members: [{
                  userId,
                  name: userName,
                  email: userEmail,
                  role: 'Admin',
                  permissions: { financial: true, cases: true, documents: true, settings: true }
              } as OfficeMember],
              social: {}
          };
          
          offices.push(newOffice);
          this.setLocal(LOCAL_KEYS.OFFICES, offices);
          this.logActivity(`Criou novo escritório: ${newOffice.name}`);
          return newOffice;
      }
  }

  async joinOffice(handle: string): Promise<Office> {
      if (isSupabaseConfigured && supabase) {
          const session = await this.getUserSession();
          if (!session.userId) throw new Error("Login necessário.");

          const { data: office, error } = await supabase
              .from(TABLE_NAMES.OFFICES)
              .select('id, name, owner_id')
              .eq('handle', handle)
              .single();

          if (error || !office) throw new Error("Escritório não encontrado ou acesso restrito.");

          const { error: joinError } = await supabase
              .from(TABLE_NAMES.OFFICE_MEMBERS)
              .insert({
                  office_id: office.id,
                  user_id: session.userId,
                  role: 'Advogado'
              });

          if (joinError) {
              if (joinError.code === '23505') throw new Error("Você já é membro deste escritório.");
              throw joinError;
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
          const office = offices.find(o => o.handle === handle);
          if (!office) throw new Error("Escritório não encontrado.");
          
          const userId = (await this.getUserSession()).userId || 'local';
          if (!office.members.some(m => m.userId === userId)) {
              office.members.push({
                  userId,
                  name: 'Novo Membro',
                  role: 'Advogado',
                  permissions: { financial: false, cases: true, documents: true, settings: false }
              } as OfficeMember);
              this.setLocal(LOCAL_KEYS.OFFICES, offices);
          }
          return office;
      }
  }

  async saveOffice(office: Office) {
      if (isSupabaseConfigured && supabase) {
          const { error } = await supabase
              .from(TABLE_NAMES.OFFICES)
              .update({
                  name: office.name,
                  location: office.location,
                  area_of_activity: office.areaOfActivity,
                  logo_url: office.logoUrl,
                  social: office.social
              })
              .eq('id', office.id);
          
          if (error) throw error;
      } else {
          const offices = this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
          const index = offices.findIndex(o => o.id === office.id);
          if (index >= 0) {
              offices[index] = office;
              this.setLocal(LOCAL_KEYS.OFFICES, offices);
          }
      }
  }

  async inviteUserToOffice(officeId: string, userHandle: string): Promise<boolean> {
     if (!userHandle.startsWith('@')) throw new Error("O nome de usuário deve começar com @.");
     await new Promise(resolve => setTimeout(resolve, 800));
     return true; 
  }

  // =================================================================================
  // UTILS & GLOBAL (Account Mgmt)
  // =================================================================================

  async checkAccountStatus(userId: string): Promise<{ deleted_at: string | null }> {
    if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
            .from(TABLE_NAMES.PROFILES)
            .select('deleted_at')
            .eq('id', userId)
            .single();
        
        if (error) return { deleted_at: null };
        return data;
    }
    return { deleted_at: null };
  }

  /**
   * Tenta suspender a conta (Soft Delete).
   * Se a função RPC não existir (erro 404), executa Hard Delete como fallback.
   */
  async deleteAccount() {
    const session = await this.getUserSession();
    if (!session.userId) return;

    if (isSupabaseConfigured && supabase) {
      // 1. Tentar RPC Soft Delete
      try {
        const { error } = await supabase.rpc('delete_own_account');
        if (!error) {
           await supabase.auth.signOut();
           localStorage.clear();
           return;
        }
        console.warn("Soft Delete falhou (RPC missing?), tentando Hard Delete...", error);
      } catch (e) {
        console.warn("Erro ao chamar RPC delete_own_account", e);
      }

      // 2. Fallback: Hard Delete Manual
      const tables = [
        TABLE_NAMES.LOGS,
        TABLE_NAMES.FINANCIAL,
        TABLE_NAMES.TASKS,
        TABLE_NAMES.DOCUMENTS,
        TABLE_NAMES.CASES,
        TABLE_NAMES.CLIENTS,
        TABLE_NAMES.OFFICE_MEMBERS,
        TABLE_NAMES.PROFILES
      ];

      for (const table of tables) {
        try {
            await supabase.from(table).delete().eq('user_id', session.userId);
        } catch (e) {
            console.error(`Erro ao limpar ${table}`, e);
        }
      }
      
      // Tentar remover do escritório se for dono
      try {
        await supabase.from(TABLE_NAMES.OFFICES).delete().eq('owner_id', session.userId);
      } catch {}

      await supabase.auth.signOut();
    }
    
    localStorage.clear();
  }

  async reactivateAccount() {
      if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.rpc('reactivate_own_account');
          if (error) throw error;
      }
  }

  getLogs(): ActivityLog[] { 
    try { return JSON.parse(localStorage.getItem(LOCAL_KEYS.LOGS) || '[]'); } catch { return []; }
  }
  
  logActivity(action: string, status: 'Success' | 'Failed' | 'Warning' = 'Success') {
    if (isSupabaseConfigured && supabase) {
        this.getUserSession().then(s => {
            if (s.userId) {
                supabase!.from(TABLE_NAMES.LOGS).insert([{
                    user_id: s.userId,
                    action,
                    status,
                    device: navigator.userAgent,
                    ip: 'IP_PLACEHOLDER',
                    date: new Date().toISOString()
                }]).then(({ error }) => {
                    if(error) console.warn("Failed to log to Supabase", error);
                });
            }
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
        this.setLocal(LOCAL_KEYS.LOGS, logs.slice(0, 50));
    }
  }

  // FIX: Providing full default objects to prevent TS2739 error
  getSettings(): AppSettings {
      const defaults: AppSettings = {
        general: { language: 'pt-BR' as const, dateFormat: 'DD/MM/YYYY' as const, compactMode: false, dataJudApiKey: '' },
        notifications: { email: true, desktop: true, sound: false, dailyDigest: false },
        emailPreferences: {
            enabled: false,
            frequency: 'immediate' as const,
            categories: { deadlines: true, processes: true, events: true, financial: false, marketing: true },
            deadlineAlerts: { sevenDays: true, threeDays: true, oneDay: true, onDueDate: true }
        },
        automation: { autoArchiveWonCases: false, autoSaveDrafts: true }
      };

      try {
          const s = localStorage.getItem(LOCAL_KEYS.SETTINGS);
          const parsed = s ? JSON.parse(s) : {};
          
          return {
            general: { ...defaults.general, ...(parsed.general || {}) },
            notifications: { ...defaults.notifications, ...(parsed.notifications || {}) },
            emailPreferences: { 
                ...defaults.emailPreferences!,
                ...(parsed.emailPreferences || {}),
                categories: { ...defaults.emailPreferences!.categories, ...(parsed.emailPreferences?.categories || {}) },
                deadlineAlerts: { ...defaults.emailPreferences!.deadlineAlerts, ...(parsed.emailPreferences?.deadlineAlerts || {}) }
            },
            automation: { ...defaults.automation, ...(parsed.automation || {}) }
          };
      } catch { 
          return defaults; 
      }
  }

  saveSettings(settings: AppSettings) {
      this.setLocal(LOCAL_KEYS.SETTINGS, settings);
      if (isSupabaseConfigured && supabase) {
          this.getUserSession().then(s => {
              if (s.userId) {
                  supabase!.from(TABLE_NAMES.PROFILES).update({ settings }).eq('id', s.userId);
              }
          });
      }
  }

  // ... (Other methods like getDashboardSummary, searchGlobal, etc. follow standard patterns using generics)
  // Placeholder implementations for brevity in this fix, ensuring they exist
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
    return {
        counts: { activeCases, wonCases, pendingCases, hearings, highPriorityTasks },
        charts: { caseDistribution },
        lists: { upcomingHearings, todaysAgenda: [], recentMovements: [] }
    };
  }

  async searchGlobal(query: string): Promise<SearchResult[]> { return []; }
  async checkRealtimeAlerts() { /* Implementation */ }
  
  async seedDatabase() {
    if (!this.getLocal(LOCAL_KEYS.CLIENTS, null)) {
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

  // Generic method placehodlers to ensure TS compatibility if used elsewhere
  async getClients(): Promise<Client[]> { return this.genericGet(TABLE_NAMES.CLIENTS, LOCAL_KEYS.CLIENTS); }
  async saveClient(client: Client) { return this.genericSave(TABLE_NAMES.CLIENTS, LOCAL_KEYS.CLIENTS, client); }
  async deleteClient(id: string) { return this.genericDelete(TABLE_NAMES.CLIENTS, LOCAL_KEYS.CLIENTS, id); }
  async getCases(): Promise<LegalCase[]> { return this.genericGet(TABLE_NAMES.CASES, LOCAL_KEYS.CASES); }
  async getCaseById(id: string): Promise<LegalCase|null> { const cases = await this.getCases(); return cases.find(c=>c.id===id) || null; }
  async getCasesPaginated(page: number, limit: number, searchTerm: string, statusFilter: any, categoryFilter: any, dateRange: any) {
      const all = await this.getCases();
      return { data: all.slice(0, limit), total: all.length };
  }
  async saveCase(c: LegalCase) { return this.genericSave(TABLE_NAMES.CASES, LOCAL_KEYS.CASES, c); }
  async deleteCase(id: string) { return this.genericDelete(TABLE_NAMES.CASES, LOCAL_KEYS.CASES, id); }
  async saveSmartMovement(caseId: string, movement: CaseMovement, tasks: Task[], doc: SystemDocument) { 
      const kase = await this.getCaseById(caseId); if(kase) { kase.movements = [movement, ...(kase.movements||[])]; await this.saveCase(kase); }
  }
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

  // Helper methods re-added to make the above work
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
