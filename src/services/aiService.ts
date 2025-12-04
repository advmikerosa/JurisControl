import { GoogleGenAI, GenerateContentResponse, LiveServerMessage, Modality, Blob } from "@google/genai";
import { ExtractedMovementData, Priority } from '../types';

// Interface para chunks de resposta do chat
interface AiResponseChunk {
  text: string;
}

class AiService {
  private ai: GoogleGenAI | null = null;
  private modelText: string = "gemini-2.5-flash";
  private modelVision: string = "gemini-2.5-flash-image";
  private modelLive: string = "gemini-2.5-flash-native-audio-preview-09-2025";

  // Live Session State
  private liveSession: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private nextStartTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  constructor() {
    const apiKey = process.env.API_KEY || (import.meta.env && import.meta.env.VITE_API_KEY);
    
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn("JurisAI: API_KEY não encontrada. O assistente funcionará em modo DEMO.");
    }
  }

  /**
   * Envia uma mensagem para o modelo em modo chat com histórico.
   */
  async *sendMessageStream(history: { role: string; parts: { text: string }[] }[], message: string): AsyncGenerator<AiResponseChunk> {
    if (this.ai) {
      try {
        const chat = this.ai.chats.create({
          model: this.modelText,
          history: history,
          config: {
            systemInstruction: "Você é o JurisAI, um assistente jurídico sênior do sistema JurisControl. Responda de forma concisa, profissional e em PT-BR. Use Markdown.",
          },
        });

        const result = await chat.sendMessageStream({ message });
        
        for await (const chunk of result) {
          const c = chunk as GenerateContentResponse;
          if (c.text) {
            yield { text: c.text };
          }
        }
      } catch (error) {
        console.error("JurisAI Error:", error);
        yield { text: "⚠️ Erro ao conectar com a IA. Verifique sua chave de API ou conexão." };
      }
    } else {
      // MOCK MODE
      const mockResponse = `[MODO DEMO] Olá! A chave da API do Gemini não foi configurada. \n\nSua mensagem: "${message}" foi processada localmente.`;
      const chunks = mockResponse.split(/(.{5})/g).filter(Boolean);
      for (const chunk of chunks) {
        await new Promise(r => setTimeout(r, 20));
        yield { text: chunk };
      }
    }
  }

  /**
   * Analisa um documento (Imagem) para extrair dados.
   */
  async analyzeLegalDocument(base64Data: string, mimeType: string): Promise<ExtractedMovementData> {
    if (this.ai) {
        try {
            const prompt = `Analise este documento jurídico. Extraia:
            1. Tipo do documento (Decisão, Sentença, Petição, etc).
            2. Data do documento.
            3. Título curto.
            4. Resumo de 1 parágrafo.
            5. Prazos identificados (título, data no formato YYYY-MM-DD, prioridade).
            
            Retorne APENAS um JSON válido com esta estrutura:
            {
              "type": "string",
              "date": "YYYY-MM-DD",
              "title": "string",
              "summary": "string",
              "confidence": number (0-100),
              "deadlines": [{"title": "string", "date": "YYYY-MM-DD", "priority": "Alta"|"Média"|"Baixa", "description": "string"}]
            }`;

            const response = await this.ai.models.generateContent({
                model: this.modelVision,
                contents: {
                    parts: [
                        { inlineData: { mimeType, data: base64Data } },
                        { text: prompt }
                    ]
                },
                config: {
                    responseMimeType: "application/json"
                }
            });

            const text = response.text;
            if (!text) throw new Error("Sem resposta da IA");
            
            return JSON.parse(text) as ExtractedMovementData;

        } catch (error) {
            console.error("Erro na análise de documento com IA:", error);
            throw error;
        }
    }

    // MOCK DATA
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                type: 'Decisão',
                date: new Date().toISOString().split('T')[0],
                title: 'Decisão Interlocutória (Simulada)',
                summary: 'Deferimento parcial da tutela de urgência (Demo). Configure a API Key para análise real.',
                confidence: 95,
                deadlines: [
                    {
                        title: 'Prazo para Recurso',
                        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        priority: Priority.HIGH,
                        description: 'Prazo de 15 dias úteis.'
                    }
                ]
            });
        }, 2000);
    });
  }

  // --- LIVE API (VOICE MODE) ---

  async startLiveSession(onStatusChange: (status: string) => void): Promise<void> {
    if (!this.ai) {
      onStatusChange("Erro: API Key não configurada");
      return;
    }

    try {
      onStatusChange("Inicializando áudio...");
      
      // 1. Setup Audio Contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // 2. Get Microphone Access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      onStatusChange("Conectando ao JurisAI...");

      // 3. Connect to Gemini Live
      const sessionPromise = this.ai.live.connect({
        model: this.modelLive,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: "Você é o JurisAI, um assistente jurídico verbal. Fale de forma clara, concisa e profissional. Ajude o advogado com resumos, dúvidas rápidas e organização.",
        },
        callbacks: {
          onopen: () => {
            onStatusChange("Conectado (Ouvindo)");
            this.startAudioStreaming(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Process Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              onStatusChange("Falando...");
              await this.playAudioChunk(base64Audio);
              // Reset status to listening after a rough estimate if needed, or rely on end events
              // For simplicity, we keep it simple here.
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopAudioPlayback();
              onStatusChange("Interrompido (Ouvindo)");
            }
            
            if (message.serverContent?.turnComplete) {
               onStatusChange("Ouvindo");
            }
          },
          onclose: () => {
            onStatusChange("Desconectado");
            this.stopLiveSession();
          },
          onerror: (err) => {
            console.error("Live Error:", err);
            onStatusChange("Erro na conexão");
            this.stopLiveSession();
          }
        }
      });

      this.liveSession = sessionPromise;

    } catch (error: any) {
      console.error("Failed to start live session:", error);
      onStatusChange("Erro: " + error.message);
      this.stopLiveSession();
    }
  }

  private startAudioStreaming(sessionPromise: Promise<any>) {
    if (!this.inputAudioContext || !this.mediaStream) return;

    this.audioSource = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    this.audioProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.audioProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = this.createBlob(inputData);
      
      sessionPromise.then(session => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.audioSource.connect(this.audioProcessor);
    this.audioProcessor.connect(this.inputAudioContext.destination);
  }

  private createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: this.encodeBase64(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  private encodeBase64(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private decodeBase64(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async playAudioChunk(base64Audio: string) {
    if (!this.outputAudioContext) return;

    const audioBytes = this.decodeBase64(base64Audio);
    
    // Decode PCM (1 channel, 24kHz)
    const dataInt16 = new Int16Array(audioBytes.buffer);
    const frameCount = dataInt16.length;
    const audioBuffer = this.outputAudioContext.createBuffer(1, frameCount, 24000);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }

    const source = this.outputAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputAudioContext.destination);
    
    // Schedule playback
    const currentTime = this.outputAudioContext.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }
    
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
    
    source.onended = () => {
      this.activeSources.delete(source);
    };
    
    this.activeSources.add(source);
  }

  private stopAudioPlayback() {
    this.activeSources.forEach(source => {
      try { source.stop(); } catch {}
    });
    this.activeSources.clear();
    if (this.outputAudioContext) {
      this.nextStartTime = this.outputAudioContext.currentTime;
    }
  }

  stopLiveSession() {
    // 1. Close Live Connection
    if (this.liveSession) {
      this.liveSession.then((s: any) => {
         try { s.close(); } catch(e) { console.debug("Session close error", e); }
      });
      this.liveSession = null;
    }

    // 2. Stop Input Streaming
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }
    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }

    // 3. Stop Output
    this.stopAudioPlayback();
    if (this.outputAudioContext) {
      this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
  }
}

export const aiService = new AiService();