---
name: clack-prompts
description: >-
  Build beautiful CLI prompts with @clack/prompts and @clack/core.
  Local source at ./_workstream/benchmark/clack (two packages: core + prompts).
  Use when building interactive CLI flows, terminal prompts, spinners, progress bars,
  or custom prompt components. Triggers on: clack, CLI prompt, terminal UI, interactive input,
  spinner, progress bar, select prompt, multiselect, autocomplete prompt, confirm prompt,
  text input prompt, task log, CLI wizard.
---

# Clack Prompts

Local source: `./_workstream/benchmark/clack/`

Two packages:
- **`@clack/core`** (`packages/core/`) — Low-level headless prompt primitives with state machine
- **`@clack/prompts`** (`packages/prompts/`) — High-level styled prompt components (primary API)

Import from `@clack/prompts` for all standard use. Use `@clack/core` only when building custom prompt components.

## Essential Pattern: Cancel Handling

Every prompt returns `Value | symbol`. Always check for cancellation:

```typescript
import { isCancel, text, cancel } from '@clack/prompts';

const name = await text({ message: 'Project name?' });
if (isCancel(name)) {
  cancel('Operation cancelled.');
  process.exit(0);
}
// name is now typed as string
```

## Session Framing

```typescript
import { intro, outro, cancel } from '@clack/prompts';

intro('create-my-app');
// ... prompts ...
outro('Done! Your project is ready.');
```

## Prompt Functions

### text — Text input

```typescript
const name = await text({
  message: 'What is your project name?',
  placeholder: 'my-project',
  defaultValue: 'my-app',
  initialValue: '',
  validate: (value) => {
    if (!value) return 'Name is required';
    if (value.length < 3) return 'Name must be at least 3 characters';
  },
});
```

### password — Masked input

```typescript
const secret = await password({
  message: 'Enter your API key:',
  validate: (value) => { if (!value) return 'Required'; },
});
```

### confirm — Yes/No

```typescript
const shouldContinue = await confirm({
  message: 'Continue?',
  active: 'Yes',     // default: 'Yes'
  inactive: 'No',    // default: 'No'
  initialValue: true,
});
```

### select — Single selection

```typescript
const framework = await select({
  message: 'Pick a framework:',
  options: [
    { value: 'next', label: 'Next.js', hint: 'recommended' },
    { value: 'svelte', label: 'SvelteKit' },
    { value: 'astro', label: 'Astro', disabled: true },
  ],
  initialValue: 'next',
  maxItems: 5, // viewport limit
});
```

### multiselect — Multiple selection

```typescript
const features = await multiselect({
  message: 'Select features:',
  options: [
    { value: 'ts', label: 'TypeScript', hint: 'recommended' },
    { value: 'eslint', label: 'ESLint' },
    { value: 'prettier', label: 'Prettier' },
  ],
  initialValues: ['ts'],
  required: true, // default: true
  cursorAt: 'ts',
});
```

### autocomplete — Type-ahead single select

```typescript
const pkg = await autocomplete({
  message: 'Search packages:',
  options: packages.map(p => ({ value: p.name, label: p.name, hint: p.version })),
  placeholder: 'Type to search...',
  maxItems: 8,
  filter: (search, option) => option.label.toLowerCase().includes(search.toLowerCase()),
});
```

### autocompleteMultiselect — Type-ahead multi select

```typescript
const deps = await autocompleteMultiselect({
  message: 'Select dependencies:',
  options: allPackages,
  placeholder: 'Search...',
  required: true,
  initialValues: ['react'],
});
```

### groupMultiselect — Grouped multi select

```typescript
const tools = await groupMultiselect({
  message: 'Select tools:',
  options: {
    'Linting': [
      { value: 'eslint', label: 'ESLint' },
      { value: 'biome', label: 'Biome' },
    ],
    'Testing': [
      { value: 'vitest', label: 'Vitest' },
      { value: 'playwright', label: 'Playwright' },
    ],
  },
  selectableGroups: true,  // default: true
  groupSpacing: 0,
  required: true,
});
```

## UI Components

### spinner — Loading indicator

```typescript
import { spinner } from '@clack/prompts';

const s = spinner();
s.start('Installing dependencies');
await install();
s.message('Building project');  // update message
await build();
s.stop('Installation complete');
// Also: s.cancel('Cancelled'), s.error('Failed'), s.clear()
```

