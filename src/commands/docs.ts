import pc from "picocolors";

export type DocsCommandOptions = {
  output: string;
  engrainDir: string;
  name?: string;
  ref: string;
  dryRun: boolean;
  force: boolean;
};

export async function runDocsCommand(repoUrl: string, options: DocsCommandOptions): Promise<void> {
  // Placeholder implementation.
  // The CLI surface matches `_workstream/PLAN.md`; implementation comes next.
  console.log(`${pc.bold("engrain docs")} (not implemented yet)\n`);
  console.log(`repo: ${repoUrl}`);
  console.log(`ref: ${options.ref}`);
  console.log(`name: ${options.name ?? "(auto)"}`);
  console.log(`engrain dir: ${options.engrainDir}`);
  console.log(`output: ${options.output}`);
  console.log(`dry run: ${options.dryRun ? "yes" : "no"}`);
  console.log(`force: ${options.force ? "yes" : "no"}`);
}

