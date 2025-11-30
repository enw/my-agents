/**
 * Agent Versioning System
 * 
 * Format: VERSION.memnum.MEMORYHASH
 * - VERSION: Prompt version number
 * - memnum: Monotonically increasing memory number
 * - MEMORYHASH: Hash of memory contents
 */

/**
 * Generate memory hash from last message input + output
 * TODO: Improve this to hash the full conversation history or memory state
 * For now, uses a simple hash of input + output concatenated
 */
export async function generateMemoryHash(input: string, output: string): Promise<string> {
  const combined = `${input}${output}`;
  
  // Use Web Crypto API for hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  
  // Use SHA-256 for proper cryptographic hashing
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return first 16 characters for readability (still very unique)
  return hashHex.substring(0, 16);
}

/**
 * Generate full agent version string
 */
export function generateAgentVersion(
  promptVersion: number,
  memoryNumber: number,
  memoryHash: string
): string {
  return `${promptVersion}.${memoryNumber}.${memoryHash}`;
}

/**
 * Parse agent version string
 */
export function parseAgentVersion(versionString: string): {
  promptVersion: number;
  memoryNumber: number;
  memoryHash: string;
} | null {
  const parts = versionString.split('.');
  if (parts.length !== 3) {
    return null;
  }
  
  const promptVersion = parseInt(parts[0], 10);
  const memoryNumber = parseInt(parts[1], 10);
  const memoryHash = parts[2];
  
  if (isNaN(promptVersion) || isNaN(memoryNumber) || !memoryHash) {
    return null;
  }
  
  return { promptVersion, memoryNumber, memoryHash };
}

