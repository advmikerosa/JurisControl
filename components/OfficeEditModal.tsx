import React, { useState, useRef } from 'react';
import { Modal } from './ui/Modal';
import { Office, OfficeMember, MemberRole } from '../types';
import { Camera, Building, Users, Settings as SettingsIcon, Save, Trash2, Plus, Mail, Phone, Globe, MapPin, Instagram, Linkedin, Facebook, Shield, DollarSign, FileText, Scale } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { storageService } from '../services/storageService';

interface OfficeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  office: Office;
  onUpdate: (updatedOffice: Office) => void;
}

export const OfficeEditModal: React.FC<OfficeEditModalProps> = ({ isOpen, onClose, office, onUpdate }) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'team' | 'extras'>('general');
  const [formData, setFormData] = useState<Office>(office);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSocialChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      social: { ...prev.social, [key]: value }
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData(prev => ({ ...prev, logoUrl: event.target!.result as string }));
          addToast('Logo atualizado (preview). Salve para confirmar.', 'info');
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSave = async () => {
    try {
      await storageService.saveOffice(formData);
      onUpdate(formData);
      addToast('Perfil do escritório atualizado com sucesso!', 'success');
      onClose();
    } catch (error) {
      addToast('Erro ao salvar alterações.', 'error');
    }
  };

  // Team Management
  const updateMemberRole = (userId: string, newRole: MemberRole) => {
    const updatedMembers = formData.members.map(m => {
        if (m.userId === userId) {
            // Default permissions based on role
            let perms = { ...m.permissions };
            if (newRole === 'Admin') perms = { financial: true, cases: true, documents: true, settings: true };
            if (newRole === 'Estagiário') perms = { financial: false, cases: true, documents: true, settings: false };
            return { ...m, role: newRole, permissions: perms };
        }
        return m;
    });
    setFormData({ ...formData, members: updatedMembers });
  };

  const togglePermission = (userId: string, key: keyof OfficeMember['permissions']) => {
      const updatedMembers = formData.members.map(m => {
          if (m.userId === userId) {
              return { ...m, permissions: { ...m.permissions, [key]: !m.permissions[key] } };
          }
          return m;
      });
      setFormData({ ...formData, members: updatedMembers });
  };

  const removeMember = (userId: string) => {
      if (confirm('Tem certeza que deseja remover este membro da equipe?')) {
          setFormData({ ...formData, members: formData.members.filter(m => m.userId !== userId) });
      }
  };

  const addMemberMock = () => {
      if (!newMemberEmail.includes('@')) {
          addToast('E-mail inválido.', 'error');
          return;
      }
      // Mock adding a member
      const newMember: OfficeMember = {
          userId: `u-${Date.now()}`,
          name: newMemberEmail.split('@')[0],
          email: newMemberEmail,
          role: 'Advogado',
          avatarUrl: `https://ui-avatars.com/api/?name=${newMemberEmail}&background=random`,
          permissions: { financial: false, cases: true, documents: true, settings: false }
      };
      setFormData({ ...formData, members: [...formData.members, newMember] });
      setNewMemberEmail('');
      addToast('Convite enviado (simulação). Membro adicionado.', 'success');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Perfil do Escritório" maxWidth="max-w-4xl" 
      footer={
        <div className="flex justify-end gap-3 w-full">
            <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancelar</button>
            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                <Save size={18} /> Salvar Alterações
            </button>
        </div>
      }
    >
      <div className="flex flex-col md:flex-row gap-6 h-[600px] md:h-auto">
         {/* Tabs Sidebar */}
         <div className="w-full md:w-64 flex flex-col gap-1 border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 md:pr-4">
             <button onClick={() => setActiveTab('general')} className={`text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'general' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-white/5'}`}>
                 <Building size={18} /> Dados Gerais
             </button>
             <button onClick={() => setActiveTab('team')} className={`text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'team' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-white/5'}`}>
                 <Users size={18} /> Equipe & Permissões
             </button>
             <button onClick={() => setActiveTab('extras')} className={`text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'extras' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-white/5'}`}>
                 <SettingsIcon size={18} /> Extras
             </button>
         </div>

         {/* Content Area */}
         <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
             
             {/* --- GENERAL TAB --- */}
             {activeTab === 'general' && (
                 <div className="space-y-6 animate-fade-in">
                     <div className="flex items-center gap-6">
                         <div className="relative group">
                             <div className="w-24 h-24 rounded-xl bg-slate-800 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden">
                                 {formData.logoUrl ? (
                                     <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                 ) : (
                                     <span className="text-2xl font-bold text-slate-600">{formData.name.charAt(0)}</span>
                                 )}
                             </div>
                             <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity rounded-xl">
                                 <Camera className="text-white" size={20} />
                                 <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                             </label>
                         </div>
                         <div className="flex-1">
                             <label className="text-xs text-slate-400 block mb-1">Nome do Escritório</label>
                             <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
                             <label className="text-xs text-slate-400 block mt-3 mb-1">Área de Atuação Principal</label>
                             <input type="text" name="areaOfActivity" value={formData.areaOfActivity || ''} onChange={handleInputChange} placeholder="Ex: Full Service, Trabalhista..." className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
                         </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                             <label className="text-xs text-slate-400 block mb-1">CNPJ</label>
                             <input type="text" name="cnpj" value={formData.cnpj || ''} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" placeholder="00.000.000/0001-00" />
                         </div>
                         <div>
                             <label className="text-xs text-slate-400 block mb-1">Localização (Cidade/UF)</label>
                             <div className="relative">
                                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type="text" name="location" value={formData.location} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 pl-9 text-white focus:border-indigo-500 outline-none" />
                             </div>
                         </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                             <label className="text-xs text-slate-400 block mb-1">Telefone</label>
                             <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type="text" name="phone" value={formData.phone || ''} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 pl-9 text-white focus:border-indigo-500 outline-none" placeholder="(00) 0000-0000" />
                             </div>
                         </div>
                         <div>
                             <label className="text-xs text-slate-400 block mb-1">Site</label>
                             <div className="relative">
                                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type="text" name="website" value={formData.website || ''} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 pl-9 text-white focus:border-indigo-500 outline-none" placeholder="www.exemplo.com.br" />
                             </div>
                         </div>
                     </div>
                     
                     <div>
                         <label className="text-xs text-slate-400 block mb-1">Descrição Institucional</label>
                         <textarea name="description" value={formData.description || ''} onChange={handleInputChange} rows={3} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none resize-none" placeholder="Breve resumo sobre o escritório..." />
                     </div>
                 </div>
             )}

             {/* --- TEAM TAB --- */}
             {activeTab === 'team' && (
                 <div className="space-y-6 animate-fade-in">
                     <div className="flex gap-2 p-4 bg-white/5 border border-white/10 rounded-xl items-end">
                         <div className="flex-1">
                             <label className="text-xs text-slate-400 block mb-1">Adicionar Membro (E-mail)</label>
                             <div className="relative">
                                 <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                 <input type="email" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} placeholder="novo.advogado@email.com" className="w-full bg-black/20 border border-white/10 rounded-lg p-2 pl-9 text-white text-sm outline-none focus:border-indigo-500" />
                             </div>
                         </div>
                         <button onClick={addMemberMock} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                             <Plus size={16} /> Convidar
                         </button>
                     </div>

                     <div className="space-y-3">
                         {formData.members.map(member => (
                             <div key={member.userId} className="p-4 rounded-xl bg-white/5 border border-white/10">
                                 <div className="flex justify-between items-start mb-4">
                                     <div className="flex items-center gap-3">
                                         <img src={member.avatarUrl} alt={member.name} className="w-10 h-10 rounded-full" />
                                         <div>
                                             <p className="text-sm font-bold text-white">{member.name}</p>
                                             <p className="text-xs text-slate-400">{member.email}</p>
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <select 
                                            value={member.role}
                                            onChange={(e) => updateMemberRole(member.userId, e.target.value as MemberRole)}
                                            className="bg-black/20 border border-white/10 rounded-lg text-xs text-slate-300 py-1 px-2 outline-none"
                                         >
                                             <option value="Admin">Admin</option>
                                             <option value="Advogado">Advogado</option>
                                             <option value="Estagiário">Estagiário</option>
                                             <option value="Financeiro">Financeiro</option>
                                         </select>
                                         <button onClick={() => removeMember(member.userId)} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors" title="Remover Membro">
                                             <Trash2 size={14} />
                                         </button>
                                     </div>
                                 </div>
                                 
                                 <div className="border-t border-white/5 pt-3">
                                     <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Permissões de Acesso</p>
                                     <div className="flex flex-wrap gap-2">
                                         <button 
                                            onClick={() => togglePermission(member.userId, 'cases')}
                                            className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all ${member.permissions.cases ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-transparent border-white/10 text-slate-500 opacity-50'}`}
                                         >
                                             <Scale size={12} /> Processos
                                         </button>
                                         <button 
                                            onClick={() => togglePermission(member.userId, 'financial')}
                                            className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all ${member.permissions.financial ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-transparent border-white/10 text-slate-500 opacity-50'}`}
                                         >
                                             <DollarSign size={12} /> Financeiro
                                         </button>
                                         <button 
                                            onClick={() => togglePermission(member.userId, 'documents')}
                                            className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all ${member.permissions.documents ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-transparent border-white/10 text-slate-500 opacity-50'}`}
                                         >
                                             <FileText size={12} /> Documentos
                                         </button>
                                         <button 
                                            onClick={() => togglePermission(member.userId, 'settings')}
                                            className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all ${member.permissions.settings ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-transparent border-white/10 text-slate-500 opacity-50'}`}
                                         >
                                             <SettingsIcon size={12} /> Configurações
                                         </button>
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

             {/* --- EXTRAS TAB --- */}
             {activeTab === 'extras' && (
                 <div className="space-y-6 animate-fade-in">
                     <div className="space-y-4">
                         <h4 className="text-sm font-semibold text-white border-b border-white/10 pb-2">Redes Sociais</h4>
                         <div className="space-y-3">
                             <div className="relative">
                                 <Linkedin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
                                 <input type="text" value={formData.social?.linkedin || ''} onChange={e => handleSocialChange('linkedin', e.target.value)} placeholder="LinkedIn URL" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 pl-9 text-white text-sm focus:border-indigo-500 outline-none" />
                             </div>
                             <div className="relative">
                                 <Instagram size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400" />
                                 <input type="text" value={formData.social?.instagram || ''} onChange={e => handleSocialChange('instagram', e.target.value)} placeholder="@instagram" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 pl-9 text-white text-sm focus:border-indigo-500 outline-none" />
                             </div>
                             <div className="relative">
                                 <Facebook size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
                                 <input type="text" value={formData.social?.facebook || ''} onChange={e => handleSocialChange('facebook', e.target.value)} placeholder="Facebook URL" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 pl-9 text-white text-sm focus:border-indigo-500 outline-none" />
                             </div>
                         </div>
                     </div>

                     <div className="space-y-4 pt-4 border-t border-white/10">
                         <h4 className="text-sm font-semibold text-white border-b border-white/10 pb-2">Outras Funcionalidades</h4>
                         <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                             <div>
                                 <p className="text-sm text-white font-medium">Integração com Agenda Google</p>
                                 <p className="text-xs text-slate-500">Sincronizar prazos e audiências.</p>
                             </div>
                             <button className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-slate-300 transition-colors">Conectar</button>
                         </div>
                         <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                             <div>
                                 <p className="text-sm text-white font-medium">Recorte Digital (OAB)</p>
                                 <p className="text-xs text-slate-500">Monitoramento automático de publicações.</p>
                             </div>
                             <button className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-slate-300 transition-colors">Configurar</button>
                         </div>
                     </div>

                     <div className="pt-6 border-t border-white/10">
                         <button className="w-full p-3 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors text-sm font-medium flex items-center justify-center gap-2">
                             <Trash2 size={16} /> Desativar ou Excluir Escritório
                         </button>
                     </div>
                 </div>
             )}
         </div>
      </div>
    </Modal>
  );
};