'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllCommands, CommandDefinition } from '../dashboard/chat/[id]/commands';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand?: (command: CommandDefinition) => void;
  agentId?: string;
  runs?: any[];
}

type PaletteSection = 'commands' | 'conversations' | 'actions';

export default function CommandPalette({ 
  isOpen, 
  onClose, 
  onSelectCommand,
  agentId,
  runs = []
}: CommandPaletteProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentSection, setCurrentSection] = useState<PaletteSection>('commands');
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = getAllCommands();
  const filteredCommands = searchQuery
    ? commands.filter(cmd => 
        cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.aliases?.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : commands;

  const filteredRuns = searchQuery
    ? runs.filter(run => 
        run.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (run.turns?.[0]?.userMessage || '').toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : runs.slice(0, 5);

  const actions = [
    { id: 'new-chat', label: 'New Chat', icon: '💬', action: () => router.push(`/dashboard/chat/${agentId}`) },
    { id: 'edit-agent', label: 'Edit Agent', icon: '✏️', action: () => router.push(`/dashboard/edit/${agentId}`) },
    { id: 'dashboard', label: 'Go to Dashboard', icon: '📊', action: () => router.push('/dashboard') },
  ];

  const filteredActions = searchQuery
    ? actions.filter(a => a.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : actions;

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearchQuery('');
      setSelectedIndex(0);
      setCurrentSection('commands');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const maxIndex = getCurrentItems().length - 1;
        setSelectedIndex(prev => prev < maxIndex ? prev + 1 : 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const maxIndex = getCurrentItems().length - 1;
        setSelectedIndex(prev => prev > 0 ? prev - 1 : maxIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const sections: PaletteSection[] = ['commands', 'conversations', 'actions'];
        const currentIdx = sections.indexOf(currentSection);
        const nextIdx = (currentIdx + 1) % sections.length;
        setCurrentSection(sections[nextIdx]);
        setSelectedIndex(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSection, selectedIndex, searchQuery]);

  function getCurrentItems() {
    switch (currentSection) {
      case 'commands':
        return filteredCommands;
      case 'conversations':
        return filteredRuns;
      case 'actions':
        return filteredActions;
      default:
        return [];
    }
  }

  function handleSelect() {
    const items = getCurrentItems();
    const selected = items[selectedIndex];
    
    if (!selected) return;

    switch (currentSection) {
      case 'commands':
        if (onSelectCommand) {
          onSelectCommand(selected as CommandDefinition);
        }
        onClose();
        break;
      case 'conversations':
        router.push(`/dashboard/chat/${agentId}?runId=${(selected as any).id}`);
        onClose();
        break;
      case 'actions':
        (selected as any).action();
        onClose();
        break;
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative bg-bg-elevated border border-border-strong rounded-sm shadow-soft w-[640px] mx-4 max-h-[60vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="px-2 py-1.5 border-b border-border-subtle">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Search commands, conversations, or actions..."
                className="w-full px-2 py-1 text-sm bg-bg-subtle text-text-primary border border-border-subtle rounded-sm focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/40"
                style={{ height: '32px' }}
              />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border-subtle">
              {(['commands', 'conversations', 'actions'] as PaletteSection[]).map((section) => (
                <button
                  key={section}
                  onClick={() => {
                    setCurrentSection(section);
                    setSelectedIndex(0);
                  }}
                  className={`px-3 py-1 text-xs font-medium transition ${
                    currentSection === section
                      ? 'bg-bg-selected text-text-primary border-b-2 border-accent-blue'
                      : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {section.charAt(0).toUpperCase() + section.slice(1)}
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {currentSection === 'commands' && (
                <div>
                  {filteredCommands.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-text-muted">
                      No commands found
                    </div>
                  ) : (
                    filteredCommands.map((command, idx) => (
                      <div
                        key={command.name}
                        onClick={() => {
                          setSelectedIndex(idx);
                          handleSelect();
                        }}
                        className={`px-3 py-1 cursor-pointer transition flex items-center justify-between ${
                          idx === selectedIndex
                            ? 'bg-bg-selected'
                            : 'hover:bg-bg-hover'
                        }`}
                        style={{ height: '28px' }}
                      >
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-accent-blue">
                            /{command.name}
                          </code>
                          <span className="text-xs text-text-secondary">
                            {command.description}
                          </span>
                        </div>
                        <span className="text-xs text-text-muted">
                          {command.category || 'command'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {currentSection === 'conversations' && (
                <div>
                  {filteredRuns.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-text-muted">
                      {searchQuery ? 'No conversations found' : 'No recent conversations'}
                    </div>
                  ) : (
                    filteredRuns.map((run, idx) => (
                      <div
                        key={run.id}
                        onClick={() => {
                          setSelectedIndex(idx);
                          handleSelect();
                        }}
                        className={`px-3 py-1 cursor-pointer transition flex items-center justify-between ${
                          idx === selectedIndex
                            ? 'bg-bg-selected'
                            : 'hover:bg-bg-hover'
                        }`}
                        style={{ height: '28px' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-primary">
                            {new Date(run.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-xs text-text-muted">
                          {run.turns?.length || 0} turns
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {currentSection === 'actions' && (
                <div>
                  {filteredActions.map((action, idx) => (
                    <div
                      key={action.id}
                      onClick={() => {
                        setSelectedIndex(idx);
                        handleSelect();
                      }}
                      className={`px-3 py-1 cursor-pointer transition flex items-center justify-between ${
                        idx === selectedIndex
                          ? 'bg-bg-selected'
                          : 'hover:bg-bg-hover'
                      }`}
                      style={{ height: '28px' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{action.icon}</span>
                        <span className="text-xs text-text-primary">
                          {action.label}
                        </span>
                      </div>
                      <span className="text-xs text-text-muted">action</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-border-subtle text-xs text-text-muted flex items-center justify-between">
              <div className="flex gap-3">
                <span>↑↓ Navigate</span>
                <span>Enter Select</span>
                <span>Tab Switch</span>
              </div>
              <span>Esc Close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}


