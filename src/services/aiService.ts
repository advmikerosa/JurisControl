import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ExtractedMovementData, Priority } from '../types';

// Interface para chunks de resposta do chat
interface AiResponseChunk {
  text: string;
}

class AiService {
  private ai: GoogleGenAI | null = null;
  private modelText: string = "gemini-2.5-flash";
  private modelVision: string = "gemini-2.5-flash";

  constructor() {
    // Tenta inicializar com a chave do ambiente (Vite injeta process.env.API_KEY via define ou import.meta)
    const apiKey = process.env.API_KEY || (import.meta.env && import.meta.env.VITE_API_KEY);
    
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn("JurisAI: API_KEY não encontrada. O assistente funcionará em modo DEMO.");
    }
  }

  /**
   * Envia uma mensagem para o modelo em modo chat com histórico.
   */
  async *sendMessageStream(history: { role: string; parts: { text: string }[] }[], message: string): AsyncGenerator<AiResponseChunk> {
    if (this.ai) {
      try {
        const chat = this.ai.chats.create({
          model: this.modelText,
          history: history,
          config: {
            systemInstruction: "Você é o JurisAI, um assistente jurídico sênior do sistema JurisControl. Responda de forma concisa, profissional e em PT-BR. Use Markdown.",
          },
        });

        const result = await chat.sendMessageStream({ message });
        
        for await (const chunk of result) {
          const c = chunk as GenerateContentResponse;
          if (c.text) {
            yield { text: c.text };
          }
        }
      } catch (error) {
        console.error("JurisAI Error:", error);
        yield { text: "⚠️ Erro ao conectar com a IA. Verifique sua chave de API ou conexão." };
      }
    } else {
      // MOCK MODE
      const mockResponse = `[MODO DEMO] Olá! A chave da API do Gemini não foi configurada no arquivo .env (VITE_API_KEY). \n\nSua mensagem: "${message}" foi processada localmente. \n\nPara ativar a IA real, configure a variável de ambiente.`;
      
      const chunks = mockResponse.split(/(.{5})/g).filter(Boolean);
      for (const chunk of chunks) {
        await new Promise(r => setTimeout(r, 20));
        yield { text: chunk };
      }
    }
  }

  /**
   * Analisa um documento (Imagem) para extrair dados.
   * Nota: PDF parsing real requereria conversão para imagem ou texto no cliente antes de enviar ao Gemini Flash.
   * Aqui assumimos que recebemos base64 de imagem ou texto extraído.
   */
  async analyzeLegalDocument(base64Data: string, mimeType: string): Promise<ExtractedMovementData> {
    if (this.ai) {
        try {
            // Se for PDF, o Gemini 1.5/2.0+ aceita nativamente se passar como inlineData application/pdf
            // Mas para segurança e compatibilidade do flash-2.5, focamos em imagens ou texto.
            
            const prompt = `Analise este documento jurídico. Extraia:
            1. Tipo do documento (Decisão, Sentença, Petição, etc).
            2. Data do documento.
            3. Título curto.
            4. Resumo de 1 parágrafo.
            5. Prazos identificados (título, data no formato YYYY-MM-DD, prioridade).
            
            Retorne APENAS um JSON válido com esta estrutura:
            {
              "type": "string",
              "date": "YYYY-MM-DD",
              "title": "string",
              "summary": "string",
              "confidence": number (0-100),
              "deadlines": [{"title": "string", "date": "YYYY-MM-DD", "priority": "Alta"|"Média"|"Baixa", "description": "string"}]
            }`;

            const response = await this.ai.models.generateContent({
                model: this.modelVision,
                contents: {
                    parts: [
                        { inlineData: { mimeType, data: base64Data } },
                        { text: prompt }
                    ]
                },
                config: {
                    responseMimeType: "application/json"
                }
            });

            const text = response.text;
            if (!text) throw new Error("Sem resposta da IA");
            
            return JSON.parse(text) as ExtractedMovementData;

        } catch (error) {
            console.error("Erro na análise de documento com IA:", error);
            throw error;
        }
    }

    // MOCK DATA
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                type: 'Decisão',
                date: new Date().toISOString().split('T')[0],
                title: 'Decisão Interlocutória (Simulada)',
                summary: 'Deferimento parcial da tutela de urgência (Demo). Configure a API Key para análise real.',
                confidence: 95,
                deadlines: [
                    {
                        title: 'Prazo para Recurso',
                        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        priority: Priority.HIGH,
                        description: 'Prazo de 15 dias úteis.'
                    }
                ]
            });
        }, 2000);
    });
  }
}

export const aiService = new AiService();