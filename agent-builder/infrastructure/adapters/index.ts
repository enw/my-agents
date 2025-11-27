/**
 * Adapter Implementations - Infrastructure Layer
 *
 * These adapters implement the port interfaces and handle all external dependencies.
 * They translate between the domain model and external systems.
 */

import {
  Agent,
  AgentPort,
  AgentQueryCriteria,
  CreateAgentData,
  GenerateRequest,
  GenerateResponse,
  HealthStatus,
  ModelCapabilities,
  ModelError,
  ModelInfo,
  ModelPort,
  ModelProvider,
  ModelRegistryPort,
  NotFoundError,
  Run,
  RunQueryCriteria,
  RunStatus,
  StreamChunk,
  StreamingPort,
  Tool,
  ToolExecution,
  ToolPort,
  ToolResult,
  TracePort,
  Turn,
  UpdateAgentData,
  UsageMetrics,
  ValidationError,
} from '../../domain/ports';

// ============================================================================
// MODEL ADAPTERS - LLM Provider Implementations
// ============================================================================

/**
 * Ollama Model Adapter - Local models via Ollama API
 */
export class OllamaModelAdapter implements ModelPort {
  private baseUrl: string;
  private modelName: string;

  constructor(modelName: string, baseUrl = 'http://localhost:11434') {
    this.modelName = modelName;
    this.baseUrl = baseUrl;
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      // Convert to Ollama format
      const ollamaRequest = this.convertToOllamaFormat(request);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: ollamaRequest.messages,
          tools: ollamaRequest.tools,
          stream: false,
          options: {
            temperature: request.settings?.temperature,
            num_predict: request.settings?.maxTokens,
            top_p: request.settings?.topP,
            stop: request.settings?.stopSequences,
          },
        }),
      });

      if (!response.ok) {
        throw new ModelError(
          `Ollama request failed: ${response.statusText}`,
          'ollama'
        );
      }

      const data = await response.json();

      return {
        content: data.message.content,
        toolCalls: this.parseOllamaToolCalls(data.message.tool_calls || []),
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        finishReason: data.done ? 'stop' : 'length',
        metadata: {
          model: this.modelName,
          latencyMs: Date.now() - startTime,
          provider: 'ollama',
        },
      };
    } catch (error) {
      if (error instanceof ModelError) throw error;
      throw new ModelError(
        `Ollama error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ollama'
      );
    }
  }

  async *generateStream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    try {
      const ollamaRequest = this.convertToOllamaFormat(request);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: ollamaRequest.messages,
          tools: ollamaRequest.tools,
          stream: true,
        }),
      });

      if (!response.ok) {
        yield {
          type: 'error',
          error: `Ollama request failed: ${response.statusText}`,
        };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            const chunk = JSON.parse(line);

            if (chunk.message?.content) {
              yield { type: 'content', content: chunk.message.content };
            }

            if (chunk.message?.tool_calls) {
              for (const toolCall of chunk.message.tool_calls) {
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: toolCall.id || crypto.randomUUID(),
                    name: toolCall.function.name,
                    parameters: JSON.parse(toolCall.function.arguments),
                  },
                };
              }
            }

            if (chunk.done) {
              yield {
                type: 'done',
                usage: {
                  inputTokens: chunk.prompt_eval_count || 0,
                  outputTokens: chunk.eval_count || 0,
                  totalTokens:
                    (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0),
                },
              };
            }
          }
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return {
          available: false,
          error: `Ollama not responding: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const modelExists = data.models?.some(
        (m: any) => m.name === this.modelName
      );

      if (!modelExists) {
        return {
          available: false,
          error: `Model ${this.modelName} not found in Ollama`,
        };
      }

      return {
        available: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getCapabilities(): ModelCapabilities {
    return {
      maxContextWindow: 8192, // Conservative default, should be model-specific
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: false, // Model-dependent
    };
  }

  private convertToOllamaFormat(request: GenerateRequest) {
    const messages = [
      { role: 'system', content: request.systemPrompt },
      ...request.messages.map((m) => ({
        role: m.role === 'tool' ? 'tool' : m.role,
        content: m.content,
        tool_call_id: m.toolCallId,
      })),
    ];

    const tools = request.tools?.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    return { messages, tools };
  }

  private parseOllamaToolCalls(ollamaToolCalls: any[]) {
    return ollamaToolCalls.map((tc) => ({
      id: tc.id || crypto.randomUUID(),
      name: tc.function.name,
      parameters: JSON.parse(tc.function.arguments),
    }));
  }
}

/**
 * OpenRouter Model Adapter - Remote models via OpenRouter API
 */
export class OpenRouterModelAdapter implements ModelPort {
  private apiKey: string;
  private modelName: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(modelName: string, apiKey: string) {
    this.modelName = modelName;
    this.apiKey = apiKey;
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      const openRouterRequest = this.convertToOpenRouterFormat(request);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Local Agent Builder',
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: openRouterRequest.messages,
          tools: openRouterRequest.tools,
          temperature: request.settings?.temperature,
          max_tokens: request.settings?.maxTokens,
          top_p: request.settings?.topP,
          stop: request.settings?.stopSequences,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new ModelError(
          `OpenRouter request failed: ${response.statusText} - ${error}`,
          'openrouter'
        );
      }

      const data = await response.json();
      const choice = data.choices[0];

      return {
        content: choice.message.content || '',
        toolCalls: this.parseOpenRouterToolCalls(choice.message.tool_calls || []),
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        finishReason: this.mapFinishReason(choice.finish_reason),
        metadata: {
          model: this.modelName,
          latencyMs: Date.now() - startTime,
          provider: 'openrouter',
        },
      };
    } catch (error) {
      if (error instanceof ModelError) throw error;
      throw new ModelError(
        `OpenRouter error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'openrouter'
      );
    }
  }

  async *generateStream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    try {
      const openRouterRequest = this.convertToOpenRouterFormat(request);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Local Agent Builder',
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: openRouterRequest.messages,
          tools: openRouterRequest.tools,
          stream: true,
        }),
      });

      if (!response.ok) {
        yield {
          type: 'error',
          error: `OpenRouter request failed: ${response.statusText}`,
        };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

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
              yield { type: 'done' };
              return;
            }

            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices[0]?.delta;

              if (delta?.content) {
                yield { type: 'content', content: delta.content };
              }

              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.function?.name) {
                    yield {
                      type: 'tool_call',
                      toolCall: {
                        id: toolCall.id,
                        name: toolCall.function.name,
                        parameters: JSON.parse(toolCall.function.arguments || '{}'),
                      },
                    };
                  }
                }
              }
            } catch (e) {
              // Skip malformed chunks
            }
          }
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      return {
        available: response.ok,
        latencyMs: Date.now() - startTime,
        error: response.ok ? undefined : 'OpenRouter API key invalid or service unavailable',
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getCapabilities(): ModelCapabilities {
    // Model-specific capabilities would be fetched from OpenRouter metadata
    return {
      maxContextWindow: 128000, // Conservative default
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: false, // Model-dependent
    };
  }

  private convertToOpenRouterFormat(request: GenerateRequest) {
    const messages = [
      { role: 'system', content: request.systemPrompt },
      ...request.messages.map((m) => ({
        role: m.role,
        content: m.content,
        tool_call_id: m.toolCallId,
        tool_calls: m.toolCalls,
      })),
    ];

    const tools = request.tools?.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    return { messages, tools };
  }

  private parseOpenRouterToolCalls(toolCalls: any[]) {
    return toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      parameters: JSON.parse(tc.function.arguments),
    }));
  }

  private mapFinishReason(reason: string): 'stop' | 'tool_calls' | 'length' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
      case 'function_call':
        return 'tool_calls';
      case 'length':
        return 'length';
      default:
        return 'error';
    }
  }
}

/**
 * Model Factory - Creates appropriate adapter based on model ID
 */
export class ModelFactory {
  constructor(
    private config: {
      openRouterApiKey?: string;
      openAiApiKey?: string;
      anthropicApiKey?: string;
    }
  ) {}

  create(modelId: string): ModelPort {
    const [provider, ...modelParts] = modelId.split(':');
    const modelName = modelParts.join(':');

    switch (provider) {
      case 'ollama':
        return new OllamaModelAdapter(modelName);

      case 'openrouter':
        if (!this.config.openRouterApiKey) {
          throw new ModelError('OpenRouter API key not configured', 'openrouter');
        }
        return new OpenRouterModelAdapter(modelName, this.config.openRouterApiKey);

      // Add OpenAI, Anthropic adapters similarly
      // case 'openai':
      //   return new OpenAIModelAdapter(modelName, this.config.openAiApiKey);

      default:
        throw new ModelError(`Unknown provider: ${provider}`, provider);
    }
  }
}

// ============================================================================
// AGENT REPOSITORY - SQLite Persistence
// ============================================================================

export class SqliteAgentRepository implements AgentPort {
  constructor(private db: any) {} // Drizzle DB instance

  async create(data: CreateAgentData): Promise<Agent> {
    const id = crypto.randomUUID();
    const now = new Date();

    const agent: Agent = {
      id,
      name: data.name,
      description: data.description,
      systemPrompt: data.systemPrompt,
      defaultModel: data.defaultModel,
      allowedTools: data.allowedTools || [],
      tags: data.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    // Insert using Drizzle
    // await this.db.insert(agentsTable).values(agent);

    return agent;
  }

  async findById(id: string): Promise<Agent | null> {
    // const result = await this.db.select().from(agentsTable).where(eq(agentsTable.id, id));
    // return result[0] || null;
    throw new Error('Not implemented - requires Drizzle schema');
  }

  async findMany(criteria: AgentQueryCriteria): Promise<Agent[]> {
    // Build dynamic query with Drizzle
    throw new Error('Not implemented - requires Drizzle schema');
  }

  async update(id: string, data: UpdateAgentData): Promise<Agent> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Agent', id);
    }

    const updated: Agent = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };

    // await this.db.update(agentsTable).set(updated).where(eq(agentsTable.id, id));

    return updated;
  }

  async delete(id: string): Promise<void> {
    const exists = await this.exists(id);
    if (!exists) {
      throw new NotFoundError('Agent', id);
    }

    // await this.db.delete(agentsTable).where(eq(agentsTable.id, id));
  }

  async exists(id: string): Promise<boolean> {
    const agent = await this.findById(id);
    return agent !== null;
  }
}

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * In-Memory Tool Registry
 */
export class InMemoryToolRegistry implements ToolPort {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new ValidationError(`Tool ${tool.name} already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | null {
    return this.tools.get(name) || null;
  }

  listAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  listByNames(names: string[]): Tool[] {
    return names
      .map((name) => this.tools.get(name))
      .filter((tool): tool is Tool => tool !== undefined);
  }

  async execute(name: string, parameters: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        output: `Tool ${name} not found`,
        error: `Tool ${name} not found`,
        executionTimeMs: 0,
      };
    }

    this.validateParameters(name, parameters);

    const startTime = Date.now();
    const result = await tool.execute(parameters);
    result.executionTimeMs = Date.now() - startTime;

    return result;
  }

  validateParameters(name: string, parameters: Record<string, unknown>): void {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ValidationError(`Tool ${name} not found`);
    }

    // Basic validation - check required parameters
    for (const requiredParam of tool.parameters.required) {
      if (!(requiredParam in parameters)) {
        throw new ValidationError(
          `Missing required parameter: ${requiredParam}`,
          requiredParam
        );
      }
    }

    // Type validation would go here
  }
}

