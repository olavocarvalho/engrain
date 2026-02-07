/**
 * Check command - Detect stale docs
 * Compares local commit hash vs upstream
 */

import { getAllDocsForProject } from "../injector/lock";
import type { CheckCommandOptions } from "../types";
import { CommandError } from "../types";
import { c } from "../ui/colors";
import { log } from "../ui/log";
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
  log.header("engrain check");

  // Step 1: Read lock file
  log.detail("reading lock file...");
  const projectDocs = await getAllDocsForProject(process.cwd());

  if (Object.keys(projectDocs).length === 0) {
    log.warn("no docs installed for this project");
    log.hint("Run 'engrain docs <repository-url>' to install documentation.");
    log.gap();
    return;
  }

  // Step 2: Filter docs to check
  const docsToCheck = options.docName
    ? { [options.docName]: projectDocs[options.docName] }
    : projectDocs;

  if (options.docName && !projectDocs[options.docName]) {
    log.error(`doc "${options.docName}" not found`);
    log.hint("Available docs:");
    for (const name of Object.keys(projectDocs)) {
      log.hint(`  - ${name}`);
    }
    log.gap();
    throw new CommandError(`Doc "${options.docName}" not found`);
  }

  log.step("found", `${Object.keys(docsToCheck).length} doc(s)`);
  log.gap();

  // Step 3: Check each doc for staleness
  let outdatedCount = 0;

  for (const [name, entry] of Object.entries(docsToCheck)) {
    if (!entry) continue;

    // Skip local docs (can't check staleness)
    if (entry.commitHash === "local") {
      log.step(name, c.dim("local, skipped"));
      continue;
    }

    try {
      const sourceUrl = entry.sourceUrl ?? parseSource(entry.source).url;
      const latestHash = await fetchLatestCommitHash(sourceUrl, entry.ref);

      if (latestHash !== entry.commitHash) {
        outdatedCount++;
        const daysAgo = daysSince(entry.updatedAt);
        log.step(name, c.yellow("outdated"));
        log.stepInfo(`last updated ${daysAgo} days ago`);
        const updateCmd =
          `engrain docs ${entry.source}` +
          ` --name ${name}` +
          (entry.ref ? ` --ref ${entry.ref}` : "") +
          ` --force`;
        log.stepInfo(updateCmd);
      } else {
        log.step(name, c.green("up to date"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.step(name, c.red("error"));
      log.stepInfo(message);
    }
  }

  // Summary
  const totalCount = Object.keys(docsToCheck).length;
  const summary = outdatedCount > 0
    ? `${totalCount} doc(s) checked, ${c.yellow(`${outdatedCount} outdated`)}`
    : `${totalCount} doc(s) checked, ${c.green("all up to date")}`;
  log.gap();
  log.footer(summary);
}