Timer mode: `spinner({ indicator: 'timer' })` shows elapsed time.

### progress — Progress bar

```typescript
import { progress } from '@clack/prompts';

const p = progress({ max: 100, size: 40, style: 'heavy' });
p.start('Processing files');
for (let i = 0; i < 100; i++) {
  await processFile(i);
  p.advance(1, `File ${i + 1}/100`);
}
p.stop('Done');
```

### tasks — Sequential task runner

```typescript
import { tasks } from '@clack/prompts';

await tasks([
  { title: 'Installing', task: async (message) => { await install(); return 'Installed'; } },
  { title: 'Building', task: async () => { await build(); return 'Built'; } },
  { title: 'Optional', task: async () => {}, enabled: false },
]);
```

### taskLog — Log that clears on success

```typescript
import { taskLog } from '@clack/prompts';

const tl = taskLog({ title: 'Running tests', limit: 20 });
tl.message('test: auth.test.ts passed');
tl.message('test: api.test.ts passed');
// Groups:
const g = tl.group('Unit Tests');
g.message('Running...');
g.success('All passed');
// End:
tl.success('All tests passed');  // clears log
// tl.error('3 tests failed');   // keeps log visible
```

### log — Structured logging

```typescript
import { log } from '@clack/prompts';

log.info('Info message');
log.success('Success message');
log.step('Step completed');
log.warn('Warning message');
log.error('Error message');
log.message('Custom', { symbol: '→' });
```

### stream — Streaming output (async iterables)

```typescript
import { stream } from '@clack/prompts';

await stream.message(asyncIterable);
await stream.info(asyncIterable);
await stream.success(asyncIterable);
```

### note — Bordered note box

```typescript
import { note } from '@clack/prompts';

note('npm run dev\nhttp://localhost:3000', 'Next steps');
```

### box — Bordered box with alignment

```typescript
import { box } from '@clack/prompts';

box('Content here', 'Title', {
  width: 'auto',
  contentAlign: 'center',
  titleAlign: 'left',
  rounded: true,
  contentPadding: 2,
});
```

## group — Prompt sequences with cancel handling

```typescript
import { group, isCancel } from '@clack/prompts';

const result = await group({
  name: () => text({ message: 'Name?' }),
  framework: ({ results }) =>
    select({
      message: `Framework for ${results.name}?`,
      options: [{ value: 'next', label: 'Next.js' }],
    }),
  confirm: ({ results }) =>
    confirm({ message: `Create ${results.name} with ${results.framework}?` }),
}, {
  onCancel: () => {
    cancel('Setup cancelled.');
    process.exit(0);
  },
});
// result is typed: { name: string, framework: string, confirm: boolean }
```

## CommonOptions (shared by all prompts)

All prompt functions accept these optional fields:

```typescript
interface CommonOptions {
  input?: Readable;    // default: process.stdin
  output?: Writable;   // default: process.stdout
  signal?: AbortSignal;
  withGuide?: boolean; // show guide bars (│)
}
```

## Option Type

Used by `select`, `multiselect`, `autocomplete`, `groupMultiselect`:

```typescript
type Option<Value> = {
  value: Value;
  label?: string;    // defaults to String(value) for primitives
  hint?: string;
  disabled?: boolean;
};
```

## Global Settings

```typescript
import { updateSettings } from '@clack/prompts';

updateSettings({ withGuide: true });  // enable guide bars globally
```

## Building Custom Prompts

For custom prompt components beyond the standard set, see [references/custom-prompts.md](references/custom-prompts.md).

The local codebase includes a complex example at `_workstream/benchmark/skills/src/prompts/search-multiselect.ts` — a searchable multiselect with locked sections, built without `@clack/core` using raw readline/keypress.

## API Reference

For complete type signatures and all options, see [references/api.md](references/api.md).

## Source Navigation

- **Prompts source**: `_workstream/benchmark/clack/packages/prompts/src/`
- **Core source**: `_workstream/benchmark/clack/packages/core/src/`
- **Core base class**: `packages/core/src/prompts/prompt.ts` (state machine, render loop, keypress)
- **Symbols/styling**: `packages/prompts/src/common.ts`
- **Viewport limiting**: `packages/prompts/src/limit-options.ts`
