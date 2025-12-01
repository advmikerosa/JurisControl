
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, RefreshCw } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useToast } from '../context/ToastContext';

export const EmailConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  
  const email = location.state?.email || 'seu e-mail';

  const handleResend = () => {
    addToast('E-mail de confirmação reenviado!', 'success');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden px-4">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl z-10 relative text-center"
      >
        <div className="flex justify-center mb-8">
           <div className="relative">
             <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <Mail size={48} className="text-emerald-400" />
             </div>
             <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-[#0f172a]">
                <CheckCircle size={16} className="text-white" />
             </div>
           </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">Verifique seu E-mail</h2>
        
        <div className="space-y-4 mb-8">
          <p className="text-slate-300 leading-relaxed">
            Enviamos um link de confirmação para:
          </p>
          <div className="bg-black/20 py-2 px-4 rounded-lg border border-white/5 inline-block max-w-full truncate text-emerald-400 font-medium">
            {email}
          </div>
          <p className="text-slate-400 text-sm">
            Para ativar sua conta e acessar o <strong>JurisControl</strong>, clique no link enviado. Não se esqueça de verificar a pasta de Spam.
          </p>
        </div>

        <div className="flex flex-col gap-3">
           <button 
             onClick={() => navigate('/login')}
             className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
           >
             <ArrowLeft size={18} /> Voltar para Login
           </button>
           
           <button 
             onClick={handleResend}
             className="w-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium py-3 rounded-xl transition-colors border border-white/5 flex items-center justify-center gap-2 text-sm"
           >
             <RefreshCw size={16} /> Reenviar E-mail
           </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-white/5">
           <div className="flex justify-center opacity-50 hover:opacity-100 transition-opacity">
              <Logo size={24} />
           </div>
        </div>
      </motion.div>
    </div>
  );
};