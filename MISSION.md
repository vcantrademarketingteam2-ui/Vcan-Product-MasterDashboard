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

Product-local Crew routing is enabled through
`D:\Agentic OS\crew\Invoke-ProductMasterCrew.ps1`. Hermes may run from the Product Master folder,
but all write-capable implementation must follow this sequence:

1. Hermes verifies Git state, creates one complete task brief, and proposes exact allowed paths.
2. The human explicitly approves one sequential attempt. The approval is consumed when dispatch
   begins and never authorizes a retry.
3. Hermes stores the approved brief under `D:\Agentic OS\crew\briefs` and invokes the launcher
   with `-HumanApproved`; it never invokes Claude or edits application files directly.
4. The launcher captures the current full source `HEAD` and delegates to Crew.
5. Crew validates the source and existing worktrees, creates one isolated detached worktree, and
   injects the complete brief plus a structured authorization record.
6. Claude Code / Sonnet implements only in that worktree and only within the exact allowlist.
7. Crew captures structured output, enforces changed and staged paths, and proves that the source
   repository and all pre-existing worktrees were preserved.
8. Hermes synthesizes the evidence and stops before commit, merge, push, deployment, retry, or
   cleanup unless the human separately authorizes the next gated action.

Obsidian remains optional Hermes context. It is not copied to the worker, is not an authorization
source, and cannot override the committed controls, the approved brief, Git, or actual source files.

## Windows Worktree Removal and Cleanup

1. Before removal, every Crew terminal and process must change its current directory outside the target worktree.
2. Use non-force `git worktree remove "<exact-target>"` first.
3. If Git unregisters the worktree but leaves an empty directory, stop; do not clean it automatically.
4. Verify the exact resolved path and parent, zero entries, no `.git`, and no symbolic link, junction, mount point, or reparse point.
5. Obtain explicit human approval before deleting only that exact verified-empty directory.
6. Never use force, `git worktree prune`, wildcards, or recursive raw deletion automatically.

Rollback or cleanup may begin only after separate destructive-action approval. Only non-force
`git worktree remove` is permitted; `--force`, `git worktree prune`, wildcards, and recursive raw
deletion are prohibited.

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
