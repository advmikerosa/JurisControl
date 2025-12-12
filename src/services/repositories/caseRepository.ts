
import { BaseRepository } from './baseRepository';
import { LegalCase, CaseStatus } from '../../types';
import { MOCK_CASES } from '../mockData';

const TABLE_NAME = 'cases';
const LOCAL_KEY = '@JurisControl:cases';

export class CaseRepository extends BaseRepository {
  
  async getCases(): Promise<LegalCase[]> {
    if (this.isSupabaseConfigured && this.supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return [];

        const { data, error } = await this.supabase
          .from(TABLE_NAME)
          .select(`*, client:clients!cases_client_id_fkey(*)`)
          .eq('user_id', userId);
        
        if (error) throw error;
        
        return this.mapSupabaseData(data);
      } catch (e) { 
        console.error("Supabase Error (getCases):", e); 
        return []; 
      }
    } else {
      return this.getLocal<LegalCase[]>(LOCAL_KEY, []);
    }
  }

  async getCaseById(id: string): Promise<LegalCase | null> {
    if (this.isSupabaseConfigured && this.supabase) {
      try {
        const userId = await this.getUserId();
        if (!userId) return null;

        const { data, error } = await this.supabase
          .from(TABLE_NAME)
          .select(`*, client:clients!cases_client_id_fkey(*)`)
          .eq('id', id)
          .eq('user_id', userId)
          .single();
        
        if (error) throw error;
        return this.mapSingleCase(data);
      } catch (e) { 
        return null; 
      }
    } else {
      const cases = await this.getCases();
      return cases.find(c => c.id === id) || null;
    }
  }

  // Real Pagination Implementation
  async getPaginated(
    page: number = 1, 
    limit: number = 20, 
    searchTerm: string = '', 
    statusFilter: string | null = null,
    categoryFilter: string | null = null, 
    dateRange: { start: string, end: string } | null = null
  ): Promise<{ data: LegalCase[], total: number }> {
    
    if (this.isSupabaseConfigured && this.supabase) {
        const userId = await this.getUserId();
        if (!userId) return { data: [], total: 0 };

        let query = this.supabase
            .from(TABLE_NAME)
            .select(`*, client:clients!cases_client_id_fkey(*)`, { count: 'exact' })
            .eq('user_id', userId);

        // Apply Filters
        if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,cnj.ilike.%${searchTerm}%`);
        }
        if (statusFilter && statusFilter !== 'Todos') {
            query = query.eq('status', statusFilter);
        }
        if (categoryFilter && categoryFilter !== 'Todos') {
            query = query.eq('category', categoryFilter);
        }
        if (dateRange && dateRange.start && dateRange.end) {
            query = query.gte('last_update', dateRange.start).lte('last_update', dateRange.end);
        }

        // Apply Pagination (.range is 0-indexed inclusive)
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        const { data, count, error } = await query.range(from, to).order('last_update', { ascending: false });
        
        if (error) {
            console.error("Pagination Error:", error);
            return { data: [], total: 0 };
        }

        return {
            data: this.mapSupabaseData(data),
            total: count || 0
        };
    } else {
        // Fallback for LocalStorage (In-memory filtering)
        let filtered = await this.getCases();
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
        
        const start = (page - 1) * limit;
        return {
            data: filtered.slice(start, start + limit),
            total: filtered.length
        };
    }
  }

  async save(legalCase: LegalCase): Promise<void> {
    const s = await this.getUserSession();
    const caseToSave = { 
        ...legalCase, 
        officeId: s.officeId || 'office-1', 
        userId: s.userId || 'local',
        lastUpdate: new Date().toISOString()
    };

    if (this.isSupabaseConfigured && this.supabase) {
      if (!s.userId) throw new Error("Usuário não autenticado");

      const payload: any = {
        id: legalCase.id && !legalCase.id.startsWith('case-') ? legalCase.id : undefined,
        user_id: s.userId,
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
        last_update: legalCase.lastUpdate,
        office_id: s.officeId
      };
      
      // Upsert: If ID exists update, else insert
      const { error } = await this.supabase.from(TABLE_NAME).upsert(payload);
      if (error) throw error;
    } else {
      const list = await this.getCases();
      const idx = list.findIndex(i => i.id === legalCase.id);
      if (idx >= 0) {
          list[idx] = caseToSave;
      } else {
          if (!caseToSave.id) caseToSave.id = `case-${Date.now()}`;
          list.push(caseToSave);
      }
      this.setLocal(LOCAL_KEY, list);
    }
  }

  async delete(id: string): Promise<void> {
    if (this.isSupabaseConfigured && this.supabase) {
      const userId = await this.getUserId();
      if (!userId) return;
      await this.supabase.from(TABLE_NAME).delete().eq('id', id).eq('user_id', userId);
    } else {
      const list = await this.getCases();
      this.setLocal(LOCAL_KEY, list.filter(i => i.id !== id));
    }
  }

  // Mappers
  private mapSupabaseData(data: any[] | null): LegalCase[] {
      return (data || []).map(item => this.mapSingleCase(item));
  }

  private mapSingleCase(item: any): LegalCase {
      const clientData = item.client;
      const mappedClient = clientData ? {
          id: clientData.id,
          officeId: clientData.office_id,
          name: clientData.name,
          type: clientData.type,
          avatarUrl: clientData.avatar_url,
          status: clientData.status || 'Ativo',
          createdAt: '',
          documents: [], history: [], alerts: []
      } : { id: 'unknown', officeId: '', name: 'Cliente Desconhecido', type: 'PF', status: 'Ativo', createdAt: '', documents: [], history: [], alerts: [] };

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
        client: mappedClient as any
      };
  }
}
