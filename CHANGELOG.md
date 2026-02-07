# Changelog

All notable changes to engrain will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-07

### Added

**Core Features:**
- `engrain docs <url>` command - Clone documentation repositories and generate indexes
- `engrain check [name]` command - Detect stale documentation installations
- Support for GitHub, GitLab, SSH, and local path sources
- Deterministic pipe-delimited index format (based on Vercel's research)
- Idempotent injection into AGENTS.md with `<docs name="id">` markers
- Global lock file at `~/.engrain/.engrain-lock.json` for staleness tracking
- Shallow git clones with `--depth 1` for 10-50x faster performance

**Security & Reliability:**
- Path traversal prevention with `sanitizeName()` and `isPathSafe()`
- Subpath validation (existence + containment checks)
- Atomic writes using temp files in same directory (no EXDEV errors)
- Try/finally cleanup pattern for temp directories
- 60-second timeout for git operations
- Stateless authentication (no credential storage)

**CLI Options:**
- `--output <file>` - Specify output file (default: AGENTS.md)
- `--engrain-dir <dir>` - Local docs directory (default: .engrain)
- `--name <name>` - Override repository name
- `--ref <ref>` - Git branch/tag (default: main)
- `--dry-run` - Preview without writing
- `--force` - Overwrite existing block

**Developer Experience:**
- Clear, actionable error messages
- Progress indicators with colors
- Comprehensive help text
- Index size reporting (bytes + tokens via tokenx)
- Empty index warnings via `validateIndex()`

### Technical Details

- **Bundle size:** 90.97 KB (minified)
- **Node compatibility:** >=18
- **Dependencies:** simple-git, tokenx, picocolors, gray-matter, @js-temporal/polyfill
- **Platform support:** macOS, Linux, Windows (with Git Bash)

### Architecture Decisions

1. **Passive context over active retrieval** - Docs index always available in AGENTS.md
2. **Negative filtering** - Exclude images/binaries, not whitelist extensions
3. **Deterministic indexing** - Alphabetical sorting ensures reproducible output
4. **Cross-platform paths** - Always use forward slashes in index output
5. **Escape pipes** - Both file AND directory names pipe-escaped

### Security Hardening (from suggested_fixes.md)

- Fixed atomic writes to use same directory as target (prevents EXDEV)
- Added subpath validation for containment and existence
- Added destination path safety checks before rm/cp operations
- Replaced `process.exit()` with typed errors for better testability

[1.0.0]: https://github.com/olavocarvalho/engrain/releases/tag/v1.0.0
