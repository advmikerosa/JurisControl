


import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { User, Search, CheckSquare, AlertCircle, Briefcase, ChevronRight, Info, Scale, Users, HelpCircle, ChevronLeft, Save, Loader2, CloudDownload, Check } from 'lucide-react';
import { Client, LegalCase, LegalCategory, CasePhase, CaseStatus } from '../types';
import { storageService } from '../services/storageService';
import { dataJudService } from '../services/dataJudService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface CaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialData?: LegalCase | null;
  preSelectedClientId?: string;
}

const LEGAL_CATEGORIES: LegalCategory[] = [
  'Administrativo', 'Cível', 'Comercial/Empresarial', 'Consumidor', 
  'Família', 'Trabalhista', 'Imobiliário', 'Tributário', 
  'Penal', 'Previdenciário', 'Outro'
];

const CASE_PHASES: CasePhase[] = [
  'Distributivo', 'Conhecimento', 'Instrução', 'Julgamento', 'Recurso', 'Execução', 'Encerrado'
];

const MOCK_JUDGES: Record<string, string[]> = {
  'trabalho': ['Dr. José Almeida', 'Dra. Cláudia Santos', 'Dr. Marcos Lima'],
  'cível': ['Dr. Alexandre Morais', 'Dra. Cármen Lúcia', 'Dr. Gilmar Mendes'],
  'família': ['Dra. Nancy Andrighi', 'Dr. Roberto Barroso'],
  'federal': ['Dr. Sérgio Moro', 'Dra. Gabriela Hardt'],
  'default': ['Dr. João da Silva', 'Dra. Maria Oliveira', 'Dr. Pedro Santos']
};

