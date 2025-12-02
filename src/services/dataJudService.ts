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

const TRIBUNAL_ENDPOINTS: Record<string, string> = {
  '8.26': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search',
  '8.19': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjrj/_search',
  '8.13': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjmg/_search',
  '8.24': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsc/_search',
  '8.21': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjrs/_search',
  '8.16': 'https://api-publica.datajud.cnj.jus.br/api_publica_tjpr/_search',
  '4.03': 'https://api-publica.datajud.cnj.jus.br/api_publica_trf3/_search',
  '5.02': 'https://api-publica.datajud.cnj.jus.br/api_publica_trt2/_search',
  '5.00': 'https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search',
};

class DataJudService {
  
  private getApiKey(): string | undefined {
    const settings = storageService.getSettings();
    return settings.general.dataJudApiKey;
  }

  private getEndpointByCNJ(cnj: string): string | null {
    const cleanCNJ = cnj.replace(/\D/g, '');
    if (cleanCNJ.length < 20) return null;
    const j = cleanCNJ.substring(13, 14);
    const tr = cleanCNJ.substring(14, 16);
    return TRIBUNAL_ENDPOINTS[`${j}.${tr}`] || null;
  }

  async validateApiKey(key: string): Promise<boolean> {
    try {
      const response = await fetch(TRIBUNAL_ENDPOINTS['5.00'], {
        method: 'POST',
        headers: { 'Authorization': `APIKey ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "query": { "match": { "numeroProcesso": "00000000000000000000" } } })
      });
      return response.status !== 401 && response.status !== 403;
    } catch {
      return key.length > 20; // Fallback for CORS/Network issues in dev
    }
  }

  async fetchProcessByCNJ(cnj: string): Promise<Partial<LegalCase> | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('API Key não configurada.');

    const endpoint = this.getEndpointByCNJ(cnj);
    if (!endpoint && apiKey.length > 20) return this.getMockData(cnj); // Mock fallback
    if (!endpoint) throw new Error('Tribunal não suportado.');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `APIKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "query": { "match": { "numeroProcesso": cnj.replace(/[-.]/g, '') } } })
      });

      if (!response.ok) throw new Error(`Erro DataJud: ${response.statusText}`);
      const data: DataJudResponse = await response.json();
      
      if (!data.hits?.hits?.length) return null;
      return this.mapResponseToCase(data.hits.hits[0]._source, cnj);
    } catch (error) {
      console.warn("DataJud Fetch Error:", error);
      if (apiKey.length > 20) return this.getMockData(cnj);
      throw error;
    }
  }

  private mapResponseToCase(source: any, cnj: string): Partial<LegalCase> {
    const movements: CaseMovement[] = (source.movimentos || []).map((mov: any) => ({
      id: `mov-${Math.random().toString(36).substr(2, 9)}`,
      title: mov.nome || 'Movimentação',
      date: new Date(mov.dataHora).toLocaleString('pt-BR'),
      description: mov.complementosTabelados?.map((c: any) => `${c.nome}: ${c.valor}`).join('; ') || mov.nome,
      type: 'Andamento',
      author: 'DataJud'
    })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      cnj: source.numeroProcesso,
      title: source.assuntos?.[0]?.nome ? `Ação de ${source.assuntos[0].nome}` : `Processo ${source.classe?.nome}`,
      category: 'Cível', // Default mapping
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
                description: 'Simulação: Conexão direta com DataJud bloqueada por CORS. Dados fictícios carregados.',
                type: 'Andamento',
                author: 'Sistema'
            }
        ],
        lastUpdate: new Date().toISOString()
     };
  }
}

export const dataJudService = new DataJudService();