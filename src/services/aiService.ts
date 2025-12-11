
// Serviço de IA desativado.
// Este arquivo é mantido apenas como placeholder para evitar erros de importação legada, 
// caso existam referências residuais em branches antigos.

class AiService {
  async sendMessageStream(history: any[], message: string) {
    console.warn("AI Service is disabled.");
    return {
      [Symbol.asyncIterator]: async function* () {
        yield { text: "O serviço de IA está desativado." };
      }
    };
  }
}

export const aiService = new AiService();
