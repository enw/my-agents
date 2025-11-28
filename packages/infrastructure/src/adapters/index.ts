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
} from '@my-agents/domain';

import { agents, runs, turns, toolExecutions } from '../persistence/schema';
import { eq, and, desc, asc, like, or, sql, gte, lte } from 'drizzle-orm';

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

  private mapDbRowToAgent(row: any): Agent {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      systemPrompt: row.systemPrompt,
      defaultModel: row.defaultModel,
      allowedTools: JSON.parse(row.allowedTools || '[]'),
      tags: JSON.parse(row.tags || '[]'),
      settings: row.settings ? JSON.parse(row.settings) : undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(data: CreateAgentData): Promise<Agent> {
    const id = crypto.randomUUID();
    const now = new Date();

    const dbRow = {
      id,
      name: data.name,
      description: data.description,
      systemPrompt: data.systemPrompt,
      defaultModel: data.defaultModel,
      allowedTools: JSON.stringify(data.allowedTools || []),
      tags: JSON.stringify(data.tags || []),
      settings: JSON.stringify(data.settings || {}),
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(agents).values(dbRow);

    return this.mapDbRowToAgent(dbRow);
  }

  async findById(id: string): Promise<Agent | null> {
    const result = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .get();

    if (!result) {
      return null;
    }

    return this.mapDbRowToAgent(result);
  }

  async findMany(criteria: AgentQueryCriteria): Promise<Agent[]> {
    const conditions = [];

    // Filter by tags if provided
    if (criteria.tags && criteria.tags.length > 0) {
      // SQLite JSON search - check if any tag exists in the tags JSON array
      // Build OR conditions for each tag
      const tagConditions = criteria.tags.map(tag =>
        sql`EXISTS (SELECT 1 FROM json_each(${agents.tags}) WHERE json_each.value = ${tag})`
      );
      // Combine with OR - at least one tag must match
      if (tagConditions.length === 1) {
        conditions.push(tagConditions[0]);
      } else {
        // Use SQL to combine OR conditions
        let combined = tagConditions[0];
        for (let i = 1; i < tagConditions.length; i++) {
          combined = sql`${combined} OR ${tagConditions[i]}`;
        }
        conditions.push(sql`(${combined})`);
      }
    }

    // Search in name or description
    if (criteria.search) {
      const searchPattern = `%${criteria.search}%`;
      conditions.push(
        or(
          like(agents.name, searchPattern),
          like(agents.description, searchPattern)
        )!
      );
    }

    // Build query
    let query = this.db.select().from(agents);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Ordering
    const orderBy = criteria.orderBy || 'updatedAt';
    const orderDir = criteria.orderDir || 'desc';
    
    if (orderBy === 'name') {
      query = query.orderBy(orderDir === 'asc' ? asc(agents.name) : desc(agents.name));
    } else if (orderBy === 'createdAt') {
      query = query.orderBy(orderDir === 'asc' ? asc(agents.createdAt) : desc(agents.createdAt));
    } else {
      query = query.orderBy(orderDir === 'asc' ? asc(agents.updatedAt) : desc(agents.updatedAt));
    }

    // Limit and offset
    const limit = criteria.limit || 50;
    const offset = criteria.offset || 0;
    query = query.limit(limit).offset(offset);

    const results = await query.all();

    return results.map((row: any) => this.mapDbRowToAgent(row));
  }

  async update(id: string, data: UpdateAgentData): Promise<Agent> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Agent', id);
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt;
    if (data.defaultModel !== undefined) updateData.defaultModel = data.defaultModel;
    if (data.allowedTools !== undefined) updateData.allowedTools = JSON.stringify(data.allowedTools);
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
    if (data.settings !== undefined) updateData.settings = JSON.stringify(data.settings);

    await this.db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, id));

    return await this.findById(id) as Agent;
  }

  async delete(id: string): Promise<void> {
    const exists = await this.exists(id);
    if (!exists) {
      throw new NotFoundError('Agent', id);
    }

    await this.db.delete(agents).where(eq(agents.id, id));
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
    console.log(`[TOOL PORT] Executing tool: ${name}`, {
      parameters: JSON.stringify(parameters),
      timestamp: new Date().toISOString(),
    });

    const tool = this.tools.get(name);
    if (!tool) {
      console.error(`[TOOL PORT] Tool ${name} not found`);
      return {
        success: false,
        output: `Tool ${name} not found`,
        error: `Tool ${name} not found`,
        executionTimeMs: 0,
      };
    }

    console.log(`[TOOL PORT] Validating parameters for tool: ${name}`);
    this.validateParameters(name, parameters);
    console.log(`[TOOL PORT] Parameters validated, executing tool: ${name}`);

    const startTime = Date.now();
    try {
      const result = await tool.execute(parameters);
      result.executionTimeMs = Date.now() - startTime;
      console.log(`[TOOL PORT] Tool ${name} completed`, {
        success: result.success,
        executionTimeMs: result.executionTimeMs,
        outputLength: result.output?.length || 0,
      });
      return result;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      console.error(`[TOOL PORT] Tool ${name} threw error after ${executionTimeMs}ms:`, error);
      throw error;
    }
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
  private sessions = new Map<string, { write: (data: string) => void; end: () => void }>();

  async createSession(): Promise<string> {
    const sessionId = crypto.randomUUID();
    return sessionId;
  }

  async send(sessionId: string, chunk: StreamChunk): Promise<void> {
    console.log(`[STREAMING ADAPTER] send() called for sessionId: ${sessionId}`, {
      chunkType: chunk.type,
      hasContent: !!(chunk as any).content,
    });
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[STREAMING ADAPTER] Session ${sessionId} not found! Sessions available:`, Array.from(this.sessions.keys()));
      return;
    }

    // Send SSE event
    const data = `data: ${JSON.stringify(chunk)}\n\n`;
    console.log(`[STREAMING ADAPTER] Writing ${data.length} bytes to session`);
    session.write(data);
  }

  async complete(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.write('data: [DONE]\n\n');
      session.end();
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
      session.end();
      this.sessions.delete(sessionId);
    }
  }

  registerSession(sessionId: string, session: { write: (data: string) => void; end: () => void }): void {
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
    console.log(`[MODEL REGISTRY] getModelInfo called for: ${modelId}`);
    if (!this.models.has(modelId)) {
      console.log(`[MODEL REGISTRY] Model ${modelId} not in cache, refreshing registry...`);
      await this.refresh();
      console.log(`[MODEL REGISTRY] Registry refresh completed`);
    } else {
      console.log(`[MODEL REGISTRY] Model ${modelId} found in cache`);
    }
    const result = this.models.get(modelId) || null;
    console.log(`[MODEL REGISTRY] Returning model info:`, result ? { id: result.id, name: result.name } : 'null');
    return result;
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
    const id = crypto.randomUUID();
    const now = new Date();

    const dbRow = {
      id,
      agentId: data.agentId,
      modelUsed: data.modelUsed,
      status: 'running' as const,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalToolCalls: 0,
      createdAt: now,
      completedAt: null,
      error: null,
    };

    await this.db.insert(runs).values(dbRow);

    return {
      id,
      agentId: data.agentId,
      modelUsed: data.modelUsed,
      status: 'running',
      turns: [],
      totalTokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      totalToolCalls: 0,
      createdAt: now,
    };
  }

  async appendTurn(runId: string, turn: Turn): Promise<void> {
    const now = new Date();

    // Check if a temporary turn was already created for this turn number
    const existingTurn = await this.db
      .select()
      .from(turns)
      .where(
        and(
          eq(turns.runId, runId),
          eq(turns.turnNumber, turn.turnNumber)
        )
      )
      .get();

    let turnId: string;

    if (existingTurn && existingTurn.userMessage === '[Temporary]') {
      // Update the temporary turn with actual data
      turnId = existingTurn.id;
      await this.db
        .update(turns)
        .set({
          userMessage: turn.userMessage,
          assistantMessage: turn.assistantMessage,
          inputTokens: turn.usage.inputTokens,
          outputTokens: turn.usage.outputTokens,
          totalTokens: turn.usage.totalTokens,
          timestamp: turn.timestamp || now,
        })
        .where(eq(turns.id, turnId));
    } else {
      // Create new turn record
      turnId = crypto.randomUUID();
      await this.db.insert(turns).values({
        id: turnId,
        runId,
        turnNumber: turn.turnNumber,
        userMessage: turn.userMessage,
        assistantMessage: turn.assistantMessage,
        inputTokens: turn.usage.inputTokens,
        outputTokens: turn.usage.outputTokens,
        totalTokens: turn.usage.totalTokens,
        timestamp: turn.timestamp || now,
      });
    }

    // Ensure all tool executions from the turn are logged
    // (they may have been logged individually before this turn was created)
    for (const toolExec of turn.toolExecutions) {
      const existing = await this.db
        .select()
        .from(toolExecutions)
        .where(eq(toolExecutions.id, toolExec.id))
        .get();

      if (!existing) {
        // Insert if not already logged
        await this.db.insert(toolExecutions).values({
          id: toolExec.id,
          runId,
          turnId,
          toolName: toolExec.toolName,
          parameters: JSON.stringify(toolExec.parameters),
          success: toolExec.result.success,
          output: toolExec.result.output || '',
          data: toolExec.result.data ? JSON.stringify(toolExec.result.data) : null,
          error: toolExec.result.error || null,
          executionTimeMs: toolExec.result.executionTimeMs || 0,
          timestamp: toolExec.timestamp,
        });
      } else if (existing.turnId !== turnId) {
        // Update turnId if it was pointing to a temporary turn
        await this.db
          .update(toolExecutions)
          .set({ turnId })
          .where(eq(toolExecutions.id, toolExec.id));
      }
    }

    // Update run aggregates
    const run = await this.db.select().from(runs).where(eq(runs.id, runId)).get();
    if (run) {
      await this.db
        .update(runs)
        .set({
          totalInputTokens: run.totalInputTokens + turn.usage.inputTokens,
          totalOutputTokens: run.totalOutputTokens + turn.usage.outputTokens,
          totalTokens: run.totalTokens + turn.usage.totalTokens,
          totalToolCalls: run.totalToolCalls + turn.toolExecutions.length,
        })
        .where(eq(runs.id, runId));
    }
  }

  async logToolExecution(runId: string, execution: ToolExecution): Promise<void> {
    // Tool executions are logged BEFORE the turn is appended in the execution service.
    // Find the latest turn for this run, or create a temporary turn if none exists.
    const latestTurn = await this.db
      .select()
      .from(turns)
      .where(eq(turns.runId, runId))
      .orderBy(desc(turns.turnNumber))
      .limit(1)
      .get();

    let turnId: string;
    
    if (latestTurn) {
      // Use the latest turn
      turnId = latestTurn.id;
    } else {
      // No turns yet - create a temporary turn record for turn 1
      // This will be updated when appendTurn is called with the actual turn data
      turnId = crypto.randomUUID();
      await this.db.insert(turns).values({
        id: turnId,
        runId,
        turnNumber: 1, // Will be updated if different
        userMessage: '[Temporary]', // Will be updated
        assistantMessage: '[Temporary]', // Will be updated
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        timestamp: new Date(),
      });
    }

    await this.db.insert(toolExecutions).values({
      id: execution.id,
      runId,
      turnId,
      toolName: execution.toolName,
      parameters: JSON.stringify(execution.parameters),
      success: execution.result.success,
      output: execution.result.output || '',
      data: execution.result.data ? JSON.stringify(execution.result.data) : null,
      error: execution.result.error || null,
      executionTimeMs: execution.result.executionTimeMs || 0,
      timestamp: execution.timestamp,
    });
  }

  async updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<void> {
    const updateData: any = {
      status,
    };

    if (status === 'completed' || status === 'error') {
      updateData.completedAt = new Date();
    }

    if (error) {
      updateData.error = error;
    }

    await this.db.update(runs).set(updateData).where(eq(runs.id, runId));
  }

  async getRun(runId: string): Promise<Run | null> {
    const runRow = await this.db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!runRow) {
      return null;
    }

    // Fetch all turns for this run
    const turnRows = await this.db
      .select()
      .from(turns)
      .where(eq(turns.runId, runId))
      .orderBy(asc(turns.turnNumber))
      .all() as any[];

    // Fetch all tool executions for this run
    const toolExecutionRows = await this.db
      .select()
      .from(toolExecutions)
      .where(eq(toolExecutions.runId, runId))
      .all();

    // Group tool executions by turn
    const toolExecutionsByTurn = new Map<string, ToolExecution[]>();
    for (const toolRow of toolExecutionRows) {
      if (!toolExecutionsByTurn.has(toolRow.turnId)) {
        toolExecutionsByTurn.set(toolRow.turnId, []);
      }
      toolExecutionsByTurn.get(toolRow.turnId)!.push({
        id: toolRow.id,
        toolName: toolRow.toolName,
        parameters: JSON.parse(toolRow.parameters || '{}'),
        result: {
          success: toolRow.success,
          output: toolRow.output,
          data: toolRow.data ? JSON.parse(toolRow.data) : undefined,
          error: toolRow.error || undefined,
          executionTimeMs: toolRow.executionTimeMs,
        },
        timestamp: toolRow.timestamp,
      });
    }

    // Build turns with tool executions
    const turnsArray: Turn[] = turnRows.map((turnRow: any) => ({
      turnNumber: turnRow.turnNumber,
      userMessage: turnRow.userMessage,
      assistantMessage: turnRow.assistantMessage,
      toolExecutions: toolExecutionsByTurn.get(turnRow.id) || [],
      usage: {
        inputTokens: turnRow.inputTokens,
        outputTokens: turnRow.outputTokens,
        totalTokens: turnRow.totalTokens,
      },
      timestamp: turnRow.timestamp,
    }));

    return {
      id: runRow.id,
      agentId: runRow.agentId,
      modelUsed: runRow.modelUsed,
      status: runRow.status as RunStatus,
      turns: turnsArray,
      totalTokens: {
        inputTokens: runRow.totalInputTokens,
        outputTokens: runRow.totalOutputTokens,
        totalTokens: runRow.totalTokens,
      },
      totalToolCalls: runRow.totalToolCalls,
      createdAt: runRow.createdAt,
      completedAt: runRow.completedAt || undefined,
      error: runRow.error || undefined,
    };
  }

  async queryRuns(criteria: RunQueryCriteria): Promise<Run[]> {
    const conditions = [];

    if (criteria.agentId) {
      conditions.push(eq(runs.agentId, criteria.agentId));
    }

    if (criteria.status) {
      conditions.push(eq(runs.status, criteria.status));
    }

    if (criteria.fromDate) {
      conditions.push(gte(runs.createdAt, criteria.fromDate));
    }

    if (criteria.toDate) {
      conditions.push(lte(runs.createdAt, criteria.toDate));
    }

    let query = this.db.select().from(runs);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(runs.createdAt));

    const limit = criteria.limit || 50;
    const offset = criteria.offset || 0;
    query = query.limit(limit).offset(offset);

    const runRows = await query.all();

    // Fetch all runs with their turns and tool executions
    const results: Run[] = [];
    for (const runRow of runRows) {
      const run = await this.getRun(runRow.id);
      if (run) {
        results.push(run);
      }
    }

    return results;
  }

  async getToolStats(agentId: string): Promise<any[]> {
    const stats = await this.db
      .select({
        toolName: toolExecutions.toolName,
        totalExecutions: sql<number>`COUNT(*)`,
        successfulExecutions: sql<number>`SUM(CASE WHEN ${toolExecutions.success} = 1 THEN 1 ELSE 0 END)`,
        successRate: sql<number>`CAST(SUM(CASE WHEN ${toolExecutions.success} = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100`,
        avgExecutionTime: sql<number>`AVG(${toolExecutions.executionTimeMs})`,
      })
      .from(toolExecutions)
      .innerJoin(runs, eq(toolExecutions.runId, runs.id))
      .where(eq(runs.agentId, agentId))
      .groupBy(toolExecutions.toolName)
      .all();

    return stats.map((stat: any) => ({
      toolName: stat.toolName,
      totalExecutions: stat.totalExecutions,
      successfulExecutions: stat.successfulExecutions,
      successRate: stat.successRate,
      avgExecutionTime: stat.avgExecutionTime,
    }));
  }

  async deleteRun(runId: string): Promise<void> {
    // Verify run exists
    const run = await this.db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!run) {
      throw new NotFoundError('Run', runId);
    }

    // Delete the run - cascade deletes will handle turns and tool executions
    // Since the schema has onDelete: 'cascade', we only need to delete the run
    await this.db.delete(runs).where(eq(runs.id, runId));
  }
}
