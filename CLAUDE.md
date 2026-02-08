# CLAUDE.md

**engrain** is a CLI tool for embedding compressed documentation indexes into `AGENTS.md` files. It clones libraries repositories, map the docs, generates deterministic pipe-delimited indexes and then embed into `AGENTS.md` with idempotent markers, tracked via a lock file.

**Key Features:**
- **Deterministic indexing** - Same input always produces same output (alphabetical sorting)
- **Idempotent injection** - Safe to re-run with `--force` flag via `<docs name="id">` markers
- **Version tracking** - Lock file stores source, commit hash, and timestamps
- **Staleness detection** - `check` command detects when upstream repository are updated

**Current Status:** V1.0]1 published to npm. Available as `npx engrain` or install globally with `npm install -g engrain`.

## Development Commands

Monorepo (Turborepo + Bun workspaces). Root delegates via `turbo run`; package-level scripts live in `apps/*` and `packages/*`.

```bash
# From repo root
bun install                  # Install all workspace dependencies
bun run build                # turbo run build (CLI + tapi)
bun run test                 # turbo run test (CLI tests)
bun run dev                  # turbo run dev (persistent, uncached)
bun run deploy               # turbo run deploy (tapi)
bun run check                # turbo run check (type checking)

# Code quality (Biome)
bun run biome:check          # Check linting and formatting
bun run biome:fix            # Auto-fix all issues
bun run lint                 # Lint only
bun run lint:fix             # Fix linting issues
bun run format               # Format code
bun run format:check         # Check formatting without changes

# CLI development (from root or apps/cli)
bun run dev --filter=engrain # Run CLI in dev mode
# Or: cd apps/cli && bun run dev
bun run dev --filter=engrain -- docs --help
bun run dev --filter=engrain -- docs https://github.com/vercel/next.js/tree/canary/docs

# Setup git hooks (one-time)
./scripts/setup-git-hooks.sh
```

## Architecture

### Tech Stack
- **Runtime:** Bun (dev) → Node.js (dist)
- **Language:** TypeScript (native via Bun, no compilation in dev)
- **CLI:** Node's `parseArgs` (no external CLI library)
- **Git:** `simple-git` library
- **Colors:** `picocolors` (minimal, fast)
- **Monorepo:** Turborepo + Bun workspaces
- **Code Quality:** Biome (linter + formatter, replaces ESLint + Prettier)
- **Dependencies:**
  - `simple-git` - Git operations with timeout support
  - `tokenx` - Token counting for size reporting
  - `@js-temporal/polyfill` - Date comparisons for staleness checks
  - `gray-matter` - YAML frontmatter parsing (future use)
  - `hono` - Web framework for Cloudflare Workers (tapi)

### Project Structure

```
.
├── apps/
│   ├── cli/                # Public npm package "engrain"
│   │   ├── src/            # CLI entry (engrain.ts), commands, indexer, injector, utils, ui
│   │   ├── tests/          # Test suite
│   │   ├── bin/engrain.mjs # CLI entry point
│   │   └── package.json    # name: "engrain", publishConfig
│   └── tapi/               # Cloudflare Worker (Hono + Analytics Engine) — telemetry ingest
│       ├── src/index.ts    # GET /t, GET /health
│       └── wrangler.jsonc # Cloudflare Workers configuration
├── packages/
│   └── telemetry/          # Shared types + encodeTelemetryParams / decodeTelemetryParams / toDataPoint
│       └── src/            # Telemetry encoding/decoding utilities
├── scripts/
│   └── setup-git-hooks.sh  # Setup git pre-commit hooks for Biome
├── package.json            # private, workspaces, turbo delegates, Biome scripts
├── turbo.json              # Turborepo task configuration
├── tsconfig.base.json      # Shared TypeScript configuration
└── biome.json              # Biome linter/formatter configuration

Lock file: ~/.engrain/.engrain-lock.json (global, per-project docs)
```

### Core Workflows

#### 1. `engrain docs <url>` Command Flow
1. **Parse URL** - Extract owner/repo/ref/subpath (supports GitHub, GitLab, raw Git)
2. **Clone repo** - Shallow clone (depth=1) to temp directory with 60s timeout
3. **Move to ./engrain/<name>** - Sanitize name, create directory
4. **Generate index** - Recursively scan, group by folder, sort alphabetically (deterministic)
5. **Inject into AGENTS.md** - Find/replace `<docs name="id">` block (idempotent)
6. **Update lock file** - Store source, commitHash, timestamps in `~/.engrain/.engrain-lock.json`
7. **Cleanup** - Always remove temp directory (try/finally pattern)

#### 2. `engrain check [name]` Command Flow
1. **Read lock file** - Load installed docs for current project
2. **Fetch latest commit** - Query GitHub API for upstream commit hash
3. **Compare hashes** - Detect staleness
4. **Report status** - Show which docs are outdated

#### 3. `engrain sync` Command Flow
1. **Read lock file** - Load all docs from `.engrain-lock.json`
2. **For each doc** - Clone repo, generate index, inject into AGENTS.md
3. **Update lock** - Refresh timestamps and hashes
4. **Report summary** - Show success/skip/error counts

Like `npm install`, this reconstructs `.engrain/` folder from lock file.

### Critical Implementation Patterns

#### Injection Format 
```markdown
<docs name="{{name}}">
[Next.js Docs Index]|root: ./engrain/{{name}}|REWIRE. What you remember about {{name}} is WRONG for this project. Always search in this index and read before any task|01-getting-started:{01-installation.mdx,02-project-structure.mdx}|...
</docs>
```

