
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { storageService } from '../services/storageService';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Gavel, CheckSquare, Clock } from 'lucide-react';
import { LegalCase, Task } from '../types';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'hearing' | 'task';
  status?: string;
  time?: string;
  description?: string;
}

export const CalendarView: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [cases, tasks] = await Promise.all([
        storageService.getCases(),
        storageService.getTasks()
      ]);

      const mappedEvents: CalendarEvent[] = [];

      // Map Hearings
      cases.forEach(c => {
        if (c.nextHearing) {
          // Convert DD/MM/YYYY to YYYY-MM-DD
          const [d, m, y] = c.nextHearing.split('/');
          if(d && m && y) {
             mappedEvents.push({
               id: c.id,
               date: `${y}-${m}-${d}`,
               title: `Audiência: ${c.title}`,
               type: 'hearing',
               status: c.status,
               description: `Processo: ${c.cnj} - Cliente: ${c.client.name}`
             });
          }
        }
      });

      // Map Tasks
      tasks.forEach(t => {
        if (t.dueDate && t.status !== 'Concluído') {
           const [d, m, y] = t.dueDate.split('/'); // Assumes standard pt-BR format stored
           if(d && m && y) {
             mappedEvents.push({
               id: t.id,
               date: `${y}-${m}-${d}`,
               title: `Prazo: ${t.title}`,
               type: 'task',
               status: t.status,
               description: `Prioridade: ${t.priority}`
             });
           }
        }
      });

      setEvents(mappedEvents);
      setLoading(false);
    };
    loadData();
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    const days = [];
    
    // Padding empty days
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 pb-10 h-[calc(100vh-140px)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
             <CalendarIcon size={32} className="text-indigo-500" /> Calendário
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Visualize audiências e prazos em uma linha do tempo mensal.</p>
        </div>
        
        <div className="flex items-center bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-1 shadow-sm">
           <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              <ChevronLeft size={20} />
           </button>
           <div className="px-4 font-bold text-slate-800 dark:text-white capitalize min-w-[140px] text-center">
              {monthName}
           </div>
           <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              <ChevronRight size={20} />
           </button>
           <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-2"></div>
           <button onClick={handleToday} className="px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
              Hoje
           </button>
        </div>
      </div>

      <GlassCard className="flex-1 p-0 overflow-hidden flex flex-col">
         {/* Weekday Headers */}
         <div className="grid grid-cols-7 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => (
               <div key={day} className={`py-3 text-center text-xs font-bold uppercase tracking-wider ${i === 0 || i === 6 ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                  {day}
               </div>
            ))}
         </div>

         {/* Grid */}
         <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-slate-200 dark:bg-[#0f172a] gap-px border-b border-slate-200 dark:border-white/5">
            {days.map((date, index) => {
               if (!date) return <div key={`empty-${index}`} className="bg-white dark:bg-[#1e293b]/50"></div>;
               
               const dateStr = date.toISOString().split('T')[0];
               const isToday = dateStr === todayStr;
               const dayEvents = events.filter(e => e.date === dateStr);

               return (
                  <div key={dateStr} className={`bg-white dark:bg-[#1e293b] p-2 min-h-[100px] relative group transition-colors hover:bg-slate-50 dark:hover:bg-[#1e293b]/80 ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                     <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}>
                        {date.getDate()}
                     </div>
                     
                     <div className="space-y-1.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                        {dayEvents.map((event) => (
                           <motion.div 
                              key={`${event.type}-${event.id}`}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={() => event.type === 'task' ? navigate('/crm') : navigate(`/cases/${event.id}`)}
                              className={`px-2 py-1 rounded text-[10px] font-medium truncate cursor-pointer border-l-2 shadow-sm transition-all hover:scale-[1.02] ${
                                 event.type === 'hearing' 
                                    ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-200 border-violet-500' 
                                    : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200 border-blue-500'
                              }`}
                              title={event.title + (event.description ? `\n${event.description}` : '')}
                           >
                              <div className="flex items-center gap-1">
                                 {event.type === 'hearing' ? <Gavel size={8} className="shrink-0" /> : <CheckSquare size={8} className="shrink-0" />}
                                 <span className="truncate">{event.title}</span>
                              </div>
                           </motion.div>
                        ))}
                     </div>
                  </div>
               );
            })}
         </div>
      </GlassCard>
    </div>
  );
};
