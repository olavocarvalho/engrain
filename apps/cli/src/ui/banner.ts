/**
 * Banner and logo for no-args invocation
 * Matches skills.sh style with gradient ASCII art
 */

import { c } from './colors';

const LOGO_LINES = [
  '███████╗███╗   ██╗ ██████╗ ██████╗  █████╗ ██╗███╗   ██╗',
  '██╔════╝████╗  ██║██╔════╝ ██╔══██╗██╔══██╗██║████╗  ██║',
  '█████╗  ██╔██╗ ██║██║  ███╗██████╔╝███████║██║██╔██╗ ██║',
  '██╔══╝  ██║╚██╗██║██║   ██║██╔══██╗██╔══██║██║██║╚██╗██║',
  '███████╗██║ ╚████║╚██████╔╝██║  ██║██║  ██║██║██║ ╚████║',
  '╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝',
];

/**
 * Show compact banner when invoked without arguments
 * Inspired by skills.sh's inviting first-run experience
 */
export function showBanner(): void {
  // Render logo (simple, readable)
  LOGO_LINES.forEach((line) => {
    console.log(c.dimmer(line));
  });

  console.log(`\n${c.dim('Embed docs into always-on agent context')}\n`);

  // Command list (compact, one-liners)
  console.log(
    `  ${c.dim('$')} ${c.text('npx engrain docs <repository-url>')}   ${c.dim('Index and inject docs')}`
  );
  console.log(
    `  ${c.dim('$')} ${c.text('npx engrain check [doc-name]')}        ${c.dim('Check for stale docs')}\n`
  );

  // Quick start example
  console.log(`${c.dim('try:')} npx engrain docs vercel/next.js/tree/canary/docs\n`);

  // Learn more link
  console.log(`${c.dim('Learn more at')} ${c.text('https://github.com/olavocarvalho/engrain')}\n`);
}
