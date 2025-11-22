
import { Client, LegalCase, Task, FinancialRecord, User, ActivityLog, SystemDocument, AppSettings, CaseStatus } from '../types';
import { MOCK_CLIENTS, MOCK_CASES, MOCK_TASKS, MOCK_FINANCIALS } from './mockData';
import { notificationService } from './notificationService';

const KEYS = {
  CLIENTS: '@JurisControl:clients',
  CASES: '@JurisControl:cases',
  TASKS: '@JurisControl:tasks',
  FINANCIAL: '@JurisControl:financial',
  DOCUMENTS: '@JurisControl:documents',
  LOGS: '@JurisControl:logs',
  SETTINGS: '@JurisControl:settings',
  AUTH: '@JurisControl:auth',
  DRAFTS: '@JurisControl:drafts',
};

const DEFAULT_SETTINGS: AppSettings = {
  general: {
    language: 'pt-BR',
    dateFormat: 'DD/MM/YYYY',
    compactMode: false,
  },
  notifications: {
    email: true,
    desktop: true,
    sound: false,
    dailyDigest: false,
  },
  automation: {
    autoArchiveWonCases: false, // Default off
    autoSaveDrafts: true,
  }
};

class StorageService {
  private get<T>(key: string, initialData: T | T[]): any {
    const data = localStorage.getItem(key);
    if (!data) {
      return initialData;
    }
    try {
        return JSON.parse(data);
    } catch (e) {
        return initialData;
    }
  }

  private set<T>(key: string, data: T) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // --- Clientes ---
  getClients(): Client[] { return this.get(KEYS.CLIENTS, []); }
  
  saveClient(client: Client) {
    const list = this.getClients();
    const index = list.findIndex(c => c.id === client.id);
    if (index >= 0) {
      list[index] = client;
    } else {
      list.unshift(client);
    }
    this.set(KEYS.CLIENTS, list);
  }

  deleteClient(id: string) {
    const list = this.getClients().filter(c => c.id !== id);
    this.set(KEYS.CLIENTS, list);
  }

  // --- Processos ---
  getCases(): LegalCase[] { return this.get(KEYS.CASES, []); }

  saveCase(legalCase: LegalCase) {
    const list = this.getCases();
    // Atualiza lastUpdate para automação
    legalCase.lastUpdate = new Date().toISOString();

    const index = list.findIndex(c => c.id === legalCase.id);
    if (index >= 0) {
      list[index] = legalCase;
    } else {
      list.unshift(legalCase);
    }
    this.set(KEYS.CASES, list);
  }

  deleteCase(id: string) {
    const list = this.getCases().filter(c => c.id !== id);
    this.set(KEYS.CASES, list);
  }

  // --- Tarefas ---
  getTasks(): Task[] { return this.get(KEYS.TASKS, []); }
  
  saveTask(task: Task) {
    const list = this.getTasks();
    const index = list.findIndex(t => t.id === task.id);
    if (index >= 0) {
      list[index] = task;
    } else {
      list.push(task);
    }
    this.set(KEYS.TASKS, list);
  }
  
  deleteTask(id: string) {
    const list = this.getTasks().filter(t => t.id !== id);
    this.set(KEYS.TASKS, list);
  }

  // --- Financeiro ---
  getFinancials(): FinancialRecord[] { return this.get(KEYS.FINANCIAL, []); }
  
  saveFinancial(record: FinancialRecord) {
    const list = this.getFinancials();
    list.unshift(record);
    this.set(KEYS.FINANCIAL, list);
  }

  // --- Documentos (Geral) ---
  getDocuments(): SystemDocument[] { return this.get(KEYS.DOCUMENTS, []); }

  saveDocument(doc: SystemDocument) {
    const list = this.getDocuments();
    list.unshift(doc);
    this.set(KEYS.DOCUMENTS, list);
  }

  deleteDocument(id: string) {
    const list = this.getDocuments().filter(d => d.id !== id);
    this.set(KEYS.DOCUMENTS, list);
  }

