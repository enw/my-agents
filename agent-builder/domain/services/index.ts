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
    // 1. Load agent configuration
    const agent = await this.agentPort.findById(agentId);
    if (!agent) {
      throw new ValidationError(`Agent ${agentId} not found`);
    }

    // 2. Validate and get model
    const modelId = options.modelOverride || agent.defaultModel;
    const modelInfo = await this.modelRegistry.getModelInfo(modelId);
    if (!modelInfo) {
      throw new ValidationError(`Model ${modelId} not found`);
    }

    // 3. Create run trace
    const run = await this.tracePort.createRun({
      agentId: agent.id,
      modelUsed: modelId,
    });

    // 4. Execute agent loop
    try {
      await this.executeAgentLoop(agent, run.id, userMessage, modelInfo.id, options);
      await this.tracePort.updateRunStatus(run.id, 'completed');
    } catch (error) {
      await this.tracePort.updateRunStatus(
        run.id,
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }

    return run.id;
  }

  async executeStream(
    agentId: string,
    userMessage: string,
    options: ExecutionOptions = {}
  ): Promise<string> {
    // Create streaming session if not provided
    const streamSessionId =
      options.streamSessionId || (await this.streamingPort.createSession());

    // Execute in background, stream results
    this.execute(agentId, userMessage, {
      ...options,
      streamSessionId,
    }).catch(async (error) => {
      await this.streamingPort.error(
        streamSessionId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    });

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

    // Get model adapter
    const model = await this.getModelAdapter(modelId);

    // Get allowed tools for this agent
    const allowedTools = this.toolPort.listByNames(agent.allowedTools);
    const toolDefinitions = allowedTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    // Start conversation
    const messages: Message[] = [
      ...conversationHistory,
      { role: 'user' as const, content: userMessage },
    ];

    let turnNumber = conversationHistory.length / 2 + 1; // Approximate
    let continueLoop = true;

    while (continueLoop && turnNumber <= maxTurns) {
      // Call LLM
      const request: GenerateRequest = {
        systemPrompt: agent.systemPrompt,
        messages,
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
      };

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

      // Add assistant message to history
      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      });

      // Execute tools if requested
      const toolExecutions = [];
      if (response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          // Security check: verify tool is allowed
          if (!agent.allowedTools.includes(toolCall.name)) {
            throw new UnauthorizedToolError(toolCall.name, agent.id);
          }

          // Execute tool
          const toolResult = await this.toolPort.execute(
            toolCall.name,
            toolCall.parameters
          );

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
        continueLoop = true;
      } else {
        // No tool calls, we're done
        continueLoop = false;
      }

      // Log turn
      const turn: Turn = {
        turnNumber,
        userMessage: turnNumber === 1 ? userMessage : '[Tool results]',
        assistantMessage: response.content,
        toolExecutions,
        usage: response.usage,
        timestamp: new Date(),
      };
      await this.tracePort.appendTurn(runId, turn);

      turnNumber++;
    }

    if (streamSessionId) {
      await this.streamingPort.complete(streamSessionId);
    }
  }

  /**
   * Execute LLM with streaming support
   */
  private async executeWithStreaming(
    model: ModelPort,
    request: GenerateRequest,
    streamSessionId: string
  ) {
    let fullContent = '';
    const toolCalls: any[] = [];
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    for await (const chunk of model.generateStream(request)) {
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
   */
  private async getModelAdapter(modelId: string): Promise<ModelPort> {
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
