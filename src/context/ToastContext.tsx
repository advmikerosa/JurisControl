import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextData {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((state) => [...state, { id, message, type }]);

    // Auto remove after specified duration (default 4s)
    setTimeout(() => {
      setToasts((state) => state.filter((toast) => toast.id !== id));
    }, duration);
  }, []);

  const removeToast = (id: string) => {
    setToasts((state) => state.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              layout
              className="pointer-events-auto min-w-[300px] bg-[#1e293b]/90 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-xl flex items-start gap-3"
            >
              {toast.type === 'success' && <CheckCircle className="text-emerald-400 shrink-0" size={20} />}
              {toast.type === 'error' && <XCircle className="text-rose-400 shrink-0" size={20} />}
              {toast.type === 'warning' && <AlertCircle className="text-amber-400 shrink-0" size={20} />}
              {toast.type === 'info' && <Info className="text-blue-400 shrink-0" size={20} />}
              
              <div className="flex-1 pt-0.5">
                <p className="text-sm font-medium text-slate-100">{toast.message}</p>
              </div>
              
              <button 
                onClick={() => removeToast(toast.id)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);