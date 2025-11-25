
import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, User, CaseMovement, SearchResult, ChangeLogEntry } from '../types';
import { MOCK_CLIENTS, MOCK_CASES, MOCK_TASKS, MOCK_FINANCIALS } from './mockData';
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
};

const LOCAL_KEYS = {
  CLIENTS: '@JurisControl:clients',
  CASES: '@JurisControl:cases',
  TASKS: '@JurisControl:tasks',
  FINANCIAL: '@JurisControl:financial',
  DOCUMENTS: '@JurisControl:documents',
  OFFICES: '@JurisControl:offices',
  LAST_CHECK: '@JurisControl:lastCheck',
};

export const MOCK_OFFICES: Office[] = [
  { 
    id: '1', 
    name: 'Advocacia Silva & Associados', 
    handle: '@silvaassociados',
    ownerId: 'u1',
    location: 'São Paulo - SP',
    logoUrl: undefined,
    cnpj: '12.345.678/0001-90',
    email: 'contato@silvaassociados.com.br',
    phone: '(11) 3322-1100',
    website: 'www.silvaassociados.adv.br',
    description: 'Escritório especializado em direito empresarial e tributário com mais de 20 anos de tradição.',
    areaOfActivity: 'Full Service',
    members: [
      {
        userId: 'u1',
        name: 'Dr. Usuário',
        role: 'Admin',
        permissions: { financial: true, cases: true, documents: true, settings: true },
        email: 'admin@silva.com',
        avatarUrl: 'https://ui-avatars.com/api/?name=Dr+Usuario&background=6366f1&color=fff'
      },
      {
        userId: 'lawyer-2',
        name: 'Dra. Amanda (Sócia)',
        role: 'Advogado',
        permissions: { financial: false, cases: true, documents: true, settings: false },
        email: 'amanda@silva.com',
        avatarUrl: 'https://ui-avatars.com/api/?name=Amanda&background=random'
      },
      {
        userId: 'lawyer-3',
        name: 'Dr. Roberto (Júnior)',
        role: 'Advogado',
        permissions: { financial: false, cases: true, documents: true, settings: false },
        email: 'roberto@silva.com',
        avatarUrl: 'https://ui-avatars.com/api/?name=Roberto&background=random'
      }
    ],
    social: {
      linkedin: 'linkedin.com/company/silva-associados',
      instagram: '@silva.adv'
    }
  },
];

class StorageService {
  
