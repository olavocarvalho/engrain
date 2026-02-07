/**
 * Source parser - Parse GitHub/GitLab URLs and local paths
 * Based on REFERENCE_PATTERNS.md pattern #1
 */

import { resolve } from "node:path";
import type { ParsedSource } from "../types";
import { isLocalPath } from "./sanitize";

/**
 * Parse a repository URL or local path into structured components
 *
 * Supports:
 * - GitHub URLs with tree paths: https://github.com/owner/repo/tree/branch/path/to/docs
 * - GitHub shorthand: owner/repo
 * - GitLab URLs with subgroups: https://gitlab.com/group/subgroup/repo
 * - Raw Git URLs: https://github.com/owner/repo.git
 * - SSH URLs: git@github.com:owner/repo.git
 * - Local paths: ./docs, /absolute/path
 *
 * @param input - Repository URL or local path
 * @returns Parsed source with type, url, ref, subpath, etc.
 *
 * @example
 * parseSource("https://github.com/vercel/next.js/tree/canary/docs")
 * // => { type: "github", url: "https://github.com/vercel/next.js.git", ref: "canary", subpath: "docs", owner: "vercel", repo: "next.js" }
 *
 * parseSource("vercel/next.js")
 * // => { type: "github", url: "https://github.com/vercel/next.js.git", owner: "vercel", repo: "next.js" }
 */
export function parseSource(input: string): ParsedSource {
  // Strategy 1: Local path detection (absolute, relative, current directory)
  if (isLocalPath(input)) {
    const resolvedPath = resolve(input);
    return {
      type: "local",
      url: resolvedPath,
      localPath: resolvedPath,
    };
  }

  // Strategy 2: GitHub URL with path: https://github.com/owner/repo/tree/branch/path/to/docs
  const githubTreeWithPathMatch = input.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
  if (githubTreeWithPathMatch) {
    const [, owner, repo, ref, subpath] = githubTreeWithPathMatch;
    const cleanRepo = repo!.replace(/\.git$/, "");
    return {
      type: "github",
      url: `https://github.com/${owner}/${cleanRepo}.git`,
      ref,
      subpath,
      owner,
      repo: cleanRepo,
    };
  }

  // Strategy 3: GitHub URL without path: https://github.com/owner/repo or https://github.com/owner/repo.git
  const githubRepoMatch = input.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (githubRepoMatch) {
    const [, owner, repo] = githubRepoMatch;
    const cleanRepo = repo!.replace(/\.git$/, "");
    return {
      type: "github",
      url: `https://github.com/${owner}/${cleanRepo}.git`,
      owner,
      repo: cleanRepo,
    };
  }

  // Strategy 4: GitHub shorthand: owner/repo (no dots, no colons, no slashes beyond first)
  const shorthandMatch = input.match(/^([^/]+)\/([^/@]+)$/);
  if (shorthandMatch && !input.includes(":") && !input.startsWith(".")) {
    const [, owner, repo] = shorthandMatch;
    const cleanRepo = repo!.replace(/\.git$/, "");
    return {
      type: "github",
      url: `https://github.com/${owner}/${cleanRepo}.git`,
      owner,
      repo: cleanRepo,
    };
  }

  // Strategy 5: SSH format: git@github.com:owner/repo.git
  const sshMatch = input.match(/git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    const [, owner, repo] = sshMatch;
    const cleanRepo = repo!.replace(/\.git$/, "");
    return {
      type: "github",
      url: `git@github.com:${owner}/${cleanRepo}.git`,
      owner,
      repo: cleanRepo,
    };
  }

  // Strategy 6: GitLab URL with subgroups (supports nested groups)
  const gitlabRepoMatch = input.match(/gitlab\.com\/(.+?)(?:\.git)?\/?$/);
  if (gitlabRepoMatch) {
    const repoPath = gitlabRepoMatch[1]!;
    if (repoPath.includes("/")) {
      return {
        type: "gitlab",
        url: `https://gitlab.com/${repoPath}.git`,
      };
    }
  }

  // Fallback: Treat as direct git URL
  // Ensure it ends with .git for git clone compatibility
  const finalUrl = input.endsWith(".git") ? input : `${input}.git`;
  return {
    type: "git",
    url: finalUrl,
  };
}

/**
 * Extract repository name from parsed source
 * Used for generating doc IDs and directory names
 *
 * @param parsed - Parsed source
 * @returns Repository name (e.g., "next.js", "react")
 */
export function extractRepoName(parsed: ParsedSource): string {
  if (parsed.repo) {
    return parsed.repo;
  }

  // Extract from URL as fallback
  const match = parsed.url.match(/\/([^/]+?)(?:\.git)?$/);
  if (match && match[1]) {
    return match[1];
  }

  return "unnamed-repo";
}
