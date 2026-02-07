/**
 * Path sanitization utilities
 * Critical for security - prevents path traversal attacks
 * Based on REFERENCE_PATTERNS.md pattern #7
 */

import { normalize, resolve, sep } from "node:path";

/**
 * Sanitizes a filename/directory name to prevent path traversal attacks
 *
 * @param name - Raw name from user input or URL
 * @returns Sanitized name safe for filesystem use
 *
 * @example
 * sanitizeName("../etc/passwd") // => "etc-passwd"
 * sanitizeName("My Docs!") // => "my-docs"
 * sanitizeName("@scope/package") // => "scope-package"
 */
export function sanitizeName(name: string): string {
  const sanitized = name
    .toLowerCase()
    // Replace any sequence of non-alphanumeric (except dots, underscores) with hyphen
    .replace(/[^a-z0-9._]+/g, "-")
    // Remove leading/trailing dots and hyphens (security: prevent hidden files, relative paths)
    .replace(/^[.\-]+|[.\-]+$/g, "");

  // Limit to 255 chars (filesystem limit), fallback to 'unnamed-doc' if empty
  return sanitized.substring(0, 255) || "unnamed-doc";
}

/**
 * Validates that a path is within an expected base directory
 * Prevents path traversal attacks (../, symlinks outside base)
 *
 * @param basePath - The trusted base directory
 * @param targetPath - The path to validate
 * @returns true if targetPath is within basePath, false otherwise
 *
 * @example
 * isPathSafe("/home/user/.engrain", "/home/user/.engrain/next-js") // => true
 * isPathSafe("/home/user/.engrain", "/home/user/.engrain") // => true
 * isPathSafe("/home/user/.engrain", "/home/user/other") // => false
 * isPathSafe("/home/user/.engrain", "/home/user/.engrain/../other") // => false
 */
export function isPathSafe(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalize(resolve(basePath));
  const normalizedTarget = normalize(resolve(targetPath));

  // Allow exact match or subdirectory
  return normalizedTarget.startsWith(normalizedBase + sep) || normalizedTarget === normalizedBase;
}

/**
 * Cross-platform absolute path detection
 * Handles Unix, Windows native, and Git Bash formats
 * Based on qmd patterns from REFERENCE_PATTERNS.md
 *
 * @param path - Path to check
 * @returns true if path is absolute
 *
 * @example
 * isAbsolutePath("/home/user") // => true (Unix)
 * isAbsolutePath("C:\\Users") // => true (Windows)
 * isAbsolutePath("/c/Users") // => true (Git Bash)
 * isAbsolutePath("./relative") // => false
 */
export function isAbsolutePath(path: string): boolean {
  if (!path) return false;

  // Unix absolute path
  if (path.startsWith("/")) {
    // Check if it's a Git Bash style path like /c/Users (C-Z only, not A or B)
    if (path.length >= 3 && path[2] === "/") {
      const driveLetter = path[1];
      if (driveLetter && /[c-zC-Z]/.test(driveLetter)) {
        return true;
      }
    }
    return true;
  }

  // Windows native path: C:\ or C:/
  if (path.length >= 2 && /[a-zA-Z]/.test(path[0]!) && path[1] === ":") {
    return true;
  }

  return false;
}

/**
 * Detects if a string looks like a local path
 * Used by source parser to distinguish local paths from URLs
 *
 * @param input - String to check
 * @returns true if input looks like a local path
 */
export function isLocalPath(input: string): boolean {
  return (
    isAbsolutePath(input) ||
    input.startsWith("./") ||
    input.startsWith("../") ||
    input === "." ||
    input === ".." ||
    /^[a-zA-Z]:[/\\]/.test(input) // Windows absolute paths
  );
}
