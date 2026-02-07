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
  // Hello World - Ready to engrain!
  console.log(pc.cyan(`\n🌱 engrain v${VERSION} - Ready to embed documentation indexes!\n`));

  const args = process.argv.slice(2);
  const command = args[0];
  const restArgs = args.slice(1);

  if (!command || command === "help" || command === "--help" || command === "-h") {
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
        engrainDir: typeof values["engrain-dir"] === "string" ? values["engrain-dir"] : "engrain",
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
  console.log(`${pc.bold("engrain")} ${pc.dim(`v${VERSION}`)}`);
  console.log(pc.dim("Documentation index embedder for agent context."));
  console.log("");
  console.log(pc.bold("Usage"));
  console.log("  engrain docs <repository-url> [options]");
  console.log("  engrain check [doc-name]");
  console.log("");
  console.log(pc.bold("Commands"));
  console.log("  docs   Clone docs repo, index files, inject into AGENTS.md");
  console.log("  check  Detect stale docs installs for this project");
  console.log("");
  console.log(pc.bold("Global options"));
  console.log("  -h, --help     Show help");
  console.log("  -v, --version  Show version");
  console.log("");
  console.log(pc.bold("Examples"));
  console.log("  engrain docs https://github.com/vercel/next.js/tree/canary/docs");
  console.log("  engrain docs https://github.com/facebook/react/tree/main/docs --name react");
  console.log("  engrain check");
  console.log("  engrain check next-js");
  console.log("");
  console.log(`Run ${pc.bold("engrain docs --help")} or ${pc.bold("engrain check --help")} for command options.`);
}

function showDocsHelp() {
  console.log(`${pc.bold("engrain docs")} ${pc.dim(`v${VERSION}`)}`);
  console.log("");
  console.log(pc.bold("Usage"));
  console.log("  engrain docs <repository-url> [options]");
  console.log("");
  console.log(pc.bold("Options"));
  console.log("  -o, --output <file>      Output file (default: AGENTS.md)");
  console.log("      --engrain-dir <dir>  Local docs directory (default: ./engrain)");
  console.log("      --name <name>        Override repository name (default: derived from URL)");
  console.log("      --ref <ref>          Git branch/tag (default: main)");
  console.log("      --dry-run            Preview without writing");
  console.log("      --force              Overwrite existing block");
  console.log("  -h, --help               Show help");
  console.log("");
  console.log(pc.bold("Examples"));
  console.log("  engrain docs https://github.com/vercel/next.js/tree/canary/docs");
  console.log("  engrain docs https://github.com/facebook/react/tree/main/docs --name react --output .ENGRAIN");
}

function showCheckHelp() {
  console.log(`${pc.bold("engrain check")} ${pc.dim(`v${VERSION}`)}`);
  console.log("");
  console.log(pc.bold("Usage"));
  console.log("  engrain check [doc-name]");
  console.log("");
  console.log(pc.bold("Examples"));
  console.log("  engrain check");
  console.log("  engrain check next-js");
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${pc.red("error")} ${message}`);
  process.exit(1);
});
