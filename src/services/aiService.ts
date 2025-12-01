import { GoogleGenAI, Chat } from "@google/genai";

class AiService {
  private ai: GoogleGenAI;
  private model: string = "gemini-2.5-flash";

  constructor() {
    // Inicialização utilizando a variável de ambiente process.env.API_KEY conforme diretrizes estritas.
    // A variável é injetada pelo Vite via define no vite.config.ts.
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
}

export const aiService = new AiService();
