/**
 * Check command - Detect stale docs
 * Compares local commit hash vs upstream
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { getAllDocsForProject } from '../injector/lock';
import { track } from '../telemetry';
import type { CheckCommandOptions } from '../types';
import { CommandError } from '../types';
import { c } from '../ui/colors';
import { fetchLatestCommitHash } from '../utils/git';
import { parseSource } from '../utils/source-parser';

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
  p.intro(pc.bgGreen(pc.black(' engrain check ')));

  // Step 1: Read lock file
  p.log.message(pc.dim('reading lock file...'));
  const projectDocs = await getAllDocsForProject();

  if (Object.keys(projectDocs).length === 0) {
    p.log.warn('no docs installed for this project');
    p.log.message(pc.dim("Run 'engrain docs <repository-url>' to install documentation."));
    p.outro('');
    return;
  }

  // Step 2: Filter docs to check
  const docsToCheck = options.docName
    ? { [options.docName]: projectDocs[options.docName] }
    : projectDocs;

  if (options.docName && !projectDocs[options.docName]) {
    p.log.error(`doc "${options.docName}" not found`);
    p.log.message(pc.dim('Available docs:'));
    for (const name of Object.keys(projectDocs)) {
      p.log.message(pc.dim(`  - ${name}`));
    }
    throw new CommandError(`Doc "${options.docName}" not found`);
  }

  p.log.step(`${Object.keys(docsToCheck).length} doc(s) found`);

  // Step 3: Check each doc for staleness
  let outdatedCount = 0;
  const spinner = p.spinner();

  for (const [name, entry] of Object.entries(docsToCheck)) {
    if (!entry) continue;

    // Skip local docs (can't check staleness)
    if (entry.commitHash === 'local') {
      p.log.step(`${name} ${pc.dim('local, skipped')}`);
      continue;
    }

    try {
      spinner.start(`Checking ${name}`);
      const sourceUrl = entry.sourceUrl ?? parseSource(entry.source).url;
      const latestHash = await fetchLatestCommitHash(sourceUrl, entry.ref);
      spinner.stop();

      if (latestHash !== entry.commitHash) {
        outdatedCount++;
        const daysAgo = daysSince(entry.updatedAt);
        p.log.step(`${name} ${c.yellow('outdated')}`);
        p.log.message(pc.dim(`last updated ${daysAgo} days ago`));
        const updateCmd =
          `engrain docs ${entry.source}` +
          ` --name ${name}` +
          (entry.ref ? ` --ref ${entry.ref}` : '') +
          ` --force`;
        p.log.message(pc.dim(updateCmd));
      } else {
        p.log.step(`${name} ${c.green('up to date')}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spinner.stop();
      p.log.step(`${name} ${c.red('error')}`);
      p.log.message(pc.dim(message));
    }
  }

  // Summary
  const totalCount = Object.keys(docsToCheck).length;
  const summary =
    outdatedCount > 0
      ? `${totalCount} doc(s) checked, ${c.yellow(`${outdatedCount} outdated`)}`
      : `${totalCount} doc(s) checked, ${c.green('all up to date')}`;
  p.outro(summary);

  track({
    event: 'check',
    docCount: String(totalCount),
    outdatedCount: String(outdatedCount),
  });
}
