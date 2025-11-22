export type RunStatus = 'running' | 'completed' | 'failed' | 'max_turns_reached';

export interface RunLog {
  id: string;
  agentId: string;
  model: string;
  status: RunStatus;
  turns: ConversationTurn[];
  toolExecutions: ToolExecutionLog[];
  usage: TokenUsage;
  createdAt: Date;
  completedAt?: Date;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

export interface ToolCall {
  id?: string;
  name: string;
  parameters: any;
}

export interface ToolExecutionLog {
  toolName: string;
  input: any;
  output: any;
  success: boolean;
  executionTime: number;
  timestamp: Date;
  error?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}
