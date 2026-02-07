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
import { cleanupTempDir, cloneRepo } from "../utils/git";
import { isPathSafe, sanitizeName } from "../utils/sanitize";
import { extractRepoName, parseSource } from "../utils/source-parser";

async function detectDocsRoot(repoRoot: string): Promise<string | null> {
  // Prefer canonical folder names, but match case-insensitively.
  const candidates = ["docs", "doc", "documentation"];
  const entries = await readdir(repoRoot, { withFileTypes: true }).catch(() => []);

  for (const candidate of candidates) {
    const match = entries.find(
      (e) => e.isDirectory() && e.name.toLowerCase() === candidate.toLowerCase()
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

  console.log(c.bold("\n✶ engrain docs\n"));

  // Step 1: Parse source URL
  console.log(`${c.dim("→")} Parsing source...`);
  const parsed = parseSource(repoUrl);
  const repoName = options.name ? sanitizeName(options.name) : sanitizeName(extractRepoName(parsed));

  console.log(
    `  ${c.cyan("Source:")} ${parsed.type} ${c.dim(`(${parsed.url.substring(0, 50)}...)`)}`
  );
  console.log(`  ${c.cyan("Repo:")} ${repoName}`);
  if (parsed.ref) {
    console.log(`  ${c.cyan("Ref:")} ${parsed.ref}`);
  }
  if (parsed.subpath) {
    console.log(`  ${c.cyan("Subpath:")} ${parsed.subpath}`);
  }

  // Step 2: Handle local path (skip cloning)
  let docsPath: string;
  let commitHash: string;
  let actualRef: string | undefined;
  let tempDir: string | null = null;
  let selectedSubpath: string | undefined;

  if (parsed.type === "local") {
    console.log(`\n${c.dim("→")} Using local path...`);
    docsPath = parsed.localPath ?? parsed.url;
    commitHash = "local";
    actualRef = undefined;
    selectedSubpath = undefined;
  } else {
    // Step 3: Clone repository (shallow, with timeout)
    console.log(`\n${c.dim("→")} Cloning repository (shallow clone)...`);
    try {
      const cloneResult = await cloneRepo(parsed.url, parsed.ref || options.ref);
      tempDir = cloneResult.tempDir;
      commitHash = cloneResult.commitHash;
      actualRef = cloneResult.actualRef;
      console.log(`  ${c.green("✓")} Cloned (commit: ${commitHash.substring(0, 7)})`);
      if (actualRef && actualRef !== "HEAD") {
        console.log(`  ${c.cyan("Branch:")} ${actualRef}`);
      }

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
      console.error(`\n${c.red("✗ Clone failed")}`);
      console.error(c.dim(message));
      throw new CommandError(message);
    }

    // Step 4: Move to ./.engrain/<repo-name>
    console.log(`\n${c.dim("→")} Moving docs to project...`);
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
          console.log(`  ${c.cyan("Profile:")} docs (${c.dim(`auto: ${docsRoot}/ + README*`)})`);

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
          console.log(`  ${c.cyan("Profile:")} docs (${c.yellow("no docs/ found; falling back to repo")})`);
          // Copy full repository as fallback
          await cp(docsPath, targetPath, { recursive: true });
          docsPath = targetPath;
        }
      } else {
        if (options.profile === "repo" && !parsed.subpath) {
          console.log(`  ${c.cyan("Profile:")} repo (full repository)`);
        }
        // Copy selected docsPath to target (cross-device compatible)
        await cp(docsPath, targetPath, { recursive: true });
        docsPath = targetPath;
      }

      console.log(`  ${c.green("✓")} Moved to ${c.cyan(`./${options.engrainDir}/${repoName}`)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n${c.red("✗ Move failed")}`);
      console.error(c.dim(message));

      // Cleanup temp dir before exit
      if (tempDir) {
        await cleanupTempDir(tempDir).catch(() => {});
      }
      throw new CommandError(message);
    } finally {
      // Clean up temp directory
      if (tempDir) {
        await cleanupTempDir(tempDir).catch(() => {});
      }
    }
  }

  // Step 5: Generate index
  console.log(`\n${c.dim("→")} Generating index...`);
  let indexResult: Awaited<ReturnType<typeof generateIndex>>;
  try {
    indexResult = await generateIndex(docsPath, repoName, `./${options.engrainDir}`);
    console.log(`  ${c.green("✓")} Indexed ${c.cyan(indexResult.fileCount.toString())} files`);
    console.log(`  ${c.dim("Size:")} ${formatSize(indexResult.sizeBytes, indexResult.sizeTokens)}`);

    // Validate index and surface warnings
    const warnings = validateIndex(indexResult.content);
    if (warnings.length > 0) {
      console.log(`  ${c.yellow("⚠ Warnings")}:`);
      for (const warning of warnings) {
        console.log(`    ${c.dim("•")} ${warning}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n${c.red("✗ Index generation failed")}`);
    console.error(c.dim(message));
    throw new CommandError(message);
  }

  // Step 6: Inject into AGENTS.md (or dry run)
  if (options.dryRun) {
    console.log(`\n${c.yellow("⚠ Dry run - skipping injection")}`);
    console.log(c.dim("\nIndex preview (first 200 chars):"));
    console.log(c.dim(indexResult.content.substring(0, 200) + "..."));
  } else {
    console.log(`\n${c.dim("→")} Injecting into ${options.output}...`);
    try {
      const injectionResult = await injectIndex(
        options.output,
        repoName,
        indexResult.content,
        options.force
      );

      if (injectionResult.existed) {
        console.log(`  ${c.green("✓")} Updated existing block`);
      } else {
        console.log(`  ${c.green("✓")} Added new block`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n${c.red("✗ Injection failed")}`);
      console.error(c.dim(message));
      throw new CommandError(message);
    }

    // Step 7: Update lock file
    console.log(`\n${c.dim("→")} Updating lock file...`);
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
      console.log(`  ${c.green("✓")} Lock file updated`);
    } catch (error) {
      // Non-fatal: don't exit if lock file fails
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  ${c.yellow("⚠")} Lock file update failed: ${message}`);
    }
  }

  // Success summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(c.bold(`\n${c.green("✓ Done")} in ${elapsed}s\n`));
}
