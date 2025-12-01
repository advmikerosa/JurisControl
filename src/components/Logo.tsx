import React from 'react';

export const Logo = ({ size = 32, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="32" height="32" rx="8" fill="url(#paint0_linear_logo)" />
    {/* Stylized J */}
    <path d="M11 8V19C11 21.2091 9.20914 23 7 23" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Equality / Control Lines */}
    <path d="M16 12H26" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M16 18H26" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="11" cy="8" r="1.5" fill="white" />
    <defs>
      <linearGradient id="paint0_linear_logo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1" />
        <stop offset="1" stopColor="#8b5cf6" />
      </linearGradient>
    </defs>
  </svg>
);