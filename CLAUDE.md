# CLAUDE.md

## Preamble

My name is Marvin Bentley II.

## 🎯 Purpose

This file configures **Claude Code** to follow a disciplined, **TDD‑first** workflow for the **Collaborative Text‑Expander Chrome Extension (CTE)** project. Claude acts as a structured partner: it reads docs, plans, writes failing tests first, implements just enough code to pass, and commits in small, verifiable steps.

## FYI

* Use **CLAUDE‑TODO.md** as your personal todo file.
* Use `/.claude/CGEM.md` to implement a sub‑agent named **Gemini** (via Gemini CLI).

## ⚙️ Workflow & Best Practices

### 1. Planning Phase

1. **Prompt Claude to “think hard.”** Generate an implementation plan *before* writing code.
2. List **testable increments** (e.g., "expand `;gb` → ‘Goodbye!’", "variable‑prompt modal appears", "Google Drive sync merges JSON").
3. Keep **CLAUDE‑TODO.md** up to date with a structured implementation roadmap—mark items complete as you go.
4. Update `.gitignore` to avoid committing secrets, build artefacts, `dist/`, etc.

### 2. TDD Cycle

For every feature:

1. **Write a failing test**: known trigger → expected expansion.
2. **Run tests** to confirm failure.
3. **Commit** just the tests.
4. **Implement code**—only what’s needed to pass.
5. Maintain **wide & shallow** files (<300 lines). Refactor → separation of concerns (content‑script utils, Drive provider, UI components, etc.).
6. **Run tests** → green.
7. **Commit implementation.**
8. **Refactor** / repeat.

### 📋 File‑Refactoring Guidelines

* **Zero‑Loss Principle:** No information lost when reorganising and refactoring files/docs.
* Verify before/after line counts when moving sections (e.g., completed tasks → TODONE).
* Roll back via Git if content accidentally removed.

### 🤖 Gemini CLI Sub‑Agent Usage Guidelines

* After you've read this file, see /CGEM.md for more information on using Gemini

#### When to Use Gemini CLI

* Large‑scale analysis (files >1000 lines).
* Bulk data tasks (e.g., diff hundreds of snippet records).
* Research‑heavy work (UX patterns, Chrome extension best practices).
* Analyzing entire codebases or large directories.
* Comparing multiple large files.
* Need to understand project-wide patterns or architecture.
* Current context window is insufficient for the task.
* Working with files totaling more than 100KB.
* Verifying if specific features, patterns, or security measures are implemented.
* Checking for the presence of certain coding patterns across the entire codebase.
* Anything that nets a significant token saving.

#### File and Directory Inclusion Syntax

Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the gemini command:

**Single file analysis:**
```bash
gemini -p "@src/main.py Explain this file's purpose and structure"
```

**Multiple files:**
```bash
gemini -p "@package.json @src/index.js Analyze the dependencies used in the code"
```

**Entire directory:**
```bash
gemini -p "@src/ Summarize the architecture of this codebase"
```

**Multiple directories:**
```bash
gemini -p "@src/ @tests/ Analyze test coverage for the source code"
```

**Current directory and subdirectories:**
```bash
gemini -p "@./ Give me an overview of this entire project"
# Or use --all_files flag:
gemini --all_files -p "Analyze the project structure and dependencies"
```

#### Implementation Verification Examples

**Check if a feature is implemented:**
```bash
gemini -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"
```

**Verify authentication implementation:**
```bash
gemini -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"
```

**Check for specific patterns:**
```bash
gemini -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"
```

**Verify error handling:**
```bash
gemini -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"
```

#### Collaboration Workflow

1. **Claude** spots a large task.
2. **Gemini** crunches it with `@` syntax for file/directory inclusion.
3. **Claude** reviews & applies.
4. **Document** decisions in repo.

### 3. Visual / UI Iteration

After core logic works, ask Claude to provide screenshots or mock‑ups for:

* **Onboarding OAuth flow**
* Popup snippet search UI
* Variable‑prompt modal
* Image‑preview dialog
  Iterate until polished.

### 4. Commit & GitHub Integration

* Use `gh` CLI for branches/PRs.
* Keep commits small.
* Before making a commit, think about if anything new (or old) needs to be added to .gitignore. If so, add it.
* **Vite** remains our bundler for the extension (Manifest V3 build target).

### 📦 Version Management

* **Bump version with EVERY commit** (update `manifest.json` and `package.json`).
* **Stay in `0.x.y` pre‑1.0 until launch approval** (keep breaking changes number at 0).
* **Use 0.x.y format**: 0.1.0 → 0.2.0 (feature), 0.1.0 → 0.1.1 (fix).
* **Version logged to console** on extension startup for debugging.
* **Use npm scripts**: `npm run version:feature` or `npm run version:fix`.
* Switch to SemVer MAJOR.MINOR.PATCH only after launch approval.

---

## 🧪 Testing & CI

* Include unit (trigger parser), integration (Drive provider), and e2e (Playwright in Chrome extension context) tests.
* Pre‑commit hooks run linter, formatter, tests.
* GitHub Actions on `main` & `dev` branches build extension and run full test matrix.

---

## ⚡ Slash Commands (`.claude/commands/`)

Examples:

* **/test\:trigger-expand** – run tests for text expansion logic.
* **/test\:variable-modal** – ensure variable prompts render & collect input.
* **/ui\:popup-preview** – render popup UI screenshot.
* **/ci\:run-all** – full lint + test + build.
* **/wakeup** – re‑read CLAUDE.md & CLAUDE‑TODO.md.

---

## 🤖 Agent Behaviour Notes

* Follow **Think → Plan → Code → Commit**.
* Use **sub‑agents** for large scopes.
* Always start with failing tests.
* Request peer review / second agent where useful.

---

## ✅ Usage Summary

1. `claude` ▶ launch session.
2. Plan via questions or slash commands.
3. TDD loop: tests → code → commit.
4. Polish UI mock‑ups.
5. PR with focused, verified changes.

Let’s build the Collaborative Text‑Expander extension step‑by‑step—clean, and test‑driven!

