---
name: commando
description: |
  Claude PR Management — full lifecycle branch orchestration.
  MANDATORY TRIGGERS: commando, new pr, start pr, branch setup, pr management, new feature branch, start working on
  Use when: A developer says "commando" or wants to start working on a new feature/bug/epic from scratch with full PR lifecycle management.
---

# Claude Commando — PR Lifecycle Management

> You are a staff-level engineering copilot. Your job is to set up a developer for success
> on a new branch by gathering context, planning work, and maintaining a living working
> memory throughout the PR lifecycle.

## Trigger

When a developer says **"commando"** (or any trigger phrase above), execute the phases below **in strict order**. Do not skip phases. Do not rush. Ask questions — the 5 minutes spent here saves 5 hours later.

---

## Phase 0: Working Tree Triage

Before anything, check if the developer has uncommitted work.

```bash
git status --short
```

**If the working tree is dirty**, present these options using `AskUserQuestion`:

| Option | What it does |
|--------|-------------|
| **Stash it** | `git stash push -m "commando-{timestamp}"` — saves work, clean slate |
| **Commit it** | Quick commit on current branch before switching |
| **Abandon it** | `git checkout -- .` — ⚠️ destructive, confirm twice |
| **Stay here** | Don't switch branches — set up commando on the *current* branch |

**If the working tree is clean**, proceed to Phase 1.

---

## Phase 1: Sync with Develop

```bash
git checkout develop
git pull origin develop
```

If `develop` is not the default branch, detect it:
```bash
git remote show origin | grep 'HEAD branch' | awk '{print $NF}'
```

Confirm success before moving on. If pull fails (conflicts, auth), stop and help resolve.

---

## Phase 2: Branch Identity

Ask the developer using `AskUserQuestion`:

**"Do you have a branch name in mind?"**

| Option | Behavior |
|--------|----------|
| **Yes, existing branch** | `git checkout {name}` — rehydrate from `.skills/branches/{name}/` if it exists |
| **Yes, new branch** | Ask for the name, then `git checkout -b {name}` |
| **No, help me name it** | Gather info first (Phase 3), then suggest a name using convention below |

### Branch Naming Convention

```
{type}/{short-description}
```

Examples:
- `feat/inline-cell-editing`
- `fix/calendar-view-crash`
- `epic/automations-v2`

---

## Phase 3: Work Type Classification

Ask using `AskUserQuestion`:

**"What type of work is this?"**

| Type | Description |
|------|-------------|
| **Feature** | New capability that doesn't exist yet |
| **Bug** | Something is broken and needs fixing |
| **Epic** | Large body of work, likely multiple PRs |

---

## Phase 4: Discovery Questions

Based on the work type, ask targeted discovery questions. These are **not optional** — they populate `context.md` and drive the plan.

### If Feature:

1. **What problem does this solve?** (user-facing description)
2. **Who asked for it?** (customer, internal, tech debt)
3. **Which packages will this touch?** (SDK / Backend / Frontend / All)
4. **Is there an existing pattern in the codebase we should follow?** (similar feature to reference)
5. **What's the smallest shippable slice?** (MVP scope)
6. **Any known risks or dependencies?** (external APIs, migrations, etc.)

### If Bug:

1. **What's the expected behavior?**
2. **What's the actual behavior?**
3. **Steps to reproduce?**
4. **Which package is likely affected?** (Backend / Frontend / SDK)
5. **Is there a workaround currently?**
6. **Severity?** (P0-blocker / P1-high / P2-medium / P3-low)

### If Epic:

1. **What's the north star outcome?** (what does "done" look like)
2. **What are the major milestones?** (break it into phases)
3. **Which packages will this touch?** (SDK / Backend / Frontend / All)
4. **Are there any prerequisites or migrations?**
5. **Who are the stakeholders?**
6. **What's the rough timeline?**

---

## Phase 5: Create Branch Working Memory

Create the folder `.skills/branches/{branch-name}/` and populate it from templates.

```
.skills/branches/{branch-name}/
├── plan.md          # What we're building, broken into tasks
├── context.md       # All discovery answers, scope, type classification
├── changelog.md     # Timestamped log of every significant action
├── decisions.md     # ADR-lite: what we chose and why
├── checklist.md     # Pre-PR quality gate
└── artifacts/       # Scratch space for diffs, notes, diagrams
```

### File Population Rules

1. **context.md** — Populate immediately from Phase 3 + 4 answers. This is the source of truth for "why are we doing this?"

2. **plan.md** — After discovery, generate a task breakdown:
   - Read relevant skill files (`.skills/nocohub-backend/SKILL.md`, etc.) based on which packages are involved
   - Break work into numbered tasks with clear scope
   - Each task should be completable in one sitting
   - Mark dependencies between tasks
   - Include estimated complexity: `[S]` / `[M]` / `[L]`

3. **changelog.md** — Add the first entry:
   ```
   ## {date} — Branch Created
   - Type: {Feature|Bug|Epic}
   - Branch: {branch-name}
   - Created from: develop @ {commit-sha}
   ```

4. **decisions.md** — Leave empty with header. Populate as decisions arise during development.

5. **checklist.md** — Pre-populate based on work type and packages involved.

---

## Phase 6: Confirm & Launch

Present a summary to the developer:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  COMMANDO READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Branch:  {branch-name}
  Type:    {Feature|Bug|Epic}
  Scope:   {packages involved}
  Tasks:   {count} tasks planned
  Memory:  .skills/branches/{branch-name}/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask: **"Ready to start on Task 1, or want to review/adjust the plan first?"**

---

## Ongoing: Living Memory Protocol

While working on the branch, Claude should **continuously maintain** the branch working memory:

### After every significant action:
- Append to `changelog.md` with timestamp and what was done
- Update `plan.md` task status: `[ ]` → `[x]`

### When a design choice is made:
- Add entry to `decisions.md` with context, options considered, and rationale

### Before creating PR:
- Walk through `checklist.md` item by item
- Ensure all tasks in `plan.md` are complete or explicitly deferred
- Generate a PR description from `context.md` + `changelog.md`

### When resuming work on an existing branch:
- Read all files in `.skills/branches/{branch-name}/`
- Present current status: completed tasks, next task, open decisions
- Ask: "Pick up where we left off?"

---

## Template Reference

Templates live in `.skills/commando/templates/`. When creating a new branch folder, read these templates and populate them with the gathered context. Do not copy them verbatim — adapt them to the specific branch.

---

## Integration with Existing Skills

Commando doesn't replace domain skills — it orchestrates them:

| When plan involves... | Also read... |
|----------------------|-------------|
| Backend work | `.skills/nocohub-backend/SKILL.md` |
| Frontend work | `.skills/nocohub-frontend/SKILL.md` |
| Multi-package changes | `.skills/compound-engineering/SKILL.md` |
| Automation nodes | `.skills/nocohub-automations/SKILL.md` |
| CE/EE sync concerns | `.skills/nocohub-sync/SKILL.md` |

---

## Anti-Patterns

- **Don't skip discovery.** A 2-line bug description leads to a 200-line wrong fix.
- **Don't let plan.md go stale.** If the plan changes, update the plan.
- **Don't commit branch memory.** `.skills/branches/` is gitignored for a reason — it's Claude's scratchpad, not a deliverable.
- **Don't create the branch folder without discovery.** The whole point is that context populates the memory.
- **Don't work on two tasks simultaneously.** Finish one, log it, move to the next.
