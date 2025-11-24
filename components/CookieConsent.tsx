
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('@JurisControl:cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
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
          className="fixed bottom-4 right-4 z-[90] flex justify-end max-w-sm w-full"
        >
          <div className="bg-[#1e293b]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-5 flex flex-col gap-4">
            <div className="flex items-start gap-4">
               <div className="bg-indigo-500/20 p-2 rounded-full text-indigo-300 shrink-0">
                 <Cookie size={20} />
               </div>
               <div>
                  <h4 className="text-white font-semibold text-sm mb-1">Privacidade & Cookies</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Usamos cookies para melhorar sua experiência. Veja nossa{' '}
                    <Link to="/privacy" className="text-indigo-400 hover:underline">Política de Privacidade</Link>.
                  </p>
               </div>
            </div>

            <div className="flex items-center gap-2 w-full">
              <button
                onClick={handleReject}
                className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-xs font-medium"
              >
                Recusar
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-colors text-xs font-medium"
              >
                Aceitar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
