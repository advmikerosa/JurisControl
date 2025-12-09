
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
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)',
        borderColor: 'rgba(99, 102, 241, 0.4)' // Indigo accent on hover
      } : {}}
      onClick={onClick}
      className={`
        relative overflow-hidden
        bg-white/70 dark:bg-[#1e293b]/60 
        backdrop-blur-xl 
        border border-white/40 dark:border-white/10 
        shadow-lg shadow-slate-200/50 dark:shadow-black/20
        rounded-2xl 
        p-6 
        text-slate-800 dark:text-slate-100
        transition-all duration-300 ease-out
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {/* Noise Texture Overlay (Optional for more realism) */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      
      {/* Subtle Inner Glow Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent dark:from-white/5 dark:to-transparent pointer-events-none opacity-100" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};
