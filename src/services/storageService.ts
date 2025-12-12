
import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, SearchResult, OfficeMember, EmailSettings } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { MOCK_CLIENTS, MOCK_CASES, MOCK_TASKS, MOCK_FINANCIALS, MOCK_OFFICES as MOCK_OFFICES_DATA } from './mockData';
import { notificationService } from './notificationService';
import { emailService } from './emailService';
import { CaseRepository } from './repositories/caseRepository';

// Constants mapping
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

export const MOCK_OFFICES: Office[] = MOCK_OFFICES_DATA;

class StorageService {
  private caseRepo: CaseRepository;

  constructor() {
    this.caseRepo = new CaseRepository();
    // Only seed if NOT connected to Supabase to avoid polluting Prod DB
    if (!isSupabaseConfigured) {
      this.seedDatabase();
    }
  }

  // --- Helpers ---
  private getLocal<T>(key: string, defaultValue: T): T {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch { return defaultValue; }
  }
  
  private setLocal<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  private async getUserId(): Promise<string | null> {
      if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.auth.getSession();
          return data.session?.user.id || null;
      }
      const stored = localStorage.getItem('@JurisControl:user');
      return stored ? JSON.parse(stored).id : 'local-user';
  }

  // --- Account Management ---
  public async ensureProfileExists(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Use maybeSingle to avoid error if not found
        const { data } = await supabase.from(TABLE_NAMES.PROFILES).select('id').eq('id', user.id).maybeSingle();
        
        if (!data) {
            console.log("Creating missing profile for user...");
            await supabase.from(TABLE_NAMES.PROFILES).insert({
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || 'Usuário',
                username: user.user_metadata?.username || `@user_${user.id.substring(0,8)}`
            });
        }
    } catch (e) { console.error("Profile check error:", e); }
  }

  async checkAccountStatus(uid: string) {
      if (isSupabaseConfigured && supabase) {
          try {
            const { data } = await supabase.from(TABLE_NAMES.PROFILES).select('deleted_at').eq('id', uid).single();
            return data || { deleted_at: null };
          } catch { return { deleted_at: null }; }
      }
      return { deleted_at: null };
  }

  async reactivateAccount() {
    const userId = await this.getUserId();
    if (!userId) return;
    if (isSupabaseConfigured && supabase) {
        // Calls the database function to clear deleted_at
        await supabase.rpc('reactivate_own_account');
    }
  }

  async deleteAccount() {
      const userId = await this.getUserId();
      if(isSupabaseConfigured && supabase && userId) {
          // Calls the database function to soft delete
          await supabase.rpc('delete_own_account');
      } else {
          localStorage.clear();
      }
  }

  // --- CASES (Delegated to Repository) ---
  async getCases(): Promise<LegalCase[]> { return this.caseRepo.getCases(); }
  async getCaseById(id: string): Promise<LegalCase | null> { return this.caseRepo.getCaseById(id); }
  async getCasesPaginated(page: number, limit: number, searchTerm: string, status: string | null, category: string | null, dateRange: any) {
      return this.caseRepo.getPaginated(page, limit, searchTerm, status, category, dateRange);
  }
  async saveCase(legalCase: LegalCase) { return this.caseRepo.save(legalCase); }
  async deleteCase(id: string) { return this.caseRepo.delete(id); }

  // --- CLIENTS ---
  async getClients(): Promise<Client[]> {
    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      if (!userId) return [];
      
      const { data, error } = await supabase.from(TABLE_NAMES.CLIENTS).select('*').order('name');
      
      if (error) {
        console.error("Error fetching clients:", error);
        return [];
      }

      return (data || []).map((c) => ({
          id: c.id,
          officeId: c.office_id,
          name: c.name,
          type: c.type,
          status: c.status,
          email: c.email,
          phone: c.phone,
          city: c.city,
          state: c.state,
          avatarUrl: c.avatar_url,
          cpf: c.cpf,
          cnpj: c.cnpj,
          corporateName: c.corporate_name,
          createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '',
          tags: c.tags || [],
          alerts: c.alerts || [],
          documents: c.documents || [],
          history: c.history || []
      })) as Client[];
    }
    return this.getLocal(LOCAL_KEYS.CLIENTS, []);
  }

  async saveClient(client: Client) {
    const userId = await this.getUserId();
    if (isSupabaseConfigured && supabase && userId) {
      // If client doesn't have an officeId yet (new creation), we need to get it from session
      // However, the RLS policies usually enforce office_id based on user membership
      
      // We need to fetch the current user's active office if not present
      let officeId = client.officeId;
      if (!officeId) {
          const { data } = await supabase.auth.getUser();
          officeId = data.user?.user_metadata?.currentOfficeId;
      }

      if (!officeId) throw new Error("Office ID is required");

      const payload = {
          id: client.id && !client.id.startsWith('cli-') ? client.id : undefined,
          office_id: officeId,
          user_id: userId,
          name: client.name,
          type: client.type,
          status: client.status,
          email: client.email,
          phone: client.phone,
          city: client.city,
          state: client.state,
          avatar_url: client.avatarUrl,
          cpf: client.cpf,
          cnpj: client.cnpj,
          corporate_name: client.corporateName,
          notes: client.notes,
          tags: client.tags,
          alerts: client.alerts,
          documents: client.documents,
          history: client.history
      };
      
      const { error } = await supabase.from(TABLE_NAMES.CLIENTS).upsert(payload);
      if (error) throw error;

    } else {
      const list = await this.getClients();
      const idx = list.findIndex(i => i.id === client.id);
      if (idx >= 0) list[idx] = client;
      else list.unshift({ ...client, id: client.id || `cli-${Date.now()}` });
      this.setLocal(LOCAL_KEYS.CLIENTS, list);
    }
    this.logActivity(`Salvou cliente: ${client.name}`);
  }

  async deleteClient(id: string) {
    const cases = await this.getCases();
    if (cases.some(c => c.client.id === id && c.status !== CaseStatus.ARCHIVED)) {
        throw new Error("BLOQUEIO: Cliente possui processos ativos.");
    }
    
    if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from(TABLE_NAMES.CLIENTS).delete().eq('id', id);
        if (error) throw error;
    } else {
        const list = await this.getClients();
        this.setLocal(LOCAL_KEYS.CLIENTS, list.filter(i => i.id !== id));
    }
  }

  // --- TASKS ---
  async getTasks(): Promise<Task[]> {
    if(isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from(TABLE_NAMES.TASKS).select('*');
        if (error) return [];
        return (data || []).map((t) => ({
            id: t.id, 
            officeId: t.office_id,
            title: t.title, 
            dueDate: t.due_date, 
            priority: t.priority, 
            status: t.status,
            assignedTo: t.assigned_to, 
            description: t.description, 
            caseId: t.case_id,
            caseTitle: t.case_title, 
            clientId: t.client_id, 
            clientName: t.client_name
        })) as Task[];
    }
    return this.getLocal(LOCAL_KEYS.TASKS, []);
  }

  async getTasksByCaseId(caseId: string) {
      const tasks = await this.getTasks();
      return tasks.filter(t => t.caseId === caseId);
  }

  async saveTask(task: Task) {
    const userId = await this.getUserId();
    if(isSupabaseConfigured && supabase && userId) {
        
        let officeId = task.officeId;
        if (!officeId) {
            const { data } = await supabase.auth.getUser();
            officeId = data.user?.user_metadata?.currentOfficeId;
        }

        const payload = {
            id: task.id && !task.id.startsWith('task-') ? task.id : undefined,
            office_id: officeId,
            user_id: userId,
            title: task.title,
            due_date: task.dueDate,
            priority: task.priority,
            status: task.status,
            assigned_to: task.assignedTo,
            description: task.description,
            case_id: task.caseId,
            case_title: task.caseTitle,
            client_id: task.clientId,
            client_name: task.clientName
        };
        const { error } = await supabase.from(TABLE_NAMES.TASKS).upsert(payload);
        if (error) throw error;
    } else {
        const list = await this.getTasks();
        const idx = list.findIndex(t => t.id === task.id);
        if(idx >= 0) list[idx] = task;
        else list.push({ ...task, id: task.id || `task-${Date.now()}` });
        this.setLocal(LOCAL_KEYS.TASKS, list);
    }
  }

  async deleteTask(id: string) {
      if(isSupabaseConfigured && supabase) {
          await supabase.from(TABLE_NAMES.TASKS).delete().eq('id', id);
      } else {
          const list = await this.getTasks();
          this.setLocal(LOCAL_KEYS.TASKS, list.filter(t => t.id !== id));
      }
  }

  // --- FINANCIAL ---
  async getFinancials(): Promise<FinancialRecord[]> {
      if(isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.from(TABLE_NAMES.FINANCIAL).select('*');
          if (error) return [];
          return (data || []).map((f) => ({
              id: f.id, 
              officeId: f.office_id,
              title: f.title, 
              amount: Number(f.amount), 
              type: f.type, 
              category: f.category,
              status: f.status, 
              dueDate: f.due_date, 
              paymentDate: f.payment_date, 
              clientId: f.client_id,
              clientName: f.client_name, 
              caseId: f.case_id, 
              installment: f.installment
          })) as FinancialRecord[];
      }
      return this.getLocal(LOCAL_KEYS.FINANCIAL, []);
  }

  async getFinancialsByCaseId(caseId: string) {
      const fins = await this.getFinancials();
      return fins.filter(f => f.caseId === caseId);
  }

  async saveFinancial(record: FinancialRecord) {
      const userId = await this.getUserId();
      if(isSupabaseConfigured && supabase && userId) {
          
          let officeId = record.officeId;
          if (!officeId) {
            const { data } = await supabase.auth.getUser();
            officeId = data.user?.user_metadata?.currentOfficeId;
          }

          const payload = {
              id: record.id && !record.id.startsWith('trans-') ? record.id : undefined,
              office_id: officeId,
              user_id: userId,
              title: record.title,
              amount: record.amount,
              type: record.type,
              category: record.category,
              status: record.status,
              due_date: record.dueDate,
              payment_date: record.paymentDate,
              client_id: record.clientId,
              client_name: record.clientName,
              case_id: record.caseId,
              installment: record.installment
          };
          const { error } = await supabase.from(TABLE_NAMES.FINANCIAL).upsert(payload);
          if (error) throw error;
      } else {
          const list = await this.getFinancials();
          const idx = list.findIndex(i => i.id === record.id);
          if(idx >= 0) list[idx] = record;
          else list.push({ ...record, id: record.id || `trans-${Date.now()}` });
          this.setLocal(LOCAL_KEYS.FINANCIAL, list);
      }
  }

  // --- DOCUMENTS ---
  async getDocuments(): Promise<SystemDocument[]> {
      if(isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.from(TABLE_NAMES.DOCUMENTS).select('*');
          if (error) return [];
          return (data || []).map((d) => ({
              id: d.id, 
              officeId: d.office_id,
              name: d.name, 
              size: d.size, 
              type: d.type, 
              date: d.date, 
              category: d.category, 
              caseId: d.case_id,
              userId: d.user_id
          })) as SystemDocument[];
      }
      return this.getLocal(LOCAL_KEYS.DOCUMENTS, []);
  }

  async getDocumentsByCaseId(caseId: string) {
      const docs = await this.getDocuments();
      return docs.filter(d => d.caseId === caseId);
  }

  async saveDocument(docData: SystemDocument) {
      const userId = await this.getUserId();
      if(isSupabaseConfigured && supabase && userId) {
          
          let officeId = docData.officeId;
          if (!officeId) {
             const { data } = await supabase.auth.getUser();
             officeId = data.user?.user_metadata?.currentOfficeId;
          }

          const payload = {
              id: docData.id && !docData.id.startsWith('doc-') ? docData.id : undefined,
              office_id: officeId,
              user_id: userId,
              name: docData.name,
              size: docData.size,
              type: docData.type,
              date: docData.date,
              category: docData.category,
              case_id: docData.caseId
          };
          const { error } = await supabase.from(TABLE_NAMES.DOCUMENTS).insert(payload);
          if (error) throw error;
      } else {
          const list = await this.getDocuments();
          list.unshift(docData);
          this.setLocal(LOCAL_KEYS.DOCUMENTS, list);
      }
      this.logActivity(`Upload de documento: ${docData.name}`);
  }

  async deleteDocument(id: string) {
      if(isSupabaseConfigured && supabase) {
          await supabase.from(TABLE_NAMES.DOCUMENTS).delete().eq('id', id);
      } else {
          const list = await this.getDocuments();
          this.setLocal(LOCAL_KEYS.DOCUMENTS, list.filter(i => i.id !== id));
      }
  }

  // --- OFFICES ---
  async getOffices(): Promise<Office[]> {
      if (isSupabaseConfigured && supabase) {
          try {
              const { data, error } = await supabase.from(TABLE_NAMES.OFFICES).select('*');
              if (error) throw error;
              return (data || []).map((o) => ({
                  id: o.id, name: o.name, handle: o.handle, location: o.location, ownerId: o.owner_id,
                  logoUrl: o.logo_url, createdAt: o.created_at, areaOfActivity: o.area_of_activity, members: o.members || []
              })) as Office[];
          } catch { return []; }
      }
      return this.getLocal(LOCAL_KEYS.OFFICES, []);
  }

  async getOfficeById(id: string): Promise<Office | undefined> {
      const offices = await this.getOffices();
      return offices.find(o => o.id === id);
  }

  async saveOffice(office: Office): Promise<void> {
      if(isSupabaseConfigured && supabase) {
          const payload = {
              id: office.id, name: office.name, handle: office.handle, location: office.location,
              owner_id: office.ownerId, logo_url: office.logoUrl, area_of_activity: office.areaOfActivity,
              members: office.members, social: office.social
          };
          await supabase.from(TABLE_NAMES.OFFICES).upsert(payload);
      } else {
          const offices = await this.getOffices();
          const index = offices.findIndex(o => o.id === office.id);
          if (index >= 0) {
              offices[index] = office;
              this.setLocal(LOCAL_KEYS.OFFICES, offices);
          }
      }
      this.logActivity(`Atualizou escritório: ${office.name}`);
  }

  async createOffice(officeData: Partial<Office>, explicitOwnerId?: string, userData?: any): Promise<Office> {
      const userId = explicitOwnerId || (await this.getUserId());
      // Logic simplified for this facade - similar to original but using user id
      if (!userId) throw new Error("User required");

      let handle = officeData.handle || `@office${Date.now()}`;
      if (!handle.startsWith('@')) handle = '@' + handle;

      const newOffice: Office = {
          id: `office-${Date.now()}`,
          name: officeData.name || 'Novo Escritório',
          handle: handle,
          location: officeData.location || 'Brasil',
          ownerId: userId,
          members: [{
              userId: userId,
              name: userData?.name || 'Admin',
              role: 'Admin',
              permissions: { financial: true, cases: true, documents: true, settings: true },
              email: userData?.email,
              avatarUrl: ''
          }],
          createdAt: new Date().toISOString()
      };

      if(isSupabaseConfigured && supabase) {
          // Map to DB columns
          const dbOffice = {
              name: newOffice.name,
              handle: newOffice.handle,
              location: newOffice.location,
              owner_id: newOffice.ownerId,
              members: newOffice.members
          };
          const { data, error } = await supabase.from(TABLE_NAMES.OFFICES).insert(dbOffice).select().single();
          if(error) throw error;
          return { ...newOffice, id: data.id };
      } else {
          const offices = await this.getOffices();
          this.setLocal(LOCAL_KEYS.OFFICES, [...offices, newOffice]);
          return newOffice;
      }
  }

  async joinOffice(handle: string): Promise<Office> {
      if(isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.from(TABLE_NAMES.OFFICES).select('*').eq('handle', handle).single();
          if(error || !data) throw new Error("Escritório não encontrado");
          
          return {
              id: data.id, name: data.name, handle: data.handle, ownerId: data.owner_id,
              location: data.location, members: data.members || []
          } as Office;
      } else {
          const offices = await this.getOffices();
          const office = offices.find(o => o.handle === handle);
          if (!office) throw new Error("Escritório não encontrado (Demo)");
          return office;
      }
  }

  async inviteUserToOffice(officeId: string, handle: string): Promise<boolean> {
      await new Promise(r => setTimeout(r, 500));
      return true;
  }

  async removeMemberFromOffice(officeId: string, userId: string) {
      const offices = await this.getOffices();
      const office = offices.find(o => o.id === officeId);
      if(office) {
          office.members = office.members.filter(m => m.userId !== userId);
          this.saveOffice(office);
      }
  }

  // --- Dashboard & Search ---
  async getDashboardSummary(): Promise<DashboardData> {
      const cases = await this.getCases();
      const tasks = await this.getTasks();
      
      const counts = {
          activeCases: cases.filter(c => c.status === CaseStatus.ACTIVE).length,
          wonCases: cases.filter(c => c.status === CaseStatus.WON).length,
          pendingCases: cases.filter(c => c.status === CaseStatus.PENDING).length,
          hearings: cases.filter(c => !!c.nextHearing).length,
          highPriorityTasks: tasks.filter(t => t.priority === 'Alta' && t.status !== 'Concluído').length
      };

      return {
          counts,
          charts: { caseDistribution: [] }, // Simplified for brevity
          lists: {
              upcomingHearings: cases.filter(c => !!c.nextHearing).slice(0, 5),
              todaysAgenda: [],
              recentMovements: []
          }
      };
  }

  async searchGlobal(query: string): Promise<SearchResult[]> {
      if(!query) return [];
      const lower = query.toLowerCase();
      const [cases, clients] = await Promise.all([this.getCases(), this.getClients()]);
      
      const results: SearchResult[] = [];
      cases.forEach(c => {
          if(c.title.toLowerCase().includes(lower) || c.cnj.includes(lower)) {
              results.push({ id: c.id, type: 'case', title: c.title, subtitle: c.cnj, url: `/cases/${c.id}` });
          }
      });
      clients.forEach(c => {
          if(c.name.toLowerCase().includes(lower)) {
              results.push({ id: c.id, type: 'client', title: c.name, subtitle: c.email, url: `/clients/${c.id}` });
          }
      });
      return results;
  }

  // --- Automation ---
  async checkRealtimeAlerts() {
      // Stub for checking deadlines
  }

  // --- Utils ---
  logActivity(action: string, status: 'Success' | 'Failed' | 'Warning' = 'Success') {
      const logs = this.getLogs();
      logs.unshift({
          id: Date.now().toString(), action, status, ip: '127.0.0.1', device: 'Browser',
          date: new Date().toLocaleString('pt-BR')
      });
      this.setLocal(LOCAL_KEYS.LOGS, logs.slice(0, 50));
  }
  
  getLogs(): ActivityLog[] { return this.getLocal(LOCAL_KEYS.LOGS, []); }
  
  // FIX: Robust getSettings method to prevent null pointer exceptions
  getSettings(): AppSettings {
      const defaultEmailPreferences: EmailSettings = {
          enabled: false,
          frequency: 'immediate',
          categories: { deadlines: true, processes: true, events: true, financial: false, marketing: true },
          deadlineAlerts: { sevenDays: true, threeDays: true, oneDay: true, onDueDate: true }
      };

      const defaultSettings: AppSettings = {
          general: { language: 'pt-BR', dateFormat: 'DD/MM/YYYY', compactMode: false, dataJudApiKey: '' },
          notifications: { email: true, desktop: true, sound: false, dailyDigest: false },
          emailPreferences: defaultEmailPreferences,
          automation: { autoArchiveWonCases: false, autoSaveDrafts: true }
      };

      try {
          const s = localStorage.getItem(LOCAL_KEYS.SETTINGS);
          if (!s) return defaultSettings;
          
          const parsed = JSON.parse(s);
          
          // Deep merge to ensure all properties exist
          return {
            general: { ...defaultSettings.general, ...parsed.general },
            notifications: { ...defaultSettings.notifications, ...parsed.notifications },
            emailPreferences: { 
                ...defaultEmailPreferences, 
                ...parsed.emailPreferences,
                categories: { ...defaultEmailPreferences.categories, ...parsed.emailPreferences?.categories },
                deadlineAlerts: { ...defaultEmailPreferences.deadlineAlerts, ...parsed.emailPreferences?.deadlineAlerts }
            },
            automation: { ...defaultSettings.automation, ...parsed.automation }
          };
      } catch { 
        return defaultSettings; 
      }
  }
  
  saveSettings(s: AppSettings) { this.setLocal(LOCAL_KEYS.SETTINGS, s); }
  
  async seedDatabase() {
      if (this.getLocal<any[]>(LOCAL_KEYS.CASES, []).length === 0) {
          this.setLocal(LOCAL_KEYS.CASES, MOCK_CASES);
          this.setLocal(LOCAL_KEYS.CLIENTS, MOCK_CLIENTS);
          this.setLocal(LOCAL_KEYS.TASKS, MOCK_TASKS);
          this.setLocal(LOCAL_KEYS.FINANCIAL, MOCK_FINANCIALS);
          this.setLocal(LOCAL_KEYS.OFFICES, MOCK_OFFICES_DATA);
      }
  }

  factoryReset() {
      localStorage.clear();
      window.location.reload();
  }
}

export const storageService = new StorageService();
