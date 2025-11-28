'use client';

import { useState } from 'react';

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
  timestamp: Date;
}

interface TraceViewerProps {
  run: Run | null;
  loading?: boolean;
}

export default function TraceViewer({ run, loading }: TraceViewerProps) {
  const [expandedTurns, setExpandedTurns] = useState<Set<number>>(new Set());
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

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

  if (!run) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          No run selected. Start a conversation to see execution traces.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Run Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Run Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Status:</span>
            <span className={`font-medium ${
              run.status === 'completed' ? 'text-green-600 dark:text-green-400' :
              run.status === 'error' ? 'text-red-600 dark:text-red-400' :
              'text-yellow-600 dark:text-yellow-400'
            }`}>
              {run.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Model:</span>
            <span className="text-gray-900 dark:text-white font-mono text-xs">{run.modelUsed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Total Tokens:</span>
            <span className="text-gray-900 dark:text-white">{run.totalTokens.totalTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Input Tokens:</span>
            <span className="text-gray-900 dark:text-white">{run.totalTokens.inputTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Output Tokens:</span>
            <span className="text-gray-900 dark:text-white">{run.totalTokens.outputTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Tool Calls:</span>
            <span className="text-gray-900 dark:text-white">{run.totalToolCalls}</span>
          </div>
          {run.error && (
            <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded text-xs">
              {run.error}
            </div>
          )}
        </div>
      </div>

      {/* Turns */}
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Conversation Turns</h3>
        <div className="space-y-2">
          {run.turns.map((turn) => (
            <div
              key={turn.turnNumber}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <button
                onClick={() => toggleTurn(turn.turnNumber)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  Turn {turn.turnNumber}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {expandedTurns.has(turn.turnNumber) ? '▼' : '▶'}
                </span>
              </button>
              {expandedTurns.has(turn.turnNumber) && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">User Message:</p>
                    <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 p-2 rounded">
                      {turn.userMessage}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Assistant Response:</p>
                    <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 p-2 rounded">
                      {turn.assistantMessage}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Token Usage:</p>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Input: {turn.usage.inputTokens}</div>
                      <div>Output: {turn.usage.outputTokens}</div>
                      <div>Total: {turn.usage.totalTokens}</div>
                    </div>
                  </div>
                  {turn.toolExecutions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Tool Executions ({turn.toolExecutions.length}):
                      </p>
                      <div className="space-y-2">
                        {turn.toolExecutions.map((toolExec) => (
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
                                <span className={`ml-2 text-xs ${
                                  toolExec.result.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {toolExec.result.success ? '✓' : '✗'}
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
                                  <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto text-xs whitespace-pre-wrap">
                                    {toolExec.result.output}
                                  </pre>
                                </div>
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
                        ))}
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

