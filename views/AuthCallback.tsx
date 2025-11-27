
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { Logo } from '../components/Logo';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Redireciona após 3 segundos
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden px-4">
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl z-10 relative text-center"
      >
        <div className="flex justify-center mb-8">
           <motion.div 
             initial={{ scale: 0 }}
             animate={{ scale: 1 }}
             transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
             className="relative"
           >
             <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <CheckCircle size={48} className="text-emerald-400" />
             </div>
           </motion.div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">E-mail Confirmado!</h2>
        
        <div className="space-y-4 mb-8">
          <p className="text-slate-300 leading-relaxed">
            Sua conta foi verificada com sucesso. Você já pode acessar todos os recursos do JurisControl.
          </p>
          
          <div className="flex items-center justify-center gap-2 text-indigo-400 bg-indigo-500/10 py-2 px-4 rounded-lg border border-indigo-500/20 w-fit mx-auto">
             <Loader2 size={16} className="animate-spin" />
             <span className="text-sm font-medium">Redirecionando em {countdown}s...</span>
          </div>
        </div>

        <button 
          onClick={() => navigate('/')}
          className="w-full bg-white/5 hover:bg-white/10 text-white font-medium py-3 rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2 group"
        >
          Acessar Dashboard
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
        
        <div className="mt-8 pt-6 border-t border-white/5">
           <div className="flex justify-center opacity-50">
              <Logo size={24} />
           </div>
        </div>
      </motion.div>
    </div>
  );
};
