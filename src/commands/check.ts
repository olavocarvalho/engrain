import pc from "picocolors";

export type CheckCommandOptions = {
  docName?: string;
};

export async function runCheckCommand(options: CheckCommandOptions): Promise<void> {
  // Placeholder implementation.
  // The CLI surface matches `_workstream/PLAN.md`; implementation comes next.
  console.log(`${pc.bold("engrain check")} (not implemented yet)\n`);
  console.log(`doc: ${options.docName ?? "(all)"}`);
}