  private async getUserId(): Promise<string> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      return data.session?.user?.id || 'anon';
    }
    const stored = localStorage.getItem('@JurisControl:user');
    return stored ? JSON.parse(stored).id : 'demo-user';
  }

  private getUserName(): string {
    try {
      const stored = localStorage.getItem('@JurisControl:user');
      return stored ? JSON.parse(stored).name : 'Usuário';
    } catch { return 'Usuário'; }
  }

  // --- Clientes ---
  async getClients(): Promise<Client[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from(TABLE_NAMES.CLIENTS)
          .select('id, name, type, status, email, phone, city, state, avatarUrl, cpf, cnpj, corporateName, createdAt')
          .order('name');
        
        if (error) throw error;
        return data as Client[];
      } catch (error) { 
        console.error("Supabase Error:", error); 
        return []; 
      }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.CLIENTS) || '[]');
    }
  }
  
  async saveClient(client: Client) {
    const userId = await this.getUserId();
    const isNew = !client.id || client.id.startsWith('cli-');

    if (isSupabaseConfigured && supabase) {
      const { id, ...rest } = client;
      const { documents, history, alerts, ...payloadData } = rest as any;
      const payload = { ...payloadData, user_id: userId };
      
      if (id && !id.startsWith('cli-')) {
        await supabase.from(TABLE_NAMES.CLIENTS).update(payload).eq('id', id);
        this.logActivity(`Atualizou dados do cliente: ${client.name}`);
      } else {
        await supabase.from(TABLE_NAMES.CLIENTS).insert([{ id, ...payload }]);
        this.logActivity(`Criou novo cliente: ${client.name}`);
      }
    } else {
      const list = await this.getClients();
      if (client.id && !client.id.startsWith('cli-')) {
        const idx = list.findIndex(i => i.id === client.id);
        if (idx >= 0) {
            list[idx] = client;
            this.logActivity(`Atualizou dados do cliente: ${client.name}`);
        }
      } else {
        // Unique ID Gen
        const newId = client.id || `cli-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        list.unshift({ ...client, id: newId, userId });
        this.logActivity(`Criou novo cliente: ${client.name}`);
      }
      localStorage.setItem(LOCAL_KEYS.CLIENTS, JSON.stringify(list));
    }
  }

  async deleteClient(id: string) {
    // Integridade Referencial - QA Check 3.1
    const cases = await this.getCases();
    const hasActiveCases = cases.some(c => c.client.id === id && c.status !== CaseStatus.ARCHIVED);
    
    if (hasActiveCases) {
        // Retorna erro explícito para ser tratado na UI
        throw new Error("BLOQUEIO: Não é possível excluir este cliente pois ele possui processos ativos. Arquive ou exclua os processos primeiro.");
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.CLIENTS).delete().eq('id', id);
    } else {
      const list = await this.getClients();
      const clientName = list.find(c => c.id === id)?.name || 'Desconhecido';
      localStorage.setItem(LOCAL_KEYS.CLIENTS, JSON.stringify(list.filter(i => i.id !== id)));
      this.logActivity(`Excluiu cliente: ${clientName}`, 'Warning');
    }
  }

  // --- Processos (Cases) ---
  
  async getCases(): Promise<LegalCase[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from(TABLE_NAMES.CASES)
          .select(`
            id, cnj, title, status, category, phase, value, responsibleLawyer, nextHearing, lastUpdate, movements, changeLog,
            client:clients(id, name, type, avatarUrl)
          `);
        if (error) throw error;
        return data as LegalCase[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.CASES) || '[]');
    }
  }

  async getCaseById(id: string): Promise<LegalCase | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from(TABLE_NAMES.CASES)
          .select(`
            *,
            client:clients(*)
          `)
          .eq('id', id)
          .single();
        
        if (error) throw error;
        return data as LegalCase;
      } catch (e) { 
        console.error("Error fetching case by id", e);
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
    categoryFilter: string | null = null, // New Filter
    dateRange: { start: string, end: string } | null = null // New Filter
  ): Promise<{ data: LegalCase[], total: number }> {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from(TABLE_NAMES.CASES)
        .select(`
          id, cnj, title, status, category, phase, value, responsibleLawyer, nextHearing, lastUpdate,
          client:clients(id, name, type, avatarUrl)
        `, { count: 'exact' });

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,cnj.ilike.%${searchTerm}%`);
      }
      if (statusFilter && statusFilter !== 'Todos') {
        query = query.eq('status', statusFilter);
      }
      if (categoryFilter && categoryFilter !== 'Todos') {
        query = query.eq('category', categoryFilter);
      }
      // Filtering by lastUpdate or distributionDate if available
      if (dateRange && dateRange.start && dateRange.end) {
         query = query.gte('lastUpdate', dateRange.start).lte('lastUpdate', dateRange.end);
      }

      const { data, count, error } = await query.range(start, end).order('lastUpdate', { ascending: false });
      
      if (error) throw error;
      return { data: data as LegalCase[], total: count || 0 };
    } else {
      let allCases = JSON.parse(localStorage.getItem(LOCAL_KEYS.CASES) || '[]') as LegalCase[];
      
      // Search Logic
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        allCases = allCases.filter(c => 
          c.title.toLowerCase().includes(lowerSearch) || 
          c.cnj.includes(lowerSearch) ||
          c.client.name.toLowerCase().includes(lowerSearch)
        );
      }
      
      // Status Filter
      if (statusFilter && statusFilter !== 'Todos') {
        allCases = allCases.filter(c => c.status === statusFilter);
      }

      // Category Filter
      if (categoryFilter && categoryFilter !== 'Todos') {
        allCases = allCases.filter(c => c.category === categoryFilter);
      }

      // Date Range Filter (using lastUpdate)
      if (dateRange && dateRange.start && dateRange.end) {
        const startDate = new Date(dateRange.start).getTime();
        const endDate = new Date(dateRange.end).getTime();
        allCases = allCases.filter(c => {
           const cDate = new Date(c.lastUpdate || 0).getTime();
           return cDate >= startDate && cDate <= endDate;
        });
      }

      allCases.sort((a, b) => new Date(b.lastUpdate || 0).getTime() - new Date(a.lastUpdate || 0).getTime());

      const paginatedData = allCases.slice(start, end + 1);
      return { data: paginatedData, total: allCases.length };
    }
  }

  async saveCase(legalCase: LegalCase) {
    const userId = await this.getUserId();
    const userName = this.getUserName();
    legalCase.lastUpdate = new Date().toISOString();
    const isNew = !legalCase.id || legalCase.id.startsWith('case-');
    
    // --- Change Log Logic ---
    if (!isNew) {
      const oldCase = await this.getCaseById(legalCase.id);
      if (oldCase) {
         const changes: ChangeLogEntry[] = [];
         // Define readable labels for fields
         const fieldsMap: Record<string, string> = {
            'title': 'Título',
            'value': 'Valor da Causa',
            'status': 'Status',
            'phase': 'Fase Processual',
            'court': 'Tribunal/Vara',
            'judge': 'Juiz',
            'responsibleLawyer': 'Advogado Resp.',
            'nextHearing': 'Próx. Audiência'
         };
         
         Object.keys(fieldsMap).forEach(key => {
            // @ts-ignore
            const oldVal = String(oldCase[key] || '');
            // @ts-ignore
            const newVal = String(legalCase[key] || '');
            
            if (oldVal !== newVal) {
               changes.push({
                  id: `log-${Date.now()}-${Math.random()}`,
                  date: new Date().toLocaleString('pt-BR'),
                  author: userName,
                  field: fieldsMap[key],
                  oldValue: oldVal || '(vazio)',
                  newValue: newVal || '(vazio)'
               });
            }
         });
         
         if (changes.length > 0) {
            legalCase.changeLog = [...(changes), ...(oldCase.changeLog || [])];
         } else {
            legalCase.changeLog = oldCase.changeLog;
         }

         // Auto Movement for Status Change
         if (oldCase.status !== legalCase.status) {
            const statusChangeMovement: CaseMovement = {
                id: `mov-sys-${Date.now()}`,
                date: new Date().toLocaleString('pt-BR'),
                title: 'Alteração de Status',
                description: `O status do processo foi alterado de "${oldCase.status}" para "${legalCase.status}".`,
                type: 'Sistema',
                author: 'Sistema'
            };
            legalCase.movements = [statusChangeMovement, ...(legalCase.movements || [])];
         }
      }
    } else {
        // Init changelog for new case
        legalCase.changeLog = [{
            id: `log-init-${Date.now()}`,
            date: new Date().toLocaleString('pt-BR'),
            author: userName,
            field: 'Criação',
            oldValue: '-',
            newValue: 'Processo criado'
        }];
    }
    // -----------------------

    if (isSupabaseConfigured && supabase) {
      const { id, client, ...rest } = legalCase;
      const payload: any = {
        ...rest,
        user_id: userId,
        client_id: client.id, 
        responsibleLawyer: rest.responsibleLawyer
      };
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      if (id && !id.startsWith('case-')) {
        await supabase.from(TABLE_NAMES.CASES).update(payload).eq('id', id);
        this.logActivity(`Atualizou processo: ${legalCase.title}`);
      } else {
        await supabase.from(TABLE_NAMES.CASES).insert([{ id, ...payload }]);
        this.logActivity(`Criou novo processo: ${legalCase.title}`);
      }
    } else {
      const list = await this.getCases();
      if (legalCase.id && !legalCase.id.startsWith('case-')) {
        const idx = list.findIndex(i => i.id === legalCase.id);
        if (idx >= 0) {
            list[idx] = legalCase;
            this.logActivity(`Atualizou processo: ${legalCase.title}`);
        }
      } else {
        // Better ID generation
        const newId = legalCase.id || `case-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        list.unshift({ ...legalCase, id: newId, userId });
        this.logActivity(`Criou novo processo: ${legalCase.title}`);
      }
      localStorage.setItem(LOCAL_KEYS.CASES, JSON.stringify(list));
    }
  }

  async deleteCase(id: string) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.CASES).delete().eq('id', id);
    } else {
      const list = await this.getCases();
      const caseTitle = list.find(c => c.id === id)?.title || 'Processo';
      localStorage.setItem(LOCAL_KEYS.CASES, JSON.stringify(list.filter(i => i.id !== id)));
      
      this.logActivity(`Excluiu processo: ${caseTitle}`, 'Warning');

      // Cascade Delete
      const tasks = await this.getTasks();
      localStorage.setItem(LOCAL_KEYS.TASKS, JSON.stringify(tasks.filter(t => t.caseId !== id)));

      const financials = await this.getFinancials();
      localStorage.setItem(LOCAL_KEYS.FINANCIAL, JSON.stringify(financials.filter(f => f.caseId !== id)));

      const documents = await this.getDocuments();
      localStorage.setItem(LOCAL_KEYS.DOCUMENTS, JSON.stringify(documents.filter(d => d.caseId !== id)));
    }
  }

  // --- Tarefas ---
  async getTasks(): Promise<Task[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from(TABLE_NAMES.TASKS)
          .select('id, title, dueDate, priority, status, assignedTo, caseId, clientId, clientName, description');
        return data as Task[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.TASKS) || '[]');
    }
  }

  async getTasksByCaseId(caseId: string): Promise<Task[]> {
    if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.from(TABLE_NAMES.TASKS).select('*').eq('caseId', caseId);
        return data as Task[];
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
        await supabase.from(TABLE_NAMES.TASKS).update(payload).eq('id', id);
      } else {
        await supabase.from(TABLE_NAMES.TASKS).insert([{ id, ...payload }]);
      }
    } else {
      const list = await this.getTasks();
      if (task.id && !task.id.startsWith('task-')) {
        const idx = list.findIndex(i => i.id === task.id);
        if (idx >= 0) list[idx] = task;
      } else {
        const newId = task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        list.unshift({ ...task, id: newId, userId });
      }
      localStorage.setItem(LOCAL_KEYS.TASKS, JSON.stringify(list));
    }
  }
  
  async deleteTask(id: string) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.TASKS).delete().eq('id', id);
    } else {
      const list = await this.getTasks();
      localStorage.setItem(LOCAL_KEYS.TASKS, JSON.stringify(list.filter(i => i.id !== id)));
    }
  }

  // --- Financeiro ---
  async getFinancials(): Promise<FinancialRecord[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from(TABLE_NAMES.FINANCIAL).select('id, title, amount, type, category, status, dueDate, paymentDate, clientId, clientName, installment');
        return data as FinancialRecord[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.FINANCIAL) || '[]');
    }
  }

  async getFinancialsByCaseId(caseId: string): Promise<FinancialRecord[]> {
    if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.from(TABLE_NAMES.FINANCIAL).select('*').eq('caseId', caseId);
        return data as FinancialRecord[];
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
        await supabase.from(TABLE_NAMES.FINANCIAL).update(payload).eq('id', id);
      } else {
        await supabase.from(TABLE_NAMES.FINANCIAL).insert([{ id, ...payload }]);
      }
    } else {
      const list = await this.getFinancials();
      if (record.id && !record.id.startsWith('trans-')) {
        const idx = list.findIndex(i => i.id === record.id);
        if (idx >= 0) list[idx] = record;
      } else {
        const newId = record.id || `trans-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        list.unshift({ ...record, id: newId, userId });
      }
      localStorage.setItem(LOCAL_KEYS.FINANCIAL, JSON.stringify(list));
    }
  }

  // --- Documentos ---
  async getDocuments(): Promise<SystemDocument[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from(TABLE_NAMES.DOCUMENTS).select('*');
        return data as SystemDocument[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.DOCUMENTS) || '[]');
    }
  }

  async getDocumentsByCaseId(caseId: string): Promise<SystemDocument[]> {
    if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.from(TABLE_NAMES.DOCUMENTS).select('*').eq('caseId', caseId);
        return data as SystemDocument[];
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
      this.logActivity(`Upload de documento: ${docData.name}`);
    }
  }

  async deleteDocument(id: string) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.DOCUMENTS).delete().eq('id', id);
    } else {
      const list = await this.getDocuments();
      localStorage.setItem(LOCAL_KEYS.DOCUMENTS, JSON.stringify(list.filter(i => i.id !== id)));
    }
  }

  // --- Escritórios (Office Management) ---
  async getOffices(): Promise<Office[]> {
    return JSON.parse(localStorage.getItem(LOCAL_KEYS.OFFICES) || JSON.stringify(MOCK_OFFICES));
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
      localStorage.setItem(LOCAL_KEYS.OFFICES, JSON.stringify(offices));
      this.logActivity(`Atualizou dados do escritório: ${office.name}`);
    }
  }

  async getOfficeMembers(officeId?: string): Promise<{id: string, name: string}[]> {
    const offices = await this.getOffices();
    const office = offices.find(o => o.id === officeId);
    if (office && office.members) {
      return office.members.map(m => ({ id: m.userId, name: m.name }));
    }
    return [
        { id: 'lawyer-1', name: 'Dra. Amanda (Sócia)' },
        { id: 'lawyer-2', name: 'Dr. Roberto (Júnior)' }
    ];
  }

  async createOffice(officeData: Partial<Office>): Promise<Office> {
    const userId = await this.getUserId();
    const userStr = localStorage.getItem('@JurisControl:user');
    const user = userStr ? JSON.parse(userStr) : { name: 'Admin', email: 'admin@email.com', avatar: '' };

    const offices = await this.getOffices();
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
      ownerId: userId,
      members: [
        {
          userId: userId,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar,
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

  async joinOffice(officeHandle: string): Promise<Office> {
    const offices = await this.getOffices();
    const targetOffice = offices.find(o => o.handle.toLowerCase() === officeHandle.toLowerCase());
    if (!targetOffice) throw new Error("Escritório não encontrado com este identificador.");

    const userId = await this.getUserId();
    const userStr = localStorage.getItem('@JurisControl:user');
    const user = userStr ? JSON.parse(userStr) : { name: 'Novo Membro', email: '', avatar: '' };
    
    if (!targetOffice.members.some(m => m.userId === userId)) {
       targetOffice.members.push({
         userId: userId,
         name: user.name,
         email: user.email,
         avatarUrl: user.avatar,
         role: 'Advogado',
         permissions: { financial: false, cases: true, documents: true, settings: false }
       });
       const updatedOffices = offices.map(o => o.id === targetOffice.id ? targetOffice : o);
       localStorage.setItem(LOCAL_KEYS.OFFICES, JSON.stringify(updatedOffices));
       this.logActivity(`Entrou no escritório: ${targetOffice.name}`);
    }
    return targetOffice;
  }

  async inviteUserToOffice(officeId: string, userHandle: string): Promise<boolean> {
     if (!userHandle.startsWith('@')) throw new Error("O nome de usuário deve começar com @.");
     await new Promise(resolve => setTimeout(resolve, 800));
     return true; 
  }

  // --- Utils & Logs ---
  getLogs(): ActivityLog[] { 
    try { return JSON.parse(localStorage.getItem('@JurisControl:logs') || '[]'); } catch { return []; }
  }
  
  logActivity(action: string, status: 'Success' | 'Failed' | 'Warning' = 'Success') {
    const logs = this.getLogs();
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      action,
      date: new Date().toLocaleString('pt-BR'),
      device: navigator.userAgent.split(')')[0] + ')',
      ip: '127.0.0.1', // Simulated IP
      status
    };
    logs.unshift(newLog);
    localStorage.setItem('@JurisControl:logs', JSON.stringify(logs.slice(0, 50)));
  }

  getSettings(): AppSettings {
      try {
          const s = localStorage.getItem('@JurisControl:settings');
          return s ? JSON.parse(s) : {
            general: { language: 'pt-BR', dateFormat: 'DD/MM/YYYY', compactMode: false },
            notifications: { email: true, desktop: true, sound: false, dailyDigest: false },
            automation: { autoArchiveWonCases: false, autoSaveDrafts: true }
          };
      } catch { return {} as any; }
  }

  saveSettings(settings: AppSettings) {
      localStorage.setItem('@JurisControl:settings', JSON.stringify(settings));
  }

  // --- Optimized Dashboard Data ---
  async getDashboardSummary(): Promise<DashboardData> {
    const [allCases, allTasks] = await Promise.all([
      this.getCases(),
      this.getTasks()
    ]);

    const activeCases = allCases.filter(c => c.status === CaseStatus.ACTIVE).length;
    const wonCases = allCases.filter(c => c.status === CaseStatus.WON).length;
    const pendingCases = allCases.filter(c => c.status === CaseStatus.PENDING).length;
    const archivedCases = allCases.filter(c => c.status === CaseStatus.ARCHIVED).length;
    const hearings = allCases.filter(c => !!c.nextHearing).length;
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

  // --- Global Search ---
  async searchGlobal(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];
    
    const lowerQuery = query.toLowerCase();
    const [clients, cases, tasks] = await Promise.all([
        this.getClients(),
        this.getCases(),
        this.getTasks()
    ]);

    const results: SearchResult[] = [];

    // Filter Clients
    clients.forEach(c => {
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
    });

    // Filter Cases
    cases.forEach(c => {
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
    });

    // Filter Tasks
    tasks.forEach(t => {
        if (t.title.toLowerCase().includes(lowerQuery)) {
            results.push({
                id: t.id,
                type: 'task',
                title: t.title,
                subtitle: `Vence: ${t.dueDate} • ${t.status}`,
                url: '/crm' // Tasks don't have detail pages, go to CRM
            });
        }
    });

    return results.slice(0, 8); // Return top 8 matches
  }

  async seedDatabase() {
    const clients = await this.getClients();
    if (clients.length > 0) return;
    if (isSupabaseConfigured) return; 

    const userId = await this.getUserId();
    
    localStorage.setItem(LOCAL_KEYS.CLIENTS, JSON.stringify(MOCK_CLIENTS.map(c => ({...c, userId}))));
    localStorage.setItem(LOCAL_KEYS.CASES, JSON.stringify(MOCK_CASES.map(c => ({...c, userId}))));
    localStorage.setItem(LOCAL_KEYS.TASKS, JSON.stringify(MOCK_TASKS.map(c => ({...c, userId}))));
    localStorage.setItem(LOCAL_KEYS.FINANCIAL, JSON.stringify(MOCK_FINANCIALS.map(c => ({...c, userId}))));
    if (!localStorage.getItem(LOCAL_KEYS.OFFICES)) {
      localStorage.setItem(LOCAL_KEYS.OFFICES, JSON.stringify(MOCK_OFFICES));
    }
  }

  async runAutomations() {
    await this.checkDeadlines();
  }

  async checkDeadlines() {
    const lastCheck = localStorage.getItem(LOCAL_KEYS.LAST_CHECK);
    const todayStr = new Date().toDateString();
    if (lastCheck === todayStr) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowPT = tomorrow.toLocaleDateString('pt-BR'); 

    const isTomorrow = (dateStr: string) => {
        if (!dateStr) return false;
        if (dateStr === tomorrowPT) return true;
        try {
           if (dateStr.includes('-')) {
             const [y, m, d] = dateStr.split('-');
             if (parseInt(d) === tomorrow.getDate() && parseInt(m) === tomorrow.getMonth() + 1 && parseInt(y) === tomorrow.getFullYear()) return true;
           }
        } catch (e) { return false; }
        return false;
    };

    const tasks = await this.getTasks();
    const cases = await this.getCases();

    for (const task of tasks) {
        if (task.status !== 'Concluído' && isTomorrow(task.dueDate)) {
            notificationService.notify('Prazo de Tarefa Próximo', `A tarefa "${task.title}" vence amanhã (${task.dueDate}).`, 'warning');
        }
    }

    for (const legalCase of cases) {
        if (legalCase.status === CaseStatus.ACTIVE && legalCase.nextHearing && isTomorrow(legalCase.nextHearing)) {
            notificationService.notify('Audiência Amanhã', `Audiência do processo "${legalCase.title}" agendada para amanhã.`, 'warning');
        }
    }

    localStorage.setItem(LOCAL_KEYS.LAST_CHECK, todayStr);
  }
  
  factoryReset() {
    localStorage.clear();
    window.location.reload();
  }
}

export const storageService = new StorageService();
