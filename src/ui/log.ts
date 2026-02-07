/**
 * Structured CLI output — clack-inspired box-drawing timeline.
 *
 * Each command opens with `header()` and closes with `footer()`.
 * Steps complete with `step()`, source/highlight with `active()`.
 * Details hang below steps on `│` bar lines.
 *
 * Visual language:
 *   ┌  header         open the timeline
 *   ◆  active         highlighted step (source, key state)
 *   ◇  step           completed step
 *   ■  error          failed step
 *   │  detail / gap   secondary info or vertical spacer
 *   └  footer         close the timeline
 */

import { c } from "./colors";

const BAR = c.dim("│");
const S_TOP = c.dim("┌");
const S_BOT = c.dim("└");
const S_DONE = c.green("◇");
const S_ACTIVE = c.accent("◆");
const S_ERROR = c.red("■");

export const log = {
  /** Open timeline — `┌  title` */
  header(title: string) {
    console.log(`\n${S_TOP}  ${c.bold(title)}`);
    console.log(BAR);
  },

  /** Highlighted step (source identification, key state) */
  active(message: string) {
    console.log(`${S_ACTIVE}  ${message}`);
  },

  /** Completed step */
  step(message: string) {
    console.log(`${S_DONE}  ${message}`);
  },

  /** Error step */
  error(message: string) {
    console.log(`${S_ERROR}  ${c.red(message)}`);
  },

  /** Detail line below a step — `│  dim text` */
  detail(message: string) {
    console.log(`${BAR}  ${c.dim(message)}`);
  },

  /** Vertical bar spacer */
  gap() {
    console.log(BAR);
  },

  /** Close timeline — `└  message` + trailing blank line */
  footer(message: string) {
    console.log(`${S_BOT}  ${message}`);
    console.log();
  },

  /** Warning (non-fatal, inline with bar) */
  warn(message: string) {
    console.log(`${BAR}  ${c.yellow("⚠")} ${c.dim(message)}`);
  },
};
