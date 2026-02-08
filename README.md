# engrain

A tiny tool that generates compressed indexes from git repositories, and injects them into `AGENTS.md` for AI coding agents.

```bash
# Clone repo → extract docs → generate index → inject into AGENTS.md
npx engrain docs https://github.com/sveltejs/kit
```

## Why you should use this tool?

In Jan 27 2026, Vercel published a [blog post](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) showing a unexpected result: A compressed 8KB docs index embedded directly in AGENTS.md achieved a 100% pass rate, while skills maxed out at 79%. 

As agents not reliably using available [skills](https://developers.openai.com/blog/eval-skills) is a known limitation of current models, I decided make it easy to reproduce with any documentation.

## What it does

The tool generates a compressed index of the docs from the target repository and embed into `AGENTS.md` file.

**Flow:**
- Clone docs from GitHub, GitLab, or any Git repo
- Generate deterministic pipe-delimited indexes
- Inject into `AGENTS.md` with idempotent markers (safe to re-run)
- Track versions via lock file (source commits, index hashes, timestamps)
- Check for stale docs and update when upstream changes

**Why deterministic?** My plan is to use the tool to run an [experiment](./docs/experiment.md) comparing always-on vs dynamic retrival contexts.

## Privacy & Telemetry

`engrain` collects anonymous usage telemetry to help improve the tool. We track:
- Command usage (docs, check, sync, etc.)
- **Target identifiers** (The source of the docs, sanitized format: `github:owner/repo`)
- Index metrics (file count, size, token count)
- OS and CLI version
- Error rates (no error messages or stack traces)

**We do NOT collect:**
- The repository you are working on
- File contents or document text
- Commit messages or code
- Personal information
- IP addresses (not logged by analytics system)

### Opt-Out

To disable telemetry, set either environment variable:

```bash
# Option 1: engrain-specific
export ENGRAIN_DISABLE_TELEMETRY=1

# Option 2: universal opt-out (respects DO_NOT_TRACK)
export DO_NOT_TRACK=1
```

Or add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):
```bash
echo "export ENGRAIN_DISABLE_TELEMETRY=1" >> ~/.bashrc
```

Telemetry is automatically disabled in CI environments.

---

## Installation

```bash
npm install -g engrain
# or run without installing
npx engrain docs <repository-url>
```

## Usage

### Add documentation to your project

```bash
# Clone repo → extract docs → generate index → inject into AGENTS.md
npx engrain docs https://github.com/sveltejs/kit

# Works with GitLab too
npx engrain docs https://gitlab.com/owner/repo/-/tree/main/docs
```

This will:
1. Clone the repo (shallow clone, fast)
2. Store the raw docs in `./engrain/<name>/`
3. Inject it into `AGENTS.md` with `<docs name="...">` markers
4. Track version in `.engrain-lock.json` (project root)

### Sync from lock file

```bash
# Reconstruct .engrain/ from lock file (like npm install)
engrain sync
```

Reads `.engrain-lock.json` and downloads/regenerates all docs. Useful after cloning a repo or when `.engrain/` is gitignored.

### Check for updates

```bash
# Check all docs in current project
engrain check

# Check specific doc
engrain check next-js
```

### Update docs

```bash
# Re-run with --force to update
engrain docs https://github.com/vercel/next.js/tree/canary/docs --force
```

### Remove docs

```bash
engrain remove next-js
```

## How it works

```
engrain docs <url>
  → Parse URL (GitHub/GitLab/raw Git)
  → Shallow clone (depth=1, 60s timeout)
  → Move to ./engrain/<name>/
  → Generate deterministic pipe-delimited index
  → Inject into AGENTS.md via <docs name="id"> markers
  → Update lock file (.engrain-lock.json)
  → Cleanup temp directory
```

### Index format

Docs are compressed into a pipe-delimited format:

```
folder1:{file1.md,file2.md}|folder2:{file3.md}|...
```

This keeps the index compact (typically 8-15KB) while remaining readable by AI agents.

### Why deterministic?

Alphabetical sorting ensures the same input always produces the same output. This makes version control clean and enables reproducible experiments.

## Development

This is a Turborepo monorepo managed with Bun workspaces.

```bash
bun install          # Install all workspace dependencies
bun run build        # Build CLI + telemetry worker
bun run test         # Run test suite
bun run dev          # Dev mode (persistent, uncached)
bun run biome:check  # Lint + format check
bun run biome:fix    # Auto-fix
```

### Project structure

```
.
├── apps/
│   ├── cli/          # npm package "engrain"
│   └── tapi/         # Cloudflare Worker (telemetry)
├── packages/
│   └── telemetry/    # Shared telemetry utilities
└── docs/
    └── experiment.md # Research experiment details
```

## Documentation

- **[Experiment details](docs/experiment.md)** - Research methodology and motivation
- **[Development guide](CLAUDE.md)** - Technical details for IAs (eventually for contributors)

## License

MIT
