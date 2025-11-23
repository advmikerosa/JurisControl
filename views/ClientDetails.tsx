
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { GlassCard } from '../components/ui/GlassCard';
import { ArrowLeft, MapPin, Phone, Mail, Calendar, Building, User, Plus, Paperclip, Trash2, Scale, Clock, MessageSquare, Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Client, LegalCase } from '../types';

export const ClientDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [clientData, setClientData] = useState<Client | null>(null);
  const [clientCases, setClientCases] = useState<LegalCase[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'cases' | 'docs'>('cases');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (id) {
        try {
          const allClients = await storageService.getClients();
          const found = allClients.find(c => c.id === id);
          if (found) {
            setClientData(found);
            const allCases = await storageService.getCases();
            setClientCases(allCases.filter(c => c.client.id === id));
          }
        } catch (error) {
          console.error("Error loading client data:", error);
          addToast("Erro ao carregar dados do cliente", "error");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    loadData();
  }, [id, addToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="animate-spin mr-2" /> Carregando perfil...
      </div>
    );
  }

  if (!clientData) {
    return <div className="p-8 text-white">Cliente não encontrado.</div>;
  }

  const handleDeleteClient = async () => {
    if (confirm('ATENÇÃO: Excluir o cliente também deve ser feito com cautela. Deseja prosseguir?')) {
        await storageService.deleteClient(clientData.id);
        addToast('Cliente removido.', 'success');
        navigate('/clients');
    }
  };

  const handleNewCase = () => {
    navigate(`/cases?action=new&clientId=${clientData.id}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => navigate('/clients')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2">
        <ArrowLeft size={16} /> Voltar para Lista
      </button>

      <GlassCard className="p-0 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-indigo-900 to-slate-900 relative">
          <div className="absolute top-4 right-4 flex gap-2">
             <button onClick={handleDeleteClient} className="p-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-lg backdrop-blur-md transition-colors" title="Excluir Cliente">
               <Trash2 size={16} />
             </button>
          </div>
        </div>
        <div className="px-8 pb-8">
          <div className="flex flex-col md:flex-row gap-6 -mt-12 items-start">
            <div className="w-24 h-24 rounded-full border-4 border-[#0f172a] bg-slate-800 overflow-hidden shadow-xl">
              <img src={clientData.avatarUrl} alt={clientData.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 pt-14 md:pt-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                   <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                     {clientData.name}
                     <span className={`text-xs px-2 py-0.5 rounded-full border ${clientData.status === 'Ativo' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-slate-500/30 bg-slate-500/10 text-slate-400'}`}>
                       {clientData.status}
                     </span>
                   </h1>
                   {clientData.corporateName && <p className="text-slate-400 text-sm">{clientData.corporateName}</p>}
                   <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                     {clientData.type === 'PJ' ? <Building size={12} /> : <User size={12} />}
                     {clientData.type === 'PJ' ? `CNPJ: ${clientData.cnpj}` : `CPF: ${clientData.cpf}`}
                   </p>
                </div>
                <div className="flex gap-3">
                   <button onClick={handleNewCase} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                     <Scale size={16} /> Novo Processo
                   </button>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/5">
             <div className="flex items-start gap-3 text-slate-300">
               <Mail size={18} className="text-indigo-400 mt-0.5" />
               <div className="text-sm"><p className="text-xs text-slate-500">E-mail</p><p>{clientData.email}</p></div>
             </div>
             <div className="flex items-start gap-3 text-slate-300">
               <Phone size={18} className="text-indigo-400 mt-0.5" />
               <div className="text-sm"><p className="text-xs text-slate-500">Telefone</p><p>{clientData.phone}</p></div>
             </div>
             <div className="flex items-start gap-3 text-slate-300">
               <MapPin size={18} className="text-indigo-400 mt-0.5" />
               <div className="text-sm"><p className="text-xs text-slate-500">Cidade</p><p>{clientData.city}, {clientData.state}</p></div>
             </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <GlassCard>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Dados Cadastrais</h3>
            <div className="space-y-4 text-sm">
               <div><p className="text-xs text-slate-500">Data de Cadastro</p><p className="text-slate-200 flex items-center gap-2"><Calendar size={12} /> {clientData.createdAt}</p></div>
               <div><p className="text-xs text-slate-500">Endereço</p><p className="text-slate-200">{clientData.address || 'Não informado'}</p></div>
               {clientData.rg && <div><p className="text-xs text-slate-500">RG</p><p className="text-slate-200">{clientData.rg}</p></div>}
            </div>
          </GlassCard>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex border-b border-white/10">
             <button onClick={() => setActiveTab('cases')} className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'cases' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400'}`}>Processos ({clientCases.length})</button>
             <button onClick={() => setActiveTab('timeline')} className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'timeline' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400'}`}>Histórico</button>
             <button onClick={() => setActiveTab('docs')} className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'docs' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400'}`}>Documentos</button>
          </div>

          <div className="min-h-[300px]">
            {activeTab === 'cases' && (
               <div className="space-y-4">
                 <div className="flex justify-end mb-2">
                     <button onClick={handleNewCase} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-medium border border-indigo-600/20 transition-colors">
                       <Plus size={14} /> Adicionar Novo
                     </button>
                 </div>
                 {clientCases.length > 0 ? clientCases.map(c => (
                     <GlassCard key={c.id} className="p-4 flex justify-between items-center hover:border-indigo-500/30 transition-colors cursor-pointer" onClick={() => navigate('/cases')}>
                       <div><h4 className="font-semibold text-white">{c.title}</h4><p className="text-xs text-slate-400 font-mono">{c.cnj}</p></div>
                       <div className="text-right"><span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'Ativo' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-500/20 text-slate-300'}`}>{c.status}</span></div>
                     </GlassCard>
                   )) : <div className="text-center py-8 text-slate-500">Nenhum processo.</div>
                 }
               </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-6">
                 {clientData.history && clientData.history.length > 0 ? (
                   clientData.history.map(item => (
                     <div key={item.id} className="flex gap-4">
                       <div className="flex flex-col items-center">
                         <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center text-indigo-300">
                            <MessageSquare size={14} />
                         </div>
                         <div className="w-px h-full bg-white/10 my-2"></div>
                       </div>
                       <div className="flex-1 pb-4">
                         <p className="text-sm font-medium text-white">{item.type}</p>
                         <p className="text-xs text-slate-500 mb-1">{item.date} • {item.author}</p>
                         <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300">
                           {item.description}
                         </div>
                       </div>
                     </div>
                   ))
                 ) : (
                   <div className="text-center py-12 text-slate-500">
                      <Clock className="mx-auto mb-2 opacity-50" />
                      Nenhum histórico de interação registrado.
                   </div>
                 )}
              </div>
            )}

            {activeTab === 'docs' && (
               <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl text-slate-500">
                  <Paperclip className="mx-auto mb-2 opacity-50" />
                  Nenhum documento anexado especificamente a este cliente.
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
