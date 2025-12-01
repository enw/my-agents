/**
 * Message Windowing Service
 * 
 * Compresses conversation history by summarizing chunks of messages
 * to reduce token usage while maintaining context.
 */

import { Message, ModelPort, GenerateRequest } from '../ports';

export class MessageWindowingService {
  /**
   * Compress messages by summarizing chunks
   * 
   * Groups messages into chunks of windowSize, then summarizes each chunk
   * (except the last one) into a single summary message.
   * 
   * @param messages - Full conversation history
   * @param windowSize - Number of messages per chunk (default: 4)
   * @param model - Model adapter to use for summarization
   * @returns Compressed message array with summaries
   */
  async compressMessages(
    messages: Message[],
    windowSize: number,
    model: ModelPort
  ): Promise<Message[]> {
    if (messages.length <= windowSize) {
      // Not enough messages to compress
      return messages;
    }

    const compressed: Message[] = [];
    
    // Group messages into chunks
    const chunks: Message[][] = [];
    for (let i = 0; i < messages.length; i += windowSize) {
      chunks.push(messages.slice(i, i + windowSize));
    }

    // Summarize all chunks except the last one
    for (let i = 0; i < chunks.length - 1; i++) {
      const chunk = chunks[i];
      try {
        const summary = await this.summarizeChunk(chunk, model);
        compressed.push({
          role: 'system',
          content: `Previous conversation summary: ${summary}`,
        });
      } catch (error) {
        console.error(`[MESSAGE WINDOWING] Failed to summarize chunk ${i}:`, error);
        // Fallback: keep original messages if summarization fails
        compressed.push(...chunk);
      }
    }

    // Keep the last chunk uncompressed (most recent messages)
    compressed.push(...chunks[chunks.length - 1]);

    return compressed;
  }

  /**
   * Summarize a chunk of messages using the model
   */
  private async summarizeChunk(
    chunk: Message[],
    model: ModelPort
  ): Promise<string> {
    const summarizationPrompt = `Summarize the following conversation chunk, preserving key information, decisions, and context that would be important for continuing the conversation. Be concise but comprehensive.`;

    const request: GenerateRequest = {
      systemPrompt: summarizationPrompt,
      messages: [
        {
          role: 'system',
          content: 'You are a conversation summarizer. Create concise summaries that preserve important context.',
        },
        ...chunk,
        {
          role: 'user',
          content: 'Please provide a summary of the conversation above.',
        },
      ],
      settings: {
        temperature: 0.3, // Lower temperature for more consistent summaries
        maxTokens: 500, // Limit summary length
      },
    };

    const response = await model.generate(request);
    return response.content;
  }
}


