/**
 * Domain Services - Core Business Logic
 *
 * These services orchestrate domain operations and enforce business rules.
 * They depend ONLY on ports, never on concrete implementations.
 */

import {
  Agent,
  AgentPort,
  GenerateRequest,
  Message,
  ModelPort,
  ModelRegistryPort,
  Run,
  StreamChunk,
  StreamingPort,
  ToolPort,
  TracePort,
  Turn,
  UnauthorizedToolError,
  ValidationError,
} from '../ports';

// ============================================================================
// AGENT EXECUTION SERVICE - Core Business Logic
// ============================================================================

export interface AgentExecutionService {
  /**
   * Execute an agent with a user message
   * Handles the full agent loop: LLM call → tool execution → LLM call → ...
   *
   * @param agentId - Agent to execute
   * @param userMessage - User's input message
   * @param options - Execution options
   * @returns Run ID for tracking
   */
  execute(
    agentId: string,
    userMessage: string,
    options?: ExecutionOptions
  ): Promise<string>;

  /**
   * Execute with streaming support
   * Returns run ID immediately, streams responses via StreamingPort
   */
  executeStream(
    agentId: string,
    userMessage: string,
    options?: ExecutionOptions
  ): Promise<string>;

  /**
   * Continue an existing conversation
   */
  continueConversation(
    runId: string,
    userMessage: string,
    options?: ExecutionOptions
  ): Promise<void>;
}

export interface ExecutionOptions {
  modelOverride?: string; // Override agent's default model
  maxTurns?: number; // Prevent infinite loops (default: 10)
  streamSessionId?: string; // For streaming responses
  conversationHistory?: Message[]; // For continuing conversations
}

/**
 * Implementation of agent execution logic
 */
export class DefaultAgentExecutionService implements AgentExecutionService {
  constructor(
    private agentPort: AgentPort,
    private modelRegistry: ModelRegistryPort,
    private toolPort: ToolPort,
    private tracePort: TracePort,
    private streamingPort: StreamingPort,
    private modelFactory: any // ModelFactory from infrastructure
  ) {}

