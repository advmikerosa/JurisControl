
import React, { useEffect, useState, useMemo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Scale, Clock, AlertCircle, CheckCircle, Calendar, Briefcase, Gavel, Plus, ArrowRight, Activity, FileText, Scroll, ExternalLink } from 'lucide-react';
import { storageService } from '../services/storageService';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../types';
import { PageTransition } from '../components/PageTransition';
import { motion } from 'framer-motion';

// Skeleton Components
const StatSkeleton = () => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse h-[140px]">
    <div className="h-4 w-24 bg-white/10 rounded mb-4"></div>
    <div className="h-8 w-16 bg-white/10 rounded mb-4"></div>
    <div className="h-3 w-32 bg-white/10 rounded"></div>
  </div>
);

const ChartSkeleton = () => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse h-[420px] flex flex-col">
    <div className="h-6 w-48 bg-white/10 rounded mb-8"></div>
    <div className="flex-1 bg-white/5 rounded border border-white/5"></div>
  </div>
);

const ListSkeleton = () => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-0 animate-pulse h-[420px] overflow-hidden">
    <div className="p-6 border-b border-white/5">
      <div className="h-6 w-32 bg-white/10 rounded"></div>
    </div>
    <div className="p-6 space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-16 bg-white/5 rounded-xl"></div>
      ))}
    </div>
  </div>
);

