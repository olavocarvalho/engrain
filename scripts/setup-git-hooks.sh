#!/bin/bash

# Setup git hooks for Biome
# This script creates a pre-commit hook that runs Biome on staged files

set -e

GIT_DIR=$(git rev-parse --git-dir)
HOOKS_DIR="$GIT_DIR/hooks"

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Create pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash

# Get staged files that Biome can process
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|jsx|tsx|json|jsonc)$')

if [ -n "$STAGED_FILES" ]; then
  echo "Running Biome on staged files..."
  
  # Run Biome check with write flag to auto-fix issues
  bunx @biomejs/biome check --write --no-errors-on-unmatched $STAGED_FILES
  
  # Check exit code
  if [ $? -ne 0 ]; then
    echo "❌ Biome found issues that couldn't be auto-fixed. Please fix them before committing."
    exit 1
  fi
  
  # Re-stage files that were auto-fixed
  git add $STAGED_FILES
  
  echo "✅ Biome check passed"
fi

exit 0
EOF

# Make hook executable
chmod +x "$HOOKS_DIR/pre-commit"

echo "✅ Git pre-commit hook installed successfully"
echo "   The hook will run Biome on staged files before each commit"
