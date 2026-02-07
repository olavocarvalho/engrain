/**
 * Size calculation - Bytes and tokens
 * Uses tokenx for accurate token counting
 * Based on PLAN.md Decision 9 (size reporting only, no warnings in v1.0)
 */

import { estimateTokenCount } from "tokenx";

/**
 * Calculate size of content in bytes and tokens
 *
 * @param content - Content to measure
 * @returns Object with sizeBytes and sizeTokens
 *
 * @example
 * const { sizeBytes, sizeTokens } = calculateSize(indexContent);
 * console.log(`Size: ${sizeBytes} bytes, ${sizeTokens} tokens`);
 */
export function calculateSize(
  content: string
): { sizeBytes: number; sizeTokens: number } {
  // Calculate bytes (UTF-8 encoding)
  const sizeBytes = Buffer.byteLength(content, "utf-8");

  // Calculate tokens using tokenx
  // tokenx uses heuristic estimation for fast, accurate token counts (96% accuracy)
  const sizeTokens = estimateTokenCount(content);

  return { sizeBytes, sizeTokens };
}

/**
 * Format size for human-readable display
 *
 * @param sizeBytes - Size in bytes
 * @param sizeTokens - Size in tokens
 * @returns Formatted string (e.g., "8.2 KB (2,048 tokens)")
 */
export function formatSize(sizeBytes: number, sizeTokens: number): string {
  let bytesDisplay: string;

  if (sizeBytes < 1024) {
    bytesDisplay = `${sizeBytes} B`;
  } else if (sizeBytes < 1024 * 1024) {
    bytesDisplay = `${(sizeBytes / 1024).toFixed(1)} KB`;
  } else {
    bytesDisplay = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const tokensDisplay = sizeTokens.toLocaleString();

  return `${bytesDisplay} · ${tokensDisplay} tokens`;
}
