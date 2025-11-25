


import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { User, Search, CheckSquare, AlertCircle, Briefcase, ChevronRight, Info, Scale, Users, HelpCircle, ChevronLeft, Save, Loader2, Shield } from 'lucide-react';
import { Client, LegalCase, LegalCategory, CasePhase, CaseStatus } from '../types';
import { storageService } from '../services/storageService';
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
    autoGenerateTasks: true
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

  // Initialization Effect
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Edit Mode
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
          autoGenerateTasks: false // Don't auto-gen on edit
        });
        setClientSearch(initialData.client.name);
      } else {
        // Create Mode
        resetForm();
        if (preSelectedClientId) {
           setFormData(prev => ({ ...prev, clientId: preSelectedClientId }));
           // We need to find the client name to set clientSearch
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

  // Client Search Filtering
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

  // Judge Suggestion Logic
  useEffect(() => {
    const courtLower = formData.court.toLowerCase();
    let suggestions: string[] = [];
    
    if (courtLower.includes('trabalho')) suggestions = MOCK_JUDGES['trabalho'];
    else if (courtLower.includes('cível') || courtLower.includes('civil')) suggestions = MOCK_JUDGES['cível'];
    else if (courtLower.includes('família')) suggestions = MOCK_JUDGES['família'];
    else if (courtLower.includes('federal')) suggestions = MOCK_JUDGES['federal'];
    else if (courtLower) suggestions = MOCK_JUDGES['default']; // Show default if something is typed but no category match
    
    setJudgeSuggestions(suggestions);
  }, [formData.court]);

  const convertDateToISO = (dateStr: string) => {
    if (!dateStr) return '';
    // PT-BR dd/mm/yyyy to yyyy-mm-dd
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return `${y}-${m}-${d}`;
    }
    return dateStr;
  };

  const resetForm = () => {
    setFormData({ 
        clientId: '', title: '', category: 'Cível', responsible: user?.name || '', 
        cnj: '', court: '', judge: '', phase: 'Distributivo', status: 'Ativo',
        distributionDate: new Date().toISOString().split('T')[0], nextHearing: '',
        opposingParty: '', value: '', description: '', autoGenerateTasks: true 
    });
    setClientSearch('');
  };

  // Helper: Validate CNJ Format (NNNNNNN-DD.AAAA.J.TR.OR)
  const isValidCNJ = (cnj: string) => {
      if (!cnj) return true; 
      // Regex for Structure: 7 digits - 2 digits . 4 digits . 1 digit . 2 digits . 4 digits
      const regex = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
      return regex.test(cnj);
  };

  const validateForm = () => {
      const newErrors: { [key: string]: string } = {};
      
      // Info Tab Validation
      if (activeTab === 'info') {
          if (!formData.clientId) newErrors.client = 'Selecione um cliente.';
          if (!formData.title.trim()) newErrors.title = 'Título é obrigatório.';
          if (!formData.responsible.trim()) newErrors.responsible = 'Responsável é obrigatório.';
      }
      
      // Details Tab Validation
      if (activeTab === 'details') {
          if (formData.cnj && formData.cnj.length > 0 && !isValidCNJ(formData.cnj)) {
              newErrors.cnj = 'Formato inválido (NNNNNNN-DD.AAAA.J.TR.OR)';
          }
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const handleCNJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/[^\d-.]/g, ''); // Allow digits, dash and dots only while typing
    setFormData({ ...formData, cnj: v.substring(0, 25) });
    
    // Real-time validation check
    if (v.length > 0) {
        if (v.length >= 15 && !isValidCNJ(v)) {
            setErrors(prev => ({...prev, cnj: 'Formato inválido. Ex: 0001234-55.2023.8.26.0100'}));
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

  const handleSubmit = async () => {
    // Final global validation before submit
    const finalErrors: any = {};
    if (!formData.clientId) finalErrors.client = 'Obrigatório';
    if (!formData.title) finalErrors.title = 'Obrigatório';
    if (formData.cnj && !isValidCNJ(formData.cnj)) finalErrors.cnj = 'Formato CNJ Inválido';
    
    if (Object.keys(finalErrors).length > 0) {
        setErrors(finalErrors);
        // Navigate to the tab with the error
        if (finalErrors.client || finalErrors.title) setActiveTab('info');
        else if (finalErrors.cnj) setActiveTab('details');
        
        addToast('Verifique os campos com erro.', 'error');
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
          // Preserve existing movements if editing
          movements: initialData ? initialData.movements : []
        };

        await storageService.saveCase(casePayload);
        
        // Auto-tasks logic only for new cases
        if (!initialData && formData.autoGenerateTasks) {
            // Simple mock tasks generation
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
             <button disabled={submitting} onClick={onClose} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-white/5 disabled:opacity-50">Cancelar</button>
             <div className="flex gap-2">
                 {activeTab !== 'info' && (
                     <button type="button" onClick={() => setActiveTab(prev => prev === 'parties' ? 'details' : 'info')} className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 flex items-center gap-1"><ChevronLeft size={16} /> Voltar</button>
                 )}
                 {activeTab !== 'parties' ? (
                     <button type="button" onClick={() => { if(validateForm()) setActiveTab(prev => prev === 'info' ? 'details' : 'parties'); }} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1">Próximo <ChevronRight size={16} /></button>
                 ) : (
                     <button disabled={submitting} onClick={handleSubmit} className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20">
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {submitting ? 'Salvando...' : (initialData ? 'Salvar Alterações' : 'Criar Processo')}
                     </button>
                 )}
             </div>
          </div>
        }
    >
        <div className="space-y-6">
            <div className="flex border-b border-white/10 mb-6">
                <button onClick={() => setActiveTab('info')} className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors text-sm font-medium ${activeTab === 'info' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}><Info size={16} /> Informações</button>
                <button onClick={() => { if(validateForm()) setActiveTab('details'); }} className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors text-sm font-medium ${activeTab === 'details' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}><Scale size={16} /> Detalhes</button>
                <button onClick={() => { if(validateForm()) setActiveTab('parties'); }} className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors text-sm font-medium ${activeTab === 'parties' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}><Users size={16} /> Partes & Valores</button>
            </div>

            {activeTab === 'info' && (
                <div className="space-y-5 animate-fade-in">
                    <div className="bg-slate-900/50 p-5 rounded-xl border border-white/10 space-y-4 relative">
                        <div className="relative z-20">
                             <div className="flex justify-between items-center mb-1.5">
                                 <label className="text-sm font-semibold text-white flex items-center gap-2"><User size={16} className="text-indigo-400" /> Cliente <span className="text-rose-400">*</span></label>
                             </div>
                             <div className="relative">
                                 <input 
                                    type="text" 
                                    value={clientSearch} 
                                    onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); if(!e.target.value) setFormData(prev => ({...prev, clientId: ''})); }} 
                                    onFocus={() => setIsClientDropdownOpen(true)} 
                                    placeholder="Digite para buscar cliente..." 
                                    className={`w-full bg-slate-800 border rounded-lg py-2.5 pl-9 pr-4 text-slate-200 outline-none focus:border-indigo-500 transition-colors ${errors.client ? 'border-rose-500/50' : 'border-white/10'}`} 
                                 />
                                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                 {isClientDropdownOpen && (
                                     <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50">
                                        {filteredClients.length > 0 ? (
                                            filteredClients.map(client => (
                                                <div key={client.id} onClick={() => { setFormData(prev => ({ ...prev, clientId: client.id })); setClientSearch(client.name); setIsClientDropdownOpen(false); setErrors(prev => ({ ...prev, client: '' })); }} className="px-4 py-2 hover:bg-white/5 cursor-pointer flex items-center justify-between group border-b border-white/5 last:border-0">
                                                    <div><p className="text-sm text-slate-200 font-medium group-hover:text-indigo-300">{client.name}</p><p className="text-xs text-slate-500">{client.type} • {client.cpf || client.cnpj}</p></div>
                                                    {formData.clientId === client.id && <CheckSquare size={14} className="text-emerald-400" />}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 text-center text-slate-500 text-xs">Nenhum cliente encontrado.</div>
                                        )}
                                     </div>
                                 )}
                                 {isClientDropdownOpen && <div className="fixed inset-0 z-10" onClick={() => setIsClientDropdownOpen(false)}></div>}
                             </div>
                             {errors.client && <span className="text-[10px] text-rose-400 absolute -bottom-5 left-1 flex items-center gap-1"><AlertCircle size={10} /> {errors.client}</span>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="space-y-1.5">
                                 <label className="text-xs font-medium text-slate-400 ml-1">Categoria Jurídica <span className="text-rose-400">*</span></label>
                                 <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value as LegalCategory})} className="w-full bg-slate-800 border border-white/10 rounded-lg py-2.5 px-3 text-slate-200 outline-none focus:border-indigo-500">{LEGAL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
                             </div>
                             <div className="md:col-span-2 space-y-1.5 relative">
                                 <label className="text-xs font-medium text-slate-400 ml-1">Título da Ação <span className="text-rose-400">*</span></label>
                                 <input type="text" value={formData.title} onChange={(e) => { setFormData({...formData, title: e.target.value}); setErrors(prev => ({...prev, title: ''})); }} placeholder="Ex: Ação de Cobrança Indevida" className={`w-full bg-slate-800 border rounded-lg py-2.5 px-3 text-slate-200 outline-none focus:border-indigo-500 ${errors.title ? 'border-rose-500/50' : 'border-white/10'}`} />
                                 {errors.title && <span className="text-[10px] text-rose-400 absolute -bottom-5 left-1 flex items-center gap-1"><AlertCircle size={10} /> {errors.title}</span>}
                             </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5 relative">
                                <label className="text-xs font-medium text-slate-400 ml-1">Advogado Responsável <span className="text-rose-400">*</span></label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                    <select value={formData.responsible} onChange={(e) => setFormData({...formData, responsible: e.target.value})} className={`w-full bg-slate-800 border rounded-lg py-2.5 pl-10 pr-8 text-slate-200 outline-none focus:border-indigo-500 appearance-none ${errors.responsible ? 'border-rose-500/50' : 'border-white/10'}`}><option value="" disabled className="text-slate-500">Selecione...</option>{officeLawyers.map(lawyer => (<option key={lawyer.id} value={lawyer.name}>{lawyer.name}</option>))}</select>
                                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 rotate-90" size={14} />
                                </div>
                                {errors.responsible && <span className="text-[10px] text-rose-400 absolute -bottom-5 left-1 flex items-center gap-1"><AlertCircle size={10} /> {errors.responsible}</span>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-400 ml-1">Status Atual</label>
                                <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as CaseStatus})} className="w-full bg-slate-800 border border-white/10 rounded-lg py-2.5 px-3 text-slate-200 outline-none focus:border-indigo-500">
                                    <option value={CaseStatus.ACTIVE}>Ativo</option>
                                    <option value={CaseStatus.PENDING}>Pendente</option>
                                    <option value={CaseStatus.WON}>Ganho</option>
                                    <option value={CaseStatus.ARCHIVED}>Arquivado</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    {!initialData && (
                        <div className="bg-indigo-900/20 border border-indigo-500/20 p-3 rounded-lg flex items-start gap-3">
                            <input type="checkbox" id="autoTask" checked={formData.autoGenerateTasks} onChange={(e) => setFormData({...formData, autoGenerateTasks: e.target.checked})} className="mt-1 accent-indigo-500" />
                            <label htmlFor="autoTask" className="cursor-pointer"><span className="text-sm font-bold text-indigo-300 block">Gerar Tarefas Automáticas</span><span className="text-xs text-slate-400">Criar lista de tarefas padrão baseada na categoria <strong>{formData.category}</strong>.</span></label>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'details' && (
                <div className="space-y-5 animate-fade-in">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-1.5 relative">
                             <div className="flex justify-between">
                                 <label className="text-xs font-medium text-slate-400 ml-1">Número CNJ</label>
                                 <div className="group relative flex items-center gap-1 text-indigo-400 cursor-help">
                                     <span className="text-[10px]">Formato?</span>
                                     <HelpCircle size={12} />
                                     {/* Improved CNJ Tooltip */}
                                     <div className="absolute bottom-full right-0 mb-2 w-64 p-4 bg-slate-800 border border-white/10 text-xs text-slate-300 rounded-xl shadow-2xl hidden group-hover:block z-50">
                                         <p className="font-bold text-white mb-2 border-b border-white/10 pb-1">Estrutura CNJ (20 dígitos):</p>
                                         <div className="space-y-1.5 font-mono text-[10px]">
                                            <p><span className="text-indigo-400">NNNNNNN</span> - Número Sequencial</p>
                                            <p><span className="text-indigo-400">DD</span> - Dígitos Verificadores</p>
                                            <p><span className="text-indigo-400">AAAA</span> - Ano de Distribuição</p>
                                            <p><span className="text-indigo-400">J</span> - Órgão (Ex: 8 = Estadual)</p>
                                            <p><span className="text-indigo-400">TR</span> - Tribunal</p>
                                            <p><span className="text-indigo-400">OR</span> - Origem (Vara)</p>
                                         </div>
                                         <p className="mt-2 text-[10px] italic text-slate-500">Ex: 0001234-55.2023.8.26.0100</p>
                                     </div>
                                 </div>
                             </div>
                             <input 
                                type="text" 
                                value={formData.cnj} 
                                onChange={handleCNJChange} 
                                placeholder="0000000-00.0000.0.00.0000" 
                                className={`w-full bg-white/5 border rounded-lg py-2.5 px-3 text-slate-200 outline-none font-mono focus:border-indigo-500 ${errors.cnj ? 'border-rose-500 focus:border-rose-500 text-rose-200 bg-rose-500/10' : 'border-white/10'}`} 
                             />
                             {errors.cnj && <span className="text-[10px] text-rose-400 absolute -bottom-5 left-1 flex items-center gap-1"><AlertCircle size={10} /> {errors.cnj}</span>}
                         </div>
                         <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400 ml-1">Fase Processual</label><select value={formData.phase} onChange={(e) => setFormData({...formData, phase: e.target.value as CasePhase})} className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-slate-200 outline-none focus:border-indigo-500">{CASE_PHASES.map(p => <option key={p} value={p} className="bg-slate-800">{p}</option>)}</select></div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                         <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400 ml-1">Tribunal / Vara</label><input type="text" value={formData.court} onChange={(e) => setFormData({...formData, court: e.target.value})} placeholder="Ex: 3ª Vara Cível de SP" className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-slate-200 outline-none focus:border-indigo-500" /></div>
                         <div className="space-y-1.5 relative">
                             <label className="text-xs font-medium text-slate-400 ml-1">Juiz(a)</label>
                             <input 
                                list="judges-list"
                                type="text" 
                                value={formData.judge} 
                                onChange={(e) => setFormData({...formData, judge: e.target.value})} 
                                placeholder="Nome do Magistrado" 
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-slate-200 outline-none focus:border-indigo-500" 
                             />
                             <datalist id="judges-list">
                                {judgeSuggestions.map((judge, idx) => (
                                    <option key={idx} value={judge} />
                                ))}
                             </datalist>
                         </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                         <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400 ml-1">Data de Distribuição</label><input type="date" value={formData.distributionDate} onChange={(e) => setFormData({...formData, distributionDate: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-slate-200 outline-none scheme-dark focus:border-indigo-500" /></div>
                         <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400 ml-1">Próxima Audiência</label><input type="date" value={formData.nextHearing} onChange={(e) => setFormData({...formData, nextHearing: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-slate-200 outline-none scheme-dark focus:border-indigo-500" /></div>
                     </div>
                </div>
            )}

            {activeTab === 'parties' && (
                <div className="space-y-5 animate-fade-in">
                     <div className="bg-emerald-900/10 border border-emerald-500/10 p-4 rounded-xl space-y-4">
                        <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400 ml-1">Parte Contrária (Réu/Autor)</label><div className="relative"><Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/50" /><input type="text" value={formData.opposingParty} onChange={(e) => setFormData({...formData, opposingParty: e.target.value})} placeholder="Nome da Parte Adversa" className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-slate-200 outline-none focus:border-emerald-500" /></div></div>
                         <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400 ml-1">Valor da Causa</label><input type="text" value={formData.value} onChange={handleValueChange} placeholder="R$ 0,00" className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-2.5 px-3 text-slate-200 outline-none font-mono focus:border-emerald-500" /></div>
                     </div>
                     <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400 ml-1">Observações Iniciais / Estratégia</label><textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Digite notas relevantes sobre o caso, estratégia inicial ou prazos críticos..." className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-3 text-slate-200 outline-none resize-none focus:border-indigo-500 text-sm"></textarea></div>
                </div>
            )}
        </div>
    </Modal>
  );
};