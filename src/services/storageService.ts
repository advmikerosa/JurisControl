
import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, SearchResult, OfficeMember } from '../types';
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

class StorageService {
  
  private async getUserId(): Promise<string | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) return null;
        return data.session.user.id;
      } catch {
        return null;
      }
    }
    const stored = localStorage.getItem('@JurisControl:user');
    return stored ? JSON.parse(stored).id : 'local-user';
  }

  // --- Helpers for Local Storage ---
  private getLocal<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch { return defaultValue; }
  }

  private setLocal(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // --- Clients ---
  async getClients(): Promise<Client[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return []; 

        const { data, error } = await supabase
          .from(TABLE_NAMES.CLIENTS)
          .select('*')
          .eq('user_id', userId)
          .order('name');
        
        if (error) throw error;
        
        return (data || []).map((c: any) => ({
            id: c.id,
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
            notes: c.notes,
            documents: c.documents || [],
            history: c.history || []
        })) as Client[];
      } catch (error) { 
        console.error("Supabase Error (getClients):", error); 
        return []; 
      }
    }
    return this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
  }
  
  async saveClient(client: Client) {
    const userId = await this.getUserId();

    if (isSupabaseConfigured && supabase) {
      if (!userId) throw new Error("Usuário não autenticado");
      
      const payload = {
          id: client.id && !client.id.startsWith('cli-') ? client.id : client.id,
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

      if (client.id && !client.id.startsWith('cli-')) {
        await supabase.from(TABLE_NAMES.CLIENTS).upsert(payload);
      } else {
        await supabase.from(TABLE_NAMES.CLIENTS).insert([payload]);
      }
    } else {
      const list = await this.getClients();
      const idx = list.findIndex(i => i.id === client.id);
      if (idx >= 0) list[idx] = client;
      else {
          if (!client.id || client.id.startsWith('new')) client.id = `cli-${Date.now()}`;
          list.unshift({ ...client, userId: userId || 'local' });
      }
      this.setLocal(LOCAL_KEYS.CLIENTS, list);
    }
    this.logActivity(`Salvou cliente: ${client.name}`);
  }

  async deleteClient(id: string) {
    const cases = await this.getCases();
    const hasActiveCases = cases.some(c => c.client.id === id && c.status !== CaseStatus.ARCHIVED);
    if (hasActiveCases) throw new Error("BLOQUEIO: Não é possível excluir este cliente pois ele possui processos ativos.");

    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      if (!userId) return;
      await supabase.from(TABLE_NAMES.CLIENTS).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getClients();
      this.setLocal(LOCAL_KEYS.CLIENTS, list.filter(i => i.id !== id));
    }
    this.logActivity(`Excluiu cliente ID: ${id}`, 'Warning');
  }

  // --- Cases ---
  async getCases(): Promise<LegalCase[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return [];

        const { data, error } = await supabase
          .from(TABLE_NAMES.CASES)
          .select(`*, client:clients!cases_client_id_fkey(*)`)
          .eq('user_id', userId);
        
        if (error) throw error;
        
        return (data || []).map((item: any) => {
          const clientData = item.client;
          // Cast partial client data to Client type to satisfy interface
          const mappedClient = (clientData ? {
              id: clientData.id,
              name: clientData.name,
              type: clientData.type,
              avatarUrl: clientData.avatar_url
          } : { id: 'unknown', name: 'Cliente Desconhecido', type: 'PF', avatarUrl: '' }) as Client;

          return {
            id: item.id,
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
            changeLog: item.change_log,
            lastUpdate: item.last_update,
            client: mappedClient
          };
        });
      } catch (e) { 
        return []; 
      }
    }
    return this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
  }

  async getCaseById(id: string): Promise<LegalCase | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return null;
        const { data, error } = await supabase.from(TABLE_NAMES.CASES).select(`*, client:clients!cases_client_id_fkey(*)`).eq('id', id).eq('user_id', userId).single();
        if (error) throw error;
        
        const clientData = data.client;
        const mappedClient = (clientData ? {
            id: clientData.id, name: clientData.name, type: clientData.type, avatarUrl: clientData.avatar_url, email: clientData.email, phone: clientData.phone
        } : { id: 'unknown', name: 'Cliente Desconhecido' }) as Client;

        return {
            id: data.id, cnj: data.cnj, title: data.title, status: data.status, category: data.category, phase: data.phase, value: Number(data.value),
            responsibleLawyer: data.responsible_lawyer, court: data.court, nextHearing: data.next_hearing, distributionDate: data.created_at,
            description: data.description, movements: data.movements, changeLog: data.change_log, lastUpdate: data.last_update, client: mappedClient
        } as LegalCase;
      } catch { return null; }
    }
    const cases = await this.getCases();
    return cases.find(c => c.id === id) || null;
  }

  async getCasesPaginated(
    page: number = 1, limit: number = 20, searchTerm: string = '', statusFilter: string | null = null,
    categoryFilter: string | null = null, dateRange: { start: string, end: string } | null = null
  ): Promise<{ data: LegalCase[], total: number }> {
    const allCases = await this.getCases();
    let filtered = allCases;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => c.title.toLowerCase().includes(lower) || c.cnj.includes(lower) || c.client.name.toLowerCase().includes(lower));
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
    return { data: filtered.slice(start, start + limit), total: filtered.length };
  }

  async saveCase(legalCase: LegalCase) {
    const userId = await this.getUserId();
    legalCase.lastUpdate = new Date().toISOString();
    
    if (isSupabaseConfigured && supabase) {
      if (!userId) throw new Error("Usuário não autenticado");
      const payload: any = {
        id: legalCase.id && !legalCase.id.startsWith('case-') ? legalCase.id : legalCase.id,
        user_id: userId, client_id: legalCase.client.id, cnj: legalCase.cnj, title: legalCase.title, status: legalCase.status,
        category: legalCase.category, phase: legalCase.phase, value: legalCase.value, responsible_lawyer: legalCase.responsibleLawyer,
        court: legalCase.court, next_hearing: legalCase.nextHearing, description: legalCase.description,
        movements: legalCase.movements, change_log: legalCase.changeLog, last_update: legalCase.lastUpdate
      };
      if (legalCase.id && !legalCase.id.startsWith('case-')) {
        await supabase.from(TABLE_NAMES.CASES).upsert(payload);
      } else {
        await supabase.from(TABLE_NAMES.CASES).insert([payload]);
      }
    } else {
      const list = await this.getCases();
      const idx = list.findIndex(i => i.id === legalCase.id);
      if (idx >= 0) list[idx] = legalCase;
      else {
          if (!legalCase.id || legalCase.id.startsWith('new')) legalCase.id = `case-${Date.now()}`;
          list.push({ ...legalCase, userId: userId || 'local' });
      }
      this.setLocal(LOCAL_KEYS.CASES, list);
    }
    this.logActivity(`Salvou processo: ${legalCase.title}`);
  }

  async deleteCase(id: string) {
    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      if (!userId) return;
      await supabase.from(TABLE_NAMES.CASES).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getCases();
      this.setLocal(LOCAL_KEYS.CASES, list.filter(i => i.id !== id));
    }
    this.logActivity(`Excluiu processo ID: ${id}`, 'Warning');
  }

  // --- Tasks ---
  async getTasks(): Promise<Task[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return [];
        const { data } = await supabase.from(TABLE_NAMES.TASKS).select('*').eq('user_id', userId);
        return (data || []).map((t: any) => ({
            id: t.id, title: t.title, dueDate: t.due_date, priority: t.priority, status: t.status, assignedTo: t.assigned_to,
            description: t.description, caseId: t.case_id, caseTitle: t.case_title, clientId: t.client_id, clientName: t.client_name
        })) as Task[];
      } catch { return []; }
    }
    return this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
  }

  async getTasksByCaseId(caseId: string): Promise<Task[]> {
    const tasks = await this.getTasks();
    return tasks.filter(t => t.caseId === caseId);
  }
  
  async saveTask(task: Task) {
    const userId = await this.getUserId();
    if (isSupabaseConfigured && supabase) {
      if (!userId) throw new Error("Usuário não autenticado");
      const payload = { 
          id: task.id && !task.id.startsWith('task-') ? task.id : task.id,
          user_id: userId, title: task.title, due_date: task.dueDate, priority: task.priority, status: task.status,
          assigned_to: task.assignedTo, description: task.description, case_id: task.caseId, case_title: task.caseTitle,
          client_id: task.clientId, client_name: task.clientName
      };
      if (task.id && !task.id.startsWith('task-')) await supabase.from(TABLE_NAMES.TASKS).upsert(payload);
      else await supabase.from(TABLE_NAMES.TASKS).insert([payload]);
    } else {
      const list = await this.getTasks();
      const idx = list.findIndex(i => i.id === task.id);
      if (idx >= 0) list[idx] = task;
      else {
          if(!task.id) task.id = `task-${Date.now()}`;
          list.push(task);
      }
      this.setLocal(LOCAL_KEYS.TASKS, list);
    }
  }
  
  async deleteTask(id: string) {
    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      if (!userId) return;
      await supabase.from(TABLE_NAMES.TASKS).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getTasks();
      this.setLocal(LOCAL_KEYS.TASKS, list.filter(i => i.id !== id));
    }
  }

  // --- Financial ---
  async getFinancials(): Promise<FinancialRecord[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return [];
        const { data } = await supabase.from(TABLE_NAMES.FINANCIAL).select('*').eq('user_id', userId);
        return (data || []).map((f: any) => ({
            id: f.id, title: f.title, amount: Number(f.amount), type: f.type, category: f.category, status: f.status,
            dueDate: f.due_date, paymentDate: f.payment_date, clientId: f.client_id, clientName: f.client_name, caseId: f.case_id, installment: f.installment
        })) as FinancialRecord[];
      } catch { return []; }
    }
    return this.getLocal<FinancialRecord[]>(LOCAL_KEYS.FINANCIAL, []);
  }

  async getFinancialsByCaseId(caseId: string): Promise<FinancialRecord[]> {
    const fins = await this.getFinancials();
    return fins.filter(f => f.caseId === caseId);
  }
  
  async saveFinancial(record: FinancialRecord) {
    const userId = await this.getUserId();
    if (isSupabaseConfigured && supabase) {
      if (!userId) throw new Error("Usuário não autenticado");
      const payload = {
          id: record.id && !record.id.startsWith('trans-') ? record.id : record.id,
          user_id: userId, title: record.title, amount: record.amount, type: record.type, category: record.category,
          status: record.status, due_date: record.dueDate, payment_date: record.payment_date, client_id: record.clientId,
          client_name: record.clientName, case_id: record.caseId, installment: record.installment
      };
      if (record.id && !record.id.startsWith('trans-')) await supabase.from(TABLE_NAMES.FINANCIAL).upsert(payload);
      else await supabase.from(TABLE_NAMES.FINANCIAL).insert([payload]);
    } else {
      const list = await this.getFinancials();
      const idx = list.findIndex(i => i.id === record.id);
      if (idx >= 0) list[idx] = record;
      else {
          if(!record.id) record.id = `trans-${Date.now()}`;
          list.push(record);
      }
      this.setLocal(LOCAL_KEYS.FINANCIAL, list);
    }
  }

  // --- Documents ---
  async getDocuments(): Promise<SystemDocument[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return [];
        const { data } = await supabase.from(TABLE_NAMES.DOCUMENTS).select('*').eq('user_id', userId);
        return (data || []).map((d: any) => ({
            id: d.id, name: d.name, size: d.size, type: d.type, date: d.date, category: d.category, caseId: d.case_id, userId: d.user_id
        })) as SystemDocument[];
      } catch { return []; }
    }
    return this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
  }

  async getDocumentsByCaseId(caseId: string): Promise<SystemDocument[]> {
    const docs = await this.getDocuments();
    return docs.filter(d => d.caseId === caseId);
  }

  async saveDocument(docData: SystemDocument) {
    const userId = await this.getUserId();
    if (isSupabaseConfigured && supabase) {
      if (!userId) throw new Error("Usuário não autenticado");
      const payload = { 
          id: docData.id, user_id: userId, name: docData.name, size: docData.size, type: docData.type,
          date: docData.date, category: docData.category, case_id: docData.caseId
      };
      await supabase.from(TABLE_NAMES.DOCUMENTS).insert([payload]);
    } else {
      const list = await this.getDocuments();
      list.unshift({ ...docData, userId: userId || 'local' });
      this.setLocal(LOCAL_KEYS.DOCUMENTS, list);
    }
    this.logActivity(`Upload de documento: ${docData.name}`);
  }

  async deleteDocument(id: string) {
    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      if (!userId) return;
      await supabase.from(TABLE_NAMES.DOCUMENTS).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getDocuments();
      this.setLocal(LOCAL_KEYS.DOCUMENTS, list.filter(i => i.id !== id));
    }
  }

  // --- Offices ---
  async getOffices(): Promise<Office[]> {
    if (isSupabaseConfigured && supabase) {
      try {
          const { data, error } = await supabase.from(TABLE_NAMES.OFFICES).select('*');
          if (error) throw error;
          return (data || []).map((o: any) => ({
              id: o.id, name: o.name, handle: o.handle, location: o.location, ownerId: o.owner_id, logoUrl: o.logo_url,
              createdAt: o.created_at, areaOfActivity: o.area_of_activity, members: o.members || []
          }));
      } catch { return []; }
    }
    return this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
  }

  async getOfficeById(id: string): Promise<Office | undefined> {
    const offices = await this.getOffices();
    return offices.find(o => o.id === id);
  }
  
  async saveOffice(office: Office): Promise<void> {
    if (isSupabaseConfigured && supabase) {
        const payload = {
            id: office.id, name: office.name, handle: office.handle, location: office.location, owner_id: office.ownerId,
            logo_url: office.logoUrl, created_at: office.createdAt, area_of_activity: office.areaOfActivity, members: office.members, social: office.social
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

  async createOffice(officeData: Partial<Office>, explicitOwnerId?: string): Promise<Office> {
    const userId = explicitOwnerId || await this.getUserId();
    const userStr = localStorage.getItem('@JurisControl:user');
    const user = userStr ? JSON.parse(userStr) : { name: 'Admin', email: 'admin@email.com', avatar: '' };

    let handle = officeData.handle || `@office${Date.now()}`;
    if (!handle.startsWith('@')) handle = '@' + handle;

    if (isSupabaseConfigured && supabase) {
        if (!userId) throw new Error("Usuário não autenticado");
        const newOffice = {
            name: officeData.name || 'Novo Escritório', handle: handle, location: officeData.location || 'Brasil', owner_id: userId,
            created_at: new Date().toISOString(),
            members: [{ userId: userId, name: user?.name || 'User', email: user?.email || '', avatarUrl: user?.avatar || '', role: 'Admin', permissions: { financial: true, cases: true, documents: true, settings: true } }],
            social: {}
        };
        const { data, error } = await supabase.from(TABLE_NAMES.OFFICES).insert(newOffice).select().single();
        if (error) {
            if (error.code === '23505') throw new Error("Identificador em uso.");
            throw new Error(error.message);
        }
        return {
            id: data.id, name: data.name, handle: data.handle, location: data.location, ownerId: data.owner_id, createdAt: data.created_at, members: data.members, social: data.social
        } as Office;
    } else {
        const offices = await this.getOffices();
        if (offices.some(o => o.handle.toLowerCase() === handle.toLowerCase())) throw new Error("Este identificador já está em uso.");
        const newOffice: Office = {
          id: `office-${Date.now()}`, name: officeData.name || 'Novo Escritório', handle: handle, location: officeData.location || 'Brasil', ownerId: userId || 'local',
          members: [{ userId: userId || 'local', name: user?.name || 'User', email: user?.email || '', avatarUrl: user?.avatar || '', role: 'Admin', permissions: { financial: true, cases: true, documents: true, settings: true } }],
          createdAt: new Date().toISOString(), social: {}
        };
        offices.push(newOffice);
        this.setLocal(LOCAL_KEYS.OFFICES, offices);
        this.logActivity(`Criou novo escritório: ${newOffice.name}`);
        return newOffice;
    }
  }

  async joinOffice(officeHandle: string): Promise<Office> {
    if (isSupabaseConfigured && supabase) {
        const { data: office, error } = await supabase.from(TABLE_NAMES.OFFICES).select('*').eq('handle', officeHandle).single();
        if (error || !office) throw new Error("Escritório não encontrado ou acesso restrito.");
        const userId = await this.getUserId();
        if (!userId) throw new Error("Usuário não autenticado");
        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user?.user_metadata || {};
        const members = office.members || [];
        if (members.find((m: any) => m.userId === userId)) return { id: office.id, name: office.name, handle: office.handle, location: office.location, ownerId: office.owner_id, logoUrl: office.logo_url, createdAt: office.created_at, areaOfActivity: office.area_of_activity, members };
        
        const newMember: OfficeMember = { userId: userId, name: u.full_name || 'Novo Membro', email: session?.user?.email || '', avatarUrl: u.avatar_url || '', role: 'Advogado', permissions: { financial: false, cases: true, documents: true, settings: false } };
        const updatedMembers = [...members, newMember];
        await supabase.from(TABLE_NAMES.OFFICES).update({ members: updatedMembers }).eq('id', office.id);
        this.logActivity(`Entrou no escritório: ${office.name}`);
        return { id: office.id, name: office.name, handle: office.handle, location: office.location, ownerId: office.owner_id, logoUrl: office.logo_url, createdAt: office.created_at, areaOfActivity: office.area_of_activity, members: updatedMembers };
    } else {
        const offices = await this.getOffices();
        const targetOffice = offices.find(o => o.handle.toLowerCase() === officeHandle.toLowerCase());
        if (!targetOffice) throw new Error("Escritório não encontrado.");
        const userId = await this.getUserId();
        const user = JSON.parse(localStorage.getItem('@JurisControl:user') || '{}');
        if (!targetOffice.members.some(m => m.userId === userId)) {
           targetOffice.members.push({ userId: userId || 'local', name: user.name || 'Novo Membro', email: user.email || '', avatarUrl: user.avatar || '', role: 'Advogado', permissions: { financial: false, cases: true, documents: true, settings: false } });
           this.setLocal(LOCAL_KEYS.OFFICES, offices);
           this.logActivity(`Entrou no escritório: ${targetOffice.name}`);
        }
        return targetOffice;
    }
  }

  async inviteUserToOffice(officeId: string, userHandle: string): Promise<boolean> {
     // Simulação local ou implementação futura
     return true; 
  }

  async deleteAccount() {
    const userId = await this.getUserId();
    if (isSupabaseConfigured && supabase && userId) {
      const tables = [TABLE_NAMES.LOGS, TABLE_NAMES.FINANCIAL, TABLE_NAMES.TASKS, TABLE_NAMES.DOCUMENTS, TABLE_NAMES.CASES, TABLE_NAMES.CLIENTS, TABLE_NAMES.PROFILES];
      for (const table of tables) { try { await supabase.from(table).delete().eq('user_id', userId); } catch {} }
    } else {
      localStorage.clear();
    }
  }

  getLogs(): ActivityLog[] { 
    if (isSupabaseConfigured && supabase) return []; // Logs fetch async in dedicated component usually
    return this.getLocal<ActivityLog[]>(LOCAL_KEYS.LOGS, []);
  }
  
  logActivity(action: string, status: 'Success' | 'Failed' | 'Warning' = 'Success') {
    if (isSupabaseConfigured && supabase) {
        this.getUserId().then(uid => {
            if (uid) supabase!.from(TABLE_NAMES.LOGS).insert([{ user_id: uid, action, status, device: navigator.userAgent, ip: 'IP_PLACEHOLDER', date: new Date().toLocaleString('pt-BR') }]);
        });
    } else {
        const logs = this.getLogs();
        logs.unshift({ id: Date.now().toString(), action, date: new Date().toLocaleString('pt-BR'), device: 'Web', ip: '127.0.0.1', status });
        this.setLocal(LOCAL_KEYS.LOGS, logs.slice(0, 50));
    }
  }

  getSettings(): AppSettings {
      const defaultValue: AppSettings = {
        general: { language: 'pt-BR', dateFormat: 'DD/MM/YYYY', compactMode: false, dataJudApiKey: '' },
        notifications: { email: true, desktop: true, sound: false, dailyDigest: false },
        emailPreferences: { enabled: false, frequency: 'immediate', categories: { deadlines: true, processes: true, events: true, financial: false, marketing: true }, deadlineAlerts: { sevenDays: true, threeDays: true, oneDay: true, onDueDate: true } },
        automation: { autoArchiveWonCases: false, autoSaveDrafts: true }
      };
      return { ...defaultValue, ...this.getLocal<AppSettings>(LOCAL_KEYS.SETTINGS, defaultValue) };
  }

  saveSettings(settings: AppSettings) {
      this.setLocal(LOCAL_KEYS.SETTINGS, settings);
      if (isSupabaseConfigured && supabase) {
          this.getUserId().then(uid => { if (uid) supabase!.from(TABLE_NAMES.PROFILES).upsert({ id: uid, settings }); });
      }
  }

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
    const caseDistribution = [{ name: 'Ativos', value: activeCases, color: '#818cf8' }, { name: 'Pendentes', value: pendingCases, color: '#fbbf24' }, { name: 'Ganhos', value: wonCases, color: '#34d399' }];
    const upcomingHearings = allCases.filter(c => c.nextHearing).sort((a, b) => {
            if (!a.nextHearing || !b.nextHearing) return 0;
            const [dA, mA, yA] = a.nextHearing.split('/').map(Number);
            const [dB, mB, yB] = b.nextHearing.split('/').map(Number);
            return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
        }).slice(0, 4); 
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const todaysAgenda = [
        ...allTasks.filter(t => t.dueDate === todayStr && t.status !== 'Concluído').map(t => ({ type: 'task' as const, title: t.title, sub: 'Prazo Fatal', id: t.id })),
        ...allCases.filter(c => c.nextHearing === todayStr).map(c => ({ type: 'hearing' as const, title: c.title, sub: 'Audiência', id: c.id }))
    ].slice(0, 5);
    const recentMovements = allCases.flatMap(c => (c.movements || []).map(m => ({ id: m.id, caseId: c.id, caseTitle: c.title, description: m.description, date: m.date, type: m.type }))).slice(0, 5);

    return { counts: { activeCases, wonCases, pendingCases, hearings, highPriorityTasks }, charts: { caseDistribution }, lists: { upcomingHearings, todaysAgenda, recentMovements } };
  }

  async searchGlobal(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    const [clients, cases, tasks] = await Promise.all([this.getClients(), this.getCases(), this.getTasks()]);
    const results: SearchResult[] = [];

    clients.forEach(c => { if (c.name.toLowerCase().includes(lowerQuery)) results.push({ id: c.id, type: 'client', title: c.name, subtitle: c.type === 'PF' ? c.cpf : c.cnpj, url: `/clients/${c.id}` }); });
    cases.forEach(c => { if (c.title.toLowerCase().includes(lowerQuery)) results.push({ id: c.id, type: 'case', title: c.title, subtitle: `CNJ: ${c.cnj}`, url: `/cases/${c.id}` }); });
    tasks.forEach(t => { if (t.title.toLowerCase().includes(lowerQuery)) results.push({ id: t.id, type: 'task', title: t.title, subtitle: t.status, url: '/crm' }); });

    return results.slice(0, 8);
  }

  factoryReset() { localStorage.clear(); window.location.reload(); }
}

export const storageService = new StorageService();
