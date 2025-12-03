
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, User as UserIcon, Check, Briefcase, Loader2, Building, AtSign, Users, SkipForward } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Logo } from '../components/Logo';
import { Modal } from '../components/ui/Modal';
import { masks } from '../utils/formatters';

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
  const [skipOfficeSetup, setSkipOfficeSetup] = useState(false);

  const handleOabChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOab(masks.oab(e.target.value));
  };

  const handleOfficeHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, '');
    if (!val.startsWith('@') && val.length > 0) val = '@' + val;
    setOfficeHandle(val);
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
        
        // Validação de Escritório apenas se não for pular
        if (!skipOfficeSetup) {
            if (officeMode === 'create') {
                if (!officeName) throw new Error('Digite o nome do seu escritório.');
                if (!officeHandle) throw new Error('Crie um identificador (@handle) para o escritório.');
            }
            if (!officeHandle && officeMode === 'join') throw new Error('Digite o identificador do escritório para entrar.');
            
            if (officeHandle && !/^@[a-z0-9_]{3,}$/.test(officeHandle)) {
                 throw new Error('O identificador do escritório deve começar com @ e ter pelo menos 3 caracteres.');
            }
        }

        const needsVerification = await register(name, email, password, oab, skipOfficeSetup ? undefined : {
            mode: officeMode,
            name: officeMode === 'create' ? officeName : undefined,
            handle: officeHandle
        });
        
        if (needsVerification) {
           navigate('/confirm-email', { state: { email } });
        } else {
           addToast(skipOfficeSetup ? 'Conta criada com sucesso!' : `Bem-vindo ao ${officeMode === 'create' ? officeName : 'escritório'}!`, 'success');
           navigate('/');
        }
      }
    } catch (err: any) {
      let errorMessage = err.message || 'Ocorreu um erro.';
      if (errorMessage === 'Invalid login credentials') {
        errorMessage = 'E-mail ou senha incorretos.';
      }
      addToast(errorMessage, 'error');
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
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#0f172a] relative overflow-hidden px-4">
      {/* Animated Background Gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, 50, 0], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ x: [0, -50, 0], y: [0, -50, 0], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px]" 
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8 relative z-10 overflow-hidden"
      >
        {/* Subtle inner highlight */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50" />

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="p-3 bg-indigo-500/10 rounded-2xl mb-4 border border-indigo-500/20 shadow-glow"
          >
            <Logo size={48} />
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight text-center">JurisControl</h1>
          <p className="text-slate-400 text-sm mt-2 text-center">Acesse seu escritório digital</p>
        </div>

        {/* Toggle Switch */}
        <div className="bg-black/20 p-1 rounded-xl flex relative border border-white/5 mb-6">
          <motion.div 
            layoutId="tab-bg"
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/10 rounded-lg border border-white/10 shadow-sm ${mode === 'login' ? 'left-1' : 'left-[calc(50%+2px)]'}`}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
          />
          <button 
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-bold relative z-10 transition-colors ${mode === 'login' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Entrar
          </button>
          <button 
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-2 text-sm font-bold relative z-10 transition-colors ${mode === 'register' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Criar Conta
          </button>
        </div>

        {/* Forms */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nome Completo</label>
                  <div className="relative group">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:bg-white/5 focus:outline-none transition-all text-sm"
                      placeholder="Dr. João Silva"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">OAB (Opcional)</label>
                  <div className="relative group">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input 
                      type="text" 
                      value={oab}
                      onChange={handleOabChange}
                      className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:bg-white/5 focus:outline-none transition-all text-sm"
                      placeholder="UF/000.000"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">E-mail</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:bg-white/5 focus:outline-none transition-all text-sm"
                placeholder="nome@escritorio.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Senha</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:bg-white/5 focus:outline-none transition-all text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden pt-1"
              >
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">Confirmar Senha</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full bg-black/20 border rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none transition-all text-sm focus:bg-white/5 ${
                        confirmPassword && confirmPassword !== password ? 'border-rose-500 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'
                      }`}
                      placeholder="••••••••"
                    />
                    {confirmPassword && confirmPassword === password && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                    )}
                  </div>
                </div>

                {/* Office Setup Header with Skip Option */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-2 transition-colors">
                   <div className="flex items-center justify-between mb-3">
                       <h3 className={`text-xs font-bold flex items-center gap-2 uppercase tracking-wide transition-colors ${skipOfficeSetup ? 'text-slate-500' : 'text-white'}`}>
                          <Building size={14} className={skipOfficeSetup ? 'text-slate-600' : 'text-indigo-400'} /> Configuração do Escritório
                       </h3>
                       <button 
                         type="button" 
                         onClick={() => setSkipOfficeSetup(!skipOfficeSetup)}
                         className="text-[10px] font-medium text-indigo-400 hover:text-white transition-colors flex items-center gap-1"
                       >
                         {skipOfficeSetup ? 'Configurar Agora' : 'Pular Etapa'} <ArrowRight size={10} />
                       </button>
                   </div>
                   
                   {!skipOfficeSetup ? (
                     <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                     >
                       <div className="flex bg-black/20 rounded-lg p-1 mb-3">
                          <button 
                            type="button"
                            onClick={() => setOfficeMode('create')}
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-colors ${officeMode === 'create' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            Criar Novo
                          </button>
                          <button 
                            type="button"
                            onClick={() => setOfficeMode('join')}
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-colors ${officeMode === 'join' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            Entrar
                          </button>
                       </div>

                       {officeMode === 'create' ? (
                          <div className="space-y-3">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome do Escritório</label>
                                 <input 
                                    type="text" 
                                    value={officeName}
                                    onChange={(e) => setOfficeName(e.target.value)}
                                    placeholder="Ex: Silva Advogados"
                                    className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-indigo-500 focus:bg-white/5 focus:outline-none"
                                 />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Identificador (@handle)</label>
                                 <div className="relative">
                                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                    <input 
                                        type="text" 
                                        value={officeHandle}
                                        onChange={handleOfficeHandleChange}
                                        placeholder="@silva_adv"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:border-indigo-500 focus:bg-white/5 focus:outline-none"
                                    />
                                 </div>
                              </div>
                          </div>
                       ) : (
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Identificador do Escritório</label>
                             <div className="relative">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input 
                                    type="text" 
                                    value={officeHandle}
                                    onChange={handleOfficeHandleChange}
                                    placeholder="@exemplo_adv"
                                    className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:border-indigo-500 focus:bg-white/5 focus:outline-none"
                                />
                             </div>
                          </div>
                       )}
                     </motion.div>
                   ) : (
                     <div className="text-center py-2 text-slate-500 text-xs">
                        Você poderá criar ou entrar em um escritório mais tarde nas configurações.
                     </div>
                   )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4 hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={20} /> Processando...</span>
            ) : (
              <>
                {mode === 'login' ? 'Entrar no Sistema' : (skipOfficeSetup ? 'Criar Minha Conta' : 'Criar Conta e Escritório')}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-6 text-center">
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
