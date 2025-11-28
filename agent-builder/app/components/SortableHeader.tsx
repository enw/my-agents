'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface SortableHeaderProps {
  children: ReactNode;
  sortField: string;
  currentSortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  className?: string;
}

export default function SortableHeader({
  children,
  sortField,
  currentSortField,
  sortDirection,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const isActive = currentSortField === sortField;

  return (
    <th
      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 ${className}`}
      onClick={() => onSort(sortField)}
    >
      <div className="flex items-center">
        <span>{children}</span>
        <span className="ml-1">
          {!isActive && (
            <svg className="w-4 h-4 inline text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          )}
          {isActive && (
            <motion.svg
              className="w-4 h-4 inline text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              initial={false}
              animate={{ rotate: sortDirection === 'asc' ? 0 : 180 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </motion.svg>
          )}
        </span>
      </div>
    </th>
  );
}
