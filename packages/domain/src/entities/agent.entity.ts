export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  allowedTools: string[];
  tags: string[];
  temperature: number;
  maxTokens: number;
  messageWindowLength?: number; // Default: 4
  structuredMemory?: boolean; // Default: true
  createdAt: Date;
  updatedAt: Date;
}

// Note: The canonical Agent interface is in packages/domain/src/ports/index.ts
// This entity file maintains compatibility but the ports version is authoritative

export interface CreateAgentDto {
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  allowedTools: string[];
  tags?: string[];
  temperature?: number;
  maxTokens?: number;
}

export interface AgentFilters {
  tags?: string[];
  search?: string;
}
