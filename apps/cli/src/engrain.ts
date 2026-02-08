/**
 * engrain - Documentation Index Embedder
 *
 * CLI entry point
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { runCheckCommand } from './commands/check';
import { runClearCommand } from './commands/clear';
import { runDocsCommand } from './commands/docs';
import { runRemoveCommand } from './commands/remove';
import { runSyncCommand } from './commands/sync';
import { setVersion } from './telemetry';
import { CommandError } from './types';
import { showBanner } from './ui/banner';
import { c } from './ui/colors';
import { showCheckHelp, showClearHelp, showDocsHelp, showHelp, showRemoveHelp, showSyncHelp } from './ui/help';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const VERSION = getVersion();
setVersion(VERSION);

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
  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log(VERSION);
    return;
  }

  switch (command) {
    case 'docs': {
      const { values, positionals } = parseArgs({
        args: restArgs,
        options: {
          output: { type: 'string', short: 'o' },
          'engrain-dir': { type: 'string' },
          name: { type: 'string' },
          ref: { type: 'string' },
          profile: { type: 'string', short: 'p' },
          'dry-run': { type: 'boolean' },
          force: { type: 'boolean' },
          help: { type: 'boolean', short: 'h' },
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
        console.error(`${c.error('error')} missing <repository-url>\n`);
        showDocsHelp();
        process.exit(1);
      }

      const profileRaw = typeof values.profile === 'string' ? values.profile : undefined;
      const profile = profileRaw === 'repo' ? 'repo' : 'docs';
      if (profileRaw && profileRaw !== 'docs' && profileRaw !== 'repo') {
        console.error(
          `${c.error('error')} invalid --profile "${profileRaw}" (use "docs" or "repo")\n`
        );
        showDocsHelp();
        process.exit(1);
      }

      await runDocsCommand(repoUrl, {
        output: typeof values.output === 'string' ? values.output : 'AGENTS.md',
        engrainDir: typeof values['engrain-dir'] === 'string' ? values['engrain-dir'] : '.engrain',
        name: typeof values.name === 'string' ? values.name : undefined,
        ref: typeof values.ref === 'string' ? values.ref : undefined,
        profile,
        dryRun: values['dry-run'] === true,
        force: values.force === true,
      });
      break;
    }

    case 'check': {
      const { values, positionals } = parseArgs({
        args: restArgs,
        options: {
          help: { type: 'boolean', short: 'h' },
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

    case 'remove': {
      const { values, positionals } = parseArgs({
        args: restArgs,
        options: {
          output: { type: 'string', short: 'o' },
          help: { type: 'boolean', short: 'h' },
        },
        allowPositionals: true,
        strict: false,
      });

      if (values.help) {
        showRemoveHelp();
        return;
      }

      const docName = positionals[0];
      if (!docName) {
        console.error(`${c.error('error')} missing <doc-name>\n`);
        showRemoveHelp();
        process.exit(1);
      }

      await runRemoveCommand(docName, {
        output: typeof values.output === 'string' ? values.output : 'AGENTS.md',
      });
      break;
    }

    case 'clear': {
      const { values } = parseArgs({
        args: restArgs,
        options: {
          output: { type: 'string', short: 'o' },
          force: { type: 'boolean', short: 'f' },
          help: { type: 'boolean', short: 'h' },
        },
        strict: false,
      });

      if (values.help) {
        showClearHelp();
        return;
      }

      await runClearCommand({
        output: typeof values.output === 'string' ? values.output : 'AGENTS.md',
        force: values.force === true,
      });
      break;
    }

    case 'sync': {
      const { values } = parseArgs({
        args: restArgs,
        options: {
          output: { type: 'string', short: 'o' },
          'engrain-dir': { type: 'string' },
          help: { type: 'boolean', short: 'h' },
        },
        strict: false,
      });

      if (values.help) {
        showSyncHelp();
        return;
      }

      await runSyncCommand({
        output: typeof values.output === 'string' ? values.output : 'AGENTS.md',
        engrainDir: typeof values['engrain-dir'] === 'string' ? values['engrain-dir'] : '.engrain',
      });
      break;
    }

    default:
      console.error(`${c.error('error')} unknown command: ${command}\n`);
      showHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  // Handle CommandError with custom exit code
  if (err instanceof CommandError) {
    // Error message already printed by command
    process.exit(err.exitCode);
  }

  // Handle other errors
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${c.error('error')} ${message}`);
  process.exit(1);
});
