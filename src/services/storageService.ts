
import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, SearchResult } from '../types';
import { notificationService } from './notificationService';

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

class StorageService {
  
  // --- Helpers ---
  private get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private set(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // --- Clients ---
  async getClients(): Promise<Client[]> {
    return this.get<Client[]>(LOCAL_KEYS.CLIENTS, []);
  }
  
  async saveClient(client: Client) {
    const list = await this.getClients();
    const idx = list.findIndex(i => i.id === client.id);
    
    if (idx >= 0) {
      list[idx] = client;
    } else {
      if (!client.id || client.id.startsWith('new')) client.id = `cli-${Date.now()}`;
      list.unshift(client);
    }
    
    this.set(LOCAL_KEYS.CLIENTS, list);
    this.logActivity(`Salvou cliente: ${client.name}`);
  }

  async deleteClient(id: string) {
    const list = await this.getClients();
    this.set(LOCAL_KEYS.CLIENTS, list.filter(i => i.id !== id));
    this.logActivity(`Excluiu cliente ID: ${id}`, 'Warning');
  }

  // --- Cases ---
  async getCases(): Promise<LegalCase[]> {
    return this.get<LegalCase[]>(LOCAL_KEYS.CASES, []);
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
    legalCase.lastUpdate = new Date().toISOString();
    const list = await this.getCases();
    const idx = list.findIndex(i => i.id === legalCase.id);
    
    if (idx >= 0) {
      list[idx] = legalCase;
    } else {
      if (!legalCase.id || legalCase.id.startsWith('new')) legalCase.id = `case-${Date.now()}`;
      list.push(legalCase);
    }
    
    this.set(LOCAL_KEYS.CASES, list);
    this.logActivity(`Salvou processo: ${legalCase.title}`);
  }

  async deleteCase(id: string) {
    const list = await this.getCases();
    this.set(LOCAL_KEYS.CASES, list.filter(i => i.id !== id));
    this.logActivity(`Excluiu processo ID: ${id}`, 'Warning');
  }

  // --- Tasks ---
  async getTasks(): Promise<Task[]> {
    return this.get<Task[]>(LOCAL_KEYS.TASKS, []);
  }

  async getTasksByCaseId(caseId: string): Promise<Task[]> {
    const tasks = await this.getTasks();
    return tasks.filter(t => t.caseId === caseId);
  }
  
  async saveTask(task: Task) {
    const list = await this.getTasks();
    const idx = list.findIndex(i => i.id === task.id);
    
    if (idx >= 0) list[idx] = task;
    else {
      if(!task.id) task.id = `task-${Date.now()}`;
      list.push(task);
    }
    this.set(LOCAL_KEYS.TASKS, list);
  }
  
  async deleteTask(id: string) {
    const list = await this.getTasks();
    this.set(LOCAL_KEYS.TASKS, list.filter(i => i.id !== id));
  }

  // --- Financial ---
  async getFinancials(): Promise<FinancialRecord[]> {
    return this.get<FinancialRecord[]>(LOCAL_KEYS.FINANCIAL, []);
  }

  async getFinancialsByCaseId(caseId: string): Promise<FinancialRecord[]> {
    const fins = await this.getFinancials();
    return fins.filter(f => f.caseId === caseId);
  }
  
  async saveFinancial(record: FinancialRecord) {
    const list = await this.getFinancials();
    const idx = list.findIndex(i => i.id === record.id);
    
    if (idx >= 0) list[idx] = record;
    else {
      if(!record.id) record.id = `trans-${Date.now()}`;
      list.push(record);
    }
    this.set(LOCAL_KEYS.FINANCIAL, list);
  }

  // --- Documents ---
  async getDocuments(): Promise<SystemDocument[]> {
    return this.get<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
  }

  async getDocumentsByCaseId(caseId: string): Promise<SystemDocument[]> {
    const docs = await this.getDocuments();
    return docs.filter(d => d.caseId === caseId);
  }

  async saveDocument(docData: SystemDocument) {
    const list = await this.getDocuments();
    list.unshift(docData);
    this.set(LOCAL_KEYS.DOCUMENTS, list);
    this.logActivity(`Upload de documento: ${docData.name}`);
  }

  async deleteDocument(id: string) {
    const list = await this.getDocuments();
    this.set(LOCAL_KEYS.DOCUMENTS, list.filter(i => i.id !== id));
  }

  // --- Offices ---
  async getOffices(): Promise<Office[]> {
    return this.get<Office[]>(LOCAL_KEYS.OFFICES, []);
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
      this.set(LOCAL_KEYS.OFFICES, offices);
      this.logActivity(`Atualizou dados do escritório: ${office.name}`);
    }
  }

