/**
 * Check command - Detect stale docs
 * Compares local commit hash vs upstream
 */

import type { CheckCommandOptions } from "../types";
import { CommandError } from "../types";
import { c } from "../ui/colors";
import { getAllDocsForProject } from "../injector/lock";
import { fetchLatestCommitHash } from "../utils/git";
import { parseSource } from "../utils/source-parser";

/**
 * Calculate days since a date
 */
function daysSince(isoDate: string): number {
  const date = new Date(isoDate);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Run check command
 * Reads lock file, fetches upstream commits, compares with local
 *
 * @param options - Command options
 */
export async function runCheckCommand(options: CheckCommandOptions): Promise<void> {
  console.log(c.bold("\n🔍 engrain check\n"));

  // Step 1: Read lock file
  console.log(`${c.dim("→")} Reading lock file...`);
  const projectDocs = await getAllDocsForProject(process.cwd());

  if (Object.keys(projectDocs).length === 0) {
    console.log(`\n${c.yellow("⚠")} No docs installed for this project`);
    console.log(c.dim("Run 'engrain docs <repository-url>' to install documentation.\n"));
    return;
  }

  // Step 2: Filter docs to check
  const docsToCheck = options.docName
    ? { [options.docName]: projectDocs[options.docName] }
    : projectDocs;

  if (options.docName && !projectDocs[options.docName]) {
    console.error(`\n${c.red("✗")} Doc "${options.docName}" not found`);
    console.log(c.dim("Available docs:"));
    for (const name of Object.keys(projectDocs)) {
      console.log(c.dim(`  - ${name}`));
    }
    console.log();
    throw new CommandError(`Doc "${options.docName}" not found`);
  }

  console.log(`  ${c.green("✓")} Found ${c.cyan(Object.keys(docsToCheck).length.toString())} doc(s)\n`);

  // Step 3: Check each doc for staleness
  let outdatedCount = 0;

  for (const [name, entry] of Object.entries(docsToCheck)) {
    process.stdout.write(`${c.dim("→")} Checking ${c.cyan(name)}...`);

    // Skip local docs (can't check staleness)
    if (entry.commitHash === "local") {
      process.stdout.write(` ${c.dim("(local, skipped)")}\n`);
      continue;
    }

    try {
      const sourceUrl = entry.sourceUrl ?? parseSource(entry.source).url;

      // Fetch latest commit hash from remote
      const latestHash = await fetchLatestCommitHash(sourceUrl, entry.ref);

      if (latestHash !== entry.commitHash) {
        outdatedCount++;
        const daysAgo = daysSince(entry.updatedAt);
        process.stdout.write(` ${c.yellow("⚠ outdated")}\n`);
        console.log(c.dim(`  Last updated ${daysAgo} days ago`));
        const updateCmd =
          `engrain docs ${entry.source}` +
          ` --name ${name}` +
          ` --ref ${entry.ref}` +
          ` --force`;
        console.log(c.dim(`  Run: ${c.reset(updateCmd)}`));
      } else {
        process.stdout.write(` ${c.green("✓ up to date")}\n`);
      }
    } catch (error) {
      process.stdout.write(` ${c.red("✗ error")}\n`);
      const message = error instanceof Error ? error.message : String(error);
      console.log(c.dim(`  ${message}`));
    }
  }

  // Summary
  const totalCount = Object.keys(docsToCheck).length;
  console.log(
    c.bold(
      `\n${totalCount} doc(s) checked, ${outdatedCount > 0 ? c.yellow(`${outdatedCount} outdated`) : c.green("all up to date")}\n`
    )
  );
}
