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
  PromptVersion,
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

import { agents, runs, turns, toolExecutions, promptVersions, modelPricing } from '../persistence/schema';
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

      // Build request body conditionally
      const requestBody: any = {
        model: this.modelName,
        messages: ollamaRequest.messages,
        stream: false,
      };

      // Only include tools if they exist
      if (ollamaRequest.tools && ollamaRequest.tools.length > 0) {
        requestBody.tools = ollamaRequest.tools;
      }

      // Build options object only if we have settings
      const options: any = {};
      if (request.settings?.temperature !== undefined) {
        options.temperature = request.settings.temperature;
      }
      if (request.settings?.maxTokens !== undefined) {
        options.num_predict = request.settings.maxTokens;
      }
      if (request.settings?.topP !== undefined) {
        options.top_p = request.settings.topP;
      }
      // Only include stop if it's an array (Ollama requires array type)
      if (request.settings?.stopSequences && Array.isArray(request.settings.stopSequences)) {
        options.stop = request.settings.stopSequences;
      }

      // Only include options if it has at least one property
      if (Object.keys(options).length > 0) {
        requestBody.options = options;
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
      console.log(`[OLLAMA ADAPTER] Starting stream generation`, {
        model: this.modelName,
        baseUrl: this.baseUrl,
        messageCount: request.messages.length,
        hasTools: !!request.tools && request.tools.length > 0,
      });
      
      const ollamaRequest = this.convertToOllamaFormat(request);
      console.log(`[OLLAMA ADAPTER] Converted request, making fetch call...`);

      // Build request body conditionally
      const requestBody: any = {
        model: this.modelName,
        messages: ollamaRequest.messages,
        stream: true,
      };

      // Only include tools if they exist
      if (ollamaRequest.tools && ollamaRequest.tools.length > 0) {
        requestBody.tools = ollamaRequest.tools;
      }

      // Build options object only if we have settings
      const options: any = {};
      if (request.settings?.temperature !== undefined) {
        options.temperature = request.settings.temperature;
      }
      if (request.settings?.maxTokens !== undefined) {
        options.num_predict = request.settings.maxTokens;
      }
      if (request.settings?.topP !== undefined) {
        options.top_p = request.settings.topP;
      }
      // Only include stop if it's an array (Ollama requires array type)
      if (request.settings?.stopSequences && Array.isArray(request.settings.stopSequences)) {
        options.stop = request.settings.stopSequences;
      }

      // Only include options if it has at least one property
      if (Object.keys(options).length > 0) {
        requestBody.options = options;
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log(`[OLLAMA ADAPTER] Fetch response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Could not read error');
        console.error(`[OLLAMA ADAPTER] Request failed: ${response.status} ${response.statusText}`, {
          errorBody: errorText.substring(0, 500),
        });
        yield {
          type: 'error',
          error: `Ollama request failed: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`,
        };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        console.error(`[OLLAMA ADAPTER] No response body reader available`);
        yield { type: 'error', error: 'No response body' };
        return;
      }

      console.log(`[OLLAMA ADAPTER] Reading stream...`);
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      let accumulatedToolCalls = new Map<string, any>(); // Track tool calls by ID
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(`[OLLAMA ADAPTER] Stream reader done, processed ${chunkCount} chunks`);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line);
              chunkCount++;

              if (chunkCount % 10 === 0) {
                console.log(`[OLLAMA ADAPTER] Processed ${chunkCount} chunks...`);
              }

              // Accumulate content
              if (chunk.message?.content) {
                fullContent += chunk.message.content;
                console.log(`[OLLAMA ADAPTER] Yielding content chunk: ${chunk.message.content.substring(0, 50)}...`);
                yield { type: 'content', content: chunk.message.content };
              }

              // Handle tool calls - Ollama streams them incrementally or sends complete ones
              if (chunk.message?.tool_calls) {
                console.log(`[OLLAMA ADAPTER] Processing tool_calls: ${chunk.message.tool_calls.length} calls`);
                for (const toolCall of chunk.message.tool_calls) {
                  const toolCallId = toolCall.id || crypto.randomUUID();
                  const functionData = toolCall.function || {};
                  
                  // Check if this is a complete tool call (has name and valid arguments)
                  const hasCompleteData = functionData.name && 
                    (functionData.arguments !== undefined && functionData.arguments !== null);
                  
                  // Parse arguments safely
                  let parsedArgs: any = null;
                  if (functionData.arguments !== undefined && functionData.arguments !== null) {
                    if (typeof functionData.arguments === 'string') {
                      try {
                        parsedArgs = JSON.parse(functionData.arguments);
                      } catch {
                        // Arguments might be incomplete JSON string, keep as string for now
                        parsedArgs = null;
                      }
                    } else if (typeof functionData.arguments === 'object') {
                      // Already an object, use directly
                      parsedArgs = functionData.arguments;
                    }
                  }
                  
                  // If we have complete data with parsed arguments, yield immediately (for models like qwen3)
                  // Otherwise accumulate for later (for models that stream incrementally)
                  if (hasCompleteData && parsedArgs !== null) {
                    try {
                      console.log(`[OLLAMA ADAPTER] Yielding complete tool_call: ${functionData.name}`);
                      yield {
                        type: 'tool_call',
                        toolCall: {
                          id: toolCallId,
                          name: functionData.name,
                          parameters: parsedArgs,
                        },
                      };
                      // Mark as yielded so we don't yield again when done
                      accumulatedToolCalls.set(toolCallId, { yielded: true });
                    } catch (yieldError) {
                      console.error(`[OLLAMA ADAPTER] Failed to yield tool call ${toolCallId}:`, yieldError);
                    }
                  } else {
                    // Accumulate for streaming or incomplete tool calls
                    if (!accumulatedToolCalls.has(toolCallId)) {
                      accumulatedToolCalls.set(toolCallId, {
                        id: toolCallId,
                        name: functionData.name || '',
                        arguments: functionData.arguments || '',
                        yielded: false,
                      });
                    } else {
                      // Update existing tool call (for streaming arguments)
                      const existing = accumulatedToolCalls.get(toolCallId);
                      if (!existing.yielded) {
                        if (functionData.arguments !== undefined) {
                          // Handle both string (streaming) and object (complete) cases
                          if (typeof existing.arguments === 'string' && typeof functionData.arguments === 'string') {
                            // Both are strings, concatenate (for streaming)
                            existing.arguments += functionData.arguments;
                          } else if (typeof functionData.arguments === 'object' && functionData.arguments !== null) {
                            // New arguments is an object (complete), use it directly
                            existing.arguments = functionData.arguments;
                          } else if (typeof functionData.arguments === 'string') {
                            // New is string, existing might be object - replace with string
                            existing.arguments = functionData.arguments;
                          }
                        }
                        // Update name if provided
                        if (functionData.name) {
                          existing.name = functionData.name;
                        }
                      }
                    }
                  }
                }
              }

              // When chunk is done, yield all accumulated tool calls
              if (chunk.done) {
                console.log(`[OLLAMA ADAPTER] Stream done, processing ${accumulatedToolCalls.size} accumulated tool calls`);
                
                // Yield all accumulated tool calls that haven't been yielded yet
                for (const [toolCallId, toolCall] of accumulatedToolCalls.entries()) {
                  // Skip if already yielded
                  if (toolCall.yielded) {
                    continue;
                  }
                  
                  try {
                    // Parse arguments - handle both string and object cases
                    let parameters: any = {};
                    
                    if (toolCall.arguments) {
                      if (typeof toolCall.arguments === 'string') {
                        try {
                          // Try parsing as JSON string
                          const trimmed = toolCall.arguments.trim();
                          if (trimmed) {
                            parameters = JSON.parse(trimmed);
                          }
                        } catch (parseError) {
                          console.warn(`[OLLAMA ADAPTER] Failed to parse tool call arguments as JSON string for ${toolCall.name}:`, parseError);
                          // If parsing fails, use empty object
                          parameters = {};
                        }
                      } else if (typeof toolCall.arguments === 'object' && toolCall.arguments !== null) {
                        // Already an object, use it directly
                        parameters = toolCall.arguments;
                      }
                    }

                    if (toolCall.name) {
                      console.log(`[OLLAMA ADAPTER] Yielding accumulated tool_call: ${toolCall.name}`, {
                        parametersKeys: Object.keys(parameters),
                      });
                      yield {
                        type: 'tool_call',
                        toolCall: {
                          id: toolCallId,
                          name: toolCall.name,
                          parameters,
                        },
                      };
                    }
                  } catch (toolCallError) {
                    console.error(`[OLLAMA ADAPTER] Failed to yield tool call ${toolCallId}:`, toolCallError);
                  }
                }
                
                // Clear accumulated tool calls after yielding
                accumulatedToolCalls.clear();

                console.log(`[OLLAMA ADAPTER] Stream done, usage:`, {
                  inputTokens: chunk.prompt_eval_count || 0,
                  outputTokens: chunk.eval_count || 0,
                });
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
            } catch (parseError) {
              console.error(`[OLLAMA ADAPTER] Failed to parse chunk:`, {
                line: line.substring(0, 200),
                error: parseError instanceof Error ? parseError.message : 'Unknown',
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`[OLLAMA ADAPTER] Stream generation error:`, error);
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

      console.log(`[OPENROUTER ADAPTER] Starting streaming request`, {
        model: this.modelName,
        messageCount: openRouterRequest.messages.length,
        hasTools: !!openRouterRequest.tools && openRouterRequest.tools.length > 0,
      });

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
        const errorText = await response.text().catch(() => 'Could not read error response');
        console.error(`[OPENROUTER ADAPTER] Request failed: ${response.status} ${response.statusText}`, {
          model: this.modelName,
          errorBody: errorText.substring(0, 500),
        });
        yield {
          type: 'error',
          error: `OpenRouter request failed: ${response.statusText} - ${errorText.substring(0, 200)}`,
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
      let usage: { inputTokens: number; outputTokens: number; totalTokens: number } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Yield usage when stream ends, even if [DONE] wasn't received
          if (usage) {
            yield {
              type: 'done',
              usage,
            };
          } else {
            yield { type: 'done' };
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield {
                type: 'done',
                usage: usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              };
              return;
            }

            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices[0]?.delta;

              // Capture usage information if present in chunk (OpenRouter/OpenAI format)
              if (chunk.usage) {
                usage = {
                  inputTokens: chunk.usage.prompt_tokens || 0,
                  outputTokens: chunk.usage.completion_tokens || 0,
                  totalTokens: chunk.usage.total_tokens || ((chunk.usage.prompt_tokens || 0) + (chunk.usage.completion_tokens || 0)),
                };
              }

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

    // If systemPrompt is being updated, save the old prompt as a version first
    if (data.systemPrompt !== undefined && data.systemPrompt !== existing.systemPrompt) {
      // Get the current max version for this agent
      const maxVersionResult = await this.db
        .select({ max: sql<number>`COALESCE(MAX(${promptVersions.version}), 0)` })
        .from(promptVersions)
        .where(eq(promptVersions.agentId, id))
        .get();

      const nextVersion = (maxVersionResult?.max || 0) + 1;

      // Save the old prompt as a version
      await this.db.insert(promptVersions).values({
        id: crypto.randomUUID(),
        agentId: id,
        version: nextVersion,
        systemPrompt: existing.systemPrompt, // Save the old prompt
        commitMessage: data.commitMessage || null,
        createdAt: new Date(),
      });
    }

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

  async getPromptVersions(agentId: string): Promise<PromptVersion[]> {
    const versions = await this.db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.agentId, agentId))
      .orderBy(desc(promptVersions.version))
      .all();

    return versions.map((v: any) => ({
      id: v.id,
      agentId: v.agentId,
      version: v.version,
      systemPrompt: v.systemPrompt,
      commitMessage: v.commitMessage,
      createdAt: v.createdAt,
    }));
  }

  async getPromptVersion(agentId: string, version: number): Promise<PromptVersion | null> {
    const result = await this.db
      .select()
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.agentId, agentId),
          eq(promptVersions.version, version)
        )
      )
      .get();

    if (!result) return null;

    return {
      id: result.id,
      agentId: result.agentId,
      version: result.version,
      systemPrompt: result.systemPrompt,
      commitMessage: result.commitMessage,
      createdAt: result.createdAt,
    };
  }

  async revertToPromptVersion(agentId: string, version: number): Promise<Agent> {
    const promptVersion = await this.getPromptVersion(agentId, version);
    if (!promptVersion) {
      throw new NotFoundError('PromptVersion', `${agentId}:v${version}`);
    }

    // Update agent with the reverted prompt
    return await this.update(agentId, {
      systemPrompt: promptVersion.systemPrompt,
      commitMessage: `Reverted to version ${version}`,
    });
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
      error: (chunk as any).error,
      content: (chunk as any).content?.substring(0, 100), // First 100 chars
    });
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[STREAMING ADAPTER] Session ${sessionId} not found! Sessions available:`, Array.from(this.sessions.keys()));
      return;
    }

    // Send SSE event
    const data = `data: ${JSON.stringify(chunk)}\n\n`;
    console.log(`[STREAMING ADAPTER] Writing ${data.length} bytes to session`, {
      preview: data.substring(0, 200), // First 200 chars for debugging
    });
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

  async listModelsWithTools(): Promise<ModelInfo[]> {
    await this.refresh();
    return Array.from(this.models.values()).filter((m) => m.supportsTools === true);
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
    console.log(`[MODEL REGISTRY] Returning model info:`, result ? { id: result.id, displayName: result.displayName } : 'null');
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
        const modelName = model.name.toLowerCase();
        
        // Determine if model supports tools based on known patterns
        const supportsTools = this.modelSupportsTools(modelName);
        
        this.models.set(modelId, {
          id: modelId,
          provider: 'ollama',
          displayName: model.name,
          contextWindow: 8192, // Default, would parse from model details
          supportsTools,
          supportsStreaming: true,
          metadata: { size: model.size, name: model.name },
        });
      }
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
    }
  }

  private async refreshOpenRouterModels(): Promise<void> {
    if (!this.openRouterApiKey) {
      return;
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
        },
      });

      if (!response.ok) {
        console.warn('Failed to fetch OpenRouter models:', response.statusText);
        return;
      }

      const data = await response.json();
      
      for (const model of data.data || []) {
        // OpenRouter model IDs are in format like "minimax/minimax-m2:cloud"
        const modelId = `openrouter:${model.id}`;
        const modelName = model.id.toLowerCase();
        
        // Determine if model supports tools
        const supportsTools = this.openRouterModelSupportsTools(model, modelName);
        
        // Extract context window from OpenRouter data
        const contextWindow = model.context_length || 128000;
        
        this.models.set(modelId, {
          id: modelId,
          provider: 'openrouter',
          displayName: model.name || model.id,
          contextWindow,
          supportsTools,
          supportsStreaming: true,
          cost: model.pricing ? {
            inputPer1M: typeof model.pricing.prompt === 'string' ? parseFloat(model.pricing.prompt) : (model.pricing.prompt || 0),
            outputPer1M: typeof model.pricing.completion === 'string' ? parseFloat(model.pricing.completion) : (model.pricing.completion || 0),
          } : undefined,
          strengths: this.extractStrengths(model),
          metadata: {
            name: model.id, // Full model ID like "minimax/minimax-m2:cloud"
            description: model.description,
            architecture: model.architecture,
          },
        });
      }
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
    }
  }

  /**
   * Check if an OpenRouter model supports tools based on model metadata
   */
  private openRouterModelSupportsTools(model: any, modelName: string): boolean {
    // Check if OpenRouter explicitly marks it as supporting function calling
    if (model.top_provider?.supports_function_calling === true) {
      return true;
    }

    // Check model name patterns for known tool-supporting models
    const toolSupportingPatterns = [
      'minimax-m2',
      'minimax',
      'claude',
      'gpt-4',
      'gpt-4o',
      'o1',
      'qwen',
      'deepseek',
      'gemini',
      'llama3.2',
      'llama3.1',
      'mistral',
      'mixtral',
    ];

    for (const pattern of toolSupportingPatterns) {
      if (modelName.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // Check description for tool-related keywords
    const description = (model.description || '').toLowerCase();
    if (description.includes('function calling') || 
        description.includes('tool') || 
        description.includes('agent')) {
      return true;
    }

    return false;
  }

  /**
   * Extract strengths/capabilities from model metadata
   */
  private extractStrengths(model: any): string[] {
    const strengths: string[] = [];
    const description = (model.description || '').toLowerCase();
    const name = (model.name || model.id || '').toLowerCase();

    if (description.includes('code') || name.includes('code') || name.includes('coding')) {
      strengths.push('coding');
    }
    if (description.includes('tool') || description.includes('function')) {
      strengths.push('tool-use');
    }
    if (description.includes('reason') || description.includes('math')) {
      strengths.push('reasoning');
    }
    if (description.includes('vision') || name.includes('vision')) {
      strengths.push('vision');
    }

    return strengths.length > 0 ? strengths : ['general-purpose'];
  }

  /**
   * Check if an Ollama model supports tools based on model name patterns
   */
  private modelSupportsTools(modelName: string): boolean {
    // Models that support tools
    const toolSupportingPatterns = [
      'llama3.2',
      'llama3.1',
      'qwen',
      'qwen2',
      'qwen2.5',
      'deepseek',
      'deepseek-r1',
      'gemma2',
      'gemma3',
      'phi-3.5',
      'mistral',
      'mixtral',
      'codellama',
      'llama3.3',
    ];

    // Models that definitely don't support tools
    const noToolPatterns = [
      'llama3:8b', // Old llama3 models don't support tools
      'llama3:13b',
      'llava', // Vision models
      'embed', // Embedding models
      'nomic-embed',
      'all-minilm',
      'phi3', // Old phi3
      'phi-3-mini',
    ];

    // Check no-tool patterns first
    for (const pattern of noToolPatterns) {
      if (modelName.includes(pattern.toLowerCase())) {
        return false;
      }
    }

    // Check tool-supporting patterns
    for (const pattern of toolSupportingPatterns) {
      if (modelName.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // Default: assume older models don't support tools
    // But allow newer patterns like llama3.2
    return modelName.includes('llama3.2') || modelName.includes('llama3.1');
  }
}

// ============================================================================
// TRACE/LOG REPOSITORY
// ============================================================================

export class SqliteTraceRepository implements TracePort {
  constructor(private db: any) {} // Drizzle DB instance

  async createRun(data: { agentId: string; modelUsed: string; modelSettings?: any }): Promise<Run> {
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
      totalDurationMs: null,
      modelSettings: data.modelSettings ? JSON.stringify(data.modelSettings) : null,
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
      totalDurationMs: undefined,
      modelSettings: data.modelSettings,
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
          startedAt: turn.startedAt || existingTurn.startedAt || now,
          durationMs: turn.durationMs || (turn.startedAt && now ? Date.now() - turn.startedAt.getTime() : null),
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
        startedAt: turn.startedAt || now,
        durationMs: turn.durationMs || null,
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
          reasoning: toolExec.reasoning || null,
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
      reasoning: execution.reasoning || null,
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
      // Calculate total duration when run completes
      const run = await this.db.select().from(runs).where(eq(runs.id, runId)).get();
      if (run && run.createdAt) {
        const duration = updateData.completedAt.getTime() - run.createdAt.getTime();
        updateData.totalDurationMs = duration;
      }
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
        reasoning: toolRow.reasoning || undefined,
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
      startedAt: turnRow.startedAt || undefined,
      durationMs: turnRow.durationMs || undefined,
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
      totalDurationMs: runRow.totalDurationMs || undefined,
      modelSettings: runRow.modelSettings ? JSON.parse(runRow.modelSettings) : undefined,
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

  /**
   * Get pricing for a model, fetching from OpenRouter if not in database
   */
  async getModelPricing(modelId: string, provider: string, forceUpdate: boolean = false): Promise<{ inputPricePer1k: number; outputPricePer1k: number } | null> {
    // Check if we have pricing in database
    if (!forceUpdate) {
      const existing = await this.db
        .select()
        .from(modelPricing)
        .where(
          and(
            eq(modelPricing.modelId, modelId),
            eq(modelPricing.provider, provider)
          )
        )
        .get();

      if (existing) {
        return {
          inputPricePer1k: existing.inputPricePer1k,
          outputPricePer1k: existing.outputPricePer1k,
        };
      }
    }

    // Fetch from OpenRouter if provider is openrouter
    if (provider === 'openrouter') {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) {
          console.warn(`[PRICING] Failed to fetch pricing from OpenRouter: ${response.statusText}`);
          return null;
        }

        const data = await response.json();
        const model = data.data?.find((m: any) => m.id === modelId);
        
        if (model?.pricing) {
          const pricing = {
            inputPricePer1k: model.pricing.prompt || 0,
            outputPricePer1k: model.pricing.completion || 0,
          };

          // Store in database (upsert)
          const existing = await this.db
            .select()
            .from(modelPricing)
            .where(
              and(
                eq(modelPricing.modelId, modelId),
                eq(modelPricing.provider, provider)
              )
            )
            .get();

          if (existing) {
            await this.db
              .update(modelPricing)
              .set({
                inputPricePer1k: pricing.inputPricePer1k,
                outputPricePer1k: pricing.outputPricePer1k,
                lastUpdated: new Date(),
              })
              .where(eq(modelPricing.id, existing.id));
          } else {
            const id = crypto.randomUUID();
            await this.db.insert(modelPricing).values({
              id,
              modelId,
              provider,
              inputPricePer1k: pricing.inputPricePer1k,
              outputPricePer1k: pricing.outputPricePer1k,
              lastUpdated: new Date(),
            });
          }

          return pricing;
        }
      } catch (error) {
        console.error(`[PRICING] Error fetching pricing from OpenRouter:`, error);
        return null;
      }
    }

    return null;
  }

  /**
   * Calculate estimated cost for a run
   */
  async calculateRunCost(runId: string): Promise<number | null> {
    const run = await this.getRun(runId);
    if (!run) {
      return null;
    }

    // Determine provider from model ID
    const provider = run.modelUsed.startsWith('openrouter:') ? 'openrouter' : 'ollama';
    const modelId = run.modelUsed.replace(/^(openrouter|ollama):/, '');

    // Get pricing
    const pricing = await this.getModelPricing(modelId, provider);
    if (!pricing) {
      return null; // No pricing available
    }

    // Calculate cost: (inputTokens / 1000 * inputPrice) + (outputTokens / 1000 * outputPrice)
    const inputCost = (run.totalTokens.inputTokens / 1000) * pricing.inputPricePer1k;
    const outputCost = (run.totalTokens.outputTokens / 1000) * pricing.outputPricePer1k;
    return inputCost + outputCost;
  }
}
