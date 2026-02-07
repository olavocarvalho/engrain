/**
 * AGENTS.md injection logic
 * Based on FORMAT.md specification
 */

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { InjectionResult } from "../types";
import { InjectionError } from "../types";
import { calculateSize } from "../indexer/size";

/**
 * Find doc block in content
 *
 * @param content - File content
 * @param docId - Document identifier
 * @returns Object with start and end positions, or null if not found
 */
function findDocBlock(content: string, docId: string): { start: number; end: number } | null {
  const startMarker = `<docs name="${docId}">`;
  const endMarker = `</docs>`;

  const start = content.indexOf(startMarker);
  if (start === -1) return null;

  const end = content.indexOf(endMarker, start);
  if (end === -1) return null;

  return { start, end: end + endMarker.length };
}

/**
 * Create doc block with markers
 *
 * @param docId - Document identifier
 * @param index - Index content
 * @returns Formatted block with markers
 */
function createDocBlock(docId: string, index: string): string {
  return `<docs name="${docId}">
${index}
</docs>`;
}

/**
 * Inject or update doc block in content
 *
 * @param content - File content
 * @param docId - Document identifier
 * @param newBlock - New block content (with markers)
 * @param force - Whether to overwrite existing block
 * @returns Updated content and whether block existed
 *
 * @throws {InjectionError} If block exists and force is false
 */
function injectDocBlock(
  content: string,
  docId: string,
  newBlock: string,
  force: boolean
): { content: string; existed: boolean } {
  const existing = findDocBlock(content, docId);

  if (existing) {
    if (!force) {
      throw new InjectionError(
        `Doc "${docId}" already exists in file. Use --force to update.`,
        "",
        docId
      );
    }
    // Replace existing block
    const newContent = content.slice(0, existing.start) + newBlock + content.slice(existing.end);
    return { content: newContent, existed: true };
  }

  // Append new block
  const newContent = content.trim() + "\n\n" + newBlock + "\n";
  return { content: newContent, existed: false };
}

/**
 * Inject index into AGENTS.md with atomic write
 *
 * @param filePath - Path to AGENTS.md (or other output file)
 * @param docId - Document identifier
 * @param indexContent - Index content (without markers)
 * @param force - Whether to overwrite existing block
 * @returns Injection result with sizes
 *
 * @example
 * const result = await injectIndex("AGENTS.md", "next-js", indexContent, false);
 * console.log(`Injected ${result.sizeBytes} bytes`);
 */
export async function injectIndex(
  filePath: string,
  docId: string,
  indexContent: string,
  force: boolean
): Promise<InjectionResult> {
  // Read existing content (or empty string if file doesn't exist)
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    // File doesn't exist - create new
    content = "";
  }

  // Create block with markers
  const block = createDocBlock(docId, indexContent);

  // Inject into content
  const { content: newContent, existed } = injectDocBlock(content, docId, block, force);

  // Calculate sizes
  const { sizeBytes, sizeTokens } = await calculateSize(block);

  // Atomic write: temp file + rename
  await atomicWrite(filePath, newContent);

  return {
    filePath,
    docId,
    existed,
    sizeBytes,
    sizeTokens,
  };
}

/**
 * Atomic file write: write to temp file in same directory, then rename
 * Prevents corruption if write fails mid-way
 * Temp file is in same directory to avoid EXDEV errors on cross-filesystem renames
 *
 * @param filePath - Target file path
 * @param content - Content to write
 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const targetDir = dirname(filePath);

  // Ensure directory exists
  await mkdir(targetDir, { recursive: true });

  // Write to temp file in SAME directory as target (avoids EXDEV cross-filesystem errors)
  const tempPath = join(targetDir, `.engrain-tmp-${Date.now()}.tmp`);

  try {
    await writeFile(tempPath, content, "utf-8");

    // Rename to target (atomic on most filesystems)
    await rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Remove doc block from file
 *
 * @param filePath - Path to AGENTS.md
 * @param docId - Document identifier
 * @returns true if block was removed, false if not found
 */
export async function removeDocBlock(filePath: string, docId: string): Promise<boolean> {
  // Read existing content
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    // File doesn't exist
    return false;
  }

  const existing = findDocBlock(content, docId);
  if (!existing) {
    return false;
  }

  // Remove block (including surrounding whitespace)
  const before = content.slice(0, existing.start).trimEnd();
  const after = content.slice(existing.end).trimStart();
  const newContent = before + "\n\n" + after;

  // Atomic write
  await atomicWrite(filePath, newContent);

  return true;
}
