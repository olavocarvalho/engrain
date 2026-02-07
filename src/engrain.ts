/**
 * engrain - Documentation Index Embedder
 *
 * CLI entry point
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

import pc from "picocolors";
import { runCheckCommand } from "./commands/check";
import { runDocsCommand } from "./commands/docs";
import { CommandError } from "./types";
import { showBanner } from "./ui/banner";
import { c } from "./ui/colors";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = getVersion();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const restArgs = args.slice(1);

  // No args: show banner (compact, inviting)
  if (!command) {
    showBanner();
    return;
  }

  // --help: show full help (comprehensive)
  if (command === "help" || command === "--help" || command === "-h") {
    showHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(VERSION);
    return;
  }

  switch (command) {
    case "docs": {
      const { values, positionals } = parseArgs({
        args: restArgs,
        options: {
          output: { type: "string", short: "o" },
          "engrain-dir": { type: "string" },
          name: { type: "string" },
          ref: { type: "string" },
          "dry-run": { type: "boolean" },
          force: { type: "boolean" },
          help: { type: "boolean", short: "h" },
        },
        allowPositionals: true,
        strict: false,
      });

      if (values.help) {
        showDocsHelp();
        return;
      }

      const repoUrl = positionals[0];
      if (!repoUrl) {
        console.error(`${pc.red("error")} missing <repository-url>\n`);
        showDocsHelp();
        process.exit(1);
      }

      await runDocsCommand(repoUrl, {
        output: typeof values.output === "string" ? values.output : "AGENTS.md",
        engrainDir: typeof values["engrain-dir"] === "string" ? values["engrain-dir"] : ".engrain",
        name: typeof values.name === "string" ? values.name : undefined,
        ref: typeof values.ref === "string" ? values.ref : "main",
        dryRun: values["dry-run"] === true,
        force: values.force === true,
      });
      break;
    }

    case "check": {
      const { values, positionals } = parseArgs({
        args: restArgs,
        options: {
          help: { type: "boolean", short: "h" },
        },
        allowPositionals: true,
        strict: false,
      });

      if (values.help) {
        showCheckHelp();
        return;
      }

      const docName = positionals[0];
      await runCheckCommand({ docName });
      break;
    }

    default:
      console.error(`${pc.red("error")} unknown command: ${command}\n`);
      showHelp();
      process.exit(1);
  }
}

function showHelp() {
  console.log(`${c.bold("Usage:")} engrain <command> [options]\n`);

  console.log(c.bold("Commands:"));
  console.log(`  docs <url>        Clone docs repository, index files, inject into AGENTS.md`);
  console.log(`                    ${c.dimmer("e.g. https://github.com/vercel/next.js/tree/canary/docs")}`);
  console.log(`                    ${c.dimmer("     vercel/next.js/tree/canary/docs")}`);
  console.log(`  check [name]      Detect stale docs by comparing local vs upstream commits\n`);

  console.log(c.bold("Global Options:"));
  console.log(`  -h, --help        Show this help message`);
  console.log(`  -v, --version     Show version number\n`);

  console.log(c.bold("Examples:"));
  console.log(`  ${c.dim("$")} engrain docs vercel/next.js/tree/canary/docs`);
  console.log(`  ${c.dim("$")} engrain docs facebook/react/tree/main/docs --name react`);
  console.log(`  ${c.dim("$")} engrain docs https://... --output .ENGRAIN       ${c.dim("# custom output")}`);
  console.log(`  ${c.dim("$")} engrain docs ./local-docs --dry-run              ${c.dim("# preview local")}`);
  console.log(`  ${c.dim("$")} engrain check                                    ${c.dim("# check all docs")}`);
  console.log(`  ${c.dim("$")} engrain check next-js                            ${c.dim("# check specific doc")}\n`);

  console.log(`${c.dim("Learn more at")} ${c.text("https://github.com/olavocarvalho/engrain")}\n`);
}

function showDocsHelp() {
  console.log(`${c.bold("Usage:")} engrain docs <repository-url> [options]\n`);

  console.log(c.bold("Docs Options:"));
  console.log(`  -o, --output <file>      Output file (default: AGENTS.md)`);
  console.log(`      --engrain-dir <dir>  Local docs directory (default: .engrain)`);
  console.log(`      --name <name>        Override repository name`);
  console.log(`                           ${c.dimmer("(default: derived from URL)")}`);
  console.log(`      --ref <ref>          Git branch/tag (default: main)`);
  console.log(`      --dry-run            Preview without writing to disk`);
  console.log(`      --force              Overwrite existing doc block`);
  console.log(`  -h, --help               Show this help message\n`);

  console.log(c.bold("Examples:"));
  console.log(`  ${c.dim("$")} engrain docs vercel/next.js/tree/canary/docs`);
  console.log(`  ${c.dim("$")} engrain docs facebook/react/tree/main/docs --name react`);
  console.log(`  ${c.dim("$")} engrain docs https://... --output .ENGRAIN       ${c.dim("# custom output")}`);
  console.log(`  ${c.dim("$")} engrain docs ./docs --dry-run                    ${c.dim("# preview local")}`);
  console.log(`  ${c.dim("$")} engrain docs git@github.com:org/repo.git --ref v2.0`);
  console.log(`  ${c.dim("$")} engrain docs https://... --force                 ${c.dim("# update existing")}\n`);

  console.log(`${c.dim("Learn more at")} ${c.text("https://github.com/olavocarvalho/engrain")}\n`);
}

function showCheckHelp() {
  console.log(`${c.bold("Usage:")} engrain check [doc-name]\n`);

  console.log(c.bold("Description:"));
  console.log(`  Detect stale docs by comparing local commit hash vs upstream.`);
  console.log(`  Reads from global lock file at ${c.dimmer("~/.engrain/.engrain-lock.json")}\n`);

  console.log(c.bold("Examples:"));
  console.log(`  ${c.dim("$")} engrain check                    ${c.dim("# check all installed docs")}`);
  console.log(`  ${c.dim("$")} engrain check next-js            ${c.dim("# check specific doc")}\n`);

  console.log(`${c.dim("Learn more at")} ${c.text("https://github.com/olavocarvalho/engrain")}\n`);
}

main().catch((err) => {
  // Handle CommandError with custom exit code
  if (err instanceof CommandError) {
    // Error message already printed by command
    process.exit(err.exitCode);
  }

  // Handle other errors
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${pc.red("error")} ${message}`);
  process.exit(1);
});
