/**
 * Clear command - Remove all engrain content from AGENTS.md
 */

import { access } from "node:fs/promises";
import type { ClearCommandOptions } from "../types";
import { CommandError } from "../types";
import { c } from "../ui/colors";
import { log } from "../ui/log";
import { clearAllDocs } from "../injector/lock";
import { removeEngrainWrapper } from "../injector/inject";

/**
 * Run clear command
 * Removes the <engrain> wrapper (and all doc blocks inside it) from AGENTS.md,
 * preserving any other content in the file. Clears the lock file for this project.
 *
 * @param options - Command options
 */
export async function runClearCommand(options: ClearCommandOptions): Promise<void> {
  log.header("engrain clear");

  // Step 1: Check if file exists
  const fileExists = await access(options.output).then(() => true).catch(() => false);

  if (!fileExists) {
    log.warn(`${options.output} doesn't exist, nothing to clear`);
    log.gap();
    return;
  }

  // Step 2: Confirm (unless --force)
  if (!options.force) {
    log.warn(`this will remove all engrain content from ${options.output}`);
    log.hint("Use --force to skip this confirmation");
    log.gap();
    throw new CommandError("Operation cancelled. Use --force to proceed.");
  }

  // Step 3: Remove engrain wrapper from the file (preserves other content)
  log.detail(`removing engrain content from ${options.output}...`);
  try {
    const removed = await removeEngrainWrapper(options.output);

    if (!removed) {
      log.warn(`no engrain wrapper found in ${options.output}`);
    } else {
      log.step("removed", options.output);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("removal failed");
    log.hint(message);
    log.gap();
    throw new CommandError(message);
  }

  // Step 4: Clear lock file for this project
  log.detail("clearing lock file...");
  try {
    await clearAllDocs(process.cwd());
    log.step("cleared", "lock file");
  } catch (error) {
    // Non-fatal: don't exit if lock file fails
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`lock file clear failed: ${message}`);
  }

  log.gap();
  log.footer(c.green("done"));
}
