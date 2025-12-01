'use client';

import { useState, useEffect } from 'react';
import TraceViewer from './TraceViewer';

interface ChatRightPanelProps {
  agent?: any;
  currentRun?: any;
  showTrace: boolean;
  onToggleTrace: () => void;
  loading?: boolean;
}

type RightPanelTab = 'trace' | 'tools' | 'files' | 'notes';

export default function ChatRightPanel({
  agent,
  currentRun,
  showTrace,
  onToggleTrace,
  loading = false,
}: ChatRightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>('trace');
  const [notes, setNotes] = useState<string>('');

  // Load notes from localStorage on mount
  useEffect(() => {
    if (agent?.id) {
      const savedNotes = localStorage.getItem(`agent-notes-${agent.id}`);
      if (savedNotes) {
        setNotes(savedNotes);
      }
    }
  }, [agent?.id]);

  // Auto-save notes to localStorage
  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (agent?.id) {
      localStorage.setItem(`agent-notes-${agent.id}`, value);
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-subtle border-l border-border-subtle">
      {/* Tabs */}
      <div className="flex border-b border-border-subtle h-[28px]">
        {(['trace', 'tools', 'files', 'notes'] as RightPanelTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-1 text-xs font-medium transition ${
              activeTab === tab
                ? 'bg-bg-selected text-text-primary border-b-2 border-accent-blue'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'trace' && (
          <div className="h-full overflow-y-auto">
            <TraceViewer run={currentRun} loading={loading} />
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="h-full overflow-y-auto p-2 space-y-2">
            <div className="text-xs text-text-muted mb-2">Available Tools</div>
            {agent?.allowedTools && agent.allowedTools.length > 0 ? (
              <div className="space-y-1">
                {agent.allowedTools.map((toolName: string) => (
                  <div
                    key={toolName}
                    className="px-2 py-1 text-xs text-text-secondary bg-bg-elevated border border-border-subtle rounded-sm hover:bg-bg-hover transition"
                  >
                    {toolName}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-text-muted p-2">No tools enabled</div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="h-full overflow-y-auto p-2">
            <div className="text-xs text-text-muted mb-2">Files</div>
            <div className="text-xs text-text-muted p-2">
              File upload functionality coming soon
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="h-full flex flex-col">
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes for this conversation..."
              className="flex-1 w-full p-2 text-xs font-mono text-text-primary bg-bg-base border-0 resize-none focus:outline-none"
              style={{ fontFamily: 'monospace' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

