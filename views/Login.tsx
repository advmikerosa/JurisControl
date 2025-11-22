import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, User as UserIcon, Check } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Logo } from '../components/Logo';

export const Login: React.FC = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!email || !password) throw new Error('Preencha todos os campos.');
        await login(email, password);
        addToast('Login realizado com sucesso!', 'success');
      } else {
        if (!name || !email || !password) throw new Error('Preencha todos os campos.');
        if (password !== confirmPassword) throw new Error('As senhas não coincidem.');
        if (password.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres.');
        
        await register(name, email, password);
        addToast('Conta criada com sucesso! Bem-vindo.', 'success');
      }
      navigate('/');
    } catch (err: any) {
      addToast(err.message || 'Ocorreu um erro.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden px-4">
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/20 rounded-full blur-[120px]" />

      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl z-10 relative overflow-hidden"
      >
        {/* Header & Toggle */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="shadow-lg shadow-indigo-500/30 rounded-xl">
              <Logo size={56} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-6">JurisControl</h1>
          
          {/* Toggle Switch */}
          <div className="bg-black/20 p-1 rounded-xl flex relative">
            <motion.div 
              layoutId="tab-bg"
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/10 rounded-lg shadow-sm ${mode === 'login' ? 'left-1' : 'left-[calc(50%+2px)]'}`}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
            <button 
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-medium relative z-10 transition-colors ${mode === 'login' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Entrar
            </button>
            <button 
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-medium relative z-10 transition-colors ${mode === 'register' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Criar Conta
            </button>
          </div>
        </div>

        {/* Forms */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                key="name-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <label className="text-xs font-medium text-slate-300 ml-1">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
                    placeholder="Dr. João Silva"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 ml-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
                placeholder="nome@escritorio.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                key="confirm-pass-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <label className="text-xs font-medium text-slate-300 ml-1">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-black/20 border rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none transition-colors ${
                       confirmPassword && confirmPassword !== password ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'
                    }`}
                    placeholder="••••••••"
                  />
                  {confirmPassword && confirmPassword === password && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? (
              <span className="animate-pulse">Processando...</span>
            ) : (
              <>
                {mode === 'login' ? 'Entrar no Sistema' : 'Criar Minha Conta'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-6 text-center">
            <button className="text-xs text-slate-500 hover:text-indigo-400 transition-colors">Esqueceu sua senha?</button>
          </div>
        )}
      </motion.div>
    </div>
  );
};