  async createOffice(officeData: Partial<Office>, explicitOwnerId?: string): Promise<Office> {
    const offices = await this.getOffices();
    const userStr = localStorage.getItem('@JurisControl:user');
    const user = userStr ? JSON.parse(userStr) : { id: 'local', name: 'Admin', email: 'admin@local.com', avatar: '' };
    
    const ownerId = explicitOwnerId || user.id;
    let handle = officeData.handle || `@office${Date.now()}`;
    if (!handle.startsWith('@')) handle = '@' + handle;

    if (offices.some(o => o.handle.toLowerCase() === handle.toLowerCase())) {
      throw new Error("Este identificador de escritório (@handle) já está em uso.");
    }

    const newOffice: Office = {
      id: `office-${Date.now()}`,
      name: officeData.name || 'Novo Escritório',
      handle: handle,
      location: officeData.location || 'Brasil',
      ownerId: ownerId,
      members: [
        {
          userId: ownerId,
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

    offices.push(newOffice);
    this.set(LOCAL_KEYS.OFFICES, offices);
    this.logActivity(`Criou novo escritório: ${newOffice.name}`);
    return newOffice;
  }

  async joinOffice(officeHandle: string): Promise<Office> {
    const offices = await this.getOffices();
    const targetOffice = offices.find(o => o.handle.toLowerCase() === officeHandle.toLowerCase());
    if (!targetOffice) throw new Error("Escritório não encontrado com este identificador.");

    const userStr = localStorage.getItem('@JurisControl:user');
    const user = userStr ? JSON.parse(userStr) : { id: 'new', name: 'Novo Membro', email: '', avatar: '' };
    
    if (!targetOffice.members.some(m => m.userId === user.id)) {
       targetOffice.members.push({
         userId: user.id,
         name: user.name,
         email: user.email,
         avatarUrl: user.avatar,
         role: 'Advogado',
         permissions: { financial: false, cases: true, documents: true, settings: false }
       });
       
       this.set(LOCAL_KEYS.OFFICES, offices);
       this.logActivity(`Entrou no escritório: ${targetOffice.name}`);
    }
    return targetOffice;
  }

  async inviteUserToOffice(officeId: string, userHandle: string): Promise<boolean> {
     if (!userHandle.startsWith('@')) throw new Error("O nome de usuário deve começar com @.");
     // In a local mock, we just simulate success
     return true; 
  }

  async deleteAccount() {
    localStorage.clear();
  }

  // --- Utils & Logs ---
  getLogs(): ActivityLog[] { 
    return this.get<ActivityLog[]>(LOCAL_KEYS.LOGS, []);
  }
  
  logActivity(action: string, status: 'Success' | 'Failed' | 'Warning' = 'Success') {
    const logs = this.getLogs();
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      action,
      date: new Date().toLocaleString('pt-BR'),
      device: 'Navegador Web',
      ip: '127.0.0.1', 
      status
    };
    logs.unshift(newLog);
    this.set(LOCAL_KEYS.LOGS, logs.slice(0, 50));
  }

  getSettings(): AppSettings {
      const defaultValue: AppSettings = {
        general: { language: 'pt-BR', dateFormat: 'DD/MM/YYYY', compactMode: false, dataJudApiKey: '' },
        notifications: { email: true, desktop: true, sound: false, dailyDigest: false },
        emailPreferences: {
            enabled: false,
            frequency: 'immediate',
            categories: { deadlines: true, processes: true, events: true, financial: false, marketing: true },
            deadlineAlerts: { sevenDays: true, threeDays: true, oneDay: true, onDueDate: true }
        },
        automation: { autoArchiveWonCases: false, autoSaveDrafts: true }
      };
      
      const stored = this.get<AppSettings>(LOCAL_KEYS.SETTINGS, defaultValue);
      return { ...defaultValue, ...stored };
  }

  saveSettings(settings: AppSettings) {
      this.set(LOCAL_KEYS.SETTINGS, settings);
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

  factoryReset() {
    localStorage.clear();
    window.location.reload();
  }
}

export const storageService = new StorageService();
