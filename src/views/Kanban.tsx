import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Plus, MoreVertical, Calendar, Trash2, Loader2, Briefcase, AlignLeft, Flag, CheckCircle2, User, Link as LinkIcon, Search, GripVertical, X, ArrowRight } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { storageService } from '../services/storageService';
import { notificationService } from '../services/notificationService';
import { Task, Priority, LegalCase, Client, CaseStatus } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface ColumnProps {
  title: string;
  statusKey: Task['status'];
  color: string;
  tasks: Task[];
  availableCases: LegalCase[];
  onAddTask: (status: Task['status']) => void;
  onEditTask: (task: Task) => void;
  onDropTask: (taskId: string, newStatus: Task['status']) => void;
  onQuickAdd: (title: string, status: Task['status']) => Promise<void>;
}

const Column = ({ title, statusKey, color, tasks, availableCases, onAddTask, onEditTask, onDropTask, onQuickAdd }: ColumnProps) => {
  const [visibleCount, setVisibleCount] = useState(10);
  const [isOver, setIsOver] = useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const loaderRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
    const option = { root: null, rootMargin: "20px", threshold: 0 };
    const observer = new IntersectionObserver(handleObserver, option);
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => { if (loaderRef.current) observer.unobserve(loaderRef.current); }
  }, [handleObserver, visibleCount, tasks.length]);

  const displayedTasks = useMemo(() => tasks.slice(0, visibleCount), [tasks, visibleCount]);
  const hasMore = visibleCount < tasks.length;

  const getCaseTitle = (caseId?: string) => {
    if (!caseId) return null;
    return availableCases.find(c => c.id === caseId)?.title;
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      onDropTask(taskId, statusKey);
    }
  };

  const submitQuickAdd = async () => {
    if (quickTitle.trim()) {
      await onQuickAdd(quickTitle, statusKey);
      setQuickTitle('');
      // Keep input open for multiple adds
      setTimeout(() => {
         listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitQuickAdd();
    }
    if (e.key === 'Escape') {
      setIsQuickAdding(false);
    }
  };

  return (
    <div 
      className={`flex-1 min-w-[320px] flex flex-col h-full rounded-2xl transition-all duration-300 border ${
        isOver 
          ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xl scale-[1.01]' 
          : 'bg-slate-100 dark:bg-slate-900/20 border-slate-200 dark:border-white/5'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className={`flex justify-between items-center mb-2 px-4 pt-4 shrink-0 ${isOver ? 'text-indigo-600 dark:text-indigo-300' : ''}`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color} shadow-sm`}></div>
          <h3 className="font-bold text-slate-700 dark:text-slate-200 tracking-wide">{title}</h3>
          <span className="bg-white dark:bg-white/10 text-slate-500 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/5 font-mono font-bold">
            {tasks.length}
          </span>
        </div>
        <div className="flex gap-1">
           <button 
             onClick={() => setIsQuickAdding(!isQuickAdding)} 
             className={`p-1.5 rounded-lg transition-colors ${isQuickAdding ? 'bg-indigo-200 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-200' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'}`}
             title="Adição Rápida"
           >
             <Plus size={18} />
           </button>
        </div>
      </div>
      
      {/* Quick Add Input Area */}
      <AnimatePresence>
        {isQuickAdding && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-2 overflow-hidden"
          >
             <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-indigo-300 dark:border-indigo-500/50 shadow-lg">
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Título da tarefa..." 
                  className="w-full bg-transparent text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none mb-2"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="flex justify-between items-center">
                   <span className="text-[10px] text-slate-400">Enter para salvar</span>
                   <div className="flex gap-2">
                      <button onClick={() => setIsQuickAdding(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-400"><X size={14}/></button>
                      <button onClick={submitQuickAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1">Add <ArrowRight size={10}/></button>
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tasks List */}
      <div ref={listRef} className="space-y-3 flex-1 overflow-y-auto custom-scrollbar p-3 min-h-[100px]">
        <AnimatePresence mode="popLayout">
          {displayedTasks.map(task => {
            const linkedCaseTitle = getCaseTitle(task.caseId);
            return (
              <motion.div
                key={task.id}
                layoutId={task.id}
                layout="position"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                draggable
                onDragStart={(e) => {
                  const event = e as unknown as React.DragEvent<HTMLDivElement>;
                  event.dataTransfer.setData("text/plain", task.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                className="cursor-grab active:cursor-grabbing group touch-manipulation"
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98 }}
              >
                <GlassCard 
                  className="p-4 hover:border-indigo-500/40 relative hover:shadow-lg dark:hover:shadow-indigo-500/10 transition-all bg-white dark:bg-[#1e293b]" 
                  hoverEffect
                  onClick={() => onEditTask(task)}
                >
                  <div className="absolute top-3 left-2 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                      <GripVertical size={14} />
                  </div>

                  <div className="flex justify-between items-start mb-2 pl-4">
                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                       task.priority === 'Alta' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20' : 
                       task.priority === 'Média' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' : 
                       'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                     }`}>
                       {task.priority}
                     </span>
                     <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10">
                       <MoreVertical size={14} />
                     </button>
                  </div>

                  <div className="pl-1">
                      {linkedCaseTitle ? (
                        <div className="mb-2 flex items-center gap-1.5 text-[10px] text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded w-fit max-w-full border border-indigo-100 dark:border-transparent">
                           <Briefcase size={10} className="shrink-0" />
                           <span className="truncate">{linkedCaseTitle}</span>
                        </div>
                      ) : task.clientName ? (
                        <div className="mb-2 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded w-fit max-w-full border border-emerald-100 dark:border-transparent">
                           <User size={10} className="shrink-0" />
                           <span className="truncate">{task.clientName}</span>
                        </div>
                      ) : null}

                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 leading-snug line-clamp-2">{task.title}</p>
                      
                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-3 mt-1">
                         <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                           <Calendar size={12} />
                           <span className={new Date(task.dueDate.split('/').reverse().join('-')) < new Date() && task.status !== 'Concluído' ? 'text-rose-500 dark:text-rose-400 font-bold' : ''}>
                             {task.dueDate}
                           </span>
                         </div>
                         <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-[#1e293b] shadow-sm text-white" title={task.assignedTo}>
                           {task.assignedTo.substring(0,2).toUpperCase()}
                         </div>
                      </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {hasMore && (
          <div ref={loaderRef} className="py-4 flex justify-center w-full">
             <div className="flex items-center gap-2 text-xs text-slate-400">
               <Loader2 size={14} className="animate-spin" /> Carregando mais...
             </div>
          </div>
        )}

        {tasks.length === 0 && !isQuickAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-32 border-2 border-dashed border-slate-300 dark:border-white/5 rounded-xl flex flex-col items-center justify-center text-slate-500 dark:text-slate-600 text-sm bg-slate-50 dark:bg-white/5 gap-2 group hover:border-indigo-400 dark:hover:border-white/10 transition-colors cursor-pointer" 
            onClick={() => onAddTask(statusKey)}
          >
            <Plus size={24} className="opacity-50 group-hover:scale-110 transition-transform text-indigo-500 dark:text-white" />
            <span className="group-hover:text-indigo-600 dark:group-hover:text-white">Adicionar Tarefa</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export const Kanban: React.FC = () => {
  const { addToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [availableCases, setAvailableCases] = useState<LegalCase[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  
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
    linkType: 'none' | 'case' | 'client';
    creationMode: 'existing' | 'new';
    selectedCaseId: string;
    selectedClientId: string;
    newEntityName: string;
    newEntityAux: string;
  }>({
    title: '',
    dueDate: '',
    priority: Priority.MEDIUM,
    status: 'A Fazer',
    description: '',
    assignedTo: 'Eu',
    linkType: 'none',
    creationMode: 'existing',
    selectedCaseId: '',
    selectedClientId: '',
    newEntityName: '',
    newEntityAux: ''
  });

  useEffect(() => {
    const loadData = async () => {
      const [loadedTasks, loadedCases, loadedClients] = await Promise.all([
        storageService.getTasks(),
        storageService.getCases(),
        storageService.getClients()
      ]);
      setTasks(loadedTasks || []);
      setAvailableCases(loadedCases || []);
      setAvailableClients(loadedClients || []);
    };
    loadData();
  }, []);

  const updateData = async () => {
    setTasks(await storageService.getTasks() || []);
    setAvailableCases(await storageService.getCases() || []);
    setAvailableClients(await storageService.getClients() || []);
  };

  const handleTaskDrop = async (taskId: string, newStatus: Task['status']) => {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    
    const task = tasks[taskIndex];
    if (task.status === newStatus) return;

    // Optimistic Update
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = { ...task, status: newStatus };
    setTasks(updatedTasks);

    try {
      const taskToSave = { ...task, status: newStatus };
      await storageService.saveTask(taskToSave);
      // No notification toast to keep it snappy, maybe a subtle sound in future
    } catch (error) {
      console.error("Failed to update task status", error);
      addToast("Erro ao mover tarefa", "error");
      updateData(); // Revert on error
    }
  };

  const handleQuickAdd = async (title: string, status: Task['status']) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      officeId: '', // Will be set by storageService
      title,
      dueDate: new Date().toLocaleDateString('pt-BR'),
      priority: Priority.MEDIUM,
      status,
      assignedTo: 'Eu',
      description: ''
    };

    // Optimistic Add
    setTasks(prev => [...prev, newTask]);

    try {
      await storageService.saveTask(newTask);
      notificationService.notify('Nova Tarefa', `"${title}" adicionada em ${status}.`);
    } catch (e) {
      addToast('Erro ao criar tarefa rápida', 'error');
      updateData();
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
        addToast('O título da tarefa é obrigatório', 'error');
        return;
    }
    
    let finalCaseId: string | undefined = undefined;
    let finalCaseTitle: string | undefined = undefined;
    let finalClientId: string | undefined = undefined;
    let finalClientName: string | undefined = undefined;

    // Logic to handle Creation of New Entities
    if (formData.linkType === 'case') {
      if (formData.creationMode === 'new') {
         if (!formData.newEntityName || !formData.newEntityAux) {
            addToast('Preencha os dados do novo processo', 'error');
            return;
         }
         const client = availableClients.find(c => c.id === formData.newEntityAux);
         if (!client) { addToast('Cliente inválido', 'error'); return; }

         const newCase: LegalCase = {
            id: `case-${Date.now()}`,
            officeId: '', // Will be set by storageService
            title: formData.newEntityName,
            client: client,
            cnj: 'Em andamento',
            status: CaseStatus.ACTIVE,
            value: 0,
            responsibleLawyer: formData.assignedTo,
            lastUpdate: new Date().toISOString()
         };
         await storageService.saveCase(newCase);
         finalCaseId = newCase.id;
         finalCaseTitle = newCase.title;
      } else {
         finalCaseId = formData.selectedCaseId;
         finalCaseTitle = availableCases.find(c => c.id === finalCaseId)?.title;
      }
    } else if (formData.linkType === 'client') {
       if (formData.creationMode === 'new') {
          if (!formData.newEntityName) {
            addToast('Nome do cliente obrigatório', 'error');
            return;
          }
          const newClient: Client = {
             id: `cli-${Date.now()}`,
             officeId: '', // Will be set by storageService
             name: formData.newEntityName,
             type: 'PF',
             status: 'Lead',
             email: '',
             phone: '',
             avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.newEntityName)}`,
             address: '', city: '', state: '', documents: [], history: [], alerts: [], createdAt: new Date().toLocaleDateString('pt-BR')
          };
          await storageService.saveClient(newClient);
          finalClientId = newClient.id;
          finalClientName = newClient.name;
       } else {
          finalClientId = formData.selectedClientId;
          finalClientName = availableClients.find(c => c.id === finalClientId)?.name;
       }
    }

    const taskToSave: Task = {
      id: editingTask ? editingTask.id : `task-${Date.now()}`,
      officeId: editingTask ? editingTask.officeId : '', // Will be handled
      title: formData.title,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      priority: formData.priority,
      status: formData.status,
      description: formData.description,
      assignedTo: formData.assignedTo,
      caseId: finalCaseId,
      caseTitle: finalCaseTitle,
      clientId: finalClientId,
      clientName: finalClientName
    };

    await storageService.saveTask(taskToSave);
    await updateData();
    addToast(editingTask ? 'Tarefa atualizada' : 'Nova tarefa criada', 'success');
    
    if (!editingTask) {
      notificationService.notify('Nova Tarefa', `Tarefa "${taskToSave.title}" adicionada.`);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleDeleteTask = async () => {
    if (editingTask && confirm('Tem certeza que deseja excluir esta tarefa?')) {
      await storageService.deleteTask(editingTask.id);
      await updateData();
      addToast('Tarefa excluída', 'info');
      setIsModalOpen(false);
    }
  };

  const resetForm = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: Priority.MEDIUM,
      status: 'A Fazer',
      description: '',
      assignedTo: 'Eu',
      linkType: 'none',
      creationMode: 'existing',
      selectedCaseId: '',
      selectedClientId: '',
      newEntityName: '',
      newEntityAux: ''
    });
  };

  const openNewTask = (initialStatus?: Task['status']) => {
    resetForm();
    if (initialStatus) {
        setFormData(prev => ({ ...prev, status: initialStatus }));
    }
    setIsModalOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    const [day, month, year] = task.dueDate.split('/');
    const dateValue = year && month && day ? `${year}-${month}-${day}` : '';

    setFormData({
      title: task.title,
      dueDate: dateValue,
      priority: task.priority,
      status: task.status,
      description: task.description || '',
      assignedTo: task.assignedTo,
      linkType: task.caseId ? 'case' : task.clientId ? 'client' : 'none',
      creationMode: 'existing',
      selectedCaseId: task.caseId || '',
      selectedClientId: task.clientId || '',
      newEntityName: '',
      newEntityAux: ''
    });
    setIsModalOpen(true);
  };

  const todo = (tasks || []).filter(t => t.status === 'A Fazer');
  const inProgress = (tasks || []).filter(t => t.status === 'Em Andamento');
  const done = (tasks || []).filter(t => t.status === 'Concluído');

  return (
    <div className="h-full flex flex-col space-y-6 pb-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Pipeline CRM</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gestão visual de tarefas e compromissos. Arraste para atualizar o status.</p>
        </div>
        <button 
          onClick={() => openNewTask('A Fazer')} 
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 w-full md:w-auto"
        >
          <Plus size={18} /> 
          <span>Nova Tarefa</span>
        </button>
      </div>
      
      {/* BOARD */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-6 pb-6 h-full min-h-[500px]">
          <Column title="A Fazer" statusKey="A Fazer" color="bg-slate-400" tasks={todo} availableCases={availableCases} onAddTask={openNewTask} onEditTask={openEditTask} onDropTask={handleTaskDrop} onQuickAdd={handleQuickAdd} />
          <Column title="Em Andamento" statusKey="Em Andamento" color="bg-indigo-400" tasks={inProgress} availableCases={availableCases} onAddTask={openNewTask} onEditTask={openEditTask} onDropTask={handleTaskDrop} onQuickAdd={handleQuickAdd} />
          <Column title="Concluído" statusKey="Concluído" color="bg-emerald-400" tasks={done} availableCases={availableCases} onAddTask={openNewTask} onEditTask={openEditTask} onDropTask={handleTaskDrop} onQuickAdd={handleQuickAdd} />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTask ? "Editar Tarefa" : "Nova Tarefa"}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex justify-between w-full items-center">
             <div>
               {editingTask && (
                 <button type="button" onClick={handleDeleteTask} className="px-3 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium">
                   <Trash2 size={16} /> Excluir
                 </button>
               )}
             </div>
             <div className="flex gap-3">
               <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm">Cancelar</button>
               <button onClick={handleSaveTask} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-lg shadow-indigo-500/20 text-sm">
                 {editingTask ? 'Salvar' : 'Criar Tarefa'}
               </button>
             </div>
          </div>
        }
      >
        <form className="space-y-6">
           {/* Seção Principal */}
           <div className="space-y-4">
              <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <AlignLeft size={14} /> Título da Tarefa
                  </label>
                  <input 
                    type="text" 
                    value={formData.title} 
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg p-3 text-slate-900 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-400" 
                    placeholder="Ex: Protocolar Petição Inicial"
                    autoFocus 
                  />
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                       <Calendar size={14} /> Prazo
                    </label>
                    <input 
                      type="date" 
                      value={formData.dueDate} 
                      onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                      className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 focus:border-indigo-500 focus:outline-none dark:scheme-dark" 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                       <Flag size={14} /> Prioridade
                    </label>
                    <select 
                      value={formData.priority} 
                      onChange={(e) => setFormData({...formData, priority: e.target.value as Priority})}
                      className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
                    >
                       <option className="bg-white dark:bg-slate-800" value={Priority.LOW}>Baixa</option>
                       <option className="bg-white dark:bg-slate-800" value={Priority.MEDIUM}>Média</option>
                       <option className="bg-white dark:bg-slate-800" value={Priority.HIGH}>Alta</option>
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                       <CheckCircle2 size={14} /> Status
                    </label>
                    <select 
                      value={formData.status} 
                      onChange={(e) => setFormData({...formData, status: e.target.value as Task['status']})}
                      className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
                    >
                       <option className="bg-white dark:bg-slate-800" value="A Fazer">A Fazer</option>
                       <option className="bg-white dark:bg-slate-800" value="Em Andamento">Em Andamento</option>
                       <option className="bg-white dark:bg-slate-800" value="Concluído">Concluído</option>
                    </select>
                 </div>
               </div>
           </div>

           {/* Seção de Vínculo */}
           <div className="bg-slate-5 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl p-5 space-y-4">
               <div className="flex items-center justify-between">
                   <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <LinkIcon size={16} className="text-indigo-500 dark:text-indigo-400" /> Vínculo (Opcional)
                   </label>
                   {formData.linkType !== 'none' && (
                       <button type="button" onClick={() => setFormData({...formData, linkType: 'none'})} className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors flex items-center gap-1">
                           <Trash2 size={10} /> Remover
                       </button>
                   )}
               </div>
               
               <div className="grid grid-cols-3 gap-3 p-1 bg-slate-200 dark:bg-black/20 rounded-lg">
                  <button 
                     type="button"
                     onClick={() => setFormData({...formData, linkType: 'none', creationMode: 'existing'})}
                     className={`py-2 px-3 text-xs font-medium rounded-md transition-all ${formData.linkType === 'none' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                     Nenhum
                  </button>
                  <button 
                     type="button"
                     onClick={() => setFormData({...formData, linkType: 'case'})}
                     className={`py-2 px-3 text-xs font-medium rounded-md transition-all ${formData.linkType === 'case' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                     Processo
                  </button>
                  <button 
                     type="button"
                     onClick={() => setFormData({...formData, linkType: 'client'})}
                     className={`py-2 px-3 text-xs font-medium rounded-md transition-all ${formData.linkType === 'client' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                     Cliente
                  </button>
               </div>

               {/* Conteúdo do Vínculo */}
               {formData.linkType !== 'none' && (
                  <div className="animate-fade-in pt-2">
                     <div className="flex gap-6 mb-4 text-xs border-b border-slate-200 dark:border-white/5 pb-2">
                        <label className={`flex items-center gap-2 cursor-pointer transition-colors ${formData.creationMode === 'existing' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
                           <input 
                              type="radio" 
                              checked={formData.creationMode === 'existing'} 
                              onChange={() => setFormData({...formData, creationMode: 'existing'})}
                              className="hidden"
                           />
                           <span>Selecionar Existente</span>
                        </label>
                        <label className={`flex items-center gap-2 cursor-pointer transition-colors ${formData.creationMode === 'new' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
                           <input 
                              type="radio" 
                              checked={formData.creationMode === 'new'} 
                              onChange={() => setFormData({...formData, creationMode: 'new'})}
                              className="hidden"
                           />
                           <span>Cadastrar Novo</span>
                        </label>
                     </div>

                     {/* Lógica para Processo */}
                     {formData.linkType === 'case' && (
                        formData.creationMode === 'existing' ? (
                           <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                              <select 
                                value={formData.selectedCaseId} 
                                onChange={(e) => setFormData({...formData, selectedCaseId: e.target.value})}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg py-2.5 pl-9 pr-4 text-slate-900 dark:text-slate-200 text-sm focus:border-indigo-500 outline-none"
                              >
                                  <option value="" className="text-slate-500">Selecione o processo...</option>
                                  {availableCases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                              </select>
                           </div>
                        ) : (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
                              <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Título do Processo</label>
                                <input 
                                   type="text" 
                                   placeholder="Ex: Ação Trabalhista"
                                   value={formData.newEntityName}
                                   onChange={(e) => setFormData({...formData, newEntityName: e.target.value})}
                                   className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 text-sm focus:border-indigo-500 outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Cliente do Processo</label>
                                <select 
                                  value={formData.newEntityAux} 
                                  onChange={(e) => setFormData({...formData, newEntityAux: e.target.value})}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 text-sm focus:border-indigo-500 outline-none"
                                >
                                   <option value="" className="text-slate-500">Selecione...</option>
                                   {availableClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </div>
                           </div>
                        )
                     )}

                     {/* Lógica para Cliente */}
                     {formData.linkType === 'client' && (
                        formData.creationMode === 'existing' ? (
                           <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                              <select 
                                value={formData.selectedClientId} 
                                onChange={(e) => setFormData({...formData, selectedClientId: e.target.value})}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg py-2.5 pl-9 pr-4 text-slate-900 dark:text-slate-200 text-sm focus:border-indigo-500 outline-none"
                              >
                                  <option value="" className="text-slate-500">Selecione o cliente...</option>
                                  {availableClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                           </div>
                        ) : (
                           <div className="space-y-1 animate-fade-in">
                              <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Nome Completo / Razão Social</label>
                              <input 
                                 type="text" 
                                 placeholder="Ex: João da Silva"
                                 value={formData.newEntityName}
                                 onChange={(e) => setFormData({...formData, newEntityName: e.target.value})}
                                 className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 text-sm focus:border-indigo-500 outline-none"
                              />
                           </div>
                        )
                     )}
                  </div>
               )}
           </div>

           {/* Seção Inferior */}
           <div className="space-y-4">
               <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                     <User size={14} /> Atribuído para
                  </label>
                  <input 
                    type="text" 
                    value={formData.assignedTo} 
                    onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                    className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg p-3 text-slate-900 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-400"
                    placeholder="Nome do responsável"
                  />
               </div>
           </div>
        </form>
      </Modal>
    </div>
  );
};