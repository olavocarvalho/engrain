/**
 * Clear command - Remove all engrain content from AGENTS.md
 */

import { access } from 'node:fs/promises';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { removeEngrainWrapper } from '../injector/inject';
import { clearAllDocs, getAllDocsForProject } from '../injector/lock';
import { track } from '../telemetry';
import type { ClearCommandOptions } from '../types';
import { CommandError } from '../types';
import { c } from '../ui/colors';

/**
 * Run clear command
 * Removes the <engrain> wrapper (and all doc blocks inside it) from AGENTS.md,
 * preserving any other content in the file. Clears the lock file for this project.
 *
 * @param options - Command options
 */
export async function runClearCommand(options: ClearCommandOptions): Promise<void> {
  p.intro(pc.bgGreen(pc.black(' engrain clear ')));

  // Step 1: Check if file exists
  const fileExists = await access(options.output)
    .then(() => true)
    .catch(() => false);

  if (!fileExists) {
    p.log.warn(`${options.output} doesn't exist, nothing to clear`);
    p.outro('');
    return;
  }

  // Step 2: Confirm (unless --force)
  if (!options.force) {
    if (!process.stdin.isTTY) {
      p.log.warn(`this will remove all engrain content from ${options.output}`);
      p.log.message(pc.dim('Use --force to skip this confirmation'));
      throw new CommandError('Operation cancelled. Use --force to proceed.');
    }
    const confirmed = await p.confirm({
      message: `Remove all engrain content from ${options.output}?`,
    });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
  }

  // Step 3: Remove engrain wrapper from the file (preserves other content)
  p.log.message(pc.dim(`removing engrain content from ${options.output}...`));
  try {
    const removed = await removeEngrainWrapper(options.output);

    if (!removed) {
      p.log.warn(`no engrain wrapper found in ${options.output}`);
    } else {
      p.log.step(`removed ${options.output}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.log.error('removal failed');
    p.log.message(pc.dim(message));
    throw new CommandError(message);
  }

  // Step 4: Clear lock file for this project
  p.log.message(pc.dim('clearing lock file...'));
  const projectDocs = await getAllDocsForProject();
  const removedCount = Object.keys(projectDocs).length;
  try {
    await clearAllDocs();
    p.log.step('cleared lock file');
  } catch (error) {
    // Non-fatal: don't exit if lock file fails
    const message = error instanceof Error ? error.message : String(error);
    p.log.warn(`lock file clear failed: ${message}`);
  }

  p.outro(c.green('done'));
  track({ event: 'clear', docCount: String(removedCount) });
}
