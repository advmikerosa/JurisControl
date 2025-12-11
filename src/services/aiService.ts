
import { GoogleGenAI } from "@google/genai";

class AiService {
  private ai: GoogleGenAI | null = null;
  private model: string = "gemini-2.5-flash";

  constructor() {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (apiKey && apiKey !== 'sua_chave_aqui') {
      this.ai = new GoogleGenAI({ apiKey: apiKey });
    } else {
      console.warn("AI Service: VITE_API_KEY não configurada ou inválida.");
    }
  }

  async sendMessageStream(history: { role: string; parts: { text: string }[] }[], message: string) {
    if (!this.ai) {
      // Retorna um gerador assíncrono mockado para evitar crash na UI
      return {
        async *[Symbol.asyncIterator]() {
          yield { text: "⚠️ A chave de API da IA não está configurada no arquivo .env." };
        }
      };
    }

    try {
      const chat = this.ai.chats.create({
        model: this.model,
        history: history,
        config: {
          systemInstruction: "Você é o JurisAI, um assistente jurídico virtual integrado ao sistema JurisControl. Sua função é auxiliar advogados e gestores com resumos de processos, redação de rascunhos de e-mails, explicações de termos jurídicos, sugestões de estratégia e organização de tarefas. Responda sempre de forma profissional, concisa e em Português do Brasil. Use formatação Markdown (negrito, listas) para facilitar a leitura.",
        },
      });

      return await chat.sendMessageStream({ message });
    } catch (error) {
      console.error("Erro ao comunicar com a IA:", error);
      throw error;
    }
  }
}

export const aiService = new AiService();
