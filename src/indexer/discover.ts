/**
 * File discovery with negative filtering
 * Excludes images, videos, binaries, archives - not whitelist extensions
 * Based on PLAN.md Decision 6 (negative filtering)
 */

import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FileEntry } from "../types";

// Negative filtering: Exclude known non-documentation files
const EXCLUDED_FILE_NAMES = new Set(
  [
    // OS / editor noise
    "thumbs.db",
    "desktop.ini",
    // Common repo meta (non-hidden)
    "codeowners",
    // Build tools (exclude noise, but keep conf.py for Sphinx metadata)
    "makefile",
    "gnumakefile",
    "make.bat",
    "build-docs.sh",
    "build-docs.bat",
    "setup-docs.sh",
    "setup-docs.bat",
    // Environment/dependency files (CI/build infrastructure, not docs)
    "env.yml",
    "environment.yml",
    "env.yaml",
    "environment.yaml",
    "requirements.txt", // Build dependencies (Python docs, like env.yml)
  ].map((name) => name.toLowerCase())
);

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
  // Design source files
  ".cdr",
  ".ai",
  ".psd",
  ".sketch",
  ".fig",
  ".xd",
  // Scripts/UI code (docs sites use JS for interactivity, not content)
  ".js",
  ".mjs",
  ".cjs",
  // Jupyter notebooks (contain base64-encoded images, 35-60% bloat, not readable by AI)
  ".ipynb",
  // IDE / project files
  ".sln",
  ".vcxproj",
  ".vcproj",
  ".csproj",
  ".fsproj",
  ".vbproj",
  ".njsproj",
  ".xcodeproj",
  ".xcworkspace",
  // Visual Studio sidecars
  ".filters",
  ".user",
];

const EXCLUDED_DIRS = [
  ".git",
  "node_modules",
  "__pycache__",
  "dist",
  "build",
  "coverage",
  ".next",
  ".cache",
  "notebooks", // Example notebooks (often have large outputs/images)
];

const EXCLUDED_DIR_SUFFIXES = [".xcodeproj", ".xcworkspace"];

/**
 * Check if a file should be excluded based on extension
 */
function shouldExcludeFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  // Exclude dotfiles by default (e.g. .gitignore, .editorconfig, .github workflows, etc.)
  if (lowerName.startsWith(".")) {
    return true;
  }

  if (EXCLUDED_FILE_NAMES.has(lowerName)) {
    return true;
  }

  // Exclude common repo meta files explicitly (even when not dotfiles)
  // Note: Keep this conservative to avoid excluding real docs content.
  if (lowerName.endsWith(".vcxproj.filters") || lowerName.endsWith(".vcxproj.user")) {
    return true;
  }

  return EXCLUDED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Check if a directory should be excluded
 */
function shouldExcludeDir(dirName: string): boolean {
  const lowerName = dirName.toLowerCase();

  // Exclude dot-directories by default (e.g. .git, .github, .ci, .vscode, etc.)
  if (lowerName.startsWith(".")) {
    return true;
  }

  if (EXCLUDED_DIRS.includes(dirName) || EXCLUDED_DIRS.includes(lowerName)) {
    return true;
  }

  return EXCLUDED_DIR_SUFFIXES.some((suffix) => lowerName.endsWith(suffix));
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