**Key points:**
- **Metadata in lock file** - source, commitHash, timestamps stored in `~/.engrain/.engrain-lock.json`
- **Idempotent markers** - `<docs name="id">` enables safe updates 
- **v2 extension** - `<skill name="id">` for skills compression (future)

#### Lock File Structure
```json
{
  "version": 1,
  "projects": {
    "/path/to/project": {
      "next-js": {
        "source": "https://github.com/vercel/next.js",
        "sourceType": "github",
        "ref": "canary",
        "subpath": "docs",
        "commitHash": "abc123...",
        "indexHash": "def456...",
        "indexSizeBytes": 8192,
        "indexSizeTokens": 2048,
        "installedAt": "2026-02-07T...",
        "updatedAt": "2026-02-07T..."
      }
    }
  }
}
```

#### Code Patterns to Follow (from REFERENCE_PATTERNS.md)

**Path Sanitization** (CRITICAL for security):
```typescript
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')
    .substring(0, 255) || 'unnamed-doc';
}

function isPathSafe(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalize(resolve(basePath));
  const normalizedTarget = normalize(resolve(targetPath));
  return normalizedTarget.startsWith(normalizedBase + sep) || normalizedTarget === normalizedBase;
}
```

**Git Clone with Cleanup** (always use try/finally):
```typescript
async function cloneRepo(url: string, ref?: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'engrain-'));
  const git = simpleGit({ timeout: { block: 60000 } });

  try {
    await git.clone(url, tempDir, ['--depth', '1', ...(ref ? ['--branch', ref] : [])]);
    return tempDir;
  } catch (error) {
    // CRITICAL: Clean up temp dir on failure
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
```

**Stateless Auth** (no credential storage):
```typescript
function getGitHubToken(): string | null {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;

  try {
    return execSync('gh auth token', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}
```

**Lock File Management** (versioned, with migration):
```typescript
async function readLock(): Promise<LockFile> {
  try {
    const content = await readFile(lockPath, 'utf-8');
    const parsed = JSON.parse(content) as LockFile;

    // Wipe if old version (backwards incompatible)
    if (parsed.version < CURRENT_VERSION) {
      return createEmptyLockFile();
    }

    return parsed;
  } catch {
    return createEmptyLockFile();
  }
}
```

**Negative File Filtering** (exclude images/binaries, not whitelist):
```typescript
const EXCLUDED_EXTENSIONS = [
  '.jpg', '.png', '.gif', '.svg', '.ico', '.webp',  // Images
  '.mp4', '.mov', '.avi', '.webm',                  // Videos
  '.pdf', '.zip', '.tar', '.gz', '.rar',            // Archives
  '.woff', '.woff2', '.ttf', '.eot',                // Fonts
];

const EXCLUDED_DIRS = ['.git', 'node_modules', '__pycache__', '.DS_Store'];
```

## Key Design Decisions

1. **Shallow Clone (depth=1)** - Always use `--depth 1`
2. **Stateless Auth** - Check env vars → gh CLI → git config, no credential storage
3. **Negative Filtering** - Exclude known non-docs (images, videos) instead of whitelist extensions
4. **Size Reporting Only** - Use tokenx to report bytes + tokens
5. **Lock File** - Per project ./engrain-lock.json 
6. **Try/Finally Cleanup** - Always clean temp directories, even on error
7. **Deterministic Indexing** - Alphabetical sorting ensures same input → same output, for research purpose only
8. **Idempotent Injection** - `<docs name="id">` markers enable safe re-runs with `--force`
9. **Monorepo Structure** - Turborepo + Bun workspaces for shared code and unified tooling
10. **Biome for Code Quality** - Single tool for linting and formatting (100x faster than ESLint + Prettier)
11. **Git Hooks** - Pre-commit hook automatically runs Biome on staged files

## Testing Strategy

- **Unit tests** - URL parsing, path sanitization, index generation
- **Edge cases** - Windows paths, Git Bash paths (`/c/Users`), path traversal attempts
- **Integration tests** - Clone real repos, verify index format
- **Idempotency** - Run same command 3x, verify identical results

## What's NOT in V1 (see FUTURE_VERSIONS.md)

- Skills compression (v2)
- Size warnings/limits 
- Sparse checkout for monorepos 
- Interactive mode, progress bars 
- Content summarization, semantic search

## Publishing to npm

The `engrain` CLI is published to npm at: https://www.npmjs.com/package/engrain

### Publishing Process

**Prerequisites:**
- All tests must pass (`bun test`)
- Version number updated in `apps/cli/package.json`
- Changelog updated
- README.md updated

**To publish:**

```bash
cd apps/cli

# Using npm token from .env (requires setup)
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
npm publish
```

**Important Notes:**
- The prepublishOnly script automatically runs build + tests before publishing
- We're in a monorepo - always publish from `apps/cli` directory

## CI/CD

GitHub Actions workflow (`.github/workflows/publish.yml`):
1. **Biome CI check** - Runs `biome ci .` to ensure code quality
2. **Tests** - Runs test suite
3. **Build** - Builds all packages
4. **Publish** - Publishes CLI to npm on version tags (uses NPM_TOKEN secret)

## Reference Documentation

- **`README.md`** - Project overview and getting started guide
- **`apps/cli/README.md`** - CLI-specific documentation
- **`docs/experiment.md`** - Research context on documentation strategies for AI agents
- **`biome.json`** - Code quality configuration

For implementation details, read the existing `apps/cli/src/` code.
