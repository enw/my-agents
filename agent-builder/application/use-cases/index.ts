/**
 * Application Layer - Use Cases
 *
 * These are the entry points for the application. They orchestrate domain services
 * and handle cross-cutting concerns like transactions and authorization.
 *
 * Use cases are what the API routes and UI will call.
 */

import {
  Agent,
  AgentPort,
  CreateAgentData,
  ModelRegistryPort,
  Run,
  ToolPort,
  TracePort,
  UpdateAgentData,
  ValidationError,
} from '../../domain/ports';

import {
  AgentExecutionService,
  AgentValidationService,
  ExecutionOptions,
} from '../../domain/services';

// ============================================================================
// AGENT MANAGEMENT USE CASES
// ============================================================================

/**
 * Use Case: Create a new agent
 */
export class CreateAgentUseCase {
  constructor(
    private agentPort: AgentPort,
    private validationService: AgentValidationService
  ) {}

  async execute(data: CreateAgentData): Promise<Agent> {
    // 1. Validate agent data
    const validation = await this.validationService.validate({
      name: data.name,
      systemPrompt: data.systemPrompt,
      defaultModel: data.defaultModel,
      allowedTools: data.allowedTools || [],
    });

    if (!validation.valid) {
      throw validation.errors[0]; // Throw first error
    }

    // 2. Create agent
    return await this.agentPort.create(data);
  }
}

/**
 * Use Case: Update an existing agent
 */
export class UpdateAgentUseCase {
  constructor(
    private agentPort: AgentPort,
    private validationService: AgentValidationService
  ) {}

  async execute(agentId: string, data: UpdateAgentData): Promise<Agent> {
    // 1. Verify agent exists
    const existing = await this.agentPort.findById(agentId);
    if (!existing) {
      throw new ValidationError(`Agent ${agentId} not found`);
    }

    // 2. Merge and validate updated data
    const merged = {
      name: data.name || existing.name,
      systemPrompt: data.systemPrompt || existing.systemPrompt,
      defaultModel: data.defaultModel || existing.defaultModel,
      allowedTools: data.allowedTools || existing.allowedTools,
    };

    const validation = await this.validationService.validate(merged);
    if (!validation.valid) {
      throw validation.errors[0];
    }

    // 3. Update agent
    return await this.agentPort.update(agentId, data);
  }
}

/**
 * Use Case: Delete an agent
 */
export class DeleteAgentUseCase {
  constructor(
    private agentPort: AgentPort,
    private tracePort: TracePort
  ) {}

  async execute(agentId: string): Promise<void> {
    // 1. Verify agent exists
    const exists = await this.agentPort.exists(agentId);
    if (!exists) {
      throw new ValidationError(`Agent ${agentId} not found`);
    }

    // 2. Check if agent has runs (optional - prevent deletion if has history)
    // const runs = await this.tracePort.queryRuns({ agentId, limit: 1 });
    // if (runs.length > 0) {
    //   throw new ValidationError('Cannot delete agent with execution history');
    // }

    // 3. Delete agent
    await this.agentPort.delete(agentId);
  }
}

/**
 * Use Case: List agents with optional filtering
 */
export class ListAgentsUseCase {
  constructor(private agentPort: AgentPort) {}

