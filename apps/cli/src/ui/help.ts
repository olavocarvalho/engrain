/**
 * Help text for all CLI commands
 * Extracted from engrain.ts to keep the entry point focused on parsing and dispatch
 */

import { c } from './colors';

export function showHelp(): void {
  console.log(`${c.bold('Usage:')} engrain <command> [options]\n`);

  console.log(c.bold('Commands:'));
  console.log(`  docs <url>        Clone docs repository, index files, inject into AGENTS.md`);
  console.log(
    `                    ${c.dimmer('e.g. https://github.com/vercel/next.js/tree/canary/docs')}`
  );
  console.log(`                    ${c.dimmer('     vercel/next.js/tree/canary/docs')}`);
  console.log(`  sync              Reconstruct .engrain/ from .engrain-lock.json`);
  console.log(`  check [name]      Detect stale docs by comparing local vs upstream commits`);
  console.log(`  remove <name>     Remove a specific doc from AGENTS.md`);
  console.log(`  clear             Remove all docs from AGENTS.md\n`);

  console.log(c.bold('Global Options:'));
  console.log(`  -h, --help        Show this help message`);
  console.log(`  -v, --version     Show version number\n`);

  console.log(c.bold('Examples:'));
  console.log(`  ${c.dim('$')} engrain docs vercel/next.js/tree/canary/docs`);
  console.log(`  ${c.dim('$')} engrain docs facebook/react/tree/main/docs --name react`);
  console.log(
    `  ${c.dim('$')} engrain docs https://... --output .ENGRAIN       ${c.dim('# custom output')}`
  );
  console.log(
    `  ${c.dim('$')} engrain docs ./local-docs --dry-run              ${c.dim('# preview local')}`
  );
  console.log(
    `  ${c.dim('$')} engrain check                                    ${c.dim('# check all docs')}`
  );
  console.log(
    `  ${c.dim('$')} engrain check next-js                            ${c.dim('# check specific doc')}`
  );
  console.log(
    `  ${c.dim('$')} engrain remove next-js                           ${c.dim('# remove specific doc')}`
  );
  console.log(
    `  ${c.dim('$')} engrain clear --force                            ${c.dim('# remove all docs')}\n`
  );

  console.log(`${c.dim('Learn more at')} ${c.text('https://github.com/olavocarvalho/engrain')}\n`);
}

export function showDocsHelp(): void {
  console.log(`${c.bold('Usage:')} engrain docs <repository-url> [options]\n`);

  console.log(c.bold('Docs Options:'));
  console.log(`  -o, --output <file>      Output file (default: AGENTS.md)`);
  console.log(`      --engrain-dir <dir>  Local docs directory (default: .engrain)`);
  console.log(`      --name <name>        Override repository name`);
  console.log(`                           ${c.dimmer('(default: derived from URL)')}`);
  console.log(`      --ref <ref>          Git branch/tag (default: repo's default branch)`);
  console.log(
    `  -p, --profile <profile>  Indexing profile when URL has no subpath (default: docs)`
  );
  console.log(
    `                           ${c.dimmer('docs = docs/ + README*, repo = full repository')}`
  );
  console.log(`      --dry-run            Preview without writing to disk`);
  console.log(`      --force              Overwrite existing doc block`);
  console.log(`  -h, --help               Show this help message\n`);

  console.log(c.bold('Examples:'));
  console.log(`  ${c.dim('$')} engrain docs vercel/next.js/tree/canary/docs`);
  console.log(`  ${c.dim('$')} engrain docs facebook/react/tree/main/docs --name react`);
  console.log(
    `  ${c.dim('$')} engrain docs https://... --output .ENGRAIN       ${c.dim('# custom output')}`
  );
  console.log(
    `  ${c.dim('$')} engrain docs ./docs --dry-run                    ${c.dim('# preview local')}`
  );
  console.log(`  ${c.dim('$')} engrain docs git@github.com:org/repo.git --ref v2.0`);
  console.log(
    `  ${c.dim('$')} engrain docs https://... --force                 ${c.dim('# update existing')}\n`
  );

  console.log(`${c.dim('Learn more at')} ${c.text('https://github.com/olavocarvalho/engrain')}\n`);
}

