
import React, { useState } from 'react';
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
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_OFFICES } from '../services/mockData';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { logout, user } = useAuth();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentOffice, setCurrentOffice] = useState(MOCK_OFFICES[0]);
  const [isOfficeMenuOpen, setIsOfficeMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [isFabOpen, setIsFabOpen] = useState(false);

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
      addToast(`Buscando por "${globalSearch}" em todos os módulos...`, 'info');
      navigate('/cases'); // Simula ir para a página principal de dados
    }
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const handleNotification = () => {
    addToast('Você não possui novas notificações.', 'info');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goToProfile = () => {
    navigate('/profile');
  };

  return (
    <div className="flex min-h-screen overflow-hidden text-slate-200 font-sans bg-[#0f172a] relative">
      
      {/* Ambient Background Blobs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] bg-cyan-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-72 h-screen fixed left-0 top-0 z-50 border-r border-white/10 bg-slate-900/30 backdrop-blur-md">
        <div className="p-8 flex items-center gap-3">
          <Logo size={36} />
          <span className="text-xl font-bold tracking-tight text-white">JurisControl</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group
                  ${isActive 
                    ? 'bg-white/10 text-white shadow-lg border border-white/10' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <Icon size={20} className={isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className="font-medium">{item.label}</span>
                {isActive && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <button 
            onClick={handleSettings}
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-colors ${location.pathname === '/settings' ? 'text-white bg-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <Settings size={20} />
            <span>Configurações</span>
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="w-3/4 h-full bg-slate-900 border-r border-white/10 p-4"
              onClick={(e) => e.stopPropagation()}
            >
               <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-2">
                    <Logo size={28} />
                    <span className="text-xl font-bold text-white">JurisControl</span>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)}><X className="text-white" /></button>
               </div>
               <nav className="space-y-2">
                 {navItems.map((item) => (
                   <NavLink
                     key={item.path}
                     to={item.path}
                     onClick={() => setIsMobileMenuOpen(false)}
                     className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl ${isActive ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400'}`}
                   >
                     <item.icon size={20} />
                     {item.label}
                   </NavLink>
                 ))}
                 <div className="pt-4 border-t border-slate-800">
                    <button onClick={handleSettings} className="flex items-center gap-3 px-4 py-3 text-slate-400 w-full">
                        <Settings size={20} /> Configurações
                    </button>
                    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-rose-400 w-full">
                        <LogOut size={20} /> Sair
                    </button>
                 </div>
               </nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-72 relative z-10 flex flex-col min-h-screen">
        
        {/* Header */}
        <header className="h-20 px-8 flex items-center justify-between border-b border-white/5 bg-slate-900/20 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-4 md:hidden">
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-300 hover:text-white">
               <Menu />
             </button>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleGlobalSearch} className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-2 w-96 focus-within:bg-white/10 focus-within:border-indigo-500/50 transition-all">
            <Search size={18} className="text-slate-500" />
            <input 
              type="text" 
              placeholder="Buscar processos, clientes ou documentos..." 
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-white ml-3 w-full placeholder:text-slate-600"
            />
          </form>

          {/* Right Side Actions */}
          <div className="flex items-center gap-6">
            
            {/* Office Switcher */}
            <div className="relative">
              <button 
                onClick={() => setIsOfficeMenuOpen(!isOfficeMenuOpen)}
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
              >
                <span className="hidden sm:inline">{currentOffice.name}</span>
                <ChevronDown size={14} />
              </button>
              
              <AnimatePresence>
                {isOfficeMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                  >
                    {MOCK_OFFICES.map(office => (
                      <button 
                        key={office.id}
                        onClick={() => { setCurrentOffice(office); setIsOfficeMenuOpen(false); addToast(`Alternado para ${office.name}`, 'success'); }}
                        className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        {office.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Notification Bell */}
            <button 
              onClick={handleNotification}
              className="relative p-2 text-slate-400 hover:text-white transition-colors"
            >
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            </button>

            {/* User Avatar - Clickable to Profile */}
            <div 
              onClick={goToProfile}
              className="flex items-center gap-3 pl-6 border-l border-white/10 cursor-pointer group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-slate-500">{user?.role || 'Advogado'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 p-[2px] hover:scale-105 transition-transform shadow-lg shadow-indigo-500/20">
                <img 
                  src={user?.avatar || "https://picsum.photos/200/200?grayscale"} 
                  alt="User" 
                  className="w-full h-full rounded-full object-cover border-2 border-slate-900"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="flex-1">
             {children}
          </div>
          
          {/* Footer LGPD Links */}
          <footer className="mt-12 border-t border-white/5 pt-6 pb-2 flex justify-center gap-6 text-xs text-slate-500">
            <Link to="/privacy" className="hover:text-indigo-400 transition-colors">Política de Privacidade</Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-indigo-400 transition-colors">Termos de Uso</Link>
            <span>•</span>
            <span>© {new Date().getFullYear()} JurisControl</span>
          </footer>
        </div>
      </main>

      {/* Global Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
        <AnimatePresence>
          {isFabOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              className="flex flex-col gap-3 items-end mb-2"
            >
               <button 
                 onClick={() => { setIsFabOpen(false); navigate('/cases?action=new'); }}
                 className="flex items-center gap-3 bg-white text-indigo-900 px-4 py-2 rounded-full shadow-lg hover:scale-105 transition-transform font-medium text-sm"
               >
                 Novo Processo <Briefcase size={16} />
               </button>
               <button 
                 onClick={() => { setIsFabOpen(false); navigate('/crm'); }}
                 className="flex items-center gap-3 bg-white text-indigo-900 px-4 py-2 rounded-full shadow-lg hover:scale-105 transition-transform font-medium text-sm"
               >
                 Nova Tarefa <CheckSquare size={16} />
               </button>
               <button 
                 onClick={() => { setIsFabOpen(false); navigate('/clients'); }}
                 className="flex items-center gap-3 bg-white text-indigo-900 px-4 py-2 rounded-full shadow-lg hover:scale-105 transition-transform font-medium text-sm"
               >
                 Novo Cliente <UserCheck size={16} />
               </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:bg-indigo-500 transition-all hover:scale-110 active:scale-95 ${isFabOpen ? 'rotate-45' : 'rotate-0'}`}
        >
          <Plus size={28} />
        </button>
      </div>
    </div>
  );
};
