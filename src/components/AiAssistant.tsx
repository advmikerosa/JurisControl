
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, User, Bot, Loader2, Minimize2, Trash2 } from 'lucide-react';
import { aiService } from '../services/aiService';
import { GenerateContentResponse } from '@google/genai';
import { useToast } from '../context/ToastContext';

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
  const { addToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'model', text: 'Olá, Doutor(a). Sou o JurisAI. Posso ajudar a redigir peças, resumir casos ou tirar dúvidas jurídicas. Como posso auxiliar?' }
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
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [messages, isOpen]);

  const handleClearChat = () => {
    setMessages([{ id: 'welcome', role: 'model', text: 'Histórico limpo. Como posso ajudar agora?' }]);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userText };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepara histórico para a API (excluindo a mensagem de boas-vindas local se necessário, 
      // mas o Gemini lida bem com contexto).
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const streamResult = await aiService.sendMessageStream(history, userText);
      
      const aiMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '' }]);

      let fullText = '';
      
      for await (const chunk of streamResult) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullText += c.text;
          setMessages(prev => 
            prev.map(msg => msg.id === aiMsgId ? { ...msg, text: fullText } : msg)
          );
          scrollToBottom();
        }
      }
    } catch (error: any) {
      console.error(error);
      let errorMsg = 'Desculpe, ocorreu um erro na comunicação.';
      if (error.message?.includes('API Key')) errorMsg = 'Chave de API não configurada.';
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: `⚠️ ${errorMsg}` 
      }]);
      addToast('Erro ao contatar JurisAI', 'error');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-24 right-4 md:right-8 w-[90vw] md:w-[400px] h-[600px] max-h-[80vh] z-[100] flex flex-col bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-indigo-200 dark:border-indigo-500/30 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-black/5"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg shadow-inner">
                <Sparkles size={18} className="text-yellow-300 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-none tracking-wide">JurisAI</h3>
                <span className="text-[10px] text-indigo-100 opacity-90 font-medium">Assistente Jurídico 2.0</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
                <button onClick={handleClearChat} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-indigo-100" title="Limpar conversa">
                  <Trash2 size={16} />
                </button>
                <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white" title="Fechar">
                  <X size={18} />
                </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50 scroll-smooth">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${
                  msg.role === 'user' 
                    ? 'bg-white dark:bg-slate-800 border-indigo-100 dark:border-indigo-500/20 text-indigo-600' 
                    : 'bg-indigo-600 border-indigo-500 text-white'
                }`}>
                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/5 rounded-tl-none markdown-body'
                }`}>
                  {msg.text ? (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  ) : (
                    <div className="flex gap-1 items-center h-5 px-1">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white dark:bg-[#0f172a] border-t border-slate-200 dark:border-white/10 shrink-0">
            <form onSubmit={handleSend} className="relative flex items-end gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre leis, prazos ou processos..."
                className="w-full bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl py-3 pl-4 pr-12 text-sm outline-none transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
            <div className="flex justify-between items-center px-1 mt-2">
               <p className="text-[10px] text-slate-400">
                 IA generativa (Gemini 2.5). Verifique informações críticas.
               </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
