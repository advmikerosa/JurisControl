import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('@JurisControl:cookie-consent');
    if (!consent) {
      // Pequeno delay para não ser invasivo imediatamente
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('@JurisControl:cookie-consent', 'accepted');
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem('@JurisControl:cookie-consent', 'rejected');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 flex justify-center"
        >
          <div className="bg-[#1e293b]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-4xl w-full p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="bg-indigo-500/20 p-3 rounded-full text-indigo-300 shrink-0">
              <Cookie size={28} />
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h4 className="text-white font-semibold text-lg mb-1">Sua privacidade é importante</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                Utilizamos cookies essenciais para garantir o funcionamento do sistema. 
                Com sua permissão, também utilizamos cookies de análise para melhorar sua experiência, conforme nossa{' '}
                <Link 
                  to="/privacy" 
                  target="_blank" 
                  className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                >
                  Política de Privacidade
                </Link>.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
              <button
                onClick={handleReject}
                className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-sm font-medium"
              >
                Apenas Essenciais
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 md:flex-none px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-colors text-sm font-medium"
              >
                Aceitar Todos
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};