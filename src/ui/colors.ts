/**
 * Color utilities for engrain CLI.
 *
 * Uses `picocolors` for styling, which automatically respects:
 * - `NO_COLOR`
 * - TTY support
 *
 * We keep a small semantic palette (like skills/qmd), exposed as `c.*`.
 */

import pc from "picocolors";

type Styler = (input: string) => string;

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, "");
  if (normalized.length === 3) {
    const r = Number.parseInt(normalized[0] + normalized[0], 16);
    const g = Number.parseInt(normalized[1] + normalized[1], 16);
    const b = Number.parseInt(normalized[2] + normalized[2], 16);
    return [r, g, b];
  }
  if (normalized.length === 6) {
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return [r, g, b];
  }
  throw new Error(`Invalid hex color: "${hex}"`);
}

function truecolor(hex: string, fallback: Styler): Styler {
  const [r, g, b] = hexToRgb(hex);
  return (input: string) => {
    // Keep behavior aligned with picocolors (NO_COLOR, non-TTY, etc.)
    if (!pc.isColorSupported) return fallback(input);
    return `\x1b[38;2;${r};${g};${b}m${input}\x1b[0m`;
  };
}

const THEME = (process.env.ENGRAIN_THEME ?? "mint").toLowerCase();
const USE_MINT = THEME === "mint";

const mint = {
  accent: truecolor("#78FAAD", pc.green),
  accentDim: truecolor("#59C184", pc.green),
  // Based on "Shades of Purple Super Dark" palette, but mint-first
  error: truecolor("#e33937", pc.red),
  warning: truecolor("#fad000", pc.yellow),
  info: truecolor("#6943ff", pc.blue),
  dimmer: truecolor("#5c5c61", pc.gray),
} as const;

/**
 * Semantic color helpers.
 *
 * Note: `picocolors` returns plain text when colors are not supported.
 */
export const c = {
  // Hierarchy
  dim: pc.dim,
  dimmer: USE_MINT ? mint.dimmer : pc.gray,
  text: USE_MINT ? mint.accent : pc.cyan,

  // Semantic
  success: USE_MINT ? mint.accent : pc.green,
  error: USE_MINT ? mint.error : pc.red,
  warning: USE_MINT ? mint.warning : pc.yellow,
  info: USE_MINT ? mint.info : pc.blue,
  cyan: USE_MINT ? mint.accent : pc.cyan,

  // Formatting
  bold: pc.bold,
  reset: pc.reset,

  // Aliases used elsewhere
  red: USE_MINT ? mint.error : pc.red,
  green: USE_MINT ? mint.accent : pc.green,
  yellow: USE_MINT ? mint.warning : pc.yellow,

  // Theme extras (optional, for richer UI)
  accent: USE_MINT ? mint.accent : pc.cyan,
  accentDim: USE_MINT ? mint.accentDim : pc.cyan,
} as const;
