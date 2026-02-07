/**
 * Docs command - Clone, index, and inject documentation
 * Main orchestrator connecting all modules
 */

import { access, cp, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import pc from "picocolors";
import { generateIndex, validateIndex } from "../indexer/generate";
import { formatSize } from "../indexer/size";
import { injectIndex } from "../injector/inject";
import { addDocsToLock } from "../injector/lock";
import type { DocsCommandOptions } from "../types";
import { CommandError } from "../types";
import { cleanupTempDir, cloneRepo } from "../utils/git";
import { isPathSafe, sanitizeName } from "../utils/sanitize";
import { extractRepoName, parseSource } from "../utils/source-parser";

/**
 * Run docs command
 * Complete workflow: parse URL → clone → move → index → inject → lock → cleanup
 *
 * @param repoUrl - Repository URL or local path
 * @param options - Command options
 */
export async function runDocsCommand(repoUrl: string, options: DocsCommandOptions): Promise<void> {
  const startTime = Date.now();

  console.log(pc.bold("\n🌱 engrain docs\n"));

  // Step 1: Parse source URL
  console.log(`${pc.dim("→")} Parsing source...`);
  const parsed = parseSource(repoUrl);
  const repoName = options.name ? sanitizeName(options.name) : sanitizeName(extractRepoName(parsed));

  console.log(
    `  ${pc.cyan("Source:")} ${parsed.type} ${pc.dim(`(${parsed.url.substring(0, 50)}...)`)}`
  );
  console.log(`  ${pc.cyan("Repo:")} ${repoName}`);
  if (parsed.ref) {
    console.log(`  ${pc.cyan("Ref:")} ${parsed.ref}`);
  }
  if (parsed.subpath) {
    console.log(`  ${pc.cyan("Subpath:")} ${parsed.subpath}`);
  }

  // Step 2: Handle local path (skip cloning)
  let docsPath: string;
  let commitHash: string;
  let tempDir: string | null = null;

  if (parsed.type === "local") {
    console.log(`\n${pc.dim("→")} Using local path...`);
    docsPath = parsed.localPath ?? parsed.url;
    commitHash = "local";
  } else {
    // Step 3: Clone repository (shallow, with timeout)
    console.log(`\n${pc.dim("→")} Cloning repository (shallow clone)...`);
    try {
      const cloneResult = await cloneRepo(parsed.url, parsed.ref || options.ref);
      tempDir = cloneResult.tempDir;
      commitHash = cloneResult.commitHash;
      console.log(`  ${pc.green("✓")} Cloned (commit: ${commitHash.substring(0, 7)})`);

      // Extract subpath if specified
      docsPath = parsed.subpath ? join(tempDir, parsed.subpath) : tempDir;

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
      console.error(`\n${pc.red("✗ Clone failed")}`);
      console.error(pc.dim(message));
      throw new CommandError(message);
    }

    // Step 4: Move to ./.engrain/<repo-name>
    console.log(`\n${pc.dim("→")} Moving docs to project...`);
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

      // Copy docs to target (cross-device compatible)
      await cp(docsPath, targetPath, { recursive: true });

      console.log(`  ${pc.green("✓")} Moved to ${pc.cyan(`./${options.engrainDir}/${repoName}`)}`);
      docsPath = targetPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n${pc.red("✗ Move failed")}`);
      console.error(pc.dim(message));

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
  console.log(`\n${pc.dim("→")} Generating index...`);
  let indexResult: Awaited<ReturnType<typeof generateIndex>>;
  try {
    indexResult = await generateIndex(docsPath, repoName, `./${options.engrainDir}`);
    console.log(`  ${pc.green("✓")} Indexed ${pc.cyan(indexResult.fileCount.toString())} files`);
    console.log(`  ${pc.dim("Size:")} ${formatSize(indexResult.sizeBytes, indexResult.sizeTokens)}`);

    // Validate index and surface warnings
    const warnings = validateIndex(indexResult.content);
    if (warnings.length > 0) {
      console.log(`  ${pc.yellow("⚠ Warnings")}:`);
      for (const warning of warnings) {
        console.log(`    ${pc.dim("•")} ${warning}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n${pc.red("✗ Index generation failed")}`);
    console.error(pc.dim(message));
    process.exit(1);
  }

  // Step 6: Inject into AGENTS.md (or dry run)
  if (options.dryRun) {
    console.log(`\n${pc.yellow("⚠ Dry run - skipping injection")}`);
    console.log(pc.dim("\nIndex preview (first 200 chars):"));
    console.log(pc.dim(indexResult.content.substring(0, 200) + "..."));
  } else {
    console.log(`\n${pc.dim("→")} Injecting into ${options.output}...`);
    try {
      const injectionResult = await injectIndex(
        options.output,
        repoName,
        indexResult.content,
        options.force
      );

      if (injectionResult.existed) {
        console.log(`  ${pc.green("✓")} Updated existing block`);
      } else {
        console.log(`  ${pc.green("✓")} Added new block`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n${pc.red("✗ Injection failed")}`);
      console.error(pc.dim(message));
      throw new CommandError(message);
    }

    // Step 7: Update lock file
    console.log(`\n${pc.dim("→")} Updating lock file...`);
    try {
      await addDocsToLock(process.cwd(), repoName, {
        source: repoUrl,
        sourceUrl: parsed.url,
        sourceType: parsed.type,
        ref: parsed.ref || options.ref,
        subpath: parsed.subpath,
        commitHash,
        indexHash: indexResult.indexHash,
        indexSizeBytes: indexResult.sizeBytes,
        indexSizeTokens: indexResult.sizeTokens,
      });
      console.log(`  ${pc.green("✓")} Lock file updated`);
    } catch (error) {
      // Non-fatal: don't exit if lock file fails
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  ${pc.yellow("⚠")} Lock file update failed: ${message}`);
    }
  }

  // Success summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(pc.bold(`\n${pc.green("✓ Done")} in ${elapsed}s\n`));
}
