
import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings, Office, DashboardData, CaseStatus, User, CaseMovement, SearchResult, OfficeMember } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { notificationService } from './notificationService';

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

  // --- Clientes ---
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
        })) as Client[];
      } catch (error) { 
        console.error("Supabase Error (getClients):", error); 
        return []; 
      }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.CLIENTS) || '[]');
    }
  }
  
  async saveClient(client: Client) {
    const userId = await this.getUserId();

    if (isSupabaseConfigured && supabase) {
      if (!userId) throw new Error("Usuário não autenticado");
      
      const payload = {
          id: client.id && !client.id.startsWith('cli-') ? client.id : undefined,
          user_id: userId,
          office_id: client.officeId, // Ensure officeId is passed
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
      this.logActivity(`Salvou cliente: ${client.name}`);
    } else {
      const list = await this.getClients();
      const idx = list.findIndex(i => i.id === client.id);
      if (idx >= 0) {
          list[idx] = client;
      } else {
          if (!client.id || client.id.startsWith('cli-')) client.id = `cli-${Date.now()}`;
          list.unshift({ ...client, userId: userId || 'local' });
      }
      localStorage.setItem(LOCAL_KEYS.CLIENTS, JSON.stringify(list));
      this.logActivity(`Salvou cliente: ${client.name}`);
    }
  }

  async deleteClient(id: string) {
    const cases = await this.getCases();
    const hasActiveCases = cases.some(c => c.client.id === id && c.status !== CaseStatus.ARCHIVED);
    
    if (hasActiveCases) {
        throw new Error("BLOQUEIO: Não é possível excluir este cliente pois ele possui processos ativos.");
    }

    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      if (!userId) return;
      await supabase.from(TABLE_NAMES.CLIENTS).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getClients();
      localStorage.setItem(LOCAL_KEYS.CLIENTS, JSON.stringify(list.filter(i => i.id !== id)));
    }
    this.logActivity(`Excluiu cliente ID: ${id}`, 'Warning');
  }

  // --- Processos (Cases) ---
  async getCases(): Promise<LegalCase[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return [];

        const { data, error } = await supabase
          .from(TABLE_NAMES.CASES)
          .select(`
            *,
            client:clients!cases_client_id_fkey(*)
          `)
          .eq('user_id', userId);
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
        });

        return mappedData as LegalCase[];
      } catch (e) { 
        console.error("Supabase Error (getCases):", e); 
        return []; 
      }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.CASES) || '[]');
    }
  }

  async getCaseById(id: string): Promise<LegalCase | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return null;

        const { data, error } = await supabase
          .from(TABLE_NAMES.CASES)
          .select(`*, client:clients!cases_client_id_fkey(*)`)
          .eq('id', id)
          .eq('user_id', userId)
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
    const userId = await this.getUserId();
    legalCase.lastUpdate = new Date().toISOString();
    
    if (isSupabaseConfigured && supabase) {
      if (!userId) throw new Error("Usuário não autenticado");
      
      const payload: any = {
        id: legalCase.id && !legalCase.id.startsWith('case-') ? legalCase.id : undefined,
        user_id: userId,
        office_id: legalCase.officeId, // Ensure officeId is passed
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
      
      if (legalCase.id && !legalCase.id.startsWith('case-')) {
        await supabase.from(TABLE_NAMES.CASES).upsert(payload);
      } else {
        await supabase.from(TABLE_NAMES.CASES).insert([payload]);
      }
      this.logActivity(`Salvou processo: ${legalCase.title}`);
    } else {
      const list = await this.getCases();
      const idx = list.findIndex(i => i.id === legalCase.id);
      if (idx >= 0) {
          list[idx] = legalCase;
      } else {
          if (!legalCase.id || legalCase.id.startsWith('case-')) legalCase.id = `case-${Date.now()}`;
          list.push({ ...legalCase, userId: userId || 'local' });
      }
      localStorage.setItem(LOCAL_KEYS.CASES, JSON.stringify(list));
      this.logActivity(`Salvou processo: ${legalCase.title}`);
    }
  }

  async deleteCase(id: string) {
    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      if (!userId) return;
      await supabase.from(TABLE_NAMES.CASES).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getCases();
      localStorage.setItem(LOCAL_KEYS.CASES, JSON.stringify(list.filter(i => i.id !== id)));
    }
    this.logActivity(`Excluiu processo ID: ${id}`, 'Warning');
  }

  // --- Tarefas ---
  async getTasks(): Promise<Task[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return [];
        const { data } = await supabase.from(TABLE_NAMES.TASKS).select('*').eq('user_id', userId);
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
            clientName: t.client_name
        })) as Task[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.TASKS) || '[]');
    }
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
          id: task.id && !task.id.startsWith('task-') ? task.id : undefined,
          user_id: userId,
          office_id: task.officeId, // Ensure officeId
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
      if (task.id && !task.id.startsWith('task-')) {
        await supabase.from(TABLE_NAMES.TASKS).upsert(payload);
      } else {
        await supabase.from(TABLE_NAMES.TASKS).insert([payload]);
      }
    } else {
      const list = await this.getTasks();
      const idx = list.findIndex(i => i.id === task.id);
      if (idx >= 0) list[idx] = task;
      else {
          if(!task.id || task.id.startsWith('task-')) task.id = `task-${Date.now()}`;
          list.push(task);
      }
      localStorage.setItem(LOCAL_KEYS.TASKS, JSON.stringify(list));
    }
  }
  
  async deleteTask(id: string) {
    if (isSupabaseConfigured && supabase) {
      const userId = await this.getUserId();
      if (!userId) return;
      await supabase.from(TABLE_NAMES.TASKS).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getTasks();
      localStorage.setItem(LOCAL_KEYS.TASKS, JSON.stringify(list.filter(i => i.id !== id)));
    }
  }

  // --- Financeiro ---
  async getFinancials(): Promise<FinancialRecord[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return [];
        const { data } = await supabase.from(TABLE_NAMES.FINANCIAL).select('*').eq('user_id', userId);
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
            installment: f.installment
        })) as FinancialRecord[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.FINANCIAL) || '[]');
    }
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
          id: record.id && !record.id.startsWith('trans-') ? record.id : undefined,
          user_id: userId,
          office_id: record.officeId,
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
      if (record.id && !record.id.startsWith('trans-')) {
        await supabase.from(TABLE_NAMES.FINANCIAL).upsert(payload);
      } else {
        await supabase.from(TABLE_NAMES.FINANCIAL).insert([payload]);
      }
    } else {
      const list = await this.getFinancials();
      const idx = list.findIndex(i => i.id === record.id);
      if (idx >= 0) list[idx] = record;
      else {
          if(!record.id || record.id.startsWith('trans-')) record.id = `trans-${Date.now()}`;
          list.push(record);
      }
      localStorage.setItem(LOCAL_KEYS.FINANCIAL, JSON.stringify(list));
    }
  }

  // --- Documentos ---
  async getDocuments(): Promise<SystemDocument[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return [];
        const { data } = await supabase.from(TABLE_NAMES.DOCUMENTS).select('*').eq('user_id', userId);
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
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.DOCUMENTS) || '[]');
    }
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
          id: docData.id && !docData.id.startsWith('doc-') ? docData.id : undefined,
          user_id: userId,
          office_id: docData.officeId, // Ensure officeId
          name: docData.name,
          size: docData.size,
          type: docData.type,
          date: docData.date,
          category: docData.category,
          case_id: docData.caseId
      };
      await supabase.from(TABLE_NAMES.DOCUMENTS).insert([payload]);
    } else {
      const list = await this.getDocuments();
      list.unshift({ ...docData, userId: userId || 'local' });
      localStorage.setItem(LOCAL_KEYS.DOCUMENTS, JSON.stringify(list));
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
      localStorage.setItem(LOCAL_KEYS.DOCUMENTS, JSON.stringify(list.filter(i => i.id !== id)));
    }
  }

  // --- Escritórios (Office Management) ---
  
  // FIX: Leitura de escritório deve fazer JOIN com members para popular a lista
  async getOffices(): Promise<Office[]> {
    if (isSupabaseConfigured && supabase) {
      try {
          // Select offices, and join with office_members to get the members array
          // Also join profiles inside office_members to get member details
          const { data, error } = await supabase
            .from(TABLE_NAMES.OFFICES)
            .select(`
                *,
                members:office_members (
                    user_id,
                    role,
                    permissions,
                    status,
                    joined_at,
                    profile:profiles (
                        full_name,
                        email,
                        avatar_url
                    )
                )
            `);
            
          if (error) throw error;

          return (data || []).map((o: any) => ({
              id: o.id,
              name: o.name,
              handle: o.handle,
              location: o.location,
              ownerId: o.owner_id,
              logoUrl: o.logo_url,
              createdAt: o.created_at,
              areaOfActivity: o.area_of_activity,
              // Map nested relational data back to flat OfficeMember structure
              members: (o.members || []).map((m: any) => ({
                  userId: m.user_id,
                  role: m.role,
                  permissions: m.permissions,
                  status: m.status,
                  joinedAt: m.joined_at,
                  name: m.profile?.full_name || 'Usuário',
                  email: m.profile?.email,
                  avatarUrl: m.profile?.avatar_url
              }))
          }));
      } catch (e) {
          console.error("Error fetching offices:", e);
          return [];
      }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.OFFICES) || '[]');
    }
  }

  async getOfficeById(id: string): Promise<Office | undefined> {
    if (isSupabaseConfigured && supabase) {
       try {
           const { data, error } = await supabase
             .from(TABLE_NAMES.OFFICES)
             .select(`
                *,
                members:office_members (
                    user_id,
                    role,
                    permissions,
                    status,
                    joined_at,
                    profile:profiles (
                        full_name,
                        email,
                        avatar_url
                    )
                )
             `)
             .eq('id', id)
             .single();
             
           if (error || !data) return undefined;
           
           return {
              id: data.id,
              name: data.name,
              handle: data.handle,
              location: data.location,
              ownerId: data.owner_id,
              logoUrl: data.logo_url,
              createdAt: data.created_at,
              areaOfActivity: data.area_of_activity,
              members: (data.members || []).map((m: any) => ({
                  userId: m.user_id,
                  role: m.role,
                  permissions: m.permissions,
                  status: m.status,
                  joinedAt: m.joined_at,
                  name: m.profile?.full_name || 'Usuário',
                  email: m.profile?.email,
                  avatarUrl: m.profile?.avatar_url
              }))
           };
       } catch { return undefined; }
    }
    const offices = await this.getOffices();
    return offices.find(o => o.id === id);
  }
  
  async saveOffice(office: Office): Promise<void> {
    if (isSupabaseConfigured && supabase) {
        const payload = {
            id: office.id,
            name: office.name,
            handle: office.handle,
            location: office.location,
            owner_id: office.ownerId,
            logo_url: office.logoUrl,
            created_at: office.createdAt,
            area_of_activity: office.areaOfActivity,
            // members: excluded here, updated via separate calls if needed
            social: office.social
        };
        
        await supabase.from(TABLE_NAMES.OFFICES).upsert(payload);
        this.logActivity(`Atualizou escritório: ${office.name}`);
    } else {
        const offices = await this.getOffices();
        const index = offices.findIndex(o => o.id === office.id);
        if (index >= 0) {
          offices[index] = office;
          localStorage.setItem(LOCAL_KEYS.OFFICES, JSON.stringify(offices));
          this.logActivity(`Atualizou dados do escritório: ${office.name}`);
        }
    }
  }

  async createOffice(officeData: Partial<Office>, explicitOwnerId?: string, userData?: any): Promise<Office> {
    const userId = explicitOwnerId || await this.getUserId();
    if (!userId) throw new Error("Usuário não autenticado para criar escritório");

    let userDetails = userData;
    if (!userDetails) {
        const userStr = localStorage.getItem('@JurisControl:user');
        userDetails = userStr ? JSON.parse(userStr) : { name: 'Admin', email: '', avatar: '' };
    }

    let handle = officeData.handle?.toLowerCase().replace(/[^a-z0-9_@]/g, '') || `@office${Date.now()}`;
    if (!handle.startsWith('@')) handle = '@' + handle;

    const newOffice: Office = {
        id: `office-${Date.now()}`,
        name: officeData.name || 'Novo Escritório',
        handle: handle,
        location: officeData.location || 'Brasil',
        ownerId: userId,
        members: [{
            userId: userId,
            name: userDetails?.name || 'Admin',
            email: userDetails?.email || '',
            avatarUrl: userDetails?.avatar || '',
            role: 'Admin',
            permissions: { financial: true, cases: true, documents: true, settings: true },
            status: 'active'
        }],
        createdAt: new Date().toISOString(),
        social: {}
    };

    if (isSupabaseConfigured && supabase) {
        try {
            // FIX: Removed 'members' from the DB payload.
            // The trigger 'add_creator_as_admin' on the DB side will automatically 
            // insert the owner into the 'office_members' table.
            const dbOffice = {
                name: newOffice.name,
                handle: newOffice.handle,
                location: newOffice.location,
                owner_id: newOffice.ownerId,
                // members: newOffice.members // REMOVED to fix PGRST204
            };
            
            const { data: officeDataDB, error: officeError } = await supabase.from(TABLE_NAMES.OFFICES).insert(dbOffice).select().single();
            
            if(officeError) {
                if (officeError.code === '23505') throw new Error("Este identificador (@handle) já está em uso.");
                throw officeError;
            }
            
            return { 
                ...newOffice, 
                id: officeDataDB.id,
                createdAt: officeDataDB.created_at
            };
        } catch (e: any) {
            console.error("Create Office Error:", e);
            throw new Error(e.message || "Erro ao criar escritório.");
        }
    } else {
        const offices = await this.getOffices();
        if (offices.some(o => o.handle.toLowerCase() === handle.toLowerCase())) {
          throw new Error("Este identificador de escritório (@handle) já está em uso.");
        }
        localStorage.setItem(LOCAL_KEYS.OFFICES, JSON.stringify([...offices, newOffice]));
        this.logActivity(`Criou novo escritório: ${newOffice.name}`);
        return newOffice;
    }
  }

  async joinOffice(officeHandle: string): Promise<Office> {
    if (isSupabaseConfigured && supabase) {
        const { data: office, error } = await supabase.from(TABLE_NAMES.OFFICES).select('*').eq('handle', officeHandle).single();
        
        if (error || !office) throw new Error("Escritório não encontrado ou acesso restrito.");

        const userId = await this.getUserId();
        if (!userId) throw new Error("Usuário não autenticado para entrar em escritório");

        // Verifique se já é membro consultando office_members
        const { data: existingMember } = await supabase
            .from(TABLE_NAMES.OFFICE_MEMBERS)
            .select('*')
            .eq('office_id', office.id)
            .eq('user_id', userId)
            .single();

        if (existingMember) {
             return this.getOfficeById(office.id) as Promise<Office>;
        }

        // FIX: Insert into 'office_members' table instead of updating 'offices' table
        const { error: insertError } = await supabase
            .from(TABLE_NAMES.OFFICE_MEMBERS)
            .insert({
                office_id: office.id,
                user_id: userId,
                role: 'Advogado',
                permissions: { financial: false, cases: true, documents: true, settings: false },
                status: 'pending' // Aguardando aprovação
            });
            
        if (insertError) throw insertError;

        this.logActivity(`Solicitou entrada no escritório: ${office.name}`);
        return this.getOfficeById(office.id) as Promise<Office>;

    } else {
        const offices = await this.getOffices();
        const targetOffice = offices.find(o => o.handle.toLowerCase() === officeHandle.toLowerCase());
        if (!targetOffice) throw new Error("Escritório não encontrado com este identificador.");

        const userId = await this.getUserId();
        const userStr = localStorage.getItem('@JurisControl:user');
        const user = userStr ? JSON.parse(userStr) : { name: 'Novo Membro', email: '', avatar: '' };
        
        if (!targetOffice.members.some(m => m.userId === userId)) {
           targetOffice.members.push({
             userId: userId || 'local',
             name: user?.name || 'Novo Membro',
             email: user?.email || '',
             avatarUrl: user?.avatar || '',
             role: 'Advogado',
             permissions: { financial: false, cases: true, documents: true, settings: false },
             status: 'pending'
           });
           const updatedOffices = offices.map(o => o.id === targetOffice.id ? targetOffice : o);
           localStorage.setItem(LOCAL_KEYS.OFFICES, JSON.stringify(updatedOffices));
           this.logActivity(`Solicitou entrada no escritório: ${targetOffice.name}`);
        }
        return targetOffice;
    }
  }

  async approveMember(officeId: string, userId: string): Promise<void> {
      if (isSupabaseConfigured && supabase) {
          // FIX: Update 'office_members' table
          await supabase
            .from(TABLE_NAMES.OFFICE_MEMBERS)
            .update({ status: 'active' })
            .match({ office_id: officeId, user_id: userId });
      } else {
          const offices = await this.getOffices();
          const office = offices.find(o => o.id === officeId);
          if (office) {
              const member = office.members.find(m => m.userId === userId);
              if (member) member.status = 'active';
              localStorage.setItem(LOCAL_KEYS.OFFICES, JSON.stringify(offices));
          }
      }
  }

  async rejectMember(officeId: string, userId: string): Promise<void> {
      await this.removeMemberFromOffice(officeId, userId);
  }

  async removeMemberFromOffice(officeId: string, memberId: string) {
      if (isSupabaseConfigured && supabase) {
          // FIX: Delete from 'office_members' table
          await supabase
            .from(TABLE_NAMES.OFFICE_MEMBERS)
            .delete()
            .match({ office_id: officeId, user_id: memberId });
      } else {
          const offices = await this.getOffices();
          const office = offices.find(o => o.id === officeId);
          if (office) {
              office.members = office.members.filter(m => m.userId !== memberId);
              localStorage.setItem(LOCAL_KEYS.OFFICES, JSON.stringify(offices));
          }
      }
  }

  async inviteUserToOffice(officeId: string, userHandle: string): Promise<boolean> {
     if (!userHandle.includes('@')) throw new Error("Informe e-mail ou @usuario.");
     await new Promise(resolve => setTimeout(resolve, 800));
     // Here you would implement logic to find the user by handle and add them to office members
     return true; 
  }

  // --- System Maintenance ---

  async checkAccountStatus(userId: string): Promise<{ deleted_at?: string }> {
    if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.from(TABLE_NAMES.PROFILES).select('deleted_at').eq('id', userId).single();
        return data || {};
    }
    return {};
  }

  async reactivateAccount() {
    if (isSupabaseConfigured && supabase) {
        const userId = await this.getUserId();
        if(userId) await supabase.from(TABLE_NAMES.PROFILES).update({ deleted_at: null }).eq('id', userId);
    }
  }

  async ensureProfileExists() {
    const userId = await this.getUserId();
    if (isSupabaseConfigured && supabase && userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const updates = {
                id: user.id,
                full_name: user.user_metadata.full_name || user.user_metadata.name,
                email: user.email,
                username: user.user_metadata.username,
                avatar_url: user.user_metadata.avatar_url
            };
            await supabase.from(TABLE_NAMES.PROFILES).upsert(updates, { onConflict: 'id' });
        }
    }
  }

  async deleteAccount() {
    const userId = await this.getUserId();
    
    if (isSupabaseConfigured && supabase) {
      if (!userId) return;
      // In production, calling the RPC function 'delete_own_account' is safer/better
      // await supabase.rpc('delete_own_account');
      // For now, attempting cascading delete or soft delete logic manually if RPC not available
      const tables = [TABLE_NAMES.PROFILES]; 
      for (const table of tables) {
        try {
            await supabase.from(table).delete().eq('id', userId);
        } catch (e) {
            console.error(`Error deleting from ${table}`, e);
        }
      }
    } else {
      localStorage.clear();
    }
  }

  // --- Utils & Logs ---
  getLogs(): ActivityLog[] { 
    try { return JSON.parse(localStorage.getItem(LOCAL_KEYS.LOGS) || '[]'); } catch { return []; }
  }
  
  logActivity(action: string, status: 'Success' | 'Failed' | 'Warning' = 'Success') {
    if (isSupabaseConfigured && supabase) {
        this.getUserId().then(uid => {
            if (uid) {
                supabase!.from(TABLE_NAMES.LOGS).insert([{
                    user_id: uid,
                    action,
                    status,
                    device: navigator.userAgent,
                    ip: 'IP_PLACEHOLDER',
                    date: new Date().toLocaleString('pt-BR')
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
        localStorage.setItem(LOCAL_KEYS.LOGS, JSON.stringify(logs.slice(0, 50)));
    }
  }

  getSettings(): AppSettings {
      try {
          const s = localStorage.getItem(LOCAL_KEYS.SETTINGS);
          const parsed = s ? JSON.parse(s) : {};
          
          return {
            general: parsed.general || { language: 'pt-BR', dateFormat: 'DD/MM/YYYY', compactMode: false, dataJudApiKey: '' },
            notifications: parsed.notifications || { desktop: true, sound: false, dailyDigest: false },
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
      localStorage.setItem(LOCAL_KEYS.SETTINGS, JSON.stringify(settings));
      if (isSupabaseConfigured && supabase) {
          this.getUserId().then(uid => {
              if (uid) {
                  supabase!.from(TABLE_NAMES.PROFILES).upsert({ id: uid, settings });
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
            (c.email && c.email.toLowerCase().includes(lowerQuery)) || 
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

  async checkDeadlines() {
    const lastCheck = localStorage.getItem(LOCAL_KEYS.LAST_CHECK);
    const today = new Date();
    const todayStr = today.toDateString();

    if (lastCheck === todayStr) return;

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

    for (const task of tasks) {
        if (task.status !== 'Concluído' && isDate(task.dueDate, tomorrow)) {
            notificationService.notify('Prazo de Tarefa Próximo', `A tarefa "${task.title}" vence amanhã (${task.dueDate}).`, 'warning');
        }
    }

    for (const legalCase of cases) {
        if (legalCase.status === CaseStatus.ACTIVE && legalCase.nextHearing && isDate(legalCase.nextHearing, tomorrow)) {
            notificationService.notify('Audiência Amanhã', `Audiência do processo "${legalCase.title}" agendada para amanhã.`, 'warning');
        }
    }

    localStorage.setItem(LOCAL_KEYS.LAST_CHECK, todayStr);
  }

  checkRealtimeAlerts() {
      this.checkDeadlines();
  }
  
  factoryReset() {
    localStorage.clear();
    window.location.reload();
  }
}

export const storageService = new StorageService();
