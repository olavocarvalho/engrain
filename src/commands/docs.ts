/**
 * Docs command - Clone, index, and inject documentation
 * Main orchestrator connecting all modules
 */

import { access, cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { generateIndex, validateIndex } from "../indexer/generate";
import { formatSize } from "../indexer/size";
import { injectIndex } from "../injector/inject";
import { addDocsToLock } from "../injector/lock";
import type { DocsCommandOptions } from "../types";
import { CommandError } from "../types";
import { c } from "../ui/colors";
import { log } from "../ui/log";
import { cleanupTempDir, cloneRepo } from "../utils/git";
import { isPathSafe, sanitizeName } from "../utils/sanitize";
import { extractRepoName, parseSource } from "../utils/source-parser";

async function detectDocsRoot(repoRoot: string): Promise<string | null> {
  // Prefer canonical folder names, but match case-insensitively.
  const candidates = ["docs", "doc", "documentation"];
  const entries = await readdir(repoRoot, { withFileTypes: true }).catch(() => []);

  for (const candidate of candidates) {
    const match = entries.find(
      (e) => e.isDirectory() && e.name.toLowerCase() === candidate
    );
    if (match) {
      return match.name;
    }
  }

  // Fallback: check directly (covers cases where readdir fails but stat works)
  for (const candidate of candidates) {
    const fullPath = join(repoRoot, candidate);
    const st = await stat(fullPath).catch(() => null);
    if (st?.isDirectory()) {
      return candidate;
    }
  }

  return null;
}

async function listRootReadmes(repoRoot: string): Promise<string[]> {
  const entries = await readdir(repoRoot, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().startsWith("readme"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Run docs command
 * Complete workflow: parse URL → clone → move → index → inject → lock → cleanup
 *
 * @param repoUrl - Repository URL or local path
 * @param options - Command options
 */
export async function runDocsCommand(repoUrl: string, options: DocsCommandOptions): Promise<void> {
  const startTime = Date.now();

  log.header("engrain docs");

  // ── Parse source ──────────────────────────────────────────────
  const parsed = parseSource(repoUrl);
  const repoName = options.name ? sanitizeName(options.name) : sanitizeName(extractRepoName(parsed));

  log.source(repoName);
  const sourceDetails: string[] = [parsed.type];
  if (parsed.ref) sourceDetails.push(parsed.ref);
  if (parsed.subpath) sourceDetails.push(parsed.subpath);
  log.detail(sourceDetails.join(" · "));
  log.gap();

  // ── State ─────────────────────────────────────────────────────
  let docsPath: string;
  let commitHash: string;
  let actualRef: string | undefined;
  let tempDir: string | null = null;
  let selectedSubpath: string | undefined;
  let profileInfo: string | undefined;

  if (parsed.type === "local") {
    // ── Local path (skip cloning) ───────────────────────────────
    docsPath = parsed.localPath ?? parsed.url;
    commitHash = "local";
    actualRef = undefined;
    selectedSubpath = undefined;
  } else {
    // ── Clone repository (shallow, with timeout) ────────────────
    log.detail("cloning...");
    try {
      const cloneResult = await cloneRepo(parsed.url, parsed.ref || options.ref);
      tempDir = cloneResult.tempDir;
      commitHash = cloneResult.commitHash;
      actualRef = cloneResult.actualRef;

      const cloneParts: string[] = [];
      if (actualRef && actualRef !== "HEAD") cloneParts.push(actualRef);
      cloneParts.push(commitHash.substring(0, 7));
      log.step("cloned", cloneParts.join(" · "));
      log.gap();

      // Extract subpath if specified
      docsPath = parsed.subpath ? join(tempDir, parsed.subpath) : tempDir;
      selectedSubpath = parsed.subpath;

      // Validate subpath exists and is contained within cloned repo
      if (parsed.subpath) {
        // Check containment (security: prevent path traversal)
        if (!isPathSafe(tempDir, docsPath)) {
          throw new Error(
            `Subpath "${parsed.subpath}" escapes repository directory (potential path traversal)`
          );
        }

        // Check existence
        try {
          await access(docsPath);
        } catch {
          throw new Error(
            `Subpath "${parsed.subpath}" does not exist in repository.\n` +
              `  Check that the path is correct and exists in the ${parsed.ref || options.ref} branch.`
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("clone failed");
      log.hint(message);
      log.gap();
      throw new CommandError(message);
    }

    // ── Move docs to project ────────────────────────────────────
    const engrainBase = resolve(options.engrainDir);
    const targetPath = resolve(join(options.engrainDir, repoName));

    try {
      // Validate target path is within engrain directory (security)
      if (!isPathSafe(engrainBase, targetPath)) {
        throw new Error(
          `Target path "${targetPath}" escapes engrain directory (potential path traversal from repo name)`
        );
      }

      // Ensure engrain directory exists
      await mkdir(options.engrainDir, { recursive: true });

      // Remove existing directory if present
      await rm(targetPath, { recursive: true, force: true }).catch(() => {});

      const shouldAutoPickDocsRoot = options.profile === "docs" && !parsed.subpath;
      if (shouldAutoPickDocsRoot) {
        const repoRoot = tempDir ?? docsPath;
        const docsRoot = await detectDocsRoot(repoRoot);
        if (docsRoot) {
          selectedSubpath = docsRoot;
          profileInfo = `${docsRoot}/ + README*`;

          await mkdir(targetPath, { recursive: true });

          // Copy docs root folder into target (preserve folder name to avoid collisions)
          await cp(join(repoRoot, docsRoot), join(targetPath, docsRoot), { recursive: true });

          // Copy root README* files alongside docs/ (keeps top-level entry point)
          const readmes = await listRootReadmes(repoRoot);
          for (const readme of readmes) {
            const dest = join(targetPath, readme);
            const exists = await access(dest)
              .then(() => true)
              .catch(() => false);
            if (!exists) {
              await cp(join(repoRoot, readme), dest);
            }
          }

          docsPath = targetPath;
        } else {
          log.warn("no docs/ found, using full repository");
          // Copy full repository as fallback
          await cp(docsPath, targetPath, { recursive: true });
          docsPath = targetPath;
        }
      } else {
        if (options.profile === "repo" && !parsed.subpath) {
          profileInfo = "full repository";
        }
        // Copy selected docsPath to target (cross-device compatible)
        await cp(docsPath, targetPath, { recursive: true });
        docsPath = targetPath;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("move failed");
      log.hint(message);
      log.gap();
      throw new CommandError(message);
    } finally {
      // Clean up temp directory (runs on both success and error)
      if (tempDir) {
        await cleanupTempDir(tempDir).catch(() => {});
      }
    }
  }

  // ── Generate index ────────────────────────────────────────────
  let indexResult: Awaited<ReturnType<typeof generateIndex>>;
  try {
    indexResult = await generateIndex(docsPath, repoName, `./${options.engrainDir}`);

    log.step("indexed", `${indexResult.fileCount} files`);

    // Show destination with optional profile hint
    const destPath = `./${options.engrainDir}/${repoName}`;
    log.stepInfo(profileInfo ? `${destPath} (${profileInfo})` : destPath);
    log.stepInfo(formatSize(indexResult.sizeBytes, indexResult.sizeTokens));

    // Validate index and surface warnings
    const warnings = validateIndex(indexResult.content);
    for (const warning of warnings) {
      log.warn(warning);
    }
    log.gap();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("index failed");
    log.hint(message);
    log.gap();
    throw new CommandError(message);
  }

  // ── Inject or dry run ─────────────────────────────────────────
  if (options.dryRun) {
    log.warn("dry run — skipping injection");
    log.hint("preview: " + indexResult.content.substring(0, 200) + "...");
    log.gap();
  } else {
    try {
      const injectionResult = await injectIndex(
        options.output,
        repoName,
        indexResult.content,
        options.force
      );

      log.step(
        injectionResult.existed ? "updated" : "engrained",
        options.output
      );
      log.gap();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("injection failed");
      log.hint(message);
      log.gap();
      throw new CommandError(message);
    }

    // ── Lock file (silent unless error) ─────────────────────────
    try {
      await addDocsToLock(process.cwd(), repoName, {
        source: repoUrl,
        sourceUrl: parsed.url,
        sourceType: parsed.type,
        ref: actualRef,
        subpath: parsed.subpath ?? selectedSubpath,
        commitHash,
        indexHash: indexResult.indexHash,
        indexSizeBytes: indexResult.sizeBytes,
        indexSizeTokens: indexResult.sizeTokens,
      });
    } catch (error) {
      // Non-fatal: don't exit if lock file fails
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`lock file update failed: ${message}`);
    }
  }

  // ── Done ──────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log.footer(`${c.green("done")} in ${elapsed}s`);
}
