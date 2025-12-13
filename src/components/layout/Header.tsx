
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sun, Moon, ChevronDown, Menu, Loader2, X, Trash2, Plus, LogIn, Briefcase, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Office, SearchResult, SystemNotification } from '../../types';
import { OfficeSetupModal } from '../OfficeSetupModal';

interface HeaderProps {
  user: User | null;
  currentOffice: Office | null;
  userOffices: Office[];
  onMobileMenuToggle: () => void;
  onThemeToggle: () => void;
  theme: 'light' | 'dark';
  setCurrentOffice: (o: Office) => void;
  
  // Search Props
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onClearSearch: () => void;
  isSearching: boolean;
  searchResults: SearchResult[];
  showResults: boolean;
  
  // Notifications Props
  notifications: SystemNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = (props) => {
  const navigate = useNavigate();
  const [isOfficeMenuOpen, setIsOfficeMenuOpen] = React.useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = React.useState(false);
  
  // Office Setup Modal State
  const [isOfficeSetupOpen, setIsOfficeSetupOpen] = useState(false);
  const [setupMode, setSetupMode] = useState<'create' | 'join'>('create');

  const searchRef = React.useRef<HTMLDivElement>(null);
  const notificationRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearchResultClick = (url: string) => {
      navigate(url);
      props.onClearSearch();
  };

  const openSetup = (mode: 'create' | 'join') => {
      setSetupMode(mode);
      setIsOfficeSetupOpen(true);
      setIsOfficeMenuOpen(false);
  };

  const timeAgo = (date: Date) => {
    const diff = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (diff < 60) return 'agora';
    const min = Math.floor(diff / 60);
    if (min < 60) return `${min}m atrás`;
    const h = Math.floor(min / 60);
    return `${h}h atrás`;
  };

  return (
    <>
    <header className="h-20 px-4 md:px-10 flex items-center justify-between sticky top-0 z-40 transition-all bg-white/70 dark:bg-[#0f172a]/70 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5 shadow-sm">
        
        {/* Mobile Toggle */}
        <div className="flex items-center gap-4 md:hidden">
            <button onClick={props.onMobileMenuToggle} className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-lg" aria-label="Abrir menu">
                <Menu size={24} />
            </button>
        </div>

        {/* Search */}
        <div className="hidden md:block flex-1 max-w-lg mr-8 relative" ref={searchRef}>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {props.isSearching ? <Loader2 size={18} className="text-indigo-500 animate-spin"/> : <Search size={18} className="text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 transition-colors"/>}
                </div>
                <input 
                    type="text" 
                    placeholder="Buscar clientes, processos (Ctrl+K)..."
                    value={props.searchTerm}
                    onChange={(e) => props.onSearchChange(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl leading-5 text-slate-800 dark:text-slate-300 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all sm:text-sm"
                />
                {props.searchTerm && (
                    <button onClick={props.onClearSearch} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600" aria-label="Limpar busca">
                        <X size={16} />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {props.showResults && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[400px] flex flex-col">
                        {props.searchResults.length > 0 ? (
                            <div className="py-2 overflow-y-auto custom-scrollbar">
                                {props.searchResults.map(result => (
                                    <button key={result.id} onClick={() => handleSearchResultClick(result.url)} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors">
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{result.title}</p>
                                        {result.subtitle && <p className="text-xs text-slate-500">{result.subtitle}</p>}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                {props.isSearching ? "Buscando..." : "Nenhum resultado encontrado."}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 md:gap-5 ml-auto">
            <button onClick={props.onThemeToggle} className="p-2.5 rounded-xl text-slate-500 hover:bg-white dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-all shadow-sm" aria-label="Alternar tema">
                {props.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Office Switcher */}
            <div className="relative hidden sm:block">
                <button onClick={() => setIsOfficeMenuOpen(!isOfficeMenuOpen)} className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white transition-colors py-2 px-3 rounded-xl hover:bg-white dark:hover:bg-white/5">
                    <span>{props.currentOffice?.name || 'Sem Escritório'}</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isOfficeMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                    {isOfficeMenuOpen && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                            
                            <div className="p-2">
                                {props.userOffices.length > 0 ? (
                                    <>
                                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar mb-2">
                                            {props.userOffices.map(office => (
                                                <button key={office.id} onClick={() => { props.setCurrentOffice(office); setIsOfficeMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center justify-between ${props.currentOffice?.id === office.id ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                                    <span className="truncate">{office.name}</span>
                                                    {props.currentOffice?.id === office.id && <Check size={14} />}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="h-px bg-slate-200 dark:bg-white/5 my-1" />
                                    </>
                                ) : (
                                    <div className="p-4 text-center">
                                        <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400">
                                            <Briefcase size={20} />
                                        </div>
                                        <p className="text-xs text-slate-500 mb-3">Você não está vinculado a nenhum escritório.</p>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <button 
                                        onClick={() => openSetup('create')}
                                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all group"
                                    >
                                        <Plus size={16} className="text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
                                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">Criar Novo</span>
                                    </button>
                                    <button 
                                        onClick={() => openSetup('join')}
                                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all group"
                                    >
                                        <LogIn size={16} className="text-slate-500 dark:text-slate-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400" />
                                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-300">Entrar</span>
                                    </button>
                                </div>
                            </div>

                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
                <button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className="relative p-2.5 rounded-xl text-slate-500 hover:bg-white dark:hover:bg-white/5 transition-all" aria-label="Notificações">
                    <Bell size={20} />
                    {props.unreadCount > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full shadow-glow" />}
                </button>
                <AnimatePresence>
                    {isNotificationOpen && (
                        <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-full mt-3 w-80 bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-slate-200 dark:border-white/5 flex justify-between items-center">
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">Notificações</h4>
                                <div className="flex gap-2">
                                    <button onClick={props.onMarkAllRead} className="text-xs text-indigo-500 hover:underline">Lidas</button>
                                    <button onClick={props.onClearNotifications} className="text-slate-500 hover:text-rose-500"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                {props.notifications.length > 0 ? (
                                    props.notifications.map(n => (
                                        <div key={n.id} onClick={() => props.onMarkRead(n.id)} className={`p-4 border-b border-slate-100 dark:border-white/5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${!n.read ? 'bg-indigo-50/50 dark:bg-indigo-500/10' : ''}`}>
                                            <p className={`text-sm ${!n.read ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{n.title}</p>
                                            <p className="text-xs text-slate-500 mt-1">{n.body}</p>
                                            <p className="text-[10px] text-slate-400 mt-2">{timeAgo(n.timestamp)}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-10 text-center text-slate-500 text-sm">Tudo limpo!</div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Profile Link */}
            <div onClick={() => navigate('/profile')} className="flex items-center gap-3 pl-4 md:pl-6 md:border-l border-slate-200 dark:border-white/10 cursor-pointer group">
               <div className="text-right hidden sm:block">
                   <p className="text-sm font-medium text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">{props.user?.name || 'Usuário'}</p>
                   <p className="text-[10px] text-slate-500 group-hover:text-slate-700 uppercase tracking-wide font-bold">{props.user?.role || 'Advogado'}</p>
               </div>
               <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                   <div className="w-full h-full rounded-full border-2 border-white dark:border-[#0f172a] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                       <img src={props.user?.avatar || "https://picsum.photos/200"} alt="User" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                   </div>
               </div>
            </div>
        </div>
    </header>
    
    <OfficeSetupModal 
        isOpen={isOfficeSetupOpen} 
        onClose={() => setIsOfficeSetupOpen(false)} 
        initialMode={setupMode}
    />
    </>
  );
};
