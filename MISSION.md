# AI Mission Control — Product Master Execution Workflow

This file implements the role and execution policy established by `.hermes.md`. It does not
define a competing authority hierarchy. `CLAUDE.md` supplies implementation-specific repository
rules, and `HANDOFF.md` supplies current state and historical evidence. Git and actual source
files remain authoritative for repository and implementation facts.

## Roles

- Hermes plans, routes, synthesizes, verifies, controls gates, and reports. OpenAI Codex is its reasoning driver.
- Luna is a read-only requirements, product-intent, user-flow, UX, and acceptance-criteria analyst.
- Terra is a read-only architecture, data-flow, affected-path, implementation-sequence, and rollback analyst.
- Sol is a read-only risk, test, edge-case, and adversarial-review analyst.
- Opus is an optional highest-tier advisor when available. It may advise or review but never orchestrates or implements.
- Crew creates and controls task branches and isolated task worktrees, dispatches the approved worker, enforces allowed paths, runs verification, and returns evidence.
- Claude Code / Sonnet is the sole implementation worker and may work only inside the assigned Crew worktree and approved paths.
- n8n may trigger approved workflows but may not bypass Hermes, Crew, capability restrictions, or human approval gates.
- Obsidian stores project state, decisions, tasks, and evidence, but never secrets, credentials, tokens, OAuth material, or PINs.

Luna, Terra, Sol, and Opus remain read-only. Delegation is flat; no delegated child may create
another child. Run only one heavy worker process at a time on this 16 GB machine.

## Planning and Advisory Phase

1. Hermes reads the committed controls, verifies Git state, and classifies risk.
2. Hermes selects only the read-only viewpoints that add value.
3. Hermes reconciles findings into one brief with scope, allowed paths, acceptance criteria, verification, and rollback.
4. Hermes may seek Opus advice when available for difficult, risky, architectural, security-sensitive, cross-cutting, or production-sensitive work.
5. Hermes stops for human approval whenever a required gate is reached.

## Controlled Execution Phase

Automated worker dispatch remains disabled until the capability blockers recorded in
`.hermes.md` and the current authoritative section of `HANDOFF.md` are verified and a human
explicitly enables it.

When execution is authorized and the bridge is enabled:

1. Crew validates the repository, verified baseline, and clean separation from unrelated work.
2. Crew creates a task branch and isolated task worktree from the approved baseline.
3. Crew injects the committed control files, Hermes brief, and task-specific allowed paths.
4. Claude Code / Sonnet implements only inside that worktree and only within allowed paths.
5. Crew records all changes and runs repository-specific verification.
6. Sol compares evidence with acceptance criteria when included in the approved workflow.
7. Opus may review the final diff when available and risk warrants it.
8. Hermes synthesizes the evidence, reports remaining risk and rollback, and stops at the human approval gate.

## Windows Worktree Removal and Cleanup

1. Before removal, every Crew terminal and process must change its current directory outside the target worktree.
2. Use non-force `git worktree remove "<exact-target>"` first.
3. If Git unregisters the worktree but leaves an empty directory, stop; do not clean it automatically.
4. Verify the exact resolved path and parent, zero entries, no `.git`, and no symbolic link, junction, mount point, or reparse point.
5. Obtain explicit human approval before deleting only that exact verified-empty directory.
6. Never use force, `git worktree prune`, wildcards, or recursive raw deletion automatically.

## Human Approval Gates

Explicit human approval is mandatory before:

- Commit.
- Merge or rebase.
- Push.
- Deployment.
- Production, KV, database, permission, binding, configuration, or secret changes.
- Destructive operations.
- Permanent memory or skill promotion.
- Enabling automated worker dispatch.

No documented workflow, n8n trigger, worker result, or advisory recommendation bypasses these gates.
