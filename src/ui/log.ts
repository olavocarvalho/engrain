/**
 * Structured CLI output — engrain's branded terminal aesthetic.
 *
 * Design language:
 *   ✶            brand bookend (header + footer)
 *   verb label   past-tense verbs as status ("cloned", "indexed")
 *   aligned col  labels pad to 10, values start at col 12
 *   whitespace   blank lines separate logical groups
 *   no symbols   no checkmarks, no box-drawing — the verb IS the status
 *
 * Hierarchy:
 *   source(name) — accent color, the headline
 *   detail(msg)  — dim, secondary info
 *   step(l, v)   — label + value, the result
 *   stepInfo(m)  — dim, aligned to value column (under a step)
 *   hint(msg)    — dim, 4-space indent (subordinate to anything)
 */

import { c } from "./colors";

const INDENT = "  ";
const LABEL_PAD = 10;

export const log = {
  /** ✶ title — brand bookend, opens the operation */
  header(title: string) {
    console.log(`\n${c.accent("✶")} ${c.bold(title)}\n`);
  },

  /** Source name in accent color — the headline */
  source(name: string) {
    console.log(`${INDENT}${c.text(name)}`);
  },

  /** Dim text at base indent — metadata, progress hints */
  detail(message: string) {
    console.log(`${INDENT}${c.dim(message)}`);
  },

  /** Completed step: label (dim accent) + value (normal) */
  step(label: string, value: string) {
    console.log(`${INDENT}${c.accentDim(label.padEnd(LABEL_PAD))}${value}`);
  },

  /** Detail aligned to value column — subordinate to a step */
  stepInfo(message: string) {
    console.log(`${INDENT}${" ".repeat(LABEL_PAD)}${c.dim(message)}`);
  },

  /** 4-space indented dim text — subordinate detail */
  hint(message: string) {
    console.log(`    ${c.dim(message)}`);
  },

  /** ✗ error in red */
  error(message: string) {
    console.log(`${INDENT}${c.red("✗")} ${c.red(message)}`);
  },

  /** ⚠ non-fatal warning */
  warn(message: string) {
    console.log(`${INDENT}${c.yellow("⚠")} ${c.dim(message)}`);
  },

  /** Blank line spacer */
  gap() {
    console.log();
  },

  /** ✶ message — brand bookend, closes the operation */
  footer(message: string) {
    console.log(`${c.accent("✶")} ${message}\n`);
  },
};
