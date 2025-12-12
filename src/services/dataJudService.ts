
import { LegalCase, CaseMovement, CaseStatus, LegalCategory } from '../types';
import { storageService } from './storageService';
import { supabase, isSupabaseConfigured } from './supabase';

interface DataJudResponse {
  hits: {
    hits: Array<{
      _source: {
        numeroProcesso: string;
        classe: { nome: string };
        sistema: { nome: string };
        orgaoJulgador: { nome: string; codigoMunicipioIBGE?: string };
        dataAjuizamento: string;
        movimentos: Array<{
          nome: string;
          dataHora: string;
          complementosTabelados?: Array<{ nome: string; valor: any }>;
        }>;
        assuntos: Array<{ nome: string }>;
      }
    }>
  }
}

class DataJudService {
  
  async validateApiKey(key: string): Promise<boolean> {
    if (!key || key.length < 20) return false;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('datajud-proxy', {
          body: { action: 'validate', apiKey: key }
        });
        if (error) throw error;
        return data.valid;
      } catch (e) {
        // Fallback apenas se for erro de rede em modo não-produtivo ou erro 500 do proxy
        console.warn("Validação via Proxy falhou. Verifique configuração.");
        return false; 
      }
    }
    
    // Modo Demo: Aceita chave longa formatada
    return key.length > 20 && key.includes('-'); 
  }

  async fetchProcessByCNJ(cnj: string): Promise<Partial<LegalCase> | null> {
    const cleanCNJ = cnj.replace(/[-.]/g, '');
    
    if (!isSupabaseConfigured || !supabase) {
      // Modo Demo
      await new Promise(r => setTimeout(r, 1000));
      return this.getMockData(cnj);
    }

    try {
      const { data, error } = await supabase.functions.invoke('datajud-proxy', {
        body: { action: 'search', cnj: cleanCNJ }
      });

      if (error) throw new Error(`Erro DataJud Proxy: ${error.message}`);
      if (!data || data.error) throw new Error(data?.error || 'Erro na API DataJud');

      if (data.hits && data.hits.hits.length > 0) {
        return this.mapResponseToCase(data.hits.hits[0]._source, cnj);
      }
      
      return null;

    } catch (error) {
      console.error("DataJud Fetch Error:", error);
      // NÃO retornar mock automaticamente em caso de erro real para evitar confusão em produção
      throw error;
    }
  }

  private mapCategory(classe: string, assunto: string): LegalCategory {
    const text = (classe + ' ' + assunto).toLowerCase();
    if (text.includes('trabalhista') || text.includes('trabalho')) return 'Trabalhista';
    if (text.includes('família') || text.includes('divórcio')) return 'Família';
    if (text.includes('criminal') || text.includes('penal')) return 'Penal';
    if (text.includes('consumidor')) return 'Consumidor';
    if (text.includes('tributário') || text.includes('fiscal')) return 'Tributário';
    if (text.includes('execução') || text.includes('cível')) return 'Cível';
    return 'Outro';
  }

  private mapResponseToCase(source: any, cnj: string): Partial<LegalCase> {
    const movements: CaseMovement[] = (source.movimentos || []).map((mov: any) => ({
      id: `mov-${Math.random().toString(36).substr(2, 9)}`,
      title: mov.nome || 'Movimentação',
      date: new Date(mov.dataHora).toLocaleString('pt-BR'),
      description: mov.complementosTabelados?.map((c: any) => `${c.nome}: ${c.valor}`).join('; ') || mov.nome,
      type: 'Andamento',
      author: 'DataJud'
    }));

    const classe = source.classe?.nome || '';
    const assunto = source.assuntos?.[0]?.nome || '';

    return {
      cnj: source.numeroProcesso,
      title: assunto ? `Ação de ${assunto}` : `Processo ${classe}`,
      category: this.mapCategory(classe, assunto),
      court: source.orgaoJulgador?.nome || 'Tribunal',
      distributionDate: source.dataAjuizamento,
      status: CaseStatus.ACTIVE,
      movements: movements,
      lastUpdate: new Date().toISOString()
    };
  }

  private getMockData(cnj: string): Partial<LegalCase> {
    return {
        cnj: cnj,
        title: 'Ação Cível (Dados Demo)',
        category: 'Cível',
        court: 'TJSP - Foro Central',
        distributionDate: new Date().toISOString(),
        status: CaseStatus.ACTIVE,
        value: 50000,
        responsibleLawyer: 'Advogado Responsável',
        movements: [
            {
                id: `mov-sim-${Date.now()}`,
                title: 'Conclusos para Despacho',
                date: new Date().toLocaleString('pt-BR'),
                description: 'Movimentação simulada (Modo Demo).',
                type: 'Andamento',
                author: 'Sistema'
            }
        ],
        lastUpdate: new Date().toISOString()
     };
  }
}

export const dataJudService = new DataJudService();
