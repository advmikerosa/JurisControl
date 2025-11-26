import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', hoverEffect = false, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverEffect ? { y: -5, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)' } : {}}
      onClick={onClick}
      className={`
        relative overflow-hidden
        bg-white/80 dark:bg-[#1e293b]/60 
        backdrop-blur-md 
        border border-slate-200 dark:border-white/10 
        shadow-glass-light dark:shadow-glass
        rounded-2xl 
        p-6 
        text-slate-800 dark:text-slate-100
        transition-all duration-300
        ${className}
      `}
    >
      {/* Gradient Overlay for subtle depth - Reduced in light mode */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};