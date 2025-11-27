/**
 * Core Port Interfaces - Domain Layer
 *
 * These interfaces define the contracts between the domain layer and infrastructure.
 * All dependencies point INWARD to the domain.
 */

// ============================================================================
// MODEL PORT - LLM Provider Abstraction
// ============================================================================

export interface ModelPort {
  /**
   * Generate a response from the LLM
   * @throws ModelError if generation fails
   */
  generate(request: GenerateRequest): Promise<GenerateResponse>;

  /**
   * Generate with streaming support
   * @returns AsyncGenerator that yields tokens as they arrive
   */
  generateStream(request: GenerateRequest): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Check if the model is available/healthy
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Get model capabilities (context window, tool support, etc.)
   */
  getCapabilities(): ModelCapabilities;
}

export interface GenerateRequest {
  systemPrompt: string;
  messages: Message[];
  tools?: ToolDefinition[];
  settings?: ModelSettings;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string; // For tool results
  toolCalls?: ToolCall[]; // For assistant messages requesting tool calls
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
}

export interface GenerateResponse {
  content: string;
  toolCalls: ToolCall[];
  usage: TokenUsage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  metadata: {
    model: string;
    latencyMs: number;
    provider: string;
  };
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: Partial<ToolCall>;
  usage?: TokenUsage;
  error?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelSettings {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface HealthStatus {
  available: boolean;
  latencyMs?: number;
  error?: string;
}

export interface ModelCapabilities {
  maxContextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
}

// ============================================================================
// AGENT PORT - Agent Configuration Management
// ============================================================================

export interface AgentPort {
  /**
   * Create a new agent configuration
   * @throws ValidationError if agent data is invalid
   */
  create(data: CreateAgentData): Promise<Agent>;

  /**
   * Find agent by ID
   * @returns Agent or null if not found
   */
  findById(id: string): Promise<Agent | null>;

  /**
   * Find agents by criteria
   */
  findMany(criteria: AgentQueryCriteria): Promise<Agent[]>;

  /**
   * Update agent configuration
   * @throws NotFoundError if agent doesn't exist
   * @throws ValidationError if update data is invalid
   */
  update(id: string, data: UpdateAgentData): Promise<Agent>;

  /**
   * Delete agent
   * @throws NotFoundError if agent doesn't exist
   */
  delete(id: string): Promise<void>;

  /**
   * Check if agent exists
   */
  exists(id: string): Promise<boolean>;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  allowedTools: string[];
  tags: string[];
  settings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentData {
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  allowedTools?: string[];
  tags?: string[];
  settings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

export interface UpdateAgentData {
  name?: string;
  description?: string;
  systemPrompt?: string;
  defaultModel?: string;
  allowedTools?: string[];
  tags?: string[];
  settings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

export interface AgentQueryCriteria {
  tags?: string[];
  search?: string; // Search in name/description
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  orderDir?: 'asc' | 'desc';
}

// ============================================================================
// TOOL PORT - Tool Registry & Execution
// ============================================================================

export interface ToolPort {
  /**
   * Register a tool in the system
   * @throws DuplicateToolError if tool with same name exists
   */
  register(tool: Tool): void;

  /**
   * Get tool by name
   * @returns Tool or null if not found
   */
  get(name: string): Tool | null;

  /**
   * List all registered tools
   */
  listAll(): Tool[];

  /**
   * List tools by names (for agent allowed tools)
   */
  listByNames(names: string[]): Tool[];

  /**
   * Execute a tool
   * @throws ToolNotFoundError if tool doesn't exist
   * @throws ToolExecutionError if execution fails
   */
  execute(name: string, parameters: Record<string, unknown>): Promise<ToolResult>;

  /**
   * Validate tool parameters against schema
   * @throws ValidationError if parameters are invalid
   */
  validateParameters(name: string, parameters: Record<string, unknown>): void;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameterSchema;

  /**
   * Execute the tool
   * Should be idempotent where possible
   * Must not throw - return error in ToolResult instead
   */
  execute(parameters: Record<string, unknown>): Promise<ToolResult>;

  /**
   * Optional: Check if tool is available (e.g., Ollama is running)
   */
  isAvailable?(): Promise<boolean>;
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required?: boolean;
    enum?: string[];
    items?: { type: string };
  }>;
  required: string[];
}

export interface ToolResult {
  success: boolean;
  output: string; // Human-readable output
  data?: unknown; // Structured data
  error?: string;
  executionTimeMs: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

// ============================================================================
// TRACE PORT - Execution Logging & Observability
// ============================================================================

export interface TracePort {
  /**
   * Create a new run trace
   */
  createRun(data: CreateRunData): Promise<Run>;

  /**
   * Append a turn (user message + assistant response) to a run
   */
  appendTurn(runId: string, turn: Turn): Promise<void>;

  /**
   * Log a tool execution within a run
   */
  logToolExecution(runId: string, execution: ToolExecution): Promise<void>;

  /**
   * Update run status (for error handling)
   */
  updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<void>;

  /**
   * Get run by ID with all turns and tool executions
   */
  getRun(runId: string): Promise<Run | null>;

  /**
   * Query runs by criteria
   */
  queryRuns(criteria: RunQueryCriteria): Promise<Run[]>;

  /**
   * Get tool execution statistics for an agent
   */
  getToolStats(agentId: string): Promise<ToolStats[]>;
}

export interface Run {
  id: string;
  agentId: string;
  modelUsed: string;
  status: RunStatus;
  turns: Turn[];
  totalTokens: TokenUsage;
  totalToolCalls: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export type RunStatus = 'running' | 'completed' | 'error';

export interface CreateRunData {
  agentId: string;
  modelUsed: string;
}

export interface Turn {
  turnNumber: number;
  userMessage: string;
  assistantMessage: string;
  toolExecutions: ToolExecution[];
  usage: TokenUsage;
  timestamp: Date;
}

export interface ToolExecution {
  id: string;
  toolName: string;
  parameters: Record<string, unknown>;
  result: ToolResult;
  timestamp: Date;
}

export interface RunQueryCriteria {
  agentId?: string;
  status?: RunStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ToolStats {
  toolName: string;
  totalExecutions: number;
  successRate: number;
  avgExecutionTimeMs: number;
}

// ============================================================================
// MODEL REGISTRY PORT - Model Discovery & Metadata
// ============================================================================

export interface ModelRegistryPort {
  /**
   * List all available models from all providers
   */
  listAllModels(): Promise<ModelInfo[]>;

  /**
   * List models from a specific provider
   */
  listByProvider(provider: ModelProvider): Promise<ModelInfo[]>;

  /**
   * Get detailed model information
   */
  getModelInfo(modelId: string): Promise<ModelInfo | null>;

  /**
   * Refresh model list (fetch from providers)
   */
  refresh(): Promise<void>;

  /**
   * Record model usage for future selection logic
   */
  recordUsage(modelId: string, metrics: UsageMetrics): Promise<void>;
}

export type ModelProvider = 'ollama' | 'openrouter' | 'openai' | 'anthropic';

export interface ModelInfo {
  id: string; // Unique identifier (e.g., "ollama:llama3.2", "openrouter:anthropic/claude-3.5-sonnet")
  provider: ModelProvider;
  displayName: string;
  size?: string; // e.g., "8B", "70B"
  contextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  cost?: {
    inputPer1M: number;
    outputPer1M: number;
  };
  speed?: number; // tokens/sec estimate
  strengths?: string[]; // e.g., ["reasoning", "code", "creative"]
  lastUsed?: Date;
  metadata: Record<string, unknown>; // Provider-specific metadata
}

export interface UsageMetrics {
  latencyMs: number;
  tokensPerSecond: number;
  quality?: number; // User-provided rating (future feature)
}

// ============================================================================
// STREAMING PORT - Real-time Response Streaming
// ============================================================================

export interface StreamingPort {
  /**
   * Create a new stream session
   * @returns Session ID for client to connect to
   */
  createSession(): Promise<string>;

  /**
   * Send a chunk to a stream session
   */
  send(sessionId: string, chunk: StreamChunk): Promise<void>;

  /**
   * Complete a stream session
   */
  complete(sessionId: string): Promise<void>;

  /**
   * Handle stream errors
   */
  error(sessionId: string, error: string): Promise<void>;

  /**
   * Close a stream session
   */
  close(sessionId: string): Promise<void>;
}

// ============================================================================
// DOMAIN ERRORS
// ============================================================================

export class DomainError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ModelError extends DomainError {
  constructor(message: string, public provider: string) {
    super(message, 'MODEL_ERROR');
    this.name = 'ModelError';
  }
}

export class ToolExecutionError extends DomainError {
  constructor(message: string, public toolName: string) {
    super(message, 'TOOL_EXECUTION_ERROR');
    this.name = 'ToolExecutionError';
  }
}

export class UnauthorizedToolError extends DomainError {
  constructor(toolName: string, agentId: string) {
    super(`Tool ${toolName} is not allowed for agent ${agentId}`, 'UNAUTHORIZED_TOOL');
    this.name = 'UnauthorizedToolError';
  }
}
