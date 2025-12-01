'use client';

import { useRef, useEffect } from 'react';

interface ChatSidebarProps {
  allRuns: any[];
  currentRunIndex: number;
  onLoadConversation: (runId: string) => void;
  onGoToPrevious: () => void;
  onGoToNext: () => void;
  onGoToLatest: () => void;
}

export default function ChatSidebar({
  allRuns,
  currentRunIndex,
  onLoadConversation,
  onGoToPrevious,
  onGoToNext,
  onGoToLatest,
}: ChatSidebarProps) {
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const activeRunRef = useRef<HTMLDivElement>(null);

  // Scroll to active conversation when currentRunIndex changes
  useEffect(() => {
    if (currentRunIndex >= 0) {
      scrollToActiveConversation();
    }
  }, [currentRunIndex]);

  function scrollToActiveConversation() {
    if (activeRunRef.current && sidebarScrollRef.current) {
      setTimeout(() => {
        if (activeRunRef.current && sidebarScrollRef.current) {
          const container = sidebarScrollRef.current;
          const activeElement = activeRunRef.current;
          const scrollTop = activeElement.offsetTop - container.offsetTop - 16;
          container.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth',
          });
        }
      }, 100);
    }
  }

  function formatTime(date: Date | string) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(date: Date | string) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <div className="h-full flex flex-col bg-bg-subtle border-r border-border-subtle">
      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto" ref={sidebarScrollRef}>
        {allRuns.length === 0 ? (
          <div className="p-3 text-center">
            <p className="text-xs text-text-muted">No conversations</p>
          </div>
        ) : (
          <div className="py-1">
            {allRuns.map((run, index) => {
              const isActive = currentRunIndex === index;
              const firstMessage = run.turns && run.turns.length > 0 
                ? run.turns[0].userMessage 
                : 'New conversation';
              const shortMessage = firstMessage.length > 50 
                ? firstMessage.substring(0, 50) + '...' 
                : firstMessage;

              return (
                <div
                  key={run.id}
                  ref={isActive ? activeRunRef : null}
                  className={`px-2 py-2 cursor-pointer transition ${
                    isActive
                      ? 'bg-bg-selected border-l-2 border-accent-blue'
                      : 'hover:bg-bg-hover border-l-2 border-transparent'
                  }`}
                  onClick={() => onLoadConversation(run.id)}
                  style={{ minHeight: '44px' }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs text-text-muted">
                          {formatTime(run.createdAt)}
                        </span>
                        <span className="text-xs text-text-muted">•</span>
                        <span className="text-xs text-text-muted font-mono truncate">
                          {run.modelUsed?.split(':').pop() || 'unknown'}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${
                        isActive ? 'text-text-primary' : 'text-text-secondary'
                      }`}>
                        {shortMessage}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span>{run.turns?.length || 0} turns</span>
                    <span>•</span>
                    <span>{(run.totalTokens?.totalTokens || 0).toLocaleString()} tokens</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      {allRuns.length > 0 && (
        <div className="p-2 border-t border-border-subtle">
          <div className="flex items-center justify-between mb-1.5">
            <button
              onClick={onGoToPrevious}
              disabled={currentRunIndex <= 0}
              className="px-2 py-1 text-xs bg-bg-elevated text-text-secondary border border-border-subtle rounded-sm hover:bg-bg-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-xs text-text-muted">
              {currentRunIndex >= 0 ? `${currentRunIndex + 1} / ${allRuns.length}` : 'Latest'}
            </span>
            <button
              onClick={onGoToNext}
              disabled={currentRunIndex >= allRuns.length - 1}
              className="px-2 py-1 text-xs bg-bg-elevated text-text-secondary border border-border-subtle rounded-sm hover:bg-bg-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
          {currentRunIndex !== 0 && currentRunIndex !== -1 && (
            <button
              onClick={onGoToLatest}
              className="w-full px-2 py-1 text-xs bg-accent-blue text-text-inverse rounded-sm hover:opacity-90 transition"
            >
              Go to Latest
            </button>
          )}
        </div>
      )}
    </div>
  );
}


