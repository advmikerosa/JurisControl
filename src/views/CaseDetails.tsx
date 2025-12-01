
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { GlassCard } from '../components/ui/GlassCard';
import { ArrowLeft, Calendar, User, DollarSign, Plus, Paperclip, Clock, CheckCircle, AlertTriangle, Send, Loader2, FileText, Edit2, Check, History } from 'lucide-react';
import { LegalCase, Task, FinancialRecord, SystemDocument, CaseMovement, CasePhase } from '../types';
import { useToast } from '../context/ToastContext';
import { CaseFormModal } from '../components/CaseFormModal';
import { CASE_PHASES } from '../utils/constants';

export const CaseDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [caseData, setCaseData] = useState<LegalCase | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [documents, setDocuments] = useState<SystemDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'tasks' | 'docs' | 'financial' | 'history'>('timeline');
  const [newMovement, setNewMovement] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadData = async () => {
    if (id) {
      try {
        const [foundCase, caseTasks, caseFin, caseDocs] = await Promise.all([
          storageService.getCaseById(id),
          storageService.getTasksByCaseId(id),
          storageService.getFinancialsByCaseId(id),
          storageService.getDocumentsByCaseId(id)
        ]);
        
        if (foundCase) {
          setCaseData(foundCase);
          setTasks(caseTasks); 
          setFinancials(caseFin);
          setDocuments(caseDocs);
        } else {
          addToast("Processo não encontrado.", "error");
        }
      } catch (error) {
        console.error("Error loading case details:", error);
        addToast("Erro ao carregar detalhes do processo", "error");
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [id, addToast]);

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
    addToast('Movimentação registrada.', 'success');
  };

  const handleEditSuccess = async () => {
      // Reload data to reflect changes
      await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="animate-spin mr-2" /> Carregando processo...
      </div>
    );
  }

  if (!caseData) return <div className="p-8 text-white">Processo não encontrado.</div>;

  // Calculate progress index
  const currentPhaseIndex = CASE_PHASES.indexOf(caseData.phase || 'Distributivo');

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header de Navegação */}
      <button onClick={() => navigate('/cases')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2">
        <ArrowLeft size={16} /> Voltar para Lista
      </button>

      {/* Card Principal do Processo */}
      <GlassCard className="p-0 overflow-hidden relative">
        <div className="h-2 bg-gradient-to-r from-indigo-600 to-purple-600"></div>
        <div className="p-6 md:p-8 pb-4">
            <div className="flex flex-col md:flex-row justify-between gap-6 mb-6">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-xs font-mono text-slate-300">
                            CNJ: {caseData.cnj}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium border ${
                            caseData.status === 'Ativo' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-slate-500/30 bg-slate-500/10 text-slate-300'
                        }`}>
                            {caseData.status}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{caseData.title}</h1>
                        <button onClick={() => setIsEditModalOpen(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors" title="Editar Detalhes">
                            <Edit2 size={18} />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1 hover:text-indigo-400 cursor-pointer transition-colors" onClick={() => navigate(`/clients/${caseData.client.id}`)}>
                            <User size={14} /> {caseData.client.name}
                        </span>
                        <span className="hidden md:inline">•</span>
                        <span className="flex items-center gap-1">
                            <DollarSign size={14} /> Valor: R$ {caseData.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col gap-2 md:text-right">
                     <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Próxima Audiência</p>
                        <p className="text-white font-medium flex items-center gap-2 justify-end md:justify-end">
                            <Calendar size={14} className="text-indigo-400" />
                            {caseData.nextHearing || 'Não agendada'}
                        </p>
                     </div>
                </div>
            </div>

            {/* Visual Phase Stepper */}
            <div className="mt-8 mb-4 relative">
                {/* Progress Line Background */}
                <div className="hidden md:block absolute top-[14px] left-0 right-0 h-0.5 bg-slate-800 z-0 rounded-full mx-4"></div>
                {/* Progress Line Active */}
                <div className="hidden md:block absolute top-[14px] left-0 h-0.5 bg-indigo-600 z-0 rounded-full mx-4 transition-all duration-1000 ease-out" style={{ width: `${(currentPhaseIndex / (CASE_PHASES.length - 1)) * 100}%` }}></div>
                
                <div className="flex justify-between relative z-10 overflow-x-auto pb-2 md:pb-0 hide-scrollbar gap-4 md:gap-0 px-2">
                    {CASE_PHASES.map((phase, idx) => {
                        const isCompleted = idx <= currentPhaseIndex;
                        const isCurrent = idx === currentPhaseIndex;
                        return (
                            <div key={phase} className="flex flex-col items-center gap-3 min-w-[80px] md:min-w-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isCurrent ? 'bg-indigo-600 border-indigo-400 scale-110 shadow-[0_0_15px_rgba(99,102,241,0.6)] ring-2 ring-indigo-900' : isCompleted ? 'bg-slate-800 border-indigo-600 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-600'}`}>
                                    {isCompleted && !isCurrent && <Check size={14} />}
                                    {isCurrent && <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>}
                                    {!isCompleted && <span className="text-[10px]">{idx + 1}</span>}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors duration-300 ${isCurrent ? 'text-indigo-300' : isCompleted ? 'text-slate-300' : 'text-slate-600'}`}>
                                    {phase}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
        
        {/* Tabs */}
        <div className="flex overflow-x-auto border-t border-white/5 px-6">
            <button onClick={() => setActiveTab('timeline')} className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'timeline' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                <Clock size={16} /> Linha do Tempo
            </button>
            <button onClick={() => setActiveTab('tasks')} className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'tasks' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                <CheckCircle size={16} /> Prazos & Tarefas
            </button>
            <button onClick={() => setActiveTab('docs')} className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'docs' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                <Paperclip size={16} /> Documentos
            </button>
            <button onClick={() => setActiveTab('financial')} className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'financial' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                <DollarSign size={16} /> Financeiro
            </button>
            <button onClick={() => setActiveTab('history')} className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'history' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                <History size={16} /> Histórico
            </button>
        </div>
      </GlassCard>

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
            
            {activeTab === 'timeline' && (
                <div className="space-y-6">
                    {/* Input Nova Movimentação */}
                    <GlassCard className="p-4">
                        <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                <User size={20} className="text-slate-400" />
                            </div>
                            <div className="flex-1">
                                <textarea 
                                    value={newMovement}
                                    onChange={(e) => setNewMovement(e.target.value)}
                                    placeholder="Adicionar nota, andamento ou despacho..." 
                                    className="w-full bg-transparent text-white placeholder:text-slate-500 outline-none resize-none h-20 text-sm"
                                ></textarea>
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                                    <span className="text-xs text-slate-500">Pressione ENTER para pular linha</span>
                                    <button 
                                        onClick={handleAddMovement}
                                        disabled={!newMovement.trim()}
                                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Send size={12} /> Registrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                    {/* Lista de Movimentações */}
                    <div className="space-y-6 relative pl-4 border-l border-white/10 ml-4">
                        {caseData.movements && caseData.movements.length > 0 ? (
                            caseData.movements.map((mov, idx) => (
                                <div key={idx} className="relative">
                                    <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-indigo-500 border-2 border-[#0f172a]"></div>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{mov.type}</span>
                                            <span className="text-xs text-slate-500">{mov.date}</span>
                                        </div>
                                        <p className="text-sm text-slate-200 whitespace-pre-wrap">{mov.description}</p>
                                        <p className="text-xs text-slate-500 mt-2">Registrado por: {mov.author}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-slate-500 text-sm pl-4 italic">Nenhum andamento registrado.</div>
                        )}
                        
                        {/* Item Inicial */}
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

            {activeTab === 'tasks' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-white">Prazos Vinculados</h3>
                        <button onClick={() => navigate('/crm')} className="text-xs text-indigo-400 hover:text-indigo-300">Gerenciar no Kanban &rarr;</button>
                    </div>
                    {tasks.length > 0 ? (
                        tasks.map(t => (
                            <GlassCard key={t.id} className="p-4 flex items-center justify-between border-l-4 border-l-indigo-500">
                                <div>
                                    <h4 className="text-white font-medium">{t.title}</h4>
                                    <p className="text-xs text-slate-400">Vencimento: {t.dueDate}</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${t.status === 'Concluído' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                    {t.status}
                                </span>
                            </GlassCard>
                        ))
                    ) : (
                        <div className="text-center py-10 text-slate-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                            <CheckCircle className="mx-auto mb-2 opacity-50" />
                            Nenhum prazo pendente para este processo.
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'financial' && (
                <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-white">Histórico Financeiro</h3>
                        <button onClick={() => navigate('/financial')} className="text-xs text-indigo-400 hover:text-indigo-300">Ir para Financeiro &rarr;</button>
                    </div>
                    {financials.length > 0 ? (
                        financials.map(f => (
                            <GlassCard key={f.id} className="p-4 flex justify-between items-center">
                                <div>
                                    <p className="text-white font-medium">{f.title}</p>
                                    <span className="text-xs text-slate-400">{f.category} • Venc: {f.dueDate}</span>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold ${f.type === 'Receita' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {f.type === 'Receita' ? '+' : '-'} R$ {f.amount.toFixed(2)}
                                    </p>
                                    <span className="text-[10px] uppercase text-slate-500">{f.status}</span>
                                </div>
                            </GlassCard>
                        ))
                    ) : (
                        <div className="text-center py-10 text-slate-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                            <DollarSign className="mx-auto mb-2 opacity-50" />
                            Nenhum lançamento financeiro vinculado.
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'docs' && (
                 <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-white">Pasta Digital</h3>
                        <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs rounded-lg border border-white/10 flex items-center gap-2">
                            <Plus size={12} /> Adicionar
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {documents.length > 0 ? (
                            documents.map(d => (
                                <div key={d.id} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-slate-800 rounded-lg text-indigo-400 group-hover:text-white transition-colors">
                                            <FileText size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white font-medium truncate">{d.name}</p>
                                            <p className="text-xs text-slate-500">{d.date} • {d.size}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-2 text-center py-10 text-slate-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                                <Paperclip className="mx-auto mb-2 opacity-50" />
                                Nenhum documento anexado.
                            </div>
                        )}
                    </div>
                 </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-white">Histórico de Alterações</h3>
                        <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded-lg">Audit Trail (Log)</span>
                    </div>
                    <div className="rounded-xl border border-white/10 overflow-hidden bg-white/5">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-900/50 text-slate-400 border-b border-white/10">
                                <tr>
                                    <th className="py-3 px-4 font-medium">Data</th>
                                    <th className="py-3 px-4 font-medium">Usuário</th>
                                    <th className="py-3 px-4 font-medium">Campo</th>
                                    <th className="py-3 px-4 font-medium">De</th>
                                    <th className="py-3 px-4 font-medium">Para</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {caseData.changeLog && caseData.changeLog.length > 0 ? (
                                    caseData.changeLog.map(log => (
                                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                            <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{log.date}</td>
                                            <td className="py-3 px-4 text-slate-300">{log.author}</td>
                                            <td className="py-3 px-4 font-medium text-indigo-300">{log.field}</td>
                                            <td className="py-3 px-4 text-rose-400/80 font-mono text-xs line-through truncate max-w-[120px]" title={log.oldValue}>{log.oldValue}</td>
                                            <td className="py-3 px-4 text-emerald-400 font-mono text-xs truncate max-w-[120px]" title={log.newValue}>{log.newValue}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-500">
                                            <History className="mx-auto mb-2 opacity-30" size={32} />
                                            Nenhuma alteração registrada desde a criação.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>

        {/* Sidebar Right */}
        <div className="space-y-6">
            <GlassCard>
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Detalhes Rápidos</h3>
                <div className="space-y-4 text-sm">
                    <div>
                        <span className="text-slate-500 text-xs block">Tribunal / Vara</span>
                        <span className="text-slate-200">{caseData.court || 'Não informado'}</span>
                    </div>
                    <div>
                        <span className="text-slate-500 text-xs block">Advogado Responsável</span>
                        <span className="text-slate-200">{caseData.responsibleLawyer}</span>
                    </div>
                    <div>
                         <span className="text-slate-500 text-xs block">Cliente</span>
                         <span className="text-indigo-400 cursor-pointer hover:underline" onClick={() => navigate(`/clients/${caseData.client.id}`)}>{caseData.client.name}</span>
                    </div>
                </div>
            </GlassCard>

            <GlassCard className="bg-gradient-to-br from-indigo-900/20 to-slate-900/50 border-indigo-500/30">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-400" /> Atenção
                </h3>
                <p className="text-xs text-slate-400">
                    Verifique o Diário Oficial. Última atualização automática há 3 dias.
                </p>
                <button className="mt-3 w-full py-2 bg-white/5 hover:bg-white/10 text-white text-xs rounded-lg border border-white/10 transition-colors">
                    Buscar Publicações
                </button>
            </GlassCard>
        </div>
      </div>

      {/* Edit Modal */}
      {caseData && (
        <CaseFormModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSave={handleEditSuccess}
            initialData={caseData}
        />
      )}
    </div>
  );
};