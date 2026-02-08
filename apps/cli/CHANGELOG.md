# Changelog

All notable changes to engrain will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-08

### Added

**New Features:**
- Smart file detection: Auto-detects AGENTS.md vs CLAUDE.md in repositories
  - Writes to AGENTS.md when both exist (shows warning)
  - Falls back to CLAUDE.md when only it exists
  - Creates AGENTS.md by default
- Comprehensive E2E test suite covering full CLI workflows (15 new tests)
- GitHub Actions workflow for auto-deploying tapi to Cloudflare Workers
- Extracted help text to dedicated `ui/help.ts` module for better organization
- Added `utils/fs.ts` utility module

**Telemetry & Analytics:**
- Deployed analytics worker to Cloudflare Workers with Analytics Engine
- Updated telemetry binding from `ENGRAIN` to `ENGRAIN_TELEMETRY`
- Dev mode environment variable (`ENGRAIN_DEV=1`) for distinguishing dev/prod usage
- Telemetry endpoint: https://engrain-t.olavo-vieira-de-carvalho.workers.dev

**Developer Experience:**
- npm publishing documentation in CLAUDE.md
- NPM_TOKEN configuration for automated publishing
- .gitignore file with comprehensive patterns
- Local linking support with `bun link`

### Fixed

- Fixed `spinner.clear()` error in check command (replaced with `spinner.stop()`)
- Fixed clear command test by properly mocking non-interactive mode
- Fixed bin field format in package.json (npm auto-correction)

### Changed

- Refactored CLI entry point: extracted help functions to separate module (-127 lines)
- Improved error handling in git utilities
- Updated telemetry data point handling
- Cleaned up injector code
- Removed redundant dotenv dependency (Bun auto-loads .env)

### Documentation

- Restructured README.md - simplified, tool-focused
- Moved experiment details to `docs/experiment.md`
- Updated CLAUDE.md with npm publishing workflow
- Added tapi deployment documentation

### Testing

- All 66 tests passing
- E2E tests cover: docs, check, remove, clear commands + full workflows
- Tests validate: dry-run, installation, idempotent injection, staleness detection
- Automated test runs in prepublishOnly hook

### Published

- **npm package:** https://www.npmjs.com/package/engrain
- **Version:** 1.1.0
- **Package size:** 51.1 KB (compressed)
- **Bundle size:** 143.2 KB

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
