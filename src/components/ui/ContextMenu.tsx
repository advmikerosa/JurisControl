import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon: React.ElementType;
  action: () => void;
  variant?: 'default' | 'danger' | 'success' | 'ai';
  description?: string;
}

interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  title?: string;
  items: ContextMenuItem[];
  onClose: () => void;
  aiSuggestion?: { title: string; action: () => void };
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ 
  isOpen, x, y, title, items, onClose, aiSuggestion 
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuState, setMenuState] = useState({ left: 0, top: undefined as number | undefined, bottom: undefined as number | undefined, origin: 'top' });

  useEffect(() => {
    if (isOpen) {
      const { innerWidth, innerHeight } = window;
      const MENU_WIDTH = 256; // w-64
      
      // Horizontal Centering: Center the menu on the click X coordinate
      let left = x - (MENU_WIDTH / 2);
      
      // Horizontal Clamping (prevent going off-screen)
      if (left < 10) left = 10;
      if (left + MENU_WIDTH > innerWidth - 10) left = innerWidth - MENU_WIDTH - 10;

      // Vertical Flipping: If clicked in the bottom 40% of screen, open upwards
      const isBottom = y > innerHeight * 0.6;
      
      setMenuState({
        left,
        top: isBottom ? undefined : y + 5, // Small offset for visibility
        bottom: isBottom ? innerHeight - y + 5 : undefined,
        origin: isBottom ? 'bottom' : 'top'
      });
    }
  }, [isOpen, x, y]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const style: React.CSSProperties = {
    position: 'fixed',
    top: menuState.top,
    bottom: menuState.bottom,
    left: menuState.left,
    zIndex: 100,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[99] bg-transparent cursor-default" onClick={onClose} />
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: menuState.origin === 'top' ? -10 : 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={style}
            className={`
              w-64 
              bg-white dark:bg-slate-900 
              border border-slate-200 dark:border-slate-700 
              shadow-xl dark:shadow-2xl shadow-slate-200/50 dark:shadow-black/50
              rounded-xl overflow-hidden flex flex-col 
              origin-${menuState.origin}
            `}
          >
            {title && (
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/30 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">{title}</span>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* AI Suggestion - High Contrast */}
            {aiSuggestion && (
              <div className="p-2 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-500/20">
                <button 
                  onClick={() => { aiSuggestion.action(); onClose(); }}
                  className="w-full text-left p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors group"
                >
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs mb-1">
                    <Sparkles size={12} className="animate-pulse" /> IA Sugere:
                  </div>
                  <p className="text-xs text-indigo-900 dark:text-indigo-100 font-medium line-clamp-2 leading-tight">
                    {aiSuggestion.title}
                  </p>
                </button>
              </div>
            )}

            <div className="p-1.5 space-y-0.5">
              {items.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => { item.action(); onClose(); }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group text-left
                    ${item.variant === 'danger' 
                      ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20' 
                      : item.variant === 'success'
                      ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }
                  `}
                >
                  <item.icon size={16} className={`shrink-0 ${
                    item.variant === 'danger' ? 'text-rose-500 dark:text-rose-400' : 
                    item.variant === 'success' ? 'text-emerald-500 dark:text-emerald-400' :
                    'text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                  }`} />
                  <div className="flex-1">
                    <span>{item.label}</span>
                    {item.description && <p className="text-[10px] text-slate-500 dark:text-slate-500 font-normal mt-0.5 opacity-90 group-hover:text-slate-600 dark:group-hover:text-slate-400">{item.description}</p>}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};