/**
 * File discovery with negative filtering
 * Excludes images, videos, binaries, archives - not whitelist extensions
 * Based on PLAN.md Decision 6 (negative filtering)
 */

import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FileEntry } from "../types";

// Negative filtering: Exclude known non-documentation files
const EXCLUDED_EXTENSIONS = [
  // Images
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
  ".ico",
  ".webp",
  ".bmp",
  ".tiff",
  // Videos
  ".mp4",
  ".mov",
  ".avi",
  ".webm",
  ".mkv",
  ".flv",
  // Archives
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".bz2",
  // Binaries
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  // Fonts
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
];

const EXCLUDED_DIRS = [
  ".git",
  "node_modules",
  "__pycache__",
  ".DS_Store",
  "dist",
  "build",
  "coverage",
  ".next",
  ".cache",
];

/**
 * Check if a file should be excluded based on extension
 */
function shouldExcludeFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return EXCLUDED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Check if a directory should be excluded
 */
function shouldExcludeDir(dirName: string): boolean {
  return EXCLUDED_DIRS.includes(dirName);
}

/**
 * Recursively discover all documentation files in a directory
 * Uses negative filtering - includes everything except known non-docs
 *
 * @param rootPath - Root directory to scan
 * @returns Array of file entries with absolute and relative paths
 *
 * @example
 * const files = await discoverFiles("./.engrain/next-js");
 * // [
 * //   { path: "/abs/path/to/file.md", relativePath: "getting-started/intro.md" },
 * //   ...
 * // ]
 */
export async function discoverFiles(rootPath: string): Promise<FileEntry[]> {
  const results: FileEntry[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (shouldExcludeDir(entry.name)) {
          continue;
        }
        // Recursively walk subdirectories
        await walk(fullPath);
      } else if (entry.isFile()) {
        // Skip excluded file extensions
        if (shouldExcludeFile(entry.name)) {
          continue;
        }
        // Include this file
        const relativePath = relative(rootPath, fullPath);
        results.push({
          path: fullPath,
          relativePath,
        });
      }
      // Ignore symlinks (don't follow them)
    }
  }

  await walk(rootPath);
  return results;
}

/**
 * Get file count for a directory (used for reporting)
 *
 * @param rootPath - Root directory to count
 * @returns Number of files discovered
 */
export async function countFiles(rootPath: string): Promise<number> {
  const files = await discoverFiles(rootPath);
  return files.length;
}
