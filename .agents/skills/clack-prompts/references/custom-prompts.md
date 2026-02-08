# Building Custom Prompts

Two approaches for custom prompts in this codebase:

## Approach 1: Extend @clack/core (Recommended)

Use `@clack/core` primitives with a custom `render()` function. This gives you the state machine, keypress handling, cursor management, and ANSI diff rendering for free.

### Pattern: Custom prompt using core class

```typescript
import { SelectPrompt, settings } from '@clack/core';
import color from 'picocolors';
import { S_BAR, S_BAR_END, S_RADIO_ACTIVE, S_RADIO_INACTIVE, symbol } from '@clack/prompts';
import { limitOptions } from '@clack/prompts';

interface MyOption<V> {
  value: V;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface MyPromptOptions<V> {
  message: string;
  options: MyOption<V>[];
  maxItems?: number;
}

export const mySelect = <V>(opts: MyPromptOptions<V>) => {
  return new SelectPrompt({
    options: opts.options,
    render() {
      const title = `${color.gray('│')}\n${symbol(this.state)}  ${opts.message}\n`;

      switch (this.state) {
        case 'submit':
          return `${title}${color.gray('│')}  ${color.dim(this.options[this.cursor].label)}`;
        case 'cancel':
          return `${title}${color.gray('│')}  ${color.strikethrough(color.dim(this.options[this.cursor].label))}`;
        default: {
          const prefix = `${color.cyan('│')}  `;
          const items = limitOptions({
            cursor: this.cursor,
            options: this.options,
            maxItems: opts.maxItems,
            style: (item, active) =>
              active
                ? `${color.green('●')} ${item.label}`
                : `${color.dim('○')} ${color.dim(item.label)}`,
          });
          return `${title}${prefix}${items.join(`\n${prefix}`)}\n${color.cyan('└')}\n`;
        }
      }
    },
  }).prompt() as Promise<V | symbol>;
};
```

### Key Core Classes

| Class | State Properties | Events |
|---|---|---|
| `TextPrompt` | `value`, `userInput`, `userInputWithCursor` | `value`, `key` |
| `SelectPrompt` | `cursor`, `options`, `value` | `cursor`, `key` |
| `MultiSelectPrompt` | `cursor`, `options`, `value[]` | `cursor`, `key` |
| `AutocompletePrompt` | `cursor`, `filteredOptions`, `selectedValues`, `userInput`, `isNavigating`, `focusedValue` | `cursor`, `key` |
| `ConfirmPrompt` | `value` (boolean) | `confirm`, `key` |

### Render Function Contract

The `render()` function:
- Returns a string (the full frame to display)
- Is called on every keypress and state change
- Has access to `this.state` (`initial`, `active`, `submit`, `cancel`, `error`)
- Has access to `this.value`, `this.cursor`, `this.options`, `this.userInput`
- Core handles ANSI diff rendering (only changed lines are redrawn)

### limitOptions

Use `limitOptions` for viewport-aware option rendering:

```typescript
import { limitOptions } from '@clack/prompts';

const items = limitOptions({
  cursor: this.cursor,
  options: this.options,
  maxItems: 10,
  style: (option, active) => active ? `> ${option.label}` : `  ${option.label}`,
  columnPadding: 3,    // chars used by prefix (e.g. "│  ")
  rowPadding: 4,       // lines used by header + footer
  output: process.stdout,
});
```

Automatically handles: terminal height, sliding window, ellipsis overflow indicators.

## Approach 2: Raw readline/keypress (Full Control)

For prompts that don't fit core's model. See `_workstream/benchmark/skills/src/prompts/search-multiselect.ts` for a complete example.

### Pattern Overview (search-multiselect)

This custom prompt implements searchable multiselect with locked sections, built from scratch:

```typescript
import * as readline from 'readline';
import { Writable } from 'stream';
import pc from 'picocolors';

// Silent output to prevent readline echo
const silentOutput = new Writable({
  write(_chunk, _encoding, callback) { callback(); },
});

interface SearchItem<T> { value: T; label: string; hint?: string; }
interface LockedSection<T> { title: string; items: SearchItem<T>[]; }

interface SearchMultiselectOptions<T> {
  message: string;
  items: SearchItem<T>[];
  maxVisible?: number;
  initialSelected?: T[];
  required?: boolean;
  lockedSection?: LockedSection<T>;  // always-selected items
}

export const cancelSymbol = Symbol('cancel');

export async function searchMultiselect<T>(
  options: SearchMultiselectOptions<T>
): Promise<T[] | symbol> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: silentOutput,   // suppress echo
      terminal: false,
    });

    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin, rl);

    let query = '';
    let cursor = 0;
    const selected = new Set<T>(options.initialSelected);
    let lastRenderHeight = 0;

    // Filter function
    const filter = (item: SearchItem<T>, q: string): boolean => {
      if (!q) return true;
      return item.label.toLowerCase().includes(q.toLowerCase())
        || String(item.value).toLowerCase().includes(q.toLowerCase());
    };

    // Clear previous render
    const clearRender = (): void => {
      if (lastRenderHeight > 0) {
        process.stdout.write(`\x1b[${lastRenderHeight}A`);
        for (let i = 0; i < lastRenderHeight; i++) {
          process.stdout.write('\x1b[2K\x1b[1B');
        }
        process.stdout.write(`\x1b[${lastRenderHeight}A`);
      }
    };

    // Render with state: 'active' | 'submit' | 'cancel'
    const render = (state = 'active'): void => {
      clearRender();
      const lines: string[] = [];
      // ... build lines based on state, filtered items, cursor, selected ...
      process.stdout.write(lines.join('\n') + '\n');
      lastRenderHeight = lines.length;
    };

    // Cleanup raw mode and listeners
    const cleanup = (): void => {
      process.stdin.removeListener('keypress', keypressHandler);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      rl.close();
    };

    // Keypress handler
    const keypressHandler = (_str: string, key: readline.Key): void => {
      if (!key) return;
      if (key.name === 'return') { /* submit */ }
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) { /* cancel */ }
      if (key.name === 'up') { cursor = Math.max(0, cursor - 1); }
      if (key.name === 'down') { cursor = Math.min(filtered.length - 1, cursor + 1); }
      if (key.name === 'space') { /* toggle selection */ }
      if (key.name === 'backspace') { query = query.slice(0, -1); cursor = 0; }
      // Regular character: query += key.sequence
      render();
    };

    process.stdin.on('keypress', keypressHandler);
    render();  // initial render
  });
}
```

### Key Patterns in Raw Approach

1. **Silent Writable**: Prevent readline from echoing input by using a no-op Writable
2. **Raw Mode**: Enable `setRawMode(true)` for keypress detection, always restore in cleanup
3. **ANSI Clear**: Track `lastRenderHeight`, move cursor up and clear each line before re-render
4. **Cleanup**: Always remove keypress listener and restore raw mode, even on cancel
5. **Cancel Symbol**: Return a Symbol to distinguish cancel from valid empty result
6. **Viewport Window**: Calculate `visibleStart`/`visibleEnd` based on cursor and `maxVisible`
7. **Locked Section**: Items that are always selected and displayed separately (not toggleable)

### When to Use Each Approach

| Criterion | Core Extension | Raw readline |
|---|---|---|
| Standard prompt variant | ✅ | ❌ |
| Custom render styling | ✅ | ✅ |
| Custom keypress behavior | Limited | ✅ |
| Diff-based rendering | ✅ (free) | Manual |
| Multiple input modes | ❌ | ✅ |
| Non-standard state flow | ❌ | ✅ |

Prefer Approach 1 unless you need full control over keypress handling or non-standard state flow.
