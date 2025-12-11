
import React, { useEffect, useState, useMemo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Scale, Clock, AlertCircle, CheckCircle, Calendar, Briefcase, Gavel, Plus, ArrowRight, Activity, FileText, Scroll, ExternalLink, SlidersHorizontal, Sparkles } from 'lucide-react';
import { storageService } from '../services/storageService';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../types';
import { PageTransition } from '../components/PageTransition';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';

// Skeleton Components
const StatSkeleton = () => (
  <div className="bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-6 animate-pulse h-[140px]">
    <div className="h-4 w-24 bg-slate-200 dark:bg-white/10 rounded mb-4"></div>
    <div className="h-8 w-16 bg-slate-200 dark:bg-white/10 rounded mb-4"></div>
    <div className="h-3 w-32 bg-slate-200 dark:bg-white/10 rounded"></div>
  </div>
);

const ChartSkeleton = () => (
  <div className="bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-6 animate-pulse h-[400px] flex flex-col">
    <div className="h-6 w-48 bg-slate-200 dark:bg-white/10 rounded mb-8"></div>
    <div className="flex-1 bg-slate-200 dark:bg-white/5 rounded border border-slate-200 dark:border-white/5"></div>
  </div>
);

const ListSkeleton = () => (
  <div className="bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-0 animate-pulse h-[400px] overflow-hidden">
    <div className="p-6 border-b border-slate-200 dark:border-white/5">
      <div className="h-6 w-32 bg-slate-200 dark:bg-white/10 rounded"></div>
    </div>
    <div className="p-6 space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-14 bg-slate-200 dark:bg-white/5 rounded-xl"></div>
      ))}
    </div>
  </div>
);

const StatWidget = React.memo(({ title, value, subtext, icon: Icon, colorClass, onClick, delay, highlight }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }} 
    animate={{ opacity: 1, y: 0 }} 
    transition={{ duration: 0.4, delay: delay }}
  >
    <GlassCard 
        hoverEffect={!!onClick}
        onClick={onClick} 
        className={onClick ? "cursor-pointer h-full relative overflow-hidden group border-l-4 border-transparent hover:border-l-indigo-500" : "h-full relative overflow-hidden"}
    >
      {highlight && <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 dark:bg-rose-500/20 blur-3xl -mr-5 -mt-5 rounded-full animate-pulse"></div>}
      
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
          <h3 className={`text-3xl font-bold tracking-tight ${highlight ? 'text-rose-500 dark:text-rose-400' : 'text-slate-800 dark:text-white'}`}>{value}</h3>
        </div>
        <div className={`p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 ${colorClass}`}>
          <Icon size={24} strokeWidth={2} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-slate-500 text-xs bg-slate-100 dark:bg-black/20 px-2 py-1 rounded border border-slate-200 dark:border-white/5">
          {subtext}
        </span>
        {onClick && <ArrowRight size={16} className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors transform group-hover:translate-x-1" />}
      </div>
    </GlassCard>
  </motion.div>
));

interface DashboardConfig {
  agenda: boolean;
  kpi: boolean;
  movements: boolean;
  chart: boolean;
  hearings: boolean;
  tasks: boolean;
}

