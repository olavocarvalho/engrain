/**
 * Index generation - Deterministic pipe-delimited format
 * Based on PLAN.md algorithm and Vercel's format
 */

import { createHash } from "node:crypto";
import { basename, dirname } from "node:path";
import type { DirectoryGroup, FileEntry, IndexResult } from "../types";
import { discoverFiles } from "./discover";
import { calculateSize } from "./size";

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
    const dir = dirname(file.relativePath) || ".";
    const fileName = basename(file.relativePath);

    if (!groups.has(dir)) {
      groups.set(dir, []);
    }
    const filesArray = groups.get(dir);
    if (filesArray) {
      filesArray.push(fileName);
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
  // Escape pipe characters in file AND directory names (prevent malformed sections)
  const escapePipes = (str: string) => str.replace(/\|/g, "\\|");

  const header = `[${repoName} Docs Index]`;
  const root = `root: ${engrainDir}/${repoName}`;
  const instruction = `REWIRE. What you remember about ${repoName} is WRONG for this project. Always search in this index and read before any task`;

  const sections = groups.map((group) => {
    // Normalize to forward slashes for cross-platform consistency (Windows uses backslashes)
    const dirName = escapePipes(group.directory.replace(/\\/g, "/"));
    const fileList = group.files.map(escapePipes).join(",");
    return `${dirName}:{${fileList}}`;
  });

  return [header, root, instruction, ...sections].join("|");
}

/**
 * Generate deterministic index from directory
 * Always produces same output for same directory structure
 *
 * @param rootPath - Root directory to index
 * @param repoName - Repository name
 * @param engrainDir - Engrain directory path (default: "./.engrain")
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
  engrainDir = "./.engrain"
): Promise<IndexResult> {
  // 1. Discover all files
  const files = await discoverFiles(rootPath);

  // 2. Group by directory
  const groups = groupByDirectory(files);

  // 3. Build pipe-delimited format
  const content = buildPipeDelimitedIndex(repoName, groups, engrainDir);

  // 4. Calculate sizes
  const { sizeBytes, sizeTokens } = await calculateSize(content);

  // 5. Generate hash (for lock file)
  const indexHash = createHash("sha256").update(content).digest("hex");

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

  // Check for unescaped pipes in file names
  const sections = content.split("|");
  for (let i = 3; i < sections.length; i++) {
    const section = sections[i];
    // Check if section matches expected format: folder:{file1,file2}
    if (section && !section.match(/^[^:]+:\{[^}]*\}$/)) {
      warnings.push(`Malformed section: ${section.substring(0, 50)}...`);
    }
  }

  // Check for empty index
  if (sections.length <= 3) {
    warnings.push("Index is empty (no files discovered)");
  }

  return warnings;
}
