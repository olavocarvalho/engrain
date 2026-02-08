# Clack API Reference

Complete type signatures for `@clack/prompts` and `@clack/core`.

## Table of Contents

- [Prompts](#prompts) — text, password, confirm, select, multiselect, autocomplete, autocompleteMultiselect, groupMultiselect, path
- [UI Components](#ui-components) — spinner, progress, tasks, taskLog, log, stream, note, box, intro, outro, cancel
- [Utilities](#utilities) — isCancel, group, settings, updateSettings, limitOptions
- [Core Primitives](#core-primitives) — Prompt base class, state machine

---

## Prompts

### text

```typescript
interface TextOptions extends CommonOptions {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  initialValue?: string;
  validate?: (value: string | undefined) => string | Error | undefined;
}
text(opts: TextOptions): Promise<string | symbol>
```

### password

```typescript
interface PasswordOptions extends CommonOptions {
  message: string;
  mask?: string;          // default: '▪'
  validate?: (value: string | undefined) => string | Error | undefined;
  clearOnError?: boolean;
}
password(opts: PasswordOptions): Promise<string | symbol>
```

### confirm

```typescript
interface ConfirmOptions extends CommonOptions {
  message: string;
  active?: string;        // default: 'Yes'
  inactive?: string;      // default: 'No'
  initialValue?: boolean; // default: true
  vertical?: boolean;     // stack options vertically
}
confirm(opts: ConfirmOptions): Promise<boolean | symbol>
```

### select

```typescript
type Option<Value> = Value extends Primitive
  ? { value: Value; label?: string; hint?: string; disabled?: boolean }
  : { value: Value; label: string; hint?: string; disabled?: boolean };

interface SelectOptions<Value> extends CommonOptions {
  message: string;
  options: Option<Value>[];
  initialValue?: Value;
  maxItems?: number;      // viewport limit, auto-calculated from terminal rows
}
select<Value>(opts: SelectOptions<Value>): Promise<Value | symbol>
```

### multiselect

```typescript
interface MultiSelectOptions<Value> extends CommonOptions {
  message: string;
  options: Option<Value>[];
  initialValues?: Value[];
  maxItems?: number;
  required?: boolean;     // default: true
  cursorAt?: Value;       // initial cursor position
}
multiselect<Value>(opts: MultiSelectOptions<Value>): Promise<Value[] | symbol>
```

### autocomplete

```typescript
interface AutocompleteOptions<Value> extends CommonOptions {
  message: string;
  options: Option<Value>[] | ((this: AutocompletePrompt) => Option<Value>[]);
  maxItems?: number;
  placeholder?: string;
  validate?: (value: Value | undefined) => string | Error | undefined;
  filter?: (search: string, option: Option<Value>) => boolean;
  initialValue?: Value;
  initialUserInput?: string;
}
autocomplete<Value>(opts: AutocompleteOptions<Value>): Promise<Value | symbol>
```

Default filter matches against label, hint, and stringified value (case-insensitive).

### autocompleteMultiselect

```typescript
interface AutocompleteMultiSelectOptions<Value> extends CommonOptions {
  message: string;
  options: Option<Value>[] | ((this: AutocompletePrompt) => Option<Value>[]);
  maxItems?: number;
  placeholder?: string;
  validate?: (value: Value[] | undefined) => string | Error | undefined;
  filter?: (search: string, option: Option<Value>) => boolean;
  initialValues?: Value[];
  required?: boolean;
}
autocompleteMultiselect<Value>(opts: AutocompleteMultiSelectOptions<Value>): Promise<Value[] | symbol>
```

### groupMultiselect

```typescript
interface GroupMultiSelectOptions<Value> extends CommonOptions {
  message: string;
  options: Record<string, Option<Value>[]>;  // grouped by category name
  initialValues?: Value[];
  required?: boolean;          // default: true
  cursorAt?: Value;
  selectableGroups?: boolean;  // default: true — allow selecting entire group
  groupSpacing?: number;       // default: 0 — blank lines between groups
}
groupMultiselect<Value>(opts: GroupMultiSelectOptions<Value>): Promise<Value[] | symbol>
```

---

## UI Components

### spinner

```typescript
interface SpinnerOptions extends CommonOptions {
  indicator?: 'dots' | 'timer';  // 'timer' shows elapsed time
  onCancel?: () => void;
  cancelMessage?: string;
  errorMessage?: string;
  frames?: string[];             // default: ['◒', '◐', '◓', '◑']
  delay?: number;                // default: 80ms
  styleFrame?: (frame: string) => string;  // default: picocolors.magenta
}

interface SpinnerResult {
  start(msg?: string): void;
  stop(msg?: string): void;
  cancel(msg?: string): void;
  error(msg?: string): void;
  message(msg?: string): void;   // update message while spinning
  clear(): void;                 // stop silently
  readonly isCancelled: boolean;
}

spinner(opts?: SpinnerOptions): SpinnerResult
```

Handles process signals (SIGINT, SIGTERM, uncaught exceptions) automatically.

### progress

```typescript
interface ProgressOptions extends SpinnerOptions {
  style?: 'light' | 'heavy' | 'block';  // default: 'heavy'
  max?: number;    // default: 100
  size?: number;   // default: 40 (bar width in chars)
}

interface ProgressResult extends SpinnerResult {
  advance(step?: number, msg?: string): void;
}

progress(opts?: ProgressOptions): ProgressResult
```

### tasks

```typescript
type Task = {
  title: string;
  task: (message: (string: string) => void) => string | Promise<string> | void | Promise<void>;
  enabled?: boolean;  // default: true
};

tasks(tasks: Task[], opts?: CommonOptions): Promise<void>
```

### taskLog

```typescript
interface TaskLogOptions extends CommonOptions {
  title: string;
  limit?: number;       // max visible log lines (older lines scroll off)
  spacing?: number;     // default: 1
  retainLog?: boolean;  // keep full log in memory
}

interface TaskLogResult {
  message(msg: string, opts?: { raw?: boolean }): void;
  group(name: string): {
    message(msg: string, opts?: { raw?: boolean }): void;
    error(message: string): void;
    success(message: string): void;
  };
  error(message: string, opts?: { showLog?: boolean }): void;   // keeps log visible by default
  success(message: string, opts?: { showLog?: boolean }): void;  // clears log by default
}

taskLog(opts: TaskLogOptions): TaskLogResult
```

### log

```typescript
interface LogMessageOptions extends CommonOptions {
  symbol?: string;
  spacing?: number;          // default: 1
  secondarySymbol?: string;
}

const log: {
  message(message: string | string[], opts?: LogMessageOptions): void;
  info(message: string, opts?: LogMessageOptions): void;
  success(message: string, opts?: LogMessageOptions): void;
  step(message: string, opts?: LogMessageOptions): void;
  warn(message: string, opts?: LogMessageOptions): void;
  warning(message: string, opts?: LogMessageOptions): void;  // alias for warn
  error(message: string, opts?: LogMessageOptions): void;
}
```

### stream

```typescript
const stream: {
  message(iterable: Iterable<string> | AsyncIterable<string>, opts?: LogMessageOptions): Promise<void>;
  info(iterable: ...): Promise<void>;
  success(iterable: ...): Promise<void>;
  step(iterable: ...): Promise<void>;
  warn(iterable: ...): Promise<void>;
  warning(iterable: ...): Promise<void>;
  error(iterable: ...): Promise<void>;
}
```

### note

```typescript
note(message?: string, title?: string, opts?: NoteOptions): void

interface NoteOptions extends CommonOptions {
  format?: (line: string) => string;  // default: color.dim
}
```

### box

```typescript
box(message?: string, title?: string, opts?: BoxOptions): void

interface BoxOptions extends CommonOptions {
  contentAlign?: 'left' | 'center' | 'right';
  titleAlign?: 'left' | 'center' | 'right';
  width?: number | 'auto';
  titlePadding?: number;    // default: 1
  contentPadding?: number;  // default: 2
  rounded?: boolean;        // default: false (square corners)
  formatBorder?: (text: string) => string;
}
```

### intro / outro / cancel

```typescript
intro(title?: string, opts?: CommonOptions): void
outro(message?: string, opts?: CommonOptions): void
cancel(message?: string, opts?: CommonOptions): void
```

---

## Utilities

### isCancel

```typescript
isCancel(value: unknown): value is symbol
```

Check if a prompt was cancelled (Ctrl+C / Escape).

### group

```typescript
type PromptGroup<T> = {
  [P in keyof T]: (opts: {
    results: Partial<{ [K in keyof T]: Exclude<Awaited<T[K]>, symbol> }>;
  }) => undefined | Promise<T[P] | undefined>;
};

group<T>(
  prompts: PromptGroup<T>,
  opts?: { onCancel?: (opts: { results: Partial<...> }) => void }
): Promise<{ [P in keyof T]: Exclude<Awaited<T[P]>, symbol> }>
```

### settings / updateSettings

```typescript
interface ClackSettings {
  withGuide: boolean;  // show guide bars (│) in UI
  aliases: Map<string, string>;
  actions: Set<string>;
  messages: { cancel: string; error: string };
}

updateSettings(newSettings: Partial<ClackSettings>): void
```

### limitOptions

Internal viewport-aware option limiter. Automatically handles terminal height:

```typescript
interface LimitOptionsParams<TOption> extends CommonOptions {
  options: TOption[];
  maxItems: number | undefined;
  cursor: number;
  style: (option: TOption, active: boolean) => string;
  columnPadding?: number;  // horizontal space taken by prefix
  rowPadding?: number;     // lines taken by header/footer (default: 4)
}

limitOptions<TOption>(params: LimitOptionsParams<TOption>): string[]
```

Minimum display: 5 items. Shows `...` ellipsis for overflow.

---

## Core Primitives

### State Machine

Prompts follow this state flow:

```
initial → active → submit (Enter)
                 → cancel (Ctrl+C / Escape)
                 → error  (validation failure) → active (on next keypress)
```

### Prompt Base Class

```typescript
// @clack/core
class Prompt<TValue> {
  state: 'initial' | 'active' | 'cancel' | 'submit' | 'error';
  value: TValue | undefined;
  userInput: string;
  error: string;

  on(event: string, cb: Function): void;
  once(event: string, cb: Function): void;
  emit(event: string, ...data: any[]): void;
  prompt(): Promise<TValue | symbol>;
}
```

Events: `value`, `userInput`, `cursor`, `confirm`, `key`, `finalize`, `submit`, `cancel`.

### Core Prompt Classes

All extend `Prompt<TValue>` and are used by the styled `@clack/prompts` functions:

| Core Class | Prompts Function |
|---|---|
| `TextPrompt` | `text()` |
| `PasswordPrompt` | `password()` |
| `ConfirmPrompt` | `confirm()` |
| `SelectPrompt` | `select()` |
| `MultiSelectPrompt` | `multiselect()` |
| `AutocompletePrompt` | `autocomplete()`, `autocompleteMultiselect()` |
| `GroupMultiSelectPrompt` | `groupMultiselect()` |
| `SelectKeyPrompt` | `selectKey()` |

### Unicode Symbols

From `@clack/prompts/common`:

| Symbol | Unicode | ASCII Fallback |
|---|---|---|
| `S_STEP_ACTIVE` | ◆ | * |
| `S_STEP_SUBMIT` | ◇ | o |
| `S_STEP_CANCEL` | ■ | x |
| `S_STEP_ERROR` | ▲ | x |
| `S_BAR` | │ | \| |
| `S_BAR_END` | └ | — |
| `S_RADIO_ACTIVE` | ● | > |
| `S_RADIO_INACTIVE` | ○ | (space) |
| `S_CHECKBOX_ACTIVE` | ◻ | [•] |
| `S_CHECKBOX_SELECTED` | ◼ | [+] |
| `S_CHECKBOX_INACTIVE` | ◻ | [ ] |
| `S_PASSWORD_MASK` | ▪ | • |
