
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { 
  Briefcase, 
  LayoutDashboard, 
  Users, 
  DollarSign, 
  FileText, 
  Settings, 
  Bell, 
  Search, 
  ChevronDown, 
  Menu,
  X,
  UserCheck,
  LogOut,
  Plus,
  Check,
  User,
  Loader2,
  Sun,
  Moon,
  Calendar as CalendarIcon,
  CheckSquare,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { storageService } from '../services/storageService';
import { permissionService } from '../services/permissionService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { Logo } from './Logo';
import { SearchResult, Office } from '../types';
import { Breadcrumbs } from './Breadcrumbs';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { logout, user } = useAuth();
  const { unreadCount, notifications, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Office State Management
  const [currentOffice, setCurrentOffice] = useState<Office | null>(null);
  const [userOffices, setUserOffices] = useState<Office[]>([]);
  const [isOfficeMenuOpen, setIsOfficeMenuOpen] = useState(false);
  
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Search States
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null); // Ref especificamente para o input

  // Refs for click outside
  const notificationRef = useRef<HTMLDivElement>(null);

  // Load Offices Effect
  useEffect(() => {
    let isMounted = true;
    const fetchOffices = async () => {
      if (!user) return;

      try {
        const allOffices = await storageService.getOffices();
        
        // Filter offices for the current user
        const myOffices = user 
            ? allOffices.filter(o => 
                (user.offices && user.offices.includes(o.id)) || 
                (o.members && o.members.some(m => m.userId === user.id))
              )
            : [];
            
        if (!isMounted) return;

        setUserOffices(myOffices);

        if (myOffices.length > 0) {
            const preferred = user?.currentOfficeId 
                ? myOffices.find((o: Office) => o.id === user.currentOfficeId) 
                : null;
            
            const selected = preferred || myOffices[0];
            setCurrentOffice(selected);
        } else {
            // FALLBACK OFFICE
            setCurrentOffice({
                id: 'default',
                name: 'Meu Escritório',
                handle: '@novo',
                ownerId: user.id,
                location: 'Brasil',
                members: [{
                  userId: user.id,
                  name: user.name,
                  role: 'Admin',
                  permissions: { financial: true, cases: true, documents: true, settings: true }
                }],
                createdAt: new Date().toISOString()
            } as Office);
        }
      } catch (e) {
        console.error("Failed to load offices", e);
      }
    };
    fetchOffices();
    return () => { isMounted = false; };
  }, [user]);

  // Click Outside & Keyboard Shortcuts (Ctrl+K)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Atalho Ctrl+K ou Cmd+K
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      
      // Atalho ESC para fechar busca
      if (event.key === 'Escape') {
        setShowResults(false);
        setGlobalSearch('');
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Debounced Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (globalSearch.length >= 2) {
        setIsSearching(true);
        try {
          const results = await storageService.searchGlobal(globalSearch);
          setSearchResults(results);
          setShowResults(true);
        } catch (error) {
          console.error("Search failed", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [globalSearch]);

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Visão Geral', resource: 'cases', action: 'view' },
    { path: '/calendar', icon: CalendarIcon, label: 'Calendário', resource: 'cases', action: 'view' },
    { path: '/clients', icon: UserCheck, label: 'Clientes', resource: 'clients', action: 'view' },
    { path: '/cases', icon: Briefcase, label: 'Processos', resource: 'cases', action: 'view' },
    { path: '/crm', icon: Users, label: 'Tarefas / CRM', resource: 'cases', action: 'view' },
    { path: '/financial', icon: DollarSign, label: 'Financeiro', resource: 'financial', action: 'view' },
    { path: '/documents', icon: FileText, label: 'Documentos', resource: 'documents', action: 'view' },
  ];

  const handleSearchResultClick = (url: string) => {
    navigate(url);
    setShowResults(false);
    setGlobalSearch('');
  };

  const handleClearSearch = () => {
    setGlobalSearch('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  };

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'agora';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  const visibleNavItems = useMemo(() => {
    if (!currentOffice || !user) return navItems;
    if (!currentOffice.members || currentOffice.members.length === 0) return navItems;

    const filtered = navItems.filter(item => 
      item.path === '/' || permissionService.can(user, currentOffice, item.resource as any, item.action as any)
    );
    return filtered.length > 0 ? filtered : [navItems[0]];
  }, [currentOffice, user]);

  return (
    <div className="flex min-h-screen overflow-hidden text-slate-800 dark:text-slate-200 font-sans relative selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-indigo-100 bg-slate-50 dark:bg-[#0f172a] transition-colors duration-500">
      
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-30 dark:opacity-40 transition-opacity">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-300/30 dark:bg-indigo-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-300/30 dark:bg-violet-900/20 rounded-full blur-[120px]" />
      </div>

      <aside className="hidden md:flex flex-col w-72 h-screen fixed left-0 top-0 z-[100] border-r border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0f172a]/90 backdrop-blur-2xl shadow-xl transition-colors duration-300">
        <div className="p-8 flex items-center gap-3">
          <Logo size={32} className="drop-shadow-lg" />
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">JurisControl</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto custom-scrollbar">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden
                ${isActive 
                  ? 'text-white shadow-md shadow-indigo-500/25' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-indigo-600 rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon size={20} strokeWidth={2} className={`relative z-10 transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`} />
                  <span className={`relative z-10 text-sm font-medium ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200/60 dark:border-white/10 space-y-1 bg-white/50 dark:bg-transparent backdrop-blur-md">
          <NavLink 
            to="/settings"
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-colors text-sm font-medium ${isActive ? 'text-indigo-600 dark:text-white bg-indigo-50 dark:bg-white/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Settings size={20} />
            <span>Configurações</span>
          </NavLink>
          
          <button 
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 transition-colors text-sm font-medium"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
             <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-[120] md:hidden backdrop-blur-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="fixed left-0 top-0 bottom-0 w-[85%] max-w-xs bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-white/10 z-[130] p-6 flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                 <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-2">
                      <Logo size={28} />
                      <span className="text-lg font-bold text-slate-900 dark:text-white">JurisControl</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={20} /></button>
                 </div>
                 <nav className="space-y-2 flex-1">
                   {visibleNavItems.map((item) => (
                     <NavLink
                       key={item.path}
                       to={item.path}
                       end={item.path === '/'}
                       onClick={() => setIsMobileMenuOpen(false)}
                       className={({ isActive }) => `flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-colors ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                     >
                       <item.icon size={20} />
                       {item.label}
                     </NavLink>
                   ))}
                 </nav>
                 <div className="border-t border-slate-200 dark:border-white/10 pt-4 space-y-2">
                    <NavLink 
                      to="/settings"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-white/5"
                    >
                      <Settings size={20} /> Configurações
                    </NavLink>
                    <button 
                      onClick={() => { setIsMobileMenuOpen(false); logout(); }}
                      className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      <LogOut size={20} /> Sair
                    </button>
                 </div>
              </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 md:ml-72 relative z-10 flex flex-col min-h-screen bg-transparent">
        <header className="h-20 px-4 md:px-10 flex items-center justify-between sticky top-0 z-40 transition-all bg-white/70 dark:bg-[#0f172a]/70 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-4 md:hidden">
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-lg">
               <Menu size={24} />
             </button>
          </div>

          <div className="hidden md:block flex-1 max-w-lg mr-8 relative" ref={searchRef}>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {isSearching ? (
                  <Loader2 size={18} className="text-indigo-500 animate-spin" />
                ) : (
                  <Search size={18} className="text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors" />
                )}
              </div>
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Buscar clientes, processos (Ctrl+K)..." 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onFocus={() => globalSearch.length >= 2 && setShowResults(true)}
                className="block w-full pl-10 pr-10 py-2.5 bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl leading-5 text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all sm:text-sm shadow-inner"
              />
              {globalSearch && (
                <button 
                  onClick={handleClearSearch}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <AnimatePresence>
              {showResults && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[400px] flex flex-col"
                >
                  {searchResults.length > 0 ? (
                    <div className="py-2 overflow-y-auto custom-scrollbar">
                      <div className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-50/50 dark:bg-white/5 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-100 dark:border-white/5 mb-1">
                        Resultados ({searchResults.length})
                      </div>
                      {searchResults.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSearchResultClick(result.url)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors group border-b border-slate-100 dark:border-white/5 last:border-0"
                        >
                          <div className={`p-2 rounded-lg shrink-0 ${
                            result.type === 'client' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' :
                            result.type === 'case' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                            'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          }`}>
                            {result.type === 'client' ? <User size={16} /> :
                             result.type === 'case' ? <Briefcase size={16} /> :
                             <CheckSquare size={16} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">{result.title}</p>
                            {result.subtitle && <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm flex flex-col items-center justify-center">
                      {isSearching ? (
                        <div className="flex flex-col items-center gap-3">
                           <Loader2 size={24} className="animate-spin text-indigo-500" />
                           <span className="font-medium">Buscando...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 animate-fade-in">
                           <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-2">
                              <Search size={20} className="opacity-40 text-slate-500 dark:text-slate-400" />
                           </div>
                           <p className="font-medium text-slate-600 dark:text-slate-300">Nenhum resultado encontrado</p>
                           <p className="text-xs text-slate-400 max-w-[200px]">Não encontramos nada para "{globalSearch}". Tente outro termo.</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 md:gap-5 ml-auto">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 transition-all shadow-sm hover:shadow border border-transparent hover:border-slate-200 dark:hover:border-white/10"
              title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="relative hidden sm:block">
              <button 
                onClick={() => setIsOfficeMenuOpen(!isOfficeMenuOpen)}
                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white transition-colors py-2 px-3 rounded-xl hover:bg-white dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-white/10"
              >
                <span>{currentOffice?.name || 'Meu Escritório'}</span>
                <ChevronDown size={14} className={`transition-transform ${isOfficeMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isOfficeMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
                  >
                    <div className="p-1">
                      {userOffices.length > 0 ? (
                        userOffices.map(office => (
                          <button 
                            key={office.id}
                            onClick={() => { setCurrentOffice(office); setIsOfficeMenuOpen(false); addToast(`Alternado para ${office.name}`, 'success'); }}
                            className={`w-full text-left px-4 py-2.5 text-sm rounded-lg transition-colors flex items-center justify-between ${currentOffice?.id === office.id ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'}`}
                          >
                            {office.name}
                            {currentOffice?.id === office.id && <Check size={16} />}
                          </button>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                           <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-2 text-slate-400">
                              <Briefcase size={20} />
                           </div>
                           <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                             Nenhum escritório encontrado.
                           </p>
                           <button 
                             onClick={() => { setIsOfficeMenuOpen(false); navigate('/settings?tab=office'); }}
                             className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                           >
                             Criar ou Entrar
                           </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={`relative p-2.5 transition-all rounded-xl ${isNotificationOpen ? 'bg-indigo-50 dark:bg-white/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent hover:border-slate-200 dark:hover:border-white/10'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                   <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_#f43f5e]" />
                )}
              </button>
              
              <AnimatePresence>
                {isNotificationOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 md:-right-4 top-full mt-3 w-80 sm:w-96 bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
                  >
                    <div className="p-4 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                       <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 dark:text-white text-sm">Notificações</h4>
                          <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-500/30">{unreadCount}</span>
                       </div>
                       <div className="flex gap-2">
                         {unreadCount > 0 && (
                           <button onClick={markAllAsRead} className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-2 py-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-colors" title="Marcar todas">
                             Marcar lidas
                           </button>
                         )}
                         {notifications.length > 0 && (
                           <button onClick={clearAll} className="text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-colors" title="Limpar tudo">
                             <Trash2 size={14} />
                           </button>
                         )}
                       </div>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                      {notifications.length > 0 ? (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => markAsRead(n.id)}
                            className={`p-4 border-b border-slate-100 dark:border-white/5 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${!n.read ? 'bg-indigo-50/50 dark:bg-indigo-500/10 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}
                          >
                             <div className="flex justify-between items-start mb-1 gap-2">
                               <p className={`text-sm leading-tight ${!n.read ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>{n.title}</p>
                               {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-glow shrink-0 mt-1"></span>}
                             </div>
                             <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{n.body}</p>
                             <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-2">{timeAgo(n.timestamp)}</p>
                          </div>
                        ))
                      ) : (
                        <div className="py-10 text-center px-6 flex flex-col items-center">
                           <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                              <Bell size={20} className="text-slate-400 dark:text-slate-500" />
                           </div>
                           <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tudo limpo!</p>
                           <p className="text-xs mt-1 text-slate-400 dark:text-slate-600">Nenhuma notificação pendente.</p>
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-white/5 text-center border-t border-slate-200 dark:border-white/5">
                      <button onClick={() => { setIsNotificationOpen(false); navigate('/settings?tab=emails'); }} className="text-[10px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                         Gerenciar Preferências
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div 
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 pl-4 md:pl-6 md:border-l border-slate-200 dark:border-white/10 cursor-pointer group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">{user?.name || 'Usuário'}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 uppercase tracking-wide font-bold transition-colors">{user?.role || 'Advogado'}</p>
              </div>
              <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg group-hover:shadow-indigo-500/30 transition-all">
                <div className="w-full h-full rounded-full border-2 border-white dark:border-[#0f172a] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                   <img 
                     src={user?.avatar || "https://picsum.photos/200/200?grayscale"} 
                     alt="User" 
                     className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                   />
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-10 overflow-y-auto custom-scrollbar flex flex-col max-w-[1600px] mx-auto w-full">
          <Breadcrumbs />
          <div className="flex-1 relative z-10">
             {children}
          </div>
          
          <footer className="mt-12 border-t border-slate-200 dark:border-white/5 pt-8 pb-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 dark:text-slate-600">
            <div>
              © {new Date().getFullYear()} JurisControl. Sistema Jurídico Inteligente.
            </div>
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacidade</Link>
              <Link to="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Termos de Uso</Link>
              <span className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer">Suporte</span>
            </div>
          </footer>
        </div>
      </main>

      <div className="fixed bottom-8 right-8 z-[45] flex flex-col items-end gap-3 pointer-events-none">
        <AnimatePresence>
          {isFabOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              className="flex flex-col gap-3 items-end mb-2 pointer-events-auto"
            >
               {[
                 { label: 'Novo Processo', icon: Briefcase, action: () => navigate('/cases?action=new') },
                 { label: 'Nova Tarefa', icon: CheckSquare, action: () => navigate('/crm') },
                 { label: 'Novo Cliente', icon: UserCheck, action: () => navigate('/clients') }
               ].map((item, idx) => (
                 <motion.button
                   key={idx}
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: idx * 0.05 }}
                   onClick={() => { setIsFabOpen(false); item.action(); }}
                   className="flex items-center gap-3 bg-white dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-full shadow-lg border border-slate-200 dark:border-white/10 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white transition-all font-medium text-sm group"
                 >
                   {item.label} 
                   <div className="bg-slate-100 dark:bg-white/10 p-1 rounded-full group-hover:bg-white/20 transition-colors">
                     <item.icon size={14} />
                   </div>
                 </motion.button>
               ))}
            </motion.div>
          )}
        </AnimatePresence>
        
        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`pointer-events-auto w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-110 active:scale-95 ${isFabOpen ? 'rotate-45' : 'rotate-0'}`}
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
