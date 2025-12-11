
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { GlassCard } from '../components/ui/GlassCard';
import { ArrowLeft, Calendar, User, DollarSign, Plus, Paperclip, Clock, CheckCircle, AlertTriangle, Send, Loader2, FileText, Edit2, Check, History } from 'lucide-react';
import { LegalCase, Task, FinancialRecord, SystemDocument, CaseMovement } from '../types';
import { useToast } from '../context/ToastContext';
import { CaseFormModal } from '../components/CaseFormModal';
import { DocumentUpload } from '../components/DocumentUpload';
import { Modal } from '../components/ui/Modal';
import { CASE_PHASES } from '../utils/constants';
import { useEntityValidator } from '../hooks/useEntityValidator';

export const CaseDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  // Validation Hook
  const { isValid, isLoading: isValidatorLoading } = useEntityValidator('case', id);

  const [caseData, setCaseData] = useState<LegalCase | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [documents, setDocuments] = useState<SystemDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'tasks' | 'docs' | 'financial' | 'history'>('timeline');
  const [newMovement, setNewMovement] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      const [foundCase, caseTasks, caseFin, caseDocs] = await Promise.all([
        storageService.getCaseById(id),
        storageService.getTasksByCaseId(id),
        storageService.getFinancialsByCaseId(id),
        storageService.getDocumentsByCaseId(id)
      ]);
      
      if (foundCase) {
        // Ensure movements are sorted correctly (Newest first)
        if (foundCase.movements) {
            foundCase.movements.sort((a, b) => {
                const dateA = new Date(a.date.split(' ')[0].split('/').reverse().join('-')).getTime();
                const dateB = new Date(b.date.split(' ')[0].split('/').reverse().join('-')).getTime();
                return dateB - dateA; // Descending
            });
        }
        setCaseData(foundCase);
        setTasks(caseTasks); 
        setFinancials(caseFin);
        setDocuments(caseDocs);
      }
    } catch (error) {
      console.error("Error loading case details:", error);
      addToast("Erro ao carregar detalhes do processo", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isValid && id) {
      loadData();
    }
  }, [id, isValid, addToast]);

  const handleAddMovement = async () => {
    if (!newMovement.trim() || !caseData) return;

    const movement: CaseMovement = {
        id: Date.now().toString(),
        date: new Date().toLocaleString('pt-BR'),
        title: 'Nova Nota/Andamento',
        description: newMovement,
        type: 'Nota',
        author: 'Você'
    };

    const updatedCase = { 
        ...caseData, 
        movements: [movement, ...(caseData.movements || [])] 
    };

    await storageService.saveCase(updatedCase);
    setCaseData(updatedCase);
    setNewMovement('');
    addToast('Movimentação registrada com sucesso.', 'success');
  };

  const handleDocumentSave = async (file: File, meta: { title: string, category: string }) => {
    if (!caseData) return;
    try {
        const newDoc: SystemDocument = {
            id: `doc-${Date.now()}`,
            officeId: caseData.officeId,
            name: file.name,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
            date: new Date().toLocaleDateString('pt-BR'),
            category: meta.category,
            caseId: caseData.id
        };

        // Salvar documento
        await storageService.saveDocument(newDoc);
        
        // Registrar movimentação automática
        const movement: CaseMovement = {
            id: `mov-${Date.now()}`,
            date: new Date().toLocaleDateString('pt-BR'),
            title: 'Novo Documento Anexado',
            description: `Documento "${meta.title}" (${meta.category}) adicionado ao processo.`,
            type: 'Andamento',
            author: 'Sistema'
        };
        const updatedCase = { 
            ...caseData, 
            movements: [movement, ...(caseData.movements || [])] 
        };
        await storageService.saveCase(updatedCase);

        setIsUploadOpen(false);
        addToast('Documento anexado com sucesso!', 'success');
        loadData();
    } catch (e) {
        console.error(e);
        addToast('Erro ao salvar documento.', 'error');
    }
  };

  if (isValidatorLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">
        <Loader2 className="animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  if (!isValid || !caseData) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-center">
        <div className="p-4 bg-white/5 rounded-full mb-4"><AlertTriangle size={32} className="text-amber-500" /></div>
        <h1 className="text-2xl font-bold text-white mb-2">Processo não encontrado</h1>
        <p className="text-slate-400 mb-6 max-w-md">O processo solicitado não existe ou você não tem permissão para visualizá-lo.</p>
        <button onClick={() => navigate('/cases')} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors">Voltar para Lista</button>
      </div>
    );
  }

  const currentPhaseIndex = CASE_PHASES.indexOf(caseData.phase || 'Distributivo');

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <button onClick={() => navigate('/cases')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2">
        <ArrowLeft size={16} /> Voltar para Lista
      </button>

      <GlassCard className="p-0 overflow-hidden relative">
        <div className="h-2 bg-gradient-to-r from-indigo-600 to-purple-600"></div>
        <div className="p-6 md:p-8 pb-4">
            <div className="flex flex-col md:flex-row justify-between gap-6 mb-6">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-xs font-mono text-slate-300">CNJ: {caseData.cnj}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium border ${caseData.status === 'Ativo' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-slate-500/30 bg-slate-500/10 text-slate-300'}`}>{caseData.status}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{caseData.title}</h1>
                        <button onClick={() => setIsEditModalOpen(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><Edit2 size={18} /></button>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1 hover:text-indigo-400 cursor-pointer transition-colors" onClick={() => navigate(`/clients/${caseData.client.id}`)}><User size={14} /> {caseData.client.name}</span>
                        <span className="hidden md:inline">•</span>
                        <span className="flex items-center gap-1"><DollarSign size={14} /> Valor: R$ {caseData.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
                <div className="flex flex-col gap-2 md:text-right">
                     <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Próxima Audiência</p>
                        <p className="text-white font-medium flex items-center gap-2 justify-end md:justify-end"><Calendar size={14} className="text-indigo-400" />{caseData.nextHearing || 'Não agendada'}</p>
                     </div>
                </div>
            </div>

            <div className="mt-8 mb-4 relative">
                <div className="hidden md:block absolute top-[14px] left-0 right-0 h-0.5 bg-slate-800 z-0 rounded-full mx-4"></div>
                <div className="hidden md:block absolute top-[14px] left-0 h-0.5 bg-indigo-600 z-0 rounded-full mx-4 transition-all duration-1000 ease-out" style={{ width: `${(currentPhaseIndex / (CASE_PHASES.length - 1)) * 100}%` }}></div>
                <div className="flex justify-between relative z-10 overflow-x-auto pb-2 md:pb-0 hide-scrollbar gap-4 md:gap-0 px-2">
                    {CASE_PHASES.map((phase, idx) => {
                        const isCompleted = idx <= currentPhaseIndex;
                        const isCurrent = idx === currentPhaseIndex;
                        return (
                            <div key={phase} className="flex flex-col items-center gap-3 min-w-[80px] md:min-w-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isCurrent ? 'bg-indigo-600 border-indigo-400 scale-110 shadow-glow ring-2 ring-indigo-900' : isCompleted ? 'bg-slate-800 border-indigo-600 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-600'}`}>
                                    {isCompleted && !isCurrent && <Check size={14} />}
                                    {isCurrent && <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>}
                                    {!isCompleted && <span className="text-[10px]">{idx + 1}</span>}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors duration-300 ${isCurrent ? 'text-indigo-300' : isCompleted ? 'text-slate-300' : 'text-slate-600'}`}>{phase}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
        
        <div className="flex overflow-x-auto border-t border-white/5 px-6">
            {['timeline', 'tasks', 'docs', 'financial', 'history'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                    {tab === 'timeline' && <Clock size={16} />}
                    {tab === 'tasks' && <CheckCircle size={16} />}
                    {tab === 'docs' && <Paperclip size={16} />}
                    {tab === 'financial' && <DollarSign size={16} />}
                    {tab === 'history' && <History size={16} />}
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            {activeTab === 'timeline' && (
                <div className="space-y-6 animate-fade-in">
                    <GlassCard className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-white">Nova Movimentação</h4>
                            <button onClick={() => setIsUploadOpen(true)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all">
                                <FileText size={12} /> Adicionar Documento
                            </button>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0"><User size={20} className="text-slate-400" /></div>
                            <div className="flex-1">
                                <textarea 
                                    value={newMovement} 
                                    onChange={(e) => setNewMovement(e.target.value)} 
                                    placeholder="Adicionar nota, andamento ou despacho manualmente..." 
                                    className="w-full bg-transparent text-white placeholder:text-slate-500 outline-none resize-none h-20 text-sm"
                                ></textarea>
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                                    <span className="text-xs text-slate-500">Pressione ENTER para pular linha</span>
                                    <button onClick={handleAddMovement} disabled={!newMovement.trim()} className="px-4 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2"><Send size={12} /> Registrar</button>
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                    <div className="space-y-6 relative pl-4 border-l border-white/10 ml-4">
                        {caseData.movements && caseData.movements.length > 0 ? (
                            caseData.movements.map((mov, idx) => (
                                <div key={idx} className="relative animate-slide-in">
                                    <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-indigo-500 border-2 border-[#0f172a]"></div>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{mov.type}</span>
                                            <span className="text-xs text-slate-500">{mov.date}</span>
                                        </div>
                                        <h5 className="text-sm font-bold text-white mb-1">{mov.title}</h5>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{mov.description}</p>
                                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">Registrado por: {mov.author}</p>
                                    </div>
                                </div>
                            ))
                        ) : (<div className="text-slate-500 text-sm pl-4 italic">Nenhum andamento registrado.</div>)}
                        
                        <div className="relative">
                            <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0f172a]"></div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <p className="text-sm text-slate-200">Processo Cadastrado no Sistema</p>
                                <span className="text-xs text-slate-500">Data de criação automática</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'tasks' && <div className="text-center py-10 text-slate-500 bg-white/5 rounded-xl border border-dashed border-white/10 animate-fade-in"><CheckCircle className="mx-auto mb-2 opacity-50" />{tasks.length > 0 ? `${tasks.length} tarefas vinculadas` : 'Nenhuma tarefa vinculada.'}</div>}
            {activeTab === 'financial' && <div className="text-center py-10 text-slate-500 bg-white/5 rounded-xl border border-dashed border-white/10 animate-fade-in"><DollarSign className="mx-auto mb-2 opacity-50" />{financials.length > 0 ? `${financials.length} registros financeiros` : 'Nenhum lançamento financeiro.'}</div>}
            {activeTab === 'docs' && <div className="text-center py-10 text-slate-500 bg-white/5 rounded-xl border border-dashed border-white/10 animate-fade-in"><Paperclip className="mx-auto mb-2 opacity-50" />{documents.length > 0 ? `${documents.length} documentos` : 'Nenhum documento anexado.'}</div>}
            {activeTab === 'history' && <div className="text-center py-10 text-slate-500 bg-white/5 rounded-xl border border-dashed border-white/10 animate-fade-in"><History className="mx-auto mb-2 opacity-50" />Histórico de alterações (Log)</div>}
        </div>

        <div className="space-y-6">
            <GlassCard>
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Detalhes Rápidos</h3>
                <div className="space-y-4 text-sm">
                    <div><span className="text-slate-500 text-xs block">Tribunal / Vara</span><span className="text-slate-200">{caseData.court || 'Não informado'}</span></div>
                    <div><span className="text-slate-500 text-xs block">Advogado Responsável</span><span className="text-slate-200">{caseData.responsibleLawyer}</span></div>
                    <div><span className="text-slate-500 text-xs block">Cliente</span><span className="text-indigo-400 cursor-pointer hover:underline" onClick={() => navigate(`/clients/${caseData.client.id}`)}>{caseData.client.name}</span></div>
                </div>
            </GlassCard>
        </div>
      </div>

      {caseData && (
        <CaseFormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={() => { setIsEditModalOpen(false); loadData(); }} initialData={caseData} />
      )}

      <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title="Upload de Documento" maxWidth="max-w-4xl" footer={null}>
         <DocumentUpload onSave={handleDocumentSave} onCancel={() => setIsUploadOpen(false)} />
      </Modal>
    </div>
  );
};
