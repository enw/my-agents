'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface MorphButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export default function MorphButton({
  children,
  variant = 'primary',
  className = '',
  onClick,
  disabled = false,
  type = 'button',
}: MorphButtonProps) {
  const baseClasses = 'px-6 py-3 font-medium rounded-lg transition-all duration-150';
  
  const variantClasses = {
    primary: 'border-2 border-accent text-accent hover:bg-accent hover:text-white',
    secondary: 'border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
    danger: 'border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white',
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{
        duration: 0.15,
        ease: [0.16, 1, 0.3, 1], // ease-out-kinetic
      }}
    >
      {children}
    </motion.button>
  );
}
