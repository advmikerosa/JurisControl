
import { supabase } from './supabase';

interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'client' | 'case' | 'task' | 'financial' | 'document';
  data: any;
  timestamp: number;
  retryCount: number;
}

const TABLE_MAP = {
  client: 'clients',
  case: 'cases',
  task: 'tasks',
  financial: 'financial',
  document: 'documents'
};

class SyncQueueService {
  private queue: QueuedOperation[] = [];
  private isProcessing = false;

  constructor() {
    this.loadQueue();
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem('@JurisControl:syncQueue');
      this.queue = stored ? JSON.parse(stored) : [];
    } catch {
      this.queue = [];
    }
  }

  private saveQueue() {
    localStorage.setItem('@JurisControl:syncQueue', JSON.stringify(this.queue));
  }

  public addOperation(
    type: 'create' | 'update' | 'delete',
    entityType: 'client' | 'case' | 'task' | 'financial' | 'document',
    data: any
  ) {
    this.loadQueue();
    
    // Remove duplicates or older versions of the same entity action if needed
    // Simple strategy: Append to end
    const operation: QueuedOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type,
      entityType,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.queue.push(operation);
    this.saveQueue();
    
    // Try to process immediately if online
    if (navigator.onLine) {
      this.processPending();
    }
  }

  public async processPending() {
    if (this.isProcessing || !supabase) return;
    if (!navigator.onLine) return;
    
    this.loadQueue();
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    console.log(`🔄 SyncQueue: Processando ${this.queue.length} operações pendentes...`);

    const failedOps: QueuedOperation[] = [];

    for (const operation of this.queue) {
      try {
        const tableName = TABLE_MAP[operation.entityType];
        
        if (!tableName) {
            console.error(`Tabela desconhecida para tipo: ${operation.entityType}`);
            continue; // Skip invalid
        }

        let error;

        if (operation.type === 'delete') {
            // Expects data to contain { id, userId } or just id depending on RLS
            const { error: delError } = await supabase
                .from(tableName)
                .delete()
                .match({ id: operation.data.id });
            error = delError;
        } else {
            // Create or Update (Upsert)
            const { error: upsertError } = await supabase
                .from(tableName)
                .upsert(operation.data);
            error = upsertError;
        }

        if (error) throw error;

        console.log(`✅ Operação sincronizada: ${operation.entityType} (${operation.type})`);

      } catch (error) {
        console.error(`❌ Erro ao sincronizar operação ${operation.id}:`, error);
        operation.retryCount++;
        
        // Keep in queue only if retry count is low, otherwise move to dead letter queue (not implemented here)
        // or keep trying until manual intervention.
        if (operation.retryCount <= 10) {
            failedOps.push(operation);
        } else {
            console.error("Operação descartada após muitas falhas:", operation);
        }
      }
    }

    this.queue = failedOps;
    this.saveQueue();
    this.isProcessing = false;
  }

  public getPendingCount(): number {
    this.loadQueue();
    return this.queue.length;
  }
}

export const syncQueueService = new SyncQueueService();