const StatWidget = React.memo(({ title, value, subtext, icon: Icon, colorClass, onClick, delay, highlight }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }} 
    animate={{ opacity: 1, y: 0 }} 
    transition={{ duration: 0.5, delay: delay }}
  >
    <GlassCard hoverEffect onClick={onClick} className={onClick ? "cursor-pointer h-full relative overflow-hidden group" : "h-full relative overflow-hidden"}>
      {highlight && <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/20 blur-2xl -mr-10 -mt-10 rounded-full animate-pulse"></div>}
      
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <h3 className={`text-3xl font-bold tracking-tight ${highlight ? 'text-rose-400' : 'text-white'}`}>{value}</h3>
        </div>
        <div className={`p-3 rounded-xl border ${highlight ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : `bg-white/5 border-white/10 ${colorClass}`}`}>
          <Icon size={24} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-slate-500 text-xs bg-white/5 px-2 py-1 rounded-md border border-white/5 font-medium">
          {subtext}
        </span>
        {onClick && <ArrowRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors transform group-hover:translate-x-1" />}
      </div>
    </GlassCard>
  </motion.div>
));

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const summary = await storageService.getDashboardSummary();
        if (isMounted) {
          setData(summary);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to load dashboard data", error);
        if (isMounted) setIsLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, []);

  const todayStr = useMemo(() => new Date().toLocaleDateString('pt-BR'), []);

  return (
    <PageTransition>
      <div className="space-y-8 pb-12">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Controle Processual</h1>
            <p className="text-slate-400 mt-1">Visão geral da carteira de processos, prazos e movimentações.</p>
          </div>
          <button 
            onClick={() => navigate('/cases?action=new')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 w-full md:w-auto"
          >
            <Plus size={18} />
            <span>Novo Processo</span>
          </button>
        </div>

        {/* AGENDA DO DIA (Alta Visibilidade) */}
        {!isLoading && data?.lists.todaysAgenda && data.lists.todaysAgenda.length > 0 && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }} 
             animate={{ opacity: 1, scale: 1 }} 
             className="bg-gradient-to-r from-indigo-900/40 to-slate-900/40 border border-indigo-500/30 rounded-2xl p-5 backdrop-blur-sm shadow-xl"
           >
              <div className="flex items-center justify-between mb-3">
                 <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={16} /> Agenda de Hoje ({todayStr})
                 </h3>
                 <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">{data.lists.todaysAgenda.length} Itens</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {data.lists.todaysAgenda.map((item, idx) => (
                    <div key={idx} className="bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-3 flex items-center gap-3 border border-white/5 cursor-pointer group" onClick={() => item.type === 'task' ? navigate('/crm') : navigate(`/cases/${item.id}`)}>
                        <div className={`p-2 rounded-lg ${item.type === 'task' ? 'bg-rose-500/20 text-rose-400' : 'bg-purple-500/20 text-purple-400'} group-hover:scale-110 transition-transform shadow-lg`}>
                           {item.type === 'task' ? <AlertCircle size={18} /> : <Gavel size={18} />}
                        </div>
                        <div className="min-w-0">
                           <p className="text-white font-medium text-sm truncate">{item.title}</p>
                           <p className="text-xs text-slate-400">{item.sub}</p>
                        </div>
                        <ExternalLink size={12} className="ml-auto text-slate-600 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                 ))}
              </div>
           </motion.div>
        )}

        {/* KPI GRID (Foco Operacional) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading || !data ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatWidget 
                title="Processos Ativos" 
                value={data.counts.activeCases} 
                subtext="Em andamento" 
                icon={Briefcase} 
                colorClass="text-indigo-400" 
                onClick={() => navigate('/cases?status=Ativo')}
                delay={0.1}
              />
              <StatWidget 
                title="Próx. Audiências" 
                value={data.counts.hearings} 
                subtext="Agendadas" 
                icon={Gavel} 
                colorClass="text-purple-400" 
                delay={0.2}
              />
              <StatWidget 
                title="Prazos Urgentes" 
                value={data.counts.highPriorityTasks} 
                subtext="Alta prioridade" 
                icon={AlertCircle} 
                colorClass="text-rose-400" 
                onClick={() => navigate('/crm')}
                delay={0.3}
                highlight={data.counts.highPriorityTasks > 0}
              />
              <StatWidget 
                title="Processos Ganhos" 
                value={data.counts.wonCases} 
                subtext="Total acumulado" 
                icon={CheckCircle} 
                colorClass="text-emerald-400" 
                delay={0.4}
                onClick={() => navigate('/cases?status=Ganho')}
              />
            </>
          )}
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMN 1: CHART + MOVEMENTS */}
          <div className="lg:col-span-2 space-y-6">
             {/* Recent Movements Feed */}
             {isLoading || !data ? (
                <ListSkeleton />
             ) : (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                   <GlassCard className="flex flex-col h-full min-h-[400px]">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                           <Activity size={20} className="text-indigo-400" />
                           Últimas Movimentações
                        </h3>
                        <button onClick={() => navigate('/cases')} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Ver todos</button>
                      </div>
                      
                      <div className="flex-1 space-y-0">
                         {data.lists.recentMovements && data.lists.recentMovements.length > 0 ? (
                            data.lists.recentMovements.map((mov, i) => (
                              <div key={i} className="flex gap-4 p-4 border-b border-white/5 hover:bg-white/5 transition-colors rounded-xl cursor-pointer" onClick={() => navigate(`/cases/${mov.caseId}`)}>
                                 <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-indigo-400 shrink-0">
                                       {mov.type === 'Despacho' ? <Gavel size={14} /> : mov.type === 'Audiência' ? <Clock size={14} /> : <FileText size={14} />}
                                    </div>
                                    {i < data.lists.recentMovements.length - 1 && <div className="w-px h-full bg-white/10 my-1"></div>}
                                 </div>
                                 <div className="flex-1 pb-2">
                                    <div className="flex justify-between items-start">
                                       <span className="text-xs font-bold text-slate-400 uppercase">{mov.type}</span>
                                       <span className="text-[10px] text-slate-500">{mov.date}</span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-white mt-1">{mov.caseTitle}</h4>
                                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{mov.description}</p>
                                 </div>
                              </div>
                            ))
                         ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                               <Scroll size={32} className="opacity-20 mb-2" />
                               <p className="text-sm">Nenhuma movimentação recente.</p>
                            </div>
                         )}
                      </div>
                   </GlassCard>
                </motion.div>
             )}

             {/* Chart: Portfolio Health */}
             {isLoading || !data ? (
               <ChartSkeleton />
             ) : (
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                 <GlassCard className="h-[350px] p-6 flex flex-col">
                   <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4 shrink-0">
                       <Scale size={16} className="text-indigo-400" />
                       Distribuição da Carteira
                   </h3>
                   {/* FIX: Use relative positioning with absolute inset for ResponsiveContainer to fix width(-1) issues */}
                   <div className="flex-1 w-full min-h-0 relative">
                     <div className="absolute inset-0">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={data.charts.caseDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                           <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 10}} axisLine={false} />
                           <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 500}} axisLine={false} width={80} />
                           <Tooltip 
                               cursor={{fill: 'rgba(255,255,255,0.05)'}}
                               contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} 
                           />
                           <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                             {data.charts.caseDistribution.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.color} />
                             ))}
                           </Bar>
                         </BarChart>
                       </ResponsiveContainer>
                     </div>
                   </div>
                 </GlassCard>
               </motion.div>
             )}
          </div>

          {/* COLUMN 2: LISTS */}
          <div className="flex flex-col gap-6">
             {isLoading || !data ? (
                <ListSkeleton />
             ) : (
                <motion.div className="flex flex-col gap-6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
                    <GlassCard className="flex-1 overflow-hidden flex flex-col p-0 h-fit">
                      <div className="p-5 border-b border-white/5 bg-white/5">
                         <h3 className="text-base font-semibold text-white flex items-center gap-2">
                           <Calendar size={18} className="text-purple-400" />
                           Próximas Audiências
                         </h3>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 max-h-[400px]">
                        {data.lists.upcomingHearings.length > 0 ? (
                          data.lists.upcomingHearings.map((c) => (
                            <div key={c.id} className="p-3 rounded-xl bg-slate-800/50 border border-white/5 hover:border-purple-500/30 transition-all group cursor-pointer hover:bg-white/5" onClick={() => navigate(`/cases/${c.id}`)}>
                               <div className="flex justify-between items-start mb-1">
                                  <span className="text-xs font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <Clock size={10} /> {c.nextHearing}
                                  </span>
                                  <span className="text-[10px] text-slate-500 group-hover:text-slate-300 font-mono">{c.cnj.slice(0, 10)}...</span>
                               </div>
                               <h4 className="text-sm font-medium text-slate-200 truncate mt-2" title={c.title}>{c.title}</h4>
                               <p className="text-xs text-slate-500 truncate mt-0.5">{c.client.name}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10 text-slate-500">
                              <p className="text-sm">Nenhuma audiência marcada.</p>
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-white/5 text-center bg-white/5">
                          <button onClick={() => navigate('/cases')} className="text-xs text-slate-400 hover:text-white transition-colors font-medium">Ver agenda completa</button>
                      </div>
                    </GlassCard>

                    {data.counts.highPriorityTasks > 0 && (
                        <GlassCard className="h-fit p-5 border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-500/10 to-transparent hover:from-rose-500/20 transition-colors shadow-lg shadow-rose-900/10">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold text-white flex items-center gap-2">
                                   <AlertCircle size={16} className="text-rose-400 animate-pulse"/> Ação Necessária
                                </h4>
                                <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold shadow-lg shadow-rose-500/30">{data.counts.highPriorityTasks}</span>
                            </div>
                            <p className="text-xs text-slate-300 mb-4 leading-relaxed">Existem tarefas de alta prioridade pendentes que requerem sua atenção imediata.</p>
                            <button onClick={() => navigate('/crm')} className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs text-white font-bold transition-colors shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2">
                                <CheckCircle size={14} /> Resolver Pendências
                            </button>
                        </GlassCard>
                    )}
                </motion.div>
             )}
          </div>

        </div>
      </div>
    </PageTransition>
  );
};
