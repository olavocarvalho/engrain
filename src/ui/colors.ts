/**
 * Color utilities with 256-color ANSI support
 * Provides richer palette than basic picocolors
 */

const useColor = !process.env.NO_COLOR && process.stdout.isTTY;

/**
 * 256-color ANSI palette
 */
export const COLORS = {
  // Grays (for hierarchy)
  dim: "\x1b[38;5;102m", // Medium gray for secondary text
  text: "\x1b[38;5;145m", // Light gray for commands
  dimmer: "\x1b[38;5;240m", // Dark gray for borders/subtle text

  // Semantic colors
  success: "\x1b[38;5;70m", // Green
  error: "\x1b[38;5;160m", // Red
  warning: "\x1b[38;5;214m", // Orange
  info: "\x1b[38;5;75m", // Blue
  cyan: "\x1b[38;5;80m", // Bright cyan

  // Formatting
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

/**
 * Apply color if terminal supports it
 */
function applyColor(text: string, colorCode: string): string {
  if (!useColor) return text;
  return `${colorCode}${text}${COLORS.reset}`;
}

/**
 * Color helper functions
 */
export const c = {
  dim: (text: string) => applyColor(text, COLORS.dim),
  text: (text: string) => applyColor(text, COLORS.text),
  dimmer: (text: string) => applyColor(text, COLORS.dimmer),
  success: (text: string) => applyColor(text, COLORS.success),
  error: (text: string) => applyColor(text, COLORS.error),
  warning: (text: string) => applyColor(text, COLORS.warning),
  info: (text: string) => applyColor(text, COLORS.info),
  cyan: (text: string) => applyColor(text, COLORS.cyan),
  bold: (text: string) => applyColor(text, COLORS.bold),
  reset: (text: string) => text, // No-op reset for compatibility

  // Aliases for picocolors compatibility
  red: (text: string) => applyColor(text, COLORS.error),
  green: (text: string) => applyColor(text, COLORS.success),
  yellow: (text: string) => applyColor(text, COLORS.warning),
};

/**
 * Logo gradient colors (light to dark gray)
 */
export const LOGO_GRADIENT = [250, 248, 245, 243, 240, 238];

/**
 * Apply gradient color to a line
 */
export function gradientLine(text: string, colorCode: number): string {
  if (!useColor) return text;
  return `\x1b[38;5;${colorCode}m${text}${COLORS.reset}`;
}
