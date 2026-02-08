/**
 * AGENTS.md injection logic
 * Based on INJECTION_FORMAT.md specification (two-level marker system)
 */

import { readFile, rm } from 'node:fs/promises';
import { calculateSize } from '../indexer/size';
import type { InjectionResult } from '../types';
import { InjectionError } from '../types';
import { atomicWrite } from '../utils/fs';

/**
 * Global engrain wrapper instruction
 */
const ENGRAIN_WRAPPER_INSTRUCTION =
  'STOP! Prefer retrieval-led reasoning from local docs and skills over pre-training-led reasoning for any tasks';

/**
 * Find engrain wrapper in content
 *
 * @param content - File content
 * @returns Object with start and end positions, or null if not found
 */
function findEngrainWrapper(content: string): { start: number; end: number } | null {
  const start = content.indexOf('<engrain important="');
  if (start === -1) return null;

  const end = content.indexOf('</engrain>', start);
  if (end === -1) return null;

  return { start, end: end + '</engrain>'.length };
}

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
 * Create doc block with markers (no metadata - stored in lock file)
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
 * Create engrain wrapper with first doc block
 *
 * @param firstDocBlock - First doc block to wrap
 * @returns Wrapper with doc block inside
 */
function createEngrainWrapper(firstDocBlock: string): string {
  return `<engrain important="${ENGRAIN_WRAPPER_INSTRUCTION}">

${firstDocBlock}

</engrain>
`;
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
 * @throws {InjectionError} If block exists and force is false, or if wrapper not found
 */
function injectDocBlock(
  content: string,
  docId: string,
  newBlock: string,
  force: boolean
): { content: string; existed: boolean } {
  // Check if engrain wrapper exists
  const wrapper = findEngrainWrapper(content);

  // If no wrapper and no content, create wrapper with first doc
  if (!wrapper && content.trim() === '') {
    return { content: createEngrainWrapper(newBlock), existed: false };
  }

  // If no wrapper but content exists, error
  if (!wrapper) {
    throw new InjectionError(
      `Global <engrain> wrapper not found in file. Cannot inject docs without wrapper.`
    );
  }

  // Check if doc block already exists
  const existing = findDocBlock(content, docId);

  if (existing) {
    if (!force) {
      throw new InjectionError(`Doc "${docId}" already exists in file. Use --force to update.`);
    }
    // Replace existing block
    const newContent = content.slice(0, existing.start) + newBlock + content.slice(existing.end);
    return { content: newContent, existed: true };
  }

  // Insert new block before closing </engrain> tag
  const closeTagIndex = content.lastIndexOf('</engrain>');
  const newContent = `${content.slice(0, closeTagIndex) + newBlock}\n\n${content.slice(closeTagIndex)}`;

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
    content = await readFile(filePath, 'utf-8');
  } catch {
    // File doesn't exist - create new
    content = '';
  }

  // Create block with markers (no metadata - stored in lock file)
  const block = createDocBlock(docId, indexContent);

  // Inject into content
  const { content: newContent, existed } = injectDocBlock(content, docId, block, force);

  // Calculate sizes
  const { sizeBytes, sizeTokens } = calculateSize(block);

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
 * Remove the entire engrain wrapper from file content, preserving surrounding content
 *
 * @param filePath - Path to AGENTS.md
 * @returns true if wrapper was removed, false if not found
 */
export async function removeEngrainWrapper(filePath: string): Promise<boolean> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return false;
  }

  const wrapper = findEngrainWrapper(content);
  if (!wrapper) {
    return false;
  }

  // Remove wrapper and surrounding whitespace
  const before = content.slice(0, wrapper.start).trimEnd();
  const after = content.slice(wrapper.end).trimStart();

  const newContent = before && after ? `${before}\n\n${after}` : before || after;

  if (newContent.trim() === '') {
    // File would be empty — delete it
    await rm(filePath, { force: true });
  } else {
    await atomicWrite(filePath, newContent.endsWith('\n') ? newContent : `${newContent}\n`);
  }

  return true;
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
    content = await readFile(filePath, 'utf-8');
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
  const newContent = `${before}\n\n${after}`;

  // Atomic write
  await atomicWrite(filePath, newContent);

  return true;
}
