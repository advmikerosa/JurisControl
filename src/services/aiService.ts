
import { GoogleGenAI } from "@google/genai";

class AiService {
  private ai: GoogleGenAI;
  private model: string = "gemini-2.5-flash";

  constructor() {
    // Uses VITE_API_KEY if present, otherwise expects a key to be provided elsewhere or fails gracefully
    const apiKey = import.meta.env.VITE_API_KEY || ''; 
    this.ai = new GoogleGenAI({ apiKey });
  }

  async sendMessageStream(history: { role: string; parts: { text: string }[] }[], message: string) {
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
