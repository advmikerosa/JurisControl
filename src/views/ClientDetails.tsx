import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { GlassCard } from '../components/ui/GlassCard';
import { ArrowLeft, MapPin, Phone, Mail, Calendar, Building, User, Plus, Paperclip, Trash2, Scale, Clock, MessageSquare, Loader2, Tag, Save, Edit2, X, FileText, Send, CheckCircle, AlertCircle, Briefcase, MoreHorizontal, BellRing } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Client, LegalCase, ClientInteraction, ClientDocument, ClientType, ClientAlert } from '../types';
import { Modal } from '../components/ui/Modal';
import { isValidCPF, isValidCNPJ } from '../utils/validators';

export const ClientDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  
  const [clientData, setClientData] = useState<Client | null>(null);
  const [clientCases, setClientCases] = useState<LegalCase[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'cases' | 'docs'>('cases');
  const [loading, setLoading] = useState(true);

  // Edit Mode State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [formErrors, setFormErrors] = useState<any>({});

  // Notes & Interactions
  const [noteText, setNoteText] = useState('');
  const [interactionText, setInteractionText] = useState('');
  const [interactionType, setInteractionType] = useState<'Reunião' | 'Email' | 'Telefone' | 'Nota' | 'Whatsapp'>('Telefone');
  
  // Tags
  const [newTag, setNewTag] = useState('');
  const [isTagInputVisible, setIsTagInputVisible] = useState(false);

  // Alerts
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [newAlert, setNewAlert] = useState({ title: '', message: '', type: 'warning' as 'warning' | 'critical' | 'info' });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
        const allClients = await storageService.getClients();
        const client = allClients.find(c => c.id === id);
        
        if (client) {
            setClientData(client);
            setNoteText(client.notes || '');
            // Load Cases
            const allCases = await storageService.getCases();
            setClientCases(allCases.filter(c => c.client.id === id));
        } else {
            addToast('Cliente não encontrado.', 'error');
            navigate('/clients');
        }
    } catch (error) {
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  const openEditModal = () => {
      if (clientData) {
          setEditForm({ ...clientData });
          setFormErrors({});
          setIsEditModalOpen(true);
      }
  };

  const handleSaveClient = async () => {
      if (!clientData || !editForm.name) return;
      
      // Validation
      const errors: any = {};
      if (!editForm.name) errors.name = 'Nome obrigatório';
      if (clientData.type === 'PF' && editForm.cpf && !isValidCPF(editForm.cpf)) errors.cpf = 'CPF Inválido';
      if (clientData.type === 'PJ' && editForm.cnpj && !isValidCNPJ(editForm.cnpj)) errors.cnpj = 'CNPJ Inválido';
      
      if (Object.keys(errors).length > 0) {
          setFormErrors(errors);
          return;
      }

      // Merge ensuring we don't lose tags or notes if editForm was stale (though we sync on open)
      const updatedClient = { 
          ...clientData, 
          ...editForm, 
          tags: clientData.tags, 
          notes: clientData.notes,
          history: clientData.history,
          documents: clientData.documents,
          alerts: clientData.alerts
      };

      await storageService.saveClient(updatedClient);
      setClientData(updatedClient);
      setIsEditModalOpen(false);
      addToast('Perfil atualizado com sucesso.', 'success');
  };

  const handleSaveNotes = async () => {
      if (!clientData) return;
      const updatedClient = { ...clientData, notes: noteText };
      await storageService.saveClient(updatedClient);
      setClientData(updatedClient);
      addToast('Anotações salvas.', 'success');
  };

  const handleAddInteraction = async () => {
      if (!clientData || !interactionText.trim()) return;
      
      const newInteraction: ClientInteraction = {
          id: Date.now().toString(),
          date: new Date().toLocaleString('pt-BR'),
          type: interactionType,
          description: interactionText,
          author: user?.name || 'Você'
      };

      const updatedClient = { 
          ...clientData, 
          history: [newInteraction, ...(clientData.history || [])] 
      };

      await storageService.saveClient(updatedClient);
      setClientData(updatedClient);
      setInteractionText('');
      addToast('Interação registrada.', 'success');
  };

  const handleAddTag = async () => {
      if (!clientData || !newTag.trim()) return;
      const tags = clientData.tags || [];
      if (!tags.includes(newTag.trim())) {
          const updatedClient = { ...clientData, tags: [...tags, newTag.trim()] };
          await storageService.saveClient(updatedClient);
          setClientData(updatedClient);
      }
      setNewTag('');
      setIsTagInputVisible(false);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
      if (!clientData) return;
      const updatedClient = { ...clientData, tags: (clientData.tags || []).filter(t => t !== tagToRemove) };
      await storageService.saveClient(updatedClient);
      setClientData(updatedClient);
  };

  const handleAddAlert = async () => {
      if (!clientData || !newAlert.title) return;
      
      const alert: ClientAlert = {
          id: Date.now().toString(),
          title: newAlert.title,
          message: newAlert.message,
          type: newAlert.type,
          date: new Date().toLocaleDateString('pt-BR'),
          isActionable: false
      };

      const updatedClient = {
          ...clientData,
          alerts: [alert, ...(clientData.alerts || [])]
      };

      await storageService.saveClient(updatedClient);
      setClientData(updatedClient);
      setIsAlertModalOpen(false);
      setNewAlert({ title: '', message: '', type: 'warning' });
      addToast('Alerta adicionado.', 'success');
  };

  const handleDismissAlert = async (alertId: string) => {
      if (!clientData) return;
      const updatedClient = {
          ...clientData,
          alerts: (clientData.alerts || []).filter(a => a.id !== alertId)
      };
      await storageService.saveClient(updatedClient);
      setClientData(updatedClient);
  };

  const handleDeleteClient = async () => {
      if (!clientData) return;
      if (confirm('ATENÇÃO: Deseja realmente excluir este cliente e todo o seu histórico? Esta ação não pode ser desfeita.')) {
          try {
            await storageService.deleteClient(clientData.id);
            addToast('Cliente excluído com sucesso.', 'success');
            navigate('/clients');
          } catch (e: any) {
            addToast(e.message, 'error');
          }
      }
  };

  const handleAddDocument = async () => {
      if (!clientData) return;
      const newDoc: ClientDocument = {
          id: Date.now().toString(),
          title: `Documento ${clientData.documents?.length ? clientData.documents.length + 1 : 1}`,
          type: 'PDF',
          uploadDate: new Date().toLocaleDateString('pt-BR'),
          size: '1.2 MB'
      };
      const updatedClient = {
          ...clientData,
          documents: [newDoc, ...(clientData.documents || [])]
      };
      await storageService.saveClient(updatedClient);
      setClientData(updatedClient);
      addToast('Documento adicionado (simulação).', 'success');
  };

  const getInteractionIcon = (type: string) => {
      switch(type) {
          case 'Telefone': return <Phone size={14} />;
          case 'Email': return <Mail size={14} />;
          case 'Whatsapp': return <MessageSquare size={14} />;
          case 'Reunião': return <User size={14} />;
          default: return <FileText size={14} />;
      }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" /></div>;
  if (!clientData) return null;

  return (
    <div className="space-y-6 pb-20">
       {/* Header */}
       <div className="flex flex-col gap-4">
           <button onClick={() => navigate('/clients')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors w-fit">
               <ArrowLeft size={16} /> Voltar para Clientes
           </button>
           
           <GlassCard className="p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-3xl rounded-full -mr-10 -mt-10"></div>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-white/10 p-1 shadow-xl shrink-0">
                            <img src={clientData.avatarUrl} alt={clientData.name} className="w-full h-full rounded-full object-cover" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-2xl font-bold text-white">{clientData.name}</h1>
                                <span className={`text-xs px-2 py-0.5 rounded-full border uppercase tracking-wide font-bold ${clientData.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                    {clientData.status}
                                </span>
                            </div>
                            <p className="text-slate-400 text-sm flex items-center gap-2">
                                {clientData.type === 'PJ' ? <Building size={14}/> : <User size={14}/>}
                                {clientData.type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'} • Cadastrado em {clientData.createdAt}
                            </p>
                            
                            {/* Tags */}
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                {clientData.tags?.map(tag => (
                                    <span key={tag} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors group cursor-default">
                                        {tag}
                                        <button onClick={() => handleRemoveTag(tag)} className="hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                                    </span>
                                ))}
                                {isTagInputVisible ? (
                                    <div className="flex items-center gap-1 animate-fade-in">
                                        <input 
                                            type="text" 
                                            value={newTag} 
                                            onChange={e => setNewTag(e.target.value)} 
                                            className="bg-black/20 border border-white/10 rounded px-2 py-0.5 text-xs text-white w-24 outline-none focus:border-indigo-500"
                                            placeholder="Nova tag..."
                                            onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                                            autoFocus
                                        />
                                        <button onClick={handleAddTag} className="text-emerald-400 hover:text-emerald-300 p-0.5"><CheckCircle size={14} /></button>
                                        <button onClick={() => setIsTagInputVisible(false)} className="text-rose-400 hover:text-rose-300 p-0.5"><X size={14} /></button>
                                    </div>
                                ) : (
                                    <button onClick={() => setIsTagInputVisible(true)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 border-dashed hover:border-solid transition-all">
                                        <Plus size={10} /> Tag
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-3 self-end md:self-center">
                        <button onClick={handleDeleteClient} className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors" title="Excluir Cliente">
                            <Trash2 size={20} />
                        </button>
                        <button onClick={openEditModal} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-white/5">
                            <Edit2 size={16} /> Editar Perfil
                        </button>
                    </div>
                </div>
           </GlassCard>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Sidebar */}
           <div className="space-y-6">
               <GlassCard>
                   <h3 className="text-sm font-bold text-white mb-4 border-b border-white/10 pb-2">Informações de Contato</h3>
                   <div className="space-y-4 text-sm">
                       <div className="flex items-start gap-3">
                           <Mail size={16} className="text-indigo-400 mt-0.5" />
                           <div className="overflow-hidden">
                               <span className="text-slate-500 text-xs block">E-mail</span>
                               <a href={`mailto:${clientData.email}`} className="text-slate-200 hover:text-white hover:underline truncate block">{clientData.email}</a>
                           </div>
                       </div>
                       <div className="flex items-start gap-3">
                           <Phone size={16} className="text-indigo-400 mt-0.5" />
                           <div>
                               <span className="text-slate-500 text-xs block">Telefone</span>
                               <span className="text-slate-200">{clientData.phone}</span>
                           </div>
                       </div>
                       <div className="flex items-start gap-3">
                           <MapPin size={16} className="text-indigo-400 mt-0.5" />
                           <div>
                               <span className="text-slate-500 text-xs block">Localização</span>
                               <span className="text-slate-200">{clientData.city} - {clientData.state}</span>
                               {clientData.address && <span className="text-slate-400 text-xs block mt-0.5">{clientData.address}</span>}
                           </div>
                       </div>
                       <div className="flex items-start gap-3">
                           <FileText size={16} className="text-indigo-400 mt-0.5" />
                           <div>
                               <span className="text-slate-500 text-xs block">{clientData.type === 'PJ' ? 'CNPJ' : 'CPF'}</span>
                               <span className="text-slate-200 font-mono">{clientData.type === 'PJ' ? clientData.cnpj : clientData.cpf}</span>
                           </div>
                       </div>
                   </div>
               </GlassCard>

               {/* Alerts Section */}
               <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                   <div className="flex justify-between items-center mb-3">
                       <h3 className="text-sm font-bold text-white flex items-center gap-2"><BellRing size={16} className="text-rose-400"/> Alertas</h3>
                       <button onClick={() => setIsAlertModalOpen(true)} className="text-xs bg-white/10 hover:bg-white/20 p-1.5 rounded transition-colors"><Plus size={14}/></button>
                   </div>
                   
                   <div className="space-y-2">
                       {clientData.alerts && clientData.alerts.length > 0 ? (
                           clientData.alerts.map(alert => (
                               <div key={alert.id} className={`p-3 rounded-lg border flex gap-3 items-start group relative ${alert.type === 'critical' ? 'bg-rose-500/10 border-rose-500/30' : alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                                   <div className={`mt-0.5 ${alert.type === 'critical' ? 'text-rose-400' : alert.type === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>
                                       <AlertCircle size={14} />
                                   </div>
                                   <div className="flex-1 min-w-0">
                                       <p className={`text-xs font-bold ${alert.type === 'critical' ? 'text-rose-200' : 'text-slate-200'}`}>{alert.title}</p>
                                       <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{alert.message}</p>
                                   </div>
                                   <button onClick={() => handleDismissAlert(alert.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white p-1 transition-opacity">
                                       <X size={12} />
                                   </button>
                               </div>
                           ))
                       ) : (
                           <p className="text-xs text-slate-500 italic text-center py-2">Nenhum alerta registrado.</p>
                       )}
                   </div>
               </div>

               <GlassCard className="flex flex-col h-64">
                   <div className="flex justify-between items-center mb-2">
                       <h3 className="text-sm font-bold text-white flex items-center gap-2"><FileText size={16} className="text-amber-400"/> Notas Internas</h3>
                       <button onClick={handleSaveNotes} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium">
                           <Save size={12} /> Salvar
                       </button>
                   </div>
                   <textarea 
                       className="flex-1 w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-slate-300 outline-none resize-none focus:border-indigo-500/50 placeholder:text-slate-600 leading-relaxed"
                       placeholder="Anotações privadas sobre o cliente..."
                       value={noteText}
                       onChange={(e) => setNoteText(e.target.value)}
                   ></textarea>
               </GlassCard>
           </div>

           {/* Main Tabs */}
           <div className="lg:col-span-2">
               <GlassCard className="min-h-[500px] flex flex-col">
                   <div className="flex border-b