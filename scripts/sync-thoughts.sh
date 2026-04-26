#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📤 Syncing thoughts..."

# Validate mdformat has frontmatter plugin installed
MDFORMAT_VERSION=$(mdformat --version 2>/dev/null || echo "not found")
if [ "$MDFORMAT_VERSION" = "not found" ]; then
    echo -e "${RED}Error: mdformat is not installed${NC}"
    echo "Install with: pip install mdformat mdformat-frontmatter"
    exit 1
fi

if ! echo "$MDFORMAT_VERSION" | grep -q "mdformat_frontmatter"; then
    echo -e "${RED}Error: mdformat_frontmatter plugin is not installed${NC}"
    echo "Current version: $MDFORMAT_VERSION"
    echo ""
    echo "The frontmatter plugin is required to preserve YAML frontmatter in markdown files."
    echo "Install with: pip install mdformat-frontmatter"
    exit 1
fi

echo -e "${GREEN}Using: ${MDFORMAT_VERSION}${NC}"

# Get the git username dynamically
GIT_USERNAME=$(git config user.name)
if [ -z "$GIT_USERNAME" ]; then
    echo -e "${RED}Error: git user.name is not configured${NC}"
    echo "Run: git config user.name \"Your Name\""
    exit 1
fi
echo -e "${GREEN}Git user: ${GIT_USERNAME}${NC}"

# Find the matching user directory (case-insensitive, ignoring spaces/special chars)
USER_DIR=""
GIT_USERNAME_NORMALIZED=$(echo "$GIT_USERNAME" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]-_.')

for dir in thoughts/*/; do
    dir_name=$(basename "$dir")
    dir_name_normalized=$(echo "$dir_name" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]-_.')
    if [ "$dir_name_normalized" = "$GIT_USERNAME_NORMALIZED" ]; then
        USER_DIR="thoughts/$dir_name"
        break
    fi
done

# If no matching directory found, error out
if [ -z "$USER_DIR" ]; then
    echo -e "${RED}Error: No directory found matching git username '${GIT_USERNAME}'${NC}"
    echo "Expected a directory in thoughts/ matching your username (case-insensitive)"
    echo ""
    echo "Existing directories:"
    ls -d thoughts/*/ 2>/dev/null | sed 's|thoughts/||' | sed 's|/||' | while read dir; do echo "  - $dir"; done
    echo ""
    echo "Please create your directory: mkdir -p thoughts/${GIT_USERNAME}"
    exit 1
fi

echo -e "${GREEN}User directory: ${USER_DIR}${NC}"

# 1. Check git status for changes in thoughts/
echo ""
echo "📋 Checking git status..."
CHANGED_FILES=$(git status --porcelain thoughts/ 2>/dev/null || true)

if [ -z "$CHANGED_FILES" ]; then
    echo -e "${YELLOW}No changes in thoughts/ directory${NC}"
    exit 0
fi

echo "Changed files:"
echo "$CHANGED_FILES"

# 2. Check for files in thoughts/shared/ and move them to user directory
echo ""
echo "🔍 Checking for files in thoughts/shared/..."
SHARED_FILES=$(echo "$CHANGED_FILES" | grep -E "^(\?\?|[AM ][ M]).*thoughts/shared/" | sed 's/^...//' || true)

if [ -n "$SHARED_FILES" ]; then
    echo -e "${YELLOW}Found files in thoughts/shared/ - moving to ${USER_DIR}/${NC}"

    while IFS= read -r src_path; do
        # Handle both files and directories (git reports untracked dirs, not files)
        if [ -f "$src_path" ]; then
            # Single file
            rel_path="${src_path#thoughts/shared/}"
            dest_file="${USER_DIR}/${rel_path}"
            dest_dir=$(dirname "$dest_file")
            mkdir -p "$dest_dir"
            echo "  Moving: $src_path -> $dest_file"
            mv "$src_path" "$dest_file"
        elif [ -d "$src_path" ]; then
            # Directory - find all files within and move them
            find "$src_path" -type f | while IFS= read -r file; do
                rel_path="${file#thoughts/shared/}"
                dest_file="${USER_DIR}/${rel_path}"
                dest_dir=$(dirname "$dest_file")
                mkdir -p "$dest_dir"
                echo "  Moving: $file -> $dest_file"
                mv "$file" "$dest_file"
            done
        fi
    done <<< "$SHARED_FILES"

    # Clean up empty directories in thoughts/shared/
    find thoughts/shared/ -type d -empty -delete 2>/dev/null || true

    echo -e "${GREEN}✓ Files moved to ${USER_DIR}/${NC}"

    # Refresh changed files list after moving
    CHANGED_FILES=$(git status --porcelain thoughts/ 2>/dev/null || true)
fi

# 3. Run mdformat on changed markdown files
echo ""
echo "📝 Formatting markdown files with mdformat..."
MD_FILES=$(echo "$CHANGED_FILES" | grep -E "\.md$" | sed 's/^...//' || true)

if [ -n "$MD_FILES" ]; then
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            echo "  Formatting: $file"
            mdformat "$file"
        fi
    done <<< "$MD_FILES"
    echo -e "${GREEN}✓ Markdown formatting complete${NC}"
else
    echo "No markdown files to format"
fi

# 4. Add, commit, and push
echo ""
echo "📦 Committing changes..."
git add thoughts/
git commit -m "sync"

echo ""
echo "🔄 Pulling latest changes..."
# Stash any unstaged changes so rebase can proceed
NEEDS_STASH=false
if ! git diff --quiet 2>/dev/null; then
    NEEDS_STASH=true
    git stash --quiet
fi
git pull --rebase
if [ "$NEEDS_STASH" = true ]; then
    git stash pop --quiet
fi

echo ""
echo "🚀 Pushing changes..."
git push

echo ""
echo -e "${GREEN}✅ Thoughts synced successfully!${NC}"
