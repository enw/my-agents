export type ModelProvider = 'ollama' | 'openrouter' | 'openai' | 'anthropic';

export interface ModelInfo {
  id: string;
  provider: ModelProvider;
  name: string;
  displayName: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  cost?: { input: number; output: number }; // Per 1M tokens
  speed?: number; // Tokens/sec (measured)
  strengths?: string[];
  lastUsed?: Date;
  supportsTools?: boolean; // Whether the model supports function calling/tools
}
