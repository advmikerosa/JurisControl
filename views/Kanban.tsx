
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Plus, MoreVertical, Calendar, Trash2, Loader2 } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { storageService } from '../services/storageService';
import { notificationService } from '../services/notificationService';
import { Task, Priority } from '../types';

interface ColumnProps {
  title: string;
  color: string;
  tasks: Task[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
}

const Column = ({ title, color, tasks, onAddTask, onEditTask }: ColumnProps) => {
  const [visibleCount, setVisibleCount] = useState(10);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Reinicia a contagem se a lista de tarefas mudar drasticamente (opcional, mas bom para UX)
  useEffect(() => {
    if (tasks.length < visibleCount) {
      setVisibleCount(10);
    }
  }, [tasks.length]);

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting) {
      setVisibleCount((prev) => Math.min(prev + 10, tasks.length));
    }
  }, [tasks.length]);

  useEffect(() => {
    const option = {
      root: null, // viewport
      rootMargin: "20px",
      threshold: 0
    };
    const observer = new IntersectionObserver(handleObserver, option);
    
    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
    
    return () => {
      if (loaderRef.current) observer.unobserve(loaderRef.current);
    }
  }, [handleObserver, visibleCount, tasks.length]);

  const displayedTasks = useMemo(() => tasks.slice(0, visibleCount), [tasks, visibleCount]);
  const hasMore = visibleCount < tasks.length;

  return (
    <div className="flex-1 min-w-[300px] flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 px-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`}></div>
          <h3 className="font-semibold text-slate-200">{title}</h3>
          <span className="bg-white/5 text-slate-400 text-xs px-2 py-0.5 rounded-full border border-white/5">{tasks.length}</span>
        </div>
        <button onClick={onAddTask} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"><Plus size={18} /></button>
      </div>
      
      <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pb-4 px-1">
        {displayedTasks.map(task => (
          <GlassCard 
            key={task.id} 
            className="p-4 cursor-pointer hover:border-indigo-500/40 group relative transition-all hover:-translate-y-1" 
            hoverEffect
          >
            <div className="absolute inset-0 z-10" onClick={() => onEditTask(task)}></div>
            <div className="flex justify-between items-start mb-2 relative z-20 pointer-events-none">
               <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                 task.priority === 'Alta' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                 task.priority === 'Média' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
               }`}>
                 {task.priority}
               </span>
               <button className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity pointer-events-auto">
                 <MoreVertical size={16} />
               </button>
            </div>
            <p className="text-sm font-bold text-slate-100 mb-3 leading-snug">{task.title}</p>
            
            <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-3">
               <div className="flex items-center gap-1.5 text-xs text-slate-400">
                 <Calendar size={12} />
                 <span>{task.dueDate}</span>
               </div>
               <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold border-2 border-slate-800 shadow-md">
                 {task.assignedTo.split(' ').map(n => n[0]).join('').substring(0,2)}
               </div>
            </div>
          </GlassCard>
        ))}
        
        {hasMore && (
          <div ref={loaderRef} className="py-4 flex justify-center w-full">
             <div className="flex items-center gap-2 text-xs text-slate-500">
               <Loader2 size={14} className="animate-spin" /> Carregando mais...
             </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div className="h-32 border-2 border-dashed border-white/5 rounded-xl flex items-center justify-center text-slate-600 text-sm bg-white/5">
            Sem tarefas
          </div>
        )}
      </div>
    </div>
  );
};

export const Kanban: React.FC = () => {
  const { addToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    dueDate: string;
    priority: Priority;
    status: Task['status'];
    description: string;
    assignedTo: string;
  }>({
    title: '',
    dueDate: '',
    priority: Priority.MEDIUM,
    status: 'A Fazer',
    description: '',
    assignedTo: 'Eu'
  });

  useEffect(() => {
    setTasks(storageService.getTasks());
  }, []);

  const updateTasks = () => {
    setTasks(storageService.getTasks());
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    
    const taskToSave: Task = {
      id: editingTask ? editingTask.id : `task-${Date.now()}`,
      title: formData.title,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      priority: formData.priority,
      status: formData.status,
      description: formData.description,
      assignedTo: formData.assignedTo
    };

    storageService.saveTask(taskToSave);
    updateTasks();
    addToast(editingTask ? 'Tarefa atualizada' : 'Nova tarefa criada', 'success');
    
    // Notify if new
    if (!editingTask) {
      notificationService.notify('Nova Tarefa', `Tarefa "${taskToSave.title}" adicionada ao board.`);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleDeleteTask = () => {
    if (editingTask && confirm('Tem certeza que deseja excluir esta tarefa?')) {
      storageService.deleteTask(editingTask.id);
      updateTasks();
      addToast('Tarefa excluída', 'info');
      setIsModalOpen(false);
    }
  };

  const resetForm = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      dueDate: '',
      priority: Priority.MEDIUM,
      status: 'A Fazer',
      description: '',
      assignedTo: 'Eu'
    });
  };

  const openNewTask = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    // Converte data pt-BR dd/mm/yyyy para yyyy-mm-dd para input date
    const [day, month, year] = task.dueDate.split('/');
    const dateValue = year && month && day ? `${year}-${month}-${day}` : '';

    setFormData({
      title: task.title,
      dueDate: dateValue,
      priority: task.priority,
      status: task.status,
      description: task.description || '',
      assignedTo: task.assignedTo
    });
    setIsModalOpen(true);
  };

  const todo = tasks.filter(t => t.status === 'A Fazer');
  const inProgress = tasks.filter(t => t.status === 'Em Andamento');
  const done = tasks.filter(t => t.status === 'Concluído');

  return (
    <div className="h-full flex flex-col space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Pipeline CRM</h1>
          <p className="text-slate-400 mt-1">Visualize o fluxo de trabalho e gerencie tarefas.</p>
        </div>
        <button 
          onClick={openNewTask} 
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20 hover:scale-105 w-full md:w-auto"
        >
          <Plus size={18} /> 
          <span>Nova Tarefa</span>
        </button>
      </div>
      
      {/* BOARD */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-6 pb-6 h-full min-h-[500px]">
          <Column title="A Fazer" color="bg-slate-400" tasks={todo} onAddTask={openNewTask} onEditTask={openEditTask} />
          <Column title="Em Andamento" color="bg-indigo-400" tasks={inProgress} onAddTask={openNewTask} onEditTask={openEditTask} />
          <Column title="Concluído" color="bg-emerald-400" tasks={done} onAddTask={openNewTask} onEditTask={openEditTask} />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTask ? "Editar Tarefa" : "Nova Tarefa"}
        footer={
          <div className="flex justify-between w-full">
             <div>
               {editingTask && (
                 <button type="button" onClick={handleDeleteTask} className="px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-2">
                   <Trash2 size={16} />
                 </button>
               )}
             </div>
             <div className="flex gap-2">
               <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Cancelar</button>
               <button onClick={handleSaveTask} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-lg shadow-indigo-500/20">Salvar</button>
             </div>
          </div>
        }
      >
        <form className="space-y-4">
           <div className="space-y-1">
              <label className="text-xs text-slate-400">Título</label>
              <input 
                type="text" 
                value={formData.title} 
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-slate-200 focus:border-indigo-500 focus:outline-none" 
                autoFocus 
              />
           </div>
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
                <label className="text-xs text-slate-400">Prazo</label>
                <input 
                  type="date" 
                  value={formData.dueDate} 
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-slate-200 focus:border-indigo-500 focus:outline-none scheme-dark" 
                />
             </div>
             <div className="space-y-1">
                <label className="text-xs text-slate-400">Prioridade</label>
                <select 
                  value={formData.priority} 
                  onChange={(e) => setFormData({...formData, priority: e.target.value as Priority})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-slate-200 focus:border-indigo-500 focus:outline-none scheme-dark"
                >
                   <option className="bg-slate-800" value={Priority.LOW}>Baixa</option>
                   <option className="bg-slate-800" value={Priority.MEDIUM}>Média</option>
                   <option className="bg-slate-800" value={Priority.HIGH}>Alta</option>
                </select>
             </div>
           </div>
           <div className="space-y-1">
              <label className="text-xs text-slate-400">Status</label>
              <select 
                value={formData.status} 
                onChange={(e) => setFormData({...formData, status: e.target.value as Task['status']})}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-slate-200 focus:border-indigo-500 focus:outline-none scheme-dark"
              >
                 <option className="bg-slate-800" value="A Fazer">A Fazer</option>
                 <option className="bg-slate-800" value="Em Andamento">Em Andamento</option>
                 <option className="bg-slate-800" value="Concluído">Concluído</option>
              </select>
           </div>
           <div className="space-y-1">
              <label className="text-xs text-slate-400">Descrição</label>
              <textarea 
                rows={3} 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-slate-200 focus:border-indigo-500 focus:outline-none resize-none"
              ></textarea>
           </div>
        </form>
      </Modal>
    </div>
  );
};
