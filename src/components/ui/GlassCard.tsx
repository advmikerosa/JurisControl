
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
      whileHover={hoverEffect ? { 
        y: -4, 
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)',
        borderColor: 'rgba(255, 255, 255, 0.2)' 
      } : {}}
      onClick={onClick}
      className={`
        relative overflow-hidden
        bg-white/80 dark:bg-[#1e293b]/70 
        backdrop-blur-md 
        border border-slate-200/50 dark:border-white/10 
        shadow-sm dark:shadow-glass-light
        rounded-2xl 
        p-6 
        text-slate-800 dark:text-slate-100
        transition-all duration-300 ease-out
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {/* Subtle Inner Glow Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent dark:from-white/5 dark:to-transparent pointer-events-none opacity-50" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};
