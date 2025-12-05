
import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, User, CaseMovement, SearchResult, OfficeMember, ExtractedMovementData } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { notificationService } from './notificationService';
import { syncQueueService } from './syncQueue';
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
  // ESCRITÓRIOS (OFFICES) - RELACIONAL
  // =================================================================================

  async getOffices(): Promise<Office[]> {
    if (isSupabaseConfigured && supabase) {
      try {
          const session = await this.getUserSession();
          if (!session.userId) return [];

          // 1. Busca os memberships do usuário
          // Usamos isso para filtrar quais escritórios o usuário pode ver
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

          // 2. Mapeia o resultado.
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
                  // Inclui o usuário atual como membro para validação de permissão no frontend
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
            // Busca dados do escritório
            const { data: office, error: offError } = await supabase
                .from(TABLE_NAMES.OFFICES)
                .select('*')
                .eq('id', id)
                .single();
            
            if (offError || !office) return undefined;

            // Busca membros
            const { data: membersData, error: memError } = await supabase
                .from(TABLE_NAMES.OFFICE_MEMBERS)
                .select('*')
                .eq('office_id', id);

            if (memError) throw memError;

            // Fallback para mapeamento de membros
            const members: OfficeMember[] = (membersData || []).map((m: any) => ({
                id: m.id,
                userId: m.user_id,
                name: 'Membro', // Em produção faria join com profiles
                email: '...', 
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
          // Local Mock
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

          // 1. Buscar ID do escritório
          const { data: office, error } = await supabase
              .from(TABLE_NAMES.OFFICES)
              .select('id, name, owner_id')
              .eq('handle', handle)
              .single();

          if (error || !office) throw new Error("Escritório não encontrado ou acesso restrito.");

          // 2. Inserir Membership
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
     // Here you would implement logic to find the user by handle and add them to office members
     return true; 
  }

  // =================================================================================
  // CLIENTES
  // =================================================================================

  async getClients(): Promise<Client[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const session = await this.getUserSession();
        if (!session.officeId) return []; // Tenancy: Must be in an office

        const { data, error } = await supabase
          .from(TABLE_NAMES.CLIENTS)
          .select('*')
          .eq('office_id', session.officeId)
          .order('name');
        
        if (error) throw error;
        
        return (data || []).map((c: any) => ({
            id: c.id,
            officeId: c.office_id,
            name: c.name,
            type: c.type,
            status: c.status,
            email: c.email,
            phone: c.phone,
            city: c.city,
            state: c.state,
            address: c.address || '', // Added address
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
    } else {
      const session = await this.getUserSession();
      const all = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, MOCK_CLIENTS);
      // Demo mode: Return all or filter by mock office
      return session.officeId ? this.filterByOffice(all, session.officeId) : all;
    }
  }
  
  async saveClient(client: Client) {
    const session = await this.getUserSession();
    
    if (isSupabaseConfigured && supabase) {
      if (!session.userId || !session.officeId) throw new Error("Sessão de escritório inválida.");
      
      const payload = {
          id: client.id && !client.id.startsWith('cli-') ? client.id : undefined, // Let DB gen UUID if new
          office_id: session.officeId,
          user_id: session.userId,
          name: client.name,
          type: client.type,
          status: client.status,
          email: client.email,
          phone: client.phone,
          city: client.city,
          state: client.state,
          address: client.address, // Added address
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

      this.logActivity(`Salvou cliente: ${client.name}`);
    } else {
      const list = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
      const idx = list.findIndex(i => i.id === client.id);
      
      // Ensure officeId is set in demo mode
      client.officeId = session.officeId || 'office-1';

      if (idx >= 0) {
          list[idx] = client;
      } else {
          if (!client.id) client.id = `cli-${Date.now()}`;
          list.unshift(client);
      }
      this.setLocal(LOCAL_KEYS.CLIENTS, list);
      this.logActivity(`Salvou cliente: ${client.name}`);
    }
  }

  async deleteClient(id: string) {
    // Check constraints locally or rely on DB FK constraints
    if (isSupabaseConfigured && supabase) {
      const session = await this.getUserSession();
      if (!session.officeId) return;
      await supabase.from(TABLE_NAMES.CLIENTS).delete().eq('id', id).eq('office_id', session.officeId);
    } else {
      const list = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
      this.setLocal(LOCAL_KEYS.CLIENTS, list.filter(i => i.id !== id));
    }
    this.logActivity(`Excluiu cliente ID: ${id}`, 'Warning');
  }

  // =================================================================================
  // PROCESSOS (CASES)
  // =================================================================================

  async getCases(): Promise<LegalCase[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const session = await this.getUserSession();
        if (!session.officeId) return [];

        const { data, error } = await supabase
          .from(TABLE_NAMES.CASES)
          .select(`
            *,
            client:clients!cases_client_id_fkey(*)
          `)
          .eq('office_id', session.officeId);
        if (error) throw error;
        
        return (data || []).map((item: any) => {
          const clientData = item.client;
          const mappedClient = clientData ? {
              id: clientData.id,
              name: clientData.name,
              type: clientData.type,
              avatarUrl: clientData.avatar_url
          } : { id: 'unknown', name: 'Cliente Desconhecido', type: 'PF', avatarUrl: '' };

          return {
            id: item.id,
            officeId: item.office_id,
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
        }) as LegalCase[];
      } catch (e) { 
        console.error("Supabase Error (getCases):", e); 
        return []; 
      }
    } else {
      const session = await this.getUserSession();
      const all = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, MOCK_CASES);
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

  async saveCase(legalCase: LegalCase) {
    const session = await this.getUserSession();
    legalCase.lastUpdate = new Date().toISOString();
    
    if (isSupabaseConfigured && supabase) {
      if (!session.officeId) throw new Error("Sessão inválida.");
      
      const payload: any = {
        id: legalCase.id && !legalCase.id.startsWith('case-') ? legalCase.id : undefined,
        office_id: session.officeId,
        user_id: session.userId,
        client_id: legalCase.client.id,
        cnj: legalCase.cnj,
        title: legalCase.title,
        status: legalCase.status,
        category: legalCase.category,
        phase: legalCase.phase,
        value: legalCase.value,
        responsible_lawyer: legalCase.responsibleLawyer,
        court: legalCase.court,
        next_hearing: legalCase.nextHearing,
        description: legalCase.description,
        movements: legalCase.movements,
        change_log: legalCase.changeLog,
        last_update: legalCase.lastUpdate
      };
      
      const { error } = await supabase.from(TABLE_NAMES.CASES).upsert(payload);
      if (error) throw error;

      this.logActivity(`Salvou processo: ${legalCase.title}`);
    } else {
      const list = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
      
      // Force officeId
      legalCase.officeId = session.officeId || 'office-1';

      const idx = list.findIndex(i => i.id === legalCase.id);
      if (idx >= 0) {
          list[idx] = legalCase;
      } else {
          if (!legalCase.id) legalCase.id = `case-${Date.now()}`;
          list.push(legalCase);
      }
      this.setLocal(LOCAL_KEYS.CASES, list);
      this.logActivity(`Salvou processo: ${legalCase.title}`);
    }
  }

  async saveSmartMovement(caseId: string, movement: CaseMovement, tasks: Task[], doc: SystemDocument) {
      // Get current case
      const currentCase = await this.getCaseById(caseId);
      if (!currentCase) throw new Error("Processo não encontrado");

      // Update movements
      const updatedMovements = [movement, ...(currentCase.movements || [])];
      
      // Save Case
      await this.saveCase({ ...currentCase, movements: updatedMovements });

      // Save Tasks
      for (const t of tasks) {
          await this.saveTask(t);
      }

      // Save Doc
      await this.saveDocument(doc);

      this.logActivity(`Upload Inteligente no processo: ${currentCase.title}`);
  }

  async deleteCase(id: string) {
    if (isSupabaseConfigured && supabase) {
      const session = await this.getUserSession();
      if (!session.officeId) return;
      await supabase.from(TABLE_NAMES.CASES).delete().eq('id', id).eq('office_id', session.officeId);
    } else {
      const list = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
      this.setLocal(LOCAL_KEYS.CASES, list.filter(i => i.id !== id));
    }
    this.logActivity(`Excluiu processo ID: ${id}`, 'Warning');
  }

  // =================================================================================
  // TAREFAS (TASKS)
  // =================================================================================

  async getTasks(): Promise<Task[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const session = await this.getUserSession();
        if (!session.officeId) return [];
        const { data } = await supabase.from(TABLE_NAMES.TASKS).select('*').eq('office_id', session.officeId);
        return (data || []).map((t: any) => ({
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
            clientName: t.client_name,
            userId: t.user_id
        })) as Task[];
      } catch { return []; }
    } else {
      const session = await this.getUserSession();
      const all = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, MOCK_TASKS);
      return session.officeId ? this.filterByOffice(all, session.officeId) : all;
    }
  }

  async getTasksByCaseId(caseId: string): Promise<Task[]> {
    const tasks = await this.getTasks();
    return tasks.filter(t => t.caseId === caseId);
  }
  
  async saveTask(task: Task) {
    const session = await this.getUserSession();
    
    if (isSupabaseConfigured && supabase) {
      if (!session.officeId) throw new Error("Sessão inválida.");
      const payload = { 
          id: task.id && !task.id.startsWith('task-') ? task.id : undefined,
          office_id: session.officeId,
          user_id: session.userId,
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
      const list = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
      task.officeId = session.officeId || 'office-1';
      
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
      const session = await this.getUserSession();
      if (!session.officeId) return;
      await supabase.from(TABLE_NAMES.TASKS).delete().eq('id', id).eq('office_id', session.officeId);
    } else {
      const list = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
      this.setLocal(LOCAL_KEYS.TASKS, list.filter(i => i.id !== id));
    }
  }

  // =================================================================================
  // FINANCEIRO
  // =================================================================================

  async getFinancials(): Promise<FinancialRecord[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const session = await this.getUserSession();
        if (!session.officeId) return [];
        const { data } = await supabase.from(TABLE_NAMES.FINANCIAL).select('*').eq('office_id', session.officeId);
        return (data || []).map((f: any) => ({
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
            installment: f.installment,
            userId: f.user_id
        })) as FinancialRecord[];
      } catch { return []; }
    } else {
      const session = await this.getUserSession();
      const all = this.getLocal<FinancialRecord[]>(LOCAL_KEYS.FINANCIAL, MOCK_FINANCIALS);
      return session.officeId ? this.filterByOffice(all, session.officeId) : all;
    }
  }

  async getFinancialsByCaseId(caseId: string): Promise<FinancialRecord[]> {
    const fins = await this.getFinancials();
    return fins.filter(f => f.caseId === caseId);
  }
  
  async saveFinancial(record: FinancialRecord) {
    const session = await this.getUserSession();
    
    if (isSupabaseConfigured && supabase) {
      if (!session.officeId) throw new Error("Sessão inválida.");
      const payload = {
          id: record.id && !record.id.startsWith('trans-') ? record.id : undefined,
          office_id: session.officeId,
          user_id: session.userId,
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
      const list = this.getLocal<FinancialRecord[]>(LOCAL_KEYS.FINANCIAL, []);
      record.officeId = session.officeId || 'office-1';

      const idx = list.findIndex(i => i.id === record.id);
      if (idx >= 0) list[idx] = record;
      else {
          if(!record.id) record.id = `trans-${Date.now()}`;
          list.push(record);
      }
      this.setLocal(LOCAL_KEYS.FINANCIAL, list);
    }
  }

  // =================================================================================
  // DOCUMENTOS
  // =================================================================================

  async getDocuments(): Promise<SystemDocument[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const session = await this.getUserSession();
        if (!session.officeId) return [];
        const { data } = await supabase.from(TABLE_NAMES.DOCUMENTS).select('*').eq('office_id', session.officeId);
        return (data || []).map((d: any) => ({
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
      } catch { return []; }
    } else {
      const session = await this.getUserSession();
      const all = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
      return session.officeId ? this.filterByOffice(all, session.officeId) : all;
    }
  }

  async getDocumentsByCaseId(caseId: string): Promise<SystemDocument[]> {
    const docs = await this.getDocuments();
    return docs.filter(d => d.caseId === caseId);
  }

  async saveDocument(docData: SystemDocument) {
    const session = await this.getUserSession();
    
    if (isSupabaseConfigured && supabase) {
      if (!session.officeId) throw new Error("Sessão inválida.");
      const payload = { 
          id: docData.id && !docData.id.startsWith('doc-') ? docData.id : undefined,
          office_id: session.officeId,
          user_id: session.userId,
          name: docData.name,
          size: docData.size,
          type: docData.type,
          date: docData.date,
          category: docData.category,
          case_id: docData.caseId
      };
      await supabase.from(TABLE_NAMES.DOCUMENTS).insert([payload]);
    } else {
      const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
      docData.officeId = session.officeId || 'office-1';
      list.unshift(docData);
      this.setLocal(LOCAL_KEYS.DOCUMENTS, list);
    }
    this.logActivity(`Upload de documento: ${docData.name}`);
  }

  async deleteDocument(id: string) {
    if (isSupabaseConfigured && supabase) {
      const session = await this.getUserSession();
      if (!session.officeId) return;
      await supabase.from(TABLE_NAMES.DOCUMENTS).delete().eq('id', id).eq('office_id', session.officeId);
    } else {
      const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
      this.setLocal(LOCAL_KEYS.DOCUMENTS, list.filter(i => i.id !== id));
    }
  }

  // =================================================================================
  // UTILS & GLOBAL
  // =================================================================================

  async deleteAccount() {
    const session = await this.getUserSession();
    
    if (isSupabaseConfigured && supabase) {
      if (!session.userId) return;
      
      // Cascading deletes handled by RLS/DB usually, but explicit cleaning is good practice if policies allow
      // In a real app, you would call an RPC to soft-delete the user
      // For this demo structure, we assume we want to clear related data
      
      // NOT IMPLEMENTED: Hard delete of user in Supabase Auth requires Admin API
      console.warn("Account deletion in Supabase requires Admin privileges.");
      
    } else {
      localStorage.clear();
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
      if (isSupabaseConfigured && supabase) {
          this.getUserSession().then(s => {
              if (s.userId) {
                  supabase!.from(TABLE_NAMES.PROFILES).update({ settings }).eq('id', s.userId);
              }
          });
      }
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

  async seedDatabase() {
    if (!this.getLocal(LOCAL_KEYS.CLIENTS, null)) {
        // Initial Seed for Demo
        this.setLocal(LOCAL_KEYS.CLIENTS, MOCK_CLIENTS);
        this.setLocal(LOCAL_KEYS.CASES, MOCK_CASES);
        this.setLocal(LOCAL_KEYS.TASKS, MOCK_TASKS);
        this.setLocal(LOCAL_KEYS.FINANCIAL, MOCK_FINANCIALS);
        this.setLocal(LOCAL_KEYS.OFFICES, MOCK_OFFICES_DATA);
    }
  }

  async checkRealtimeAlerts() {
    const lastCheck = localStorage.getItem(LOCAL_KEYS.LAST_CHECK);
    const today = new Date();
    const todayStr = today.toDateString();

    // Prevent spam: Check once per session/day or on explicit refresh
    // For demo purposes, we allow checking if 5 minutes passed
    const lastCheckTime = lastCheck ? parseInt(lastCheck) : 0;
    if (Date.now() - lastCheckTime < 5 * 60 * 1000) return;

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

    let alertsCount = 0;

    for (const task of tasks) {
        if (task.status !== 'Concluído' && isDate(task.dueDate, tomorrow)) {
            notificationService.notify('Prazo de Tarefa Próximo', `A tarefa "${task.title}" vence amanhã (${task.dueDate}).`, 'warning');
            alertsCount++;
        }
    }

    for (const legalCase of cases) {
        if (legalCase.status === CaseStatus.ACTIVE && legalCase.nextHearing && isDate(legalCase.nextHearing, tomorrow)) {
            notificationService.notify('Audiência Amanhã', `Audiência do processo "${legalCase.title}" agendada para amanhã.`, 'warning');
            alertsCount++;
        }
    }

    localStorage.setItem(LOCAL_KEYS.LAST_CHECK, Date.now().toString());
  }
  
  factoryReset() {
    localStorage.clear();
    window.location.reload();
  }
}

export const storageService = new StorageService();
