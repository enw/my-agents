'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TraceViewer from '../../../components/TraceViewer';
import ThemeToggle from '../../../components/ThemeToggle';
import CommandAutocomplete from './CommandAutocomplete';
import CommandHelpModal from '../../../components/CommandHelpModal';
import CommandPalette from '../../../components/CommandPalette';
import ChatSidebar from '../../../components/ChatSidebar';
import ChatRightPanel from '../../../components/ChatRightPanel';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
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
  const [currentRunIndex, setCurrentRunIndex] = useState<number>(-1); // -1 means viewing latest/new conversation
  const [allRuns, setAllRuns] = useState<any[]>([]); // All runs for navigation
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [runToContinue, setRunToContinue] = useState<string | null>(null); // Track which run we're continuing
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const assistantMessageIndexRef = useRef<number>(-1);
  
  // Command autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<CommandDefinition[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

  // Handle Cmd+K / Ctrl+K for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


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

  function goToPreviousRun() {
    if (currentRunIndex > 0) {
      loadRunByIndex(currentRunIndex - 1);
    }
  }

  function goToNextRun() {
    if (currentRunIndex < allRuns.length - 1) {
      loadRunByIndex(currentRunIndex + 1);
    }
  }

  function goToLatestRun() {
    if (allRuns.length > 0) {
      loadRunByIndex(0);
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
        if (result.showHelp) {
          // Show help modal
          setShowHelpModal(true);
        } else if (result.shouldSaveToHistory && result.transformedMessage) {
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

  // Check if user has scrolled up to show "Jump to latest" button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowJumpToLatest(!isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages]);

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
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue"></div>
          <p className="mt-4 text-sm text-text-muted">Loading agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-bg-base flex overflow-hidden">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Left Panel: Conversation List */}
        <Panel defaultSize={20} minSize={15} maxSize={30} className="min-w-[180px]">
          <ChatSidebar
            allRuns={allRuns}
            currentRunIndex={currentRunIndex}
            onLoadConversation={loadConversation}
            onGoToPrevious={goToPreviousRun}
            onGoToNext={goToNextRun}
            onGoToLatest={goToLatestRun}
          />
        </Panel>

        <PanelResizeHandle className="w-1 bg-border-subtle hover:bg-border-strong transition-colors" />

        {/* Center Panel: Chat Messages */}
        <Panel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-bg-base">
            {/* Header - Compact */}
            <div className="flex-shrink-0 bg-bg-elevated border-b border-border-subtle px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard"
                    className="text-xs text-text-secondary hover:text-text-primary transition"
                  >
                    ← Dashboard
                  </Link>
                  <span className="text-xs text-text-muted">•</span>
                  <h1 className="text-sm font-medium text-text-primary">
                    {agent.name}
                  </h1>
                  {selectedModel && selectedModel !== agent.defaultModel && (
                    <>
                      <span className="text-xs text-text-muted">•</span>
                      <span className="text-xs text-text-muted font-mono">
                        {selectedModel.split(':').pop()}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCommandPalette(true)}
                    className="px-2 py-1 text-xs bg-bg-subtle text-text-secondary border border-border-subtle rounded-sm hover:bg-bg-hover transition"
                    title="Open command palette (Cmd+K)"
                  >
                    ⌘K
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/edit/${agent.id}`)}
                    className="px-2 py-1 text-xs bg-bg-subtle text-text-secondary border border-border-subtle rounded-sm hover:bg-bg-hover transition"
                    title="Edit agent"
                  >
                    ✏️
                  </button>
                  <ThemeToggle />
                </div>
              </div>
            </div>

            {/* Messages - SCROLLABLE */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-3 py-2 min-h-0 overscroll-contain"
              onClick={() => {
                // Refocus input when clicking in message area
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
            >
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-text-muted mb-3">
                    Start a conversation with {agent.name}
                  </p>
                  <button
                    onClick={() => inputRef.current?.focus()}
                    className="px-3 py-1.5 text-xs bg-accent-blue text-text-inverse rounded-sm hover:opacity-90 transition"
                  >
                    Start Chatting
                  </button>
                </div>
              )}
              
              <div className="max-w-[780px] mx-auto space-y-1">
                {messages.map((message, idx) => {
                  const isUser = message.role === 'user';
                  const modelTag = currentRun?.modelUsed || agent?.defaultModel || '';
                  const tokens = currentRun?.totalTokens?.totalTokens || 0;
                  
                  return (
                    <div key={idx} className="py-1">
                      {/* Sender line */}
                      <div className={`flex items-center gap-2 mb-1 text-xs ${
                        isUser ? 'justify-end' : 'justify-start'
                      }`}>
                        {!isUser && (
                          <>
                            <span className="text-text-primary font-medium">{agent.name}</span>
                            <span className="text-text-muted">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {modelTag && (
                              <>
                                <span className="text-text-muted">•</span>
                                <span className="text-text-muted font-mono">{modelTag.split(':').pop()}</span>
                              </>
                            )}
                            {tokens > 0 && idx === messages.length - 1 && (
                              <>
                                <span className="text-text-muted">•</span>
                                <span className="text-text-muted">{tokens.toLocaleString()} tokens</span>
                              </>
                            )}
                          </>
                        )}
                        {isUser && (
                          <>
                            <span className="text-text-muted">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-text-primary font-medium">You</span>
                          </>
                        )}
                      </div>
                      
                      {/* Message content */}
                      <div
                        className={`relative rounded-sm px-2 py-1.5 group ${
                          isUser
                            ? 'bg-bg-elevated text-text-primary ml-auto max-w-[80%]'
                            : 'bg-bg-subtle text-text-primary'
                        }`}
                      >
                        {/* Copy button - appears on hover */}
                        <button
                          onClick={() => handleCopyMessage(message.content, idx)}
                          className={`absolute top-1 right-1 p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary hover:bg-bg-hover`}
                          title="Copy to clipboard"
                        >
                          {copiedMessageId === idx ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className={`prose prose-invert max-w-none text-xs
                            prose-headings:mt-0 prose-headings:mb-1 prose-headings:font-semibold prose-headings:text-text-primary
                            prose-p:my-1 prose-p:leading-relaxed prose-p:text-text-primary
                            prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                            prose-code:text-xs prose-code:font-mono prose-code:bg-bg-elevated prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm
                            prose-pre:bg-bg-elevated prose-pre:border prose-pre:border-border-subtle
                            prose-pre:text-text-primary prose-pre:rounded-sm prose-pre:p-2 prose-pre:overflow-x-auto prose-pre:text-xs
                            prose-a:text-accent-blue prose-a:no-underline hover:prose-a:underline
                            prose-strong:font-semibold prose-strong:text-text-primary
                            prose-blockquote:border-l-2 prose-blockquote:border-border-subtle prose-blockquote:pl-2 prose-blockquote:italic prose-blockquote:text-text-secondary
                            prose-table:w-full prose-table:border-collapse prose-table:my-2 prose-table:text-xs
                            prose-th:border prose-th:border-border-subtle prose-th:bg-bg-elevated prose-th:p-1.5 prose-th:font-semibold prose-th:text-left prose-th:text-text-primary
                            prose-td:border prose-td:border-border-subtle prose-td:p-1.5 prose-td:text-text-secondary
                            prose-tr:hover:bg-bg-hover`}
                    components={{
                      code: ({ node, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        
                        if (isInline) {
                          // Inline code styling
                          return (
                            <code 
                              className={`bg-bg-elevated px-1 py-0.5 rounded-sm text-xs font-mono text-text-primary`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }
                        
                        // Code block styling
                        return (
                          <code 
                            className={`block w-full p-0 bg-transparent text-xs font-mono text-text-primary`}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children, ...props }: any) => {
                        return (
                          <pre 
                            className={`my-2 rounded-sm p-2 overflow-x-auto bg-bg-elevated border border-border-subtle text-xs`}
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
                            className={`text-accent-blue hover:underline transition-colors`}
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
                              className={`w-full border-collapse border border-border-subtle rounded-sm overflow-hidden text-xs`}
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
                            className={`bg-bg-elevated`}
                            {...props}
                          >
                            {children}
                          </thead>
                        );
                      },
                      tbody: ({ children, ...props }: any) => {
                        return (
                          <tbody
                            className={`divide-y divide-border-subtle`}
                            {...props}
                          >
                            {children}
                          </tbody>
                        );
                      },
                      tr: ({ children, ...props }: any) => {
                        return (
                          <tr
                            className={`hover:bg-bg-hover transition-colors`}
                            {...props}
                          >
                            {children}
                          </tr>
                        );
                      },
                      th: ({ children, ...props }: any) => {
                        return (
                          <th
                            className={`px-2 py-1 text-xs text-left font-semibold border-b border-border-subtle whitespace-nowrap text-text-primary`}
                            {...props}
                          >
                            {children}
                          </th>
                        );
                      },
                      td: ({ children, ...props }: any) => {
                        return (
                          <td
                            className={`px-2 py-1 text-xs border-b border-border-subtle text-text-secondary`}
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
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Jump to latest button */}
              {showJumpToLatest && (
                <button
                  onClick={scrollToBottom}
                  className="fixed bottom-20 right-6 px-2 py-1 text-xs bg-bg-elevated text-text-primary border border-border-subtle rounded-sm hover:bg-bg-hover transition shadow-soft z-20"
                  style={{ height: '28px' }}
                >
                  ↓ Latest
                </button>
              )}
            </div>

            {/* Input - Compact */}
            <div className="flex-shrink-0 bg-bg-elevated border-t border-border-subtle px-3 py-2">
              {error && (
                <div className="mb-2 p-1.5 text-xs bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-2 relative max-w-[780px] mx-auto">
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
                    className="w-full px-2.5 py-1 text-sm bg-bg-subtle text-text-primary border border-border-subtle rounded-sm focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/40"
                    style={{ height: '30px' }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="px-3 py-1 text-xs bg-accent-blue text-text-inverse rounded-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  style={{ height: '30px' }}
                >
                  {processingQueue ? `Sending (${queuedMessages.length})` : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border-subtle hover:bg-border-strong transition-colors" />

        {/* Right Panel: Tools/Trace/Files/Notes */}
        <Panel defaultSize={30} minSize={20} maxSize={40} className="min-w-[200px]">
          <ChatRightPanel
            agent={agent}
            currentRun={currentRun}
            showTrace={showTrace}
            onToggleTrace={() => setShowTrace(!showTrace)}
            loading={loading && !currentRun}
          />
        </Panel>
      </PanelGroup>


      {/* Help Modal */}
      <CommandHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onSelectCommand={(command) => {
          setShowCommandPalette(false);
          setInput(`/${command.name} `);
          inputRef.current?.focus();
        }}
        agentId={agentId}
        runs={allRuns}
      />
    </div>
  );
}

