
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
        console.warn("Supabase fetch failed, returning empty (not using local fallback to prevent mismatch).", error);
        return []; 
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
      const payload = this.mapClientToPayload(client, session.userId);
      try {
        const { error } = await supabase.from(TABLE_NAMES.CLIENTS).upsert(payload);
        if (error) throw error;
      } catch (e) { 
        console.warn("Offline or Error saving to Supabase. Adding to SyncQueue.");
        syncQueueService.addOperation(client.id ? 'update' : 'create', 'client', payload);
      }
      this.logActivity(`Salvou cliente: ${client.name}`);
    } else {
      // Demo Mode
      const list = this.getLocal<Client[]>(LOCAL_KEYS.CLIENTS, []);
      const idx = list.findIndex(i => i.id === client.id);
      if (idx >= 0) {
          list[idx] = client;
      } else {
          if (!client.id || !client.id.startsWith('cli-') || !client.id) client.id = `cli-${Date.now()}`;
          client.userId = session.userId || 'local';
          list.unshift(client);
      }
      this.setLocal(LOCAL_KEYS.CLIENTS, list);
      this.logActivity(`Salvou cliente (Local): ${client.name}`);
    }
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
      try {
        const { error } = await supabase.from(TABLE_NAMES.CLIENTS).delete().eq('id', id).eq('office_id', session.officeId);
        if(error) throw error;
      } catch {
        syncQueueService.addOperation('delete', 'client', { id });
      }
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
      } catch (e) { return []; }
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
      const payload = this.mapCaseToPayload(legalCase, session.userId);
      try {
        const { error } = await supabase.from(TABLE_NAMES.CASES).upsert(payload);
        if (error) throw error;
      } catch (e) { 
        syncQueueService.addOperation(legalCase.id ? 'update' : 'create', 'case', payload);
      }
      this.logActivity(`Salvou processo: ${legalCase.title}`);
    } else {
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
  }

  async deleteCase(id: string) {
    if (isSupabaseConfigured && supabase) {
      const session = await this.getUserSession();
      if (!session.userId) return;
      try {
        const { error } = await supabase.from(TABLE_NAMES.CASES).delete().eq('id', id).eq('office_id', session.officeId);
        if(error) throw error;
      } catch {
        syncQueueService.addOperation('delete', 'case', { id });
      }
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
      } catch { return []; }
    } else {
      return this.filterByOffice(this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []), session.officeId);
    }
  }

  async getTasksByCaseId(id: string) { 
    return (await this.getTasks()).filter(t => t.caseId === id); 
  }
  
  async saveTask(task: Task) {
    const session = await this.getUserSession();
    if (!session.officeId) throw new Error("Nenhum escritório selecionado.");
    task.officeId = session.officeId;

    if (isSupabaseConfigured && supabase && session.userId) {
      const payload = this.mapTaskToPayload(task, session.userId);
      try {
        const { error } = await supabase.from(TABLE_NAMES.TASKS).upsert(payload);
        if (error) throw error;
      } catch (e) { 
        syncQueueService.addOperation(task.id ? 'update' : 'create', 'task', payload);
      }
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
      const session = await this.getUserSession();
      if (!session.userId) return;
      try {
        await supabase.from(TABLE_NAMES.TASKS).delete().eq('id', id).eq('office_id', session.officeId);
      } catch {
        syncQueueService.addOperation('delete', 'task', { id });
      }
    } else {
      const list = this.getLocal<Task[]>(LOCAL_KEYS.TASKS, []);
      this.setLocal(LOCAL_KEYS.TASKS, list.filter(i => i.id !== id));
    }
  }

  // --- Financeiro ---
  async getFinancials(): Promise<FinancialRecord[]> {
    const session = await this.getUserSession();
    if (!session.officeId) return [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
            .from(TABLE_NAMES.FINANCIAL)
            .select('*')
            .eq('office_id', session.officeId);
        
        return this.mapSupabaseFinancials(data || []);
      } catch { return []; }
    } else {
      return this.filterByOffice(this.getLocal<FinancialRecord[]>(LOCAL_KEYS.FINANCIAL, []), session.officeId);
    }
  }

  async getFinancialsByCaseId(caseId: string): Promise<FinancialRecord[]> {
    const fins = await this.getFinancials();
    return fins.filter(f => f.caseId === caseId);
  }
  
  async saveFinancial(record: FinancialRecord) {
    const session = await this.getUserSession();
    if (!session.officeId) throw new Error("Nenhum escritório selecionado.");
    
    record.officeId = session.officeId;

    if (isSupabaseConfigured && supabase && session.userId) {
      const payload = {
          id: record.id && !record.id.startsWith('trans-') ? record.id : undefined,
          user_id: session.userId,
          office_id: session.officeId,
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
      
      try {
        const { error } = await supabase.from(TABLE_NAMES.FINANCIAL).upsert(payload);
        if (error) throw error;
      } catch {
        syncQueueService.addOperation(record.id ? 'update' : 'create', 'financial', payload);
      }

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

  // --- Documentos ---
  async getDocuments(): Promise<SystemDocument[]> {
    const session = await this.getUserSession();
    if (!session.officeId) return [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
            .from(TABLE_NAMES.DOCUMENTS)
            .select('*')
            .eq('office_id', session.officeId);
        
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
      return this.filterByOffice(this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []), session.officeId);
    }
  }

  async getDocumentsByCaseId(caseId: string): Promise<SystemDocument[]> {
    const docs = await this.getDocuments();
    return docs.filter(d => d.caseId === caseId);
  }

  async saveDocument(docData: SystemDocument) {
    const session = await this.getUserSession();
    if (!session.officeId) throw new Error("Nenhum escritório selecionado.");
    
    docData.officeId = session.officeId;

    if (isSupabaseConfigured && supabase && session.userId) {
      const payload = { 
          id: docData.id,
          user_id: session.userId,
          office_id: session.officeId,
          name: docData.name,
          size: docData.size,
          type: docData.type,
          date: docData.date,
          category: docData.category,
          case_id: docData.caseId
      };
      try {
        const { error } = await supabase.from(TABLE_NAMES.DOCUMENTS).insert([payload]);
        if (error) throw error;
      } catch {
        syncQueueService.addOperation('create', 'document', payload);
      }
    } else {
      const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
      list.unshift({ ...docData, userId: session.userId || 'local' });
      this.setLocal(LOCAL_KEYS.DOCUMENTS, list);
    }
    this.logActivity(`Upload de documento: ${docData.name}`);
  }

  async deleteDocument(id: string) {
    if (isSupabaseConfigured && supabase) {
      const session = await this.getUserSession();
      if (!session.userId) return;
      try {
        await supabase.from(TABLE_NAMES.DOCUMENTS).delete().eq('id', id).eq('office_id', session.officeId);
      } catch {
        syncQueueService.addOperation('delete', 'document', { id });
      }
    } else {
      const list = this.getLocal<SystemDocument[]>(LOCAL_KEYS.DOCUMENTS, []);
      this.setLocal(LOCAL_KEYS.DOCUMENTS, list.filter(i => i.id !== id));
    }
  }

  // --- Escritórios (Office Management) ---
  async getOffices(): Promise<Office[]> {
    if (isSupabaseConfigured && supabase) {
      try {
          const { data, error } = await supabase
            .from(TABLE_NAMES.OFFICES)
            .select(`
                *,
                members:office_members(*)
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
              members: this.mapMembers(o.members || [], o.owner_id)
          }));
      } catch (e) {
          console.error("Error fetching offices:", e);
          return [];
      }
    } else {
      return this.getLocal<Office[]>(LOCAL_KEYS.OFFICES, []);
    }
  }

  private mapMembers(membersData: any[], ownerId?: string): OfficeMember[] {
      const members = membersData.map(m => ({
          userId: m.user_id,
          name: m.name || 'Membro', 
          email: m.email || '',
          avatarUrl: m.avatar_url,
          role: m.role,
          permissions: m.permissions || { financial: false, cases: false, documents: false, settings: false }
      }));

      // Ensure owner is in the list (Virtual Member if missing from DB due to partial insert/trigger lag)
      if (ownerId && !members.some(m => m.userId === ownerId)) {
          members.unshift({
              userId: ownerId,
              name: 'Administrador (Dono)', 
              role: 'Admin',
              permissions: { financial: true, cases: true, documents: true, settings: true },
              email: '', 
              avatarUrl: ''
          });
      }
      
      return members;
  }

  async getOfficeById(id: string): Promise<Office | undefined> {
    if (isSupabaseConfigured && supabase) {
       try {
           const { data, error } = await supabase
            .from(TABLE_NAMES.OFFICES)
            .select(`
                *,
                members:office_members(*)
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
              members: this.mapMembers(data.members || [], data.owner_id)
           };
       } catch { return undefined; }
    }
    const offices = await this.getOffices();
    return offices.find(o => o.id === id);
  }
  
  async saveOffice(office: Office): Promise<void> {
    if (isSupabaseConfigured && supabase) {
        // Only update office fields, members are handled via office_members table ops
        const payload = {
            id: office.id,
            name: office.name,
            handle: office.handle,
            location: office.location,
            owner_id: office.ownerId,
            logo_url: office.logoUrl,
            created_at: office.createdAt,
            area_of_activity: office.areaOfActivity,
            social: office.social
        };
        
        try {
            await supabase.from(TABLE_NAMES.OFFICES).upsert(payload);
        } catch {
            console.warn("Saving office offline not fully supported.");
        }
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

  /**
   * createOffice
   * @param officeData Partial office data
   * @param explicitOwnerId (Optional) Use this ID instead of fetching from session. Useful during registration.
   */
  async createOffice(officeData: Partial<Office>, explicitOwnerId?: string, ownerDetails?: any): Promise<Office> {
      const actualUserId = explicitOwnerId || (await this.getUserSession()).userId || 'local';
      const userStr = localStorage.getItem('@JurisControl:user');
      const userData = userStr ? JSON.parse(userStr) : { name: ownerDetails?.name || 'Admin', email: ownerDetails?.email || '', avatar: '' };

      let handle = officeData.handle || `@office${Date.now()}`;
      if (!handle.startsWith('@')) handle = '@' + handle;

      // Ensure we have a valid ID format for Supabase if needed (text field in DB, but lets try to keep it clean)
      // For local fallback we use a string prefix.
      const newOfficeId = isSupabaseConfigured ? crypto.randomUUID() : `office-${Date.now()}`;

      const newOffice: Office = {
          id: newOfficeId,
          name: officeData.name || 'Novo Escritório',
          handle: handle,
          location: officeData.location || 'Brasil',
          ownerId: actualUserId,
          members: [{
              userId: actualUserId,
              name: userData.name,
              email: userData.email,
              avatarUrl: userData.avatar || '',
              role: 'Admin',
              permissions: { financial: true, cases: true, documents: true, settings: true }
          }],
          createdAt: new Date().toISOString(),
          social: {}
      };
      
      if (isSupabaseConfigured && supabase) {
          // 1. Insert Office (without members array - Relational Normalized)
          const officePayload = {
              id: newOffice.id,
              name: newOffice.name,
              handle: newOffice.handle,
              location: newOffice.location,
              owner_id: newOffice.ownerId,
              logo_url: newOffice.logoUrl,
              created_at: newOffice.createdAt,
              area_of_activity: newOffice.areaOfActivity,
              social: newOffice.social
          };
          
          const { data: officeDataDb, error: officeError } = await supabase
            .from(TABLE_NAMES.OFFICES)
            .insert(officePayload)
            .select()
            .single();
          
          if(officeError) {
              if (officeError.code === '23505') throw new Error("Identificador (@handle) já existe.");
              throw new Error(`Erro ao criar escritório: ${officeError.message}`);
          }
          
          // 2. Insert Admin Member
          const memberPayload = {
              office_id: officeDataDb.id,
              user_id: actualUserId,
              role: 'Admin',
              permissions: { financial: true, cases: true, documents: true, settings: true },
              name: userData.name,
              email: userData.email,
              avatar_url: userData.avatar
          };

          const { error: memberError } = await supabase.from(TABLE_NAMES.OFFICE_MEMBERS).insert(memberPayload);
          
          if (memberError) {
              // Rollback (best effort)
              await supabase.from(TABLE_NAMES.OFFICES).delete().eq('id', officeDataDb.id);
              throw new Error("Erro ao adicionar membro admin. Tente novamente.");
          }
          
      } else {
          // LocalStorage fallback
          const offices = await this.getOffices();
          if (offices.some(o => o.handle.toLowerCase() === handle.toLowerCase())) {
              throw new Error("Handle já existe. Escolha outro.");
          }
          offices.push(newOffice);
          this.setLocal(LOCAL_KEYS.OFFICES, offices);
      }
      
      this.logActivity(`Criou novo escritório: ${newOffice.name}`);
      return newOffice;
  }

  async joinOffice(handle: string): Promise<Office> {
      let office: Office | undefined;

      if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase
            .from(TABLE_NAMES.OFFICES)
            .select('*, members:office_members(*)')
            .eq('handle', handle)
            .single();
            
          if (error || !data) throw new Error("Escritório não encontrado ou identificador inválido.");
          
          office = {
              id: data.id,
              name: data.name,
              handle: data.handle,
              location: data.location,
              ownerId: data.owner_id,
              logoUrl: data.logo_url,
              createdAt: data.created_at,
              areaOfActivity: data.area_of_activity,
              members: this.mapMembers(data.members || [], data.owner_id)
          };
      } else {
          const offices = await this.getOffices();
          office = offices.find(o => o.handle.toLowerCase() === handle.toLowerCase());
      }

      if (!office) throw new Error("Escritório não encontrado.");

      const session = await this.getUserSession();
      if (!session.userId) throw new Error("Faça login para entrar.");

      // Check duplicate
      const isMember = office.members.some(m => m.userId === session.userId);
      if (isMember) {
          return office;
      }

      // Add member
      const userStr = localStorage.getItem('@JurisControl:user');
      const userData = userStr ? JSON.parse(userStr) : { name: 'Novo Membro', email: '' };

      const newMember: OfficeMember = {
          userId: session.userId,
          name: userData.name,
          email: userData.email,
          avatarUrl: userData.avatar,
          role: 'Advogado',
          permissions: { financial: false, cases: true, documents: true, settings: false }
      };

      if (isSupabaseConfigured && supabase) {
          await supabase.from(TABLE_NAMES.OFFICE_MEMBERS).insert({
              office_id: office.id,
              user_id: session.userId,
              role: newMember.role,
              permissions: newMember.permissions,
              name: newMember.name,
              email: newMember.email,
              avatar_url: newMember.avatarUrl
          });
          office.members.push(newMember);
      } else {
          office.members.push(newMember);
          await this.saveOffice(office);
      }

      this.logActivity(`Entrou no escritório: ${office.name}`);
      return office;
  }
  
  async inviteUserToOffice(officeId: string, handle: string): Promise<boolean> { 
      // Simulation of invitation
      await new Promise(resolve => setTimeout(resolve, 800));
      return true; 
  }

  async getCaseById(id: string) { return (await this.getCases()).find(c => c.id === id) || null; }
  
  async getCasesPaginated(page: number, limit: number, search: string, status: string | null, category: string | null, range: any) {
      let data = await this.getCases();
      if (search) {
        const lower = search.toLowerCase();
        data = data.filter(c => c.title.toLowerCase().includes(lower) || c.cnj.includes(lower) || c.client.name.toLowerCase().includes(lower));
      }
      if (status && status !== 'Todos') data = data.filter(c => c.status === status);
      if (category && category !== 'Todos') data = data.filter(c => c.category === category);
      
      const start = (page - 1) * limit;
      return { data: data.slice(start, start + limit), total: data.length };
  }

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

  private mapSupabaseFinancials(data: any[]): FinancialRecord[] {
      return data.map((f: any) => ({
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
      }));
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
    const session = await this.getUserSession();
    if (isSupabaseConfigured && supabase) {
      if (!session.userId) return;
      
      const userId = session.userId; // Explicit string

      // 1. Delete from related tables (user_id = uuid)
      const relatedTables = [
        TABLE_NAMES.LOGS,
        TABLE_NAMES.FINANCIAL,
        TABLE_NAMES.TASKS,
        TABLE_NAMES.DOCUMENTS,
        TABLE_NAMES.CASES,
        TABLE_NAMES.CLIENTS,
        TABLE_NAMES.OFFICE_MEMBERS
      ];

      for (const table of relatedTables) {
        try {
            await supabase.from(table).delete().eq('user_id', userId);
        } catch (e) {
            console.error(`Error deleting from ${table}:`, e);
        }
      }

      // 2. Delete Profile (id = uuid)
      try {
          await supabase.from(TABLE_NAMES.PROFILES).delete().eq('id', userId);
      } catch (e) {
          console.error("Error deleting profile:", e);
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
    const tasks = await this.getTasks();
    const now = new Date();
    const todayStr = now.toLocaleDateString('pt-BR');
    const alertedKeys = JSON.parse(sessionStorage.getItem('juris_alerted_keys') || '[]');
    const newAlerts: string[] = [];

    if (now.getHours() === 9 && now.getMinutes() < 30) {
      tasks.forEach(t => {
        if (t.status !== 'Concluído' && t.dueDate === todayStr) {
          const key = `task-deadline-${t.id}-${todayStr}`;
          if (!alertedKeys.includes(key)) {
            notificationService.notify('Prazo Fatal Hoje', `Tarefa: ${t.title} vence hoje!`, 'warning');
            newAlerts.push(key);
          }
        }
      });
    }
    if (newAlerts.length > 0) {
      sessionStorage.setItem('juris_alerted_keys', JSON.stringify([...alertedKeys, ...newAlerts]));
    }
  }
}

export const storageService = new StorageService();
