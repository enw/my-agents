import { CommandDefinition, CommandContext, getAllCommands, getCommandByName } from './commands';

export interface ParsedCommand {
  command: string;
  args: string[];
  fullText: string;
  isCommand: boolean;
  query: string; // For filtering commands
}

/**
 * Parse input to extract command name and arguments
 */
export function parseCommand(input: string, cursorPos: number = input.length): ParsedCommand {
  const trimmed = input.trim();
  
  if (!trimmed.startsWith('/')) {
    return {
      command: '',
      args: [],
      fullText: input,
      isCommand: false,
      query: '',
    };
  }

  // Extract the part before cursor for command matching
  const beforeCursor = input.slice(0, cursorPos);
  const parts = beforeCursor.trim().split(/\s+/);
  
  // First part is the command (without /)
  const commandPart = parts[0]?.slice(1) || '';
  
  // Rest are arguments
  const args = parts.slice(1);
  
  // Query is what user has typed so far (for filtering)
  const query = commandPart.toLowerCase();

  return {
    command: commandPart,
    args,
    fullText: input,
    isCommand: true,
    query,
  };
}

/**
 * Filter commands based on query string
 */
export function filterCommands(
  commands: CommandDefinition[],
  query: string
): CommandDefinition[] {
  if (!query) {
    return commands;
  }

  const lowerQuery = query.toLowerCase();
  
  return commands.filter((cmd) => {
    // Match command name
    if (cmd.name.toLowerCase().startsWith(lowerQuery)) {
      return true;
    }
    
    // Match aliases
    if (cmd.aliases?.some((alias) => alias.toLowerCase().startsWith(lowerQuery))) {
      return true;
    }
    
    // Match description keywords
    if (cmd.description.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    return false;
  });
}

/**
 * Get command suggestions for a specific command
 */
export async function getCommandSuggestions(
  command: CommandDefinition,
  args: string[],
  context: CommandContext
): Promise<string[]> {
  if (!command.getSuggestions) {
    return [];
  }

  try {
    const suggestions = await command.getSuggestions(context);
    
    // Filter suggestions based on current args if provided
    if (args.length > 0) {
      const lastArg = args[args.length - 1].toLowerCase();
      return suggestions.filter((suggestion) =>
        suggestion.toLowerCase().includes(lastArg)
      );
    }
    
    return suggestions;
  } catch (error) {
    console.error('Error getting command suggestions:', error);
    return [];
  }
}

/**
 * Check if input is a complete command (has command name, may have args)
 */
export function isCompleteCommand(input: string): boolean {
  const parsed = parseCommand(input);
  if (!parsed.isCommand) {
    return false;
  }
  
  const command = getCommandByName(parsed.command);
  if (!command) {
    return false;
  }
  
  // If command requires args, check if at least one is provided
  if (command.requiresArgs) {
    return parsed.args.length > 0;
  }
  
  return true;
}

/**
 * Get the best matching command for autocomplete
 */
export function getBestMatch(
  commands: CommandDefinition[],
  query: string
): CommandDefinition | null {
  if (!query) {
    return null;
  }

  const lowerQuery = query.toLowerCase();
  
  // Exact match first
  const exactMatch = commands.find(
    (cmd) => cmd.name.toLowerCase() === lowerQuery
  );
  if (exactMatch) {
    return exactMatch;
  }
  
  // Alias match
  const aliasMatch = commands.find(
    (cmd) => cmd.aliases?.some((alias) => alias.toLowerCase() === lowerQuery)
  );
  if (aliasMatch) {
    return aliasMatch;
  }
  
  // Prefix match
  const prefixMatch = commands.find(
    (cmd) => cmd.name.toLowerCase().startsWith(lowerQuery)
  );
  if (prefixMatch) {
    return prefixMatch;
  }
  
  return null;
}

/**
 * Complete command name from partial input
 */
export function completeCommandName(input: string): string | null {
  const parsed = parseCommand(input);
  if (!parsed.isCommand || !parsed.query) {
    return null;
  }

  const allCommands = getAllCommands();
  const filtered = filterCommands(allCommands, parsed.query);
  
  if (filtered.length === 1) {
    return `/${filtered[0].name}`;
  }
  
  // Check if there's a unique prefix match
  const prefixMatches = filtered.filter((cmd) =>
    cmd.name.toLowerCase().startsWith(parsed.query)
  );
  
  if (prefixMatches.length === 1) {
    return `/${prefixMatches[0].name}`;
  }
  
  return null;
}



