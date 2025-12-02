
interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'client' | 'case' | 'task' | 'financial';
  data: any;
  timestamp: number;
  retryCount: number;
}

class SyncQueueService {
  private queue: QueuedOperation[] = [];
  private isProcessing = false;

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
    entityType: 'client' | 'case' | 'task' | 'financial',
    data: any
  ) {
    this.loadQueue();
    
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

    this.processPending();
  }

  public async processPending() {
    if (this.isProcessing) return;
    
    this.loadQueue();
    if (this.queue.length === 0) return;

    this.isProcessing = true;

    try {
      for (const operation of this.queue) {
        try {
          // Em um cenário real, aqui chamaria a API para sincronizar
          // await api.sync(operation);
          
          // Removemos da fila simulando sucesso
          this.queue = this.queue.filter(op => op.id !== operation.id);
          this.saveQueue();
        } catch (error) {
          console.error(`Erro ao sincronizar operação ${operation.id}:`, error);
          operation.retryCount++;
          
          if (operation.retryCount >= 3) {
            this.queue = this.queue.filter(op => op.id !== operation.id);
            this.saveQueue();
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public getPendingCount(): number {
    this.loadQueue();
    return this.queue.length;
  }
}

export const syncQueueService = new SyncQueueService();