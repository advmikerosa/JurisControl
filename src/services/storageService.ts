
import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, User, CaseMovement, SearchResult, OfficeMember } from '../types';
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
    // Tenta obter do Supabase
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

  // --- FILTRO DE SEGURANÇA LOCAL ---
  private filterByOffice<T extends { officeId?: string }>(data: T[], officeId: string | null): T[] {
      if (!officeId) return []; 
      return data.filter(item => item.officeId === officeId);
  }

  // --- Clientes ---
  async getClients(): Promise<Client[]> {
    const session = await this.getUserSession();
    if (!session.officeId) return [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from(TABLE_NAMES.CLIENTS)
          .select('*')
          .eq('office_id', session.officeId)
          .order('name');
        
        if (error) throw error;
        return this.mapSupabaseClients(data);
      } catch (error) { 
        return this.filterByOffice(this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []), session.officeId);
      }
    } else {
      return this.filterByOffice(this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []), session.officeId);
    }
  }
  
  async saveClient(client: Client) {
    const session = await this.getUserSession();
    if (!session.officeId) throw new Error("Nenhum escritório selecionado.");
    
    client.officeId = session.officeId;

    if (isSupabaseConfigured && supabase && session.userId) {
      try {
        const payload = this.mapClientToPayload(client, session.userId);
        const { error } = await supabase.from(TABLE_NAMES.CLIENTS).upsert(payload);
        if (error) throw error;
        this.logActivity(`Salvou cliente: ${client.name}`);
        return;
      } catch (e) { console.error(e); }
    }
    
    const list = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
    const idx = list.findIndex(i => i.id === client.id);
    if (idx >= 0) {
        list[idx] = client;
    } else {
        if (!client.id || !client.id.startsWith('cli-')) client.id = `cli-${Date.now()}`;
        client.userId = session.userId || 'local';
        list.unshift(client);
    }
    this.setLocal(LOCAL_KEYS.CLIENTS, list);
    this.logActivity(`Salvou cliente (Local): ${client.name}`);
  }

  async deleteClient(id: string) {
    const cases = await this.getCases();
    const hasActiveCases = cases.some(c => c.client.id === id && c.status !== CaseStatus.ARCHIVED);
    
    if (hasActiveCases) {
        throw new Error("BLOQUEIO: Não é possível excluir este cliente pois ele possui processos ativos.");
    }

    if (isSupabaseConfigured && supabase) {
      const session = await this.getUserSession();
      if (!session.userId) return;
      await supabase.from(TABLE_NAMES.CLIENTS).delete().eq('id', id).eq('office_id', session.officeId);
    } else {
      const list = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
      this.setLocal(LOCAL_KEYS.CLIENTS, list.filter(i => i.id !== id));
    }
    this.logActivity(`Excluiu cliente ID: ${id}`, 'Warning');
  }

  // --- Processos (Cases) ---
  async getCases(): Promise<LegalCase[]> {
    const session = await this.getUserSession();
    if (!session.officeId) return [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from(TABLE_NAMES.CASES)
          .select(`*, client:clients!cases_client_id_fkey(*)`)
          .eq('office_id', session.officeId);
        
        if (error) throw error;
        return this.mapSupabaseCases(data);
      } catch (e) { 
        return this.filterByOffice(this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []), session.officeId);
      }
    } else {
      return this.filterByOffice(this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []), session.officeId);
    }
  }

  async saveCase(legalCase: LegalCase) {
    const session = await this.getUserSession();
    if (!session.officeId) throw new Error("Nenhum escritório selecionado.");
    
    legalCase.officeId = session.officeId;
    legalCase.lastUpdate = new Date().toISOString();
    
    if (isSupabaseConfigured && supabase && session.userId) {
      try {
        const payload = this.mapCaseToPayload(legalCase, session.userId);
        const { error } = await supabase.from(TABLE_NAMES.CASES).upsert(payload);
        if (error) throw error;
        this.logActivity(`Salvou processo: ${legalCase.title}`);
        return;
      } catch (e) { console.error(e); }
    }
    
    const list = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
    const idx = list.findIndex(i => i.id === legalCase.id);
    if (idx >= 0) {
        list[idx] = legalCase;
    } else {
        if (!legalCase.id || !legalCase.id.startsWith('case-')) legalCase.id = `case-${Date.now()}`;
        legalCase.userId = session.userId || 'local';
        list.push(legalCase);
    }
    this.setLocal(LOCAL_KEYS.CASES, list);
    this.logActivity(`Salvou processo (Local): ${legalCase.title}`);
  }

  async deleteCase(id: string) {
    if (isSupabaseConfigured && supabase) {
      const session = await this.getUserSession();
      if (!session.userId) return;
      await supabase.from(TABLE_NAMES.CASES).delete().eq('id', id).eq('office_id', session.officeId);
    } else {
      const list = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
      this.setLocal(LOCAL_KEYS.CASES, list.filter(i => i.id !== id));
    }
    this.logActivity(`Excluiu processo ID: ${id}`, 'Warning');
  }

  // --- Smart Movement Atomic Save ---
  async saveSmartMovement(
    caseId: string, 
    movement: CaseMovement, 
    tasks: Task[], 
    document: SystemDocument | null
  ) {
    const session = await this.getUserSession();
    if (!session.officeId) throw new Error("Erro de sessão.");

    // 1. Get current Case
    const currentCase = await this.getCaseById(caseId);
    if (!currentCase) throw new Error("Processo não encontrado.");

    // 2. Update Movements in Case
    const updatedMovements = [movement, ...(currentCase.movements || [])];
    const updatedCase = { ...currentCase, movements: updatedMovements, lastUpdate: new Date().toISOString() };
    await this.saveCase(updatedCase);

    // 3. Save Tasks
    for (const task of tasks) {
      task.officeId = session.officeId;
      task.caseId = caseId;
      task.clientId = currentCase.client.id;
      task.clientName = currentCase.client.name;
      task.caseTitle = currentCase.title;
      await this.saveTask(task);
    }

    // 4. Save Document if exists
    if (document) {
      document.officeId = session.officeId;
      document.caseId = caseId;
      await this.saveDocument(document);
    }

    this.logActivity(`Upload Inteligente no processo ${caseId}`);
  }

  // --- Tarefas ---
  async getTasks(): Promise<Task[]> {
    const session = await this.getUserSession();
    if (!session.officeId) return [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
            .from(TABLE_NAMES.TASKS)
            .select('*')
            .eq('office_id', session.officeId);
        if (error) throw error;
        return this.mapSupabaseTasks(data);
      } catch { return this.filterByOffice(this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []), session.officeId); }
    } else {
      return this.filterByOffice(this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []), session.officeId);
    }
  }
  
  async saveTask(task: Task) {
    const session = await this.getUserSession();
    if (!session.officeId) throw new Error("Nenhum escritório selecionado.");
    task.officeId = session.officeId;

    if (isSupabaseConfigured && supabase && session.userId) {
      try {
        const payload = this.mapTaskToPayload(task, session.userId);
        const { error } = await supabase.from(TABLE_NAMES.TASKS).upsert(payload);
        if (error) throw error;
        return;
      } catch (e) { console.error(e); }
    }
    
    const list = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
    const idx = list.findIndex(i => i.id === task.id);
    if (idx >= 0) list[idx] = task;
    else {
        if(!task.id) task.id = `task-${Date.now()}`;
        list.push(task);
    }
    this.setLocal(LOCAL_KEYS.TASKS, list);
  }
  
  async deleteTask(id: string) {
    if (isSupabaseConfigured && supabase) {
      const session = await this.getUserSession();
      if (!session.userId) return;
      await supabase.from(TABLE_NAMES.TASKS).delete().eq('id', id).eq('office_id', session.officeId);
    } else {
      const list = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
      this.setLocal(LOCAL_KEYS.TASKS, list.filter(i => i.id !== id));
    }
  }

  // --- Helpers de Mapeamento ---
  private mapSupabaseClients(data: any[]): Client[] {
      return data.map(c => ({
          id: c.id, officeId: c.office_id, name: c.name, type: c.type, status: c.status,
          email: c.email, phone: c.phone, city: c.city, state: c.state, avatarUrl: c.avatar_url,
          address: c.address || '',
          cpf: c.cpf, cnpj: c.cnpj, corporateName: c.corporate_name,
          createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '',
          tags: c.tags || [], alerts: c.alerts || [], notes: c.notes,
          documents: c.documents || [], history: c.history || []
      }));
  }

  private mapClientToPayload(c: Client, userId: string) {
      return {
          id: c.id && !c.id.startsWith('cli-') ? c.id : undefined,
          user_id: userId, office_id: c.officeId,
          name: c.name, type: c.type, status: c.status, email: c.email, phone: c.phone,
          city: c.city, state: c.state, avatar_url: c.avatarUrl, address: c.address,
          cpf: c.cpf, cnpj: c.cnpj, corporate_name: c.corporateName,
          notes: c.notes, tags: c.tags, alerts: c.alerts, documents: c.documents, history: c.history
      };
  }

  private mapSupabaseCases(data: any[]): LegalCase[] {
      return data.map(item => ({
        id: item.id, officeId: item.office_id, cnj: item.cnj, title: item.title, status: item.status,
        category: item.category, phase: item.phase, value: Number(item.value),
        responsibleLawyer: item.responsible_lawyer, court: item.court, nextHearing: item.next_hearing,
        distributionDate: item.created_at, description: item.description, movements: item.movements,
        changeLog: item.change_log, lastUpdate: item.last_update,
        client: item.client ? { id: item.client.id, name: item.client.name, type: item.client.type, avatarUrl: item.client.avatar_url } as any : { name: 'Desconhecido' } as any
      }));
  }

  private mapCaseToPayload(c: LegalCase, userId: string) {
      return {
        id: c.id && !c.id.startsWith('case-') ? c.id : undefined,
        user_id: userId, office_id: c.officeId, client_id: c.client.id,
        cnj: c.cnj, title: c.title, status: c.status, category: c.category, phase: c.phase,
        value: c.value, responsible_lawyer: c.responsibleLawyer, court: c.court,
        next_hearing: c.nextHearing, description: c.description, movements: c.movements,
        change_log: c.changeLog, last_update: c.lastUpdate
      };
  }

  private mapSupabaseTasks(data: any[]): Task[] {
      return data.map(t => ({
          id: t.id, officeId: t.office_id, title: t.title, dueDate: t.due_date,
          priority: t.priority, status: t.status, assignedTo: t.assigned_to,
          description: t.description, caseId: t.case_id, caseTitle: t.case_title,
          clientId: t.client_id, clientName: t.client_name
      }));
  }

  private mapTaskToPayload(t: Task, userId: string) {
      return { 
          id: t.id && !t.id.startsWith('task-') ? t.id : undefined,
          user_id: userId, office_id: t.officeId, title: t.title, due_date: t.dueDate,
          priority: t.priority, status: t.status, assigned_to: t.assignedTo,
          description: t.description, case_id: t.caseId, case_title: t.caseTitle,
          client_id: t.clientId, client_name: t.clientName
      };
  }

  async getFinancials() { return this.filterByOffice(this.getLocal<FinancialRecord[]>(LOCAL_KEYS.FINANCIAL, []), (await this.getUserSession()).officeId); }
  async saveFinancial(r: FinancialRecord) { 
      const session = await this.getUserSession();
      if(session.officeId) {
          r.officeId = session.officeId;
          const list = this.getLocal<FinancialRecord[]>(LOCAL_KEYS.FINANCIAL, []);
          list.push(r);
          this.setLocal(LOCAL_KEYS.FINANCIAL, list);
      }
  }
  async getDocuments() { return this.filterByOffice(this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []), (await this.getUserSession()).officeId); }
  async saveDocument(d: SystemDocument) {
      const session = await this.getUserSession();
      if(session.officeId) {
          d.officeId = session.officeId;
          const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
          list.push(d);
          this.setLocal(LOCAL_KEYS.DOCUMENTS, list);
      }
  }
  async deleteDocument(id: string) {
    if (isSupabaseConfigured && supabase) {
      const session = await this.getUserSession();
      if (!session.userId) return;
      await supabase.from(TABLE_NAMES.DOCUMENTS).delete().eq('id', id).eq('office_id', session.officeId);
    } else {
      const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
      this.setLocal(LOCAL_KEYS.DOCUMENTS, list.filter(i => i.id !== id));
    }
  }

  async getOffices(): Promise<Office[]> {
      return this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
  }
  async getOfficeById(id: string): Promise<Office | undefined> {
      return (await this.getOffices()).find(o => o.id === id);
  }
  async saveOffice(office: Office) {
      const list = await this.getOffices();
      const idx = list.findIndex(o => o.id === office.id);
      if(idx >= 0) list[idx] = office;
      this.setLocal(LOCAL_KEYS.OFFICES, list);
  }
  
  async createOffice(officeData: Partial<Office>, userId?: string, ownerDetails?: any): Promise<Office> {
      const actualUserId = userId || (await this.getUserSession()).userId || 'local';
      
      const newOffice: Office = {
          id: `office-${Date.now()}`,
          name: officeData.name || 'Novo',
          handle: officeData.handle || '@novo',
          location: 'Brasil',
          ownerId: actualUserId,
          members: [{
              userId: actualUserId, 
              name: ownerDetails?.name || 'Admin', 
              email: ownerDetails?.email, 
              role: 'Admin', 
              avatarUrl: '', 
              permissions: { financial: true, cases: true, documents: true, settings: true }
          }],
          createdAt: new Date().toISOString(),
          social: {}
      };
      
      const offices = await this.getOffices();
      offices.push(newOffice);
      this.setLocal(LOCAL_KEYS.OFFICES, offices);
      return newOffice;
  }

  async joinOffice(handle: string): Promise<Office> {
      const offices = await this.getOffices();
      const office = offices.find(o => o.handle === handle);
      if(!office) throw new Error("Escritório não encontrado");
      return office;
  }
  
  async inviteUserToOffice(officeId: string, handle: string): Promise<boolean> { return true; }

  async getCaseById(id: string) { return (await this.getCases()).find(c => c.id === id) || null; }
  async getTasksByCaseId(id: string) { return (await this.getTasks()).filter(t => t.caseId === id); }
  async getFinancialsByCaseId(id: string) { return (await this.getFinancials()).filter(f => f.caseId === id); }
  async getDocumentsByCaseId(id: string) { return (await this.getDocuments()).filter(d => d.caseId === id); }
  
  async getCasesPaginated(page: number, limit: number, search: string, status: string | null, category: string | null, range: any) {
      let data = await this.getCases();
      // Filtering logic duplicated from previous implementation for brevity
      if (search) {
        const lower = search.toLowerCase();
        data = data.filter(c => c.title.toLowerCase().includes(lower) || c.cnj.includes(lower) || c.client.name.toLowerCase().includes(lower));
      }
      if (status && status !== 'Todos') data = data.filter(c => c.status === status);
      if (category && category !== 'Todos') data = data.filter(c => c.category === category);
      
      const start = (page - 1) * limit;
      return { data: data.slice(start, start + limit), total: data.length };
  }

  getLogs() { return this.getLocal<ActivityLog[]>(LOCAL_KEYS.LOGS, []); }
  logActivity(action: string, status: 'Success'|'Warning'|'Failed' = 'Success') { 
      const l = this.getLogs(); 
      l.unshift({ id: Date.now().toString(), action, status, date: new Date().toLocaleString(), device: 'Web', ip: '127.0.0.1' });
      this.setLocal(LOCAL_KEYS.LOGS, l.slice(0, 50));
  }
  getSettings(): AppSettings { return this.getLocal(LOCAL_KEYS.SETTINGS, { general: { language: 'pt-BR', compactMode: false, dateFormat: 'DD/MM/YYYY' }, notifications: { email: true, desktop: true, sound: true, dailyDigest: false }, automation: { autoArchiveWonCases: false, autoSaveDrafts: true } } as AppSettings); }
  saveSettings(s: AppSettings) { this.setLocal(LOCAL_KEYS.SETTINGS, s); }
  
  async getDashboardSummary(): Promise<DashboardData> {
      const allCases = await this.getCases();
      const allTasks = await this.getTasks();
      
      // Mocked implementation for brevity
      return {
          counts: { 
              activeCases: allCases.filter(c => c.status === CaseStatus.ACTIVE).length, 
              wonCases: allCases.filter(c => c.status === CaseStatus.WON).length, 
              pendingCases: allCases.filter(c => c.status === CaseStatus.PENDING).length, 
              hearings: allCases.filter(c => c.nextHearing).length, 
              highPriorityTasks: allTasks.filter(t => t.priority === 'Alta').length 
          },
          charts: { caseDistribution: [] },
          lists: { upcomingHearings: [], todaysAgenda: [], recentMovements: [] }
      };
  }
  
  async searchGlobal(q: string): Promise<SearchResult[]> { return []; }

  async deleteAccount() {
    const session = await this.getUserSession();
    
    if (isSupabaseConfigured && supabase) {
      if (!session.userId) return;
      
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
            await supabase.from(table).delete().eq('user_id', session.userId);
        } catch (e) {
            console.error(`Error deleting from ${table}`, e);
        }
      }
      
    } else {
      localStorage.clear();
    }
  }
  factoryReset() { localStorage.clear(); window.location.reload(); }

  async seedDatabase() {
      const offices = this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
      if(offices.length === 0) {
          this.setLocal(LOCAL_KEYS.OFFICES, MOCK_OFFICES_DATA);
          const officeId = MOCK_OFFICES_DATA[0].id;
          
          this.setLocal(LOCAL_KEYS.CLIENTS, MOCK_CLIENTS);
          this.setLocal(LOCAL_KEYS.CASES, MOCK_CASES);
          this.setLocal(LOCAL_KEYS.TASKS, MOCK_TASKS);
          this.setLocal(LOCAL_KEYS.FINANCIAL, MOCK_FINANCIALS);
      }
  }
}

export const storageService = new StorageService();
