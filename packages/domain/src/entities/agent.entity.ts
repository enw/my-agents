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
  createdAt: Date;
  updatedAt: Date;
}

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
