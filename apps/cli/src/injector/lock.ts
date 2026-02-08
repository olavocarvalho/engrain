/**
 * Lock file management
 * Per-project lock at .engrain-lock.json (in project root)
 * Based on REFERENCE_PATTERNS.md pattern #3
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DocsLockEntry, DocsLockFile } from '../types';
import { atomicWrite } from '../utils/fs';

const CURRENT_VERSION = 1;

/**
 * Get lock file path (.engrain-lock.json in project root)
 */
function getLockPath(projectPath: string = process.cwd()): string {
  return join(projectPath, '.engrain-lock.json');
}

/**
 * Create empty lock file structure
 */
function createEmptyLockFile(): DocsLockFile {
  return {
    version: CURRENT_VERSION,
    docs: {},
  };
}

/**
 * Read lock file with validation and auto-migration
 * Returns empty structure if file doesn't exist or is invalid
 *
 * @param projectPath - Project directory path (defaults to process.cwd())
 * @returns Lock file contents
 *
 * @example
 * const lock = await readLock();
 * const nextJsDocs = lock.docs["next-js"];
 */
async function readLock(projectPath: string = process.cwd()): Promise<DocsLockFile> {
  const lockPath = getLockPath(projectPath);

  try {
    const content = await readFile(lockPath, 'utf-8');
    const parsed = JSON.parse(content) as DocsLockFile;

    // Validate version - wipe if old format (backwards incompatible)
    if (typeof parsed.version !== 'number' || !parsed.docs) {
      return createEmptyLockFile();
    }

    // Wipe if old version (v1 only supports version 1)
    if (parsed.version < CURRENT_VERSION) {
      return createEmptyLockFile();
    }

    return parsed;
  } catch {
    // File doesn't exist or is invalid - return empty
    return createEmptyLockFile();
  }
}

/**
 * Write lock file with atomic operation (temp file + rename)
 *
 * @param lock - Lock file to write
 * @param projectPath - Project directory path (defaults to process.cwd())
 *
 * @example
 * const lock = await readLock();
 * lock.docs["next-js"] = { ... };
 * await writeLock(lock);
 */
async function writeLock(lock: DocsLockFile, projectPath: string = process.cwd()): Promise<void> {
  const lockPath = getLockPath(projectPath);

  // Write with pretty formatting for human readability
  const content = JSON.stringify(lock, null, 2);
  await atomicWrite(lockPath, content);
}

/**
 * Add or update docs entry in lock file
 *
 * @param docId - Document identifier
 * @param entry - Lock entry data (without timestamps)
 * @param projectPath - Project directory path (defaults to process.cwd())
 *
 * @example
 * await addDocsToLock("next-js", {
 *   source: "https://github.com/vercel/next.js",
 *   sourceType: "github",
 *   ref: "canary",
 *   subpath: "docs",
 *   commitHash: "abc123",
 *   indexHash: "def456",
 *   indexSizeBytes: 8192,
 *   indexSizeTokens: 2048,
 * });
 */
export async function addDocsToLock(
  docId: string,
  entry: Omit<DocsLockEntry, 'installedAt' | 'updatedAt'>,
  projectPath: string = process.cwd()
): Promise<void> {
  const lock = await readLock(projectPath);
  const now = new Date().toISOString();

  const existingEntry = lock.docs[docId];

  lock.docs[docId] = {
    ...entry,
    installedAt: existingEntry?.installedAt ?? now, // Preserve original install time
    updatedAt: now,
  };

  await writeLock(lock, projectPath);
}

/**
 * Get all docs for a project
 *
 * @param projectPath - Project directory path (defaults to process.cwd())
 * @returns Record of docId -> entry
 */
export async function getAllDocsForProject(
  projectPath: string = process.cwd()
): Promise<Record<string, DocsLockEntry>> {
  const lock = await readLock(projectPath);
  return lock.docs;
}

/**
 * Remove docs entry from lock file
 *
 * @param docId - Document identifier
 * @param projectPath - Project directory path (defaults to process.cwd())
 */
export async function removeDocFromLock(docId: string, projectPath: string = process.cwd()): Promise<void> {
  const lock = await readLock(projectPath);

  if (lock.docs[docId]) {
    delete lock.docs[docId];
    await writeLock(lock, projectPath);
  }
}

/**
 * Clear all docs for a project
 *
 * @param projectPath - Project directory path (defaults to process.cwd())
 */
export async function clearAllDocs(projectPath: string = process.cwd()): Promise<void> {
  const lock = await readLock(projectPath);

  if (Object.keys(lock.docs).length > 0) {
    lock.docs = {};
    await writeLock(lock, projectPath);
  }
}
