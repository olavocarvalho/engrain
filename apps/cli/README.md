# engrain

> Index documentation into always-on agent context

**Status:** ✅ V1 complete (core CLI). Polishing docs + UX.

## What is engrain?

`engrain` clones documentation repositories, generates deterministic directory indexes, and injects them into `AGENTS.md` (or `.ENGRAIN`) as always-on context.

## Concept

- **Problem:** On-demand retrieval (skills/tools) often isn’t invoked
- **Solution:** Embed a compact docs index into `AGENTS.md` as passive context
- **Result:** Passive context beats active retrieval

## Inspiration

Based on [Vercel's approach](https://vercel.com/blog/how-we-optimized-agent-skills) where an 8KB compressed docs index in AGENTS.md achieved 100% pass rate vs 79% for traditional skills.

## Usage

```bash
# Clone docs, index, and inject into AGENTS.md
npx engrain docs <repository-url>

# Check if installed docs are stale
npx engrain check [doc-name]
```

## Telemetry

`engrain` collects anonymous usage telemetry to help improve the tool. No personally identifiable information (PII) is collected—only command usage patterns, repository sources, and index sizes.

**Opt-out:** Set either environment variable to disable telemetry:
- `DISABLE_TELEMETRY=1`
- `DO_NOT_TRACK=1` (standard from [consoledonottrack.com](https://consoledonottrack.com/))

**Dev mode:** Set `ENGRAIN_DEV=1` to explicitly mark environment as development (otherwise auto-detected from `/src/` path or `NODE_ENV=development`).

Telemetry is fire-and-forget and never blocks CLI execution. See [`_workstream/TELEMETRY_PLAN.md`](../_workstream/TELEMETRY_PLAN.md) for details.

## Architecture

### Tech stack

- **Runtime**: Bun for dev, Node.js for the distributed bundle
- **Language**: TypeScript
- **CLI**: Node’s `parseArgs`
- **Git**: `simple-git` (shallow clone + `ls-remote` for staleness)
- **Index sizing**: `tokenx` (bytes + token estimate)
- **Output**: injected into `AGENTS.md` via semantic `<docs name="...">` blocks

### Module layout

```text
src/
├── engrain.ts              # CLI entry point
├── commands/
│   ├── docs.ts             # parse → clone → copy → index → inject → lock
│   └── check.ts            # read lock → fetch latest hash → compare
├── indexer/
│   ├── discover.ts         # recursive discovery w/ negative filtering
│   ├── generate.ts         # deterministic pipe-delimited index
│   └── size.ts             # bytes + tokens
├── injector/
│   ├── inject.ts           # <docs name="..."> injection into output file
│   └── lock.ts             # global lock file (~/.engrain/.engrain-lock.json)
└── utils/
    ├── source-parser.ts    # GitHub/GitLab/local URL parsing
    ├── git.ts              # shallow clone + cleanup + ls-remote
    ├── sanitize.ts         # sanitizeName/isPathSafe
    └── auth.ts             # token helpers (optional)
```

### Data layout

- **Local docs**: `./engrain/<doc-id>/...`
- **Injected index**: `AGENTS.md` (or `.ENGRAIN` via `--output`)
- **Global lock**: `~/.engrain/.engrain-lock.json` keyed by `process.cwd()`

## Key ADRs (design decisions)

1. **Passive docs index in `AGENTS.md`**
   - Rationale: passive context is always available; avoids “agent forgot to invoke tool/skill”.
2. **Pipe-delimited, single-line index format**
   - Rationale: compact + proven effective; easy to scan for path/file names.
3. **Deterministic index generation**
   - Rationale: stable diffs and idempotent re-runs (sort dirs/files alphabetically).
4. **Negative filtering for discovery**
   - Rationale: exclude obvious non-doc artifacts (images/binaries/archives) without missing valid docs formats.
5. **Shallow clone + strict cleanup**
   - Rationale: fast clones (`--depth 1`) and no temp-dir orphans (try/finally cleanup).
6. **Idempotent injection markers**
   - Rationale: safe updates via `<docs name="id">...</docs>` + `--force`.
7. **Global lock file for staleness checks**
   - Rationale: track commit hash + sizes per project and enable `engrain check`.

## Development

```bash
bun install
bun run dev docs --help
bun run build
```

## License

MIT