export function showCheckHelp(): void {
  console.log(`${c.bold('Usage:')} engrain check [doc-name]\n`);

  console.log(c.bold('Description:'));
  console.log(`  Detect stale docs by comparing local commit hash vs upstream.`);
  console.log(`  Reads from lock file at ${c.dimmer('.engrain-lock.json')}\n`);

  console.log(c.bold('Examples:'));
  console.log(
    `  ${c.dim('$')} engrain check                    ${c.dim('# check all installed docs')}`
  );
  console.log(
    `  ${c.dim('$')} engrain check next-js            ${c.dim('# check specific doc')}\n`
  );

  console.log(`${c.dim('Learn more at')} ${c.text('https://github.com/olavocarvalho/engrain')}\n`);
}

export function showRemoveHelp(): void {
  console.log(`${c.bold('Usage:')} engrain remove <doc-name> [options]\n`);

  console.log(c.bold('Description:'));
  console.log(`  Remove a specific doc block from AGENTS.md and lock file.\n`);

  console.log(c.bold('Remove Options:'));
  console.log(`  -o, --output <file>  Output file (default: AGENTS.md)`);
  console.log(`  -h, --help           Show this help message\n`);

  console.log(c.bold('Examples:'));
  console.log(`  ${c.dim('$')} engrain remove next-js           ${c.dim('# remove next-js docs')}`);
  console.log(`  ${c.dim('$')} engrain remove react --output .ENGRAIN\n`);

  console.log(`${c.dim('Learn more at')} ${c.text('https://github.com/olavocarvalho/engrain')}\n`);
}

export function showClearHelp(): void {
  console.log(`${c.bold('Usage:')} engrain clear [options]\n`);

  console.log(c.bold('Description:'));
  console.log(`  Remove all docs from AGENTS.md and clear lock file for this project.`);
  console.log(`  ${c.yellow('Warning:')} This will remove all engrain content from AGENTS.md.\n`);

  console.log(c.bold('Clear Options:'));
  console.log(`  -o, --output <file>  Output file (default: AGENTS.md)`);
  console.log(`  -f, --force          Skip confirmation prompt`);
  console.log(`  -h, --help           Show this help message\n`);

  console.log(c.bold('Examples:'));
  console.log(`  ${c.dim('$')} engrain clear --force            ${c.dim('# remove all docs')}`);
  console.log(`  ${c.dim('$')} engrain clear --output .ENGRAIN --force\n`);

  console.log(`${c.dim('Learn more at')} ${c.text('https://github.com/olavocarvalho/engrain')}\n`);
}

export function showSyncHelp(): void {
  console.log(`${c.bold('Usage:')} engrain sync [options]\n`);

  console.log(c.bold('Description:'));
  console.log(`  Reconstruct .engrain/ folder and AGENTS.md from .engrain-lock.json.`);
  console.log(`  Similar to npm install - clones and regenerates all docs in lock file.\n`);

  console.log(c.bold('Sync Options:'));
  console.log(`  -o, --output <file>      Output file (default: AGENTS.md)`);
  console.log(`      --engrain-dir <dir>  Local docs directory (default: .engrain)`);
  console.log(`  -h, --help               Show this help message\n`);

  console.log(c.bold('Examples:'));
  console.log(`  ${c.dim('$')} engrain sync                     ${c.dim('# sync all docs from lock file')}`);
  console.log(`  ${c.dim('$')} engrain sync --output .ENGRAIN\n`);

  console.log(`${c.dim('Learn more at')} ${c.text('https://github.com/olavocarvalho/engrain')}\n`);
}