// ============================================================================
// STREAMING ADAPTERS
// ============================================================================

/**
 * SSE (Server-Sent Events) Streaming Adapter
 */
export class SSEStreamingAdapter implements StreamingPort {
  private sessions = new Map<string, any>(); // Would be Response objects

  async createSession(): Promise<string> {
    const sessionId = crypto.randomUUID();
    // Session would be created when client connects
    return sessionId;
  }

  async send(sessionId: string, chunk: StreamChunk): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Send SSE event
    // session.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  async complete(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      // session.write('data: [DONE]\n\n');
      // session.end();
      this.sessions.delete(sessionId);
    }
  }

  async error(sessionId: string, error: string): Promise<void> {
    await this.send(sessionId, { type: 'error', error });
    await this.close(sessionId);
  }

  async close(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      // session.end();
      this.sessions.delete(sessionId);
    }
  }

  registerSession(sessionId: string, session: any): void {
    this.sessions.set(sessionId, session);
  }
}

// ============================================================================
// MODEL REGISTRY IMPLEMENTATION
// ============================================================================

export class DefaultModelRegistry implements ModelRegistryPort {
  private models = new Map<string, ModelInfo>();

  constructor(
    private ollamaBaseUrl = 'http://localhost:11434',
    private openRouterApiKey?: string
  ) {}

