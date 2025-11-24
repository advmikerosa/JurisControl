
import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
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
  CheckSquare,
  Check,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_OFFICES } from '../services/mockData';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Logo } from './Logo';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { logout, user } = useAuth();
  const { unreadCount, notifications, markAsRead, markAllAsRead, clearAll } = useNotifications();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentOffice, setCurrentOffice] = useState(MOCK_OFFICES[0]);
  const [isOfficeMenuOpen, setIsOfficeMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Refs for click outside
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Visão Geral' },
    { path: '/clients', icon: UserCheck, label: 'Clientes' },
    { path: '/cases', icon: Briefcase, label: 'Processos' },
    { path: '/crm', icon: Users, label: 'Tarefas / CRM' },
    { path: '/financial', icon: DollarSign, label: 'Financeiro' },
    { path: '/documents', icon: FileText, label: 'Documentos' },
  ];

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      addToast(`Buscando por "${globalSearch}"...`, 'info');
      navigate('/cases'); 
    }
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

  return (
    <div className="flex min-h-screen overflow-hidden text-slate-200 font-sans bg-[#0f172a] relative selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Ambient Background - Optimized to static layers */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/15 rounded-full blur-[100px] opacity-60" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/15 rounded-full blur-[100px] opacity-60" />
        <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] bg-cyan-600/5 rounded-full blur-[80px] opacity-40" />
      </div>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-72 h-screen fixed left-0 top-0 z-50 border-r border-white/5 bg-[#0f172a]/80 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
        <div className="p-8 flex items-center gap-3">
          <Logo size={32} />
          <span className="text-xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">JurisControl</span>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'} // Garante que a home não fique ativa em sub-rotas
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden
                ${isActive 
                  ? 'text-white bg-white/5 shadow-inner border border-white/5' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full" />}
                  <item.icon size={20} className={`transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  <span className="font-medium tracking-wide text-sm">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-1">
          <NavLink 
            to="/settings"
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-colors text-sm font-medium ${isActive ? 'text-white bg-white/5' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <Settings size={18} />
            <span>Configurações</span>
          </NavLink>
          <button 
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
             <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="fixed left-0 top-0 bottom-0 w-[80%] max-w-xs bg-[#0f172a] border-r border-white/10 z-[60] p-6 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                 <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-2">
                      <Logo size={28} />
                      <span className="text-lg font-bold text-white">JurisControl</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-white/5 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
                 </div>
                 <nav className="space-y-2 flex-1">
                   {navItems.map((item) => (
                     <NavLink
                       key={item.path}
                       to={item.path}
                       end={item.path === '/'}
                       onClick={() => setIsMobileMenuOpen(false)}
                       className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl font-medium ${isActive ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400'}`}
                     >
                       <item.icon size={20} />
                       {item.label}
                     </NavLink>
                   ))}
                 </nav>
                 <div className="pt-4 border-t border-white/10">
                    <button onClick={() => { setIsMobileMenuOpen(false); navigate('/settings'); }} className="flex items-center gap-3 px-4 py-3 text-slate-400 w-full font-medium">
                        <Settings size={20} /> Configurações
                    </button>
                    <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-3 px-4 py-3 text-rose-400 w-full font-medium">
                        <LogOut size={20} /> Sair
                    </button>
                 </div>
              </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-72 relative z-10 flex flex-col min-h-screen bg-transparent">
        
        {/* Header */}
        <header className="h-20 px-6 md:px-8 flex items-center justify-between border-b border-white/5 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-40 transition-all">
          <div className="flex items-center gap-4 md:hidden">
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
               <Menu />
             </button>
          </div>

          {/* Search Bar */}
          <div className="hidden md:block flex-1 max-w-md mr-8">
            <form onSubmit={handleGlobalSearch} className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              </div>
              <input 
                type="text" 
                placeholder="Buscar processos, clientes..." 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 bg-white/5 border border-white/5 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:bg-white/10 focus:border-indigo-500/30 transition-all"
              />
            </form>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4 md:gap-6 ml-auto">
            
            {/* Office Switcher */}
            <div className="relative hidden sm:block">
              <button 
                onClick={() => setIsOfficeMenuOpen(!isOfficeMenuOpen)}
                className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5"
              >
                <span>{currentOffice.name}</span>
                <ChevronDown size={14} className={`transition-transform ${isOfficeMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isOfficeMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-60 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 origin-top-right"
                  >
                    <div className="p-2">
                      {MOCK_OFFICES.map(office => (
                        <button 
                          key={office.id}
                          onClick={() => { setCurrentOffice(office); setIsOfficeMenuOpen(false); addToast(`Alternado para ${office.name}`, 'success'); }}
                          className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center justify-between ${currentOffice.id === office.id ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                        >
                          {office.name}
                          {currentOffice.id === office.id && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Notification Bell */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={`relative p-2.5 transition-all rounded-full ${isNotificationOpen ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                   <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.8)] ring-2 ring-[#0f172a]" />
                )}
              </button>
              
              <AnimatePresence>
                {isNotificationOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ type: "spring", bounce: 0.3, duration: 0.3 }}
                    className="absolute right-0 md:-right-4 top-full mt-4 w-80 sm:w-96 bg-[#1e293b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] z-50 overflow-hidden flex flex-col origin-top-right"
                  >
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                       <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">Notificações</h4>
                          <span className="bg-indigo-500 text-[10px] font-bold px-1.5 py-0.5 rounded text-white">{unreadCount}</span>
                       </div>
                       <div className="flex gap-2">
                         {unreadCount > 0 && (
                           <button onClick={markAllAsRead} className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 hover:bg-indigo-500/10 rounded transition-colors" title="Marcar todas">
                             Marcar lidas
                           </button>
                         )}
                         {notifications.length > 0 && (
                           <button onClick={clearAll} className="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-500/10 rounded transition-colors" title="Limpar tudo">
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
                            className={`p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 ${!n.read ? 'bg-indigo-500/5 border-l-2 border-l-indigo-500' : 'border-l-2 border-l-transparent'}`}
                          >
                             <div className="flex justify-between items-start mb-1 gap-2">
                               <p className={`text-sm font-semibold leading-tight ${!n.read ? 'text-white' : 'text-slate-400'}`}>{n.title}</p>
                               {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)] shrink-0 mt-1"></span>}
                             </div>
                             <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{n.body}</p>
                             <p className="text-[10px] text-slate-600 mt-2 font-medium">{timeAgo(n.timestamp)}</p>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center text-slate-500 px-6 flex flex-col items-center">
                           <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
                              <Bell size={20} className="opacity-40" />
                           </div>
                           <p className="text-sm font-medium text-slate-400">Tudo limpo!</p>
                           <p className="text-xs mt-1 opacity-60">Nenhuma notificação pendente.</p>
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-black/20 text-center">
                      <button onClick={() => { setIsNotificationOpen(false); navigate('/settings'); }} className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors">
                         Gerenciar Preferências
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Avatar */}
            <div 
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 pl-4 md:pl-6 md:border-l border-white/10 cursor-pointer group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">{user?.name || 'Usuário'}</p>
                <p className="text-[11px] text-slate-500 uppercase tracking-wide font-bold">{user?.role || 'Advogado'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] hover:scale-105 transition-transform shadow-lg shadow-indigo-500/20">
                <img 
                  src={user?.avatar || "https://picsum.photos/200/200?grayscale"} 
                  alt="User" 
                  className="w-full h-full rounded-full object-cover border-2 border-[#0f172a]"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Wrapper */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar flex flex-col max-w-[1600px] mx-auto w-full">
          <div className="flex-1 relative z-10">
             {children}
          </div>
          
          {/* Footer */}
          <footer className="mt-12 border-t border-white/5 pt-8 pb-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-600">
            <div>
              © {new Date().getFullYear()} JurisControl. Sistema Jurídico Inteligente.
            </div>
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-indigo-400 transition-colors">Privacidade</Link>
              <Link to="/terms" className="hover:text-indigo-400 transition-colors">Termos</Link>
              <span className="hover:text-indigo-400 cursor-pointer">Suporte</span>
            </div>
          </footer>
        </div>
      </main>

      {/* Global FAB */}
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
                   className="flex items-center gap-3 bg-white text-indigo-900 px-5 py-2.5 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all font-semibold text-sm group"
                 >
                   {item.label} 
                   <div className="bg-indigo-100 p-1 rounded-full text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                     <item.icon size={14} />
                   </div>
                 </motion.button>
               ))}
            </motion.div>
          )}
        </AnimatePresence>
        
        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`pointer-events-auto w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-[0_8px_25px_rgba(79,70,229,0.5)] hover:shadow-[0_10px_35px_rgba(79,70,229,0.6)] transition-all hover:scale-110 active:scale-95 ${isFabOpen ? 'rotate-45' : 'rotate-0'}`}
        >
          <Plus size={28} />
        </button>
      </div>
    </div>
  );
};
