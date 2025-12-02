
import { GoogleGenAI, Chat, Type } from "@google/genai";
import { ExtractedMovementData } from '../types';

class AiService {
  private ai: GoogleGenAI;
  private model: string = "gemini-2.5-flash"; 

  constructor() {
    // SECURITY WARNING: In a production environment, API keys should not be exposed on the client side.
    // Recommended: Move this logic to a Supabase Edge Function or a backend proxy.
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.warn("JurisAI: API Key não encontrada. As funcionalidades de IA estarão indisponíveis.");
    }

    this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  /**
   * Envia uma mensagem para o modelo em modo chat com histórico.
   * Utiliza streaming para resposta em tempo real.
   */
  async sendMessageStream(history: { role: string; parts: { text: string }[] }[], message: string) {
    try {
      const chat: Chat = this.ai.chats.create({
        model: this.model,
        history: history,
        config: {
          systemInstruction: "Você é o JurisAI, um assistente jurídico virtual integrado ao sistema JurisControl. Sua função é auxiliar advogados e gestores com resumos de processos, redação de rascunhos de e-mails, explicações de termos jurídicos, sugestões de estratégia e organização de tarefas. Responda sempre de forma profissional, concisa e em Português do Brasil. Use formatação Markdown (negrito, listas) para facilitar a leitura. Se o usuário perguntar sobre dados específicos do escritório, explique que você é uma IA generativa e não tem acesso direto ao banco de dados em tempo real por questões de privacidade.",
        },
      });

      return await chat.sendMessageStream({ message });
    } catch (error) {
      console.error("JurisAI: Erro de comunicação com a API.", error);
      throw error;
    }
  }

  /**
   * Analisa um documento (Imagem ou PDF) para extrair dados da movimentação processual.
   * Realiza OCR e Extração Estruturada em uma única etapa.
   */
  async analyzeLegalDocument(base64Data: string, mimeType: string): Promise<ExtractedMovementData> {
    try {
      // Configuração do Schema para garantir retorno JSON estrito
      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          type: { 
            type: Type.STRING, 
            description: "Tipo da movimentação: Andamento, Despacho, Petição, Audiência, Nota, Sentença ou Decisão",
            enum: ["Andamento", "Despacho", "Petição", "Audiência", "Nota", "Sentença", "Decisão"]
          },
          date: { type: Type.STRING, description: "Data da movimentação no formato YYYY-MM-DD" },
          title: { type: Type.STRING, description: "Título resumido da movimentação (ex: Decisão Interlocutória)" },
          summary: { type: Type.STRING, description: "Resumo objetivo do conteúdo em até 300 caracteres" },
          value: { type: Type.NUMBER, description: "Valor monetário mencionado se houver condenação ou acordo (opcional)" },
          confidence: { type: Type.NUMBER, description: "Nível de confiança da extração (0-100)" },
          deadlines: {
            type: Type.ARRAY,
            description: "Lista de prazos ou tarefas identificadas no documento",
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Título do prazo (ex: Prazo para Recurso)" },
                date: { type: Type.STRING, description: "Data fatal do prazo YYYY-MM-DD. Se for em dias úteis, calcule a estimativa." },
                priority: { type: Type.STRING, enum: ["Alta", "Média", "Baixa"] },
                description: { type: Type.STRING, description: "Detalhes sobre o prazo" }
              },
              required: ["title", "date", "priority"]
            }
          }
        },
        required: ["type", "date", "title", "summary", "confidence", "deadlines"]
      };

      const prompt = `
        Analise o documento jurídico fornecido (OCR + Interpretação).
        Identifique o tipo de movimentação, resuma o conteúdo e, PRINCIPALMENTE, identifique se há prazos processuais ou tarefas requeridas.
        
        Regras para Prazos:
        1. Se houver menção a "prazo de X dias", calcule a data estimada a partir da data do documento (considere hoje se não houver data explícita).
        2. Se for uma Sentença ou Decisão com condenação, marque prioridade Alta.
        3. Formate valores monetários como número (float).
        4. O resumo deve ser profissional e direto.
      `;

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType, data: base64Data } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1 // Baixa temperatura para maior precisão factual
        }
      });

      if (!response.text) {
        throw new Error("Não foi possível extrair texto do documento.");
      }

      return JSON.parse(response.text) as ExtractedMovementData;

    } catch (error) {
      console.error("Erro na análise de documento com IA:", error);
      throw error;
    }
  }
}

export const aiService = new AiService();