  async execute(options: {
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Agent[]> {
    return await this.agentPort.findMany({
      tags: options.tags,
      search: options.search,
      limit: options.limit || 50,
      offset: options.offset || 0,
      orderBy: 'updatedAt',
      orderDir: 'desc',
    });
  }
}

/**
 * Use Case: Get agent by ID
 */
export class GetAgentUseCase {
  constructor(private agentPort: AgentPort) {}

  async execute(agentId: string): Promise<Agent> {
    const agent = await this.agentPort.findById(agentId);
    if (!agent) {
      throw new ValidationError(`Agent ${agentId} not found`);
    }
    return agent;
  }
}

// ============================================================================
// AGENT EXECUTION USE CASES
// ============================================================================

/**
 * Use Case: Execute an agent (non-streaming)
 */
export class ExecuteAgentUseCase {
  constructor(private executionService: AgentExecutionService) {}

  async execute(request: {
    agentId: string;
    message: string;
    modelOverride?: string;
    maxTurns?: number;
  }): Promise<string> {
    // Returns run ID
    return await this.executionService.execute(request.agentId, request.message, {
      modelOverride: request.modelOverride,
      maxTurns: request.maxTurns,
    });
  }
}

/**
 * Use Case: Execute an agent with streaming
 */
export class ExecuteAgentStreamUseCase {
  constructor(private executionService: AgentExecutionService) {}

  async execute(request: {
    agentId: string;
    message: string;
    modelOverride?: string;
    maxTurns?: number;
    streamSessionId?: string;
  }): Promise<string> {
    // Returns stream session ID
    return await this.executionService.executeStream(
      request.agentId,
      request.message,
      {
        modelOverride: request.modelOverride,
        maxTurns: request.maxTurns,
        streamSessionId: request.streamSessionId,
      }
    );
  }
}

/**
 * Use Case: Continue an existing conversation
 */
export class ContinueConversationUseCase {
  constructor(private executionService: AgentExecutionService) {}

  async execute(request: {
    runId: string;
    message: string;
  }): Promise<void> {
    await this.executionService.continueConversation(request.runId, request.message);
  }
}

// ============================================================================
// MODEL DISCOVERY USE CASES
// ============================================================================

/**
 * Use Case: List all available models
 */
export class ListModelsUseCase {
  constructor(private modelRegistry: ModelRegistryPort) {}

  async execute(options?: {
    provider?: string;
    refresh?: boolean;
  }) {
    if (options?.refresh) {
      await this.modelRegistry.refresh();
    }

    if (options?.provider) {
      return await this.modelRegistry.listByProvider(options.provider as any);
    }

    return await this.modelRegistry.listAllModels();
  }
}

/**
 * Use Case: Get detailed model information
 */
export class GetModelInfoUseCase {
  constructor(private modelRegistry: ModelRegistryPort) {}

  async execute(modelId: string) {
    const info = await this.modelRegistry.getModelInfo(modelId);
    if (!info) {
      throw new ValidationError(`Model ${modelId} not found`);
    }
    return info;
  }
}

// ============================================================================
// TOOL MANAGEMENT USE CASES
// ============================================================================

/**
 * Use Case: List all available tools
 */
export class ListToolsUseCase {
  constructor(private toolPort: ToolPort) {}

  async execute(): Promise<Array<{
    name: string;
    description: string;
    parameters: any;
  }>> {
    const tools = this.toolPort.listAll();
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}

/**
 * Use Case: Test tool execution (for debugging)
 */
export class TestToolUseCase {
  constructor(private toolPort: ToolPort) {}

  async execute(toolName: string, parameters: Record<string, unknown>) {
    // Validate tool exists
    const tool = this.toolPort.get(toolName);
    if (!tool) {
      throw new ValidationError(`Tool ${toolName} not found`);
    }

    // Validate parameters
    this.toolPort.validateParameters(toolName, parameters);

    // Execute tool
    return await this.toolPort.execute(toolName, parameters);
  }
}

// ============================================================================
// EXECUTION HISTORY USE CASES
// ============================================================================

/**
 * Use Case: Get execution run details
 */
export class GetRunUseCase {
  constructor(private tracePort: TracePort) {}

  async execute(runId: string): Promise<Run> {
    const run = await this.tracePort.getRun(runId);
    if (!run) {
      throw new ValidationError(`Run ${runId} not found`);
    }
    return run;
  }
}

/**
 * Use Case: List runs for an agent
 */
export class ListRunsUseCase {
  constructor(private tracePort: TracePort) {}

  async execute(options: {
    agentId?: string;
    status?: 'running' | 'completed' | 'error';
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    return await this.tracePort.queryRuns({
      agentId: options.agentId,
      status: options.status,
      fromDate: options.fromDate,
      toDate: options.toDate,
      limit: options.limit || 50,
      offset: options.offset || 0,
    });
  }
}

/**
 * Use Case: Get tool usage statistics
 */
export class GetToolStatsUseCase {
  constructor(private tracePort: TracePort) {}

  async execute(agentId: string) {
    return await this.tracePort.getToolStats(agentId);
  }
}

/**
 * Use Case: Delete a run
 */
export class DeleteRunUseCase {
  constructor(private tracePort: TracePort) {}

  async execute(runId: string): Promise<void> {
    // Verify run exists
    const run = await this.tracePort.getRun(runId);
    if (!run) {
      throw new ValidationError(`Run ${runId} not found`);
    }

    // Delete the run (cascades to turns and tool executions)
    await this.tracePort.deleteRun(runId);
  }
}

// ============================================================================
// USE CASE FACTORY - Dependency Injection Container
// ============================================================================

/**
 * Factory for creating use cases with all dependencies wired up
 */
export class UseCaseFactory {
  constructor(
    private deps: {
      agentPort: AgentPort;
      modelRegistry: ModelRegistryPort;
      toolPort: ToolPort;
      tracePort: TracePort;
      executionService: AgentExecutionService;
      validationService: AgentValidationService;
    }
  ) {}

  // Agent Management
  createAgent() {
    return new CreateAgentUseCase(this.deps.agentPort, this.deps.validationService);
  }

  updateAgent() {
    return new UpdateAgentUseCase(this.deps.agentPort, this.deps.validationService);
  }

  deleteAgent() {
    return new DeleteAgentUseCase(this.deps.agentPort, this.deps.tracePort);
  }

  listAgents() {
    return new ListAgentsUseCase(this.deps.agentPort);
  }

  getAgent() {
    return new GetAgentUseCase(this.deps.agentPort);
  }

  // Agent Execution
  executeAgent() {
    return new ExecuteAgentUseCase(this.deps.executionService);
  }

  executeAgentStream() {
    return new ExecuteAgentStreamUseCase(this.deps.executionService);
  }

  continueConversation() {
    return new ContinueConversationUseCase(this.deps.executionService);
  }

  // Model Discovery
  listModels() {
    return new ListModelsUseCase(this.deps.modelRegistry);
  }

  getModelInfo() {
    return new GetModelInfoUseCase(this.deps.modelRegistry);
  }

  // Tool Management
  listTools() {
    return new ListToolsUseCase(this.deps.toolPort);
  }

  testTool() {
    return new TestToolUseCase(this.deps.toolPort);
  }

  // Execution History
  getRun() {
    return new GetRunUseCase(this.deps.tracePort);
  }

  listRuns() {
    return new ListRunsUseCase(this.deps.tracePort);
  }

  getToolStats() {
    return new GetToolStatsUseCase(this.deps.tracePort);
  }

  deleteRun() {
    return new DeleteRunUseCase(this.deps.tracePort);
  }
}

// ============================================================================
// USE CASE INPUT/OUTPUT DTOs
// ============================================================================

/**
 * Data Transfer Objects for use case inputs/outputs
 * These provide clear contracts for the API layer
 */

export interface CreateAgentRequest {
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  allowedTools?: string[];
  tags?: string[];
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  systemPrompt?: string;
  defaultModel?: string;
  allowedTools?: string[];
  tags?: string[];
}

export interface ExecuteAgentRequest {
  agentId: string;
  message: string;
  modelOverride?: string;
  maxTurns?: number;
  stream?: boolean;
}

export interface ExecuteAgentResponse {
  runId?: string;
  streamSessionId?: string;
  status: 'completed' | 'streaming' | 'error';
  error?: string;
}

export interface ListAgentsRequest {
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListRunsRequest {
  agentId?: string;
  status?: 'running' | 'completed' | 'error';
  fromDate?: string; // ISO date string
  toDate?: string;
  limit?: number;
  offset?: number;
}

export interface TestToolRequest {
  toolName: string;
  parameters: Record<string, unknown>;
}
