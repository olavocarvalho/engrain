# engrain

> Index documentation into always-on agent context

**Status:** 🚧 Under development - Name reserved

## What is engrain?

`engrain` clones documentation repositories, generates deterministic directory indexes, and injects them into `AGENTS.md` (or `.ENGRAIN`) as always-on context.

## Concept

- **Problem:** On-demand retrieval (skills/tools) often isn’t invoked
- **Solution:** Embed a compact docs index into `AGENTS.md` as passive context
- **Result:** Passive context beats active retrieval

## Inspiration

Based on [Vercel's approach](https://vercel.com/blog/how-we-optimized-agent-skills) where an 8KB compressed docs index in AGENTS.md achieved 100% pass rate vs 79% for traditional skills.

## Coming Soon

```bash
# Clone docs, index, and inject into AGENTS.md
npx engrain docs <repository-url>

# Check if installed docs are stale
npx engrain check [doc-name]
```

## Development

This package is under active development. Star/watch for updates!

## License

MIT
