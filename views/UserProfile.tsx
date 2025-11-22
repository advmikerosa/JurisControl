
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
  Clock,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActivityLog, DataRequest } from '../types';

// Mock Data for Security Log
const MOCK_ACTIVITY_LOGS: ActivityLog[] = [
  { id: '1', action: 'Login realizado', ip: '201.55.123.45', date: 'Hoje, 09:41', device: 'Chrome / Windows', status: 'Success' },
  { id: '2', action: 'Alteração de Senha', ip: '201.55.123.45', date: 'Ontem, 14:20', device: 'Chrome / Windows', status: 'Success' },
  { id: '3', action: 'Falha de Login', ip: '189.22.11.09', date: '22/10/2023, 03:15', device: 'Unknown / Linux', status: 'Failed' },
];

// Mock Data for Data Requests
const MOCK_DATA_REQUESTS: DataRequest[] = [
  { id: 'req-1', type: 'Access', status: 'Completed', dateRequested: '15/10/2023', completionDate: '16/10/2023' },
  { id: 'req-2', type: 'Portability', status: 'Processing', dateRequested: 'Hoje' },
];

export const UserProfile: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'security' | 'preferences' | 'privacy'>('personal');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    oab: '',
    avatar: ''
  });

  // Validation State
  const [oabError, setOabError] = useState('');

  // Security State (Mock)
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

  // Load user data
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        oab: user.oab || '',
        avatar: user.avatar || ''
      });
      setSecurityData(prev => ({ ...prev, twoFactor: user.twoFactorEnabled }));
    }
  }, [user]);

  const validateOab = (value: string) => {
    // Regex: 2 letras maiúsculas, barra, 3 dígitos, ponto opcional, 3 dígitos
    // Ex aceitos: SP/123.456 ou SP/123456
    if (!value) {
      setOabError('');
      return true;
    }
    const regex = /^[A-Z]{2}\/\d{3}\.?\d{3}$/;
    if (!regex.test(value)) {
      setOabError('Formato inválido. Use o formato UF/000.000');
      return false;
    }
    setOabError('');
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let finalValue = value;

    if (name === 'oab') {
      finalValue = value.toUpperCase();
      // Limpa erro ao digitar se estava com erro
      if (oabError) setOabError('');
    }

    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData(prev => ({ ...prev, avatar: event.target!.result as string }));
          addToast('Nova foto selecionada. Clique em Salvar.', 'info');
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação antes de salvar
    if (formData.oab && !validateOab(formData.oab)) {
      addToast('Corrija os erros no formulário antes de salvar.', 'error');
      return;
    }

    setIsLoading(true);
    
    // Simulação de delay de API
    setTimeout(() => {
      updateProfile({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        oab: formData.oab,
        avatar: formData.avatar
      });
      setIsLoading(false);
      addToast('Perfil atualizado com sucesso!', 'success');
    }, 1000);
  };

  const handleVerifyEmail = () => {
    addToast('Link de verificação enviado para seu e-mail!', 'success');
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      if (securityData.newPassword) {
          addToast('Senha alterada com sucesso!', 'success');
      }
      updateProfile({ twoFactorEnabled: securityData.twoFactor });
      setSecurityData(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
      setIsLoading(false);
    }, 1000);
  };

  const handleExportData = () => {
    addToast('Solicitação de dados enviada. Você será notificado quando o arquivo estiver pronto.', 'info');
  };

  const handleDeleteAccount = () => {
    if (confirm('ATENÇÃO: Esta ação é irreversível e excluirá todos os seus processos e clientes. Deseja continuar?')) {
        addToast('Solicitação de exclusão enviada. Seus dados serão apagados em 30 dias.', 'warning');
        setTimeout(() => logout(), 3000);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-white">Meu Perfil</h1>
        <p className="text-slate-400">Gerencie suas informações pessoais e preferências de segurança.</p>
      </div>

      {/* Header Card */}
      <GlassCard className="relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-900/50 to-slate-900/50 z-0"></div>
         <div className="relative z-10 flex flex-col md:flex-row items-end md:items-center gap-6 pt-12 md:pt-4">
             <div className="relative group">
               <div className="w-24 h-24 rounded-full border-4 border-[#0f172a] bg-slate-800 overflow-hidden shadow-xl">
                  <img src={formData.avatar} alt="Profile" className="w-full h-full object-cover" />
               </div>
               <label className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 rounded-full text-white cursor-pointer hover:bg-indigo-500 transition-colors shadow-lg">
                  <Camera size={14} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
               </label>
             </div>
             <div className="flex-1 mb-2">
                <h2 className="text-2xl font-bold text-white">{formData.name}</h2>
                <div className="flex items-center gap-3">
                  <p className="text-indigo-400 text-sm flex items-center gap-2">
                    {user.role || 'Advogado'} 
                    <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                    {user.email}
                  </p>
                  {user.emailVerified ? (
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle size={10} /> Verificado
                    </span>
                  ) : (
                    <span className="bg-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                      <AlertCircle size={10} /> Não Verificado
                    </span>
                  )}
                </div>
             </div>
         </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <GlassCard className="h-fit p-2 lg:col-span-1">
           <nav className="space-y-1">
             <button 
               onClick={() => setActiveTab('personal')}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === 'personal' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
             >
               <User size={18} /> Dados Pessoais
             </button>
             <button 
               onClick={() => setActiveTab('security')}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === 'security' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
             >
               <Shield size={18} /> Segurança
             </button>
             <button 
               onClick={() => setActiveTab('privacy')}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === 'privacy' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
             >
               <FileCheck size={18} /> Privacidade e LGPD
             </button>
             <button 
               onClick={() => setActiveTab('preferences')}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === 'preferences' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
             >
               <Bell size={18} /> Preferências
             </button>
           </nav>
        </GlassCard>

        {/* Main Content */}
        <GlassCard className="lg:col-span-3 min-h-[400px]">
           {activeTab === 'personal' && (
             <form onSubmit={handleSavePersonal} className="space-y-6 animate-fade-in">
               <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <h3 className="text-lg font-semibold text-white">Informações Básicas</h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <label className="text-xs text-slate-400 font-medium ml-1">Nome Completo / Usuário</label>
                     <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                          type="text" 
                          name="name"
                          value={formData.name} 
                          onChange={handleInputChange}
                          className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors"
                        />
                     </div>
                  </div>
                  
                  <div className="space-y-2">
                     <label className="text-xs text-slate-400 font-medium ml-1">Número OAB</label>
                     <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                          type="text" 
                          name="oab"
                          value={formData.oab} 
                          onChange={handleInputChange}
                          onBlur={() => validateOab(formData.oab)}
                          placeholder="UF/000.000"
                          className={`w-full bg-white/5 border rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none transition-colors ${
                            oabError ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'
                          }`}
                        />
                        {oabError && (
                          <span className="absolute -bottom-5 left-1 text-[10px] text-rose-400 flex items-center gap-1">
                            <AlertCircle size={10} /> {oabError}
                          </span>
                        )}
                     </div>
                  </div>

                  <div className="space-y-2">
                     <div className="flex justify-between items-end">
                       <label className="text-xs text-slate-400 font-medium ml-1">E-mail Profissional</label>
                       {user.emailVerified ? (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 mb-0.5">
                            <CheckCircle size={10} /> Verificado
                          </span>
                       ) : (
                          <span className="text-[10px] text-amber-400 flex items-center gap-1 mb-0.5 animate-pulse">
                            <AlertCircle size={10} /> Não Verificado
                          </span>
                       )}
                     </div>
                     <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                          type="email" 
                          name="email"
                          value={formData.email} 
                          onChange={handleInputChange}
                          className={`w-full bg-white/5 border rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none transition-colors ${
                            !user.emailVerified ? 'border-amber-500/30 focus:border-amber-500' : 'border-white/10 focus:border-indigo-500'
                          }`}
                        />
                        {!user.emailVerified && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                             <AlertCircle size={16} className="text-amber-500" />
                          </div>
                        )}
                     </div>
                     {!user.emailVerified && (
                        <button 
                          type="button"
                          onClick={handleVerifyEmail}
                          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium transition-colors border border-amber-500/20 mt-2"
                        >
                          <Send size={12} /> Enviar Link de Verificação
                        </button>
                     )}
                  </div>

                  <div className="space-y-2">
                     <label className="text-xs text-slate-400 font-medium ml-1">Telefone / WhatsApp</label>
                     <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                          type="text" 
                          name="phone"
                          value={formData.phone} 
                          onChange={handleInputChange}
                          placeholder="(00) 00000-0000"
                          className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors"
                        />
                     </div>
                  </div>
               </div>

               <div className="flex justify-end pt-4 border-t border-white/10">
                 <button 
                   type="submit" 
                   disabled={isLoading}
                   className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-70"
                 >
                   {isLoading ? 'Salvando...' : <><Save size={18} /> Salvar Alterações</>}
                 </button>
               </div>
             </form>
           )}

           {activeTab === 'security' && (
             <div className="space-y-6 animate-fade-in">
               <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <h3 className="text-lg font-semibold text-white">Segurança da Conta</h3>
               </div>

               <form onSubmit={handleSaveSecurity} className="space-y-6">
                 <div className="space-y-4">
                   <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2"><Lock size={16} /> Alterar Senha</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <input 
                        type="password" 
                        placeholder="Senha Atual"
                        value={securityData.currentPassword}
                        onChange={(e) => setSecurityData({...securityData, currentPassword: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-slate-200 focus:border-indigo-500 focus:outline-none"
                     />
                     <input 
                        type="password" 
                        placeholder="Nova Senha"
                        value={securityData.newPassword}
                        onChange={(e) => setSecurityData({...securityData, newPassword: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-slate-200 focus:border-indigo-500 focus:outline-none"
                     />
                   </div>
                 </div>

                 <div className="pt-6 border-t border-white/5 space-y-4">
                   <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2"><Smartphone size={16} /> Autenticação em Duas Etapas</h4>
                   <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                      <div>
                         <p className="text-white font-medium">Ativar 2FA</p>
                         <p className="text-xs text-slate-500">Adiciona uma camada extra de segurança via SMS ou App.</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setSecurityData(prev => ({...prev, twoFactor: !prev.twoFactor}))}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${securityData.twoFactor ? 'bg-indigo-500' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${securityData.twoFactor ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </button>
                   </div>
                 </div>

                 <div className="flex justify-end pt-2">
                   <button 
                     type="submit" 
                     disabled={isLoading}
                     className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-70"
                   >
                     {isLoading ? 'Processando...' : <><Check size={18} /> Atualizar Segurança</>}
                   </button>
                 </div>
               </form>

               {/* Audit Logs Table */}
               <div className="pt-8 border-t border-white/10">
                 <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-4"><Activity size={16} /> Logs de Atividade Recente (Auditoria)</h4>
                 <div className="overflow-x-auto rounded-xl border border-white/10">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-white/5 text-xs uppercase text-slate-400">
                       <tr>
                         <th className="px-4 py-3">Ação</th>
                         <th className="px-4 py-3">Data/Hora</th>
                         <th className="px-4 py-3">Dispositivo</th>
                         <th className="px-4 py-3">IP</th>
                         <th className="px-4 py-3">Status</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {MOCK_ACTIVITY_LOGS.map((log) => (
                         <tr key={log.id} className="hover:bg-white/5 transition-colors">
                           <td className="px-4 py-3 font-medium text-white">{log.action}</td>
                           <td className="px-4 py-3 text-slate-400">{log.date}</td>
                           <td className="px-4 py-3 text-slate-400">{log.device}</td>
                           <td className="px-4 py-3 text-slate-500 font-mono text-xs">{log.ip}</td>
                           <td className="px-4 py-3">
                             <span className={`text-xs px-2 py-0.5 rounded-full ${
                               log.status === 'Success' ? 'bg-emerald-500/20 text-emerald-400' : 
                               log.status === 'Failed' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                             }`}>
                               {log.status}
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
           )}

           {activeTab === 'privacy' && (
             <div className="space-y-8 animate-fade-in">
               <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <h3 className="text-lg font-semibold text-white">Privacidade e Controle de Dados (LGPD)</h3>
                  <div className="flex gap-2 text-sm">
                    <Link to="/privacy" className="text-indigo-400 hover:underline">Política de Privacidade</Link>
                    <span className="text-slate-500">•</span>
                    <Link to="/terms" className="text-indigo-400 hover:underline">Termos de Uso</Link>
                  </div>
               </div>

               {/* Data Subject Requests History */}
               <div className="space-y-4">
                 <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2"><FileText size={16} /> Histórico de Solicitações (Direitos do Titular)</h4>
                 <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4">
                   {MOCK_DATA_REQUESTS.length > 0 ? (
                     <div className="space-y-3">
                       {MOCK_DATA_REQUESTS.map(req => (
                         <div key={req.id} className="flex items-center justify-between text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                            <div>
                              <p className="text-white font-medium">{req.type === 'Access' ? 'Solicitação de Acesso aos Dados' : req.type === 'Deletion' ? 'Solicitação de Exclusão' : req.type === 'Portability' ? 'Portabilidade de Dados' : 'Retificação'}</p>
                              <p className="text-xs text-slate-500">Solicitado em: {req.dateRequested}</p>
                            </div>
                            <div className="text-right">
                               <span className={`text-xs px-2 py-1 rounded-md border ${
                                 req.status === 'Completed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                 req.status === 'Processing' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                               }`}>
                                 {req.status === 'Completed' ? 'Concluído' : req.status === 'Processing' ? 'Em Processamento' : req.status}
                               </span>
                               {req.completionDate && <p className="text-[10px] text-slate-600 mt-1">Concluído: {req.completionDate}</p>}
                            </div>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <p className="text-slate-500 text-sm">Nenhuma solicitação registrada.</p>
                   )}
                 </div>
               </div>

               {/* Consent Management */}
               <div className="space-y-4 pt-4 border-t border-white/5">
                 <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2"><EyeOff size={16} /> Gestão de Consentimento</h4>
                 <p className="text-xs text-slate-400 mb-4">Gerencie como utilizamos seus dados para personalização e comunicações.</p>
                 
                 <div className="space-y-3">
                   {[
                     { id: 'marketingEmails', label: 'Comunicações de Marketing', desc: 'Receber e-mails sobre novidades e ofertas.' },
                     { id: 'activityLog', label: 'Logs de Atividade Detalhados', desc: 'Permitir análise de uso para melhoria do sistema.' },
                     { id: 'analyticsCookies', label: 'Cookies de Análise', desc: 'Permitir cookies de terceiros para métricas.' },
                   ].map(item => (
                     <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
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

               {/* Data Portability */}
               <div className="pt-6 border-t border-white/5 space-y-4">
                 <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2"><Download size={16} /> Portabilidade de Dados</h4>
                 <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-slate-200 text-sm font-medium">Exportar meus dados</p>
                       <p className="text-xs text-slate-400 mt-1">Baixe uma cópia de seus dados pessoais, casos e clientes em formato JSON/PDF.</p>
                     </div>
                     <button onClick={handleExportData} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-2">
                       <Download size={14} /> Solicitar Cópia
                     </button>
                   </div>
                 </div>
               </div>

               {/* Danger Zone / Right to be Forgotten */}
               <div className="pt-6 border-t border-white/5 space-y-4">
                 <h4 className="text-sm font-medium text-rose-400 flex items-center gap-2"><Trash2 size={16} /> Zona de Perigo</h4>
                 <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-rose-200 text-sm font-medium">Excluir Conta (Direito ao Esquecimento)</p>
                       <p className="text-xs text-rose-300/70 mt-1">
                         Solicitar a exclusão permanente de sua conta e dados associados conforme Art. 18 da LGPD.
                       </p>
                     </div>
                     <button onClick={handleDeleteAccount} className="px-4 py-2 border border-rose-500/50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-medium transition-colors">
                       Excluir Conta
                     </button>
                   </div>
                 </div>
               </div>
               
               <div className="text-center pt-4">
                 <p className="text-xs text-slate-500">
                   Encarregado de Dados (DPO): <a href="mailto:dpo@lexglass.com" className="text-indigo-400 hover:underline">dpo@lexglass.com</a>
                 </p>
               </div>
             </div>
           )}

           {activeTab === 'preferences' && (
             <div className="space-y-6 animate-fade-in">
               <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <h3 className="text-lg font-semibold text-white">Preferências do Sistema</h3>
               </div>
               <div className="text-center py-12 text-slate-500">
                  <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Configurações de notificação e tema em breve.</p>
               </div>
             </div>
           )}
        </GlassCard>
      </div>
    </div>
  );
};