  async execute(
    agentId: string,
    userMessage: string,
    options: ExecutionOptions = {}
  ): Promise<string> {
    console.log(`[AGENT EXECUTION] ========== EXECUTE METHOD CALLED ==========`);
    console.log(`[AGENT EXECUTION] Starting execute for agentId: ${agentId}`, {
      messageLength: userMessage.length,
      modelOverride: options.modelOverride,
      maxTurns: options.maxTurns,
      hasStreamSession: !!options.streamSessionId,
      timestamp: new Date().toISOString(),
    });

    // 1. Load agent configuration
    console.log(`[AGENT EXECUTION] Loading agent configuration...`);
    const agent = await this.agentPort.findById(agentId);
    if (!agent) {
      console.error(`[AGENT EXECUTION] Agent ${agentId} not found`);
      throw new ValidationError(`Agent ${agentId} not found`);
    }
    console.log(`[AGENT EXECUTION] Agent loaded: ${agent.name}`, {
      defaultModel: agent.defaultModel,
      allowedTools: agent.allowedTools.length,
    });

    // 2. Validate and get model
    const modelId = options.modelOverride || agent.defaultModel;
    console.log(`[AGENT EXECUTION] Getting model info for: ${modelId}`);
    const modelInfo = await this.modelRegistry.getModelInfo(modelId);
    if (!modelInfo) {
      console.error(`[AGENT EXECUTION] Model ${modelId} not found`);
      throw new ValidationError(`Model ${modelId} not found`);
    }
    console.log(`[AGENT EXECUTION] Model info loaded: ${modelInfo.displayName || modelInfo.id}`);

    // 3. Create run trace
    console.log(`[AGENT EXECUTION] Creating run trace...`);
    // Get model settings from agent or options
    const modelSettings = options.settings || agent.settings || undefined;
    const run = await this.tracePort.createRun({
      agentId: agent.id,
      modelUsed: modelId,
      modelSettings,
    });
    console.log(`[AGENT EXECUTION] Run created with ID: ${run.id}`);

    // If streaming, send runId to client
    if (options.streamSessionId) {
      console.log(`[AGENT EXECUTION] Sending run_created event to stream session: ${options.streamSessionId}`);
      await this.streamingPort.send(options.streamSessionId, {
        type: 'run_created',
        runId: run.id,
      });
    }

    // 4. Execute agent loop
    console.log(`[AGENT EXECUTION] Starting agent loop for runId: ${run.id}`);
    try {
      await this.executeAgentLoop(agent, run.id, userMessage, modelInfo.id, options);
      console.log(`[AGENT EXECUTION] Agent loop completed successfully for runId: ${run.id}`);
      await this.tracePort.updateRunStatus(run.id, 'completed');
    } catch (error) {
      console.error(`[AGENT EXECUTION] Agent loop error for runId ${run.id}:`, error);
      await this.tracePort.updateRunStatus(
        run.id,
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }

    console.log(`[AGENT EXECUTION] Execute completed for runId: ${run.id}`);
    return run.id;
  }

  async executeStream(
    agentId: string,
    userMessage: string,
    options: ExecutionOptions = {}
  ): Promise<string> {
    console.log(`[AGENT EXECUTION] executeStream called`, {
      agentId,
      userMessageLength: userMessage.length,
      hasStreamSessionId: !!options.streamSessionId,
      timestamp: new Date().toISOString(),
    });

    // Create streaming session if not provided
    console.log(`[AGENT EXECUTION] Creating/getting stream session...`);
    const streamSessionId =
      options.streamSessionId || (await this.streamingPort.createSession());
    console.log(`[AGENT EXECUTION] Stream session ID: ${streamSessionId}`);

    // Execute in background, stream results
    console.log(`[AGENT EXECUTION] Starting background execute() call...`);
    this.execute(agentId, userMessage, {
      ...options,
      streamSessionId,
    }).then(() => {
      console.log(`[AGENT EXECUTION] Background execute() completed successfully`);
    }).catch(async (error) => {
      console.error(`[AGENT EXECUTION] Background execute() failed:`, error);
      await this.streamingPort.error(
        streamSessionId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    });

    console.log(`[AGENT EXECUTION] executeStream returning sessionId: ${streamSessionId}`);
    return streamSessionId;
  }

  async continueConversation(
    runId: string,
    userMessage: string,
    options: ExecutionOptions = {}
  ): Promise<void> {
    const run = await this.tracePort.getRun(runId);
    if (!run) {
      throw new ValidationError(`Run ${runId} not found`);
    }

    const agent = await this.agentPort.findById(run.agentId);
    if (!agent) {
      throw new ValidationError(`Agent ${run.agentId} not found`);
    }

    // Build conversation history from turns
    const conversationHistory = this.buildConversationHistory(run);

    await this.executeAgentLoop(
      agent,
      runId,
      userMessage,
      run.modelUsed,
      {
        ...options,
        conversationHistory,
      }
    );
  }

  /**
   * Core agent execution loop
   * Implements the ReAct pattern: Reason → Act → Observe
   */
  private async executeAgentLoop(
    agent: Agent,
    runId: string,
    userMessage: string,
    modelId: string,
    options: ExecutionOptions
  ): Promise<void> {
    const maxTurns = options.maxTurns || 10;
    const conversationHistory = options.conversationHistory || [];
    const streamSessionId = options.streamSessionId;

    console.log(`[AGENT LOOP] Initializing loop for runId: ${runId}`, {
      agentName: agent.name,
      modelId,
      maxTurns,
      conversationHistoryLength: conversationHistory.length,
      hasStreamSession: !!streamSessionId,
    });

    // Get model adapter
    console.log(`[AGENT LOOP] Getting model adapter for: ${modelId}`);
    const model = await this.getModelAdapter(modelId);
    console.log(`[AGENT LOOP] Model adapter ready`);

    // Get allowed tools for this agent
    console.log(`[AGENT LOOP] Loading tools (${agent.allowedTools.length} allowed)`);
    const allowedTools = this.toolPort.listByNames(agent.allowedTools);
    const toolDefinitions = allowedTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
    console.log(`[AGENT LOOP] Tools loaded: ${toolDefinitions.map(t => t.name).join(', ')}`);

    // Start conversation
    const messages: Message[] = [
      ...conversationHistory,
      { role: 'user' as const, content: userMessage },
    ];

    let turnNumber = conversationHistory.length / 2 + 1; // Approximate
    let continueLoop = true;

    console.log(`[AGENT LOOP] Starting loop with turnNumber: ${turnNumber}, maxTurns: ${maxTurns}`);

    while (continueLoop && turnNumber <= maxTurns) {
      const turnStartTime = new Date();
      console.log(`[AGENT LOOP] ===== Turn ${turnNumber}/${maxTurns} =====`, {
        runId,
        timestamp: turnStartTime.toISOString(),
      });
      
      // Call LLM
      console.log(`[AGENT LOOP] Preparing LLM request...`, {
        messageCount: messages.length,
        hasTools: toolDefinitions.length > 0,
        systemPromptLength: agent.systemPrompt.length,
      });
      
      const request: GenerateRequest = {
        systemPrompt: agent.systemPrompt,
        messages,
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
      };

      console.log(`[AGENT LOOP] Calling LLM (${streamSessionId ? 'streaming' : 'non-streaming'})...`);
      const llmStartTime = Date.now();
      let response;
      if (streamSessionId) {
        response = await this.executeWithStreaming(
          model,
          request,
          streamSessionId
        );
      } else {
        response = await model.generate(request);
      }
      const llmDuration = Date.now() - llmStartTime;
      console.log(`[AGENT LOOP] LLM response received (${llmDuration}ms)`, {
        contentLength: response.content?.length || 0,
        toolCallsCount: response.toolCalls?.length || 0,
        usage: response.usage,
      });

      // Add assistant message to history
      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      });

      // Execute tools if requested
      const toolExecutions = [];
      if (response.toolCalls.length > 0) {
        console.log(`[AGENT LOOP] Executing ${response.toolCalls.length} tool call(s)...`);
        for (const toolCall of response.toolCalls) {
          console.log(`[AGENT LOOP] Executing tool: ${toolCall.name}`, {
            toolCallId: toolCall.id,
            parameters: JSON.stringify(toolCall.parameters),
          });
          
          // Security check: verify tool is allowed
          if (!agent.allowedTools.includes(toolCall.name)) {
            console.error(`[AGENT LOOP] Unauthorized tool: ${toolCall.name} not in allowedTools`);
            throw new UnauthorizedToolError(toolCall.name, agent.id);
          }

          // Execute tool
          const toolStartTime = Date.now();
          const toolResult = await this.toolPort.execute(
            toolCall.name,
            toolCall.parameters
          );
          const toolDuration = Date.now() - toolStartTime;
          console.log(`[AGENT LOOP] Tool ${toolCall.name} completed (${toolDuration}ms)`, {
            success: toolResult.success,
            outputLength: toolResult.output?.length || 0,
          });

          // Log tool execution
          const toolExecution = {
            id: toolCall.id,
            toolName: toolCall.name,
            parameters: toolCall.parameters,
            result: toolResult,
            timestamp: new Date(),
          };
          toolExecutions.push(toolExecution);

          await this.tracePort.logToolExecution(runId, toolExecution);

          // Add tool result to conversation
          messages.push({
            role: 'tool',
            content: toolResult.output,
            toolCallId: toolCall.id,
          });

          // Stream tool execution results
          if (streamSessionId) {
            await this.streamingPort.send(streamSessionId, {
              type: 'tool_call',
              toolCall: {
                id: toolCall.id,
                name: toolCall.name,
                parameters: toolCall.parameters,
              },
            });
          }
        }

        // Continue loop to get final response after tool execution
        console.log(`[AGENT LOOP] Tool executions complete, continuing loop for final response`);
        continueLoop = true;
      } else {
        // No tool calls, we're done
        console.log(`[AGENT LOOP] No tool calls, agent response complete`);
        continueLoop = false;
      }

      // Log turn
      const turnEndTime = new Date();
      const turnDurationMs = turnEndTime.getTime() - turnStartTime.getTime();
      console.log(`[AGENT LOOP] Logging turn ${turnNumber} to trace...`);
      const turn: Turn = {
        turnNumber,
        userMessage: turnNumber === 1 ? userMessage : '[Tool results]',
        assistantMessage: response.content,
        toolExecutions,
        usage: response.usage,
        startedAt: turnStartTime,
        durationMs: turnDurationMs,
        timestamp: turnEndTime,
      };
      await this.tracePort.appendTurn(runId, turn);
      console.log(`[AGENT LOOP] Turn ${turnNumber} logged (duration: ${turnDurationMs}ms)`);

      turnNumber++;
    }

    if (turnNumber > maxTurns) {
      console.warn(`[AGENT LOOP] Max turns (${maxTurns}) reached for runId: ${runId}`);
    } else {
      console.log(`[AGENT LOOP] Loop completed normally after ${turnNumber - 1} turns`);
    }

    if (streamSessionId) {
      console.log(`[AGENT LOOP] Sending stream completion for sessionId: ${streamSessionId}`);
      await this.streamingPort.complete(streamSessionId);
    }
    
    console.log(`[AGENT LOOP] Agent loop finished for runId: ${runId}`);
  }

