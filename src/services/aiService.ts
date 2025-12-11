
import { GoogleGenAI, Chat } from "@google/genai";

class AiService {
  private ai: GoogleGenAI | null = null;
  private modelName: string = "gemini-2.5-flash";

  constructor() {
    // A chave é injetada via vite.config.ts no process.env.API_KEY
    if (process.env.API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
      console.warn("JurisAI: API Key não encontrada. O assistente funcionará em modo limitado.");
    }
  }

  /**
   * Envia uma mensagem para o modelo e retorna um stream de resposta.
   */
  async sendMessageStream(history: { role: string; parts: { text: string }[] }[], message: string) {
    if (!this.ai) {
      throw new Error("API Key do Google não configurada.");
    }

    try {
      // Converte o histórico para o formato esperado pelo SDK, se necessário
      // O SDK espera 'user' e 'model'.
      const chat: Chat = this.ai.chats.create({
        model: this.modelName,
        history: history,
        config: {
          systemInstruction: "Você é o JurisAI, um assistente jurídico sênior integrado ao sistema JurisControl. Sua função é auxiliar advogados, estagiários e gestores. Você pode resumir processos, redigir minutas de e-mail, explicar termos jurídicos complexos, sugerir estratégias processuais e analisar prazos. Responda sempre de forma profissional, direta e em Português do Brasil (PT-BR). Use formatação Markdown (negrito, listas, blocos de código) para facilitar a leitura. Se não souber algo, admita. Não invente leis.",
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
        },
      });

      return await chat.sendMessageStream({ message });
    } catch (error) {
      console.error("Erro na comunicação com JurisAI:", error);
      throw error;
    }
  }
}

export const aiService = new AiService();
