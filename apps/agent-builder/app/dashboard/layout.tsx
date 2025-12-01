'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '../components/ThemeToggle';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-bg-base flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-[180px]' : 'w-0'
        } transition-all duration-300 bg-bg-subtle border-r border-border-subtle overflow-hidden`}
      >
        <div className="h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="p-3 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-primary">Agents</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-text-muted hover:text-text-secondary"
            >
              ×
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            <Link
              href="/dashboard"
              className={`block px-3 py-1.5 text-sm transition rounded-sm ${
                pathname === '/dashboard'
                  ? 'bg-bg-selected text-text-primary border-l-2 border-accent-blue'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
              style={{ height: '32px' }}
            >
              All Agents
            </Link>
            <Link
              href="/dashboard/runs"
              className={`block px-3 py-1.5 text-sm transition rounded-sm ${
                pathname?.startsWith('/dashboard/runs')
                  ? 'bg-bg-selected text-text-primary border-l-2 border-accent-blue'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
              style={{ height: '32px' }}
            >
              Run History
            </Link>
            <Link
              href="/dashboard/models"
              className={`block px-3 py-1.5 text-sm transition rounded-sm ${
                pathname?.startsWith('/dashboard/models')
                  ? 'bg-bg-selected text-text-primary border-l-2 border-accent-blue'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
              style={{ height: '32px' }}
            >
              Models
            </Link>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-2 border-t border-border-subtle">
            <Link
              href="/dashboard/new"
              className="block w-full px-3 py-1.5 text-xs bg-accent-blue text-text-inverse rounded-sm hover:opacity-90 transition text-center"
              style={{ height: '30px' }}
            >
              + New Agent
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="bg-bg-elevated border-b border-border-subtle px-3 py-2 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-text-muted hover:text-text-secondary"
          >
            ☰
          </button>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-text-secondary hover:text-text-primary transition"
            >
              Home
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-bg-base">{children}</main>
      </div>
    </div>
  );
}

