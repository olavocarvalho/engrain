/**
 * Git operations - Clone, cleanup, commit hash capture
 * Based on REFERENCE_PATTERNS.md pattern #2
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, normalize, resolve, sep } from 'node:path';
import simpleGit from 'simple-git';
import { GitCloneError } from '../types';

const CLONE_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Clone a git repository with shallow clone (depth=1)
 * Includes timeout, cleanup on error, commit hash capture, and branch detection
 *
 * @param url - Git repository URL
 * @param ref - Branch or tag to checkout (optional, uses remote's default if not specified)
 * @returns Object with temp directory path, commit hash, and actual branch used
 *
 * @throws {GitCloneError} If clone fails, with structured error info
 *
 * @example
 * const { tempDir, commitHash, actualRef } = await cloneRepo("https://github.com/vercel/next.js.git", "canary");
 * // Use tempDir...
 * await cleanupTempDir(tempDir);
 */
export async function cloneRepo(
  url: string,
  ref?: string
): Promise<{ tempDir: string; commitHash: string; actualRef: string }> {
  const tempDir = await mkdtemp(join(tmpdir(), 'engrain-'));
  const git = simpleGit({ timeout: { block: CLONE_TIMEOUT_MS } });

  // Always use depth=1 for faster clones (10-50x speedup on large repos)
  const cloneOptions = ref ? ['--depth', '1', '--branch', ref] : ['--depth', '1'];

  try {
    await git.clone(url, tempDir, cloneOptions);

    // Capture commit hash and branch for staleness detection
    const repoGit = simpleGit(tempDir);
    const log = await repoGit.log({ maxCount: 1 });
    const commitHash = log.latest?.hash || 'unknown';

    // Detect which branch was actually cloned
    // When ref is specified, use it; otherwise detect the current branch
    let actualRef = ref;
    if (!actualRef) {
      try {
        actualRef = await repoGit.revparse(['--abbrev-ref', 'HEAD']);
      } catch {
        // Fallback: couldn't detect branch, leave undefined
        actualRef = undefined;
      }
    }

    return { tempDir, commitHash, actualRef: actualRef || 'HEAD' };
  } catch (error) {
    // CRITICAL: Clean up temp dir on failure (don't throw in catch)
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMessage.includes('block timeout') || errorMessage.includes('timed out');
    const isAuthError =
      errorMessage.includes('Authentication failed') ||
      errorMessage.includes('could not read Username') ||
      errorMessage.includes('Permission denied') ||
      errorMessage.includes('Repository not found');

    if (isTimeout) {
      throw new GitCloneError(
        `Clone timed out after 60s. This often happens with private repos that require authentication.\n` +
          `  Ensure you have access and your SSH keys or credentials are configured:\n` +
          `  - For SSH: ssh-add -l (to check loaded keys)\n` +
          `  - For HTTPS: gh auth status (if using GitHub CLI)`
      );
    }

    if (isAuthError) {
      throw new GitCloneError(
        `Authentication failed for ${url}.\n` +
          `  - For private repos, ensure you have access\n` +
          `  - For SSH: Check your keys with 'ssh -T git@github.com'\n` +
          `  - For HTTPS: Run 'gh auth login' or configure git credentials`
      );
    }

    throw new GitCloneError(`Failed to clone ${url}: ${errorMessage}`);
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
    throw new Error('Attempted to clean up directory outside of temp directory');
  }

  await rm(dir, { recursive: true, force: true });
}

// ── Remote ref resolution helpers ────────────────────────────────

interface RemoteRef {
  hash: string;
  refName: string;
}

const FETCH_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Parse `git ls-remote` output into structured ref entries
 * Format per line: "<hash>\t<refName>"
 */
function parseListRemoteOutput(output: string): RemoteRef[] {
  const results: RemoteRef[] = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const [hash, refName] = parts;
      if (hash && refName) {
        results.push({ hash, refName });
      }
    }
  }
  return results;
}

/**
 * Resolve HEAD to a concrete ref (branch name) via symref, or return the HEAD hash directly
 */
async function resolveHead(
  git: ReturnType<typeof simpleGit>,
  url: string
): Promise<{ hash: string } | { resolvedRef: string }> {
  const output = await git.listRemote(['--symref', url, 'HEAD']);
  const lines = output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Try to follow symref (e.g. "ref: refs/heads/main\tHEAD")
  const symrefLine = lines.find((l) => l.startsWith('ref:'));
  if (symrefLine) {
    const match = symrefLine.match(/ref:\s+(refs\/heads\/\S+)/);
    if (match?.[1]) {
      return { resolvedRef: match[1] };
    }
  }

  // Fallback: return HEAD hash directly
  const headRef = parseListRemoteOutput(output).find((r) => r.refName === 'HEAD');
  if (headRef) {
    return { hash: headRef.hash };
  }

  throw new Error('Could not determine default branch');
}

/**
 * Resolve a named ref (branch name or tag) to its commit hash
 * Priority: branch → annotated tag (^{}) → lightweight tag → pattern match
 */
async function resolveNamedRef(
  git: ReturnType<typeof simpleGit>,
  url: string,
  ref: string
): Promise<string> {
  const headRef = ref.startsWith('refs/heads/') ? ref : `refs/heads/${ref}`;
  const tagRef = ref.startsWith('refs/tags/') ? ref : `refs/tags/${ref}`;
  const tagRefDeref = `${tagRef}^{}`;

  // 1) Prefer branches
  const headsOutput = await git.listRemote(['--heads', url, headRef]);
  const headExact = parseListRemoteOutput(headsOutput).find((h) => h.refName === headRef);
  if (headExact) return headExact.hash;

  // 2) Tags (supports annotated tags via ^{})
  const tagsOutput = await git.listRemote(['--tags', url, tagRef, tagRefDeref]);
  const tags = parseListRemoteOutput(tagsOutput);
  const tagDeref = tags.find((t) => t.refName === tagRefDeref);
  if (tagDeref) return tagDeref.hash;
  const tagExact = tags.find((t) => t.refName === tagRef);
  if (tagExact) return tagExact.hash;

  // 3) Last resort: let git resolve patterns (may return multiple)
  const anyOutput = await git.listRemote([url, ref]);
  const first = parseListRemoteOutput(anyOutput)[0];
  if (first) return first.hash;

  throw new Error('Ref not found in remote');
}

/**
 * Fetch latest commit hash from remote repository
 * Used by check command for staleness detection
 *
 * @param url - Git repository URL
 * @param ref - Branch or tag to check (if undefined, uses remote's default branch)
 * @returns Latest commit hash
 *
 * @example
 * const latestHash = await fetchLatestCommitHash("https://github.com/vercel/next.js.git", "canary");
 */
export async function fetchLatestCommitHash(url: string, ref?: string): Promise<string> {
  const git = simpleGit({ timeout: { block: FETCH_TIMEOUT_MS } });

  try {
    // Resolve HEAD to a concrete ref when none specified
    let resolvedRef = ref;
    if (!resolvedRef || resolvedRef === 'HEAD') {
      const result = await resolveHead(git, url);
      if ('hash' in result) return result.hash;
      resolvedRef = result.resolvedRef;
    }

    return await resolveNamedRef(git, url, resolvedRef);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch latest commit hash: ${message}`);
  }
}
