---
name: nc-pr
description: Start or resume a feature/bug/epic branch with PR lifecycle management
---

# nc-pr — PR Lifecycle

Branch memory lives in `.claude/branches/{branch}/`. If it's not written there, it doesn't exist next session.

## Flow

```
/nc-pr
  → Phase 0: Dirty tree? → Stash / Commit / Abandon / Stay
  → Phase 1: git checkout develop && git pull
  → Phase 2: Branch — new / existing / help me name it
  → Phase 3: Type — Feature / Bug / Epic
  → Phase 4: Discovery (2-3 batched AskUserQuestion calls)
  → Phase 5: Create .claude/branches/{name}/ with 4 files
  → Phase 6: Summary → start Task 1
```

## Phase 0: Working Tree Triage

Run `git status --short`. If dirty, ask with `AskUserQuestion`:

| Option | Action |
|--------|--------|
| Stash | `git stash push -m "nc-pr-{timestamp}"` |
| Commit | Quick commit on current branch, then switch |
| Abandon | `git checkout -- .` — confirm twice |
| Stay here | Skip Phase 1, set up on current branch |

## Phase 1: Sync

```bash
git checkout develop && git pull origin develop
```

## Phase 2: Branch

Ask with `AskUserQuestion`: existing branch, new branch, or help me name it.

- Existing → check `.claude/branches/{name}/`. Exists? **Resume Protocol**. Doesn't? Run Phase 3-5.
- New → `git checkout -b {type}/{kebab-description}`
- Help → do Phase 3-4 first, then suggest name

## Phase 3: Type

Feature / Bug / Epic — ask with `AskUserQuestion`.

## Phase 4: Discovery

Batch into 2-3 `AskUserQuestion` calls — never ask one at a time.

**Feature:** Problem? Who asked? Which packages? Pattern to follow? Smallest slice? Risks?
**Bug:** Expected vs actual? Reproduce steps? Package? Workaround? Severity?
**Epic:** Definition of done? Milestones? Packages? Prerequisites? Stakeholders?
**All types:** Related issues/PRs/Figma? Anything else?

## Phase 5: Create Branch Memory

```bash
mkdir -p .claude/branches/{branch-name}
```

Create 4 files using templates in [templates/](templates/):

| File | Purpose | Template |
|------|---------|----------|
| `index.md` | 10-second orientation dashboard for Claude | [templates/index.md.tpl](templates/index.md.tpl) |
| `context.md` | Discovery answers — written once, verbatim | [templates/context.md.tpl](templates/context.md.tpl) |
| `plan.md` | Living task list + scope + pre-PR checklist | [templates/plan.md.tpl](templates/plan.md.tpl) |
| `log.md` | Reverse-chronological timeline | [templates/log.md.tpl](templates/log.md.tpl) |

Task sizes: `[S]` < 30 min, `[M]` 30 min - 2 hrs, `[L]` 2+ hrs (consider splitting).

## Phase 5b: API Walkthrough Phase (Backend Features)

When the plan includes backend API work, add a verification phase to `plan.md`:

```markdown
### Phase V: API Verification
- [ ] **V.1** [S] — Ensure backend running in EE mode
- [ ] **V.2** [M] — Delegate to nc-api-verifier agent: build and run verification script
- [ ] **V.3** [S] — Fix failures, re-delegate until all pass
- [ ] **V.4** [S] — Log walkthrough results in log.md
```

The `nc-api-verifier` agent builds/updates `.claude/branches/{branch}/test.ts` and runs it via `npx tsx`. It imports directly from the `nocodb-dev-api` skill's API library — no external dependencies needed. Pass a brief describing which endpoints and roles to test.

## Phase 6: Launch

Summarize branch, type, scope, task count, memory path. Ask: "Ready to start Task 1, or review the plan first?"

## Resume Protocol

When a developer mentions or switches to a branch:

```bash
ls .claude/branches/{branch-name}/ 2>/dev/null
```

**Memory exists:**
1. Read `index.md` — orient in 10 seconds
2. Read `plan.md` — what's next
3. Skim last 3-5 entries in `log.md`
4. Present: branch, progress (n/total), next task, last action
5. Ask: "Pick up where we left off?"

**No memory:** "This branch doesn't have branch memory. Want me to set it up?" → Run Phase 3-5.

## PR Creation

When developer says "create PR":

1. Walk `plan.md` checklist
2. Run `git diff develop...HEAD` — flag surprises
3. Build PR: title from plan.md objective, body from context.md + log.md
4. `gh pr create`

## Domain Knowledge

Package CLAUDE.md files auto-load when touching those packages. For specialized domains:
- Automations: `.claude/skills/nocohub-automations/SKILL.md`
- Sync: `.claude/skills/nocohub-sync/SKILL.md`

## Rules

- Don't skip discovery
- Don't let plan.md go stale — update when reality changes
- Don't commit branch memory (`.claude/branches/` is gitignored)
- Don't assume context from previous conversations — if it's not in the 4 files, you don't know it
- On resume, read index.md first — it tells you what else you need
- After completing a task, check it off directly in plan.md — don't delegate for a single checkbox
- At session end, delegate to `nc-memory` for log entry, progress count, and any missed updates
