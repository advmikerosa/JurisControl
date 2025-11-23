import { Client, LegalCase, Task, FinancialRecord, ActivityLog, SystemDocument, AppSettings } from '../types';
import { MOCK_CLIENTS, MOCK_CASES, MOCK_TASKS, MOCK_FINANCIALS } from './mockData';
import { supabase, isSupabaseConfigured } from './supabase';

const TABLE_NAMES = {
  CLIENTS: 'clients',
  CASES: 'cases',
  TASKS: 'tasks',
  FINANCIAL: 'financial',
  DOCUMENTS: 'documents',
};

const LOCAL_KEYS = {
  CLIENTS: '@JurisControl:clients',
  CASES: '@JurisControl:cases',
  TASKS: '@JurisControl:tasks',
  FINANCIAL: '@JurisControl:financial',
  DOCUMENTS: '@JurisControl:documents',
};

class StorageService {
  
  private async getUserId(): Promise<string> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      return data.session?.user?.id || 'anon';
    }
    const stored = localStorage.getItem('@JurisControl:user');
    return stored ? JSON.parse(stored).id : 'demo-user';
  }

  // --- Clientes ---
  async getClients(): Promise<Client[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from(TABLE_NAMES.CLIENTS).select('*');
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
    if (isSupabaseConfigured && supabase) {
      const { id, ...rest } = client;
      // Se for ID gerado localmente (cli-...), removemos para o DB gerar ou tratamos como insert
      // Se o ID já existir no Supabase (UUID), fazemos upsert
      
      const payload = { ...rest, user_id: userId };
      
      if (id && !id.startsWith('cli-')) {
        await supabase.from(TABLE_NAMES.CLIENTS).update(payload).eq('id', id);
      } else {
        await supabase.from(TABLE_NAMES.CLIENTS).insert([payload]);
      }
    } else {
      const list = await this.getClients();
      if (client.id && !client.id.startsWith('cli-')) {
        const idx = list.findIndex(i => i.id === client.id);
        if (idx >= 0) list[idx] = client;
      } else {
        list.unshift({ ...client, id: client.id || `cli-${Date.now()}`, userId }); // Fake ID for local
      }
      localStorage.setItem(LOCAL_KEYS.CLIENTS, JSON.stringify(list));
    }
  }

  async deleteClient(id: string) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.CLIENTS).delete().eq('id', id);
    } else {
      const list = await this.getClients();
      localStorage.setItem(LOCAL_KEYS.CLIENTS, JSON.stringify(list.filter(i => i.id !== id)));
    }
  }

  // --- Processos ---
  async getCases(): Promise<LegalCase[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from(TABLE_NAMES.CASES).select('*');
        if (error) throw error;
        // Precisamos garantir que client venha completo ou fazer join.
        // Simplificação: Supabase retorna JSON no campo client se configurado como JSONB, ou fazemos join.
        // Assumindo que no Supabase salvamos o objeto client completo dentro da tabela cases por simplicidade (NoSQL style em coluna JSONB) ou fazemos fetch separado.
        // Para manter compatibilidade com o código frontend, vamos assumir que 'client' é salvo como JSONB.
        return data as LegalCase[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.CASES) || '[]');
    }
  }

  async saveCase(legalCase: LegalCase) {
    const userId = await this.getUserId();
    legalCase.lastUpdate = new Date().toISOString();
    
    if (isSupabaseConfigured && supabase) {
      const { id, ...rest } = legalCase;
      const payload = { ...rest, user_id: userId };

      if (id && !id.startsWith('case-')) {
        await supabase.from(TABLE_NAMES.CASES).update(payload).eq('id', id);
      } else {
        await supabase.from(TABLE_NAMES.CASES).insert([payload]);
      }
    } else {
      const list = await this.getCases();
      if (legalCase.id && !legalCase.id.startsWith('case-')) {
        const idx = list.findIndex(i => i.id === legalCase.id);
        if (idx >= 0) list[idx] = legalCase;
      } else {
        list.unshift({ ...legalCase, id: legalCase.id || `case-${Date.now()}`, userId });
      }
      localStorage.setItem(LOCAL_KEYS.CASES, JSON.stringify(list));
    }
  }

  async deleteCase(id: string) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from(TABLE_NAMES.CASES).delete().eq('id', id);
    } else {
      const list = await this.getCases();
      localStorage.setItem(LOCAL_KEYS.CASES, JSON.stringify(list.filter(i => i.id !== id)));
    }
  }

  // --- Tarefas ---
  async getTasks(): Promise<Task[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from(TABLE_NAMES.TASKS).select('*');
        return data as Task[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.TASKS) || '[]');
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
        await supabase.from(TABLE_NAMES.TASKS).insert([payload]);
      }
    } else {
      const list = await this.getTasks();
      if (task.id && !task.id.startsWith('task-')) {
        const idx = list.findIndex(i => i.id === task.id);
        if (idx >= 0) list[idx] = task;
      } else {
        list.unshift({ ...task, id: task.id || `task-${Date.now()}`, userId });
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
        const { data } = await supabase.from(TABLE_NAMES.FINANCIAL).select('*');
        return data as FinancialRecord[];
      } catch { return []; }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_KEYS.FINANCIAL) || '[]');
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
        await supabase.from(TABLE_NAMES.FINANCIAL).insert([payload]);
      }
    } else {
      const list = await this.getFinancials();
      if (record.id && !record.id.startsWith('trans-')) {
        const idx = list.findIndex(i => i.id === record.id);
        if (idx >= 0) list[idx] = record;
      } else {
        list.unshift({ ...record, id: record.id || `trans-${Date.now()}`, userId });
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

  async saveDocument(docData: SystemDocument) {
    const userId = await this.getUserId();
    if (isSupabaseConfigured && supabase) {
      const { id, ...rest } = docData;
      const payload = { ...rest, user_id: userId };
      await supabase.from(TABLE_NAMES.DOCUMENTS).insert([payload]);
    } else {
      const list = await this.getDocuments();
      list.unshift({ ...docData, userId });
      localStorage.setItem(LOCAL_KEYS.DOCUMENTS, JSON.stringify(list));
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

  // --- Utils & Logs ---
  getLogs(): ActivityLog[] { 
    try { return JSON.parse(localStorage.getItem('@JurisControl:logs') || '[]'); } catch { return []; }
  }
  
  logActivity(action: string, status: 'Success' | 'Failed' | 'Warning' = 'Success') {
    const logs = this.getLogs();
    logs.unshift({
      id: Date.now().toString(),
      action,
      date: new Date().toLocaleString('pt-BR'),
      device: navigator.userAgent.split(')')[0] + ')',
      ip: '127.0.0.1',
      status
    });
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

  saveDraft(key: string, data: any) {
    const drafts = JSON.parse(localStorage.getItem('@JurisControl:drafts') || '{}');
    drafts[key] = data;
    localStorage.setItem('@JurisControl:drafts', JSON.stringify(drafts));
  }

  getDraft(key: string) {
    const drafts = JSON.parse(localStorage.getItem('@JurisControl:drafts') || '{}');
    return drafts[key] || null;
  }

  clearDraft(key: string) {
    const drafts = JSON.parse(localStorage.getItem('@JurisControl:drafts') || '{}');
    delete drafts[key];
    localStorage.setItem('@JurisControl:drafts', JSON.stringify(drafts));
  }

  // --- SEEDER (Rodar apenas em modo Local/Demo para preencher dados) ---
  async seedDatabase() {
    // Verifica se já tem dados locais
    const clients = await this.getClients();
    if (clients.length > 0) return;

    // Se estiver conectado ao Supabase, verifica se a tabela está vazia antes de seedar (opcional, aqui focado em Demo Local)
    if (isSupabaseConfigured) {
        // Em produção/Supabase, evitamos auto-seed no cliente para não duplicar. 
        // Seed deve ser feito via SQL no dashboard do Supabase.
        return; 
    }

    const userId = await this.getUserId();
    console.log("Seeding local database...");
    
    localStorage.setItem(LOCAL_KEYS.CLIENTS, JSON.stringify(MOCK_CLIENTS.map(c => ({...c, userId}))));
    localStorage.setItem(LOCAL_KEYS.CASES, JSON.stringify(MOCK_CASES.map(c => ({...c, userId}))));
    localStorage.setItem(LOCAL_KEYS.TASKS, JSON.stringify(MOCK_TASKS.map(c => ({...c, userId}))));
    localStorage.setItem(LOCAL_KEYS.FINANCIAL, JSON.stringify(MOCK_FINANCIALS.map(c => ({...c, userId}))));
    
    console.log("Seeding complete.");
  }

  runAutomations() {
    // Placeholder para automações locais
  }
  
  factoryReset() {
    localStorage.clear();
    window.location.reload();
  }
}

export const storageService = new StorageService();
