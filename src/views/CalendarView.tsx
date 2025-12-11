
import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { storageService } from '../services/storageService';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Gavel, CheckSquare, Clock, 
  Plus, Users, StickyNote, Bell, Briefcase, Loader2, Save, X, Search 
} from 'lucide-react';
import { LegalCase, Task, Priority, Client } from '../types';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ContextMenu, ContextMenuItem } from '../components/ui/ContextMenu';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'hearing' | 'task' | 'meeting' | 'note';
  status?: string;
  time?: string;
  description?: string;
  priority?: string;
}

type ActionType = 'task' | 'hearing' | 'meeting' | 'note' | 'reminder';

export const CalendarView: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Context Menu State
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Modal & Form State
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType>('task');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    time: '09:00',
    priority: Priority.MEDIUM,
    caseId: '',
    clientId: '',
    assignee: user?.name || 'Eu'
  });
  const [availableCases, setAvailableCases] = useState<LegalCase[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    const [cases, tasks, clients] = await Promise.all([
      storageService.getCases(),
      storageService.getTasks(),
      storageService.getClients()
    ]);

    setAvailableCases(cases);
    setAvailableClients(clients);

    const mappedEvents: CalendarEvent[] = [];

    // Map Hearings
    cases.forEach(c => {
      if (c.nextHearing) {
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

    // Map Tasks & Others
    tasks.forEach(t => {
      if (t.dueDate && t.status !== 'Concluído') {
         const parts = t.dueDate.split('/');
         let dateStr = '';
         if (parts.length === 3) {
             if (parts[0].length === 4) dateStr = t.dueDate; // Already ISO
             else dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
         }

         if(dateStr) {
           let type: CalendarEvent['type'] = 'task';
           if (t.title.startsWith('Reunião')) type = 'meeting';
           if (t.title.startsWith('Nota:')) type = 'note';

           mappedEvents.push({
             id: t.id,
             date: dateStr,
             title: t.title.replace('Nota:', '').trim(),
             type: type,
             status: t.status,
             priority: t.priority,
             description: t.description
           });
         }
      }
    });

    setEvents(mappedEvents);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleDayClick = (e: React.MouseEvent, date: Date) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setSelectedDate(date);
    setMenuOpen(true);
  };

  const openActionModal = (type: ActionType) => {
    setActionType(type);
    setFormData({
        title: '',
        description: '',
        time: '09:00',
        priority: Priority.MEDIUM,
        caseId: '',
        clientId: '',
        assignee: user?.name || 'Eu'
    });
    setIsActionModalOpen(true);
  };

  const handleSaveAction = async () => {
    if (!selectedDate || !formData.title) {
        addToast('Preencha o título da ação.', 'error');
        return;
    }
    setIsSaving(true);

    try {
        const dateStr = selectedDate.toLocaleDateString('pt-BR');
        
        if (actionType === 'hearing') {
            if (!formData.caseId) throw new Error('Selecione um processo para agendar audiência.');
            const kase = availableCases.find(c => c.id === formData.caseId);
            if (kase) {
                await storageService.saveCase({
                    ...kase,
                    nextHearing: dateStr
                });
                addToast('Audiência agendada no processo.', 'success');
            }
        } else {
            let finalTitle = formData.title;
            if (actionType === 'meeting') finalTitle = `Reunião: ${formData.title}`;
            if (actionType === 'note') finalTitle = `Nota: ${formData.title}`;
            if (actionType === 'reminder') finalTitle = `Lembrete: ${formData.title}`;

            const newTask: Task = {
                id: `task-${Date.now()}`,
                officeId: '', // Will be handled
                title: finalTitle,
                dueDate: dateStr,
                priority: formData.priority,
                status: 'A Fazer',
                assignedTo: formData.assignee,
                description: `${formData.description} \nHorário: ${formData.time}`,
                caseId: formData.caseId || undefined,
                caseTitle: availableCases.find(c => c.id === formData.caseId)?.title,
                clientId: formData.clientId || undefined,
                clientName: availableClients.find(c => c.id === formData.clientId)?.name
            };
            
            await storageService.saveTask(newTask);
            addToast(`${actionType === 'task' ? 'Tarefa' : 'Item'} adicionado com sucesso!`, 'success');
        }

        await loadData();
        setIsActionModalOpen(false);
    } catch (error: any) {
        addToast(error.message || 'Erro ao salvar.', 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const menuItems: ContextMenuItem[] = [
    { 
      label: 'Adicionar Tarefa', 
      icon: CheckSquare, 
      action: () => openActionModal('task'),
      description: 'Nova atividade ou prazo' 
    },
    { 
      label: 'Agendar Audiência', 
      icon: Gavel, 
      action: () => openActionModal('hearing'),
      description: 'Vincular a um processo' 
    },
    { 
      label: 'Marcar Reunião', 
      icon: Users, 
      action: () => openActionModal('meeting'),
      description: 'Com cliente ou equipe' 
    },
    { 
      label: 'Lembrete Rápido', 
      icon: Bell, 
      action: () => openActionModal('reminder') 
    },
    { 
      label: 'Anotação', 
      icon: StickyNote, 
      action: () => openActionModal('note'),
      variant: 'success'
    }
  ];

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 pb-10 h-[calc(100vh-140px)] flex flex-col" ref={containerRef}>
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
             <CalendarIcon size={32} className="text-indigo-500" /> Calendário Inteligente
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Clique em um dia para adicionar tarefas, audiências ou anotações.
          </p>
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

      <GlassCard className="flex-1 p-0 overflow-hidden flex flex-col shadow-lg">
         <div className="grid grid-cols-7 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => (
               <div key={day} className={`py-3 text-center text-xs font-bold uppercase tracking-wider ${i === 0 || i === 6 ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                  {day}
               </div>
            ))}
         </div>

         <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-slate-200 dark:bg-[#0f172a] gap-px border-b border-slate-200 dark:border-white/5">
            {days.map((date, index) => {
               if (!date) return <div key={`empty-${index}`} className="bg-white dark:bg-[#1e293b]/50"></div>;
               
               const dateStr = date.toISOString().split('T')[0];
               const isToday = dateStr === todayStr;
               const dayEvents = events.filter(e => e.date === dateStr);

               return (
                  <div 
                    key={dateStr} 
                    onClick={(e) => handleDayClick(e, date)}
                    className={`
                        bg-white dark:bg-[#1e293b] p-2 min-h-[100px] relative group transition-all duration-200 cursor-pointer
                        hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 hover:shadow-inner
                        ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}
                    `}
                  >
                     <div className="flex justify-between items-start mb-1">
                        <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}>
                            {date.getDate()}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity p-1 bg-white/10 rounded">
                            <Plus size={12} />
                        </div>
                     </div>
                     
                     <div className="space-y-1.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                        {dayEvents.map((event) => (
                           <motion.div 
                              key={`${event.type}-${event.id}`}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={(e) => {
                                  e.stopPropagation();
                                  event.type === 'hearing' ? navigate(`/cases/${event.id}`) : navigate('/crm');
                              }}
                              className={`px-2 py-1.5 rounded-md text-[10px] font-medium truncate cursor-pointer border-l-2 shadow-sm transition-transform hover:scale-[1.02] flex items-center gap-1.5
                                 ${event.type === 'hearing' 
                                    ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-200 border-violet-500' 
                                    : event.type === 'meeting'
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500'
                                    : event.type === 'note'
                                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-200 border-amber-500'
                                    : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200 border-blue-500'
                                 }
                              `}
                              title={`${event.title}\n${event.description || ''}`}
                           >
                                 {event.type === 'hearing' && <Gavel size={10} className="shrink-0" />}
                                 {event.type === 'task' && <CheckSquare size={10} className="shrink-0" />}
                                 {event.type === 'meeting' && <Users size={10} className="shrink-0" />}
                                 {event.type === 'note' && <StickyNote size={10} className="shrink-0" />}
                                 <span className="truncate">{event.title}</span>
                           </motion.div>
                        ))}
                     </div>
                  </div>
               );
            })}
         </div>
      </GlassCard>

      <ContextMenu 
        isOpen={menuOpen} 
        x={menuPos.x} 
        y={menuPos.y} 
        items={menuItems} 
        onClose={() => setMenuOpen(false)}
        title={selectedDate?.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
      />

      <Modal 
        isOpen={isActionModalOpen} 
        onClose={() => setIsActionModalOpen(false)} 
        title={
            actionType === 'task' ? 'Adicionar Tarefa' :
            actionType === 'hearing' ? 'Agendar Audiência' :
            actionType === 'meeting' ? 'Marcar Reunião' :
            actionType === 'note' ? 'Nova Anotação' : 'Novo Lembrete'
        }
        maxWidth="max-w-xl"
        footer={
            <div className="flex justify-end gap-3 w-full">
                <button onClick={() => setIsActionModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancelar</button>
                <button onClick={handleSaveAction} disabled={isSaving} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Salvar
                </button>
            </div>
        }
      >
         <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-indigo-400 bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                <CalendarIcon size={16} />
                <span className="font-bold">{selectedDate?.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>

            {actionType === 'hearing' && (
                <div className="space-y-1">
                    <label className="text-xs text-slate-400 uppercase font-bold">Vincular Processo <span className="text-rose-400">*</span></label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <select 
                            value={formData.caseId} 
                            onChange={e => setFormData({...formData, caseId: e.target.value, title: `Audiência - ${availableCases.find(c => c.id === e.target.value)?.cnj}`})}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 pl-10 text-white focus:border-indigo-500 outline-none"
                        >
                            <option value="">Selecione o processo...</option>
                            {availableCases.map(c => <option key={c.id} value={c.id}>{c.title} ({c.cnj})</option>)}
                        </select>
                    </div>
                </div>
            )}

            <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-bold">Título / Assunto <span className="text-rose-400">*</span></label>
                <input 
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none"
                    placeholder={actionType === 'note' ? 'Ex: Ideia sobre caso X' : 'Ex: Preparar Petição'}
                    autoFocus
                />
            </div>

            {['meeting', 'task'].includes(actionType) && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs text-slate-400 uppercase font-bold">Horário</label>
                        <input 
                            type="time" 
                            value={formData.time}
                            onChange={e => setFormData({...formData, time: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none scheme-dark"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-slate-400 uppercase font-bold">Cliente (Opcional)</label>
                        <select 
                            value={formData.clientId}
                            onChange={e => setFormData({...formData, clientId: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none"
                        >
                            <option value="">Nenhum</option>
                            {availableClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
            )}

            {actionType === 'task' && (
                <div className="space-y-1">
                    <label className="text-xs text-slate-400 uppercase font-bold">Prioridade</label>
                    <div className="flex gap-2">
                        {Object.values(Priority).map(p => (
                            <button 
                                key={p}
                                onClick={() => setFormData({...formData, priority: p})}
                                className={`flex-1 py-1.5 rounded text-xs font-bold uppercase transition-colors border ${formData.priority === p ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-transparent border-white/10 text-slate-500 hover:border-white/30'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-bold">Detalhes Adicionais</label>
                <textarea 
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none resize-none"
                    placeholder="Anotações extras..."
                ></textarea>
            </div>
         </div>
      </Modal>
    </div>
  );
};
