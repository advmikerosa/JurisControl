
import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { User, Search, CheckSquare, AlertCircle, Briefcase, ChevronRight, Info, Scale, Users, HelpCircle, ChevronLeft, Save, Loader2, Download, Check } from 'lucide-react';
import { Client, LegalCase, LegalCategory, CasePhase, CaseStatus } from '../types';
import { storageService } from '../services/storageService';
import { dataJudService } from '../services/dataJudService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LEGAL_CATEGORIES, CASE_PHASES } from '../utils/constants';

interface CaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialData?: LegalCase | null;
  preSelectedClientId?: string;
}

export const CaseFormModal: React.FC<CaseFormModalProps> = ({ isOpen, onClose, onSave, initialData, preSelectedClientId }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // Data States
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState<Partial<LegalCase>>({
    status: CaseStatus.ACTIVE,
    phase: 'Distributivo',
    value: 0,
    category: 'Cível'
  });

  useEffect(() => {
    if (isOpen) {
      loadClients();
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({
          status: CaseStatus.ACTIVE,
          phase: 'Distributivo',
          value: 0,
          category: 'Cível',
          responsibleLawyer: user?.name || '',
          client: preSelectedClientId ? { id: preSelectedClientId } as Client : undefined
        });
      }
      setStep(1);
      setErrors({});
    }
  }, [isOpen, initialData, preSelectedClientId, user]);

  const loadClients = async () => {
    const clients = await storageService.getClients();
    setAvailableClients(clients);
  };

  const handleImportCNJ = async () => {
    if (!formData.cnj || formData.cnj.length < 10) {
        addToast('Digite um CNJ válido para buscar.', 'error');
        return;
    }
    setIsImporting(true);
    try {
        const processData = await dataJudService.fetchProcessByCNJ(formData.cnj);
        if (processData) {
            setFormData(prev => ({ ...prev, ...processData }));
            // Clear errors related to fields that might be filled
            setErrors(prev => ({ ...prev, cnj: '', title: '' }));
            addToast('Dados importados do DataJud com sucesso!', 'success');
        } else {
            addToast('Processo não encontrado no DataJud (API Pública). Preencha manualmente.', 'info');
        }
    } catch (error: any) {
        addToast(error.message || 'Erro ao buscar dados.', 'error');
    } finally {
        setIsImporting(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
        // If client is just a partial object (id only), find the full client
        let fullClient = formData.client;
        if (formData.client && formData.client.id && !formData.client.name) {
            fullClient = availableClients.find(c => c.id === formData.client?.id) || formData.client;
        }

        const caseToSave = {
            ...formData,
            client: fullClient,
            // Ensure mandatory fields have fallbacks
            responsibleLawyer: formData.responsibleLawyer || user?.name || 'Não atribuído',
            value: Number(formData.value) || 0,
            lastUpdate: new Date().toISOString()
        } as LegalCase;

        await storageService.saveCase(caseToSave);
        addToast(initialData ? 'Processo atualizado!' : 'Processo criado com sucesso!', 'success');
        onSave();
        onClose();
    } catch (error) {
        console.error(error);
        addToast('Erro ao salvar processo.', 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const validateStep1 = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.title?.trim()) newErrors.title = 'O título do processo é obrigatório.';
    if (!formData.client?.id) newErrors.client = 'Selecione um cliente.';
    if (!formData.cnj?.trim()) newErrors.cnj = 'O número do CNJ é obrigatório.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (step === 1) {
        if (validateStep1()) {
            setStep(prev => prev + 1);
        } else {
            addToast('Por favor, preencha os campos obrigatórios.', 'error');
        }
    } else {
        setStep(prev => prev + 1);
    }
  };

  const prevStep = () => setStep(prev => prev - 1);

  const clearError = (field: string) => {
      if (errors[field]) {
          setErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors[field];
              return newErrors;
          });
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Processo" : "Novo Processo"} maxWidth="max-w-3xl"
      footer={
        <div className="flex justify-between w-full">
            <button 
                onClick={step === 1 ? onClose : prevStep} 
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
                {step > 1 && <ChevronLeft size={16} />}
                {step === 1 ? 'Cancelar' : 'Voltar'}
            </button>
            
            {step < 3 ? (
                <button onClick={nextStep} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                    Próximo <ChevronRight size={16} />
                </button>
            ) : (
                <button onClick={handleSave} disabled={isLoading} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-70">
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {initialData ? 'Salvar Alterações' : 'Criar Processo'}
                </button>
            )}
        </div>
      }
    >
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 px-4 relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-white/10 -z-10"></div>
            {[
                { num: 1, label: 'Dados Básicos' },
                { num: 2, label: 'Detalhes' },
                { num: 3, label: 'Revisão' }
            ].map((s) => (
                <div key={s.num} className={`flex flex-col items-center gap-2 bg-[#0f172a] px-2 ${step >= s.num ? 'text-indigo-400' : 'text-slate-600'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold text-xs transition-all ${step >= s.num ? 'border-indigo-500 bg-indigo-500/20' : 'border-slate-700 bg-slate-800'}`}>
                        {step > s.num ? <Check size={14} /> : s.num}
                    </div>
                    <span className="text-xs font-medium">{s.label}</span>
                </div>
            ))}
        </div>

        <div className="min-h-[300px]">
            {step === 1 && (
                <div className="space-y-5 animate-fade-in">
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div>
                            <h4 className="text-blue-300 font-bold text-sm flex items-center gap-2"><Search size={16} /> Importação Automática</h4>
                            <p className="text-blue-200/60 text-xs mt-1">Digite o CNJ para buscar dados automaticamente via DataJud.</p>
                        </div>
                        <div className="flex flex-col w-full sm:w-auto gap-1">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="CNJ (0000000-00.0000.0.00.0000)" 
                                    value={formData.cnj || ''}
                                    onChange={e => {
                                        setFormData({...formData, cnj: e.target.value});
                                        clearError('cnj');
                                    }}
                                    className={`bg-black/20 border rounded-lg px-3 py-1.5 text-sm text-white outline-none flex-1 sm:w-48 transition-all ${errors.cnj ? 'border-rose-500 focus:border-rose-500' : 'border-white/10 focus:border-blue-500'}`}
                                />
                                <button onClick={handleImportCNJ} disabled={isImporting} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                                    {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                    Importar
                                </button>
                            </div>
                            {errors.cnj && <span className="text-[10px] text-rose-400 ml-1">{errors.cnj}</span>}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-slate-400 ml-1">Título do Processo <span className="text-rose-400">*</span></label>
                        <input 
                            type="text" 
                            value={formData.title || ''} 
                            onChange={e => {
                                setFormData({...formData, title: e.target.value});
                                clearError('title');
                            }}
                            className={`w-full bg-white/5 border rounded-lg p-3 text-white outline-none transition-colors placeholder:text-slate-600 ${errors.title ? 'border-rose-500 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'}`}
                            placeholder="Ex: Ação Trabalhista - Silva vs Empresa X"
                        />
                        {errors.title && <span className="text-[10px] text-rose-400 ml-1 flex items-center gap-1"><AlertCircle size={10} /> {errors.title}</span>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400 ml-1">Cliente <span className="text-rose-400">*</span></label>
                            <div className="relative">
                                <User className={`absolute left-3 top-1/2 -translate-y-1/2 ${errors.client ? 'text-rose-400' : 'text-slate-500'}`} size={16} />
                                <select 
                                    value={formData.client?.id || ''}
                                    onChange={e => {
                                        const client = availableClients.find(c => c.id === e.target.value);
                                        setFormData({...formData, client});
                                        clearError('client');
                                    }}
                                    className={`w-full bg-white/5 border rounded-lg py-3 pl-10 pr-4 text-white outline-none appearance-none cursor-pointer transition-all ${errors.client ? 'border-rose-500 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'}`}
                                    disabled={!!preSelectedClientId}
                                >
                                    <option value="" className="bg-slate-900">Selecione um cliente...</option>
                                    {availableClients.map(c => (
                                        <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            {errors.client && <span className="text-[10px] text-rose-400 ml-1">{errors.client}</span>}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400 ml-1">Categoria</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <select 
                                    value={formData.category}
                                    onChange={e => setFormData({...formData, category: e.target.value as LegalCategory})}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                                >
                                    {LEGAL_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-5 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400 ml-1">Valor da Causa (R$)</label>
                            <input 
                                type="number" 
                                value={formData.value} 
                                onChange={e => setFormData({...formData, value: Number(e.target.value)})}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
                                placeholder="0,00"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400 ml-1">Fase Processual</label>
                            <select 
                                value={formData.phase}
                                onChange={e => setFormData({...formData, phase: e.target.value as CasePhase})}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                            >
                                {CASE_PHASES.map(phase => (
                                    <option key={phase} value={phase} className="bg-slate-900">{phase}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400 ml-1">Tribunal / Vara</label>
                            <div className="relative">
                                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <input 
                                    type="text" 
                                    value={formData.court || ''} 
                                    onChange={e => setFormData({...formData, court: e.target.value})}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500"
                                    placeholder="Ex: 2ª Vara Cível de SP"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400 ml-1">Próxima Audiência</label>
                            <input 
                                type="date" 
                                value={formData.nextHearing ? formData.nextHearing.split('/').reverse().join('-') : ''} 
                                onChange={e => {
                                    const date = e.target.value ? new Date(e.target.value).toLocaleDateString('pt-BR') : undefined;
                                    setFormData({...formData, nextHearing: date});
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-indigo-500 scheme-dark"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-slate-400 ml-1">Advogado Responsável</label>
                        <div className="relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input 
                                type="text" 
                                value={formData.responsibleLawyer || ''} 
                                onChange={e => setFormData({...formData, responsibleLawyer: e.target.value})}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500"
                                placeholder="Nome do advogado"
                            />
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                                <Briefcase size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">{formData.title}</h3>
                                <p className="text-slate-400 text-sm">{formData.cnj}</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-4 gap-x-8 border-t border-white/5 pt-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Cliente</p>
                                <p className="text-white font-medium">{formData.client?.name || 'Não selecionado'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Categoria</p>
                                <p className="text-white font-medium">{formData.category}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Valor</p>
                                <p className="text-emerald-400 font-bold">R$ {Number(formData.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Fase</p>
                                <p className="text-white font-medium">{formData.phase}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Tribunal</p>
                                <p className="text-white font-medium">{formData.court || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Próx. Audiência</p>
                                <p className="text-white font-medium">{formData.nextHearing || 'Não agendada'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                        <AlertCircle size={16} />
                        <p>Verifique se todas as informações estão corretas antes de salvar.</p>
                    </div>
                </div>
            )}
        </div>
    </Modal>
  );
};
