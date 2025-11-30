'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TraceViewer from '../../../components/TraceViewer';
import ThemeToggle from '../../../components/ThemeToggle';
import CommandAutocomplete from './CommandAutocomplete';
import { getAllCommands, CommandDefinition, CommandContext } from './commands';
import { parseCommand, filterCommands, completeCommandName } from './commandParser';
import { executeCommand, CommandStateSetters } from './commandExecutor';

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
  id?: string; // For queued messages
}

interface QueuedMessage {
  id: string;
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
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<any>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [previousRuns, setPreviousRuns] = useState<any[]>([]);
  const [continueRunPaneOpen, setContinueRunPaneOpen] = useState(true); // Left pane open by default
  const [currentRunIndex, setCurrentRunIndex] = useState<number>(-1); // -1 means viewing latest/new conversation
  const [allRuns, setAllRuns] = useState<any[]>([]); // All runs for navigation
  const [traceWidth, setTraceWidth] = useState<number>(320); // Default width in pixels (w-80 = 320px)
  const [isResizing, setIsResizing] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [runToContinue, setRunToContinue] = useState<string | null>(null); // Track which run we're continuing
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const assistantMessageIndexRef = useRef<number>(-1);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const activeRunRef = useRef<HTMLDivElement>(null);
  
  // Command autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<CommandDefinition[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);

