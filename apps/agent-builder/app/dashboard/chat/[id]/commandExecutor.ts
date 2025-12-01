import { CommandDefinition, CommandContext } from './commands';

export interface CommandResult {
  success: boolean;
  shouldSaveToHistory: boolean;
  transformedMessage?: string; // For semantic commands
  error?: string;
  clearInput?: boolean; // Whether to clear input after execution
}

export interface CommandStateSetters {
  setMessages: (fn: (prev: any[]) => any[]) => void;
  setInput: (value: string) => void;
  setError: (error: string | null) => void;
  setShowTrace: (show: boolean) => void;
  setSelectedModel: (model: string) => void;
  setCurrentRunIndex: (index: number) => void;
  setRunToContinue: (runId: string | null) => void;
  startNewChat: () => void;
  goToPreviousRun: () => void;
  goToNextRun: () => void;
  goToLatestRun: () => void;
  loadConversation: (runId: string) => Promise<void>;
  setTemperature?: (value: number | null) => void;
  setMaxTokens?: (value: number | null) => void;
}

/**
 * Execute a command based on its category and name
 */
export async function executeCommand(
  command: CommandDefinition,
  args: string[],
  context: CommandContext,
  setters: CommandStateSetters
): Promise<CommandResult> {
  try {
    switch (command.category) {
      case 'local':
        return executeLocalCommand(command, args, context, setters);
      case 'config':
        return executeConfigCommand(command, args, context, setters);
      case 'semantic':
        return executeSemanticCommand(command, args);
      default:
        return {
          success: false,
          shouldSaveToHistory: false,
          error: `Unknown command category: ${command.category}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      shouldSaveToHistory: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute local (UI-only) commands
 */
function executeLocalCommand(
  command: CommandDefinition,
  args: string[],
  context: CommandContext,
  setters: CommandStateSetters
): CommandResult {
  switch (command.name) {
    case 'clear':
    case 'new':
      setters.startNewChat();
      setters.setInput('');
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    case 'prev':
      setters.goToPreviousRun();
      setters.setInput('');
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    case 'next':
      setters.goToNextRun();
      setters.setInput('');
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    case 'latest':
      setters.goToLatestRun();
      setters.setInput('');
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    case 'trace':
      setters.setShowTrace(!context.showTrace);
      setters.setInput('');
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    case 'help':
      // Show help - could be a modal or just clear input
      setters.setError(null);
      setters.setInput('');
      // TODO: Could show a help modal here
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    case 'queue':
      // Show queued messages - could display in error area or modal
      setters.setError(null);
      setters.setInput('');
      // TODO: Could show queued messages
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    case 'stop':
      // Stop current execution - would need to implement cancellation
      setters.setError(null);
      setters.setInput('');
      // TODO: Implement execution cancellation
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    case 'continue':
      if (args.length === 0) {
        return {
          success: false,
          shouldSaveToHistory: false,
          error: 'Usage: /continue <runId>',
        };
      }
      const runId = args[0];
      setters.loadConversation(runId);
      setters.setInput('');
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    default:
      return {
        success: false,
        shouldSaveToHistory: false,
        error: `Unknown local command: ${command.name}`,
      };
  }
}

/**
 * Execute configuration commands
 */
function executeConfigCommand(
  command: CommandDefinition,
  args: string[],
  context: CommandContext,
  setters: CommandStateSetters
): CommandResult {
  switch (command.name) {
    case 'model':
      if (args.length === 0) {
        return {
          success: false,
          shouldSaveToHistory: false,
          error: 'Usage: /model <modelId> or /model reset',
        };
      }

      const modelArg = args[0];
      if (modelArg.toLowerCase() === 'reset') {
        setters.setSelectedModel(context.agent?.defaultModel || '');
        setters.setInput('');
        return {
          success: true,
          shouldSaveToHistory: false,
          clearInput: true,
        };
      }

      // Validate model exists
      const model = context.models.find(
        (m: any) => m.id === modelArg || m.displayName.toLowerCase() === modelArg.toLowerCase()
      );
      if (!model) {
        return {
          success: false,
          shouldSaveToHistory: false,
          error: `Model "${modelArg}" not found. Use /help to see available models.`,
        };
      }

      setters.setSelectedModel(model.id);
      setters.setInput('');
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    case 'temperature':
      if (args.length === 0) {
        return {
          success: false,
          shouldSaveToHistory: false,
          error: 'Usage: /temperature <value> (0.0-2.0)',
        };
      }

      const tempValue = parseFloat(args[0]);
      if (isNaN(tempValue) || tempValue < 0 || tempValue > 2) {
        return {
          success: false,
          shouldSaveToHistory: false,
          error: 'Temperature must be between 0.0 and 2.0',
        };
      }

      if (setters.setTemperature) {
        setters.setTemperature(tempValue);
      }
      setters.setInput('');
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    case 'max-tokens':
      if (args.length === 0) {
        return {
          success: false,
          shouldSaveToHistory: false,
          error: 'Usage: /max-tokens <value>',
        };
      }

      const maxTokensValue = parseInt(args[0], 10);
      if (isNaN(maxTokensValue) || maxTokensValue <= 0) {
        return {
          success: false,
          shouldSaveToHistory: false,
          error: 'Max tokens must be a positive number',
        };
      }

      if (setters.setMaxTokens) {
        setters.setMaxTokens(maxTokensValue);
      }
      setters.setInput('');
      return {
        success: true,
        shouldSaveToHistory: false,
        clearInput: true,
      };

    default:
      return {
        success: false,
        shouldSaveToHistory: false,
        error: `Unknown config command: ${command.name}`,
      };
  }
}

/**
 * Execute semantic commands (transformed and saved to conversation)
 */
function executeSemanticCommand(
  command: CommandDefinition,
  args: string[]
): CommandResult {
  if (args.length === 0) {
    return {
      success: false,
      shouldSaveToHistory: false,
      error: `Usage: ${command.usage || `/${command.name} <value>`}`,
    };
  }

  const content = args.join(' ');
  let transformedMessage: string;

  switch (command.name) {
    case 'remember':
      transformedMessage = `[Remember this: ${content}]`;
      break;
    case 'context':
      transformedMessage = `[Context: ${content}]`;
      break;
    case 'goal':
      transformedMessage = `[Goal: ${content}]`;
      break;
    default:
      return {
        success: false,
        shouldSaveToHistory: false,
        error: `Unknown semantic command: ${command.name}`,
      };
  }

  return {
    success: true,
    shouldSaveToHistory: true,
    transformedMessage,
  };
}


