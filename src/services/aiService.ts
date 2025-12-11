
// AI Service Removed due to dependency issues
class AiService {
  async sendMessageStream(history: any[], message: string) {
    console.warn("AI Service is disabled.");
    return {
      async *[Symbol.asyncIterator]() {
        yield { text: "O assistente de IA foi desativado temporariamente." };
      }
    };
  }
}

export const aiService = new AiService();