  /**
   * Execute LLM with streaming support
   */
  private async executeWithStreaming(
    model: ModelPort,
    request: GenerateRequest,
    streamSessionId: string
  ) {
    console.log(`[STREAMING] Starting streaming generation for sessionId: ${streamSessionId}`);
    let fullContent = '';
    const toolCalls: any[] = [];
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let chunkCount = 0;

    for await (const chunk of model.generateStream(request)) {
      chunkCount++;
      if (chunkCount % 10 === 0) {
        console.log(`[STREAMING] Received ${chunkCount} chunks so far...`);
      }
      await this.streamingPort.send(streamSessionId, chunk);

      if (chunk.type === 'content' && chunk.content) {
        fullContent += chunk.content;
      } else if (chunk.type === 'tool_call' && chunk.toolCall) {
        // Accumulate tool calls
        toolCalls.push(chunk.toolCall);
      } else if (chunk.type === 'done' && chunk.usage) {
        usage = chunk.usage;
      }
    }

    console.log(`[STREAMING] Streaming complete: ${chunkCount} chunks, ${fullContent.length} chars, ${toolCalls.length} tool calls`);

    return {
      content: fullContent,
      toolCalls,
      usage,
      finishReason: 'stop' as const,
      metadata: {
        model: request.systemPrompt, // Placeholder
        latencyMs: 0,
        provider: '',
      },
    };
  }