const DEFAULT_CONFIG: DashboardConfig = {
  agenda: true,
  kpi: true,
  movements: true,
  chart: true,
  hearings: true,
  tasks: true
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem('@JurisControl:dashboardConfig');
    if (savedConfig) {
      try { setConfig(JSON.parse(savedConfig)); } catch {}
    }

    let isMounted = true;
    const loadData = async () => {
      try {
        const summary = await storageService.getDashboardSummary();
        if (isMounted) {
          setData(summary);
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) setIsLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, []);

  const handleSaveConfig = () => {
    localStorage.setItem('@JurisControl:dashboardConfig', JSON.stringify(config));
    addToast('Layout do dashboard salvo.', 'success');
    setIsConfigModalOpen(false);
  };

  const toggleWidget = (key: keyof DashboardConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const todayStr = useMemo(() => new Date().toLocaleDateString('pt-BR'), []);

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Controle Processual</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Visão geral da carteira de processos, prazos e movimentações.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => setIsConfigModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
            >
              <SlidersHorizontal size={18} />
              <span>Personalizar</span>
            </button>
            <button 
              onClick={() => navigate('/cases?action=new')}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 hover:scale-105"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Novo Processo</span>
            </button>
          </div>
        </div>

        {!isLoading && data && data.counts.activeCases === 0 && data.counts.wonCases === 0 && (
           <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
              <GlassCard className="bg-gradient-to-r from-indigo-600 to-violet-600 border-none text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-32 bg-white/10 blur-3xl rounded-full -mr-10 -mt-10"></div>
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 p-2">
                      <div>
                          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><Sparkles className="text-yellow-300" /> Bem-vindo ao JurisControl!</h2>
                          <p className="text-indigo-100 max-w-xl text-sm leading-relaxed">Seu ambiente está pronto.</p>
                      </div>
                  </div>
              </GlassCard>
           </motion.div>
        )}

        {/* Removed AnimatePresence for initial load to prevent 'invisible content' bug */}
        {config.agenda && !isLoading && data?.lists.todaysAgenda && data.lists.todaysAgenda.length > 0 && (
             <div className="bg-gradient-to-r from-indigo-50 to-slate-100 dark:from-indigo-900/30 dark:to-slate-900/50 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-5 backdrop-blur-md shadow-lg overflow-hidden animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                   <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                      <Calendar size={16} /> Agenda de Hoje ({todayStr})
                   </h3>
                   <button onClick={() => navigate('/crm')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-white transition-colors">Ver todos</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                   {data.lists.todaysAgenda.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="bg-white dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 transition-colors rounded-xl p-3 flex items-center gap-3 border border-slate-200 dark:border-white/5 cursor-pointer group shadow-sm" 
                        onClick={() => item.type === 'task' ? navigate('/crm') : navigate(`/cases/${item.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && (item.type === 'task' ? navigate('/crm') : navigate(`/cases/${item.id}`))}
                      >
                          <div className={`p-2 rounded-lg ${item.type === 'task' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400'}`}>
                             {item.type === 'task' ? <AlertCircle size={16} /> : <Gavel size={16} />}
                          </div>
                          <div className="min-w-0 flex-1">
                             <p className="text-slate-800 dark:text-slate-200 font-bold text-xs truncate" title={item.title}>{item.title}</p>
                             <p className="text-[10px] text-slate-500 font-medium">{item.sub}</p>
                          </div>
                          <ExternalLink size={12} className="ml-auto text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                   ))}
                </div>
             </div>
        )}

        {config.kpi && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
            {isLoading || !data ? (
              <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
            ) : (
              <>
                <StatWidget title="Processos Ativos" value={data.counts.activeCases} subtext="Em andamento" icon={Briefcase} colorClass="text-indigo-600 dark:text-indigo-400" onClick={() => navigate('/cases?status=Ativo')} delay={0.1} />
                <StatWidget title="Próx. Audiências" value={data.counts.hearings} subtext="Agendadas" icon={Gavel} colorClass="text-violet-600 dark:text-violet-400" delay={0.2} />
                <StatWidget title="Prazos Urgentes" value={data.counts.highPriorityTasks} subtext="Alta prioridade" icon={AlertCircle} colorClass="text-rose-600 dark:text-rose-400" onClick={() => navigate('/crm')} delay={0.3} highlight={data.counts.highPriorityTasks > 0} />
                <StatWidget title="Processos Ganhos" value={data.counts.wonCases} subtext="Total acumulado" icon={CheckCircle} colorClass="text-emerald-600 dark:text-emerald-400" delay={0.4} onClick={() => navigate('/cases?status=Ganho')} />
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
             {config.movements && (
               (isLoading || !data) ? (<ListSkeleton />) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                     <GlassCard className="flex flex-col h-full min-h-[400px]">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                             <Activity size={18} className="text-indigo-500 dark:text-indigo-400" /> Últimas Movimentações
                          </h3>
                          <button onClick={() => navigate('/cases')} className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-white transition-colors bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10">Ver todos</button>
                        </div>
                        <div className="flex-1 space-y-0">
                           {data.lists.recentMovements && data.lists.recentMovements.length > 0 ? (
                              data.lists.recentMovements.map((mov, i) => (
                                <div 
                                    key={i} 
                                    className="flex gap-4 p-4 border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors rounded-xl cursor-pointer" 
                                    onClick={() => navigate(`/cases/${mov.caseId}`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/cases/${mov.caseId}`)}
                                >
                                   <div className="flex flex-col items-center pt-1">
                                      <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
                                         {mov.type === 'Despacho' ? <Gavel size={14} /> : mov.type === 'Audiência' ? <Clock size={14} /> : <FileText size={14} />}
                                      </div>
                                      {i < data.lists.recentMovements.length - 1 && <div className="w-0.5 h-full bg-slate-200 dark:bg-white/5 my-1 rounded-full"></div>}
                                   </div>
                                   <div className="flex-1 pb-2">
                                      <div className="flex justify-between items-start mb-1">
                                         <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-black/20 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5">{mov.type}</span>
                                         <span className="text-xs text-slate-500 font-mono">{mov.date}</span>
                                      </div>
                                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-white transition-colors">{mov.caseTitle}</h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{mov.description}</p>
                                   </div>
                                </div>
                              ))
                           ) : (
                              <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                                 <Scroll size={24} className="opacity-30 mb-2" />
                                 <p className="text-xs font-medium">Nenhuma movimentação recente.</p>
                              </div>
                           )}
                        </div>
                     </GlassCard>
                  </motion.div>
               )
             )}

             {config.chart && (
               (isLoading || !data) ? (<ChartSkeleton />) : (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                   <GlassCard className="h-[420px] p-6 flex flex-col">
                     <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6 shrink-0">
                         <Scale size={18} className="text-emerald-500 dark:text-emerald-400" /> Distribuição da Carteira
                     </h3>
                     {/* FIX: Ensure container has explicit height for Recharts */}
                     <div className="flex-1 w-full min-h-[300px] relative">
                       <div className="absolute inset-0">
                         <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={data.charts.caseDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                             <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" horizontal={false} />
                             <XAxis type="number" stroke="rgba(148, 163, 184, 0.5)" tick={{fill: '#94a3b8', fontSize: 11}} axisLine={false} />
                             <YAxis dataKey="name" type="category" stroke="rgba(148, 163, 184, 0.5)" tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} axisLine={false} width={100} />
                             <Tooltip cursor={{fill: 'rgba(148, 163, 184, 0.1)'}} contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px' }} itemStyle={{ color: '#e2e8f0' }} />
                             <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                               {data.charts.caseDistribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                             </Bar>
                           </BarChart>
                         </ResponsiveContainer>
                       </div>
                     </div>
                   </GlassCard>
                 </motion.div>
               )
             )}
          </div>

          <div className="flex flex-col gap-6">
             {config.hearings && (
               (isLoading || !data) ? (<ListSkeleton />) : (
                  <motion.div className="flex flex-col gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                      <GlassCard className="flex-1 overflow-hidden flex flex-col p-0 h-fit">
                        <div className="p-5 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                           <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                             <Calendar size={16} className="text-violet-500 dark:text-violet-400" /> Próximas Audiências
                           </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 max-h-[400px]">
                          {data.lists.upcomingHearings.length > 0 ? (
                            data.lists.upcomingHearings.map((c) => (
                              <div 
                                key={c.id} 
                                className="p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-violet-300 dark:hover:border-violet-500/30 hover:bg-violet-50 dark:hover:bg-white/10 transition-all group cursor-pointer shadow-sm" 
                                onClick={() => navigate(`/cases/${c.id}`)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && navigate(`/cases/${c.id}`)}
                              >
                                 <div className="flex justify-between items-start mb-1.5">
                                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-300 bg-violet-100 dark:bg-violet-500/20 px-2 py-0.5 rounded border border-violet-200 dark:border-violet-500/20 flex items-center gap-1">
                                        <Clock size={10} /> {c.nextHearing}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">{c.cnj.slice(0, 10)}...</span>
                                 </div>
                                 <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate mt-1 group-hover:text-indigo-700 dark:group-hover:text-white" title={c.title}>{c.title}</h4>
                                 <p className="text-xs text-slate-500 truncate">{c.client.name}</p>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-10 text-slate-500"><p className="text-sm">Nenhuma audiência marcada.</p></div>
                          )}
                        </div>
                        <div className="p-3 border-t border-slate-200 dark:border-white/5 text-center bg-slate-50 dark:bg-white/5">
                            <button onClick={() => navigate('/cases')} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">Ver agenda completa</button>
                        </div>
                      </GlassCard>
                  </motion.div>
               )
             )}

             {config.tasks && !isLoading && data && data.counts.highPriorityTasks > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                    <GlassCard className="h-fit p-5 border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-50 dark:from-rose-500/10 to-transparent">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-rose-600 dark:text-rose-200 flex items-center gap-2 text-sm">
                               <AlertCircle size={16} className="text-rose-500 animate-pulse"/> Ação Necessária
                            </h4>
                            <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">{data.counts.highPriorityTasks}</span>
                        </div>
                        <p className="text-xs text-rose-800 dark:text-slate-400 mb-4 leading-relaxed">Existem tarefas de alta prioridade pendentes que requerem sua atenção imediata.</p>
                        <button onClick={() => navigate('/crm')} className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs text-white font-bold transition-colors shadow-lg shadow-rose-500/20">
                            Resolver Pendências
                        </button>
                    </GlassCard>
                </motion.div>
             )}
          </div>
        </div>

        <Modal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} title="Personalizar Dashboard" footer={<div className="flex justify-end w-full"><button onClick={handleSaveConfig} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold">Salvar e Fechar</button></div>}>
           <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Escolha quais widgets você deseja visualizar no seu painel principal.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {[
                   { key: 'agenda', label: 'Agenda do Dia', desc: 'Visão rápida de hoje', icon: Calendar },
                   { key: 'kpi', label: 'Indicadores', desc: 'Cards de estatísticas', icon: Activity },
                   { key: 'movements', label: 'Movimentações', desc: 'Últimos andamentos', icon: FileText },
                   { key: 'chart', label: 'Gráficos', desc: 'Distribuição da carteira', icon: Scale },
                   { key: 'hearings', label: 'Audiências', desc: 'Lista de próximas audiências', icon: Gavel },
                   { key: 'tasks', label: 'Tarefas Urgentes', desc: 'Alertas de prioridade', icon: AlertCircle }
                 ].map((item) => (
                   <div key={item.key} onClick={() => toggleWidget(item.key as keyof DashboardConfig)} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${config[item.key as keyof DashboardConfig] ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-indigo-300'}`}>
                      <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-lg ${config[item.key as keyof DashboardConfig] ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'bg-slate-100 dark:bg-white/10 text-slate-500'}`}><item.icon size={18} /></div>
                         <div><p className={`text-sm font-bold ${config[item.key as keyof DashboardConfig] ? 'text-indigo-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{item.label}</p><p className="text-xs text-slate-500 dark:text-slate-500">{item.desc}</p></div>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${config[item.key as keyof DashboardConfig] ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{config[item.key as keyof DashboardConfig] && <div className="w-2 h-2 bg-white rounded-full" />}</div>
                   </div>
                 ))}
              </div>
           </div>
        </Modal>
      </div>
    </PageTransition>
  );
};
