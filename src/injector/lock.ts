/**
 * Lock file management
 * Global lock at ~/.engrain/.engrain-lock.json
 * Based on REFERENCE_PATTERNS.md pattern #3
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { DocsLockEntry, DocsLockFile } from "../types";

const CURRENT_VERSION = 1;

/**
 * Get lock file path (global: ~/.engrain/.engrain-lock.json)
 */
function getLockPath(): string {
  return join(homedir(), ".engrain", ".engrain-lock.json");
}

/**
 * Create empty lock file structure
 */
function createEmptyLockFile(): DocsLockFile {
  return {
    version: CURRENT_VERSION,
    projects: {},
  };
}

/**
 * Read lock file with validation and auto-migration
 * Returns empty structure if file doesn't exist or is invalid
 *
 * @returns Lock file contents
 *
 * @example
 * const lock = await readLock();
 * const projectDocs = lock.projects[process.cwd()];
 */
async function readLock(): Promise<DocsLockFile> {
  const lockPath = getLockPath();

  try {
    const content = await readFile(lockPath, "utf-8");
    const parsed = JSON.parse(content) as DocsLockFile;

    // Validate version - wipe if old format (backwards incompatible)
    if (typeof parsed.version !== "number" || !parsed.projects) {
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
 * Write lock file with atomic operation
 * Creates directory if it doesn't exist
 *
 * @param lock - Lock file to write
 *
 * @example
 * const lock = await readLock();
 * lock.projects[process.cwd()]["next-js"] = { ... };
 * await writeLock(lock);
 */
async function writeLock(lock: DocsLockFile): Promise<void> {
  const lockPath = getLockPath();

  // Ensure directory exists
  await mkdir(dirname(lockPath), { recursive: true });

  // Write with pretty formatting for human readability
  const content = JSON.stringify(lock, null, 2);
  await writeFile(lockPath, content, "utf-8");
}

/**
 * Add or update docs entry in lock file
 *
 * @param projectPath - Project directory path (usually process.cwd())
 * @param docId - Document identifier
 * @param entry - Lock entry data (without timestamps)
 *
 * @example
 * await addDocsToLock(process.cwd(), "next-js", {
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
  projectPath: string,
  docId: string,
  entry: Omit<DocsLockEntry, "installedAt" | "updatedAt">
): Promise<void> {
  const lock = await readLock();
  const now = new Date().toISOString();

  // Ensure project exists in lock
  const projectDocs = lock.projects[projectPath] ?? {};
  lock.projects[projectPath] = projectDocs;

  const existingEntry = projectDocs[docId];

  projectDocs[docId] = {
    ...entry,
    installedAt: existingEntry?.installedAt ?? now, // Preserve original install time
    updatedAt: now,
  };

  await writeLock(lock);
}

/**
 * Get all docs for a project
 *
 * @param projectPath - Project directory path
 * @returns Record of docId -> entry
 */
export async function getAllDocsForProject(
  projectPath: string
): Promise<Record<string, DocsLockEntry>> {
  const lock = await readLock();
  return lock.projects[projectPath] ?? {};
}

/**
 * Remove docs entry from lock file
 *
 * @param projectPath - Project directory path
 * @param docId - Document identifier
 */
export async function removeDocFromLock(projectPath: string, docId: string): Promise<void> {
  const lock = await readLock();

  const projectDocs = lock.projects[projectPath];
  if (projectDocs) {
    delete projectDocs[docId];

    // Clean up empty projects
    if (Object.keys(projectDocs).length === 0) {
      delete lock.projects[projectPath];
    }

    await writeLock(lock);
  }
}

/**
 * Clear all docs for a project
 *
 * @param projectPath - Project directory path
 */
export async function clearAllDocs(projectPath: string): Promise<void> {
  const lock = await readLock();

  if (lock.projects[projectPath]) {
    delete lock.projects[projectPath];
    await writeLock(lock);
  }
}
