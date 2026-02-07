/**
 * Authentication utilities
 * Stateless GitHub token resolution - no credential storage
 * Based on REFERENCE_PATTERNS.md pattern #4
 */

import { execSync } from "node:child_process";

/**
 * Get GitHub token from environment or gh CLI
 * Priority order:
 * 1. GITHUB_TOKEN environment variable
 * 2. GH_TOKEN environment variable
 * 3. gh CLI auth token (if gh is installed)
 *
 * @returns GitHub token or null if not found
 *
 * @example
 * const token = getGitHubToken();
 * if (token) {
 *   headers["Authorization"] = `Bearer ${token}`;
 * }
 */
export function getGitHubToken(): string | null {
  // 1. GITHUB_TOKEN environment variable
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  // 2. GH_TOKEN environment variable
  if (process.env.GH_TOKEN) {
    return process.env.GH_TOKEN;
  }

  // 3. gh CLI auth token (if gh is installed)
  try {
    const token = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"], // Suppress output
    }).trim();
    if (token) {
      return token;
    }
  } catch {
    // gh not installed or not authenticated
  }

  return null;
}

/**
 * Create GitHub API headers with optional authentication
 *
 * @param includeAuth - Whether to include Authorization header (default: true)
 * @returns Headers object for fetch requests
 */
export function createGitHubHeaders(includeAuth = true): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "engrain-cli",
  };

  if (includeAuth) {
    const token = getGitHubToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return headers;
}
