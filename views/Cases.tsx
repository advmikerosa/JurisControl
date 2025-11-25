
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { storageService } from '../services/storageService';
import { Search, Eye, MoreHorizontal, Briefcase, Plus, Trash2, List as ListIcon, LayoutGrid, X, UserCheck, UserPlus, Loader2, Download, Edit2, Filter, Calendar, ChevronDown, SortAsc, SortDesc } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { LegalCase, Client, CaseStatus, LegalCategory } from '../types';
import { CaseFormModal } from '../components/CaseFormModal';

const masks = {
  cpf: (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14),
  cnpj: (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18),
};

const LEGAL_CATEGORIES: LegalCategory[] = [
  'Administrativo', 'Cível', 'Comercial/Empresarial', 'Consumidor', 
  'Família', 'Trabalhista', 'Imobiliário', 'Tributário', 
  'Penal', 'Previdenciário', 'Outro'
];

const CaseListItem = React.memo(({ c, onDelete, onEdit, onNavigate, openActionId, setOpenActionId }: any) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <GlassCard className="p-0 hover:border-indigo-500/30 transition-colors group bg-[#1e293b]/80 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/5 to-transparent">
        <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1 cursor-pointer overflow-hidden" onClick={() => onNavigate(c.id)}>
            <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium border ${
                  c.status === 'Ativo' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' :
                  c.status === 'Ganho' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
                  c.status === 'Pendente' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' :
                  'border-slate-500/30 bg-slate-500/10 text-slate-300'
                }`}>
                  {c.status}
                </span>
                {c.category && (
                   <span className="px-2 py-0.5 text-xs rounded bg-white/5 text-slate-400 border border-white/5">
                     {c.category}
                   </span>
                )}
                <span className="text-xs text-slate-500 font-mono tracking-wide hidden sm:inline">{c.cnj}</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5 group-hover:text-indigo-300 transition-colors truncate" title={c.title}>{c.title}</h3>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-2 max-w-full"><span className="w-2 h-2 rounded-full bg-slate-600 shrink-0"></span><span className="text-slate-200 font-medium truncate">{c.client.name}</span></div>
                <div className="hidden md:block w-px h-3 bg-white/10"></div>
                <div className="flex items-center gap-2 truncate">Advogado: <span className="text-slate-200">{c.responsibleLawyer}</span></div>
                {c.phase && (
                  <>
                     <div className="hidden md:block w-px h-3 bg-white/10"></div>
                     <div className="flex items-center gap-2 truncate">Fase: <span className="text-indigo-300">{c.phase}</span></div>
                  </>
                )}
            </div>
          </div>
          <div className="flex flex-row lg:flex-col gap-6 lg:gap-2 lg:text-right lg:min-w-[150px] border-t lg:border-t-0 border-white/5 pt-4 lg:pt-0">
            <div><p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Valor</p><p className="text-base font-bold text-emerald-400">{formatCurrency(c.value)}</p></div>
            <div><p className="text-xs text-slate-500 uppercase tracking-wider font-semibold lg:mt-2">Próx. Audiência</p><p className="text-sm text-slate-200">{c.nextHearing || '-'}</p></div>
          </div>
          <div className="flex items-center gap-3 lg:border-l border-white/10 lg:pl-6 relative justify-end">
            <button onClick={() => onNavigate(c.id)} className="p-2.5 rounded-lg bg-white/5 hover:bg-indigo-600 hover:text-white text-slate-400 transition-colors" title="Ver Detalhes"><Eye size={20} /></button>
            <div className="relative">
              <button onClick={() => setOpenActionId(openActionId === c.id ? null : c.id)} className={`p-2.5 rounded-lg transition-colors ${openActionId === c.id ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><MoreHorizontal size={20} /></button>
              <AnimatePresence>
                {openActionId === c.id && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-full mt-2 w-48 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <button onClick={() => onEdit(c.id)} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-400 flex items-center gap-2 transition-colors"><Edit2 size={14} /> Editar Processo</button>
                    <button onClick={() => onDelete(c.id)} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-rose-500/10 hover:text-rose-400 flex items-center gap-2 transition-colors"><Trash2 size={14} /> Excluir Processo</button>
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

const CaseBoardCard = React.memo(({ c, onDelete, onEdit, onNavigate }: any) => {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} onClick={() => onNavigate(c.id)}>
      <GlassCard className="p-4 mb-3 cursor-pointer hover:border-indigo-500/50 group relative flex flex-col h-full" hoverEffect>
        <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
               <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded w-fit">{c.cnj.split('-')[0]}...</span>
               {c.category && <span className="text-[9px] text-indigo-300 font-medium">{c.category}</span>}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onEdit(c.id); }} className="text-slate-600 hover:text-indigo-400 p-1 hover:bg-indigo-500/10 rounded"><Edit2 size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} className="text-slate-600 hover:text-rose-400 p-1 hover:bg-rose-500/10 rounded"><Trash2 size={12} /></button>
            </div>
        </div>
        <h4 className="font-bold text-sm text-white mb-1 leading-snug line-clamp-2" title={c.title}>{c.title}</h4>
        <p className="text-xs text-slate-400 mb-3 truncate">{c.client.name}</p>
        <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
            <span className="text-emerald-400 text-xs font-bold">R$ {c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            {c.phase && <span className="text-[10px] text-slate-500 truncate max-w-[50%] text-right">{c.phase}</span>}
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

  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showOnlyMyCases, setShowOnlyMyCases] = useState(false);
  
  // Sorting
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'value'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'Todos' | LegalCategory>('Todos');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Modal & Actions
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [caseToEdit, setCaseToEdit] = useState<LegalCase | null>(null);
  const [preSelectedClientId, setPreSelectedClientId] = useState<string | undefined>(undefined);
  
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
  
  // Quick Client
  const [isQuickClientModalOpen, setIsQuickClientModalOpen] = useState(false);
  const [quickClientData, setQuickClientData] = useState({ name: '', type: 'PF', doc: '', email: '', phone: '' });
  const [submittingClient, setSubmittingClient] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchCases = useCallback(async (currentPage: number, isNewFilter: boolean = false) => {
    setLoading(true);
    try {
      // Pass advanced filters to service
      const response = await storageService.getCasesPaginated(
          currentPage, 
          20, 
          debouncedSearch, 
          null, // status handled in board or unified list
          categoryFilter,
          (dateRange.start && dateRange.end) ? dateRange : null
      );
      let fetchedData = response.data;

      if (showOnlyMyCases && user?.name) {
        fetchedData = fetchedData.filter(c => c.responsibleLawyer.toLowerCase().includes(user.name.toLowerCase()));
      }

      // Client-side Sorting (Since mock service paginates but basic sort)
      fetchedData.sort((a, b) => {
          let valA, valB;
          if (sortBy === 'value') {
              valA = a.value; valB = b.value;
          } else if (sortBy === 'created') {
              // Assuming distributionDate is creation for sort purpose if createdAt not available
              valA = new Date(a.distributionDate || 0).getTime();
              valB = new Date(b.distributionDate || 0).getTime();
          } else {
              valA = new Date(a.lastUpdate || 0).getTime();
              valB = new Date(b.lastUpdate || 0).getTime();
          }
          
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
      });

      if (isNewFilter) {
        setCases(fetchedData);
      } else {
        setCases(prev => [...prev, ...fetchedData]);
      }

      setHasMore(fetchedData.length === 20);
    } catch (err) {
      console.error(err);
      addToast('Erro ao carregar processos.', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, showOnlyMyCases, categoryFilter, dateRange, user, addToast, sortBy, sortOrder]);

  useEffect(() => {
    setPage(1);
    fetchCases(1, true);
  }, [debouncedSearch, showOnlyMyCases, categoryFilter, dateRange, sortBy, sortOrder]);

  useEffect(() => {
    if (page > 1) {
      fetchCases(page, false);
    }
  }, [page]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastCaseElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const handleOpenNewCase = () => {
      setCaseToEdit(null);
      setPreSelectedClientId(undefined);
      setIsCaseModalOpen(true);
  };

  const handleEditCase = (id: string) => {
      const c = cases.find(item => item.id === id);
      if (c) {
          setCaseToEdit(c);
          setPreSelectedClientId(undefined);
          setIsCaseModalOpen(true);
          setOpenActionMenuId(null);
      }
  };

  const handleCaseSaved = async () => {
      setPage(1);
      await fetchCases(1, true);
  };

  const handleExportCSV = () => {
    if (cases.length === 0) {
        addToast('Não há processos para exportar.', 'warning');
        return;
    }
    const headers = ['CNJ', 'Título', 'Cliente', 'Fase', 'Status', 'Valor', 'Advogado', 'Próx. Audiência'];
    const csvRows = [
        headers.join(';'),
        ...cases.map(c => {
            return [
                c.cnj,
                `"${c.title}"`,
                `"${c.client.name}"`,
                c.phase || '',
                c.status,
                c.value.toFixed(2).replace('.', ','),
                c.responsibleLawyer,
                c.nextHearing || ''
            ].join(';');
        })
    ];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "processos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Lista de processos exportada.', 'success');
  };

  const confirmDelete = async () => {
    if (caseToDelete) {
      await storageService.deleteCase(caseToDelete);
      setCases(prev => prev.filter(c => c.id !== caseToDelete));
      addToast('Processo excluído.', 'success');
      setCaseToDelete(null);
    }
  };

  const handleQuickClientSave = async () => {
     if(!quickClientData.name) { addToast('Nome obrigatório', 'error'); return; }
     setSubmittingClient(true);
     try {
        const newClient: Client = {
          id: `cli-${Date.now()}`,
          name: quickClientData.name, type: quickClientData.type as any, email: quickClientData.email, phone: quickClientData.phone, status: 'Ativo',
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(quickClientData.name)}&background=random`,
          address: '', city: '', state: '', documents: [], history: [], alerts: [], createdAt: new Date().toLocaleDateString('pt-BR'),
          cpf: quickClientData.type === 'PF' ? quickClientData.doc : undefined, cnpj: quickClientData.type === 'PJ' ? quickClientData.doc : undefined,
        };
        await storageService.saveClient(newClient);
        setIsQuickClientModalOpen(false);
        setQuickClientData({ name: '', type: 'PF', doc: '', email: '', phone: '' });
        addToast('Cliente criado!', 'success');
     } catch(e) {
        addToast('Erro ao criar cliente.', 'error');
     } finally {
        setSubmittingClient(false);
     }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'new') {
      setCaseToEdit(null);
      const cid = params.get('clientId');
      if (cid) setPreSelectedClientId(cid);
      setIsCaseModalOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const clearFilters = () => {
      setCategoryFilter('Todos');
      setDateRange({ start: '', end: '' });
      setSearchTerm('');
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6">
        <div><h1 className="text-3xl font-bold text-white">Processos Jurídicos</h1><p className="text-slate-400 mt-1">Gerencie seus casos, prazos e andamentos.</p></div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={handleExportCSV} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-sm font-medium border border-white/10">
             <Download size={18} /> Exportar
          </button>
          <button onClick={handleOpenNewCase} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-lg shadow-indigo-500/20 hover:scale-105">
            <Plus size={18} /><span className="whitespace-nowrap">Novo Processo</span>
          </button>
        </div>
      </div>

      <GlassCard className="p-4 space-y-4">
         <div className="flex flex-col xl:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="text" placeholder="Buscar por número, cliente ou título..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600" />
              {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={16} /></button>}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
               <div className="flex gap-2">
                   {/* Sort Dropdown */}
                   <div className="relative">
                       <select 
                           value={sortBy} 
                           onChange={(e) => setSortBy(e.target.value as any)}
                           className="h-full bg-white/5 border border-white/10 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-300 focus:border-indigo-500 outline-none appearance-none cursor-pointer hover:bg-white/10 transition-colors"
                       >
                           <option value="updated" className="bg-slate-800">Recentes</option>
                           <option value="created" className="bg-slate-800">Criação</option>
                           <option value="value" className="bg-slate-800">Valor</option>
                       </select>
                       <button 
                           onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                           className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                       >
                           {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                       </button>
                   </div>

                   <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2.5 rounded-lg border transition-colors flex items-center gap-2 whitespace-nowrap ${showFilters ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                       <Filter size={18} /> <span className="hidden sm:inline">Filtros</span>
                   </button>
               </div>
               
               <div className="flex gap-2">
                   <button onClick={() => setShowOnlyMyCases(!showOnlyMyCases)} className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg border transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${showOnlyMyCases ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}><UserCheck size={18} /><span className="hidden sm:inline">Meus</span></button>
                   <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 shrink-0">
                     <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><ListIcon size={20} /></button>
                     <button onClick={() => setViewMode('board')} className={`p-1.5 rounded-md transition-all ${viewMode === 'board' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><LayoutGrid size={20} /></button>
                   </div>
               </div>
            </div>
         </div>

         {/* Advanced Filters Dropdown */}
         <AnimatePresence>
             {showFilters && (
                 <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-white/5 pt-4 overflow-hidden"
                 >
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                         <div className="space-y-1">
                             <label className="text-xs text-slate-400 font-medium ml-1">Categoria</label>
                             <div className="relative">
                                 <select 
                                    value={categoryFilter} 
                                    onChange={(e) => setCategoryFilter(e.target.value as any)}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-200 appearance-none focus:border-indigo-500 outline-none"
                                 >
                                     <option value="Todos">Todas as Categorias</option>
                                     {LEGAL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                 </select>
                                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
                             </div>
                         </div>
                         <div className="space-y-1">
                             <label className="text-xs text-slate-400 font-medium ml-1">Atualizado entre</label>
                             <div className="flex gap-2">
                                 <input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="flex-1 bg-slate-900/50 border border-white/10 rounded-lg py-2 px-3 text-sm text-slate-200 outline-none scheme-dark" />
                                 <input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="flex-1 bg-slate-900/50 border border-white/10 rounded-lg py-2 px-3 text-sm text-slate-200 outline-none scheme-dark" />
                             </div>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={() => fetchCases(1, true)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium transition-colors">Aplicar Filtros</button>
                             <button onClick={clearFilters} className="px-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white py-2 rounded-lg text-sm transition-colors" title="Limpar Filtros"><X size={16} /></button>
                         </div>
                     </div>
                 </motion.div>
             )}
         </AnimatePresence>
      </GlassCard>

      {viewMode === 'list' ? (
          <div className="space-y-4 min-h-[400px]">
            {cases.map((c, index) => {
               if (cases.length === index + 1) {
                 return <div ref={lastCaseElementRef} key={c.id}><CaseListItem c={c} onDelete={(id: string) => { setCaseToDelete(id); setOpenActionMenuId(null); }} onEdit={handleEditCase} onNavigate={(id: string) => navigate(`/cases/${id}`)} openActionId={openActionMenuId} setOpenActionId={setOpenActionMenuId} /></div>;
               }
               return <CaseListItem key={c.id} c={c} onDelete={(id: string) => { setCaseToDelete(id); setOpenActionMenuId(null); }} onEdit={handleEditCase} onNavigate={(id: string) => navigate(`/cases/${id}`)} openActionId={openActionMenuId} setOpenActionId={setOpenActionMenuId} />;
            })}
            {loading && (<div className="flex justify-center py-4"><Loader2 className="animate-spin text-indigo-500" /></div>)}
            {!loading && cases.length === 0 && (<div className="flex flex-col items-center justify-center py-20 text-slate-500"><Briefcase size={32} className="opacity-50 mb-4" /><p className="text-lg font-medium text-slate-300">Nenhum processo encontrado</p></div>)}
          </div>
      ) : (
          <div className="overflow-x-auto pb-4 min-h-[400px]">
              <div className="flex gap-6 min-w-[1000px] h-full">
                  {[CaseStatus.ACTIVE, CaseStatus.PENDING, CaseStatus.WON, CaseStatus.ARCHIVED].map(status => (
                      <div key={status} className="flex-1 min-w-[300px] flex flex-col h-full">
                          <div className={`flex items-center justify-between mb-4 px-3 py-2 rounded-lg border bg-white/5 border-white/10`}>
                              <h3 className="font-bold">{status}</h3>
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-black/20">{cases.filter(c => c.status === status).length}{hasMore && "+"}</span>
                          </div>
                          <div className="space-y-3 overflow-y-auto max-h-[600px] custom-scrollbar pr-2">
                              {cases.filter(c => c.status === status).map(c => <CaseBoardCard key={c.id} c={c} onDelete={(id: string) => { setCaseToDelete(id); setOpenActionMenuId(null); }} onEdit={handleEditCase} onNavigate={(id: string) => navigate(`/cases/${id}`)} />)}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Main Case Modal (Create/Edit) */}
      <CaseFormModal 
        isOpen={isCaseModalOpen}
        onClose={() => setIsCaseModalOpen(false)}
        onSave={handleCaseSaved}
        initialData={caseToEdit}
        preSelectedClientId={preSelectedClientId}
      />

      {/* Quick Client Modal */}
      <Modal isOpen={isQuickClientModalOpen} onClose={() => setIsQuickClientModalOpen(false)} title="Cadastro Rápido de Cliente" footer={<><button disabled={submittingClient} onClick={() => setIsQuickClientModalOpen(false)} className="px-3 py-1.5 text-slate-400 hover:text-white">Cancelar</button><button disabled={submittingClient} onClick={handleQuickClientSave} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2">{submittingClient ? <Loader2 size={12} className="animate-spin"/> : 'Salvar'}</button></>}>
         <div className="space-y-3"><input type="text" placeholder="Nome Completo *" value={quickClientData.name} onChange={e => setQuickClientData({...quickClientData, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-emerald-500" /><div className="flex gap-2"><button type="button" onClick={() => setQuickClientData({...quickClientData, type: 'PF', doc: ''})} className={`flex-1 py-1 text-xs rounded border transition-colors ${quickClientData.type === 'PF' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>Pessoa Física</button><button type="button" onClick={() => setQuickClientData({...quickClientData, type: 'PJ', doc: ''})} className={`flex-1 py-1 text-xs rounded border transition-colors ${quickClientData.type === 'PJ' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>Pessoa Jurídica</button></div><input type="text" placeholder={quickClientData.type === 'PF' ? 'CPF' : 'CNPJ'} value={quickClientData.doc} onChange={e => { const masked = quickClientData.type === 'PF' ? masks.cpf(e.target.value) : masks.cnpj(e.target.value); setQuickClientData({...quickClientData, doc: masked}); }} maxLength={quickClientData.type === 'PF' ? 14 : 18} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-emerald-500" /></div>
      </Modal>

      <Modal isOpen={!!caseToDelete} onClose={() => setCaseToDelete(null)} title="Confirmar Exclusão" footer={<div className="flex gap-3 justify-end"><button onClick={() => setCaseToDelete(null)} className="px-4 py-2 text-slate-300 hover:text-white">Cancelar</button><button onClick={confirmDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg">Excluir</button></div>}>
         <p className="text-center text-slate-300">Ação irreversível. O processo e todo seu histórico serão apagados permanentemente. Deseja continuar?</p>
      </Modal>
    </div>
  );
};
