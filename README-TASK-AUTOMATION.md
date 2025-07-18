# Task Management Automation

## Overview

This project includes automation tools to help maintain proper documentation hygiene as specified in the permanent high-priority task in `CLAUDE-TODO.md`.

## Available Scripts

### `move-completed-tasks.sh`

**Purpose**: Automatically move completed tasks from `CLAUDE-TODO.md` to `CLAUDE-TODONE.md`

**Usage**:

```bash
./move-completed-tasks.sh
```

**Features**:

- Scans `CLAUDE-TODO.md` for completed tasks (lines with `[x]` checkbox)
- Shows preview of tasks to be moved
- Prompts for user confirmation
- Creates backups of both files before modification
- Moves completed tasks to `CLAUDE-TODONE.md` with timestamp
- Removes completed tasks from `CLAUDE-TODO.md`
- Shows git status if in a git repository

**Example Output**:

```
Scanning for completed tasks in CLAUDE-TODO.md...
Found 3 completed tasks to move.

Completed tasks to move:
  - [x] **Implement ExpansionDeduplicator** - COMPLETED
  - [x] **Create test suite for expansion logic** - COMPLETED
  - [x] **Update documentation** - COMPLETED

Move these tasks to CLAUDE-TODONE.md? (y/N): y

Creating backups...
Updating files...
✅ Successfully moved 3 completed tasks.
📝 Backups created: CLAUDE-TODO.md.backup, CLAUDE-TODONE.md.backup
🔄 Updated: CLAUDE-TODO.md, CLAUDE-TODONE.md
```

## Manual Task Management

### When to Use

1. **After completing any task** - Run `./move-completed-tasks.sh`
2. **Before major commits** - Ensure documentation is clean
3. **During project reviews** - Maintain clear task status

### Best Practices

1. **Mark tasks as completed** with `[x]` checkbox when done
2. **Run automation script** regularly to keep docs clean
3. **Review moved tasks** in `CLAUDE-TODONE.md` for accuracy
4. **Use git** to track changes and revert if needed

### Permanent Task Reminder

As specified in `CLAUDE-TODO.md`, there is a permanent high-priority task:

> **📝 ALWAYS move completed tasks to CLAUDE-TODONE.md!**
>
> - This task should NEVER be marked as completed - it's a permanent process reminder
> - Essential for project documentation hygiene

This automation script helps fulfill this requirement systematically.

## Future Enhancements

Potential improvements for the automation system:

1. **Git hook integration** - Automatically run on pre-commit
2. **More sophisticated parsing** - Handle nested tasks and sub-todos
3. **Task categorization** - Automatically organize by priority/type
4. **Validation** - Ensure moved tasks maintain proper formatting
5. **Rollback functionality** - Easy undo of task movements

## Integration with Development Workflow

### With Git Hooks

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Auto-move completed tasks before commit
if [[ -f "move-completed-tasks.sh" ]]; then
    ./move-completed-tasks.sh --auto-confirm
fi
```

### With npm scripts

Add to `package.json`:

```json
{
  "scripts": {
    "tasks:move": "./move-completed-tasks.sh",
    "tasks:status": "grep -c '\\[x\\]' CLAUDE-TODO.md || echo 'No completed tasks'"
  }
}
```

---

This automation system ensures consistent documentation hygiene and makes it easy to maintain the project's task management requirements.
