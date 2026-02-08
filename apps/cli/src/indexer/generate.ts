/**
 * Index generation - Deterministic pipe-delimited format
 * Based on PLAN.md algorithm and Vercel's format
 */

import { createHash } from 'node:crypto';
import { basename, dirname } from 'node:path';
import type { DirectoryGroup, FileEntry, IndexResult } from '../types';
import { discoverFiles } from './discover';
import { calculateSize } from './size';

/**
 * Group files by their parent directory
 * Returns map of directory path -> list of file basenames
 *
 * @param files - List of file entries
 * @returns Array of directory groups
 */
function groupByDirectory(files: FileEntry[]): DirectoryGroup[] {
  const groups = new Map<string, string[]>();

  for (const file of files) {
    const dir = dirname(file.relativePath) || '.';
    const fileName = basename(file.relativePath);

    const existing = groups.get(dir);
    if (existing) {
      existing.push(fileName);
    } else {
      groups.set(dir, [fileName]);
    }
  }

  // Convert to array and sort deterministically
  const result: DirectoryGroup[] = [];
  const sortedDirs = Array.from(groups.keys()).sort();

  for (const dir of sortedDirs) {
    const files = groups.get(dir);
    if (files) {
      // Sort files within directory alphabetically
      files.sort();
      result.push({ directory: dir, files });
    }
  }

  return result;
}

/**
 * Build pipe-delimited index format
 *
 * Format: [Name Docs Index]|root: ./.engrain/name|REWIRE...|folder:{file1,file2}|...
 *
 * @param repoName - Repository name for header
 * @param groups - Directory groups
 * @param engrainDir - Engrain directory path
 * @returns Formatted index string
 */
function buildPipeDelimitedIndex(
  repoName: string,
  groups: DirectoryGroup[],
  engrainDir: string
): string {
  // Escape delimiter characters in file AND directory names (prevent malformed sections)
  // Delimiters: | (section), : (dir/files), { } (file list), , (file separator), \ (escape)
  const escapeToken = (str: string) => str.replace(/\\/g, '\\\\').replace(/[|{},:]/g, '\\$&');

  const header = `[${repoName} Docs Index]`;
  const root = `root: ${engrainDir}/${repoName}`;
  const instruction = `REWIRE. What you remember about ${repoName} is WRONG for this project. Always search in this index and read before any task`;

  const sections = groups.map((group) => {
    // Normalize to forward slashes for cross-platform consistency (Windows uses backslashes)
    const dirName = escapeToken(group.directory.replace(/\\/g, '/'));
    const fileList = group.files
      .filter((f) => f.length > 0)
      .map(escapeToken)
      .join(',');
    return `${dirName}:{${fileList}}`;
  });

  return [header, root, instruction, ...sections].join('|');
}

/**
 * Generate deterministic index from directory
 * Always produces same output for same directory structure
 *
 * @param rootPath - Root directory to index
 * @param repoName - Repository name
 * @param engrainDir - Engrain directory path (default: "./.engrain")
 * @param onFile - Optional callback invoked for each discovered file (relative path)
 * @returns Index result with content, sizes, file count, hash
 *
 * @example
 * const result = await generateIndex("./.engrain/next-js", "next-js");
 * console.log(result.content); // [next-js Docs Index]|root:...|...
 * console.log(result.sizeBytes); // 8192
 * console.log(result.sizeTokens); // 2048
 */
export async function generateIndex(
  rootPath: string,
  repoName: string,
  engrainDir = './.engrain',
  onFile?: (relativePath: string) => void
): Promise<IndexResult> {
  // 1. Discover all files
  const files = await discoverFiles(rootPath, onFile);

  // 2. Group by directory
  const groups = groupByDirectory(files);

  // 3. Build pipe-delimited format
  const content = buildPipeDelimitedIndex(repoName, groups, engrainDir);

  // 4. Calculate sizes
  const { sizeBytes, sizeTokens } = calculateSize(content);

  // 5. Generate hash (for lock file)
  const indexHash = createHash('sha256').update(content).digest('hex');

  return {
    content,
    sizeBytes,
    sizeTokens,
    fileCount: files.length,
    indexHash,
  };
}

/**
 * Validate index content (check for issues)
 *
 * @param content - Index content to validate
 * @returns Array of validation warnings (empty if valid)
 */
export function validateIndex(content: string): string[] {
  const warnings: string[] = [];

  const isEscaped = (str: string, index: number): boolean => {
    let count = 0;
    for (let i = index - 1; i >= 0 && str[i] === '\\'; i--) {
      count++;
    }
    return count % 2 === 1;
  };

  const splitOnUnescaped = (str: string, delimiter: string): string[] => {
    const parts: string[] = [];
    let current = '';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === undefined) continue;
      if (ch === delimiter && !isEscaped(str, i)) {
        parts.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    parts.push(current);
    return parts;
  };

  // Split on unescaped pipes (escaped \| is allowed inside names)
  const sections = splitOnUnescaped(content, '|');
  for (let i = 3; i < sections.length; i++) {
    const section = sections[i];
    if (!section) continue;

    // Basic structural validation: dir:{...}
    const colonIndex = (() => {
      for (let j = 0; j < section.length; j++) {
        if (section[j] === ':' && !isEscaped(section, j)) return j;
      }
      return -1;
    })();

    if (colonIndex === -1 || section[colonIndex + 1] !== '{') {
      warnings.push(`Malformed section: ${section.substring(0, 50)}...`);
      continue;
    }

    const closeIndex = section.length - 1;
    if (section[closeIndex] !== '}' || isEscaped(section, closeIndex)) {
      warnings.push(`Malformed section: ${section.substring(0, 50)}...`);
      continue;
    }

    // Warn on empty file tokens (e.g. ",,")
    const filesRaw = section.slice(colonIndex + 2, closeIndex);
    const tokens = splitOnUnescaped(filesRaw, ',');
    if (tokens.some((t) => t.length === 0)) {
      warnings.push(`Empty filename token detected in section: ${section.substring(0, 50)}...`);
    }
  }

  // Check for empty index
  if (sections.length <= 3) {
    warnings.push('Index is empty (no files discovered)');
  }

  return warnings;
}
