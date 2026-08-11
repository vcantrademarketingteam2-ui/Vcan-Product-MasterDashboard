# V-Can Dashboard Handoff for Claude

Last updated: 2026-08-11 (Asia/Bangkok)

## Current Authoritative Control State — 2026-08-11

This section records current control-plane state under `.hermes.md`. `MISSION.md` defines the
controlled execution workflow, and `CLAUDE.md` defines implementation-specific repository rules.
Git and actual source files are authoritative for repository state and implementation facts.

- Repository: `D:\Project Vcan Dashboard\vcan-dashboard`
- Baseline branch: `baseline/agentic-os-2026-07-23`
- Application/source baseline: `c1f00961689808d25515cd1b18a68bb13ed2b762`
- Initial control-plane baseline: `ffd69bcfe575639f0030e023774408cf3f9f4b2f`
- Execution base: the current verified full `HEAD` recorded immediately before each approved task begins.
- Control-file tracking: `.hermes.md`, `CLAUDE.md`, `MISSION.md`, and `HANDOFF.md` are tracked and committed in the current baseline.
- Control-plane reconciliation baseline commit: `68839b6b34b3870e6f9af520b9e94f7bdd6f30e3`.
- Last verified HEAD before this documentation reconciliation: `439c41f90c6ed39a6607dd55f03618d5763119b6`.
- Current tracked application behavior remains the `v3.10.5` masonry category layout.
- The Branch Navigator with Mini Capsules localhost-only prototype/presentation was completed on 2026-08-04. It remains proposal-only; it was not committed, merged, pushed, deployed, or counted as the one-shot pilot.
- On 2026-08-05, Hermes inspected the state and generated a work report only; no additional implementation was performed.
- Production has not been checked or deployed.
- Delegation safety verified: one flat Luna child was created; nested delegation was unavailable and blocked.
- Claude Code connection verified: authenticated one-turn inference succeeded and reported model `claude-sonnet-5`.
- Worktree isolation verified: a manual detached worktree was created from the baseline, verified clean and detached, and removed from Git registration.
- Windows cleanup recovery verified: the leftover unregistered empty directory was inspected for exact path, parent, emptiness, `.git`, and reparse/link safety, then deleted only after explicit human approval.
- The end-to-end smoke run `product-master-crew-smoke-20260811-final02` succeeded from verified
  `HEAD` `b4a9fbed63d6a96796f03cc890088fa3c2c89f8c`: Crew created one detached worktree,
  invoked Claude exactly once, created only the authorized documentation artifact, passed the
  allowlist, and preserved the source and every pre-existing worktree.
- The Windows PowerShell 5.1 inline MCP JSON transport defect was fixed by passing the absolute
  `D:\Agentic OS\crew\empty-mcp-config.json` path. Parser and regression checks passed.
- Product-local Crew routing is enabled through
  `D:\Agentic OS\crew\Invoke-ProductMasterCrew.ps1`. Hermes may run from this repository, but
  implementation must use the launcher after a fresh explicit approval; direct source edits and
  direct Claude invocation remain prohibited.
- Multi-file allowlists now cross the Bash/Windows PowerShell boundary through one
  `-AllowedWritePathsFile` JSON manifest. Direct arrays, repeated parameters, and comma-joined paths
  are prohibited. Regression evidence confirms two POSIX paths remain distinct without creating a
  worktree or invoking Claude.
- Worker turn budgets are task-specific through bounded `-MaxTurns` (1-40); the global default
  remains unchanged. The controller's former smoke-specific “documentation artifact” completion
  sentence was replaced with a generic approved-brief completion boundary.
- The failed combined Timeline/Pills and two-file Timeline briefs are superseded. Timeline JSX and
  CSS are separate sequential tasks. The existing uncommitted Brand Navigator worktree must be
  reviewed and promoted explicitly; a fresh worker cannot see or infer its uncommitted diff.
- `D:\Agentic OS\crew\Get-ProductMasterReleaseReadiness.ps1` is the mandatory read-only structural
  gate before commit/integration/push requests. It does not replace build, test, browser, human, or
  deployment approval gates.
- These four control documents must be committed together before their routing state is present in
  newly created Crew worktrees.

### Communication-contract resolution — 2026-08-11

The earlier smoke failures were control-plane transport and harness defects, not an application,
Claude authentication, network, model-access, or Obsidian outage. The final successful run proved
the corrected invocation and communication contract end to end.

The binding contract is explicit: Crew passes one structured authorization record plus the
complete approved brief in the worker invocation. The record is approval evidence for that single
attempt; no second approval file is required in the worktree. Obsidian is Hermes-only context and
never a worker instruction source. Missing authorization or a missing brief is a hard
`missing_crew_authorization` stop.

For the next implementation request, Hermes should operate from the Product Master folder, create
one central Crew brief, request approval for its exact allowlist, and invoke the Product Master
launcher. Commit, merge, push, deployment, retry, and worktree cleanup remain separate gates.

## Historical Evidence Notice

All release, version, branch, deployment, verification, and role-state reports below are
historical evidence from earlier audits. They must be reverified against Git and actual source
files before use. They are not current control authority, and their original claims have not
been rewritten to appear current.

## Historical Agentic OS Control Snapshot — 2026-07-31

- Hermes is the sole orchestrator, powered by the OpenAI Codex driver.
- Hermes directs the read-only Codex Thinking Council: Luna, Terra, and Sol.
- Opus 5 is the highest-tier advisor for difficult or risky work.
- Crew owns isolated worktrees and controlled execution.
- Claude Code / Sonnet is the sole implementation worker.
- Human approval is required for commit, merge, push, and deployment.
- Automated Crew, Claude, and Opus dispatch is not operational until the bridges are verified.
- Dated Fable and older model-role references below are historical records, not current instructions.

