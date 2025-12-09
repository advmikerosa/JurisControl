
// Serviço de IA desativado
class AiService {
  async sendMessageStream(history: any[], message: string) {
    console.warn("AI Service is disabled.");
    return {
      async *[Symbol.asyncIterator]() {
        yield { text: "O assistente de IA está desativado no momento." };
      }
    };
  }
}

export const aiService = new AiService();
