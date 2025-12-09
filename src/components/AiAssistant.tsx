import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, User, Bot, Loader2, Minimize2 } from 'lucide-react';
import { aiService } from '../services/aiService';
import { GenerateContentResponse } from '@google/genai';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface AiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'Olá! Sou o JurisAI. Como posso ajudar com seus processos, redação jurídica ou dúvidas hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    if (isOpen) {
      // Focus input when opened
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    // Prepare history for API (excluding the just added message for now, or include it if chat create handles it)
    // The Google GenAI SDK `chats.create` history expects previous turns. 
    // The `sendMessageStream` takes the new message.
    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    try {
      const streamResult = await aiService.sendMessageStream(history, currentInput);
      
      const aiMsgId = (Date.now() + 1).toString();
      // Add placeholder for AI response
      setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '' }]);

      let fullText = '';
      
      for await (const chunk of streamResult) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullText += c.text;
          setMessages(prev => 
            prev.map(msg => msg.id === aiMsgId ? { ...msg, text: fullText } : msg)
          );
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: 'Desculpe, encontrei um erro de conexão. Verifique sua chave de API ou tente novamente mais tarde.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-24 right-4 md:right-8 w-[90vw] md:w-96 h-[500px] max-h-[75vh] z-[100] flex flex-col bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-xl border border-indigo-200 dark:border-indigo-500/30 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-black/5"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shrink-0 shadow-md z-10">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/20 rounded-lg shadow-inner">
                <Sparkles size={18} className="text-yellow-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-none tracking-wide">JurisAI</h3>
                <span className="text-[10px] text-indigo-100 opacity-90 font-medium">Assistente Inteligente</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
                <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white/90 hover:text-white" title="Fechar">
                  <X size={18} />
                </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/80 dark:bg-[#0f172a]/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white/10 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' 
                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                }`}>
                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                
                <div className={`max-w-[80%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/5 rounded-tl-none'
                }`}>
                  {msg.text ? (
                    <div className="whitespace-pre-wrap markdown-body">{msg.text}</div>
                  ) : (
                    <div className="flex gap-1 items-center h-5 px-1">
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white dark:bg-[#1e293b] border-t border-slate-200 dark:border-white/10 shrink-0">
            <form onSubmit={handleSend} className="relative flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:focus:bg-slate-950 rounded-xl py-3 pl-4 pr-12 text-sm outline-none transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-all shadow-sm transform active:scale-95"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
            <div className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-2 font-medium">
              JurisAI pode cometer erros. Verifique informações importantes.
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};