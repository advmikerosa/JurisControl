
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { storageService } from '../services/storageService';
import { 
  User, 
  Camera, 
  Mail, 
  Phone, 
  Shield, 
  Briefcase, 
  Save, 
  Check, 
  AlertCircle,
  Bell,
  Lock,
  Smartphone,
  CheckCircle,
  Send,
  FileCheck,
  Download,
  Trash2,
  EyeOff,
  Activity,
  AtSign,
  Copy,
  Loader2,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActivityLog, DataRequest } from '../types';

// Mock Data for Data Requests (Translated)
const MOCK_DATA_REQUESTS: DataRequest[] = [
  { id: 'req-1', type: 'Access', status: 'Completed', dateRequested: '15/10/2023', completionDate: '16/10/2023' },
  { id: 'req-2', type: 'Portability', status: 'Processing', dateRequested: 'Hoje' },
];

export const UserProfile: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { addToast } = useToast();
  
  // UI States
  const [activeTab, setActiveTab] = useState<'personal' | 'security' | 'preferences' | 'privacy'>('personal');
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    oab: '',
    avatar: ''
  });

  // Security State
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    twoFactor: false
  });

  // Privacy State
  const [privacySettings, setPrivacySettings] = useState({
    marketingEmails: true,
    activityLog: true,
    analyticsCookies: true
  });

  // Validation Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Initialize Data
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        oab: user.oab || '',
        avatar: user.avatar || ''
      });
      setSecurityData(prev => ({ ...prev, twoFactor: user.twoFactorEnabled }));
    }
    // Load Logs
    setLogs(storageService.getLogs());
  }, [user]);

  // Masks and Validations
  const masks = {
    phone: (value: string) => {
      return value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .substring(0, 15);
    },
    oab: (value: string) => {
      // Formato esperado: UF/000.000 ou apenas números
      let v = value.toUpperCase().replace(/[^A-Z0-9]/g, ''); 
      if (v.length > 2 && /^[A-Z]{2}/.test(v)) {
         v = v.replace(/^([A-Z]{2})(\d)/, '$1/$2');
      }
      return v.substring(0, 10);
    },
    username: (value: string) => {
      // Apenas letras minúsculas, números, . e _
      let v = value.toLowerCase().replace(/[^a-z0-9._]/g, '');
      return v ? '@' + v.replace(/^@/, '') : '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let finalValue = value;

    if (name === 'phone') finalValue = masks.phone(value);
    if (name === 'oab') finalValue = masks.oab(value);
    if (name === 'username') finalValue = masks.username(value);

    setFormData(prev => ({ ...prev, [name]: finalValue }));
    
    // Clear error when typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.name.trim()) newErrors.name = 'Nome completo é obrigatório.';
    if (!formData.email.trim()) newErrors.email = 'E-mail é obrigatório.';
    if (formData.username && formData.username.length < 4) newErrors.username = 'Usuário muito curto.';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Basic size validation (2MB)
      if (file.size > 2 * 1024 * 1024) {
        addToast('A imagem deve ter no máximo 2MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData(prev => ({ ...prev, avatar: event.target!.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      addToast('Verifique os erros no formulário.', 'error');
      return;
    }

    setIsSaving(true);
    
    try {
      // Simulação de delay de rede para UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updateProfile({
        name: formData.name,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        oab: formData.oab,
        avatar: formData.avatar
      });
      storageService.logActivity('Atualizou dados pessoais');
      addToast('Perfil atualizado com sucesso!', 'success');
    } catch (error) {
      addToast('Erro ao salvar alterações.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyEmail = async () => {
    setIsVerifying(true);
    
    // Simulação de delay de rede
    setTimeout(() => {
       // Em produção, isso dispararia o email. Aqui, simulamos o sucesso.
       addToast(`Link de verificação enviado para ${formData.email}`, 'success');
       setIsVerifying(false);
       
       // Opcional: Simular verificação imediata para demonstração
       if (window.confirm("Demo: Deseja simular que o link foi clicado e verificar a conta agora?")) {
           updateProfile({ emailVerified: true });
           storageService.logActivity('Email verificado');
       }
    }, 2000);
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    setTimeout(() => {
      if (securityData.newPassword) {
          if (securityData.newPassword.length < 6) {
             addToast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
             setIsSaving(false);
             return;
          }
          addToast('Senha alterada com sucesso!', 'success');
          storageService.logActivity('Alteração de senha');
      }
      updateProfile({ twoFactorEnabled: securityData.twoFactor });
      if (securityData.twoFactor !== user?.twoFactorEnabled) {
          storageService.logActivity(`${securityData.twoFactor ? 'Ativou' : 'Desativou'} 2FA`);
      }
      setSecurityData(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
      setIsSaving(false);
    }, 1000);
  };

  const handleExportData = () => {
    storageService.logActivity('Solicitou exportação de dados (LGPD)');
    addToast('Solicitação de dados enviada. Você será notificado por e-mail.', 'info');
  };

  const handleDeleteAccount = () => {
    if (confirm('ATENÇÃO: Esta ação é irreversível e excluirá todos os seus processos e clientes. Para confirmar, digite sua senha na próxima etapa (não implementado na demo). Deseja continuar?')) {
        storageService.logActivity('Solicitou exclusão de conta', 'Warning');
        addToast('Conta agendada para exclusão em 30 dias.', 'warning');
        setTimeout(() => logout(), 2000);
    }
  };

  const copyUsername = () => {
     if (formData.username) {
         navigator.clipboard.writeText(formData.username);
         addToast('Nome de usuário copiado!', 'success');
     }
  };

  if (!user) return null;

  const tabs = [
    { id: 'personal', label: 'Dados Pessoais', icon: User },
    { id: 'security', label: 'Segurança', icon: Shield },
    { id: 'privacy', label: 'Privacidade e LGPD', icon: FileCheck },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      
      {/* Header Banner */}
      <GlassCard className="relative overflow-hidden p-0 border-0">
         <div className="absolute inset-0 bg-gradient-to-r from-indigo-900 via-[#1e1b4b] to-slate-900 z-0"></div>
         <div className="relative z-10 px-6 py-8 md:px-10 md:py-10 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
             {/* Avatar Section */}
             <div className="relative group shrink-0">
               <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-[#0f172a] bg-slate-800 shadow-2xl overflow-hidden relative">
                  {formData.avatar ? (
                     <img src={formData.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                     <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-500">{formData.name.charAt(0)}</div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                     <Camera className="text-white" size={24} />
                  </div>
               </div>
               <label className="absolute bottom-1 right-1 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full cursor-pointer shadow-lg transition-transform hover:scale-110 active:scale-95 border-2 border-[#0f172a]" title="Alterar foto">
                  <Camera size={14} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
               </label>
             </div>

             {/* User Info Section */}
             <div className="flex-1 text-center md:text-left mb-1">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{formData.name}</h2>
                    {user.emailVerified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider mx-auto md:mx-0 w-fit">
                            <CheckCircle size={10} /> Verificado
                        </span>
                    )}
                </div>
                
                <div 
                    onClick={copyUsername} 
                    className="inline-flex items-center gap-1.5 text-indigo-300 font-mono text-sm bg-indigo-500/10 px-2 py-1 rounded-md cursor-pointer hover:bg-indigo-500/20 hover:text-white transition-colors mb-3"
                    title="Clique para copiar"
                >
                   {formData.username || '@usuario'} <Copy size={12} className="opacity-70" />
                </div>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded">
                     <Briefcase size={14} /> {user.role || 'Advogado'}
                  </span>
                  <span className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded">
                     <Mail size={14} /> {formData.email}
                  </span>
                </div>
             </div>
             
             <div className="hidden md:block">
                 <button onClick={() => setActiveTab('security')} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg border border-white/10 transition-colors">
                    Segurança
                 </button>
             </div>
         </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1">
           <GlassCard className="p-2 sticky top-24">
               <nav className="space-y-1">
                 {tabs.map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-sm font-medium group relative overflow-hidden ${
                          activeTab === tab.id 
                          ? 'bg-indigo-600/10 text-indigo-300 shadow-sm ring-1 ring-indigo-500/20' 
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <tab.icon size={18} className={`transition-colors ${activeTab === tab.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      {tab.label}
                      {activeTab === tab.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />}
                    </button>
                 ))}
               </nav>
           </GlassCard>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
           {activeTab === 'personal' && (
             <GlassCard className="min-h-[500px]">
               <div className="mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <User size={20} className="text-indigo-400" /> Dados Pessoais
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">Mantenha suas informações de contato atualizadas.</p>
               </div>
               
               <form onSubmit={handleSavePersonal} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <label className="text-xs uppercase font-bold text-slate-500 ml-1">Nome Completo <span className="text-rose-400">*</span></label>
                         <input 
                           type="text" 
                           name="name"
                           value={formData.name} 
                           onChange={handleInputChange}
                           className={`w-full bg-slate-900/50 border rounded-lg p-3 text-slate-200 focus:outline-none transition-all ${errors.name ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'}`}
                           placeholder="Seu nome"
                         />
                         {errors.name && <span className="text-[10px] text-rose-400 ml-1">{errors.name}</span>}
                      </div>

                      <div className="space-y-2">
                         <label className="text-xs uppercase font-bold text-slate-500 ml-1">Nome de Usuário (Único)</label>
                         <div className="relative">
                            <input 
                              type="text" 
                              name="username"
                              value={formData.username} 
                              onChange={handleInputChange}
                              className={`w-full bg-slate-900/50 border rounded-lg p-3 text-slate-200 focus:outline-none transition-all font-mono ${errors.username ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'}`}
                              placeholder="@usuario"
                            />
                         </div>
                         <p className="text-[10px] text-slate-500 ml-1">Usado para login e identificação na equipe.</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <label className="text-xs uppercase font-bold text-slate-500 ml-1">E-mail Profissional <span className="text-rose-400">*</span></label>
                         <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input 
                              type="email" 
                              name="email"
                              value={formData.email} 
                              onChange={handleInputChange}
                              className={`w-full bg-slate-900/50 border rounded-lg py-3 pl-10 pr-10 text-slate-200 focus:outline-none transition-all ${errors.email ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'}`}
                            />
                            {user.emailVerified ? (
                                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                            ) : (
                                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500" size={16} />
                            )}
                         </div>
                      </div>

                      <div className="space-y-2">
                         <label className="text-xs uppercase font-bold text-slate-500 ml-1">Número OAB</label>
                         <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input 
                              type="text" 
                              name="oab"
                              value={formData.oab} 
                              onChange={handleInputChange}
                              placeholder="UF/123456"
                              className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-slate-200 focus:border-indigo-500 focus:outline-none transition-all"
                            />
                         </div>
                      </div>
                  </div>

                  {!user.emailVerified && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-fade-in">
                          <div className="flex gap-3">
                              <div className="p-2 bg-amber-500/20 rounded-lg h-fit text-amber-500 shrink-0">
                                  <AlertCircle size={20} />
                              </div>
                              <div>
                                  <h4 className="text-amber-200 font-bold text-sm">Conta Não Verificada</h4>
                                  <p className="text-amber-200/70 text-xs mt-1 leading-relaxed">
                                      Para garantir a segurança da sua conta e habilitar recuperação de senha, precisamos confirmar que este e-mail pertence a você.
                                  </p>
                              </div>
                          </div>
                          <button 
                             type="button"
                             onClick={handleVerifyEmail}
                             disabled={isVerifying}
                             className="whitespace-nowrap px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                             {isVerifying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                             {isVerifying ? 'Enviando...' : 'Enviar Link de Verificação'}
                          </button>
                      </div>
                  )}

                  <div className="space-y-2">
                     <label className="text-xs uppercase font-bold text-slate-500 ml-1">Telefone / Celular</label>
                     <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                          type="text" 
                          name="phone"
                          value={formData.phone} 
                          onChange={handleInputChange}
                          placeholder="(11) 99999-9999"
                          className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-slate-200 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                     </div>
                  </div>

                  <div className="flex justify-end pt-6 border-t border-white/10">
                     <button 
                       type="submit" 
                       disabled={isSaving}
                       className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed"
                     >
                       {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                       {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                     </button>
                  </div>
               </form>
             </GlassCard>
           )}

           {activeTab === 'security' && (
             <GlassCard className="min-h-[500px]">
               <div className="mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Shield size={20} className="text-emerald-400" /> Segurança
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">Gerencie sua senha e métodos de autenticação.</p>
               </div>

               <form onSubmit={handleSaveSecurity} className="space-y-8">
                 <div className="space-y-4">
                   <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2">Alterar Senha</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold ml-1">Senha Atual</label>
                        <input 
                            type="password" 
                            value={securityData.currentPassword}
                            onChange={(e) => setSecurityData({...securityData, currentPassword: e.target.value})}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-200 focus:border-indigo-500 focus:outline-none"
                            placeholder="••••••••"
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold ml-1">Nova Senha</label>
                        <input 
                            type="password" 
                            value={securityData.newPassword}
                            onChange={(e) => setSecurityData({...securityData, newPassword: e.target.value})}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-200 focus:border-indigo-500 focus:outline-none"
                            placeholder="••••••••"
                        />
                     </div>
                   </div>
                   <p className="text-xs text-slate-500 flex items-center gap-1"><Info size={12}/> Use no mínimo 8 caracteres com letras e números.</p>
                 </div>

                 <div className="space-y-4">
                   <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2">Autenticação de Dois Fatores (2FA)</h4>
                   <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-white/10">
                      <div>
                         <p className="text-white font-medium flex items-center gap-2">
                            {securityData.twoFactor ? <Lock size={14} className="text-emerald-400"/> : <Lock size={14} className="text-slate-500"/>}
                            Verificação em Duas Etapas
                         </p>
                         <p className="text-xs text-slate-500 mt-1 max-w-sm">Adiciona uma camada extra de segurança exigindo um código via SMS ou App ao fazer login.</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setSecurityData(prev => ({...prev, twoFactor: !prev.twoFactor}))}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${securityData.twoFactor ? 'bg-indigo-500' : 'bg-slate-700'}`}
                        aria-label="Toggle 2FA"
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${securityData.twoFactor ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </button>
                   </div>
                 </div>

                 <div className="flex justify-end pt-4 border-t border-white/10">
                   <button 
                     type="submit" 
                     disabled={isSaving}
                     className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-all disabled:opacity-70"
                   >
                     {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                     {isSaving ? 'Processando...' : 'Atualizar Segurança'}
                   </button>
                 </div>
               </form>

               {/* Activity Logs */}
               <div className="mt-10">
                 <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
                    <Activity size={16} /> Dispositivos e Atividade (Audit Trail)
                 </h4>
                 <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/30">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-white/5 text-xs uppercase text-slate-400 font-semibold">
                       <tr>
                         <th className="px-4 py-3">Evento</th>
                         <th className="px-4 py-3">Quando</th>
                         <th className="px-4 py-3 hidden sm:table-cell">Dispositivo</th>
                         <th className="px-4 py-3 text-right">Status</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {logs.length > 0 ? logs.map((log) => (
                         <tr key={log.id} className="hover:bg-white/5 transition-colors">
                           <td className="px-4 py-3 font-medium text-white">{log.action}</td>
                           <td className="px-4 py-3 text-slate-400">{log.date}</td>
                           <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                               <span className="block">{log.device}</span>
                               <span className="text-[10px] font-mono opacity-70">{log.ip}</span>
                           </td>
                           <td className="px-4 py-3 text-right">
                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                               log.status === 'Success' ? 'bg-emerald-500/20 text-emerald-400' : 
                               log.status === 'Failed' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                             }`}>
                               {log.status === 'Success' ? 'Sucesso' : log.status === 'Failed' ? 'Falha' : 'Alerta'}
                             </span>
                           </td>
                         </tr>
                       )) : (
                         <tr><td colSpan={4} className="text-center py-4 text-slate-500">Nenhuma atividade registrada.</td></tr>
                       )}
                     </tbody>
                   </table>
                 </div>
               </div>
             </GlassCard>
           )}

           {activeTab === 'privacy' && (
             <GlassCard className="min-h-[500px]">
               <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileCheck size={20} className="text-blue-400" /> Privacidade e Dados
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Gerencie seus direitos conforme a LGPD.</p>
                 </div>
                 <Link to="/privacy" className="text-xs text-indigo-400 hover:text-white border border-indigo-500/30 px-3 py-1.5 rounded-lg transition-colors">
                    Ler Política Completa
                 </Link>
               </div>

               <div className="space-y-8">
                 {/* Requests */}
                 <div className="space-y-4">
                     <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2">Minhas Solicitações</h4>
                     <div className="bg-slate-900/50 border border-white/10 rounded-xl p-1">
                         {MOCK_DATA_REQUESTS.map((req, idx) => (
                             <div key={req.id} className={`p-4 flex items-center justify-between ${idx !== MOCK_DATA_REQUESTS.length - 1 ? 'border-b border-white/5' : ''}`}>
                                 <div>
                                     <p className="text-white text-sm font-medium">
                                         {req.type === 'Access' ? 'Solicitação de Acesso' : req.type === 'Portability' ? 'Portabilidade' : 'Exclusão'}
                                     </p>
                                     <p className="text-xs text-slate-500">Iniciado em: {req.dateRequested}</p>
                                 </div>
                                 <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                     req.status === 'Completed' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                                 }`}>
                                     {req.status === 'Completed' ? 'Concluído' : 'Processando'}
                                 </span>
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* Consent */}
                 <div className="space-y-4">
                     <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2">Preferências de Consentimento</h4>
                     <div className="grid gap-3">
                         {[
                             { id: 'marketingEmails', label: 'E-mails de Marketing', desc: 'Receber novidades, dicas e ofertas.' },
                             { id: 'activityLog', label: 'Análise de Uso', desc: 'Permitir coleta de dados anônimos para melhorias.' },
                         ].map(item => (
                             <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-white/10">
                                 <div>
                                     <p className="text-slate-200 font-medium text-sm">{item.label}</p>
                                     <p className="text-xs text-slate-500">{item.desc}</p>
                                 </div>
                                 <button 
                                    onClick={() => setPrivacySettings(prev => ({...prev, [item.id]: !prev[item.id as keyof typeof privacySettings]}))}
                                    className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${privacySettings[item.id as keyof typeof privacySettings] ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                 >
                                     <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-300 ${privacySettings[item.id as keyof typeof privacySettings] ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                 </button>
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* Actions */}
                 <div className="pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl flex flex-col justify-between">
                         <div>
                             <h5 className="text-indigo-200 font-bold text-sm flex items-center gap-2"><Download size={16}/> Portabilidade</h5>
                             <p className="text-xs text-indigo-200/60 mt-1 mb-3">Baixe uma cópia completa dos seus dados.</p>
                         </div>
                         <button onClick={handleExportData} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors">
                             Solicitar Arquivo
                         </button>
                     </div>
                     <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex flex-col justify-between">
                         <div>
                             <h5 className="text-rose-200 font-bold text-sm flex items-center gap-2"><Trash2 size={16}/> Zona de Perigo</h5>
                             <p className="text-xs text-rose-200/60 mt-1 mb-3">Solicitar exclusão permanente da conta.</p>
                         </div>
                         <button onClick={handleDeleteAccount} className="w-full py-2 border border-rose-500/50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-bold transition-colors">
                             Excluir Minha Conta
                         </button>
                     </div>
                 </div>
               </div>
             </GlassCard>
           )}
        </div>
      </div>
    </div>
  );
};
