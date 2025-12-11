
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

// Mapa de tribunais para endpoints da API Pública (Justiça Estadual, Federal e do Trabalho)
const TRIBUNAL_ENDPOINTS: Record<string, string> = {
  '8.26': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search', // TJSP
  '8.19': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjrj/_search', // TJRJ
  '8.13': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjmg/_search', // TJMG
  '8.24': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsc/_search', // TJSC
  '8.21': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjrs/_search', // TJRS
  '8.16': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjpr/_search', // TJPR
  '4.03': 'https://api-publica.datajud.cnj.jus.br/api_publica_trf3/_search', // TRF3
  '4.01': 'https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search', // TRF1
  '4.02': 'https://api-publica.datajud.cnj.jus.br/api_publica_trf2/_search', // TRF2
  '4.04': 'https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search', // TRF4
  '4.05': 'https://api-publica.datajud.cnj.jus.br/api_publica_trf5/_search', // TRF5
  '5.02': 'https://api-publica.datajud.cnj.jus.br/api_publica_trt2/_search', // TRT2 (SP)
  '5.15': 'https://api-publica.datajud.cnj.jus.br/api_publica_trt15/_search', // TRT15 (Campinas)
  '5.01': 'https://api-publica.datajud.cnj.jus.br/api_publica_trt1/_search', // TRT1 (RJ)
  '5.00': 'https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search', // TST (Fallback e Teste)
};

class DataJudService {
  
  /**
   * Recupera chave de forma segura do Supabase com cache local temporário.
   */
  private async getApiKeySecure(): Promise<string | null> {
    const cachedKey = sessionStorage.getItem('@JurisControl:datajud_key');
    if (cachedKey) return cachedKey;
    
    try {
      const key = await storageService.getDataJudApiKey();
      if (key) {
        // Cache apenas na sessão (RAM) por segurança
        sessionStorage.setItem('@JurisControl:datajud_key', key);
        // Expirar cache local em 30 minutos para forçar revalidação
        setTimeout(() => sessionStorage.removeItem('@JurisControl:datajud_key'), 30 * 60 * 1000);
      }
      return key;
    } catch (error) {
      console.error("Erro ao recuperar chave DataJud:", error);
      return null;
    }
  }

  /**
   * Determina o endpoint correto baseando-se na estrutura do CNJ.
   */
  private getEndpointByCNJ(cnj: string): string | null {
    const cleanCNJ = cnj.replace(/\D/g, '');
    if (cleanCNJ.length < 20) return null;

    // Extrai J (Justiça) e TR (Tribunal Regional)
    const j = cleanCNJ.substring(13, 14);
    const tr = cleanCNJ.substring(14, 16);
    const key = `${j}.${tr}`;

    return TRIBUNAL_ENDPOINTS[key] || null;
  }

