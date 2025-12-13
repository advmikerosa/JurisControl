
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, CheckSquare, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { storageService } from '../services/storageService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { SearchResult, Office } from '../types';
import { Breadcrumbs } from './Breadcrumbs';
import { Sidebar } from './layout/Sidebar';
import { Header } from './layout/Header';

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
  const [currentOffice, setCurrentOffice] = useState<Office | null>(null);
  const [userOffices, setUserOffices] = useState<Office[]>([]);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Search State
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const fetchOffices = async () => {
      if (!user) return;
      try {
        const allOffices = await storageService.getOffices();
        const myOffices = allOffices.filter(o => 
            (user.offices && user.offices.includes(o.id)) || 
            (o.members && o.members.some(m => m.userId === user.id))
        );
        setUserOffices(myOffices);
        if (myOffices.length > 0) {
            const preferred = user.currentOfficeId ? myOffices.find(o => o.id === user.currentOfficeId) : null;
            setCurrentOffice(preferred || myOffices[0]);
        }
      } catch (e) {
        console.error("Failed to load offices", e);
      }
    };
    fetchOffices();
  }, [user]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (globalSearch.length >= 2) {
        setIsSearching(true);
        try {
          const results = await storageService.searchGlobal(globalSearch);
          setSearchResults(results);
          setShowResults(true);
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

  const handleClearSearch = () => {
      setGlobalSearch('');
      setSearchResults([]);
      setShowResults(false);
  };

  return (
    <div className="flex min-h-screen overflow-hidden text-slate-800 dark:text-slate-200 font-sans relative bg-slate-50 dark:bg-[#0f172a] transition-colors duration-500">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-30 dark:opacity-40 transition-opacity">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-300/30 dark:bg-indigo-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-300/30 dark:bg-violet-900/20 rounded-full blur-[120px]" />
      </div>

      <Sidebar 
        isMobileOpen={isMobileMenuOpen} 
        onCloseMobile={() => setIsMobileMenuOpen(false)} 
        onLogout={() => { logout(); navigate('/login'); }} 
      />

      <main className="flex-1 md:ml-72 relative z-10 flex flex-col min-h-screen bg-transparent">
        <Header 
            user={user}
            currentOffice={currentOffice}
            userOffices={userOffices}
            onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
            onThemeToggle={toggleTheme}
            theme={theme}
            setCurrentOffice={setCurrentOffice}
            searchTerm={globalSearch}
            onSearchChange={setGlobalSearch}
            onClearSearch={handleClearSearch}
            isSearching={isSearching}
            searchResults={searchResults}
            showResults={showResults}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markAsRead}
            onMarkAllRead={markAllAsRead}
            onClearNotifications={clearAll}
        />

        <div className="flex-1 p-4 md:p-10 overflow-y-auto custom-scrollbar flex flex-col max-w-[1600px] mx-auto w-full">
          <Breadcrumbs />
          <div className="flex-1 relative z-10">{children}</div>
          <footer className="mt-12 border-t border-slate-200/60 dark:border-white/5 pt-8 pb-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 dark:text-slate-600">
            <div>© {new Date().getFullYear()} JurisControl. Sistema Jurídico Inteligente.</div>
          </footer>
        </div>
      </main>

      <div className="fixed bottom-8 right-8 z-[45] flex flex-col items-end gap-3 pointer-events-none">
        <AnimatePresence>
          {isFabOpen && (
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.8 }} className="flex flex-col gap-3 items-end mb-2 pointer-events-auto">
               {[
                 { label: 'Novo Processo', icon: Briefcase, action: () => navigate('/cases?action=new') },
                 { label: 'Nova Tarefa', icon: CheckSquare, action: () => navigate('/crm') },
                 { label: 'Novo Cliente', icon: UserCheck, action: () => navigate('/clients') }
               ].map((item, idx) => (
                 <motion.button key={idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} onClick={() => { setIsFabOpen(false); item.action(); }} className="flex items-center gap-3 bg-white dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-full shadow-lg border border-slate-200 dark:border-white/10 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white transition-all font-medium text-sm group">
                   {item.label} <div className="bg-slate-100 dark:bg-white/10 p-1 rounded-full group-hover:bg-white/20 transition-colors"><item.icon size={14} /></div>
                 </motion.button>
               ))}
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={() => setIsFabOpen(!isFabOpen)} className={`pointer-events-auto w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-110 active:scale-95 ${isFabOpen ? 'rotate-45' : 'rotate-0'}`} aria-label="Menu de ações rápidas">
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
