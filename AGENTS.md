# AFLGM — Codex Instructions

## Working principles

### Source of truth

- StackBlitz is the authoritative version of AFLGM.
- Work from the latest extracted ZIP downloaded from StackBlitz.
- Inspect the current workspace files before editing.
- Do not search, compare, or modify historical project copies unless explicitly requested.
- Make focused changes to the extracted workspace.
- Do not assume changes are live in StackBlitz until transferred and verified.
- Read PROJECT_CONTEXT.md and PROGRESS.md only when relevant to the task. Update them only when architecture, decisions, or project status materially changes.

## Architecture
- `src/engine/` owns gameplay rules, simulation logic, and state transitions.
- React components handle user interaction and presentation.
- The resolved match event/state timeline is authoritative for scoring, statistics, commentary, animation, and results.
- Use stable IDs for saved relationships. Preserve existing career saves and migration compatibility.
- Inspect state ownership, imports, and callbacks before modifying large files such as `src/App.tsx`.

## Critical gameplay rules
- Maintain at least 18 players per side on the field.
- Keep positional ratings at or below base overall.
- Player ages increase once per season at rollover.
- Attribute development and positional training are mutually exclusive.
- Traits affect relevant gameplay automatically.
- Prevent duplicate or premature contract extensions.
- Match scoring, statistics, presentation, and final results must remain consistent.

For detailed gameplay requirements, consult `PROJECT_CONTEXT.md` and relevant engine code.

## Persistence and security
- Preserve local-save recovery when modifying cloud persistence.
- Never expose credentials or Supabase service-role keys in client code.
- Preserve appropriate Supabase row-level security requirements.
- Keep the development-only player-attribute writer disabled by default, with existing validation and sanitization safeguards.

## Verification
- Prefer targeted tests and checks relevant to the changed behavior.
- Do not automatically run full builds, lint, or test suites for minor changes.
- Run broader verification when explicitly requested or justified by the change.
- Never report a check as passed unless it was executed.
- Distinguish implemented code, user-reported behavior, and verified functionality.

## Task boundaries
- For inspection or documentation-only requests, do not modify application code.
- Do not install dependencies, run expensive commands, or change unrelated files without a task-specific reason.
- Report concise findings, changes made, verification performed, and unresolved issues.
- Limit repository exploration to files relevant to the requested task. Do not perform full-project audits unless explicitly requested.
