'use client';

import { useState, useEffect } from 'react';

interface Run {
  id: string;
  agentId: string;
  modelUsed: string;
  status: 'running' | 'completed' | 'error';
  turns: Turn[];
  totalTokens: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  totalToolCalls: number;
  totalDurationMs?: number;
  modelSettings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

interface Turn {
  turnNumber: number;
  userMessage: string;
  assistantMessage: string;
  toolExecutions: ToolExecution[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  startedAt?: Date;
  durationMs?: number;
  timestamp: Date;
}

interface ToolExecution {
  id: string;
  toolName: string;
  parameters: Record<string, unknown>;
  result: {
    success: boolean;
    output: string;
    data?: unknown;
    error?: string;
    executionTimeMs: number;
  };
  reasoning?: string;
  timestamp: Date;
}

interface TraceViewerProps {
  run: Run | null;
  loading?: boolean;
}

export default function TraceViewer({ run, loading }: TraceViewerProps) {
  const [expandedTurns, setExpandedTurns] = useState<Set<number>>(new Set());
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [collapsedStructuredData, setCollapsedStructuredData] = useState<Set<string>>(new Set());
  const [cost, setCost] = useState<number | null>(null);
  const [loadingCost, setLoadingCost] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentRun, setCurrentRun] = useState<Run | null>(run);

  useEffect(() => {
    setCurrentRun(run);
  }, [run]);

  useEffect(() => {
    if (currentRun && currentRun.status === 'completed') {
      loadCost();
    }
  }, [currentRun?.id, currentRun?.status]);

