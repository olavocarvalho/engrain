/**
 * Git operations - Clone, cleanup, commit hash capture
 * Based on REFERENCE_PATTERNS.md pattern #2
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, normalize, resolve, sep } from "node:path";
import simpleGit from "simple-git";
import { GitCloneError } from "../types";

const CLONE_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Clone a git repository with shallow clone (depth=1)
 * Includes timeout, cleanup on error, and commit hash capture
 *
 * @param url - Git repository URL
 * @param ref - Branch or tag to checkout (optional)
 * @returns Object with temp directory path and commit hash
 *
 * @throws {GitCloneError} If clone fails, with structured error info
 *
 * @example
 * const { tempDir, commitHash } = await cloneRepo("https://github.com/vercel/next.js.git", "canary");
 * // Use tempDir...
 * await cleanupTempDir(tempDir);
 */
export async function cloneRepo(
  url: string,
  ref?: string
): Promise<{ tempDir: string; commitHash: string }> {
  const tempDir = await mkdtemp(join(tmpdir(), "engrain-"));
  const git = simpleGit({ timeout: { block: CLONE_TIMEOUT_MS } });

  // Always use depth=1 for faster clones (10-50x speedup on large repos)
  const cloneOptions = ref ? ["--depth", "1", "--branch", ref] : ["--depth", "1"];

  try {
    await git.clone(url, tempDir, cloneOptions);

    // Capture commit hash for staleness detection
    const repoGit = simpleGit(tempDir);
    const log = await repoGit.log({ maxCount: 1 });
    const commitHash = log.latest?.hash || "unknown";

    return { tempDir, commitHash };
  } catch (error) {
    // CRITICAL: Clean up temp dir on failure (don't throw in catch)
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMessage.includes("block timeout") || errorMessage.includes("timed out");
    const isAuthError =
      errorMessage.includes("Authentication failed") ||
      errorMessage.includes("could not read Username") ||
      errorMessage.includes("Permission denied") ||
      errorMessage.includes("Repository not found");

    if (isTimeout) {
      throw new GitCloneError(
        `Clone timed out after 60s. This often happens with private repos that require authentication.\n` +
          `  Ensure you have access and your SSH keys or credentials are configured:\n` +
          `  - For SSH: ssh-add -l (to check loaded keys)\n` +
          `  - For HTTPS: gh auth status (if using GitHub CLI)`,
        url,
        true,
        false
      );
    }

    if (isAuthError) {
      throw new GitCloneError(
        `Authentication failed for ${url}.\n` +
          `  - For private repos, ensure you have access\n` +
          `  - For SSH: Check your keys with 'ssh -T git@github.com'\n` +
          `  - For HTTPS: Run 'gh auth login' or configure git credentials`,
        url,
        false,
        true
      );
    }

    throw new GitCloneError(`Failed to clone ${url}: ${errorMessage}`, url, false, false);
  }
}

/**
 * Clean up temporary directory with security validation
 * Only allows deletion within tmpdir to prevent accidents
 *
 * @param dir - Directory to delete
 *
 * @throws {Error} If dir is outside tmpdir
 *
 * @example
 * await cleanupTempDir(tempDir);
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  // SECURITY: Validate path is within tmpdir to prevent deletion of arbitrary paths
  const normalizedDir = normalize(resolve(dir));
  const normalizedTmpDir = normalize(resolve(tmpdir()));

  if (!normalizedDir.startsWith(normalizedTmpDir + sep) && normalizedDir !== normalizedTmpDir) {
    throw new Error("Attempted to clean up directory outside of temp directory");
  }

  await rm(dir, { recursive: true, force: true });
}

/**
 * Fetch latest commit hash from remote repository
 * Used by check command for staleness detection
 *
 * @param url - Git repository URL
 * @param ref - Branch or tag to check (default: main)
 * @returns Latest commit hash
 *
 * @example
 * const latestHash = await fetchLatestCommitHash("https://github.com/vercel/next.js.git", "canary");
 */
export async function fetchLatestCommitHash(url: string, ref = "main"): Promise<string> {
  const git = simpleGit({ timeout: { block: 10000 } });

  try {
    const parseListRemoteOutput = (output: string): Array<{ hash: string; refName: string }> => {
      const lines = output
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const parsed: Array<{ hash: string; refName: string }> = [];
      for (const line of lines) {
        // Format: "<hash>\t<ref>"
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const [hash, refName] = parts;
          if (hash && refName) {
            parsed.push({ hash, refName });
          }
        }
      }
      return parsed;
    };

    const headRef = ref.startsWith("refs/heads/") ? ref : `refs/heads/${ref}`;
    const tagRef = ref.startsWith("refs/tags/") ? ref : `refs/tags/${ref}`;
    const tagRefDeref = `${tagRef}^{}`

    // 1) Prefer branches (heads)
    const headsOutput = await git.listRemote(["--heads", url, headRef]);
    const heads = parseListRemoteOutput(headsOutput);
    const headExact = heads.find((h) => h.refName === headRef);
    if (headExact) {
      return headExact.hash;
    }

    // 2) Fallback to tags (supports annotated tags via ^{})
    const tagsOutput = await git.listRemote(["--tags", url, tagRef, tagRefDeref]);
    const tags = parseListRemoteOutput(tagsOutput);
    const tagDeref = tags.find((t) => t.refName === tagRefDeref);
    if (tagDeref) {
      return tagDeref.hash;
    }
    const tagExact = tags.find((t) => t.refName === tagRef);
    if (tagExact) {
      return tagExact.hash;
    }

    // 3) Last resort: allow git to resolve patterns (may return multiple)
    const anyOutput = await git.listRemote([url, ref]);
    const any = parseListRemoteOutput(anyOutput);
    const first = any[0];
    if (first) {
      return first.hash;
    }

    throw new Error("Ref not found in remote");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch latest commit hash: ${message}`);
  }
}