  /**
   * Build conversation history from run turns
   */
  private buildConversationHistory(run: Run): Message[] {
    const messages: Message[] = [];

    for (const turn of run.turns) {
      messages.push({ role: 'user', content: turn.userMessage });

      if (turn.assistantMessage) {
        messages.push({
          role: 'assistant',
          content: turn.assistantMessage,
          toolCalls: turn.toolExecutions.map((te) => ({
            id: te.id,
            name: te.toolName,
            parameters: te.parameters,
          })),
        });
      }

      // Add tool results
      for (const toolExec of turn.toolExecutions) {
        messages.push({
          role: 'tool',
          content: toolExec.result.output,
          toolCallId: toolExec.id,
        });
      }
    }

    return messages;
  }

  /**
   * Get model adapter using factory
   * For OpenRouter models, uses the original model ID from metadata to ensure correct format
   */
  private async getModelAdapter(modelId: string): Promise<ModelPort> {
    // Look up model info to get the original model ID for OpenRouter
    const modelInfo = await this.modelRegistry.getModelInfo(modelId);
    
    // For OpenRouter models, use the original model.id from metadata (stored in metadata.name)
    // This ensures we use the exact format that OpenRouter expects
    if (modelInfo?.provider === 'openrouter' && modelInfo.metadata?.name) {
      const originalModelId = modelInfo.metadata.name as string;
      console.log(`[MODEL ADAPTER] Using original OpenRouter model ID from metadata: ${originalModelId}`);
      // Still need to pass the full modelId to factory, but extract correctly
      // The factory will split and reconstruct, so we pass the stored ID but note the original
      // Actually, let's create a temporary adapter using the original ID
      return this.modelFactory.create(`openrouter:${originalModelId}`);
    }
    
    return this.modelFactory.create(modelId);
  }
}

