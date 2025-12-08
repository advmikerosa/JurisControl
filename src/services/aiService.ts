
// Serviço de IA desativado para versão de produção/demo sem dependências externas pesadas.
export const aiService = {
  // Métodos mantidos como placeholder para evitar quebra de referências antigas não refatoradas,
  // mas agora retornam null ou vazio.
  async sendMessageStream() {
    return {
      async *[Symbol.asyncIterator]() {
        yield { text: "O assistente de IA está desativado nesta versão." };
      }
    };
  },

  async analyzeLegalDocument() {
    return null;
  }
};
