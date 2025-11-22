
import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Scale, Clock, AlertCircle, CheckCircle, Calendar, Briefcase, Gavel, Plus, ArrowRight, CheckSquare } from 'lucide-react';
import { storageService } from '../services/storageService';
import { useNavigate } from 'react-router-dom';
import { LegalCase, Task } from '../types';

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

const StatWidget = ({ title, value, subtext, icon: Icon, colorClass, onClick }: any) => (
  <GlassCard hoverEffect onClick={onClick} className={onClick ? "cursor-pointer" : ""}>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-white/5 border border-white/10 ${colorClass}`}>
        <Icon size={24} />
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2">
      <span className="text-slate-500 text-xs bg-white/5 px-2 py-1 rounded-md border border-white/5">
        {subtext}
      </span>
    </div>
  </GlassCard>
);

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const loadData = async () => {
      // Simula delay de rede para UX
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setCases(storageService.getCases());
      setTasks(storageService.getTasks());
      setIsLoading(false);
    };

    loadData();
  }, []);

  // Métricas Processuais
  const activeCases = cases.filter(c => c.status === 'Ativo').length;
  const wonCases = cases.filter(c => c.status === 'Ganho').length;
  const hearings = cases.filter(c => !!c.nextHearing).length;
  
  // Métricas de Tarefas
  const highPriorityTasks = tasks.filter(t => t.priority === 'Alta' && t.status !== 'Concluído').length;

  // Dados para o Gráfico (Distribuição de Status)
  const caseDistribution = [
    { name: 'Ativos', value: activeCases, color: '#818cf8' },
    { name: 'Pendentes', value: cases.filter(c => c.status === 'Pendente').length, color: '#fbbf24' },
    { name: 'Ganhos', value: wonCases, color: '#34d399' },
    { name: 'Arquivados', value: cases.filter(c => c.status === 'Arquivado').length, color: '#94a3b8' },
  ];

  // Próximas Audiências (Ordenadas)
  const upcomingHearings = cases
    .filter(c => c.nextHearing)
    .sort((a, b) => {
        if (!a.nextHearing || !b.nextHearing) return 0;
        // Assume dd/mm/yyyy format for sorting
        const [dA, mA, yA] = a.nextHearing.split('/').map(Number);
        const [dB, mB, yB] = b.nextHearing.split('/').map(Number);
        return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
    })
    .slice(0, 4);

  // Agenda do Dia (Tarefas e Audiências HOJE)
  const todayStr = new Date().toLocaleDateString('pt-BR');
  const todaysAgenda = [
      ...tasks.filter(t => t.dueDate === todayStr && t.status !== 'Concluído').map(t => ({ type: 'task', title: t.title, sub: 'Prazo Fatal', id: t.id })),
      ...cases.filter(c => c.nextHearing === todayStr).map(c => ({ type: 'hearing', title: c.title, sub: 'Audiência', id: c.id }))
  ];

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Controle Processual</h1>
          <p className="text-slate-400 mt-1">Visão geral da carteira de processos e prazos.</p>
        </div>
        <button 
          onClick={() => navigate('/cases?action=new')}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 w-full md:w-auto"
        >
          <Plus size={18} />
          <span>Novo Processo</span>
        </button>
      </div>

      {/* AGENDA DO DIA (NOVO WIDGET) */}
      {!isLoading && todaysAgenda.length > 0 && (
         <div className="bg-gradient-to-r from-indigo-900/40 to-slate-900/40 border border-indigo-500/20 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-3 flex items-center gap-2">
               <Calendar size={16} /> Agenda de Hoje ({todayStr})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {todaysAgenda.map((item, idx) => (
                  <div key={idx} className="bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-3 flex items-center gap-3 border border-white/5 cursor-pointer" onClick={() => item.type === 'task' ? navigate('/crm') : navigate('/cases')}>
                      <div className={`p-2 rounded-lg ${item.type === 'task' ? 'bg-rose-500/20 text-rose-400' : 'bg-purple-500/20 text-purple-400'}`}>
                         {item.type === 'task' ? <AlertCircle size={18} /> : <Gavel size={18} />}
                      </div>
                      <div className="min-w-0">
                         <p className="text-white font-medium text-sm truncate">{item.title}</p>
                         <p className="text-xs text-slate-400">{item.sub}</p>
                      </div>
                  </div>
               ))}
            </div>
         </div>
      )}

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
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
              value={activeCases} 
              subtext={`${cases.length} total na base`} 
              icon={Briefcase} 
              colorClass="text-indigo-400" 
              onClick={() => navigate('/cases')}
            />
            <StatWidget 
              title="Próx. Audiências" 
              value={hearings} 
              subtext="Agendadas no sistema" 
              icon={Gavel} 
              colorClass="text-purple-400" 
            />
            <StatWidget 
              title="Prazos Urgentes" 
              value={highPriorityTasks} 
              subtext="Tarefas de alta prioridade" 
              icon={AlertCircle} 
              colorClass="text-rose-400" 
              onClick={() => navigate('/crm')}
            />
            <StatWidget 
              title="Processos Ganhos" 
              value={wonCases} 
              subtext="Sucesso acumulado" 
              icon={CheckCircle} 
              colorClass="text-emerald-400" 
            />
          </>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CHART: Carteira de Processos */}
        {isLoading ? (
          <div className="lg:col-span-2"><ChartSkeleton /></div>
        ) : (
          <GlassCard className="lg:col-span-2 min-h-[400px] p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Scale size={20} className="text-indigo-400" />
                    Saúde da Carteira
                </h3>
                <button onClick={() => navigate('/cases')} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    Ver todos <ArrowRight size={12} />
                </button>
            </div>
            <ResponsiveContainer width="100%" height="100%" className="flex-1">
              <BarChart data={caseDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 500}} axisLine={false} width={80} />
                <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }} 
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                  {caseDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        )}

        {/* LIST: Próximas Audiências / Prazos */}
        {isLoading ? (
          <ListSkeleton />
        ) : (
          <div className="flex flex-col gap-6">
              <GlassCard className="flex-1 overflow-hidden flex flex-col p-0">
                <div className="p-5 border-b border-white/5 bg-white/5">
                   <h3 className="text-base font-semibold text-white flex items-center gap-2">
                     <Calendar size={18} className="text-purple-400" />
                     Próximas Audiências
                   </h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                  {upcomingHearings.length > 0 ? (
                    upcomingHearings.map((c) => (
                      <div key={c.id} className="p-3 rounded-xl bg-slate-800/50 border border-white/5 hover:border-purple-500/30 transition-all group cursor-pointer" onClick={() => navigate(`/cases/${c.id}`)}>
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
                <div className="p-3 border-t border-white/5 text-center">
                    <button onClick={() => navigate('/cases')} className="text-xs text-slate-400 hover:text-white transition-colors">Ver agenda completa</button>
                </div>
              </GlassCard>

              {/* Mini Widget para Tarefas Urgentes */}
              {highPriorityTasks > 0 && (
                  <GlassCard className="h-fit p-5 border-l-4 border-l-rose-500 bg-rose-500/5">
                      <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold text-white flex items-center gap-2">
                             <AlertCircle size={16} className="text-rose-400"/> Atenção
                          </h4>
                          <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-bold">{highPriorityTasks}</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">Tarefas de alta prioridade pendentes.</p>
                      <button onClick={() => navigate('/crm')} className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition-colors">
                          Resolver Pendências
                      </button>
                  </GlassCard>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
