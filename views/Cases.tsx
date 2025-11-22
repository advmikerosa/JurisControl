
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { storageService } from '../services/storageService';
import { notificationService } from '../services/notificationService';
import { Search, Filter, Eye, MoreHorizontal, Calendar, User, Briefcase, Plus, Trash2, List as ListIcon, Save, LayoutGrid, AlertTriangle, X, CheckCircle, UserCheck, FileText, DollarSign, Hash, UserPlus, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { LegalCase, Client, CaseStatus } from '../types';

// --- Memoized Components for Performance ---

const CaseListItem = React.memo(({ c, onDelete, onNavigate, openActionId, setOpenActionId }: { 
  c: LegalCase, 
  onDelete: (id: string) => void, 
  onNavigate: (id: string) => void,
  openActionId: string | null,
  setOpenActionId: (id: string | null) => void
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <GlassCard className="p-0 hover:border-indigo-500/30 transition-colors group">
        <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1 cursor-pointer" onClick={() => onNavigate(c.id)}>
            <div className="flex items-center gap-3 mb-3">
                <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium border ${
                  c.status === 'Ativo' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' :
                  c.status === 'Ganho' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
                  c.status === 'Pendente' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' :
                  'border-slate-500/30 bg-slate-500/10 text-slate-300'
                }`}>
                  {c.status}
                </span>
                <span className="text-xs text-slate-500 font-mono tracking-wide">{c.cnj}</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5 group-hover:text-indigo-300 transition-colors">{c.title}</h3>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                  Cliente: <span className="text-slate-200 font-medium">{c.client.name}</span>
                </div>
                <div className="hidden md:block w-px h-3 bg-white/10"></div>
                <div className="flex items-center gap-2">
                  Advogado: <span className="text-slate-200">{c.responsibleLawyer}</span>
                </div>
            </div>
          </div>

          <div className="flex flex-row lg:flex-col gap-6 lg:gap-2 lg:text-right lg:min-w-[150px] border-t lg:border-t-0 border-white/5 pt-4 lg:pt-0">
            <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Valor</p>
                <p className="text-base font-bold text-emerald-400">{formatCurrency(c.value)}</p>
            </div>
            <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold lg:mt-2">Próx. Audiência</p>
                <p className="text-sm text-slate-200">{c.nextHearing || '-'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:border-l border-white/10 lg:pl-6 relative justify-end">
            <button 
              onClick={() => onNavigate(c.id)}
              className="p-2.5 rounded-lg bg-white/5 hover:bg-indigo-600 hover:text-white text-slate-400 transition-colors" 
              title="Ver Detalhes"
            >
                <Eye size={20} />
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setOpenActionId(openActionId === c.id ? null : c.id)}
                className={`p-2.5 rounded-lg transition-colors ${openActionId === c.id ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                  <MoreHorizontal size={20} />
              </button>

              <AnimatePresence>
                {openActionId === c.id && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                  >
                    <button onClick={() => onDelete(c.id)} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-rose-500/10 hover:text-rose-400 flex items-center gap-2 transition-colors">
                      <Trash2 size={14} /> Excluir Processo
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
});

// Novo Componente para o Card do Board
const CaseBoardCard = React.memo(({ c, onDelete, onNavigate }: { c: LegalCase, onDelete: (id: string) => void, onNavigate: (id: string) => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={() => onNavigate(c.id)}
    >
      <GlassCard className="p-4 mb-3 cursor-pointer hover:border-indigo-500/50 group relative" hoverEffect>
        <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{c.cnj.split('-')[0]}...</span>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} 
              className="text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-rose-500/10 rounded"
            >
              <Trash2 size={12} />
            </button>
        </div>
        <h4 className="font-bold text-sm text-white mb-1 leading-snug">{c.title}</h4>
        <p className="text-xs text-slate-400 mb-3 truncate">{c.client.name}</p>
        
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <span className="text-emerald-400 text-xs font-bold">R$ {c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            {c.nextHearing && (
               <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                 <Calendar size={8} /> {c.nextHearing.split('/').slice(0,2).join('/')}
               </span>
            )}
        </div>
      </GlassCard>
    </motion.div>
  );
});

export const Cases: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();

  // Data State
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  // Lazy Loading State
  const [visibleCount, setVisibleCount] = useState(20);
  const observerTarget = useRef<HTMLDivElement>(null);

  // View State
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyMyCases, setShowOnlyMyCases] = useState(false);
  
  // Modais e Formulários
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
  const [preSelectedClientId, setPreSelectedClientId] = useState<string>('');
  
  const DRAFT_KEY = 'new_case_draft';

  // Form States para Novo Processo
  const [newCaseForm, setNewCaseForm] = useState({
    cnj: '',
    value: '',
    title: '',
    responsible: '', // Inicialmente vazio, vamos preencher no useEffect se necessário, mas permitir edição
    nextHearing: '',
    description: ''
  });

  // Quick Client Creation State
  const [isQuickClientModalOpen, setIsQuickClientModalOpen] = useState(false);
  const [quickClientData, setQuickClientData] = useState({
    name: '',
    type: 'PF',
    doc: '',
    email: '',
    phone: ''
  });

  // Load Data on Mount
  useEffect(() => {
    setCases(storageService.getCases());
    const clients = storageService.getClients();
    setAvailableClients(clients);
    setClientsLoaded(true);
    
    // Set default responsible only if empty and user exists
    if (!newCaseForm.responsible && user?.name) {
      setNewCaseForm(prev => ({ ...prev, responsible: user.name }));
    }
  }, [user]);

  // --- Infinite Scroll Logic (List View) ---
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries;
    if (target.isIntersecting && viewMode === 'list') {
      setVisibleCount(prev => prev + 20);
    }
  }, [viewMode]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
      threshold: 1.0
    });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => {
      if (observerTarget.current) observer.unobserve(observerTarget.current);
    };
  }, [handleObserver, viewMode]);

  // --- Auto-Save Logic ---
  useEffect(() => {
    if (isNewCaseModalOpen) {
      const draft = storageService.getDraft(DRAFT_KEY);
      if (draft) {
        setNewCaseForm(draft);
        if (draft.preSelectedClientId) setPreSelectedClientId(draft.preSelectedClientId);
        if(draft.title) addToast('Rascunho restaurado automaticamente.', 'info');
      }
    }
  }, [isNewCaseModalOpen]);

  useEffect(() => {
    if (isNewCaseModalOpen) {
      const timer = setTimeout(() => {
        storageService.saveDraft(DRAFT_KEY, { ...newCaseForm, preSelectedClientId });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [newCaseForm, preSelectedClientId, isNewCaseModalOpen]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const clientId = params.get('clientId');

    if (action === 'new') {
      setIsNewCaseModalOpen(true);
      if (clientId) setPreSelectedClientId(clientId);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location]);
  
  // Optimized Filtering
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchesSearch = 
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cnj.includes(searchTerm) ||
        c.client.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesOwner = showOnlyMyCases 
        ? (user?.name && c.responsibleLawyer.toLowerCase().includes(user.name.toLowerCase()))
        : true;

      return matchesSearch && matchesOwner;
    });
  }, [cases, searchTerm, showOnlyMyCases, user]);

  const displayedCases = useMemo(() => {
    return filteredCases.slice(0, visibleCount);
  }, [filteredCases, visibleCount]);

  // Input Masking
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^\d,]/g, '');
    setNewCaseForm({ ...newCaseForm, value: val });
  };

  const handleCNJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Mask: 0000000-00.0000.0.00.0000
    let v = e.target.value.replace(/\D/g, '');
    v = v.replace(/^(\d{7})(\d)/, '$1-$2');
    v = v.replace(/-(\d{2})(\d)/, '-$1.$2');
    v = v.replace(/\.(\d{4})(\d)/, '.$1.$2');
    v = v.replace(/\.(\d{1})(\d)/, '.$1.$2'); // Ramo justiça
    v = v.replace(/\.(\d{2})(\d)/, '.$1.$2'); // Tribunal e Vara (simplificado)
    
    setNewCaseForm({ ...newCaseForm, cnj: v.substring(0, 25) });
  };

  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!preSelectedClientId) {
      addToast('Por favor, selecione um cliente.', 'error');
      return;
    }
    if (!newCaseForm.title) {
      addToast('Título é obrigatório.', 'error');
      return;
    }

    const client = availableClients.find(c => c.id === preSelectedClientId);
    if (!client) return;

    const newCase: LegalCase = {
      id: `case-${Date.now()}`,
      cnj: newCaseForm.cnj || 'N/A',
      title: newCaseForm.title,
      client: client,
      status: CaseStatus.ACTIVE,
      value: parseFloat(newCaseForm.value.replace(',', '.')) || 0,
      responsibleLawyer: newCaseForm.responsible || 'Advogado',
      nextHearing: newCaseForm.nextHearing ? new Date(newCaseForm.nextHearing).toLocaleDateString('pt-BR') : undefined
    };

    storageService.saveCase(newCase);
    setCases(storageService.getCases());
    storageService.clearDraft(DRAFT_KEY);
    setIsNewCaseModalOpen(false);
    setPreSelectedClientId('');
    setNewCaseForm({ cnj: '', value: '', title: '', responsible: user?.name || '', nextHearing: '', description: '' });
    addToast('Processo cadastrado com sucesso!', 'success');
    storageService.logActivity(`Novo processo criado: ${newCase.title}`);
    if (user && user.email) {
      notificationService.notify('Novo Processo Criado', `Processo "${newCase.title}" criado para ${client.name}`, 'success');
    }
  };

  const handleDeleteCase = useCallback((id: string) => {
    setCaseToDelete(id);
    setOpenActionMenuId(null);
  }, []);

  const confirmDelete = () => {
    if (caseToDelete) {
      storageService.deleteCase(caseToDelete);
      setCases(storageService.getCases());
      addToast('Processo excluído permanentemente.', 'success');
      setCaseToDelete(null);
    }
  };

  const handleQuickClientSave = () => {
     if(!quickClientData.name) {
       addToast('Nome é obrigatório', 'error');
       return;
     }
     const newClient: Client = {
      id: `cli-${Date.now()}`,
      name: quickClientData.name,
      type: quickClientData.type as any,
      email: quickClientData.email,
      phone: quickClientData.phone,
      status: 'Ativo',
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(quickClientData.name)}&background=random`,
      address: '', city: '', state: '',
      documents: [], history: [], alerts: [],
      createdAt: new Date().toLocaleDateString('pt-BR'),
      cpf: quickClientData.type === 'PF' ? quickClientData.doc : undefined,
      cnpj: quickClientData.type === 'PJ' ? quickClientData.doc : undefined,
    };

    storageService.saveClient(newClient);
    setAvailableClients(storageService.getClients());
    setPreSelectedClientId(newClient.id);
    setIsQuickClientModalOpen(false);
    setQuickClientData({ name: '', type: 'PF', doc: '', email: '', phone: '' });
    addToast('Cliente criado e vinculado!', 'success');
  };

  const goToDetails = (id: string) => {
    navigate(`/cases/${id}`);
  }

  // Columns for Kanban View inside Cases
  const columns = [
    { status: CaseStatus.ACTIVE, label: 'Ativos', color: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' },
    { status: CaseStatus.PENDING, label: 'Pendentes', color: 'bg-amber-500/20 border-amber-500/30 text-amber-300' },
    { status: CaseStatus.WON, label: 'Ganhos', color: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' },
    { status: CaseStatus.ARCHIVED, label: 'Arquivados', color: 'bg-slate-500/20 border-slate-500/30 text-slate-300' },
  ];

  return (
    <div className="space-y-8">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Processos Jurídicos</h1>
          <p className="text-slate-400 mt-1">Gerencie seus casos, prazos e andamentos.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setIsNewCaseModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-lg shadow-indigo-500/20 hover:scale-105"
          >
            <Plus size={18} />
            <span className="whitespace-nowrap">Novo Processo</span>
          </button>
        </div>
      </div>

      {/* SEARCH & FILTER TOOLBAR */}
      <GlassCard className="p-4">
         <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por número, cliente ou título..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            <div className="flex gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
               <button 
                 onClick={() => setShowOnlyMyCases(!showOnlyMyCases)}
                 className={`px-4 py-2.5 rounded-lg border transition-colors flex items-center gap-2 whitespace-nowrap ${
                   showOnlyMyCases 
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' 
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                 }`}
                 title="Meus Processos"
               >
                 <UserCheck size={18} />
                 <span className="hidden sm:inline">Meus Processos</span>
               </button>

               <button className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors whitespace-nowrap">
                 <Filter size={18} />
                 <span className="hidden sm:inline">Filtros</span>
               </button>
               
               <div className="w-px h-auto bg-white/10 mx-1 shrink-0"></div>
               
               <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 shrink-0">
                 <button 
                   onClick={() => setViewMode('list')}
                   className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                   title="Lista"
                 >
                   <ListIcon size={20} />
                 </button>
                 <button 
                   onClick={() => setViewMode('board')}
                   className={`p-1.5 rounded-md transition-all ${viewMode === 'board' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                   title="Quadro (Kanban)"
                 >
                   <LayoutGrid size={20} />
                 </button>
               </div>
            </div>
         </div>
      </GlassCard>

      {/* CONTENT AREA */}
      {filteredCases.length > 0 || (viewMode === 'board' && cases.length > 0) ? (
        viewMode === 'list' ? (
          <div className="space-y-4">
             {displayedCases.length > 0 ? displayedCases.map(c => (
               <CaseListItem 
                 key={c.id} 
                 c={c} 
                 onDelete={handleDeleteCase} 
                 onNavigate={goToDetails} 
                 openActionId={openActionMenuId}
                 setOpenActionId={setOpenActionMenuId}
               />
             )) : (
               <div className="text-center py-10 text-slate-500">Nenhum processo encontrado na lista.</div>
             )}
             {/* Infinite Scroll Anchor */}
             <div ref={observerTarget} className="h-4 w-full"></div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
             <div className="flex gap-6 min-w-[1000px]">
                {columns.map(col => {
                   const colCases = filteredCases.filter(c => c.status === col.status);
                   return (
                     <div key={col.status} className="flex-1 min-w-[300px] flex flex-col h-full">
                        <div className={`flex items-center justify-between mb-4 px-3 py-2 rounded-lg border ${col.color}`}>
                           <h3 className="font-bold">{col.label}</h3>
                           <span className="text-xs font-medium px-2 py-0.5 rounded bg-black/20">{colCases.length}</span>
                        </div>
                        <div className="space-y-3">
                           {colCases.map(c => (
                             <CaseBoardCard 
                               key={c.id} 
                               c={c} 
                               onDelete={handleDeleteCase}
                               onNavigate={goToDetails}
                             />
                           ))}
                           {colCases.length === 0 && (
                             <div className="h-24 border-2 border-dashed border-white/5 rounded-xl flex items-center justify-center text-slate-600 text-xs">
                               Vazio
                             </div>
                           )}
                        </div>
                     </div>
                   );
                })}
             </div>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
           <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <Briefcase size={32} className="opacity-50" />
           </div>
           <p className="text-lg font-medium text-slate-300">Nenhum processo encontrado</p>
           <p className="text-sm mb-6">Tente ajustar os filtros ou crie um novo processo.</p>
           <button onClick={() => { setSearchTerm(''); setIsNewCaseModalOpen(true); setShowOnlyMyCases(false); }} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
             Cadastrar Processo Agora &rarr;
           </button>
        </div>
      )}

      {/* MODAL NOVO PROCESSO */}
      <Modal
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        title="Novo Processo Jurídico"
        maxWidth="max-w-2xl"
        footer={
           <>
             <button onClick={() => setIsNewCaseModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Cancelar</button>
             <button onClick={handleCreateCase} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-lg shadow-indigo-500/20">Criar Processo</button>
           </>
        }
      >
        <form className="space-y-6 animate-fade-in">
           {/* Section: Cliente */}
           <div className="bg-white/5 p-4 rounded-xl border border-white/10">
             <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                   <User size={16} className="text-indigo-400" /> Cliente <span className="text-rose-400">*</span>
                </label>
                <button 
                  type="button" 
                  onClick={() => setIsQuickClientModalOpen(true)} 
                  className="text-xs bg-indigo-600/20 text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-600/30 transition-colors flex items-center gap-1 border border-indigo-500/30 font-medium"
                >
                   <UserPlus size={14} /> Cadastrar Rápido
                </button>
             </div>
             <div className="relative">
                <select 
                  value={preSelectedClientId}
                  onChange={(e) => setPreSelectedClientId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg py-3 pl-3 pr-4 text-slate-200 focus:border-indigo-500 focus:outline-none appearance-none scheme-dark text-sm"
                >
                   <option value="" className="bg-slate-800 text-slate-500">Selecione um cliente da lista...</option>
                   {clientsLoaded && availableClients.length > 0 ? (
                     availableClients.map(client => (
                       <option key={client.id} value={client.id} className="bg-slate-800">
                         {client.name} ({client.type})
                       </option>
                     ))
                   ) : (
                     <option value="" disabled className="bg-slate-800">Nenhum cliente disponível</option>
                   )}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <Filter size={14} />
                </div>
             </div>
             {availableClients.length === 0 && clientsLoaded && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-2">
                   <AlertTriangle size={12} /> Nenhum cliente encontrado. Cadastre um novo usando o botão acima.
                </p>
             )}
           </div>

           {/* Section: Dados do Processo */}
           <div className="space-y-4">
               <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-2">Dados da Ação</h4>
               
               <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 ml-1">Título do Processo <span className="text-rose-400">*</span></label>
                  <div className="relative group">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                    <input 
                      type="text" 
                      value={newCaseForm.title} 
                      onChange={(e) => setNewCaseForm({...newCaseForm, title: e.target.value})}
                      placeholder="Ex: Ação de Cobrança vs Empresa X"
                      className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:border-indigo-500 focus:outline-none transition-all" 
                    />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                     <label className="text-xs font-medium text-slate-400 ml-1">Número CNJ</label>
                     <div className="relative group">
                       <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                       <input 
                         type="text" 
                         value={newCaseForm.cnj} 
                         onChange={handleCNJChange}
                         maxLength={25}
                         placeholder="0000000-00.0000.0.00.0000"
                         className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:border-indigo-500 focus:outline-none font-mono text-sm transition-all" 
                       />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-xs font-medium text-slate-400 ml-1">Valor da Causa</label>
                     <div className="relative group">
                       <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={16} />
                       <input 
                         type="text" 
                         value={newCaseForm.value} 
                         onChange={handleValueChange}
                         placeholder="0,00"
                         className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:border-emerald-500 focus:outline-none font-mono text-sm transition-all" 
                       />
                     </div>
                  </div>
               </div>
           </div>

           <div className="w-full h-px bg-white/5 my-2"></div>

           {/* Section: Responsável e Prazos */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                 <label className="text-xs font-medium text-slate-400 ml-1">Advogado Responsável</label>
                 <div className="relative group">
                   <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                   <input 
                     type="text" 
                     value={newCaseForm.responsible} 
                     onChange={(e) => setNewCaseForm({...newCaseForm, responsible: e.target.value})}
                     placeholder="Nome do Advogado"
                     className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:border-indigo-500 focus:outline-none transition-all" 
                   />
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-xs font-medium text-slate-400 ml-1">Próxima Audiência/Prazo</label>
                 <div className="relative group">
                   <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                   <input 
                     type="date" 
                     value={newCaseForm.nextHearing} 
                     onChange={(e) => setNewCaseForm({...newCaseForm, nextHearing: e.target.value})}
                     className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:border-indigo-500 focus:outline-none scheme-dark transition-all" 
                   />
                 </div>
              </div>
           </div>
        </form>
      </Modal>

      {/* MODAL CLIENTE RÁPIDO */}
      <Modal
        isOpen={isQuickClientModalOpen}
        onClose={() => setIsQuickClientModalOpen(false)}
        title="Cadastro Rápido de Cliente"
        footer={
           <>
             <button onClick={() => setIsQuickClientModalOpen(false)} className="px-3 py-1.5 text-sm rounded-lg text-slate-400 hover:text-white">Cancelar</button>
             <button onClick={handleQuickClientSave} className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">Salvar e Vincular</button>
           </>
        }
      >
         <div className="space-y-4">
            <div className="space-y-1">
                <label className="text-xs text-slate-400 ml-1">Nome do Cliente <span className="text-rose-400">*</span></label>
                <input 
                  type="text" 
                  placeholder="Nome Completo" 
                  value={quickClientData.name}
                  onChange={e => setQuickClientData({...quickClientData, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:border-emerald-500 focus:outline-none"
                  autoFocus
                />
            </div>
            
            <div className="flex gap-2">
               <button 
                 type="button"
                 onClick={() => setQuickClientData({...quickClientData, type: 'PF'})}
                 className={`flex-1 py-1.5 text-xs rounded border ${quickClientData.type === 'PF' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-white/10 text-slate-400'}`}
               >
                 Pessoa Física
               </button>
               <button 
                 type="button"
                 onClick={() => setQuickClientData({...quickClientData, type: 'PJ'})}
                 className={`flex-1 py-1.5 text-xs rounded border ${quickClientData.type === 'PJ' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-white/10 text-slate-400'}`}
               >
                 Pessoa Jurídica
               </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1">
                 <label className="text-xs text-slate-400 ml-1">Email</label>
                 <input type="email" placeholder="email@exemplo.com" value={quickClientData.email} onChange={e => setQuickClientData({...quickClientData, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white text-sm" />
               </div>
               <div className="space-y-1">
                 <label className="text-xs text-slate-400 ml-1">Telefone</label>
                 <input type="text" placeholder="(00) 00000-0000" value={quickClientData.phone} onChange={e => setQuickClientData({...quickClientData, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white text-sm" />
               </div>
            </div>
         </div>
      </Modal>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <Modal
        isOpen={!!caseToDelete}
        onClose={() => setCaseToDelete(null)}
        title="Confirmar Exclusão"
        footer={
           <div className="flex gap-3 w-full justify-end">
             <button 
               onClick={() => setCaseToDelete(null)} 
               className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5 transition-colors"
             >
               Cancelar
             </button>
             <button 
               onClick={confirmDelete} 
               className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors shadow-lg shadow-rose-600/20 flex items-center gap-2"
             >
               <Trash2 size={16} />
               Excluir Definitivamente
             </button>
           </div>
        }
      >
         <div className="flex flex-col items-center text-center p-4">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
               <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Tem certeza absoluta?</h3>
            <p className="text-slate-300">
               Esta ação é <strong className="text-rose-400">irreversível</strong>. 
               O processo será permanentemente removido do banco de dados, incluindo histórico e valores associados.
            </p>
         </div>
      </Modal>
    </div>
  );
};