// ============================================================================
// MODEL SELECTION SERVICE - Future Feature Placeholder
// ============================================================================

export interface ModelSelectionService {
  /**
   * Recommend best model for a task based on requirements and past usage
   */
  recommendModel(requirements: ModelRequirements): Promise<string>;

  /**
   * Compare models based on criteria
   */
  compareModels(modelIds: string[], criteria: ComparisonCriteria): Promise<ModelComparison>;
}

export interface ModelRequirements {
  taskType?: 'reasoning' | 'creative' | 'code' | 'general';
  maxCost?: number; // Max cost per 1M tokens
  minSpeed?: number; // Min tokens/sec
  requiresTools?: boolean;
  contextWindowMin?: number;
}

export interface ComparisonCriteria {
  weightCost?: number; // 0-1
  weightSpeed?: number; // 0-1
  weightQuality?: number; // 0-1
}

export interface ModelComparison {
  recommended: string;
  rankings: Array<{
    modelId: string;
    score: number;
    reasoning: string;
  }>;
}

// ============================================================================
// AGENT VALIDATION SERVICE
// ============================================================================

export class AgentValidationService {
  constructor(
    private modelRegistry: ModelRegistryPort,
    private toolPort: ToolPort
  ) {}

  /**
   * Validate agent configuration before creation/update
   */
  async validate(data: {
    name: string;
    systemPrompt: string;
    defaultModel: string;
    allowedTools: string[];
  }): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Validate name
    if (!data.name || data.name.trim().length === 0) {
      errors.push(new ValidationError('Name is required', 'name'));
    }
    if (data.name.length > 100) {
      errors.push(new ValidationError('Name must be less than 100 characters', 'name'));
    }

    // Validate system prompt
    if (!data.systemPrompt || data.systemPrompt.trim().length === 0) {
      errors.push(new ValidationError('System prompt is required', 'systemPrompt'));
    }

    // Validate model exists
    const modelInfo = await this.modelRegistry.getModelInfo(data.defaultModel);
    if (!modelInfo) {
      errors.push(
        new ValidationError(`Model ${data.defaultModel} not found`, 'defaultModel')
      );
    }

    // Validate tools exist
    for (const toolName of data.allowedTools) {
      const tool = this.toolPort.get(toolName);
      if (!tool) {
        errors.push(
          new ValidationError(`Tool ${toolName} not found`, 'allowedTools')
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// TOOL REGISTRY SERVICE - Tool Discovery & Management
// ============================================================================

export class ToolRegistryService {
  constructor(private toolPort: ToolPort) {}

  /**
   * Auto-discover and register all tools
   * Called at application startup
   */
  async registerAllTools(tools: any[]): Promise<void> {
    for (const tool of tools) {
      try {
        this.toolPort.register(tool);
      } catch (error) {
        console.error(`Failed to register tool ${tool.name}:`, error);
      }
    }
  }

  /**
   * Get tools with availability status
   */
  async getAvailableTools(): Promise<ToolWithStatus[]> {
    const tools = this.toolPort.listAll();
    const toolsWithStatus: ToolWithStatus[] = [];

    for (const tool of tools) {
      const available = tool.isAvailable
        ? await tool.isAvailable()
        : true;

      toolsWithStatus.push({
        ...tool,
        available,
      });
    }

    return toolsWithStatus;
  }
}

export interface ToolWithStatus {
  name: string;
  description: string;
  available: boolean;
}
