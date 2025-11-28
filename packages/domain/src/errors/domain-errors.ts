export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AgentNotFoundError extends DomainError {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
  }
}

export class ToolNotAllowedError extends DomainError {
  constructor(toolName: string, agentId: string) {
    super(`Tool '${toolName}' not allowed for agent ${agentId}`);
  }
}

export class ModelProviderError extends DomainError {
  constructor(provider: string, message: string) {
    super(`${provider} error: ${message}`);
  }
}

export class ToolExecutionError extends DomainError {
  constructor(toolName: string, error: string) {
    super(`Tool '${toolName}' execution failed: ${error}`);
  }
}

export class ValidationError extends DomainError {
  constructor(public errors: string[]) {
    super(`Validation failed: ${errors.join(', ')}`);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors
    };
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
