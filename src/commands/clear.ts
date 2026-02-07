/**
 * Clear command - Remove all engrain content from AGENTS.md
 */

import { readFile } from "node:fs/promises";
import type { ClearCommandOptions } from "../types";
import { CommandError } from "../types";
import { c } from "../ui/colors";
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
  console.log(c.bold("\n🧹 engrain clear\n"));

  // Step 1: Check if file exists
  let fileExists = false;
  try {
    await readFile(options.output, "utf-8");
    fileExists = true;
  } catch {
    // File doesn't exist
  }

  if (!fileExists) {
    console.log(`${c.yellow("⚠")} ${options.output} doesn't exist, nothing to clear\n`);
    return;
  }

  // Step 2: Confirm (unless --force)
  if (!options.force) {
    console.log(`${c.yellow("⚠ Warning:")} This will remove all engrain content from ${options.output}`);
    console.log(c.dim("Use --force to skip this confirmation\n"));
    throw new CommandError("Operation cancelled. Use --force to proceed.");
  }

  // Step 3: Remove engrain wrapper from the file (preserves other content)
  console.log(`${c.dim("→")} Removing engrain content from ${options.output}...`);
  try {
    const removed = await removeEngrainWrapper(options.output);

    if (!removed) {
      console.log(`  ${c.yellow("⚠")} No engrain wrapper found in ${options.output}`);
    } else {
      console.log(`  ${c.green("✓")} Removed engrain content from ${options.output}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n${c.red("✗ Removal failed")}`);
    console.error(c.dim(message));
    throw new CommandError(message);
  }

  // Step 4: Clear lock file for this project
  console.log(`\n${c.dim("→")} Clearing lock file...`);
  try {
    await clearAllDocs(process.cwd());
    console.log(`  ${c.green("✓")} Lock file cleared`);
  } catch (error) {
    // Non-fatal: don't exit if lock file fails
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  ${c.yellow("⚠")} Lock file clear failed: ${message}`);
  }

  console.log(c.bold(`\n${c.green("✓ Done")}\n`));
}
