/**
 * Remove command - Remove a specific doc from AGENTS.md
 */

import type { RemoveCommandOptions } from "../types";
import { CommandError } from "../types";
import { c } from "../ui/colors";
import { log } from "../ui/log";
import { removeDocBlock } from "../injector/inject";
import { removeDocFromLock } from "../injector/lock";

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
  log.header("engrain remove");

  // Step 1: Remove from AGENTS.md
  log.detail(`removing ${docName} from ${options.output}...`);

  try {
    const removed = await removeDocBlock(options.output, docName);

    if (!removed) {
      log.error(`doc "${docName}" not found in ${options.output}`);
      log.gap();
      throw new CommandError(`Doc "${docName}" not found`);
    }

    log.step("removed", options.output);
  } catch (error) {
    if (error instanceof CommandError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    log.error("removal failed");
    log.hint(message);
    log.gap();
    throw new CommandError(message);
  }

  // Step 2: Remove from lock file
  log.detail("updating lock file...");
  try {
    await removeDocFromLock(process.cwd(), docName);
    log.step("updated", "lock file");
  } catch (error) {
    // Non-fatal: don't exit if lock file fails
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`lock file update failed: ${message}`);
  }

  log.gap();
  log.footer(c.green("done"));
}
