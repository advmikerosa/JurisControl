
// Serviço de IA desativado conforme solicitado.
// Mantido objeto vazio para evitar quebras em importações legadas, se houver.
export const aiService = {
  sendMessageStream: async () => { 
    console.warn("AI Service is disabled");
    return []; 
  }
};