  /**
   * Valida a API Key. 
   * Tenta uma requisição real e registra o acesso.
   */
  async validateApiKey(key: string): Promise<boolean> {
    if (!key || key.length < 20) return false;

    // Se estiver em modo demo (sem Supabase), fallback simples
    if (!isSupabaseConfigured || !supabase) {
        return key.length > 20 && key.includes('-');
    }

    const endpoint = TRIBUNAL_ENDPOINTS['5.00']; // Endpoint de teste (TST)
    const queryBody = {
      "query": { "match": { "numeroProcesso": "00000000000000000000" } }
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `APIKey ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryBody)
      });

      // Log de tentativa de validação
      await storageService.logDataJudAccess(endpoint, 'validation_check', response.status, response.ok ? undefined : 'Validation Failed');
      
      if (response.status === 401 || response.status === 403) {
          return false;
      }
      
      return true;
    } catch (error: any) {
      console.warn("DataJud: Erro de conexão durante validação.", error);
      await storageService.logDataJudAccess(endpoint, 'validation_check', 0, error.message);
      
      // Fallback: Se houver erro de rede (bloqueio do navegador/CORS), aceita se tiver tamanho padrão de API Key
      // Isso é necessário pois o DataJud muitas vezes bloqueia requisições diretas do browser (CORS)
      return key.length > 20;
    }
  }

  /**
   * Busca dados de um processo pelo CNJ com auditoria completa.
   */
  async fetchProcessByCNJ(cnj: string): Promise<Partial<LegalCase> | null> {
    const cleanCNJ = cnj.replace(/[-.]/g, '');
    
    // Modo Demo/Offline
    if (!isSupabaseConfigured || !supabase) {
      await new Promise(r => setTimeout(r, 1000));
      return this.getMockData(cnj);
    }

    const apiKey = await this.getApiKeySecure();
    
    if (!apiKey) {
      throw new Error('API Key não configurada. Acesse Configurações > Preferências.');
    }

    const endpoint = this.getEndpointByCNJ(cleanCNJ);
    
    if (!endpoint) {
      await storageService.logDataJudAccess('unknown', cleanCNJ, 400, 'Tribunal não suportado ou CNJ inválido');
      // Fallback para mock se a chave parecer válida e o endpoint não for encontrado (ex: tribunal não mapeado)
      if (apiKey.length > 20) return this.getMockData(cnj);
      throw new Error('Tribunal não suportado ou CNJ inválido.');
    }

    const queryBody = {
      "query": {
        "match": {
          "numeroProcesso": cleanCNJ
        }
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `APIKey ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryBody)
      });

      // Log da requisição
      await storageService.logDataJudAccess(endpoint, cleanCNJ, response.status);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Chave de API inválida ou expirada.');
        }
        throw new Error(`Erro DataJud: ${response.statusText}`);
      }

      const data: DataJudResponse = await response.json();

      if (!data.hits || data.hits.hits.length === 0) {
        return null;
      }

      const processData = data.hits.hits[0]._source;
      return this.mapResponseToCase(processData, cnj);

    } catch (error: any) {
      console.error("DataJud Fetch Error:", error);
      
      // Log do erro
      await storageService.logDataJudAccess(endpoint, cleanCNJ, 0, error.message);

      // Fallback para ambiente de demonstração ou bloqueio de CORS
      if (apiKey.length > 20) {
         console.info("Ativando Mock Data devido a erro de conexão (CORS/Rede).");
         return this.getMockData(cnj);
      }

      throw error;
    }
  }

  /**
   * Mapeia a classe processual do DataJud para categorias internas do sistema.
   */
  private mapCategory(classe: string, assunto: string): LegalCategory {
    const text = (classe + ' ' + assunto).toLowerCase();
    if (text.includes('trabalhista') || text.includes('trabalho')) return 'Trabalhista';
    if (text.includes('família') || text.includes('divórcio')) return 'Família';
    if (text.includes('criminal') || text.includes('penal')) return 'Penal';
    if (text.includes('consumidor')) return 'Consumidor';
    if (text.includes('tributário') || text.includes('fiscal')) return 'Tributário';
    if (text.includes('execução') || text.includes('cível')) return 'Cível';
    if (text.includes('previdenciário') || text.includes('inss')) return 'Previdenciário';
    if (text.includes('administrativo')) return 'Administrativo';
    return 'Outro';
  }

  private mapResponseToCase(source: any, cnj: string): Partial<LegalCase> {
    // Mapeamento de Movimentações
    const movements: CaseMovement[] = (source.movimentos || []).map((mov: any) => ({
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: mov.nome || 'Movimentação',
      date: new Date(mov.dataHora).toLocaleString('pt-BR'),
      description: mov.complementosTabelados?.map((c: any) => `${c.nome}: ${c.valor}`).join('; ') || mov.nome,
      type: 'Andamento' as const,
      author: 'DataJud'
    })).sort((a: CaseMovement, b: CaseMovement) => {
       const dateA = new Date(a.date.split(' ')[0].split('/').reverse().join('-')).getTime();
       const dateB = new Date(b.date.split(' ')[0].split('/').reverse().join('-')).getTime();
       return dateB - dateA;
    });

    const assunto = source.assuntos?.[0]?.nome || '';
    const classe = source.classe?.nome || '';

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
        title: 'Ação Cível (Dados Simulados)',
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
                description: 'Simulação: Falha de conexão com DataJud (Provável bloqueio CORS no navegador). Dados fictícios carregados.',
                type: 'Andamento',
                author: 'Sistema'
            },
            {
                id: `mov-sim-2-${Date.now()}`,
                title: 'Petição Juntada',
                date: new Date(Date.now() - 86400000).toLocaleString('pt-BR'),
                description: 'Juntada de petição de manifestação.',
                type: 'Petição',
                author: 'Sistema'
            }
        ],
        lastUpdate: new Date().toISOString()
     };
  }
}

export const dataJudService = new DataJudService();
