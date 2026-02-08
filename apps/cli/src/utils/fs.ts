/**
 * File system utilities — atomic writes, safe operations
 */

import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Atomic file write: write to temp file in same directory, then rename
 * Prevents corruption if write fails mid-way
 * Temp file is in same directory to avoid EXDEV errors on cross-filesystem renames
 *
 * @param filePath - Target file path
 * @param content - Content to write
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const targetDir = dirname(filePath);

  // Ensure directory exists
  await mkdir(targetDir, { recursive: true });

  // Write to temp file in SAME directory as target (avoids EXDEV cross-filesystem errors)
  const tempPath = join(targetDir, `.engrain-tmp-${Date.now()}.tmp`);

  try {
    await writeFile(tempPath, content, 'utf-8');

    // Rename to target (atomic on most filesystems)
    await rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}
