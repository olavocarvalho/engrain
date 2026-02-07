/**
 * Remove command - Remove a specific doc from AGENTS.md
 */

import type { RemoveCommandOptions } from "../types";
import { CommandError } from "../types";
import { c } from "../ui/colors";
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
  console.log(c.bold("\n🗑️  engrain remove\n"));

  // Step 1: Remove from AGENTS.md
  console.log(`${c.dim("→")} Removing ${c.cyan(docName)} from ${options.output}...`);

  try {
    const removed = await removeDocBlock(options.output, docName);

    if (!removed) {
      console.error(`\n${c.red("✗")} Doc "${docName}" not found in ${options.output}`);
      throw new CommandError(`Doc "${docName}" not found`);
    }

    console.log(`  ${c.green("✓")} Removed from ${options.output}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n${c.red("✗ Removal failed")}`);
    console.error(c.dim(message));
    throw new CommandError(message);
  }

  // Step 2: Remove from lock file
  console.log(`\n${c.dim("→")} Updating lock file...`);
  try {
    await removeDocFromLock(process.cwd(), docName);
    console.log(`  ${c.green("✓")} Lock file updated`);
  } catch (error) {
    // Non-fatal: don't exit if lock file fails
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  ${c.yellow("⚠")} Lock file update failed: ${message}`);
  }

  console.log(c.bold(`\n${c.green("✓ Done")}\n`));
}