The current binding workflow is `.hermes.md`, `MISSION.md`, and the Obsidian Agentic Development Workflow.

## Historical Release State — Reported 2026-07-20

- Current application version: **v3.8.0** in both `package.json` and the visible badge in `src/App.jsx`.
- Current commit: `9c3af8d3f29f1528171c2451af45a5b3c50f7e81` (`feat: v3.8.0 - logo pill redesign (Bare Tile retailer + Marquee Capsule brand)`).
- Branch: `main`; it matches the locally known `origin/main` ref. No remote fetch or production deployment check was performed during the 2026-07-20 audit.
- The tracked application tree is clean. There is no Git stash.

## Historical Completed Work Report

- **v3.8.0:** retailer filters redesigned as Bare Tile pills; brand filters redesigned as Marquee Capsules.
- **v3.7.0:** real brand logos wired into `BrandPill`; retailer logo assets and display behavior corrected.
- **v3.6.x:** shared `BrandPill`, category-header overlap fix, retailer white-border/contrast-plate fix, and removal of BrandPill from Packshot gallery cards.
- **v3.5.0:** Promotion Plan Timeline overhaul; NOW marker, month grid, and bars share one percentage coordinate system.
- Earlier integrated work includes the Promotion Plan, analytics redesign, per-retailer status cards, mobile behavior, promo-alert bell, LINE cron Worker, Villa date/branch/discontinued handling, and expanded notification date parsing.

## Historical Repository-Boundary Record

The following paths were already untracked at the 2026-07-20 audit. Treat them as user/project work; do not delete, overwrite, stage, or fold them into another task unless the user explicitly approves it:

- `AI's Office/` — Codex project memory and work log.
- `MISSION.md` — local multi-agent role/workflow notes.
- `docs/superpowers/specs/2026-07-13-retailer-glow-codex-brief.md`.
- `public/assets/generated/` — retailer-glow brief and 12 generated transparent retailer-logo copies.

There was no root `HANDOFF.md` before this update, and `.agents/AGENTS.md` is also absent.

## Historical Verification Evidence — 2026-07-20

- `npm.cmd run build` — **passed** with Vite 8.0.12.
  - Main generated JS chunk: approximately 677.55 kB before gzip / 129.24 kB gzip.
  - Vite emitted a non-blocking warning that the chunk exceeds 500 kB.
- `node --test test/promoAlerts.test.mjs` — **passed, 4/4 tests**.
- Python 3.14 `test_convert_promo.py` — **passed (`OK`)**.
- `npx.cmd eslint src worker test` — **failed with 40 errors and 1 warning**.
  - Main categories: unused imports/variables, React components declared during render, synchronous state update in an effect, empty blocks, unnecessary regex escapes, one missing `useMemo` dependency set, and unused Worker `ctx`.
  - `npm.cmd run lint` is noisier because ESLint also scans `backups/`; do not mistake backup-file errors for current-source regressions.
- The production build updated ignored `dist/` output only; tracked Git status remained unchanged.

## Historical Open Items and Known Risks

1. **Lint debt:** the app builds, but lint is not clean. If fixing it, preserve behavior and split the cleanup into focused changes; follow the backup and version rules in `CLAUDE.md`.
2. **Documentation drift:** `AI's Office/Codex's work/PROJECT_MEMORY.md` still reports v3.6.3 and `CLAUDE.md` version history stops at v3.5.0. Git and source are authoritative for the current v3.8.0 state.
3. **Retailer ambient glow:** the untracked July brief requests a per-retailer ambient neon glow, but the current v3.8.0 `RetailerLogo` does not implement it. The generated transparent copies are not used by the app. Confirm the user still wants this before implementing; preserve `objectFit: 'contain'` and the existing theme-specific contrast plates.
4. **Promo source-data coverage:** Foodland, Boots, and most Big C periods still lack usable activity/date data in the upstream Excel sources. This limits LINE/bell schedule coverage and cannot be solved reliably by inventing parser values.
5. **Timeline minor follow-ups:** existing notes mention small NOW-line gaps at brand headers and edge clamping when today is outside the displayed range. These are not build blockers.
6. **Deployment:** no Cloudflare deploy, secret mutation, production KV change, commit, or push was performed during this audit. Verify production separately before claiming v3.8.0 is live.

## Historical Rules for the Next Claude Session

1. Read `CLAUDE.md`, `MISSION.md`, this handoff, and the applicable spec before changing code.
2. Re-run `git status` and preserve the pre-existing untracked paths listed above.
3. Back up every existing target file to `backups/<YYYYMMDD_HHmmss>/` before editing.
4. For an application change, keep the `src/App.jsx` badge and `package.json` version synchronized.
5. Regenerate derived data after changing a parser or its source data.
6. Validate with focused tests, `npm.cmd run build`, and desktop/mobile plus dark/light checks for UI changes.
7. Do not commit, push, deploy, set Cloudflare secrets, or change production state without explicit user approval.

## 2026-07-20 — Handoff update

- Created this root handoff because none existed.
- Source changes: `HANDOFF.md` only; no application code changed.
- Backup: not applicable because the target file was new.
- Generated artifacts: none.
- Compatibility behavior: unchanged.
- Verification: confirmed current version/commit/status and recorded the successful build, JavaScript tests, Python test, and existing lint failures from the audit above.
