/**
 * Structured Memory Service
 * 
 * Manages per-agent markdown files that track key conversation data
 * and current topics. This memory is included in every model request.
 */

import { Message, ModelPort, GenerateRequest } from '../ports';
import * as fs from 'fs/promises';
import * as path from 'path';

export class StructuredMemoryService {
  constructor(private workspaceRoot: string) {}

  /**
   * Get the file path for an agent's memory file
   */
  getMemoryPath(agentId: string): string {
    return path.join(this.workspaceRoot, agentId, 'memory.md');
  }

  /**
   * Read the memory file for an agent
   * Returns null if file doesn't exist
   */
  async readMemory(agentId: string): Promise<string | null> {
    try {
      const memoryPath = this.getMemoryPath(agentId);
      const content = await fs.readFile(memoryPath, 'utf-8');
      return content;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet - this is normal for first conversation
        return null;
      }
      console.error(`[STRUCTURED MEMORY] Failed to read memory for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Get memory content formatted for inclusion in messages
   */
  async getMemoryForMessages(agentId: string): Promise<string | null> {
    const memory = await this.readMemory(agentId);
    if (!memory) {
      return null;
    }
    
    // Return the memory content as-is (it's already in markdown format)
    return memory;
  }

  /**
   * Write memory content directly (for manual edits)
   */
  async writeMemory(agentId: string, content: string): Promise<void> {
    try {
      const memoryPath = this.getMemoryPath(agentId);
      const memoryDir = path.dirname(memoryPath);
      
      // Ensure directory exists
      await fs.mkdir(memoryDir, { recursive: true });
      
      // Write memory file
      await fs.writeFile(memoryPath, content, 'utf-8');
      
      console.log(`[STRUCTURED MEMORY] Wrote memory for agent ${agentId}`);
    } catch (error) {
      console.error(`[STRUCTURED MEMORY] Failed to write memory for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Update the memory file with extracted key data and current topic
   */
  async updateMemory(
    agentId: string,
    runId: string,
    messages: Message[],
    model: ModelPort
  ): Promise<void> {
    try {
      // Extract key conversation data and current topic using the model
      const extracted = await this.extractMemoryData(messages, model);
      
      // Format as markdown
      const memoryContent = this.formatMemoryMarkdown(extracted, runId);
      
      // Ensure directory exists
      const memoryPath = this.getMemoryPath(agentId);
      const memoryDir = path.dirname(memoryPath);
      await fs.mkdir(memoryDir, { recursive: true });
      
      // Write memory file
      await fs.writeFile(memoryPath, memoryContent, 'utf-8');
      
      console.log(`[STRUCTURED MEMORY] Updated memory for agent ${agentId}`);
    } catch (error) {
      console.error(`[STRUCTURED MEMORY] Failed to update memory for agent ${agentId}:`, error);
      // Don't throw - continue execution even if memory update fails
    }
  }

  /**
   * Extract key conversation data and current topic using the model
   */
  private async extractMemoryData(
    messages: Message[],
    model: ModelPort
  ): Promise<{ keyData: string; currentTopic: string }> {
    const extractionPrompt = `Analyze the conversation and extract:
1. KEY CONVO DATA: Important facts, decisions, user preferences, key information that should be remembered
2. CURRENT TOPIC: What is the current focus/topic of the conversation?

Format your response as:
KEY CONVO DATA: [your extraction]
CURRENT TOPIC: [your extraction]`;

    const request: GenerateRequest = {
      systemPrompt: extractionPrompt,
      messages: [
        {
          role: 'system',
          content: 'You are a conversation analyzer. Extract key information and current topics from conversations.',
        },
        ...messages.slice(-10), // Use last 10 messages for context (recent is most relevant)
        {
          role: 'user',
          content: 'Extract the key conversation data and current topic from the conversation above.',
        },
      ],
      settings: {
        temperature: 0.3, // Lower temperature for more consistent extraction
        maxTokens: 1000,
      },
    };

    const response = await model.generate(request);
    const content = response.content;

    // Parse the response
    const keyDataMatch = content.match(/KEY CONVO DATA:\s*(.+?)(?=CURRENT TOPIC:|$)/is);
    const topicMatch = content.match(/CURRENT TOPIC:\s*(.+?)$/is);

    return {
      keyData: keyDataMatch ? keyDataMatch[1].trim() : 'No key data extracted yet.',
      currentTopic: topicMatch ? topicMatch[1].trim() : 'No specific topic identified.',
    };
  }

  /**
   * Format extracted data as markdown
   */
  private formatMemoryMarkdown(
    extracted: { keyData: string; currentTopic: string },
    runId: string
  ): string {
    const timestamp = new Date().toISOString();
    
    return `# Conversation Memory

## KEY CONVO DATA
${extracted.keyData}

## CURRENT TOPIC
${extracted.currentTopic}

---
Last updated: ${timestamp}
Run ID: ${runId}
`;
  }
}