  useEffect(() => {
    // Reset state when agent changes (starting fresh)
    setMessages([]);
    setCurrentRun(null);
    setRunToContinue(null);
    setCurrentRunIndex(-1);
    setError(null);
    
    loadAgent();
    loadModels();
    loadPreviousRuns();
    // Focus input when page loads
    setTimeout(() => inputRef.current?.focus(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Handle resize mouse events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      // Constrain width between 200px and 800px
      const constrainedWidth = Math.max(200, Math.min(800, newWidth));
      setTraceWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Scroll to active conversation when currentRunIndex changes
  useEffect(() => {
    if (currentRunIndex >= 0 && continueRunPaneOpen) {
      scrollToActiveConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRunIndex, continueRunPaneOpen]);

  // Don't auto-load messages - start fresh by default
  // Messages are only loaded when:
  // 1. User explicitly clicks "Continue Run" and selects a conversation
  // 2. User navigates using Prev/Next buttons
  // This ensures clicking "Chat with agent" always starts a new thread

  async function loadLatestRunMessages() {
    try {
      const response = await fetch(`/api/runs?agentId=${agentId}&limit=1`);
      if (response.ok) {
        const runs = await response.json();
        if (runs.length > 0) {
          // Use the navigation function instead
          if (allRuns.length > 0) {
            loadRunByIndex(0);
          } else {
            // Fallback if allRuns not loaded yet
            const latestRun = runs[0];
            const runResponse = await fetch(`/api/runs/${latestRun.id}`);
            if (runResponse.ok) {
              const run = await runResponse.json();
              setCurrentRun(run);
              
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
      }
    } catch (err) {
      console.error('Failed to load latest run messages:', err);
    }
  }

  async function loadRunByIndex(index: number) {
    if (index < 0 || index >= allRuns.length) return;
    
    try {
      const run = allRuns[index];
      const runResponse = await fetch(`/api/runs/${run.id}`);
      if (runResponse.ok) {
        const runData = await runResponse.json();
        setCurrentRun(runData);
        setCurrentRunIndex(index);
        
        // Build messages from run turns
        const runMessages: Message[] = [];
        if (runData.turns && runData.turns.length > 0) {
          runData.turns.forEach((turn: any) => {
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
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to load run:', err);
    }
  }

  // Scroll to active conversation in sidebar
  function scrollToActiveConversation() {
    if (activeRunRef.current && sidebarScrollRef.current) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (activeRunRef.current && sidebarScrollRef.current) {
          const container = sidebarScrollRef.current;
          const activeElement = activeRunRef.current;
          
          // Scroll so the active element is at the top (accounting for padding)
          const scrollTop = activeElement.offsetTop - container.offsetTop - 16; // 16px for padding
          container.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth',
          });
        }
      }, 100);
    }
  }

  function goToPreviousRun() {
    if (currentRunIndex > 0) {
      loadRunByIndex(currentRunIndex - 1);
      scrollToActiveConversation();
    }
  }

  function goToNextRun() {
    if (currentRunIndex < allRuns.length - 1) {
      loadRunByIndex(currentRunIndex + 1);
      scrollToActiveConversation();
    }
  }

  function goToLatestRun() {
    if (allRuns.length > 0) {
      loadRunByIndex(0);
      scrollToActiveConversation();
    }
  }

  function startNewChat() {
    setMessages([]);
    setCurrentRun(null);
    setRunToContinue(null);
    setCurrentRunIndex(-1);
    setError(null);
    // Focus input after starting new chat
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function fetchRunDetails(runId: string) {
    try {
      const response = await fetch(`/api/runs/${runId}`);
      if (response.ok) {
        const run = await response.json();
        setCurrentRun(run);
      }
    } catch (err) {
      console.error('Failed to fetch run details:', err);
    }
  }

  async function loadPreviousRuns() {
    try {
      const response = await fetch(`/api/runs?agentId=${agentId}&limit=100`); // Load more runs for navigation
      if (response.ok) {
        const data = await response.json();
        const completedRuns = data.filter((run: any) => run.status === 'completed');
        setAllRuns(completedRuns);
        setPreviousRuns(completedRuns.slice(0, 10)); // Keep for modal
        
        // Set current run index to 0 (most recent) if we have runs
        if (completedRuns.length > 0 && currentRunIndex === -1) {
          setCurrentRunIndex(0);
        }
      }
    } catch (err) {
      console.error('Failed to load previous runs:', err);
    }
  }

  async function loadConversation(runId: string) {
    setLoading(true);
    setError(null);

    try {
      // Fetch the run to load its conversation
      const runResponse = await fetch(`/api/runs/${runId}`);
      if (!runResponse.ok) {
        throw new Error('Failed to load conversation');
      }

      const run = await runResponse.json();
      setCurrentRun(run);
      setRunToContinue(runId); // Set this as the run to continue

      // Update messages from the run
      const newMessages: Message[] = [];
      if (run.turns && run.turns.length > 0) {
        run.turns.forEach((turn: any) => {
          newMessages.push({
            role: 'user',
            content: turn.userMessage,
            timestamp: new Date(turn.timestamp),
          });
          newMessages.push({
            role: 'assistant',
            content: turn.assistantMessage || '',
            timestamp: new Date(turn.timestamp),
          });
        });
      }
      setMessages(newMessages);

      // Find the run index in allRuns
      const runIndex = allRuns.findIndex((r: any) => r.id === runId);
      if (runIndex >= 0) {
        setCurrentRunIndex(runIndex);
      }

      // Optionally close the pane after selecting a conversation (optional UX improvement)
      // setContinueRunPaneOpen(false);

      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
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
    // Keep focus on input after messages update
    inputRef.current?.focus();
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

  function removeQueuedMessage(id: string) {
    setQueuedMessages((prev) => prev.filter((msg) => msg.id !== id));
  }

  function addToQueue(message: string) {
    const queuedMessage: QueuedMessage = {
      id: crypto.randomUUID(),
      content: message,
      timestamp: new Date(),
    };
    setQueuedMessages((prev) => [...prev, queuedMessage]);
    return queuedMessage.id;
  }

  const processQueueRef = useRef(false);

  async function processNextInQueue() {
    if (processQueueRef.current) return;
    
    setQueuedMessages((prev) => {
      if (prev.length === 0) {
        processQueueRef.current = false;
        setProcessingQueue(false);
        return prev;
      }
      
      processQueueRef.current = true;
      setProcessingQueue(true);
      
      const nextMessage = prev[0];
      
      // Process the message
      processMessage(nextMessage.content, nextMessage.id).finally(() => {
        // After processing, try to process next
        processQueueRef.current = false;
        setProcessingQueue(false);
        setQueuedMessages((current) => {
          if (current.length > 0) {
            // Process next message
            setTimeout(() => processNextInQueue(), 100);
          }
          return current;
        });
      });
      
      // Remove from queue
      return prev.slice(1);
    });
  }

  useEffect(() => {
    // Process queue when it changes and we're not already processing
    if (!processQueueRef.current && queuedMessages.length > 0) {
      processNextInQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedMessages.length]);

  // Command context for autocomplete
  const getCommandContext = (): CommandContext => ({
    models,
    runs: allRuns,
    agent,
    currentModel: selectedModel,
    showTrace,
    allRuns,
    currentRunIndex,
  });

  // Handle input changes for autocomplete
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;
    
    setInput(newValue);
    setCursorPosition(newCursorPos);
    
    const parsed = parseCommand(newValue, newCursorPos);
    
    if (parsed.isCommand && parsed.query !== '') {
      const allCommands = getAllCommands();
      const filtered = filterCommands(allCommands, parsed.query);
      setFilteredCommands(filtered);
      setShowAutocomplete(filtered.length > 0);
      setSelectedCommandIndex(0);
    } else if (parsed.isCommand && newValue === '/') {
      // Show all commands when just "/" is typed
      setFilteredCommands(getAllCommands());
      setShowAutocomplete(true);
      setSelectedCommandIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  }

  // Handle keyboard navigation in autocomplete
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showAutocomplete && filteredCommands.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedCommandIndex((prev) => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedCommandIndex((prev) => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedCommandIndex]) {
            handleCommandSelect(filteredCommands[selectedCommandIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowAutocomplete(false);
          break;
        case 'Tab':
          e.preventDefault();
          const completed = completeCommandName(input);
          if (completed) {
            setInput(completed + ' ');
            setShowAutocomplete(false);
          }
          break;
        default:
          // Let other keys through
          break;
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Handle command selection
  async function handleCommandSelect(command: CommandDefinition, suggestion?: string) {
    const parsed = parseCommand(input);
    let args = parsed.args;
    
    // If a suggestion was provided, use it as the first arg and update input
    if (suggestion) {
      args = [suggestion];
      // Update input to show the selected suggestion
      setInput(`/${parsed.command} ${suggestion} `);
    }
    
    // Validate required args
    if (command.requiresArgs && args.length === 0) {
      setError(`Usage: ${command.usage || `/${command.name} <${command.argDescription || 'value'}>`}`);
      setShowAutocomplete(true);
      return;
    }
    
    const context = getCommandContext();
    const setters: CommandStateSetters = {
      setMessages,
      setInput,
      setError,
      setShowTrace,
      setSelectedModel,
      setCurrentRunIndex,
      setRunToContinue,
      startNewChat,
      goToPreviousRun,
      goToNextRun,
      goToLatestRun,
      loadConversation,
      setTemperature,
      setMaxTokens,
    };

    try {
      const result = await executeCommand(command, args, context, setters);
      
      if (result.success) {
        if (result.shouldSaveToHistory && result.transformedMessage) {
          // For semantic commands, send the transformed message
          setInput(result.transformedMessage);
          // Trigger send after a brief delay to allow state to update
          setTimeout(() => {
            handleSend();
          }, 0);
        } else if (result.clearInput) {
          setInput('');
        }
        setShowAutocomplete(false);
        setError(null);
      } else {
        setError(result.error || 'Command execution failed');
        // Keep autocomplete open for config errors so user can fix
        if (command.category === 'config' || command.requiresArgs) {
          setShowAutocomplete(true);
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Command execution failed');
      setShowAutocomplete(false);
    }
  }

  async function handleSend() {
    if (!input.trim()) return;

    const messageToSend = input.trim();
    
    // Check if it's a command first
    const parsed = parseCommand(messageToSend);
    if (parsed.isCommand) {
      const command = getAllCommands().find(
        (cmd) => cmd.name === parsed.command || cmd.aliases?.includes(parsed.command)
      );
      
      if (command) {
        await handleCommandSelect(command);
        return;
      } else {
        // Unknown command - show error but don't send
        setError(`Unknown command: /${parsed.command}. Type /help for available commands.`);
        setInput('');
        return;
      }
    }

    setInput('');
    setError(null);
    
    // Keep focus on input after clearing
    setTimeout(() => inputRef.current?.focus(), 50);
    
    // Reset to latest conversation when sending new message (unless continuing)
    if (!runToContinue) {
      setCurrentRunIndex(-1);
      setRunToContinue(null); // Clear any previous continuation
    }

    // Add to queue
    const queueId = addToQueue(messageToSend);
    
    // Add user message to display immediately
    const userMessage: Message = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
      id: queueId,
    };
    setMessages((prev) => [...prev, userMessage]);
    
    // Process queue if not already processing
    if (!processQueueRef.current) {
      processNextInQueue();
    }
  }

  async function processMessage(messageToSend: string, messageId: string) {
    setLoading(true);

    try {
      // Check if we're continuing a conversation
      if (runToContinue) {
        // Continue existing conversation (non-streaming for now)
        const response = await fetch('/api/run/continue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runId: runToContinue,
            message: messageToSend,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to continue conversation');
        }

        // Fetch updated run to get the new turn
        const runResponse = await fetch(`/api/runs/${runToContinue}`);
        if (runResponse.ok) {
          const run = await runResponse.json();
          setCurrentRun(run);

          // Update messages from the run (include the new turn)
          const newMessages: Message[] = [];
          if (run.turns && run.turns.length > 0) {
            run.turns.forEach((turn: any) => {
              newMessages.push({
                role: 'user',
                content: turn.userMessage,
                timestamp: new Date(turn.timestamp),
              });
              newMessages.push({
                role: 'assistant',
                content: turn.assistantMessage || '',
                timestamp: new Date(turn.timestamp),
              });
            });
          }
          setMessages(newMessages);
          scrollToBottom();
        }

        setLoading(false);
        return;
      }

      // Create new run with streaming
      const requestBody: any = {
        agentId,
        message: messageToSend,
        stream: true,
        modelOverride: selectedModel && selectedModel !== agent?.defaultModel ? selectedModel : undefined,
      };
      
      // Add temperature and maxTokens if set via commands
      if (temperature !== null) {
        requestBody.temperature = temperature;
      }
      if (maxTokens !== null) {
        requestBody.maxTokens = maxTokens;
      }
      
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
        // Use a ref to track the assistant message index to avoid stale state issues
        setMessages((prev) => {
          const updated = [...prev, assistantMessage];
          assistantMessageIndexRef.current = updated.length - 1;
          return updated;
        });

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
                      // Use the ref to get the correct assistant message index
                      const assistantIndex = assistantMessageIndexRef.current;
                      if (assistantIndex >= 0 && assistantIndex < updated.length && updated[assistantIndex].role === 'assistant') {
                        updated[assistantIndex] = {
                          ...updated[assistantIndex],
                          content: (updated[assistantIndex].content || '') + chunk.content,
                        };
                      }
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
                      setRunToContinue(null); // Clear continuation when new run is created
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
        // Refocus input after streaming completes
        setTimeout(() => inputRef.current?.focus(), 100);
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
        // Refocus input after non-streaming response
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setLoading(false);
      // Remove the user message if processing failed
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      // Refocus input even on error
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  const handleCopyMessage = async (content: string, messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageIndex);
      setTimeout(() => setCopiedMessageId(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 flex overflow-hidden">
      {/* Continue Run Left Pane */}
      <aside
        className={`${
          continueRunPaneOpen ? 'w-80' : 'w-0'
        } transition-all duration-300 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Continue Previous Conversation
            </h2>
            <button
              onClick={() => setContinueRunPaneOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
              title="Toggle Continue Run Sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <div 
            ref={sidebarScrollRef}
            className="flex-1 overflow-y-auto p-4"
          >
            <button
              onClick={startNewChat}
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
                      onClick={() => {
                        loadConversation(run.id);
                      }}
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
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col transition-all overflow-hidden h-full ${showTrace ? 'mr-80' : ''}`}>
        {/* Header - FIXED */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setContinueRunPaneOpen(!continueRunPaneOpen)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
                  title="Toggle Continue Run Sidebar"
                >
                  {continueRunPaneOpen ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
                <Link
                  href="/dashboard"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
                >
                  ← Back to Dashboard
                </Link>
              </div>
              {/* Navigation Controls */}
              {allRuns.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPreviousRun}
                    disabled={currentRunIndex <= 0}
                    className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous conversation"
                  >
                    ← Prev
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                    {currentRunIndex >= 0 ? (
                      `Conversation ${currentRunIndex + 1} of ${allRuns.length}`
                    ) : (
                      'Latest'
                    )}
                  </span>
                  <button
                    onClick={goToNextRun}
                    disabled={currentRunIndex >= allRuns.length - 1}
                    className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next conversation"
                  >
                    Next →
                  </button>
                  {currentRunIndex !== 0 && (
                    <button
                      onClick={goToLatestRun}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      title="Go to latest conversation"
                    >
                      Latest
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {agent.name}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {agent.description}
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/dashboard/edit/${agent.id}`)}
                  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition flex items-center gap-1.5"
                  title="Edit agent"
                >
                  <span>✏️</span>
                  <span>Edit</span>
                </button>
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
                    {models.map((model: any) => {
                      const hasToolUse = model.strengths?.includes('tool-use') ?? false;
                      const isFree = !model.cost || (model.cost.inputPer1M === 0 && model.cost.outputPer1M === 0);
                      
                      return (
                        <option key={model.id} value={model.id}>
                          {model.displayName} ({model.provider}){hasToolUse ? ' 🔧' : ''}{isFree ? ' 🆓' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="flex items-center gap-2">
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
        </div>

        {/* Messages - SCROLLABLE */}
        <div 
          className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 min-h-0 overscroll-contain"
          onClick={() => {
            // Refocus input when clicking in message area
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
        >
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
                } group`}
              >
                <div
                  className={`relative max-w-3xl rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Copy button - appears on hover */}
                  <button
                    onClick={() => handleCopyMessage(message.content, idx)}
                    className={`absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                      message.role === 'user'
                        ? 'hover:bg-blue-700 text-blue-100'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                    title="Copy to clipboard"
                  >
                    {copiedMessageId === idx ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    className={`prose dark:prose-invert max-w-none prose-sm 
                      prose-headings:mt-0 prose-headings:mb-2 prose-headings:font-semibold
                      prose-p:my-2 prose-p:leading-relaxed
                      prose-ul:my-2 prose-ol:my-2 prose-li:my-1
                      prose-code:text-sm prose-code:font-mono
                      prose-pre:bg-gray-100 dark:prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-700
                      prose-pre:text-gray-900 dark:prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto
                      prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                      prose-strong:font-semibold prose-strong:text-gray-900 dark:prose-strong:text-gray-100
                      prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-blockquote:pl-4 prose-blockquote:italic
                      prose-table:w-full prose-table:border-collapse prose-table:my-4 prose-table:shadow-sm
                      prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:bg-gray-50 dark:prose-th:bg-gray-800 prose-th:p-3 prose-th:font-semibold prose-th:text-left prose-th:text-gray-900 dark:prose-th:text-gray-100
                      prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:p-3 prose-td:text-gray-700 dark:prose-td:text-gray-300
                      prose-tr:hover:bg-gray-50 dark:prose-tr:hover:bg-gray-800/50
                      ${message.role === 'user' ? 'prose-invert' : ''}`}
                    components={{
                      code: ({ node, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        
                        if (isInline) {
                          // Inline code styling
                          return (
                            <code 
                              className={`bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono ${
                                message.role === 'user' 
                                  ? 'bg-blue-500/20 text-blue-100' 
                                  : 'text-gray-900 dark:text-gray-100'
                              }`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }
                        
                        // Code block styling
                        return (
                          <code 
                            className={`block w-full p-0 bg-transparent text-sm font-mono ${
                              message.role === 'user' 
                                ? 'text-blue-50' 
                                : 'text-gray-900 dark:text-gray-100'
                            }`}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children, ...props }: any) => {
                        return (
                          <pre 
                            className={`my-4 rounded-lg p-4 overflow-x-auto ${
                              message.role === 'user'
                                ? 'bg-blue-500/20 border border-blue-400/30'
                                : 'bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
                            }`}
                            {...props}
                          >
                            {children}
                          </pre>
                        );
                      },
                      a: ({ node, href, children, ...props }: any) => {
                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${
                              message.role === 'user'
                                ? 'text-blue-200 hover:text-blue-100'
                                : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
                            } underline transition-colors`}
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      },
                      table: ({ children, ...props }: any) => {
                        return (
                          <div className="overflow-x-auto my-2">
                            <table
                              className={`w-full border-collapse border border-gray-300 dark:border-gray-600 rounded overflow-hidden shadow-sm text-xs ${
                                message.role === 'user'
                                  ? 'border-blue-400/30'
                                  : ''
                              }`}
                              {...props}
                            >
                              {children}
                            </table>
                          </div>
                        );
                      },
                      thead: ({ children, ...props }: any) => {
                        return (
                          <thead
                            className={`${
                              message.role === 'user'
                                ? 'bg-blue-500/20'
                                : 'bg-gray-50 dark:bg-gray-800'
                            }`}
                            {...props}
                          >
                            {children}
                          </thead>
                        );
                      },
                      tbody: ({ children, ...props }: any) => {
                        return (
                          <tbody
                            className={`divide-y divide-gray-200 dark:divide-gray-700 ${
                              message.role === 'user'
                                ? 'divide-blue-400/20'
                                : ''
                            }`}
                            {...props}
                          >
                            {children}
                          </tbody>
                        );
                      },
                      tr: ({ children, ...props }: any) => {
                        return (
                          <tr
                            className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                              message.role === 'user'
                                ? 'hover:bg-blue-500/10'
                                : ''
                            }`}
                            {...props}
                          >
                            {children}
                          </tr>
                        );
                      },
                      th: ({ children, ...props }: any) => {
                        return (
                          <th
                            className={`px-2 py-1 text-xs text-left font-semibold border-b border-gray-300 dark:border-gray-600 whitespace-nowrap ${
                              message.role === 'user'
                                ? 'text-blue-100 border-blue-400/30'
                                : 'text-gray-900 dark:text-gray-100'
                            }`}
                            {...props}
                          >
                            {children}
                          </th>
                        );
                      },
                      td: ({ children, ...props }: any) => {
                        return (
                          <td
                            className={`px-2 py-1 text-xs border-b border-gray-200 dark:border-gray-700 ${
                              message.role === 'user'
                                ? 'text-blue-50 border-blue-400/20'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                            {...props}
                          >
                            {children}
                          </td>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
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

        {/* Input - FIXED AT BOTTOM */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            {error && (
              <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-2 relative">
              <div className="flex-1 relative">
                {showAutocomplete && filteredCommands.length > 0 && (
                  <CommandAutocomplete
                    input={input}
                    cursorPosition={cursorPosition}
                    commands={filteredCommands}
                    selectedIndex={selectedCommandIndex}
                    onSelect={handleCommandSelect}
                    onClose={() => setShowAutocomplete(false)}
                    context={getCommandContext()}
                    inputRef={inputRef}
                  />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onKeyPress={(e) => {
                    // Prevent default Enter behavior to keep focus
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                    }
                  }}
                  placeholder={showAutocomplete ? "Select a command or continue typing..." : "Type your message... (use / for commands)"}
                  disabled={false}
                  autoFocus
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {processingQueue ? `Sending... (${queuedMessages.length} queued)` : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Trace Viewer Sidebar */}
      {showTrace && (
        <>
          {/* Resize Handle */}
          <div
            className="fixed top-0 h-screen cursor-col-resize z-20 transition-colors"
            style={{ 
              right: `${traceWidth - 2}px`,
              width: '6px',
              backgroundColor: isResizing ? 'rgb(59 130 246)' : 'rgba(59, 130, 246, 0.3)'
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
              }
            }}
          />
          <div 
            className="fixed right-0 top-0 h-screen bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg z-10"
            style={{ width: `${traceWidth}px` }}
          >
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
        </>
      )}
    </div>
  );
}