  async listAllModels(): Promise<ModelInfo[]> {
    await this.refresh();
    return Array.from(this.models.values());
  }

  async listByProvider(provider: ModelProvider): Promise<ModelInfo[]> {
    await this.refresh();
    return Array.from(this.models.values()).filter((m) => m.provider === provider);
  }

  async getModelInfo(modelId: string): Promise<ModelInfo | null> {
    if (!this.models.has(modelId)) {
      await this.refresh();
    }
    return this.models.get(modelId) || null;
  }

  async refresh(): Promise<void> {
    this.models.clear();

    // Fetch Ollama models
    await this.refreshOllamaModels();

    // Fetch OpenRouter models if configured
    if (this.openRouterApiKey) {
      await this.refreshOpenRouterModels();
    }
  }

  async recordUsage(modelId: string, metrics: UsageMetrics): Promise<void> {
    const model = this.models.get(modelId);
    if (model) {
      model.lastUsed = new Date();
      model.speed = metrics.tokensPerSecond;
    }
  }

  private async refreshOllamaModels(): Promise<void> {
    try {
      const response = await fetch(`${this.ollamaBaseUrl}/api/tags`);
      if (!response.ok) return;

      const data = await response.json();

      for (const model of data.models || []) {
        const modelId = `ollama:${model.name}`;
        this.models.set(modelId, {
          id: modelId,
          provider: 'ollama',
          displayName: model.name,
          size: model.size,
          contextWindow: 8192, // Default, would parse from model details
          supportsTools: true,
          supportsStreaming: true,
          metadata: model,
        });
      }
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
    }
  }

