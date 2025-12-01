'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ChatSidebarProps {
  agentId: string;
  allRuns: any[];
  currentRunIndex: number;
  onLoadConversation: (runId: string) => void;
  onStartNewChat: () => void;
  onGoToPrevious: () => void;
  onGoToNext: () => void;
  onGoToLatest: () => void;
  activeTab: 'chats' | 'agent' | 'tools';
  onTabChange: (tab: 'chats' | 'agent' | 'tools') => void;
  agent?: any;
  currentRun?: any;
  showTrace: boolean;
  onToggleTrace: () => void;
  TraceViewerComponent?: React.ComponentType<{ run: any; loading: boolean }>;
  loading?: boolean;
}

export default function ChatSidebar({
  agentId,
  allRuns,
  currentRunIndex,
  onLoadConversation,
  onStartNewChat,
  onGoToPrevious,
  onGoToNext,
  onGoToLatest,
  activeTab,
  onTabChange,
  agent,
  currentRun,
  showTrace,
  onToggleTrace,
  TraceViewerComponent,
  loading = false,
}: ChatSidebarProps) {
  const router = useRouter();
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const activeRunRef = useRef<HTMLDivElement>(null);

  // Scroll to active conversation when currentRunIndex changes
  useEffect(() => {
    if (activeTab === 'chats' && currentRunIndex >= 0) {
      scrollToActiveConversation();
    }
  }, [currentRunIndex, activeTab]);

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

  return (
    <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onTabChange('chats')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition ${
            activeTab === 'chats'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          💬 Chats
        </button>
        <button
          onClick={() => onTabChange('agent')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition ${
            activeTab === 'agent'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          ⚙️ Agent
        </button>
        <button
          onClick={() => onTabChange('tools')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition ${
            activeTab === 'tools'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          🔧 Tools
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'chats' && (
          <div className="flex-1 overflow-y-auto p-4" ref={sidebarScrollRef}>
            <button
              onClick={onStartNewChat}
              className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
            {allRuns.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                No previous conversations found
              </p>
            ) : (
              <div className="space-y-2">
                {allRuns.map((run, index) => {
                  const isActive = currentRunIndex === index;
                  return (
                    <div
                      key={run.id}
                      ref={isActive ? activeRunRef : null}
                      className={`p-4 border rounded-lg cursor-pointer transition ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400 shadow-md'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => onLoadConversation(run.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className={`font-medium text-sm ${
                            isActive
                              ? 'text-blue-900 dark:text-blue-100'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {new Date(run.createdAt).toLocaleString()}
                          </p>
                          <p className={`text-xs ${
                            isActive
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {run.turns?.length || 0} turns • {run.totalTokens?.totalTokens || 0} tokens
                          </p>
                        </div>
                        <span className={`text-xs ${
                          isActive
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {run.modelUsed}
                        </span>
                      </div>
                      {run.turns && run.turns.length > 0 && (
                        <p className={`text-sm truncate ${
                          isActive
                            ? 'text-blue-800 dark:text-blue-200'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {run.turns[run.turns.length - 1].userMessage}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'agent' && agent && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Agent Info</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Name:</span>
                  <p className="text-gray-900 dark:text-white font-medium">{agent.name}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Description:</span>
                  <p className="text-gray-900 dark:text-white">{agent.description}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Model:</span>
                  <p className="text-gray-900 dark:text-white font-mono text-xs">{agent.defaultModel}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Tools:</span>
                  <p className="text-gray-900 dark:text-white">{agent.allowedTools.length} enabled</p>
                </div>
              </div>
            </div>
            <div>
              <button
                onClick={() => router.push(`/dashboard/edit/${agentId}`)}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
              >
                Edit Agent
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Execution Trace</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                View detailed execution logs, tool calls, and token usage.
              </p>
              <button
                onClick={onToggleTrace}
                className={`w-full px-4 py-2 rounded-lg transition text-sm ${
                  showTrace
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {showTrace ? 'Hide Trace' : 'Show Trace'}
              </button>
            </div>
            {showTrace && TraceViewerComponent && (
              <div className="mt-4">
                <TraceViewerComponent run={currentRun} loading={loading} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      {activeTab === 'chats' && allRuns.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={onGoToPrevious}
              disabled={currentRunIndex <= 0}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {currentRunIndex >= 0 ? `${currentRunIndex + 1} / ${allRuns.length}` : 'Latest'}
            </span>
            <button
              onClick={onGoToNext}
              disabled={currentRunIndex >= allRuns.length - 1}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
          {currentRunIndex !== 0 && (
            <button
              onClick={onGoToLatest}
              className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Go to Latest
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