  // --- Logs ---
  getLogs(): ActivityLog[] { return this.get(KEYS.LOGS, []); }
  
  logActivity(action: string, status: 'Success' | 'Failed' | 'Warning' = 'Success') {
    const logs = this.getLogs();
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      action,
      date: new Date().toLocaleString('pt-BR'),
      device: navigator.userAgent.split(')')[0] + ')',
      ip: 'Localhost',
      status
    };
    logs.unshift(newLog);
    this.set(KEYS.LOGS, logs.slice(0, 50));
  }

  // --- Configurações ---
  getSettings(): AppSettings {
      const stored = this.get(KEYS.SETTINGS, DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS, ...stored };
  }

  saveSettings(settings: AppSettings) {
      this.set(KEYS.SETTINGS, settings);
  }

  // --- Drafts (Auto-Save) ---
  saveDraft(key: string, data: any) {
    const settings = this.getSettings();
    if (settings.automation.autoSaveDrafts) {
      const drafts = this.get(KEYS.DRAFTS, {});
      drafts[key] = data;
      this.set(KEYS.DRAFTS, drafts);
    }
  }

  getDraft(key: string) {
    const drafts = this.get(KEYS.DRAFTS, {});
    return drafts[key] || null;
  }

  clearDraft(key: string) {
    const drafts = this.get(KEYS.DRAFTS, {});
    delete drafts[key];
    this.set(KEYS.DRAFTS, drafts);
  }

  // --- Automation Logic ---
  runAutomations() {
    const settings = this.getSettings();
    let changesMade = false;

    // 1. Auto-Archive Won Cases (> 30 days)
    if (settings.automation.autoArchiveWonCases) {
      const cases = this.getCases();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const updatedCases = cases.map(c => {
        // Se for GANHO e (tiver lastUpdate antigo ou não tiver data e assumirmos antigo)
        // Aqui usamos uma lógica simplificada: se lastUpdate existe, usa ele. Se não, não arquiva automaticamente para evitar erros em dados legados.
        if (c.status === CaseStatus.WON && c.lastUpdate) {
          const updateDate = new Date(c.lastUpdate);
          if (updateDate < thirtyDaysAgo) {
            c.status = CaseStatus.ARCHIVED;
            c.lastUpdate = new Date().toISOString();
            changesMade = true;
            this.logActivity(`Automação: Processo ${c.cnj} arquivado automaticamente.`, 'Success');
            notificationService.notify('Automação Executada', `Processo ${c.title} foi arquivado automaticamente.`, 'info');
          }
        }
        return c;
      });

      if (changesMade) {
        this.set(KEYS.CASES, updatedCases);
      }
    }
  }

  // --- SYSTEM RESET ---
  factoryReset() {
    localStorage.removeItem(KEYS.CLIENTS);
    localStorage.removeItem(KEYS.CASES);
    localStorage.removeItem(KEYS.TASKS);
    localStorage.removeItem(KEYS.FINANCIAL);
    localStorage.removeItem(KEYS.DOCUMENTS);
    localStorage.removeItem(KEYS.LOGS);
    localStorage.removeItem(KEYS.SETTINGS);
    localStorage.removeItem(KEYS.AUTH);
    localStorage.removeItem(KEYS.DRAFTS);
  }

  seedDatabase() {
    if (!localStorage.getItem(KEYS.CLIENTS)) this.set(KEYS.CLIENTS, MOCK_CLIENTS);
    if (!localStorage.getItem(KEYS.CASES)) this.set(KEYS.CASES, MOCK_CASES);
    if (!localStorage.getItem(KEYS.TASKS)) this.set(KEYS.TASKS, MOCK_TASKS);
    if (!localStorage.getItem(KEYS.FINANCIAL)) this.set(KEYS.FINANCIAL, MOCK_FINANCIALS);
  }
}

export const storageService = new StorageService();
