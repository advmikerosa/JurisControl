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
      transition={{ duration: 0.4 }}
      whileHover={hoverEffect ? { y: -4, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)' } : {}}
      onClick={onClick}
      className={`
        relative overflow-hidden
        bg-white/5 
        backdrop-blur-xl 
        border border-white/10 
        shadow-xl 
        rounded-2xl 
        p-6
        text-slate-100
        ${className}
      `}
    >
      {/* Optional subtle noise or gradient overlay could go here */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};