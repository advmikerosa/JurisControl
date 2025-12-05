import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, User, CaseMovement, SearchResult, OfficeMember } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { notificationService } from './notificationService';
import { emailService } from './emailService';

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

export const MOCK_OFFICES: Office[] = [];

class StorageService {
  
  constructor() {
    this.seedDatabase();
  }

  // --- Helper Methods ---

  private async getUserId(): Promise<string | null> {
    const session = await this.getUserSession();
    return session.userId;
  }

  private async getUserSession(): Promise<{ userId: string | null, officeId: string | null }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
            // Fetch currentOfficeId from local storage cache or user metadata
            const storedUser = localStorage.getItem('@JurisControl:user');
            const localUser = storedUser ? JSON.parse(storedUser) : null;
            return { userId: data.session.user.id, officeId: localUser?.currentOfficeId || data.session.user.user_metadata?.currentOfficeId || null };
        }
      } catch {}
    }
    const stored = localStorage.getItem('@JurisControl:user');
    if (stored) {
        const u = JSON.parse(stored);
        return { userId: u.id, officeId: u.currentOfficeId || null };
    }
    return { userId: 'local-user', officeId: 'office-1' }; // Default mock office
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
    if (!officeId) return items; // Return all if no office context (demo)
    return items.filter(item => item.officeId === officeId || !item.officeId); // !item.officeId for backward compatibility
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
        await supabase.from(TABLE_NAMES.PROFILES).update({ deleted_at: null }).eq('id', userId);
    }
  }

  async deleteAccount() {
    const userId = await this.getUserId();
    
    if (isSupabaseConfigured && supabase) {
      if (!userId) return;
      
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
      
    } else {
      localStorage.clear();
    }
  }

  // --- Generic CRUD ---

  private async genericGet<T>(table: string, key: string): Promise<T[]> {
      if (isSupabaseConfigured && supabase) {
          const s = await this.getUserSession();
          if(!s.officeId) return [];
          const { data } = await supabase.from(table).select('*').eq('office_id', s.officeId);
          // Convert snake_case to camelCase mapping if needed, or rely on types. 
          // For simplicity in this demo, assuming DB columns match types or are handled by frontend mapping.
          // Since types use camelCase and DB usually snake_case, we might need a mapper.
          // But for now we assume LOCAL mode or a DB view that returns camelCase.
          // Or strictly for the demo parts, we focus on LOCAL keys.
          return data || [];
      }
      const s = await this.getUserSession();
      const all = this.getLocal<T[]>(key, []);
      return s.officeId ? this.filterByOffice(all, s.officeId) : all;
  }

  // --- Clients ---

  async getClients(): Promise<Client[]> {
    return this.genericGet(TABLE_NAMES.CLIENTS, LOCAL_KEYS.CLIENTS);
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
      // Upsert logic...
      // For brevity, defaulting to Local Logic for stability in this fix
    }
    
    const list = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
    const idx = list.findIndex(i => i.id === client.id);
    if (idx >= 0) {
        list[idx] = clientToSave;
    } else {
        if (!clientToSave.id || clientToSave.id.startsWith('cli-')) {
             // Keep generated ID
        }
        list.unshift(clientToSave);
    }
    this.setLocal(LOCAL_KEYS.CLIENTS, list);
    this.logActivity(`Salvou cliente: ${client.name}`);
  }

  async deleteClient(id: string) {
    const cases = await this.getCases();
    const hasActiveCases = cases.some(c => c.client.id === id && c.status !== CaseStatus.ARCHIVED);
    if (hasActiveCases) throw new Error("BLOQUEIO: Cliente possui processos ativos.");

    const list = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
    this.setLocal(LOCAL_KEYS.CLIENTS, list.filter(i => i.id !== id));
    this.logActivity(`Excluiu cliente ID: ${id}`, 'Warning');
  }

  // --- Cases ---

  async getCases(): Promise<LegalCase[]> {
    return this.genericGet(TABLE_NAMES.CASES, LOCAL_KEYS.CASES);
  }

  async getCaseById(id: string): Promise<LegalCase | null> {
    const cases = await this.getCases();
    return cases.find(c => c.id === id) || null;
  }

  async getCasesPaginated(
    page: number = 1, 
    limit: number = 20, 
    searchTerm: string = '', 
    statusFilter: string | null = null,
    categoryFilter: string | null = null, 
    dateRange: { start: string, end: string } | null = null
  ): Promise<{ data: LegalCase[], total: number }> {
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

    const list = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
    const idx = list.findIndex(i => i.id === legalCase.id);
    if (idx >= 0) {
        list[idx] = caseToSave;
    } else {
        if (!caseToSave.id) caseToSave.id = `case-${Date.now()}`;
        list.push(caseToSave);
    }
    this.setLocal(LOCAL_KEYS.CASES, list);
    this.logActivity(`Salvou processo: ${legalCase.title}`);
  }

  async deleteCase(id: string) {
    const list = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
    this.setLocal(LOCAL_KEYS.CASES, list.filter(i => i.id !== id));
    this.logActivity(`Excluiu processo ID: ${id}`, 'Warning');
  }

  // --- Tasks ---

  async getTasks(): Promise<Task[]> {
    return this.genericGet(TABLE_NAMES.TASKS, LOCAL_KEYS.TASKS);
  }

  async getTasksByCaseId(caseId: string): Promise<Task[]> {
    const tasks = await this.getTasks();
    return tasks.filter(t => t.caseId === caseId);
  }

  async saveTask(task: Task) {
    const s = await this.getUserSession();
    const taskToSave = { ...task, officeId: s.officeId || 'office-1' };
    
    const list = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
    const idx = list.findIndex(i => i.id === task.id);
    if (idx >= 0) list[idx] = taskToSave;
    else {
        if(!taskToSave.id) taskToSave.id = `task-${Date.now()}`;
        list.push(taskToSave);
    }
    this.setLocal(LOCAL_KEYS.TASKS, list);
  }

  async deleteTask(id: string) {
    const list = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
    this.setLocal(LOCAL_KEYS.TASKS, list.filter(i => i.id !== id));
  }

  // --- Financial ---

  async getFinancials(): Promise<FinancialRecord[]> {
    return this.genericGet(TABLE_NAMES.FINANCIAL, LOCAL_KEYS.FINANCIAL);
  }

  async getFinancialsByCaseId(caseId: string): Promise<FinancialRecord[]> {
    const fins = await this.getFinancials();
    return fins.filter(f => f.caseId === caseId);
  }

  async saveFinancial(record: FinancialRecord) {
    const s = await this.getUserSession();
    const recToSave = { ...record, officeId: s.officeId || 'office-1' };

    const list = this.getLocal<FinancialRecord[]>(LOCAL_KEYS.FINANCIAL, []);
    const idx = list.findIndex(i => i.id === record.id);
    if (idx >= 0) list[idx] = recToSave;
    else {
        if(!recToSave.id) recToSave.id = `trans-${Date.now()}`;
        list.push(recToSave);
    }
    this.setLocal(LOCAL_KEYS.FINANCIAL, list);
  }

  // --- Documents ---

  async getDocuments(): Promise<SystemDocument[]> {
    return this.genericGet(TABLE_NAMES.DOCUMENTS, LOCAL_KEYS.DOCUMENTS);
  }

  async getDocumentsByCaseId(caseId: string): Promise<SystemDocument[]> {
    const docs = await this.getDocuments();
    return docs.filter(d => d.caseId === caseId);
  }

  async saveDocument(docData: SystemDocument) {
    const s = await this.getUserSession();
    const docToSave = { ...docData, officeId: s.officeId || 'office-1', userId: s.userId };

    const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
    list.unshift(docToSave);
    this.setLocal(LOCAL_KEYS.DOCUMENTS, list);
    this.logActivity(`Upload de documento: ${docData.name}`);
  }

  async deleteDocument(id: string) {
    const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
    this.setLocal(LOCAL_KEYS.DOCUMENTS, list.filter(i => i.id !== id));
  }

  // --- Smart Upload ---

  async saveSmartMovement(caseId: string, movement: CaseMovement, tasks: Task[], document: SystemDocument) {
    // 1. Save movement to case
    const legalCase = await this.getCaseById(caseId);
    if (legalCase) {
        legalCase.movements = [movement, ...(legalCase.movements || [])];
        legalCase.lastUpdate = new Date().toISOString();
        await this.saveCase(legalCase);
    }
    
    // 2. Save tasks
    for (const task of tasks) {
        await this.saveTask(task);
    }

    // 3. Save document
    await this.saveDocument(document);
    
    this.logActivity(`Upload Inteligente no caso ${caseId}`);
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
    const offices = await this.getOffices();
    const index = offices.findIndex(o => o.id === office.id);
    if (index >= 0) {
      offices[index] = office;
      this.setLocal(LOCAL_KEYS.OFFICES, offices);
      this.logActivity(`Atualizou dados do escritório: ${office.name}`);
    }
  }

  async createOffice(officeData: Partial<Office>, explicitOwnerId?: string, userData?: {name?: string, email?: string}): Promise<Office> {
    const userId = explicitOwnerId || (await this.getUserSession()).userId;
    // Mock user data fallback
    const user = { name: userData?.name || 'Admin', email: userData?.email || 'admin@email.com', avatar: '' };

    let handle = officeData.handle || `@office${Date.now()}`;
    if (!handle.startsWith('@')) handle = '@' + handle;

    const offices = await this.getOffices();
    if (offices.some(o => o.handle.toLowerCase() === handle.toLowerCase())) {
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

    const updatedOffices = [...offices, newOffice];
    this.setLocal(LOCAL_KEYS.OFFICES, updatedOffices);
    this.logActivity(`Criou novo escritório: ${newOffice.name}`);
    return newOffice;
  }

  async joinOffice(officeHandle: string): Promise<Office> {
    const offices = await this.getOffices();
    const targetOffice = offices.find(o => o.handle.toLowerCase() === officeHandle.toLowerCase());
    if (!targetOffice) throw new Error("Escritório não encontrado com este identificador.");

    const userId = (await this.getUserSession()).userId;
    const storedUser = localStorage.getItem('@JurisControl:user');
    const user = storedUser ? JSON.parse(storedUser) : { name: 'Novo Membro', email: '', avatar: '' };
    
    if (!targetOffice.members.some(m => m.userId === userId)) {
       targetOffice.members.push({
         userId: userId || 'local',
         name: user.name || 'Novo Membro',
         email: user.email || '',
         avatarUrl: user.avatar || '',
         role: 'Advogado',
         permissions: { financial: false, cases: true, documents: true, settings: false }
       });
       const updatedOffices = offices.map(o => o.id === targetOffice.id ? targetOffice : o);
       this.setLocal(LOCAL_KEYS.OFFICES, updatedOffices);
       this.logActivity(`Entrou no escritório: ${targetOffice.name}`);
    }
    return targetOffice;
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
    const todayStr = today.toDateString();

    if (lastCheck === todayStr) return;

    const tasks = await this.getTasks();
    const cases = await this.getCases();
    const settings = this.getSettings();
    
    const userStr = localStorage.getItem('@JurisControl:user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user) return;

    const parseDate = (d: string) => {
        if(!d) return null;
        if(d.includes('/')) {
             const [day, month, year] = d.split('/').map(Number);
             return new Date(year, month - 1, day);
        }
        return new Date(d);
    };

    const getDiffDays = (targetDate: Date) => {
        const diffTime = targetDate.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    };

    for (const task of tasks) {
        if (task.status === 'Concluído') continue;
        const dueDate = parseDate(task.dueDate);
        if (!dueDate) continue;
        const diff = getDiffDays(dueDate);
        
        const alerts = settings.emailPreferences?.deadlineAlerts;
        let shouldAlert = false;

        if (diff === 0 && alerts?.onDueDate) shouldAlert = true;
        if (diff === 1 && alerts?.oneDay) shouldAlert = true;
        if (diff === 3 && alerts?.threeDays) shouldAlert = true;
        if (diff === 7 && alerts?.sevenDays) shouldAlert = true;

        if (shouldAlert) {
            notificationService.notify('Prazo de Tarefa', `A tarefa "${task.title}" vence ${diff === 0 ? 'hoje' : `em ${diff} dias`}.`, 'warning');
            if (settings.emailPreferences?.enabled && settings.emailPreferences.categories.deadlines) {
                await emailService.sendDeadlineAlert(user, task, diff);
            }
        }
    }

    for (const legalCase of cases) {
        if (legalCase.status !== CaseStatus.ACTIVE || !legalCase.nextHearing) continue;
        const hearingDate = parseDate(legalCase.nextHearing);
        if (!hearingDate) continue;
        const diff = getDiffDays(hearingDate);
        
        if (diff === 1 || diff === 0) {
             notificationService.notify('Audiência Próxima', `Audiência do processo "${legalCase.title}" ${diff === 0 ? 'é hoje' : 'é amanhã'}.`, 'warning');
             if (settings.emailPreferences?.enabled && settings.emailPreferences.categories.events) {
                 const hoursLeft = diff === 0 ? 0 : 24; 
                 await emailService.sendHearingReminder(user, legalCase, hoursLeft);
             }
        }
    }

    localStorage.setItem(LOCAL_KEYS.LAST_CHECK, todayStr);
  }

  async getDashboardSummary(): Promise<DashboardData> {
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
        .slice(0, 4); 

    const todayStr = new Date().toLocaleDateString('pt-BR');
    const todaysAgenda = [
        ...allTasks.filter(t => t.dueDate === todayStr && t.status !== 'Concluído').map(t => ({ type: 'task' as const, title: t.title, sub: 'Prazo Fatal', id: t.id })),
        ...allCases.filter(c => c.nextHearing === todayStr).map(c => ({ type: 'hearing' as const, title: c.title, sub: 'Audiência', id: c.id }))
    ].slice(0, 5);

    return {
        counts: { activeCases, wonCases, pendingCases, hearings, highPriorityTasks },
        charts: { caseDistribution },
        lists: { upcomingHearings, todaysAgenda, recentMovements: [] } // recentMovements omitted for brevity
    };
  }

  async searchGlobal(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];
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
            results.push({ id: t.id, type: 'task', title: t.title, subtitle: `Vence: ${t.dueDate}`, url: '/crm' });
        }
    }
    return results.slice(0, 8);
  }

  async seedDatabase() {
    // Only seed if empty
    const clients = await this.getClients();
    if (clients.length === 0) {
        this.setLocal(LOCAL_KEYS.CLIENTS, MOCK_CLIENTS);
        this.setLocal(LOCAL_KEYS.CASES, MOCK_CASES);
        this.setLocal(LOCAL_KEYS.TASKS, MOCK_TASKS);
        this.setLocal(LOCAL_KEYS.FINANCIAL, MOCK_FINANCIALS);
    }
  }

  factoryReset() {
    localStorage.clear();
    window.location.reload();
  }
}

export const storageService = new StorageService();
