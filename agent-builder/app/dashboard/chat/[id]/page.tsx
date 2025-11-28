'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import TraceViewer from '../../../components/TraceViewer';
import ThemeToggle from '../../../components/ThemeToggle';

interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  allowedTools: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id as string;
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<any>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [previousRuns, setPreviousRuns] = useState<any[]>([]);
  const [showRunSelector, setShowRunSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAgent();
    loadModels();
    loadPreviousRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Load messages from the most recent run when agent loads
  useEffect(() => {
    if (agent && messages.length === 0) {
      loadLatestRunMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  async function loadLatestRunMessages() {
    try {
      const response = await fetch(`/api/runs?agentId=${agentId}&limit=1`);
      if (response.ok) {
        const runs = await response.json();
        if (runs.length > 0) {
          const latestRun = runs[0];
          const runResponse = await fetch(`/api/runs/${latestRun.id}`);
          if (runResponse.ok) {
            const run = await runResponse.json();
            setCurrentRun(run);
            
            // Build messages from run turns
            const runMessages: Message[] = [];
            if (run.turns && run.turns.length > 0) {
              run.turns.forEach((turn: any) => {
                runMessages.push({
                  role: 'user',
                  content: turn.userMessage,
                  timestamp: new Date(turn.timestamp),
                });
                runMessages.push({
                  role: 'assistant',
                  content: turn.assistantMessage || '',
                  timestamp: new Date(turn.timestamp),
                });
              });
              setMessages(runMessages);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load latest run messages:', err);
    }
  }

  async function loadPreviousRuns() {
    try {
      const response = await fetch(`/api/runs?agentId=${agentId}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setPreviousRuns(data.filter((run: any) => run.status === 'completed'));
      }
    } catch (err) {
      console.error('Failed to load previous runs:', err);
    }
  }

  async function continueRun(runId: string, message: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/run/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to continue conversation');
      }

      const data = await response.json();

      // Fetch updated run
      const runResponse = await fetch(`/api/runs/${runId}`);
      if (runResponse.ok) {
        const run = await runResponse.json();
        setCurrentRun(run);

        // Update messages from the run
        const newMessages: Message[] = [];
        run.turns.forEach((turn: any) => {
          newMessages.push({
            role: 'user',
            content: turn.userMessage,
            timestamp: new Date(turn.timestamp),
          });
          newMessages.push({
            role: 'assistant',
            content: turn.assistantMessage,
            timestamp: new Date(turn.timestamp),
          });
        });
        setMessages(newMessages);
      }

      setShowRunSelector(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue conversation');
    } finally {
      setLoading(false);
    }
  }

  async function loadModels() {
    try {
      const response = await fetch('/api/models');
      if (response.ok) {
        const data = await response.json();
        setModels(data);
        // Set default to agent's default model
        if (agent && !selectedModel) {
          setSelectedModel(agent.defaultModel);
        }
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadAgent() {
    try {
      const response = await fetch(`/api/agents/${agentId}`);
      if (!response.ok) {
        throw new Error('Failed to load agent');
      }
      const data = await response.json();
      setAgent(data);
      // Set default model when agent loads
      if (data.defaultModel && !selectedModel) {
        setSelectedModel(data.defaultModel);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent');
    }
  }

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = input;
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // Try streaming first
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          message: messageToSend,
          stream: true,
          modelOverride: selectedModel && selectedModel !== agent?.defaultModel ? selectedModel : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start stream');
      }

      // Check if response is streaming
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/event-stream')) {
        // Handle SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Create assistant message that will be updated
        const assistantMessage: Message = {
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        const messageIndex = messages.length;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  setLoading(false);
                  continue;
                }

                try {
                  const chunk = JSON.parse(data);
                  if (chunk.type === 'content' && chunk.content) {
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[messageIndex] = {
                        ...updated[messageIndex],
                        content: (updated[messageIndex].content || '') + chunk.content,
                      };
                      return updated;
                    });
                  } else if (chunk.type === 'error') {
                    throw new Error(chunk.error);
                  } else if (chunk.type === 'session') {
                    // Session started
                  } else if (chunk.type === 'run_created') {
                    // Run created, fetch details
                    if (chunk.runId) {
                      setCurrentRun(null); // Clear previous run
                      fetchRunDetails(chunk.runId);
                    }
                  } else if (chunk.type === 'tool_call') {
                    // Tool call started, refresh run details to show it
                    if (currentRun?.id) {
                      fetchRunDetails(currentRun.id);
                    }
                  } else if (chunk.type === 'tool_result') {
                    // Tool result, refresh run details
                    if (currentRun?.id) {
                      fetchRunDetails(currentRun.id);
                    }
                  }
                } catch (e) {
                  // Ignore JSON parse errors for non-JSON data
                }
              }
            }
          }
        }
        setLoading(false);
      } else {
        // Fallback to non-streaming
        const data = await response.json();
        
        // Fetch the run details to get the actual response
        if (data.runId) {
          // Poll for completion
          let attempts = 0;
          const maxAttempts = 30;
          while (attempts < maxAttempts) {
            const runResponse = await fetch(`/api/runs/${data.runId}`);
            if (runResponse.ok) {
              const run = await runResponse.json();
              setCurrentRun(run);
              
              // Get the assistant message from the last turn
              if (run.turns && run.turns.length > 0) {
                const lastTurn = run.turns[run.turns.length - 1];
                const assistantMessage: Message = {
                  role: 'assistant',
                  content: lastTurn.assistantMessage || 'No response generated',
                  timestamp: new Date(lastTurn.timestamp),
                };
                setMessages((prev) => {
                  // Remove any placeholder messages
                  const filtered = prev.filter(m => m.content !== 'Processing... (run may still be executing)');
                  return [...filtered, assistantMessage];
                });
                break;
              } else if (run.status === 'completed' || run.status === 'error') {
                // Run finished but no turns - might be an error
                const assistantMessage: Message = {
                  role: 'assistant',
                  content: run.error || 'No response generated',
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, assistantMessage]);
                break;
              }
            }
            
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }
          
          if (attempts >= maxAttempts) {
            throw new Error('Run took too long to complete');
          }
        } else {
          throw new Error('No run ID returned');
        }
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setLoading(false);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col transition-all ${showTrace ? 'mr-80' : ''}`}>
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <Link
                href="/dashboard"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm mb-1 block"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {agent.name}
              </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {agent.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Model Override
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={loading}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName} ({model.provider})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRunSelector(!showRunSelector)}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                title="Continue previous conversation"
              >
                Continue Run
              </button>
              <ThemeToggle />
              <button
                onClick={() => setShowTrace(!showTrace)}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                {showTrace ? 'Hide' : 'Show'} Trace
              </button>
            </div>
          </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Start a conversation with {agent.name}
            </p>
            <button
              onClick={() => inputRef.current?.focus()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg hover:shadow-xl"
            >
              Start Chatting
            </button>
          </div>
        )}
        
        <div className="space-y-4">
          {messages.map((message, idx) => (
            <div
              key={idx}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.role === 'user'
                      ? 'text-blue-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {error && (
            <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type your message..."
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Run Selector Modal */}
      {showRunSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Continue Previous Conversation
              </h2>
              <button
                onClick={() => setShowRunSelector(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {previousRuns.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                  No previous conversations found
                </p>
              ) : (
                <div className="space-y-2">
                  {previousRuns.map((run) => (
                    <div
                      key={run.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => {
                        const lastTurn = run.turns?.[run.turns.length - 1];
                        if (lastTurn) {
                          continueRun(run.id, '');
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {new Date(run.createdAt).toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {run.turns?.length || 0} turns • {run.totalTokens.totalTokens} tokens
                          </p>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {run.modelUsed}
                        </span>
                      </div>
                      {run.turns && run.turns.length > 0 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {run.turns[0].userMessage}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trace Viewer Sidebar */}
      {showTrace && (
        <div className="fixed right-0 top-0 h-screen w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg z-10">
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Execution Trace</h2>
              <button
                onClick={() => setShowTrace(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <TraceViewer run={currentRun} loading={loading && !currentRun} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