  // Poll for updates when run is active
  useEffect(() => {
    if (!currentRun || currentRun.status !== 'running') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/runs/${currentRun.id}`);
        if (response.ok) {
          const updatedRun = await response.json();
          setCurrentRun(updatedRun);
          
          // Auto-expand latest turn if it's new
          if (updatedRun.turns.length > (currentRun.turns.length || 0)) {
            const latestTurn = updatedRun.turns[updatedRun.turns.length - 1];
            setExpandedTurns(prev => new Set([...prev, latestTurn.turnNumber]));
          }
        }
      } catch (error) {
        console.error('Failed to poll run updates:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [currentRun?.id, currentRun?.status]);

  async function loadCost() {
    if (!currentRun) return;
    setLoadingCost(true);
    try {
      const response = await fetch(`/api/runs/${currentRun.id}/cost`);
      if (response.ok) {
        const data = await response.json();
        setCost(data.cost);
      }
    } catch (error) {
      console.error('Failed to load cost:', error);
    } finally {
      setLoadingCost(false);
    }
  }

  function toggleTurn(turnNumber: number) {
    const newExpanded = new Set(expandedTurns);
    if (newExpanded.has(turnNumber)) {
      newExpanded.delete(turnNumber);
    } else {
      newExpanded.add(turnNumber);
    }
    setExpandedTurns(newExpanded);
  }

  function toggleTool(toolId: string) {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolId)) {
      newExpanded.delete(toolId);
    } else {
      newExpanded.add(toolId);
    }
    setExpandedTools(newExpanded);
  }

  // Helper function to determine tool status
  function getToolStatus(toolExec: ToolExecution): 'success' | 'no-results' | 'error' {
    if (!toolExec.result.success) {
      return 'error';
    }
    
    // Check if it's a search tool with no results
    if (toolExec.toolName === 'web_search' && toolExec.result.data) {
      const searchData = toolExec.result.data as { results?: unknown[] };
      if (Array.isArray(searchData.results) && searchData.results.length === 0) {
        return 'no-results';
      }
    }
    
    // Check output message for "No results found"
    if (toolExec.result.output?.includes('No results found')) {
      return 'no-results';
    }
    
    return 'success';
  }

  // Helper function to render search results with rich UI
  function renderSearchResults(toolExec: ToolExecution) {
    if (!toolExec.result.data) {
      return (
        <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto text-xs whitespace-pre-wrap">
          {toolExec.result.output}
        </pre>
      );
    }

    const searchData = toolExec.result.data as { query: string; results: Array<{ title: string; url: string; snippet: string }> };
    
    if (searchData.results && searchData.results.length > 0) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Found {searchData.results.length} result{searchData.results.length !== 1 ? 's' : ''} for "{searchData.query}"
          </p>
          <div className="space-y-2">
            {searchData.results.map((result, idx) => (
              <a
                key={idx}
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <h4 className="font-medium text-sm text-blue-600 dark:text-blue-400 mb-1 line-clamp-1">
                  {result.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-1">
                  {result.url}
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                  {result.snippet}
                </p>
              </a>
            ))}
          </div>
        </div>
      );
    } else {
      // No results - show informative message
      return (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            No search results found for "{searchData.query}"
          </p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
            The search was executed successfully, but no matching results were found.
          </p>
        </div>
      );
    }
  }

  // Helper function to render tool output intelligently
  function renderToolOutput(toolExec: ToolExecution) {
    // Special handling for web_search tool
    if (toolExec.toolName === 'web_search') {
      return renderSearchResults(toolExec);
    }
    
    // Default: show plain text output
    return (
      <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto text-xs whitespace-pre-wrap">
        {toolExec.result.output}
      </pre>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading trace...</p>
        </div>
      </div>
    );
  }

  if (!currentRun) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          No run selected. Start a conversation to see execution traces.
        </p>
      </div>
    );
  }

  function handleExport(format: 'json' | 'text') {
    if (!currentRun) return;
    
    if (format === 'json') {
      const dataStr = JSON.stringify(currentRun, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `run-${currentRun.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Text format
      let text = `Execution Trace - Run ${currentRun.id}\n`;
      text += `========================================\n\n`;
      text += `Status: ${currentRun.status}\n`;
      text += `Model: ${currentRun.modelUsed}\n`;
      text += `Created: ${new Date(currentRun.createdAt).toLocaleString()}\n`;
      if (currentRun.completedAt) {
        text += `Completed: ${new Date(currentRun.completedAt).toLocaleString()}\n`;
      }
      if (currentRun.totalDurationMs !== undefined) {
        text += `Duration: ${currentRun.totalDurationMs < 1000 ? `${currentRun.totalDurationMs}ms` : `${(currentRun.totalDurationMs / 1000).toFixed(2)}s`}\n`;
      }
      text += `Total Tokens: ${currentRun.totalTokens.totalTokens.toLocaleString()} (Input: ${currentRun.totalTokens.inputTokens.toLocaleString()}, Output: ${currentRun.totalTokens.outputTokens.toLocaleString()})\n`;
      text += `Tool Calls: ${currentRun.totalToolCalls}\n`;
      if (currentRun.modelSettings) {
        text += `\nModel Settings:\n`;
        if (currentRun.modelSettings.temperature !== undefined) text += `  Temperature: ${currentRun.modelSettings.temperature}\n`;
        if (currentRun.modelSettings.maxTokens !== undefined) text += `  Max Tokens: ${currentRun.modelSettings.maxTokens}\n`;
        if (currentRun.modelSettings.topP !== undefined) text += `  Top P: ${currentRun.modelSettings.topP}\n`;
      }
      if (currentRun.error) {
        text += `\nError: ${currentRun.error}\n`;
      }
      text += `\n${'='.repeat(40)}\n\n`;
      
      currentRun.turns.forEach((turn, idx) => {
        text += `Turn ${turn.turnNumber}\n`;
        text += `-`.repeat(40) + `\n`;
        if (turn.startedAt) {
          text += `Started: ${new Date(turn.startedAt).toLocaleString()}\n`;
        }
        if (turn.durationMs !== undefined) {
          text += `Duration: ${turn.durationMs < 1000 ? `${turn.durationMs}ms` : `${(turn.durationMs / 1000).toFixed(2)}s`}\n`;
        }
        text += `\nUser Message:\n${turn.userMessage}\n\n`;
        text += `Assistant Response:\n${turn.assistantMessage}\n\n`;
        text += `Token Usage: ${turn.usage.totalTokens} (Input: ${turn.usage.inputTokens}, Output: ${turn.usage.outputTokens})\n\n`;
        
        if (turn.toolExecutions.length > 0) {
          text += `Tool Executions (${turn.toolExecutions.length}):\n`;
          turn.toolExecutions.forEach((toolExec) => {
            text += `  - ${toolExec.toolName} ${toolExec.result.success ? '✓' : '✗'}\n`;
            text += `    Parameters: ${JSON.stringify(toolExec.parameters)}\n`;
            if (toolExec.reasoning) {
              text += `    Reasoning: ${toolExec.reasoning}\n`;
            }
            text += `    Output: ${toolExec.result.output.substring(0, 200)}${toolExec.result.output.length > 200 ? '...' : ''}\n`;
            if (toolExec.result.error) {
              text += `    Error: ${toolExec.result.error}\n`;
            }
            text += `    Execution Time: ${toolExec.result.executionTimeMs}ms\n\n`;
          });
        }
        text += `\n`;
      });
      
      const dataBlob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `run-${currentRun.id}-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  // Filter turns and tools based on search term
  const filteredTurns = currentRun?.turns.filter(turn => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      turn.userMessage.toLowerCase().includes(searchLower) ||
      turn.assistantMessage.toLowerCase().includes(searchLower) ||
      turn.toolExecutions.some(te => 
        te.toolName.toLowerCase().includes(searchLower) ||
        JSON.stringify(te.parameters).toLowerCase().includes(searchLower) ||
        te.result.output.toLowerCase().includes(searchLower) ||
        (te.reasoning && te.reasoning.toLowerCase().includes(searchLower))
      )
    );
  }) || [];

  return (
    <div className="h-full overflow-y-auto p-2 space-y-2">
      {/* Search Bar */}
      {currentRun && (
        <div className="bg-bg-elevated rounded-sm p-1.5 border border-border-subtle">
          <input
            type="text"
            placeholder="Search messages, tools, parameters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-bg-subtle text-text-primary border border-border-subtle rounded-sm focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/40"
            style={{ height: '28px' }}
          />
          {searchTerm && (
            <div className="mt-1 text-xs text-text-muted">
              Found {filteredTurns.length} turn{filteredTurns.length !== 1 ? 's' : ''} matching "{searchTerm}"
            </div>
          )}
        </div>
      )}

      {/* Run Summary */}
      <div className="bg-bg-elevated rounded-sm p-2 border border-border-subtle">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-medium text-text-primary">Run Summary</h3>
          <div className="flex gap-1">
            <button
              onClick={() => handleExport('json')}
              className="px-2 py-0.5 text-xs bg-accent-blue text-text-inverse rounded-sm hover:opacity-90 transition"
              title="Export as JSON"
            >
              JSON
            </button>
            <button
              onClick={() => handleExport('text')}
              className="px-2 py-0.5 text-xs bg-bg-subtle text-text-secondary border border-border-subtle rounded-sm hover:bg-bg-hover transition"
              title="Export as Text"
            >
              TXT
            </button>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-text-muted">Status:</span>
            <span className={`font-medium ${
              currentRun.status === 'completed' ? 'text-accent-green' :
              currentRun.status === 'error' ? 'text-accent-red' :
              'text-accent-amber'
            }`}>
              {currentRun.status}
              {currentRun.status === 'running' && (
                <span className="ml-1 inline-block animate-pulse">●</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Model:</span>
            <span className="text-text-primary font-mono">{currentRun.modelUsed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Tokens:</span>
            <span className="text-text-primary">{currentRun.totalTokens.totalTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">In/Out:</span>
            <span className="text-text-secondary">{currentRun.totalTokens.inputTokens.toLocaleString()}/{currentRun.totalTokens.outputTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Tools:</span>
            <span className="text-text-primary">{currentRun.totalToolCalls}</span>
          </div>
          {currentRun.totalDurationMs !== undefined && (
            <div className="flex justify-between">
              <span className="text-text-muted">Duration:</span>
              <span className="text-text-primary">
                {currentRun.totalDurationMs < 1000 
                  ? `${currentRun.totalDurationMs}ms` 
                  : `${(currentRun.totalDurationMs / 1000).toFixed(1)}s`}
              </span>
            </div>
          )}
          {cost !== null && (
            <div className="flex justify-between">
              <span className="text-text-muted">Cost:</span>
              <span className="text-text-primary font-medium">
                ${cost.toFixed(6)}
              </span>
            </div>
          )}
          {loadingCost && (
            <div className="flex justify-between">
              <span className="text-text-muted">Cost:</span>
              <span className="text-text-muted">Calculating...</span>
            </div>
          )}
          {currentRun.modelSettings && (
            <div className="mt-1.5 pt-1.5 border-t border-border-subtle">
              <p className="text-xs font-medium text-text-muted mb-0.5">Settings:</p>
              <div className="text-xs text-text-secondary space-y-0.5">
                {currentRun.modelSettings.temperature !== undefined && (
                  <div>T: {currentRun.modelSettings.temperature}</div>
                )}
                {currentRun.modelSettings.maxTokens !== undefined && (
                  <div>Max: {currentRun.modelSettings.maxTokens.toLocaleString()}</div>
                )}
                {currentRun.modelSettings.topP !== undefined && (
                  <div>TopP: {currentRun.modelSettings.topP}</div>
                )}
              </div>
            </div>
          )}
          {currentRun.error && (
            <div className="mt-1.5 p-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-sm text-xs">
              {currentRun.error}
            </div>
          )}
        </div>
      </div>

      {/* Turns */}
      <div>
        <h3 className="text-xs font-medium text-text-primary mb-1.5">Conversation Turns</h3>
        <div className="space-y-1">
          {filteredTurns.map((turn) => (
            <div
              key={turn.turnNumber}
              className="bg-bg-elevated rounded-sm border border-border-subtle"
            >
              <button
                onClick={() => toggleTurn(turn.turnNumber)}
                className="w-full px-2 py-1.5 flex items-center justify-between hover:bg-bg-hover transition text-xs"
              >
                <span className="font-medium text-text-primary">
                  Turn {turn.turnNumber}
                </span>
                <span className="text-text-muted">
                  {expandedTurns.has(turn.turnNumber) ? '▼' : '▶'}
                </span>
              </button>
              {expandedTurns.has(turn.turnNumber) && (
                <div className="px-2 pb-2 space-y-1.5 border-t border-border-subtle">
                  <div>
                    <p className="text-xs font-medium text-text-muted mb-0.5">User:</p>
                    <p className="text-xs text-text-primary bg-bg-subtle p-1.5 rounded-sm">
                      {turn.userMessage}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-muted mb-0.5">Assistant:</p>
                    <p className="text-xs text-text-primary bg-bg-subtle p-1.5 rounded-sm">
                      {turn.assistantMessage}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span>Tokens: {turn.usage.totalTokens}</span>
                    {turn.durationMs !== undefined && (
                      <>
                        <span>•</span>
                        <span>{turn.durationMs < 1000 
                          ? `${turn.durationMs}ms` 
                          : `${(turn.durationMs / 1000).toFixed(1)}s`}
                        </span>
                      </>
                    )}
                  </div>
                  {turn.toolExecutions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Tool Executions ({turn.toolExecutions.length}):
                      </p>
                      <div className="space-y-2">
                        {turn.toolExecutions.map((toolExec) => {
                          const status = getToolStatus(toolExec);
                          const statusColorClass = status === 'success' 
                            ? 'text-green-600 dark:text-green-400'
                            : status === 'no-results'
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400';
                          const statusIcon = status === 'success' ? '✓' : status === 'no-results' ? '○' : '✗';
                          
                          return (
                            <div
                              key={toolExec.id}
                              className="bg-gray-50 dark:bg-gray-900 rounded p-2 border border-gray-200 dark:border-gray-700"
                            >
                              <button
                                onClick={() => toggleTool(toolExec.id)}
                                className="w-full flex items-center justify-between text-left"
                              >
                                <div>
                                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                                    {toolExec.toolName}
                                  </span>
                                  <span className={`ml-2 text-xs ${statusColorClass}`}>
                                    {statusIcon}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {expandedTools.has(toolExec.id) ? '▼' : '▶'}
                                </span>
                              </button>
                              {expandedTools.has(toolExec.id) && (
                                <div className="mt-2 space-y-2 text-xs">
                                  <div>
                                    <p className="font-medium text-gray-600 dark:text-gray-400 mb-1">Parameters:</p>
                                    <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto text-xs">
                                      {JSON.stringify(toolExec.parameters, null, 2)}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-600 dark:text-gray-400 mb-1">Output:</p>
                                    {renderToolOutput(toolExec)}
                                  </div>
                                  {toolExec.result.data && (
                                    <div>
                                      <button
                                        onClick={() => {
                                          const newSet = new Set(collapsedStructuredData);
                                          if (newSet.has(toolExec.id)) {
                                            newSet.delete(toolExec.id);
                                          } else {
                                            newSet.add(toolExec.id);
                                          }
                                          setCollapsedStructuredData(newSet);
                                        }}
                                        className="flex items-center justify-between w-full mb-1"
                                      >
                                        <p className="font-medium text-gray-600 dark:text-gray-400">
                                          Structured Data
                                        </p>
                                        <span className="text-xs text-gray-500">
                                          {collapsedStructuredData.has(toolExec.id) ? '▶' : '▼'}
                                        </span>
                                      </button>
                                      {!collapsedStructuredData.has(toolExec.id) && (
                                        <div className="mt-1">
                                          {toolExec.toolName === 'web_search' && toolExec.result.data ? (
                                            // Special formatting for search results
                                            <div className="space-y-2">
                                              {Object.entries(toolExec.result.data as Record<string, unknown>).map(([key, value]) => (
                                                <div key={key}>
                                                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                                    {key}:
                                                  </p>
                                                  {key === 'results' && Array.isArray(value) ? (
                                                    <div className="pl-2 space-y-1">
                                                      {value.map((item: any, idx: number) => (
                                                        <div key={idx} className="text-xs text-gray-600 dark:text-gray-300">
                                                          • <span className="font-medium">{item.title}</span> - {item.url}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto text-xs">
                                                      {JSON.stringify(value, null, 2)}
                                                    </pre>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            // Default JSON viewer for other tools
                                            <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto text-xs max-h-64 overflow-y-auto">
                                              {JSON.stringify(toolExec.result.data, null, 2)}
                                            </pre>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                {toolExec.reasoning && (
                                  <div>
                                    <p className="font-medium text-gray-600 dark:text-gray-400 mb-1">Reasoning:</p>
                                    <p className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs text-gray-700 dark:text-gray-300">
                                      {toolExec.reasoning}
                                    </p>
                                  </div>
                                )}
                                {toolExec.result.error && (
                                  <div className="p-2 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded">
                                    Error: {toolExec.result.error}
                                  </div>
                                )}
                                <div className="text-gray-500 dark:text-gray-400">
                                  Execution time: {toolExec.result.executionTimeMs}ms
                                </div>
                              </div>
                            )}
                          </div>
                        );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

