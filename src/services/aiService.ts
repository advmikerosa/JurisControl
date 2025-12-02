import { supabase, isSupabaseConfigured } from './supabase';
import { ExtractedMovementData, Priority } from '../types';

// Interface para chunks de resposta do chat
interface AiResponseChunk {
  text: string;
}

class AiService {
  /**
   * Envia uma mensagem para o modelo em modo chat com histórico.
   * Utiliza Supabase Edge Function para proteger a API Key.
   */
  async *sendMessageStream(history: { role: string; parts: { text: string }[] }[], message: string): AsyncGenerator<AiResponseChunk> {
    if (isSupabaseConfigured && supabase) {
      try {
        // Chamada à Edge Function 'juris-ai'
        const { data, error } = await supabase.functions.invoke('juris-ai', {
          body: { action: 'chat', history, message },
          responseType: 'stream', // Habilita streaming se a função suportar
        });

        if (error) throw error;

        // Se a resposta for um ReadableStream (streaming real do backend)
        if (data && data.body) {
            const reader = data.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                // Assume que o backend envia texto puro ou SSE
                yield { text: chunk };
            }
        } else {
            // Fallback para resposta única se não houver stream
            yield { text: data.text || "Resposta recebida." };
        }

      } catch (error) {
        console.error("JurisAI: Erro de comunicação com o backend.", error);
        yield { text: "⚠️ Erro de conexão. Verifique se a Edge Function 'juris-ai' está implantada." };
      }
    } else {
      // MOCK MODE (Para demonstração segura sem backend)
      const mockResponse = `[MODO DEMO] Olá! Como o backend seguro não está conectado, estou simulando esta resposta. Em produção, sua mensagem "${message}" seria processada pela IA via Supabase Edge Functions para garantir a segurança dos dados.`;
      
      // Simula o efeito de digitação
      const chunks = mockResponse.split(/(.{5})/g).filter(Boolean); // Divide em pedaços de 5 caracteres
      for (const chunk of chunks) {
        await new Promise(r => setTimeout(r, 30)); // Delay artificial
        yield { text: chunk };
      }
    }
  }

  /**
   * Analisa um documento (Imagem ou PDF) para extrair dados da movimentação processual.
   * Delega o OCR e extração para o Backend Seguro.
   */
  async analyzeLegalDocument(base64Data: string, mimeType: string): Promise<ExtractedMovementData> {
    if (isSupabaseConfigured && supabase) {
        try {
            const { data, error } = await supabase.functions.invoke('juris-ai', {
                body: { action: 'analyze', fileData: base64Data, mimeType }
            });

            if (error) throw new Error(error.message);
            return data as ExtractedMovementData;

        } catch (error) {
            console.error("Erro na análise de documento com IA:", error);
            throw error;
        }
    }

    // MOCK DATA (Retorno simulado para testes de UI)
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                type: 'Decisão',
                date: new Date().toISOString().split('T')[0],
                title: 'Decisão Interlocutória (Simulada)',
                summary: 'Deferimento parcial da tutela de urgência. Esta é uma análise simulada pois a API Key não está exposta no cliente.',
                confidence: 95,
                deadlines: [
                    {
                        title: 'Prazo para Recurso',
                        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +15 dias
                        priority: Priority.HIGH,
                        description: 'Prazo fatal de 15 dias úteis para Agravo de Instrumento.'
                    }
                ]
            });
        }, 2000);
    });
  }
}

export const aiService = new AiService();