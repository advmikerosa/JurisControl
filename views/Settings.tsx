

import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { storageService } from '../services/storageService';
import { notificationService } from '../services/notificationService';
import { Modal } from '../components/ui/Modal';
import { Settings as SettingsIcon, AlertTriangle, Save, Monitor, Bell, Zap, Globe, Moon, Archive, Building, Users, AtSign, MapPin, LogIn, Plus } from 'lucide-react';
import { AppSettings, Office } from '../types';

export const Settings: React.FC = () => {
  const { logout, user, updateProfile } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [confirmModal, setConfirmModal] = useState({ open: false, action: () => {} });
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  
  // State para Configurações
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // State para Escritório
  const [myOffice, setMyOffice] = useState<Office | null>(null);
  const [officeForm, setOfficeForm] = useState({
    name: '',
    handle: '',
    location: ''
  });
  const [isCreatingOffice, setIsCreatingOffice] = useState(false);
  
  // State para Entrar e Convidar
  const [joinOfficeHandle, setJoinOfficeHandle] = useState('');
  const [inviteUserHandle, setInviteUserHandle] = useState('');

  useEffect(() => {
    setSettings(storageService.getSettings());
    loadOfficeData();
  }, [user]);

  const loadOfficeData = async () => {
    if (user && user.currentOfficeId) {
      const office = await storageService.getOfficeById(user.currentOfficeId);
      if (office) setMyOffice(office);
    }
  };

  const handleSaveSettings = () => {
    if (settings) {
        storageService.saveSettings(settings);
        addToast('Preferências salvas com sucesso!', 'success');
        
        // Test Notification if enabled
        if (settings.notifications.sound || settings.notifications.desktop) {
          notificationService.notify('Configurações Salvas', 'Suas preferências de notificação estão ativas.', 'success');
        }
    }
  };

  const toggleSetting = (section: keyof AppSettings, key: string) => {
    if (!settings) return;
    
    const newValue = !((settings[section] as any)[key]);
    
    // Logic for Desktop Permission
    if (section === 'notifications' && key === 'desktop' && newValue === true) {
      notificationService.requestDesktopPermission();
    }

    setSettings({
        ...settings,
        [section]: {
            ...settings[section],
            [key]: newValue
        }
    });
  };

  const updateSetting = (section: keyof AppSettings, key: string, value: any) => {
    if (!settings) return;
    setSettings({
        ...settings,
        [section]: {
            ...settings[section],
            [key]: value
        }
    });
  };

  const handleFactoryReset = () => {
    setDeleteConfirmationInput('');
    setConfirmModal({
      open: true,
      action: () => {
        storageService.factoryReset();
        addToast('Sistema resetado para padrões de fábrica.', 'success');
        setTimeout(() => {
          logout();
          window.location.reload();
        }, 1500);
      }
    });
  };

  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeForm.name || !officeForm.handle) {
      addToast('Preencha nome e identificador.', 'error');
      return;
    }
    
    // Validar formato do handle
    if (!/^@[a-zA-Z0-9_]+$/.test(officeForm.handle)) {
      addToast('O identificador deve começar com @ e conter apenas letras, números ou underline.', 'error');
      return;
    }

    try {
      const newOffice = await storageService.createOffice(officeForm);
      // Atualizar usuário
      updateProfile({
        offices: [...(user?.offices || []), newOffice.id],
        currentOfficeId: newOffice.id
      });
      setMyOffice(newOffice);
      setIsCreatingOffice(false);
      addToast('Escritório criado com sucesso!', 'success');
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  const handleJoinOffice = async () => {
    if (!joinOfficeHandle.startsWith('@')) {
        addToast('O identificador deve começar com @.', 'error');
        return;
    }
    try {
        const joinedOffice = await storageService.joinOffice(joinOfficeHandle);
        updateProfile({
            offices: [...(user?.offices || []), joinedOffice.id],
            currentOfficeId: joinedOffice.id
        });
        setMyOffice(joinedOffice);
        addToast(`Você entrou em ${joinedOffice.name}!`, 'success');
        setJoinOfficeHandle('');
    } catch (error: any) {
        addToast(error.message, 'error');
    }
  };

  const handleInviteUser = async () => {
    if (!inviteUserHandle.startsWith('@')) {
        addToast('Digite um nome de usuário válido (@usuario).', 'error');
        return;
    }
    if (!myOffice) return;

    try {
        await storageService.inviteUserToOffice(myOffice.id, inviteUserHandle);
        addToast(`Convite enviado para ${inviteUserHandle}!`, 'success');
        setInviteUserHandle('');
    } catch (error: any) {
        addToast(error.message, 'error');
    }
  };

  if (!settings) return null;

  return (
    <div className="pb-20">
       <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Configurações</h1>
        <p className="text-slate-400 mt-1">Gerenciamento do sistema e preferências.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <GlassCard className="p-2 h-fit">
          <nav className="space-y-1">
             <button onClick={() => setActiveTab('general')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${activeTab === 'general' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-white/5'}`}><SettingsIcon size={18} /> Preferências</button>
             <button onClick={() => setActiveTab('office')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${activeTab === 'office' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-white/5'}`}><Building size={18} /> Meu Escritório</button>
             <button onClick={() => setActiveTab('danger')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${activeTab === 'danger' ? 'bg-rose-600/20 text-rose-400' : 'text-slate-400 hover:bg-white/5'}`}><AlertTriangle size={18} /> Zona de Perigo</button>
          </nav>
        </GlassCard>

        <GlassCard className="lg:col-span-3 min-h-[400px]">
           {activeTab === 'general' && (
             <div className="space-y-8 animate-fade-in">
                {/* Interface */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                        <Monitor size={20} className="text-indigo-400" /> Interface e Região
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 ml-1">Idioma do Sistema</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <select 
                                    value={settings.general.language}
                                    onChange={(e) => updateSetting('general', 'language', e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-slate-200 focus:border-indigo-500 focus:outline-none appearance-none scheme-dark"
                                >
                                    <option value="pt-BR" className="bg-slate-800">Português (Brasil)</option>
                                    <option value="en-US" className="bg-slate-800">English (US)</option>
                                    <option value="es-ES" className="bg-slate-800">Español</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                            <div>
                                <p className="text-sm font-medium text-white flex items-center gap-2"><Moon size={16} /> Modo Compacto</p>
                                <p className="text-xs text-slate-500">Reduz o espaçamento das listas.</p>
                            </div>
                            <button 
                                onClick={() => toggleSetting('general', 'compactMode')}
                                className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${settings.general.compactMode ? 'bg-indigo-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-300 ${settings.general.compactMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                        <Bell size={20} className="text-amber-400" /> Notificações
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
                            <div>
                                <span className="text-sm text-slate-300 block">Notificações por E-mail</span>
                                <span className="text-xs text-slate-500">Receber alertas de prazos e tarefas.</span>
                            </div>
                            <button 
                                onClick={() => toggleSetting('notifications', 'email')}
                                className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${settings.notifications.email ? 'bg-emerald-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-300 ${settings.notifications.email ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
                            <div>
                                <span className="text-sm text-slate-300 block">Notificações na Área de Trabalho</span>
                                <span className="text-xs text-slate-500">Alertas nativos do navegador.</span>
                            </div>
                            <button 
                                onClick={() => toggleSetting('notifications', 'desktop')}
                                className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${settings.notifications.desktop ? 'bg-emerald-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-300 ${settings.notifications.desktop ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
                            <div>
                                <span className="text-sm text-slate-300 block">Sons do Sistema</span>
                                <span className="text-xs text-slate-500">Emitir som ao receber alertas.</span>
                            </div>
                            <button 
                                onClick={() => toggleSetting('notifications', 'sound')}
                                className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${settings.notifications.sound ? 'bg-emerald-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-300 ${settings.notifications.sound ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Automation */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                        <Zap size={20} className="text-blue-400" /> Automação e Sistema
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-start justify-between gap-4">
                            <div>
                                <h4 className="text-sm font-medium text-white flex items-center gap-2"><Archive size={14} /> Auto-Arquivar</h4>
                                <p className="text-xs text-slate-500 mt-1">Arquivar processos "Ganhos" automaticamente após 30 dias.</p>
                            </div>
                            <button 
                                onClick={() => toggleSetting('automation', 'autoArchiveWonCases')}
                                className={`relative w-10 h-5 shrink-0 rounded-full transition-colors duration-300 ${settings.automation.autoArchiveWonCases ? 'bg-indigo-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-300 ${settings.automation.autoArchiveWonCases ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                         </div>

                         <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-start justify-between gap-4">
                            <div>
                                <h4 className="text-sm font-medium text-white flex items-center gap-2"><Save size={14} /> Auto-Save</h4>
                                <p className="text-xs text-slate-500 mt-1">Salvar rascunho de novos processos enquanto digita.</p>
                            </div>
                            <button 
                                onClick={() => toggleSetting('automation', 'autoSaveDrafts')}
                                className={`relative w-10 h-5 shrink-0 rounded-full transition-colors duration-300 ${settings.automation.autoSaveDrafts ? 'bg-indigo-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-300 ${settings.automation.autoSaveDrafts ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                         </div>
                    </div>
                </div>

                <div className="flex justify-end pt-6">
                    <button 
                        onClick={handleSaveSettings}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Save size={18} /> Salvar Preferências
                    </button>
                </div>
             </div>
           )}

           {activeTab === 'office' && (
             <div className="space-y-8 animate-fade-in">
               <div className="border-b border-white/10 pb-4 mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2"><Building size={24} className="text-indigo-400" /> Perfil do Escritório</h2>
                  <p className="text-sm text-slate-400 mt-1">Gerencie a identidade do seu escritório e equipe.</p>
               </div>

               {!myOffice && !isCreatingOffice ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card Criar Novo */}
                    <div className="bg-white/5 hover:bg-white/10 transition-colors rounded-2xl p-6 border border-white/10 flex flex-col justify-between h-full">
                        <div>
                            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-4">
                                <Plus size={24} className="text-indigo-400" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Criar Novo Escritório</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Funde seu próprio escritório digital, convide membros e centralize sua gestão. Você será o administrador.
                            </p>
                        </div>
                        <button 
                            onClick={() => setIsCreatingOffice(true)}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all"
                        >
                            Criar Escritório
                        </button>
                    </div>

                    {/* Card Entrar Existente */}
                    <div className="bg-white/5 hover:bg-white/10 transition-colors rounded-2xl p-6 border border-white/10 flex flex-col justify-between h-full">
                        <div>
                            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                                <LogIn size={24} className="text-emerald-400" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Entrar em Existente</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Junte-se a uma equipe já existente usando o identificador único do escritório (ex: @silvaassociados).
                            </p>
                            <div className="relative mb-2">
                                <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input 
                                    type="text" 
                                    placeholder="@handle_do_escritorio"
                                    value={joinOfficeHandle}
                                    onChange={(e) => setJoinOfficeHandle(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 pl-10 text-white focus:border-emerald-500 focus:outline-none text-sm"
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleJoinOffice}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20 transition-all"
                        >
                            Entrar no Escritório
                        </button>
                    </div>
                 </div>
               ) : isCreatingOffice ? (
                 <div className="bg-white/5 rounded-2xl p-6 border border-white/10 animate-fade-in max-w-2xl mx-auto">
                    <h3 className="text-lg font-semibold text-white mb-4">Criar Novo Escritório</h3>
                    <form onSubmit={handleCreateOffice} className="space-y-4">
                       <div className="space-y-2">
                          <label className="text-xs text-slate-400 font-medium ml-1">Nome do Escritório</label>
                          <input 
                             type="text" 
                             placeholder="Ex: Silva & Associados"
                             value={officeForm.name}
                             onChange={(e) => setOfficeForm({...officeForm, name: e.target.value})}
                             className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs text-slate-400 font-medium ml-1">Identificador Único (@handle)</label>
                          <div className="relative">
                             <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                             <input 
                                type="text" 
                                placeholder="@silvaassociados"
                                value={officeForm.handle}
                                onChange={(e) => {
                                   let val = e.target.value;
                                   if (!val.startsWith('@')) val = '@' + val;
                                   setOfficeForm({...officeForm, handle: val.toLowerCase()})
                                }}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 pl-10 text-white focus:border-indigo-500 focus:outline-none"
                             />
                          </div>
                          <p className="text-[10px] text-slate-500 ml-1">Use letras minúsculas, números e underline. Deve começar com @.</p>
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs text-slate-400 font-medium ml-1">Localização (Cidade/UF)</label>
                          <div className="relative">
                             <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                             <input 
                                type="text" 
                                placeholder="São Paulo - SP"
                                value={officeForm.location}
                                onChange={(e) => setOfficeForm({...officeForm, location: e.target.value})}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 pl-10 text-white focus:border-indigo-500 focus:outline-none"
                             />
                          </div>
                       </div>
                       <div className="flex gap-3 justify-end pt-4">
                          <button 
                            type="button" 
                            onClick={() => setIsCreatingOffice(false)}
                            className="px-4 py-2 text-slate-400 hover:text-white"
                          >
                            Cancelar
                          </button>
                          <button 
                            type="submit"
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20"
                          >
                            Criar Perfil
                          </button>
                       </div>
                    </form>
                 </div>
               ) : (
                 <div className="space-y-6">
                    {/* Exibição do Escritório */}
                    <div className="bg-gradient-to-r from-indigo-900/40 to-slate-900/40 border border-indigo-500/30 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                       <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                             {myOffice?.name.charAt(0)}
                          </div>
                          <div>
                             <h3 className="text-xl font-bold text-white">{myOffice?.name}</h3>
                             <p className="text-indigo-300 font-mono text-sm">{myOffice?.handle}</p>
                             <p className="text-slate-400 text-xs flex items-center gap-1 mt-1"><MapPin size={10} /> {myOffice?.location}</p>
                          </div>
                       </div>
                       <div className="flex gap-3">
                          <button className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-lg text-sm font-medium">
                            Editar Perfil
                          </button>
                       </div>
                    </div>

                    {/* Membros */}
                    <div>
                       <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2"><Users size={16} /> Equipe</h4>
                       <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                          <div className="p-4 flex items-center justify-between border-b border-white/5">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">
                                   VC
                                </div>
                                <div>
                                   <p className="text-sm text-white font-medium">Você (Admin)</p>
                                   <p className="text-xs text-slate-500">{user?.email}</p>
                                </div>
                             </div>
                             <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Ativo</span>
                          </div>
                          
                          {/* Convite de Membro */}
                          <div className="p-4 bg-black/20 border-t border-white/5">
                             <div className="flex gap-3 items-center">
                                <div className="relative flex-1">
                                    <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input 
                                        type="text" 
                                        placeholder="Convidar usuário por @handle"
                                        value={inviteUserHandle}
                                        onChange={(e) => setInviteUserHandle(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <button 
                                    onClick={handleInviteUser}
                                    disabled={!inviteUserHandle}
                                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white text-xs rounded-lg font-medium transition-colors"
                                >
                                    Enviar Convite
                                </button>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
               )}
             </div>
           )}

           {activeTab === 'danger' && (
             <div>
                <div className="mb-6 border-b border-white/10 pb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2"><AlertTriangle size={24} className="text-rose-500" /> Zona de Perigo</h2>
                  <p className="text-sm text-slate-400 mt-1">Ações irreversíveis.</p>
                </div>
                <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 border border-rose-500/50 bg-rose-500/10 rounded-xl">
                      <div>
                         <h4 className="text-rose-200 font-medium text-sm">Reset de Fábrica (Produção)</h4>
                         <p className="text-xs text-rose-300/70">Apaga TODOS os clientes, processos e dados do LocalStorage. Como se fosse uma instalação limpa.</p>
                      </div>
                      <button onClick={handleFactoryReset} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors shadow-lg shadow-rose-500/20">
                         Resetar Tudo
                      </button>
                   </div>
                </div>
             </div>
           )}
        </GlassCard>
      </div>

      <Modal isOpen={confirmModal.open} onClose={() => setConfirmModal({ ...confirmModal, open: false })} title="Confirmar Ação Crítica">
         <div className="text-center">
             <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                 <AlertTriangle className="text-rose-500" size={24} />
             </div>
             <p className="text-slate-300 mb-4 font-medium">
                 Tem certeza absoluta? Esta ação é <strong className="text-rose-400">irreversível</strong>. 
             </p>
             <p className="text-sm text-slate-400 mb-6">
                 Para confirmar, digite <strong>DELETAR</strong> abaixo:
             </p>
             <input 
                type="text" 
                placeholder="Digite DELETAR"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-center text-white font-bold mb-6 focus:border-rose-500 focus:outline-none uppercase"
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
             />
             <div className="flex justify-end gap-3 w-full">
               <button onClick={() => setConfirmModal({ ...confirmModal, open: false })} className="flex-1 px-4 py-2 text-slate-400 hover:bg-white/5 rounded-lg">Cancelar</button>
               <button 
                 onClick={() => { confirmModal.action(); setConfirmModal({ ...confirmModal, open: false }); }} 
                 disabled={deleteConfirmationInput !== 'DELETAR'}
                 className="flex-1 px-4 py-2 bg-rose-600 disabled:bg-rose-600/30 disabled:cursor-not-allowed text-white rounded-lg font-bold hover:bg-rose-700 transition-colors"
               >
                 Apagar Tudo
               </button>
             </div>
         </div>
      </Modal>
    </div>
  );
};