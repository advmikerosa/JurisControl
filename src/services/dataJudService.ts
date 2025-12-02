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
  
  /**
   * Valida a API Key. 
   * Se estiver usando Supabase, validamos via função segura.
   * Se estiver offline/demo, fazemos uma validação básica de formato.
   */
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
        console.warn("Falha ao validar via Proxy, assumindo válido para Demo/Teste se formato correto.");
        return true; 
      }
    }
    
    return true; // Fallback para modo demo
  }

  /**
   * Busca dados de um processo pelo CNJ.
   * Utiliza Supabase Edge Function para evitar CORS e proteger a API Key.
   */
  async fetchProcessByCNJ(cnj: string): Promise<Partial<LegalCase> | null> {
    // Limpeza básica do CNJ
    const cleanCNJ = cnj.replace(/[-.]/g, '');
    
    // 1. Modo DEMO / Offline (Sem Supabase)
    if (!isSupabaseConfigured || !supabase) {
      console.warn("Modo Demo: Retornando dados simulados do DataJud.");
      // Simula um delay de rede
      await new Promise(r => setTimeout(r, 1000));
      return this.getMockData(cnj);
    }

    // 2. Modo Produção (Via Proxy Seguro)
    try {
      const { data, error } = await supabase.functions.invoke('datajud-proxy', {
        body: { 
          action: 'search', 
          cnj: cleanCNJ 
        }
      });

      if (error) {
        throw new Error(`Erro na comunicação com servidor: ${error.message}`);
      }

      if (!data || data.error) {
        throw new Error(data?.error || 'Processo não encontrado ou erro na API do DataJud.');
      }

      // Se a função retornou os dados brutos do DataJud, mapeamos aqui
      if (data.hits && data.hits.hits.length > 0) {
        return this.mapResponseToCase(data.hits.hits[0]._source, cnj);
      }
      
      return null;

    } catch (error) {
      console.error("DataJud Proxy Error:", error);
      // Fallback gracioso para dados mockados em caso de erro de configuração na demonstração
      const settings = storageService.getSettings();
      if (settings.general.dataJudApiKey && settings.general.dataJudApiKey.length > 20) {
         return this.getMockData(cnj);
      }
      throw error;
    }
  }

  private mapCategory(classe: string, assunto: string): LegalCategory {
    const text = (classe + ' ' + assunto).toLowerCase();
    if (text.includes('trabalhista') || text.includes('trabalho')) return 'Trabalhista';
    if (text.includes('família') || text.includes('divórcio') || text.includes('alimentos')) return 'Família';
    if (text.includes('criminal') || text.includes('penal')) return 'Penal';
    if (text.includes('consumidor')) return 'Consumidor';
    if (text.includes('tributário') || text.includes('fiscal')) return 'Tributário';
    if (text.includes('execução') || text.includes('cível') || text.includes('contrato')) return 'Cível';
    return 'Outro';
  }

  private mapResponseToCase(source: any, cnj: string): Partial<LegalCase> {
    const movements: CaseMovement[] = (source.movimentos || []).map((mov: any) => ({
      id: `mov-${Math.random().toString(36).substr(2, 9)}`,
      title: mov.nome || 'Movimentação',
      date: new Date(mov.dataHora).toLocaleString('pt-BR'),
      description: mov.complementosTabelados?.map((c: any) => `${c.nome}: ${c.valor}`).join('; ') || mov.nome,
      type: 'Andamento',
      author: 'DataJud (Oficial)'
    })).sort((a: any, b: any) => {
        // Tenta ordenar por data descrescente
        try {
            const dateA = new Date(a.date.split(' ')[0].split('/').reverse().join('-')).getTime();
            const dateB = new Date(b.date.split(' ')[0].split('/').reverse().join('-')).getTime();
            return dateB - dateA;
        } catch { return 0; }
    });

    const classe = source.classe?.nome || '';
    const assunto = source.assuntos?.[0]?.nome || '';

    return {
      cnj: source.numeroProcesso,
      title: assunto ? `Ação de ${assunto}` : `Processo ${classe}`,
      category: this.mapCategory(classe, assunto),
      court: source.orgaoJulgador?.nome || 'Tribunal não identificado',
      distributionDate: source.dataAjuizamento ? new Date(source.dataAjuizamento).toISOString() : undefined,
      status: CaseStatus.ACTIVE,
      movements: movements,
      lastUpdate: new Date().toISOString()
    };
  }

  private getMockData(cnj: string): Partial<LegalCase> {
    return {
        cnj: cnj,
        title: 'Ação Cível (Dados Simulados via DataJud Mock)',
        category: 'Cível',
        court: 'TJSP - Foro Central Cível',
        distributionDate: new Date().toISOString(),
        status: CaseStatus.ACTIVE,
        value: 50000,
        responsibleLawyer: 'Advogado Responsável',
        movements: [
            {
                id: `mov-sim-${Date.now()}`,
                title: 'Conclusos para Despacho (Simulado)',
                date: new Date().toLocaleString('pt-BR'),
                description: 'Simulação: Conexão direta bloqueada ou chave não configurada no backend. Dados fictícios carregados para demonstração.',
                type: 'Andamento',
                author: 'Sistema'
            },
            {
                id: `mov-sim-2-${Date.now()}`,
                title: 'Petição Inicial',
                date: new Date(Date.now() - 86400000).toLocaleString('pt-BR'),
                description: 'Protocolo da inicial.',
                type: 'Petição',
                author: 'Sistema'
            }
        ],
        lastUpdate: new Date().toISOString()
     };
  }
}

export const dataJudService = new DataJudService();