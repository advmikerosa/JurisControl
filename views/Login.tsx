
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, User as UserIcon, Check, Briefcase, X, Loader2, Building, AtSign, Users } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Logo } from '../components/Logo';
import { Modal } from '../components/ui/Modal';

export const Login: React.FC = () => {
  const { login, register, recoverPassword } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [oab, setOab] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Office States
  const [officeMode, setOfficeMode] = useState<'create' | 'join'>('create');
  const [officeName, setOfficeName] = useState('');
  const [officeHandle, setOfficeHandle] = useState('');

  const handleOabChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.toUpperCase();
    // Remove everything that is not alphanumeric
    v = v.replace(/[^A-Z0-9]/g, '');
    
    // Logic for UF/Number: UF/123.456
    if (v.length > 2) {
      v = v.substring(0, 2) + '/' + v.substring(2);
    }
    if (v.length > 6) { // 2 (UF) + 1 (/) + 3 (Nums) = 6 chars before dot
      const uf = v.substring(0, 2);
      const slash = v.substring(2, 3);
      const numPart = v.substring(3);
      
      if (numPart.length > 3) {
         v = `${uf}${slash}${numPart.substring(0,3)}.${numPart.substring(3)}`;
      }
    }
    // Limit length (UF/123.456) = 10 chars
    setOab(v.substring(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!email || !password) throw new Error('Preencha todos os campos.');
        await login(email, password);
        addToast('Login realizado com sucesso!', 'success');
        navigate('/');
      } else {
        if (!name || !email || !password) throw new Error('Preencha todos os campos pessoais.');
        if (password !== confirmPassword) throw new Error('As senhas não coincidem.');
        if (password.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres.');
        
        // Validate Office Fields
        if (officeMode === 'create') {
            if (!officeName) throw new Error('Digite o nome do seu escritório.');
            if (!officeHandle) throw new Error('Crie um identificador (@handle) para o escritório.');
        }
        if (!officeHandle && officeMode === 'join') throw new Error('Digite o identificador do escritório para entrar.');
        if (officeHandle && !officeHandle.startsWith('@')) throw new Error('O identificador do escritório deve começar com @.');

        const needsVerification = await register(name, email, password, oab, {
            mode: officeMode,
            name: officeMode === 'create' ? officeName : undefined,
            handle: officeHandle
        });
        
        if (needsVerification) {
           navigate('/confirm-email', { state: { email } });
        } else {
           addToast(`Bem-vindo ao ${officeMode === 'create' ? officeName : 'escritório'}!`, 'success');
           navigate('/');
        }
      }
    } catch (err: any) {
      addToast(err.message || 'Ocorreu um erro.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverEmail) {
        addToast('Digite seu e-mail para continuar.', 'error');
        return;
    }
    setIsRecovering(true);
    try {
        await recoverPassword(recoverEmail);
        addToast('Se o e-mail existir, você receberá um link de recuperação.', 'success');
        setShowForgotModal(false);
        setRecoverEmail('');
    } catch (error: any) {
        addToast(error.message, 'error');
    } finally {
        setIsRecovering(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-y-auto py-10 px-4 bg-[#0f172a]">
      {/* Dark Mode Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-900/30 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md p-8 md:p-10 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl z-10 relative overflow-hidden my-auto"
      >
        {/* Header & Toggle */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="shadow-[0_0_30px_rgba(99,102,241,0.3)] rounded-2xl bg-indigo-950/50 p-1 border border-white/10">
              <Logo size={64} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">JurisControl</h1>
          
          {/* Toggle Switch */}
          <div className="bg-black/30 p-1.5 rounded-xl flex relative border border-white/5">
            <motion.div 
              layoutId="tab-bg"
              className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white/10 rounded-lg border border-white/10 ${mode === 'login' ? 'left-1.5' : 'left-[calc(50%+3px)]'}`}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
            <button 
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 text-sm font-bold relative z-10 transition-colors ${mode === 'login' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Entrar
            </button>
            <button 
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 text-sm font-bold relative z-10 transition-colors ${mode === 'register' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Criar Conta
            </button>
          </div>
        </div>

        {/* Forms */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <>
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Nome Completo</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
                      placeholder="Dr. João Silva"
                    />
                  </div>
                </motion.div>

                <motion.div
                  key="oab-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Número OAB (Opcional)</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text" 
                      value={oab}
                      onChange={handleOabChange}
                      className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
                      placeholder="UF/000.000"
                    />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
                placeholder="nome@escritorio.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <>
                <motion.div
                  key="confirm-pass-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Confirmar Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full bg-black/20 border rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-slate-600 focus:outline-none transition-all ${
                        confirmPassword && confirmPassword !== password ? 'border-rose-500 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'
                      }`}
                      placeholder="••••••••"
                    />
                    {confirmPassword && confirmPassword === password && (
                      <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
                    )}
                  </div>
                </motion.div>

                {/* --- Office Registration Section --- */}
                <motion.div
                  key="office-section"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-4 border-t border-white/10 mt-4"
                >
                   <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                      <Building size={16} className="text-indigo-400" /> Dados do Escritório
                   </h3>
                   
                   <div className="flex p-1 bg-black/20 rounded-lg border border-white/5">
                      <button 
                        type="button"
                        onClick={() => setOfficeMode('create')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${officeMode === 'create' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        Criar Novo
                      </button>
                      <button 
                        type="button"
                        onClick={() => setOfficeMode('join')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${officeMode === 'join' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        Entrar em Existente
                      </button>
                   </div>

                   {officeMode === 'create' ? (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="space-y-3"
                      >
                          <div className="space-y-1">
                             <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nome do Escritório</label>
                             <input 
                                type="text" 
                                value={officeName}
                                onChange={(e) => setOfficeName(e.target.value)}
                                placeholder="Ex: Silva Advogados Associados"
                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:border-indigo-500 focus:outline-none"
                             />
                          </div>
                          <div className="space-y-1">
                             <label className="text-xs font-bold text-slate-400 uppercase ml-1">Identificador Único (@handle)</label>
                             <div className="relative">
                                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input 
                                    type="text" 
                                    value={officeHandle}
                                    onChange={(e) => {
                                      let val = e.target.value.toLowerCase();
                                      if (!val.startsWith('@') && val.length > 0) val = '@' + val;
                                      setOfficeHandle(val);
                                    }}
                                    placeholder="@silva_adv"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white focus:border-indigo-500 focus:outline-none"
                                />
                             </div>
                             <p className="text-[10px] text-slate-500 ml-1">Seus sócios usarão isso para entrar.</p>
                          </div>
                      </motion.div>
                   ) : (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="space-y-3"
                      >
                          <div className="space-y-1">
                             <label className="text-xs font-bold text-slate-400 uppercase ml-1">Identificador do Escritório</label>
                             <div className="relative">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input 
                                    type="text" 
                                    value={officeHandle}
                                    onChange={(e) => {
                                      let val = e.target.value.toLowerCase();
                                      if (!val.startsWith('@') && val.length > 0) val = '@' + val;
                                      setOfficeHandle(val);
                                    }}
                                    placeholder="@exemplo_adv"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white focus:border-indigo-500 focus:outline-none"
                                />
                             </div>
                             <p className="text-[10px] text-slate-500 ml-1">Peça o handle ao administrador do escritório.</p>
                          </div>
                      </motion.div>
                   )}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-6 hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <span className="animate-pulse">Processando...</span>
            ) : (
              <>
                {mode === 'login' ? 'Entrar no Sistema' : 'Criar Minha Conta'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-8 text-center">
            <button 
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs font-medium text-slate-500 hover:text-indigo-400 transition-colors"
            >
              Esqueceu sua senha?
            </button>
          </div>
        )}
      </motion.div>

      {/* Forgot Password Modal */}
      <Modal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} title="Recuperar Senha" maxWidth="max-w-sm">
         <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-sm text-slate-400">Digite seu e-mail para receber as instruções de redefinição de senha.</p>
            <div className="relative">
               <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
               <input 
                 type="email" 
                 required
                 value={recoverEmail}
                 onChange={(e) => setRecoverEmail(e.target.value)}
                 className="w-full bg-black/20 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:border-indigo-500 focus:outline-none"
                 placeholder="seu@email.com"
               />
            </div>
            <div className="flex justify-end gap-2 pt-2">
               <button type="button" onClick={() => setShowForgotModal(false)} className="px-4 py-2 text-slate-400 hover:text-white rounded-lg transition-colors text-sm font-medium">Cancelar</button>
               <button type="submit" disabled={isRecovering} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-70">
                  {isRecovering ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {isRecovering ? 'Enviando...' : 'Enviar Link'}
               </button>
            </div>
         </form>
      </Modal>
    </div>
  );
};