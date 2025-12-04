
import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, User, CaseMovement, SearchResult, OfficeMember } from '../types';
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
          // NOTA: Não buscamos todos os membros aqui para evitar peso desnecessário na listagem inicial.
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

            // Busca membros (join manual com perfis se necessário, aqui simplificado)
            const { data: membersData, error: memError } = await supabase
                .from(TABLE_NAMES.OFFICE_MEMBERS)
                .select('*')
                .eq('office_id', id);

            if (memError) throw memError;

            // Se tivéssemos uma tabela profiles pública, faríamos o join.
            // Como fallback, usamos dados parciais.
            const members: OfficeMember[] = (membersData || []).map((m: any) => ({
                id: m.id,
                userId: m.user_id,
                name: 'Membro ' + m.user_id.slice(0,4), // Em produção: join profiles
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

          // A trigger 'add_creator_as_admin' no banco cuida de inserir o membro
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

          if (error || !office) throw new Error("Escritório não encontrado.");

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
          
          // Atualizar permissões/roles de membros se necessário seria outra chamada para office_members
      } else {
          const offices = this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
          const idx = offices.findIndex(o => o.id === office.id);
          if (idx >= 0) {
              offices[idx] = office;
              this.setLocal(LOCAL_KEYS.OFFICES, offices);
          }
      }
  }

  async inviteUserToOffice(officeId: string, handle: string): Promise<boolean> { 
      // Placeholder: Em produção, buscaria user por handle e inseriria em office_members
      await new Promise(resolve => setTimeout(resolve, 800));
      return true; 
  }

  // =================================================================================
  // ENTIDADES DE DADOS (Filtradas por officeId)
  // =================================================================================

  // --- CLIENTES ---
  async getClients(): Promise<Client[]> {
      const { officeId } = await this.getUserSession();
      if (!officeId) return [];

      if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.from(TABLE_NAMES.CLIENTS).select('*').eq('office_id', officeId);
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
          }));
      } else {
          const all = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
          return this.filterByOffice(all, officeId);
      }
  }

  async saveClient(client: Client) {
      const { officeId, userId } = await this.getUserSession();
      if (!officeId) throw new Error("Sem escritório selecionado.");
      client.officeId = officeId;

      if (isSupabaseConfigured && supabase) {
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
          const list = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
          const idx = list.findIndex(i => i.id === client.id);
          if (idx >= 0) list[idx] = client;
          else {
              if (!client.id || !client.id.startsWith('cli-')) client.id = `cli-${Date.now()}`;
              list.unshift(client);
          }
          this.setLocal(LOCAL_KEYS.CLIENTS, list);
      }
      this.logActivity(`Salvou cliente: ${client.name}`);
  }

  async deleteClient(id: string) {
      if (isSupabaseConfigured && supabase) {
          await supabase.from(TABLE_NAMES.CLIENTS).delete().eq('id', id);
      } else {
          const list = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
          this.setLocal(LOCAL_KEYS.CLIENTS, list.filter(i => i.id !== id));
      }
      this.logActivity(`Excluiu cliente: ${id}`, 'Warning');
  }

  // --- PROCESSOS (CASES) ---
  async getCases(): Promise<LegalCase[]> {
      const { officeId } = await this.getUserSession();
      if (!officeId) return [];

      if (isSupabaseConfigured && supabase) {
          const { data } = await supabase
            .from(TABLE_NAMES.CASES)
            .select(`*, client:clients!cases_client_id_fkey(*)`)
            .eq('office_id', officeId);
          
          return (data || []).map((item: any) => ({
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
              client: item.client ? {
                  id: item.client.id,
                  name: item.client.name,
                  type: item.client.type,
                  avatarUrl: item.client.avatar_url
              } : { id: 'unknown', name: 'Desconhecido', type: 'PF', avatarUrl: '' }
          })) as LegalCase[];
      } else {
          const all = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
          return this.filterByOffice(all, officeId);
      }
  }

  async getCaseById(id: string): Promise<LegalCase | undefined> {
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

  async saveCase(legalCase: LegalCase) {
      const { officeId, userId } = await this.getUserSession();
      if (!officeId) throw new Error("Sem escritório.");
      legalCase.officeId = officeId;
      legalCase.lastUpdate = new Date().toISOString();

      if (isSupabaseConfigured && supabase) {
          const payload = {
              id: legalCase.id && !legalCase.id.startsWith('case-') ? legalCase.id : undefined,
              office_id: officeId,
              user_id: userId,
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
      } else {
          const list = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
          const idx = list.findIndex(i => i.id === legalCase.id);
          if (idx >= 0) list[idx] = legalCase;
          else {
              if (!legalCase.id || !legalCase.id.startsWith('case-')) legalCase.id = `case-${Date.now()}`;
              list.push(legalCase);
          }
          this.setLocal(LOCAL_KEYS.CASES, list);
      }
      this.logActivity(`Salvou processo: ${legalCase.title}`);
  }

  async deleteCase(id: string) {
      if (isSupabaseConfigured && supabase) {
          await supabase.from(TABLE_NAMES.CASES).delete().eq('id', id);
      } else {
          const list = this.getLocal<LegalCase[]>(LOCAL_KEYS.CASES, []);
          this.setLocal(LOCAL_KEYS.CASES, list.filter(i => i.id !== id));
      }
      this.logActivity(`Excluiu processo: ${id}`, 'Warning');
  }

  // --- TAREFAS ---
  async getTasks(): Promise<Task[]> {
      const { officeId } = await this.getUserSession();
      if (!officeId) return [];

      if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.from(TABLE_NAMES.TASKS).select('*').eq('office_id', officeId);
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
          }));
      } else {
          const all = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
          return this.filterByOffice(all, officeId);
      }
  }

  async getTasksByCaseId(caseId: string): Promise<Task[]> {
      const tasks = await this.getTasks();
      return tasks.filter(t => t.caseId === caseId);
  }

  async saveTask(task: Task) {
      const { officeId, userId } = await this.getUserSession();
      if (!officeId) throw new Error("Sem escritório.");
      task.officeId = officeId;

      if (isSupabaseConfigured && supabase) {
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
          const list = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
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
          await supabase.from(TABLE_NAMES.TASKS).delete().eq('id', id);
      } else {
          const list = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
          this.setLocal(LOCAL_KEYS.TASKS, list.filter(i => i.id !== id));
      }
  }

  // --- FINANCEIRO ---
  async getFinancials(): Promise<FinancialRecord[]> {
      const { officeId } = await this.getUserSession();
      if (!officeId) return [];

      if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.from(TABLE_NAMES.FINANCIAL).select('*').eq('office_id', officeId);
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
          }));
      } else {
          const all = this.getLocal<FinancialRecord[]>(LOCAL_KEYS.FINANCIAL, []);
          return this.filterByOffice(all, officeId);
      }
  }

  async getFinancialsByCaseId(caseId: string): Promise<FinancialRecord[]> {
      const fins = await this.getFinancials();
      return fins.filter(f => f.caseId === caseId);
  }

  async saveFinancial(record: FinancialRecord) {
      const { officeId, userId } = await this.getUserSession();
      if (!officeId) throw new Error("Sem escritório.");
      record.officeId = officeId;

      if (isSupabaseConfigured && supabase) {
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
          const list = this.getLocal<FinancialRecord[]>(LOCAL_KEYS.FINANCIAL, []);
          const idx = list.findIndex(i => i.id === record.id);
          if (idx >= 0) list[idx] = record;
          else {
              if(!record.id) record.id = `trans-${Date.now()}`;
              list.push(record);
          }
          this.setLocal(LOCAL_KEYS.FINANCIAL, list);
      }
  }

  // --- DOCUMENTOS ---
  async getDocuments(): Promise<SystemDocument[]> {
      const { officeId } = await this.getUserSession();
      if (!officeId) return [];

      if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.from(TABLE_NAMES.DOCUMENTS).select('*').eq('office_id', officeId);
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
          }));
      } else {
          const all = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
          return this.filterByOffice(all, officeId);
      }
  }

  async getDocumentsByCaseId(caseId: string): Promise<SystemDocument[]> {
      const docs = await this.getDocuments();
      return docs.filter(d => d.caseId === caseId);
  }

  async saveDocument(docData: SystemDocument) {
      const { officeId, userId } = await this.getUserSession();
      if (!officeId) throw new Error("Sem escritório.");
      docData.officeId = officeId;

      if (isSupabaseConfigured && supabase) {
          const payload = { 
              id: docData.id,
              office_id: officeId,
              user_id: userId,
              name: docData.name,
              size: docData.size,
              type: docData.type,
              date: docData.date,
              category: docData.category,
              case_id: docData.caseId
          };
          const { error } = await supabase.from(TABLE_NAMES.DOCUMENTS).insert([payload]);
          if (error) throw error;
      } else {
          const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
          list.unshift(docData);
          this.setLocal(LOCAL_KEYS.DOCUMENTS, list);
      }
      this.logActivity(`Upload de documento: ${docData.name}`);
  }

  async deleteDocument(id: string) {
      if (isSupabaseConfigured && supabase) {
          await supabase.from(TABLE_NAMES.DOCUMENTS).delete().eq('id', id);
      } else {
          const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
          this.setLocal(LOCAL_KEYS.DOCUMENTS, list.filter(i => i.id !== id));
      }
  }

  // --- UTILS & HELPERS ---

  async saveSmartMovement(caseId: string, movement: CaseMovement, tasks: Task[], doc: SystemDocument) {
      const kase = await this.getCaseById(caseId);
      if (!kase) throw new Error("Processo não encontrado");
      
      // 1. Add movement
      kase.movements = [movement, ...(kase.movements || [])];
      await this.saveCase(kase);

      // 2. Save Tasks
      for (const t of tasks) {
          t.officeId = kase.officeId; // Ensure consistent tenancy
          await this.saveTask(t);
      }

      // 3. Save Document
      doc.officeId = kase.officeId;
      await this.saveDocument(doc);
      
      this.logActivity(`Upload Inteligente no processo: ${kase.title}`);
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
  
  async searchGlobal(q: string): Promise<SearchResult[]> { 
      if (!q || q.length < 2) return [];
      const lower = q.toLowerCase();
      const [clients, cases, tasks] = await Promise.all([this.getClients(), this.getCases(), this.getTasks()]);
      const res: SearchResult[] = [];
      
      clients.forEach(c => {
          if (c.name.toLowerCase().includes(lower)) res.push({ id: c.id, type: 'client', title: c.name, subtitle: c.type === 'PJ' ? c.cnpj : c.cpf, url: `/clients/${c.id}` });
      });
      cases.forEach(c => {
          if (c.title.toLowerCase().includes(lower) || c.cnj.includes(lower)) res.push({ id: c.id, type: 'case', title: c.title, subtitle: c.cnj, url: `/cases/${c.id}` });
      });
      tasks.forEach(t => {
          if (t.title.toLowerCase().includes(lower)) res.push({ id: t.id, type: 'task', title: t.title, subtitle: t.status, url: '/crm' });
      });
      return res.slice(0, 10);
  }

  async deleteAccount() {
    const { userId } = await this.getUserSession();
    if (isSupabaseConfigured && supabase && userId) {
        const tables = [TABLE_NAMES.LOGS, TABLE_NAMES.FINANCIAL, TABLE_NAMES.TASKS, TABLE_NAMES.DOCUMENTS, TABLE_NAMES.CASES, TABLE_NAMES.CLIENTS, TABLE_NAMES.PROFILES];
        for (const table of tables) {
            await supabase.from(table).delete().eq('user_id', userId);
        }
    } else {
        localStorage.clear();
    }
  }
  
  factoryReset() { localStorage.clear(); window.location.reload(); }

  async seedDatabase() {
      if (!isSupabaseConfigured) {
          const offices = this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
          if(offices.length === 0) {
              this.setLocal(LOCAL_KEYS.OFFICES, MOCK_OFFICES_DATA);
              this.setLocal(LOCAL_KEYS.CLIENTS, MOCK_CLIENTS);
              this.setLocal(LOCAL_KEYS.CASES, MOCK_CASES);
              this.setLocal(LOCAL_KEYS.TASKS, MOCK_TASKS);
              this.setLocal(LOCAL_KEYS.FINANCIAL, MOCK_FINANCIALS);
          }
      }
  }

  async checkRealtimeAlerts() {
      // Placeholder for poller implementation if needed
  }
}

export const storageService = new StorageService();
