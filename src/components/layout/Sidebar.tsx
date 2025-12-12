
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar as CalendarIcon, UserCheck, Briefcase, 
  Users, DollarSign, FileText, Settings, LogOut, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../Logo';

interface SidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Visão Geral' },
  { path: '/calendar', icon: CalendarIcon, label: 'Calendário' },
  { path: '/clients', icon: UserCheck, label: 'Clientes' },
  { path: '/cases', icon: Briefcase, label: 'Processos' },
  { path: '/crm', icon: Users, label: 'Tarefas / CRM' },
  { path: '/financial', icon: DollarSign, label: 'Financeiro' },
  { path: '/documents', icon: FileText, label: 'Documentos' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile, onLogout }) => {
  const navigate = useNavigate();

  const SidebarContent = () => (
    <>
      <div className="p-8 flex items-center gap-3">
        <Logo size={32} className="drop-shadow-lg" />
        <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">JurisControl</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onCloseMobile}
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
          onClick={onCloseMobile}
          className={({ isActive }) => `flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-colors text-sm font-medium ${isActive ? 'text-indigo-600 dark:text-white bg-indigo-50 dark:bg-white/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <Settings size={20} />
          <span>Configurações</span>
        </NavLink>
        
        <button 
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 transition-colors text-sm font-medium"
          aria-label="Sair do sistema"
        >
          <LogOut size={20} />
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 h-screen fixed left-0 top-0 z-[100] border-r border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-[#0f172a]/90 backdrop-blur-2xl shadow-xl transition-colors duration-300">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
             <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-[120] md:hidden backdrop-blur-sm"
                onClick={onCloseMobile}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="fixed left-0 top-0 bottom-0 w-[85%] max-w-xs bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-white/10 z-[130] p-0 flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                 <div className="absolute top-4 right-4 z-50">
                    <button onClick={onCloseMobile} className="p-2 bg-slate-100 dark:bg-white/5 rounded-full text-slate-600 dark:text-slate-400" aria-label="Fechar menu">
                        <X size={20} />
                    </button>
                 </div>
                 <SidebarContent />
              </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
