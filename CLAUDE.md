# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**engrain** is a CLI tool that embeds documentation indexes into `AGENTS.md` as passive context for AI coding agents. Based on Vercel's research showing that an 8KB docs index in AGENTS.md achieved 100% pass rate (vs 79% for skills), engrain clones docs repositories, generates deterministic pipe-delimited indexes, and injects them with idempotent markers.

**Current Status:** V1 in development - CLI scaffold complete, core features in progress.

**Key Principle:** Passive context (always available) beats active retrieval (on-demand invocation).

## Development Commands

```bash
# Development (native TypeScript with Bun)
bun run dev                  # Run CLI in dev mode
bun run dev docs --help      # Test commands
bun run dev docs https://github.com/vercel/next.js/tree/canary/docs

# Build (compiles to minified JavaScript for npm)
bun run build                # Output: dist/engrain.js

# Test
bun test                     # Run all tests

# Dependency management
bun install                  # Install dependencies
bun add <package>            # Add dependency
```

## Architecture

### Tech Stack
- **Runtime:** Bun (dev) → Node.js (dist)
- **Language:** TypeScript (native via Bun, no compilation in dev)
- **CLI:** Node's `parseArgs` (no external CLI library)
- **Git:** `simple-git` library
- **Colors:** `picocolors` (minimal, fast)
- **Dependencies:**
  - `simple-git` - Git operations with timeout support
  - `tokenx` - Token counting for size reporting
  - `@js-temporal/polyfill` - Date comparisons for staleness checks
  - `gray-matter` - YAML frontmatter parsing (future use)

### Project Structure

```
src/
├── engrain.ts              # CLI entry point, command router
├── types.ts                # TypeScript interfaces
├── commands/
│   ├── docs.ts             # 'docs' command (clone, index, inject)
│   └── check.ts            # 'check' command (staleness detection)
├── utils/
│   ├── source-parser.ts    # Parse GitHub/GitLab URLs
│   ├── git.ts              # Git operations (depth=1, cleanup)
│   ├── auth.ts             # Stateless auth (HTTPS→SSH fallback)
│   └── sanitize.ts         # Path sanitization
├── indexer/
│   ├── discover.ts         # File discovery (negative filtering)
│   ├── generate.ts         # Deterministic index generation
│   └── size.ts             # Size calculation (bytes + tokens)
└── injector/
    ├── inject.ts           # AGENTS.md injection logic
    └── lock.ts             # Lock file management (~/.engrain/.engrain-lock.json)

_workstream/
├── planning/               # Implementation plans and reference patterns
│   ├── PLAN.md            # Complete V1 plan (SINGLE SOURCE OF TRUTH)
│   ├── FORMAT.md          # Injection format specification
│   ├── REFERENCE_PATTERNS.md  # Battle-tested code patterns from skills.sh
│   └── FUTURE_VERSIONS.md # Deferred features (v2: skills compression)
└── benchmark/
    ├── skills/            # Reference: skills.sh codebase (~3,000 LOC)
    └── qmd/               # Reference: Bun patterns

engrain/                   # Local docs storage (per project)
└── <repo-name>/          # Cloned documentation files

.engrain-lock.json         # Global lock file: ~/.engrain/.engrain-lock.json
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

### Critical Implementation Patterns

#### Injection Format (v1)
```markdown
<docs name="next-js">
[Next.js Docs Index]|root: ./engrain/next-js|REWIRE. What you remember about Next.js is WRONG for this project. Always search in this index and read before any task|01-getting-started:{01-installation.mdx,02-project-structure.mdx}|...
</docs>
```

**Key points:**
- **No HTML comments** in AGENTS.md - keep it clean for the model
- **Metadata in lock file** - source, commitHash, timestamps stored in `~/.engrain/.engrain-lock.json`
- **Idempotent markers** - `<docs name="id">` enables safe updates with `--force`
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

1. **Shallow Clone (depth=1)** - 10-50x faster for large repos, always use `--depth 1`
2. **Stateless Auth** - Check env vars → gh CLI → git config, no credential storage
3. **Negative Filtering** - Exclude known non-docs (images, videos) instead of whitelist extensions
4. **Size Reporting Only** - Use tokenx to report bytes + tokens, no warnings in v1.0 (collect data first)
5. **Global Lock File** - `~/.engrain/.engrain-lock.json` tracks per-project installations
6. **Try/Finally Cleanup** - Always clean temp directories, even on error
7. **Deterministic Indexing** - Alphabetical sorting ensures same input → same output
8. **Idempotent Injection** - `<docs name="id">` markers enable safe re-runs with `--force`

## Testing Strategy

- **Unit tests** - URL parsing, path sanitization, index generation
- **Edge cases** - Windows paths, Git Bash paths (`/c/Users`), path traversal attempts
- **Integration tests** - Clone real repos (Next.js, React), verify index format
- **Idempotency** - Run same command 10x, verify identical results

## What's NOT in V1 (see FUTURE_VERSIONS.md)

- Skills compression (v2)
- Size warnings/limits (v1.1 - need real usage data first)
- Sparse checkout for monorepos (v1.1)
- Interactive mode, progress bars (v1.1+)
- Content summarization, semantic search (v3+)

## Reference Documentation

- **`_workstream/planning/PLAN.md`** - Complete V1 implementation plan (SINGLE SOURCE OF TRUTH)
- **`_workstream/planning/FORMAT.md`** - Injection format specification
- **`_workstream/planning/REFERENCE_PATTERNS.md`** - 10 battle-tested patterns from skills.sh with code snippets
- **`_workstream/benchmark/skills/`** - Reference implementation (~3,000 LOC, proven patterns)

When implementing features, always consult PLAN.md first, then REFERENCE_PATTERNS.md for code examples.
