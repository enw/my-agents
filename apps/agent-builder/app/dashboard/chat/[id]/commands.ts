export type CommandCategory = 'local' | 'config' | 'semantic';

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  allowedTools: string[];
}

export interface CommandContext {
  models: any[];
  runs: any[];
  agent: Agent | null;
  currentModel: string;
  showTrace: boolean;
  allRuns: any[];
  currentRunIndex: number;
}

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  description: string;
  category: CommandCategory;
  usage?: string;
  examples?: string[];
  requiresArgs?: boolean;
  argDescription?: string;
  // For commands that need dynamic suggestions (e.g., /model needs model list)
  getSuggestions?: (context: CommandContext) => Promise<string[]>;
}

export const COMMANDS: CommandDefinition[] = [
  // Local Commands (UI-only, not saved to history)
  {
    name: 'clear',
    aliases: ['new'],
    description: 'Start a new chat session',
    category: 'local',
    usage: '/clear',
    examples: ['/clear', '/new'],
  },
  {
    name: 'prev',
    description: 'Navigate to previous conversation',
    category: 'local',
    usage: '/prev',
    examples: ['/prev'],
  },
  {
    name: 'next',
    description: 'Navigate to next conversation',
    category: 'local',
    usage: '/next',
    examples: ['/next'],
  },
  {
    name: 'latest',
    description: 'Jump to the most recent conversation',
    category: 'local',
    usage: '/latest',
    examples: ['/latest'],
  },
  {
    name: 'trace',
    description: 'Toggle execution trace viewer',
    category: 'local',
    usage: '/trace',
    examples: ['/trace'],
  },
  {
    name: 'help',
    description: 'Show available commands',
    category: 'local',
    usage: '/help',
    examples: ['/help'],
  },
  {
    name: 'queue',
    description: 'Show queued messages',
    category: 'local',
    usage: '/queue',
    examples: ['/queue'],
  },
  {
    name: 'stop',
    description: 'Stop current execution',
    category: 'local',
    usage: '/stop',
    examples: ['/stop'],
  },
  {
    name: 'continue',
    description: 'Continue a specific previous conversation',
    category: 'local',
    usage: '/continue <runId>',
    requiresArgs: true,
    argDescription: 'Run ID to continue',
    examples: ['/continue abc-123'],
    getSuggestions: async (context) => {
      // Return recent run IDs
      return context.runs.slice(0, 10).map((run: any) => run.id);
    },
  },
  
  // Config Commands (affect execution, optionally saved)
  {
    name: 'model',
    description: 'Switch model override or reset to default',
    category: 'config',
    usage: '/model <modelId> or /model reset',
    requiresArgs: false,
    argDescription: 'Model ID or "reset"',
    examples: ['/model ollama/llama3', '/model reset'],
    getSuggestions: async (context) => {
      // Return available model IDs
      return context.models.map((model: any) => model.id);
    },
  },
  {
    name: 'temperature',
    description: 'Set temperature for next request (0.0-2.0)',
    category: 'config',
    usage: '/temperature <value>',
    requiresArgs: true,
    argDescription: 'Temperature value (0.0-2.0)',
    examples: ['/temperature 0.7', '/temperature 1.2'],
  },
  {
    name: 'max-tokens',
    description: 'Set max tokens for next request',
    category: 'config',
    usage: '/max-tokens <value>',
    requiresArgs: true,
    argDescription: 'Maximum tokens',
    examples: ['/max-tokens 2048', '/max-tokens 4096'],
  },
  
  // Semantic Commands (saved to conversation)
  {
    name: 'remember',
    description: 'Save a note for the agent to remember',
    category: 'semantic',
    usage: '/remember <note>',
    requiresArgs: true,
    argDescription: 'Note to remember',
    examples: ['/remember I prefer TypeScript over JavaScript'],
  },
  {
    name: 'context',
    description: 'Add context the agent should know',
    category: 'semantic',
    usage: '/context <info>',
    requiresArgs: true,
    argDescription: 'Context information',
    examples: ['/context Working on a React project'],
  },
  {
    name: 'goal',
    description: 'Set a goal for the conversation',
    category: 'semantic',
    usage: '/goal <objective>',
    requiresArgs: true,
    argDescription: 'Goal or objective',
    examples: ['/goal Build a REST API'],
  },
];

export function getAllCommands(): CommandDefinition[] {
  return COMMANDS;
}

export function getCommandByName(name: string): CommandDefinition | undefined {
  return COMMANDS.find(
    (cmd) => cmd.name === name || cmd.aliases?.includes(name)
  );
}

export function getCommandsByCategory(category: CommandCategory): CommandDefinition[] {
  return COMMANDS.filter((cmd) => cmd.category === category);
}