export const CaseFormModal: React.FC<CaseFormModalProps> = ({ isOpen, onClose, onSave, initialData, preSelectedClientId }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'info' | 'details' | 'parties'>('info');
  const [submitting, setSubmitting] = useState(false);
  const [importingDataJud, setImportingDataJud] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // Data Sources
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [officeLawyers, setOfficeLawyers] = useState<{id: string, name: string}[]>([]);
  const [judgeSuggestions, setJudgeSuggestions] = useState<string[]>([]);
  
  // UI Helpers
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    title: '',
    category: 'Cível' as LegalCategory,
    responsible: '',
    cnj: '',
    court: '',
    judge: '',
    phase: 'Distributivo' as CasePhase,
    status: 'Ativo' as CaseStatus,
    distributionDate: new Date().toISOString().split('T')[0],
    nextHearing: '',
    opposingParty: '',
    value: '',
    description: '',
    autoGenerateTasks: true,
    importedMovements: [] as any[]
  });

  useEffect(() => {
    const loadData = async () => {
      const clients = await storageService.getClients();
      setAvailableClients(clients);
      setFilteredClients(clients);
      
      if (user) {
        const members = await storageService.getOfficeMembers(user.currentOfficeId);
        setOfficeLawyers(members);
      }
    };
    if (isOpen) loadData();
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          clientId: initialData.client.id,
          title: initialData.title,
          category: initialData.category || 'Cível',
          responsible: initialData.responsibleLawyer,
          cnj: initialData.cnj,
          court: initialData.court || '',
          judge: initialData.judge || '',
          phase: initialData.phase || 'Distributivo',
          status: initialData.status,
          distributionDate: initialData.distributionDate ? convertDateToISO(initialData.distributionDate) : '',
          nextHearing: initialData.nextHearing ? convertDateToISO(initialData.nextHearing) : '',
          opposingParty: initialData.opposingParty || '',
          value: initialData.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          description: initialData.description || '',
          autoGenerateTasks: false,
          importedMovements: []
        });
        setClientSearch(initialData.client.name);
      } else {
        resetForm();
        if (preSelectedClientId) {
           setFormData(prev => ({ ...prev, clientId: preSelectedClientId }));
           storageService.getClients().then(clients => {
             const c = clients.find(cl => cl.id === preSelectedClientId);
             if (c) setClientSearch(c.name);
           });
        } else {
           setFormData(prev => ({ ...prev, responsible: user?.name || '' }));
        }
      }
      setActiveTab('info');
      setErrors({});
    }
  }, [isOpen, initialData, preSelectedClientId, user]);

  useEffect(() => {
    if (!clientSearch) {
        setFilteredClients(availableClients);
    } else {
        const lower = clientSearch.toLowerCase();
        setFilteredClients(availableClients.filter(c => 
            c.name.toLowerCase().includes(lower) || 
            (c.cpf && c.cpf.includes(lower)) || 
            (c.cnpj && c.cnpj.includes(lower))
        ));
    }
  }, [clientSearch, availableClients]);

  useEffect(() => {
    const courtLower = formData.court.toLowerCase();
    let suggestions: string[] = [];
    
    if (courtLower.includes('trabalho')) suggestions = MOCK_JUDGES['trabalho'];
    else if (courtLower.includes('cível') || courtLower.includes('civil')) suggestions = MOCK_JUDGES['cível'];
    else if (courtLower.includes('família')) suggestions = MOCK_JUDGES['família'];
    else if (courtLower.includes('federal')) suggestions = MOCK_JUDGES['federal'];
    else if (courtLower) suggestions = MOCK_JUDGES['default'];
    
    setJudgeSuggestions(suggestions);
  }, [formData.court]);

  const convertDateToISO = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return `${y}-${m}-${d}`;
    }
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    return dateStr;
  };

  const resetForm = () => {
    setFormData({ 
        clientId: '', title: '', category: 'Cível', responsible: user?.name || '', 
        cnj: '', court: '', judge: '', phase: 'Distributivo', status: 'Ativo',
        distributionDate: new Date().toISOString().split('T')[0], nextHearing: '',
        opposingParty: '', value: '', description: '', autoGenerateTasks: true, importedMovements: []
    });
    setClientSearch('');
  };

  const isValidCNJ = (cnj: string) => {
      if (!cnj) return true; 
      const clean = cnj.replace(/\D/g, '');
      return clean.length === 20;
  };

  const validateForm = () => {
      const newErrors: { [key: string]: string } = {};
      
      if (activeTab === 'info') {
          if (!formData.clientId) newErrors.client = 'Selecione um cliente.';
          if (!formData.title.trim()) newErrors.title = 'Título é obrigatório.';
          if (!formData.responsible.trim()) newErrors.responsible = 'Responsável é obrigatório.';
      }
      
      if (activeTab === 'details') {
          if (formData.cnj && formData.cnj.length > 0 && !isValidCNJ(formData.cnj)) {
              newErrors.cnj = 'Formato inválido (20 dígitos)';
          }
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const handleCNJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/[^\d-.]/g, '');
    setFormData({ ...formData, cnj: v.substring(0, 25) });
    
    if (v.length > 0) {
        if (v.replace(/\D/g, '').length >= 15 && !isValidCNJ(v)) {
            setErrors(prev => ({...prev, cnj: 'Formato inválido.'}));
        } else {
            setErrors(prev => { const {cnj, ...rest} = prev; return rest; });
        }
    } else {
        setErrors(prev => { const {cnj, ...rest} = prev; return rest; });
    }
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, value: e.target.value.replace(/[^\d,.]/g, '') });
  };

  const handleImportDataJud = async () => {
    if (!formData.cnj || !isValidCNJ(formData.cnj)) {
      addToast('Digite um CNJ válido (20 dígitos) para importar.', 'warning');
      return;
    }

    setImportingDataJud(true);
    try {
      const data = await dataJudService.fetchProcessByCNJ(formData.cnj);
      if (data) {
        setFormData(prev => ({
          ...prev,
          title: data.title || prev.title,
          category: data.category || prev.category,
          court: data.court || prev.court,
          distributionDate: data.distributionDate ? convertDateToISO(data.distributionDate) : prev.distributionDate,
          importedMovements: data.movements || []
        }));
        addToast('Dados importados do DataJud com sucesso!', 'success');
      } else {
        addToast('Processo não encontrado na base pública do DataJud. Verifique se o tribunal é suportado.', 'info');
      }
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setImportingDataJud(false);
    }
  };

  const handleSubmit = async () => {
    const finalErrors: any = {};
    if (!formData.clientId) finalErrors.client = 'Obrigatório';
    if (!formData.title) finalErrors.title = 'Obrigatório';
    
    if (Object.keys(finalErrors).length > 0) {
        setErrors(finalErrors);
        setActiveTab('info');
        addToast('Verifique os campos obrigatórios.', 'error');
        return;
    }

    setSubmitting(true);

    try {
        const client = availableClients.find(c => c.id === formData.clientId);
        if (!client) throw new Error('Cliente inválido');

        const casePayload: LegalCase = {
          id: initialData ? initialData.id : `case-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          cnj: formData.cnj || 'N/A',
          title: formData.title,
          client: client,
          status: formData.status,
          category: formData.category,
          phase: formData.phase,
          distributionDate: formData.distributionDate ? new Date(formData.distributionDate).toLocaleDateString('pt-BR') : undefined,
          value: parseFloat(formData.value.replace(/\./g, '').replace(',', '.')) || 0,
          responsibleLawyer: formData.responsible,
          court: formData.court,
          judge: formData.judge,
          opposingParty: formData.opposingParty,
          description: formData.description,
          nextHearing: formData.nextHearing ? new Date(formData.nextHearing).toLocaleDateString('pt-BR') : undefined,
          movements: initialData 
            ? [...(formData.importedMovements || []), ...initialData.movements || []] 
            : formData.importedMovements || []
        };

        await storageService.saveCase(casePayload);
        
        if (!initialData && formData.autoGenerateTasks) {
            const baseTask = {
                priority: 'Média' as any,
                status: 'A Fazer' as any,
                assignedTo: formData.responsible,
                caseId: casePayload.id,
                clientName: client.name,
                userId: user?.id
            };
            const tasks = [
                { ...baseTask, id: `t-gen-${Date.now()}-1`, title: 'Análise inicial do caso', dueDate: new Date(Date.now() + 86400000 * 2).toLocaleDateString('pt-BR') },
                { ...baseTask, id: `t-gen-${Date.now()}-2`, title: 'Coletar documentos', dueDate: new Date(Date.now() + 86400000 * 5).toLocaleDateString('pt-BR') }
            ];
            for (const t of tasks) await storageService.saveTask(t);
            addToast(`${tasks.length} tarefas geradas.`, 'info');
        }
        
        addToast(initialData ? 'Processo atualizado!' : 'Processo criado com sucesso!', 'success');
        onSave();
        onClose();
    } catch (error) {
        console.error(error);
        addToast('Erro ao salvar processo.', 'error');
    } finally {
        setSubmitting(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={initialData ? "Editar Processo" : "Novo Processo Jurídico"} 
      maxWidth="max-w-3xl" 
      footer={
          <div className="flex justify-between w-full">
             <button disabled={submitting} onClick={onClose} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-white/5 disabled:opacity-50 transition-colors">Cancelar</button>
             <div className="flex gap-2">
                 {activeTab !== 'info' && (
                     <button type="button" onClick={() => setActiveTab(prev => prev === 'parties' ? 'details' : 'info')} className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 flex items-center gap-1 transition-colors"><ChevronLeft size={16} /> Voltar</button>
                 )}
                 {activeTab !== 'parties' ? (
                     <button type="button" onClick={() => { if(validateForm()) setActiveTab(prev => prev === 'info' ? 'details' : 'parties'); }} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1 transition-colors shadow-lg shadow-indigo-500/20">Próximo <ChevronRight size={16} /></button>
                 ) : (
                     <button disabled={submitting} onClick={handleSubmit} className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-70">
                         {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                         {submitting ? 'Salvando...' : 'Salvar Processo'}
                     </button>
                 )}
             </div>
          </div>
      }
    >
        <div className="flex gap-6 mb-6 border-b border-white/10 pb-4">
            <button onClick={() => setActiveTab('info')} className={`text-sm font-medium flex items-center gap-2 pb-2 border-b-2 transition-all ${activeTab === 'info' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}>
                <Info size={16} /> Informações Básicas
            </button>
            <button onClick={() => { if(validateForm()) setActiveTab('details'); }} className={`text-sm font-medium flex items-center gap-2 pb-2 border-b-2 transition-all ${activeTab === 'details' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}>
                <Scale size={16} /> Detalhes Processuais
            </button>
            <button onClick={() => { if(validateForm()) setActiveTab('parties'); }} className={`text-sm font-medium flex items-center gap-2 pb-2 border-b-2 transition-all ${activeTab === 'parties' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}>
                <Users size={16} /> Partes e Valores
            </button>
        </div>

        <div className="min-h-[350px]">
            {/* --- INFO TAB --- */}
            {activeTab === 'info' && (
                <div className="space-y-5 animate-fade-in">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Cliente Vinculado <span className="text-rose-400">*</span></label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input 
                                type="text" 
                                placeholder="Buscar cliente..." 
                                value={clientSearch}
                                onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); setFormData(p => ({...p, clientId: ''})); }}
                                onFocus={() => setIsClientDropdownOpen(true)}
                                className={`w-full bg-black/20 border rounded-lg py-3 pl-10 pr-4 text-white focus:border-indigo-500 focus:outline-none ${errors.client ? 'border-rose-500' : 'border-white/10'}`}
                            />
                            {formData.clientId && <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />}
                            
                            {isClientDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                                    {filteredClients.map(c => (
                                        <div 
                                            key={c.id} 
                                            onClick={() => { setFormData({...formData, clientId: c.id}); setClientSearch(c.name); setIsClientDropdownOpen(false); }}
                                            className="px-4 py-2 hover:bg-white/10 cursor-pointer text-sm text-slate-200 border-b border-white/5 last:border-0"
                                        >
                                            {c.name} <span className="text-xs text-slate-500 ml-2">({c.type})</span>
                                        </div>
                                    ))}
                                    {filteredClients.length === 0 && <div className="p-3 text-slate-500 text-xs text-center">Nenhum cliente encontrado.</div>}
                                </div>
                            )}
                        </div>
                        {errors.client && <span className="text-xs text-rose-400 ml-1">{errors.client}</span>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Título do Processo <span className="text-rose-400">*</span></label>
                        <input 
                            type="text" 
                            value={formData.title} 
                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                            className={`w-full bg-black/20 border rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none ${errors.title ? 'border-rose-500' : 'border-white/10'}`}
                            placeholder="Ex: Ação de Indenização"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Categoria</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <select 
                                    value={formData.category} 
                                    onChange={(e) => setFormData({...formData, category: e.target.value as LegalCategory})}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:border-indigo-500 focus:outline-none appearance-none cursor-pointer"
                                >
                                    {LEGAL_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-slate-800">{cat}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Advogado Responsável <span className="text-rose-400">*</span></label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <input 
                                    type="text" 
                                    list="lawyers" 
                                    value={formData.responsible} 
                                    onChange={(e) => setFormData({...formData, responsible: e.target.value})}
                                    className={`w-full bg-black/20 border rounded-lg py-3 pl-10 pr-4 text-white focus:border-indigo-500 focus:outline-none ${errors.responsible ? 'border-rose-500' : 'border-white/10'}`}
                                />
                                <datalist id="lawyers">
                                    {officeLawyers.map(l => <option key={l.id} value={l.name} />)}
                                </datalist>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DETAILS TAB --- */}
            {activeTab === 'details' && (
                <div className="space-y-5 animate-fade-in">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Número CNJ</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={formData.cnj} 
                                onChange={handleCNJChange}
                                className={`flex-1 bg-black/20 border rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono ${errors.cnj ? 'border-rose-500' : 'border-white/10'}`}
                                placeholder="0000000-00.0000.0.00.0000"
                            />
                            <button 
                                onClick={handleImportDataJud}
                                disabled={importingDataJud}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                                title="Buscar na base do CNJ"
                            >
                                {importingDataJud ? <Loader2 size={18} className="animate-spin" /> : <CloudDownload size={18} />}
                                <span className="hidden sm:inline">Importar</span>
                            </button>
                        </div>
                        {errors.cnj && <span className="text-xs text-rose-400 ml-1">{errors.cnj}</span>}
                        <p className="text-[10px] text-slate-500 ml-1 flex items-center gap-1"><Info size={10}/> Digite o CNJ para importar dados automaticamente.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Tribunal / Vara</label>
                            <input 
                                type="text" 
                                value={formData.court} 
                                onChange={(e) => setFormData({...formData, court: e.target.value})}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
                                placeholder="Ex: 2ª Vara Cível de SP"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Juiz</label>
                            <input 
                                type="text" 
                                list="judges"
                                value={formData.judge} 
                                onChange={(e) => setFormData({...formData, judge: e.target.value})}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
                            />
                            <datalist id="judges">
                                {judgeSuggestions.map((j, i) => <option key={i} value={j} />)}
                            </datalist>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Fase Processual</label>
                            <select 
                                value={formData.phase} 
                                onChange={(e) => setFormData({...formData, phase: e.target.value as CasePhase})}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none appearance-none cursor-pointer"
                            >
                                {CASE_PHASES.map(p => <option key={p} value={p} className="bg-slate-800">{p}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Status</label>
                            <select 
                                value={formData.status} 
                                onChange={(e) => setFormData({...formData, status: e.target.value as CaseStatus})}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none appearance-none cursor-pointer"
                            >
                                <option value="Ativo" className="bg-slate-800">Ativo</option>
                                <option value="Pendente" className="bg-slate-800">Pendente</option>
                                <option value="Arquivado" className="bg-slate-800">Arquivado</option>
                                <option value="Ganho" className="bg-slate-800">Ganho</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Data Distribuição</label>
                            <input 
                                type="date" 
                                value={formData.distributionDate} 
                                onChange={(e) => setFormData({...formData, distributionDate: e.target.value})}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none scheme-dark"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Próxima Audiência</label>
                            <input 
                                type="date" 
                                value={formData.nextHearing} 
                                onChange={(e) => setFormData({...formData, nextHearing: e.target.value})}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none scheme-dark"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* --- PARTIES TAB --- */}
            {activeTab === 'parties' && (
                <div className="space-y-5 animate-fade-in">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Parte Contrária</label>
                        <input 
                            type="text" 
                            value={formData.opposingParty} 
                            onChange={(e) => setFormData({...formData, opposingParty: e.target.value})}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
                            placeholder="Nome da parte adversa"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Valor da Causa (R$)</label>
                        <input 
                            type="text" 
                            value={formData.value} 
                            onChange={handleValueChange}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono text-lg"
                            placeholder="0,00"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Descrição / Observações Iniciais</label>
                        <textarea 
                            rows={4}
                            value={formData.description} 
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none resize-none"
                            placeholder="Detalhes importantes sobre o caso..."
                        />
                    </div>

                    {!initialData && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl flex items-center gap-3">
                            <div 
                                onClick={() => setFormData(p => ({...p, autoGenerateTasks: !p.autoGenerateTasks}))}
                                className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${formData.autoGenerateTasks ? 'bg-indigo-600 border-indigo-600' : 'border-slate-500'}`}
                            >
                                {formData.autoGenerateTasks && <Check size={14} className="text-white" />}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Gerar Tarefas Automáticas</p>
                                <p className="text-xs text-slate-400">Cria tarefas iniciais padrão (Ex: Coletar Documentos, Análise Inicial) ao salvar.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    </Modal>
  );
};
