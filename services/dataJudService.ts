
import { LegalCase, CaseMovement, CaseStatus, LegalCategory } from '../types';
import { storageService } from './storageService';

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

// Mapa de tribunais para endpoints da API Pública
// Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
// J (Justiça): 8 = Estadual, 4 = Federal, 5 = Trabalho
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
  '5.00': 'https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search', // TST (Fallback teste)
};

class DataJudService {
  
  private getApiKey(): string | undefined {
    const settings = storageService.getSettings();
    return settings.general.dataJudApiKey;
  }

  private getEndpointByCNJ(cnj: string): string | null {
    const cleanCNJ = cnj.replace(/\D/g, '');
    if (cleanCNJ.length < 20) return null;

    // NNNNNNNDDAAAA J TR OOOO
    // J = índice 13
    // TR = índice 14, 15
    const j = cleanCNJ.substring(13, 14);
    const tr = cleanCNJ.substring(14, 16);
    const key = `${j}.${tr}`;

    return TRIBUNAL_ENDPOINTS[key] || null;
  }

  private mapCategory(dataJudClass: string): LegalCategory {
    const lower = dataJudClass ? dataJudClass.toLowerCase() : '';
    if (lower.includes('execução') || lower.includes('monitória') || lower.includes('cobrança')) return 'Cível';
    if (lower.includes('trabalhista') || lower.includes('trabalho')) return 'Trabalhista';
    if (lower.includes('família') || lower.includes('divórcio') || lower.includes('alimentos')) return 'Família';
    if (lower.includes('tributário') || lower.includes('fiscal')) return 'Tributário';
    if (lower.includes('penal') || lower.includes('crime') || lower.includes('criminal')) return 'Penal';
    if (lower.includes('previdenciário') || lower.includes('inss')) return 'Previdenciário';
    if (lower.includes('consumidor')) return 'Consumidor';
    if (lower.includes('administrativo')) return 'Administrativo';
    return 'Outro';
  }

  /**
   * Testa se a API Key é válida fazendo uma requisição dummy ao TST.
   */
  async validateApiKey(key: string): Promise<boolean> {
    const endpoint = TRIBUNAL_ENDPOINTS['5.00']; // TST Endpoint
    const queryBody = {
      "query": {
        "match": {
          "numeroProcesso": "00000000000000000000" // Dummy CNJ
        }
      }
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

      // Se retornar 200 (mesmo sem resultados), a chave é válida.
      // Se retornar 401 ou 403, a chave é inválida.
      return response.status === 200;
    } catch (error) {
      console.error("Validation Error:", error);
      return false;
    }
  }

  async fetchProcessByCNJ(cnj: string): Promise<Partial<LegalCase> | null> {
    const apiKey = this.getApiKey();
    
    if (!apiKey) {
      throw new Error('API Key do DataJud não configurada. Vá em Configurações > Preferências.');
    }

    const endpoint = this.getEndpointByCNJ(cnj);
    if (!endpoint) {
      throw new Error('Tribunal não suportado ou CNJ inválido para busca automática.');
    }

    // ElasticSearch query
    const queryBody = {
      "query": {
        "match": {
          "numeroProcesso": cnj.replace(/[-.]/g, '') 
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

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Chave de API inválida ou expirada.');
        }
        throw new Error(`Erro na comunicação com DataJud: ${response.statusText}`);
      }

      const data: DataJudResponse = await response.json();

      if (!data.hits || data.hits.hits.length === 0) {
        return null;
      }

      const processData = data.hits.hits[0]._source;

      // Mapeamento de Movimentações
      const movements: CaseMovement[] = (processData.movimentos || []).map(mov => ({
        id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: mov.nome || 'Movimentação',
        date: new Date(mov.dataHora).toLocaleString('pt-BR'),
        description: mov.complementosTabelados?.map(c => `${c.nome}: ${c.valor}`).join('; ') || mov.nome,
        type: 'Andamento' as const,
        author: 'DataJud'
      })).sort((a, b) => {
         // Sort por data decrescente
         const dateA = new Date(a.date.split(' ')[0].split('/').reverse().join('-')).getTime();
         const dateB = new Date(b.date.split(' ')[0].split('/').reverse().join('-')).getTime();
         return dateB - dateA;
      });

      const assunto = processData.assuntos?.[0]?.nome || '';
      const classe = processData.classe?.nome || '';

      return {
        cnj: processData.numeroProcesso,
        title: assunto ? `Ação de ${assunto}` : `Processo ${classe}`,
        category: this.mapCategory(classe || assunto),
        court: processData.orgaoJulgador?.nome || 'Tribunal não identificado',
        distributionDate: processData.dataAjuizamento ? new Date(processData.dataAjuizamento).toISOString() : undefined,
        status: CaseStatus.ACTIVE,
        movements: movements,
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      console.error("DataJud Error:", error);
      throw error;
    }
  }
}

export const dataJudService = new DataJudService();
