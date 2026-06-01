# Election Countdown — Agent Instructions

This is the operating guide for AI coding agents (Codex, Claude, etc.) working in this repository.

## Rules
- Read existing code before making changes.
- Make focused, minimal edits. Do not rewrite what was not asked.
- Prefer root-cause fixes over quick patches.
- Run the smallest useful test/build command to verify changes.
- Report what changed and how it was verified.

## Do Not Commit
- `.env` or any file containing secrets, tokens, or credentials
- `.venv/`, `venv/`, `node_modules/`, `dist/`, `build/`, `__pycache__/`
- Generated lock files unless they were already tracked
- Private local notes
