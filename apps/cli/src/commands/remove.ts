/**
 * Remove command - Remove a specific doc from AGENTS.md
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { removeDocBlock } from '../injector/inject';
import { removeDocFromLock } from '../injector/lock';
import { track } from '../telemetry';
import type { RemoveCommandOptions } from '../types';
import { CommandError } from '../types';
import { c } from '../ui/colors';

/**
 * Run remove command
 * Removes a specific doc block from AGENTS.md and lock file
 *
 * @param docName - Name of the doc to remove
 * @param options - Command options
 */
export async function runRemoveCommand(
  docName: string,
  options: RemoveCommandOptions
): Promise<void> {
  p.intro(pc.bgGreen(pc.black(' engrain remove ')));

  // Step 1: Remove from AGENTS.md
  p.log.message(pc.dim(`removing ${docName} from ${options.output}...`));

  try {
    const removed = await removeDocBlock(options.output, docName);

    if (!removed) {
      p.log.error(`doc "${docName}" not found in ${options.output}`);
      throw new CommandError(`Doc "${docName}" not found`);
    }

    p.log.step(`removed ${options.output}`);
  } catch (error) {
    if (error instanceof CommandError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    p.log.error('removal failed');
    p.log.message(pc.dim(message));
    throw new CommandError(message);
  }

  // Step 2: Remove from lock file
  p.log.message(pc.dim('updating lock file...'));
  try {
    await removeDocFromLock(docName);
    p.log.step('updated lock file');
  } catch (error) {
    // Non-fatal: don't exit if lock file fails
    const message = error instanceof Error ? error.message : String(error);
    p.log.warn(`lock file update failed: ${message}`);
  }

  p.outro(c.green('done'));
  track({ event: 'remove', name: docName });
}