  private async refreshOpenRouterModels(): Promise<void> {
    // Would fetch from OpenRouter API
    // Similar implementation to Ollama
  }
}

// ============================================================================
// TRACE/LOG REPOSITORY
// ============================================================================

export class SqliteTraceRepository implements TracePort {
  constructor(private db: any) {} // Drizzle DB instance

  async createRun(data: { agentId: string; modelUsed: string }): Promise<Run> {
    const run: Run = {
      id: crypto.randomUUID(),
      agentId: data.agentId,
      modelUsed: data.modelUsed,
      status: 'running',
      turns: [],
      totalTokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      totalToolCalls: 0,
      createdAt: new Date(),
    };

    // Insert using Drizzle
    // await this.db.insert(runsTable).values(run);

    return run;
  }

  async appendTurn(runId: string, turn: Turn): Promise<void> {
    // Insert turn record
    // Update run aggregates (totalTokens, etc.)
    throw new Error('Not implemented - requires Drizzle schema');
  }

  async logToolExecution(runId: string, execution: ToolExecution): Promise<void> {
    // Insert tool execution record
    throw new Error('Not implemented - requires Drizzle schema');
  }

  async updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<void> {
    // Update run status and completedAt
    throw new Error('Not implemented - requires Drizzle schema');
  }

  async getRun(runId: string): Promise<Run | null> {
    // Fetch run with all turns and tool executions
    throw new Error('Not implemented - requires Drizzle schema');
  }

  async queryRuns(criteria: RunQueryCriteria): Promise<Run[]> {
    // Build dynamic query
    throw new Error('Not implemented - requires Drizzle schema');
  }

  async getToolStats(agentId: string): Promise<any[]> {
    // Aggregate tool execution statistics
    throw new Error('Not implemented - requires Drizzle schema');
  }
}
