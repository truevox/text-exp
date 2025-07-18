#!/bin/bash

# Move Completed Tasks Script
# Automatically move completed tasks from CLAUDE-TODO.md to CLAUDE-TODONE.md

set -e

TODO_FILE="CLAUDE-TODO.md"
TODONE_FILE="CLAUDE-TODONE.md"

# Check if files exist
if [[ ! -f "$TODO_FILE" ]]; then
    echo "Error: $TODO_FILE not found"
    exit 1
fi

if [[ ! -f "$TODONE_FILE" ]]; then
    echo "Error: $TODONE_FILE not found"
    exit 1
fi

# Create temporary files
TEMP_TODO=$(mktemp)
TEMP_TODONE=$(mktemp)
TEMP_COMPLETED=$(mktemp)

# Function to clean up temporary files
cleanup() {
    rm -f "$TEMP_TODO" "$TEMP_TODONE" "$TEMP_COMPLETED"
}
trap cleanup EXIT

# Extract completed tasks (lines with [x] checkbox)
echo "Scanning for completed tasks in $TODO_FILE..."
grep -n "^\s*- \[x\]" "$TODO_FILE" > "$TEMP_COMPLETED" || true

if [[ ! -s "$TEMP_COMPLETED" ]]; then
    echo "No completed tasks found."
    exit 0
fi

# Count completed tasks
COMPLETED_COUNT=$(wc -l < "$TEMP_COMPLETED")
echo "Found $COMPLETED_COUNT completed tasks to move."

# Show completed tasks
echo "Completed tasks to move:"
while IFS= read -r line; do
    echo "  - $(echo "$line" | sed 's/^[0-9]*://')"
done < "$TEMP_COMPLETED"

# Ask for confirmation
read -p "Move these tasks to $TODONE_FILE? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 0
fi

# Create new TODO file without completed tasks
echo "Creating new $TODO_FILE without completed tasks..."
grep -v "^\s*- \[x\]" "$TODO_FILE" > "$TEMP_TODO"

# Extract completed tasks with context for TODONE file
echo "Extracting completed tasks..."
{
    echo ""
    echo "## 🎯 **COMPLETED TASKS** - **$(date '+%Y-%m-%d')**"
    echo ""
    while IFS= read -r line; do
        task_line=$(echo "$line" | sed 's/^[0-9]*://')
        echo "$task_line"
    done < "$TEMP_COMPLETED"
    echo ""
    echo "---"
} > "$TEMP_TODONE"

# Backup original files
echo "Creating backups..."
cp "$TODO_FILE" "${TODO_FILE}.backup"
cp "$TODONE_FILE" "${TODONE_FILE}.backup"

# Update files
echo "Updating files..."
mv "$TEMP_TODO" "$TODO_FILE"

# Insert completed tasks at the end of TODONE file
cat "$TODONE_FILE" "$TEMP_TODONE" > "${TODONE_FILE}.tmp"
mv "${TODONE_FILE}.tmp" "$TODONE_FILE"

echo "✅ Successfully moved $COMPLETED_COUNT completed tasks."
echo "📝 Backups created: ${TODO_FILE}.backup, ${TODONE_FILE}.backup"
echo "🔄 Updated: $TODO_FILE, $TODONE_FILE"

# Optional: Show git status
if git status &>/dev/null; then
    echo ""
    echo "Git status:"
    git status --porcelain "$TODO_FILE" "$TODONE_FILE"
fi

echo ""
echo "Task management completed successfully!"