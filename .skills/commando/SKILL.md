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
>
> **Your critical constraint:** You have no memory between conversations. The `.skills/branches/{branch}/`
> folder IS your memory. If it's not written there, it doesn't exist next time.

---

## Flow

```
Developer says "commando"
        │
        ▼
  Phase 0 ─── Dirty tree? → Stash / Commit / Abandon / Stay
        │
  Phase 1 ─── git checkout develop && git pull
        │
  Phase 2 ─── Branch: new / existing / help me name it
        │
  Phase 3 ─── Type: Feature / Bug / Epic
        │
  Phase 4 ─── Discovery questions (2-3 batched asks)
        │
  Phase 5 ─── Create .skills/branches/{name}/ → 4 files
        │
  Phase 6 ─── Summary → start Task 1
```

---

## Phase 0: Working Tree Triage

```bash
git status --short
```

**If dirty**, ask with `AskUserQuestion`:

| Option | Action |
|--------|--------|
| **Stash** | `git stash push -m "commando-{timestamp}"` |
| **Commit** | Quick commit on current branch, then switch |
| **Abandon** | `git checkout -- .` — confirm twice, destructive |
| **Stay here** | Skip Phase 1, set up commando on current branch |

**If clean**, proceed.

---

## Phase 1: Sync

```bash
git checkout develop && git pull origin develop
```

If `develop` doesn't exist, detect default: `git remote show origin | grep 'HEAD branch' | awk '{print $NF}'`

Pull fails? Stop. Resolve before continuing.

---

## Phase 2: Branch

Ask with `AskUserQuestion`:

| Option | What happens |
|--------|-------------|
| **Existing branch** | `git checkout {name}` → check for `.skills/branches/{name}/`. Exists? Jump to **Resume Protocol**. Doesn't? Run Phase 3-5. |
| **New branch** | Get name → `git checkout -b {name}` |
| **Help me name it** | Do Phase 3-4 first, then suggest `{type}/{kebab-description}` |

Naming convention: `feat/inline-cell-editing`, `fix/calendar-crash`, `epic/automations-v2`

---

## Phase 3: Type

Ask with `AskUserQuestion`:

| Type | When |
|------|------|
| **Feature** | New capability |
| **Bug** | Something broken |
| **Epic** | Large, multi-PR work |

---

## Phase 4: Discovery

**Mandatory.** Batch into 2-3 `AskUserQuestion` calls — never ask 6 questions one at a time.

### Feature
1. What problem does this solve? (user-facing)
2. Who asked for it? (customer / internal / tech debt)
3. Which packages? (SDK / Backend / Frontend / All)
4. Existing codebase pattern to follow?
5. Smallest shippable slice?
6. Known risks or dependencies?

### Bug
1. Expected vs actual behavior
2. Steps to reproduce
3. Which package?
4. Workaround exists?
5. Severity: P0 / P1 / P2 / P3

### Epic
1. What does "done" look like?
2. Major milestones
3. Which packages?
4. Prerequisites or migrations?
5. Stakeholders
6. Rough timeline

### Always ask (all types)
7. Related issues, PRs, Figma, Slack threads?
8. Anything else before I plan?

---

## Phase 5: Create Branch Memory

```bash
mkdir -p .skills/branches/{branch-name}
```

### The 4 Files

```
.skills/branches/{branch-name}/
├── index.md      # READ FIRST — 10-second orientation for Claude
├── context.md    # WHY — discovery answers, immutable after creation
├── plan.md       # WHAT — tasks, status, scope, pre-PR checklist
└── log.md        # WHEN — reverse-chron timeline: actions, decisions, notes
```

Each file has one job. No overlap.

---

### index.md — Claude's Cold Start

**Purpose:** When Claude opens a branch in a new conversation, this is the ONLY file it needs to read to know where it is. It's a dashboard, not a document.

**Structure:**
```markdown
# {branch-name}

> **Type:** Feature | Bug | Epic
> **Status:** In Progress | Review Ready | Blocked
> **Packages:** SDK / Backend / Frontend
> **Created:** {date} from develop @ {short-sha}

## Current Focus
Task {X.Y}: {description}

## Progress
{n}/{total} tasks complete

## Quick Pointers
- Why this exists → context.md
- Full task list → plan.md
- What happened so far → log.md

## Blockers / Open Questions
- {any active blockers, or "None"}
```

**Update rules:**
- Update `Current Focus` every time a task changes
- Update `Progress` count every time a task completes
- Update `Blockers` whenever something is stuck or resolved
- Update `Status` when moving to review or getting blocked

---

### context.md — The Brief

**Purpose:** The developer's words about why this work exists. Written once during discovery. Rarely changed. The source of truth for PR descriptions.

**Structure:**
```markdown
# Context: {branch-name}

## Classification
- **Type:** {Feature | Bug | Epic}
- **Branch:** {branch-name}
- **Base:** develop @ {commit-sha}
- **Date:** {date}

## Discovery
{developer's answers to Phase 4 questions — use their exact words}

## References
- Issue: {link or TBD}
- Figma: {link or TBD}
- Slack: {link or TBD}
- Related PRs: {links or TBD}
```

**Key rule:** Write the developer's answers verbatim. Don't summarize. Their phrasing carries intent.

---

### plan.md — The Work

**Purpose:** Living task list with status. Also contains scope boundaries and pre-PR checklist. This is the file Claude checks to know "what's next."

**Structure:**
```markdown
# Plan: {branch-name}

## Objective
{One sentence: what this PR delivers}

## Tasks

### Phase 1: {name}
- [ ] **1.1** [S] — {description}
- [ ] **1.2** [M] — {description}

### Phase 2: {name}
- [ ] **2.1** [M] — {description}  ← depends on 1.2
- [ ] **2.2** [L] — {description}

### Verify
- [ ] **V.1** [M] — {what to test}
- [ ] **V.2** [S] — Self-review against checklist below

## Scope
**In:** {what's included}
**Out:** {what's deferred — and to where}

## Pre-PR Checklist
- [ ] No console.log / debug artifacts
- [ ] No TODO without linked issue
- [ ] git diff develop...HEAD reviewed — no surprise files
- [ ] Build passes
- [ ] Linter passes
{type-specific items:}
- [ ] {e.g., SDK rebuilt if touched}
- [ ] {e.g., CE/EE separation if backend}
- [ ] {e.g., Loading/error states if frontend}
```

**Task sizes:** `[S]` = < 30 min, `[M]` = 30 min - 2 hrs, `[L]` = 2+ hrs (consider splitting)

**Update rules:**
- Flip `[ ]` → `[x]` when a task completes
- If a task turns out to be wrong, strikethrough and add a replacement — don't silently delete
- If scope changes, update the Scope section and note the change in log.md

---

### log.md — The Timeline

**Purpose:** Reverse-chronological journal of everything that happened. Actions, decisions, blockers, investigations — all in one stream. When it's time to create a PR, this file + context.md writes the PR description.

**Structure:**
```markdown
# Log: {branch-name}

---

## {YYYY-MM-DD HH:MM} — Branch Created
- **Type:** {action}
- Created from develop @ {short-sha}
- Discovery: {one-line summary}

---

{newest entries at the top}
```

**Entry types** (use the `Type` field):

| Type | When |
|------|------|
| `action` | Code written, file created, commit made |
| `decision` | A non-obvious choice was made — include options considered + rationale |
| `investigation` | Explored something — what was found, even dead ends |
| `blocker` | Something is stuck — what, why, possible unblocks |
| `resolved` | A blocker was cleared |
| `scope-change` | Plan was updated — what changed and why |

**Entry format:**
```markdown
## {YYYY-MM-DD HH:MM} — {Title}
- **Type:** {action | decision | investigation | blocker | resolved | scope-change}
- {What happened}
- {Files touched, if any}
- {Commit: short-sha, if any}
- {Rationale or notes}
```

**Key rule:** Log even when nothing productive happened. "Investigated X, dead end because Y" is gold for the next session.

---

## Phase 6: Launch

Present:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  COMMANDO READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Branch:  {branch-name}
  Type:    {Feature|Bug|Epic}
  Scope:   {packages}
  Tasks:   {n} planned
  Memory:  .skills/branches/{branch-name}/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask: **"Ready to start on Task 1, or review the plan first?"**

---

## Resume Protocol

**The most important section.** This is what makes commando useful across conversations.

### When a developer mentions or switches to a branch:

```bash
ls .skills/branches/{branch-name}/ 2>/dev/null
```

### Memory exists → Resume

1. **Read index.md** — get oriented in 10 seconds
2. **Read plan.md** — see full task list and what's next
3. **Skim log.md** (last 3-5 entries) — understand recent context
4. (Only read context.md if you need to understand the "why" again)
5. **Present:**
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     COMMANDO RESUMED
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Branch:   {branch-name}
     Progress: {n}/{total} tasks
     Next:     Task {X.Y} — {description}
     Last:     {last log entry summary}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```
6. **Ask:** "Pick up where we left off?"

### Memory doesn't exist → Retrofit

"This branch doesn't have commando memory. Want me to set it up? Quick discovery — 2-3 questions."

Run Phase 3-5.

---

## PR Creation Protocol

When the developer says "create PR" or "ready for PR":

1. Walk `plan.md` checklist — check off or note deferrals
2. Run `git diff develop...HEAD` — flag surprise files
3. Build PR from sources:
   - **Title:** from plan.md objective
   - **Body:** context.md (the why) + log.md (the what changed) + checklist status
4. Use `gh pr create` with the assembled description

---

## Integration with Domain Skills

Commando orchestrates — domain skills have the patterns:

| Plan involves | Read |
|--------------|------|
| Backend | `.skills/nocohub-backend/SKILL.md` |
| Frontend | `.skills/nocohub-frontend/SKILL.md` |
| Multi-package | `.skills/compound-engineering/SKILL.md` |
| Automations | `.skills/nocohub-automations/SKILL.md` |
| CE/EE sync | `.skills/nocohub-sync/SKILL.md` |

Read during Phase 5 when generating the plan.

---

## Edge Cases

| Situation | Handle |
|-----------|--------|
| Network down during pull | Use local develop, note in log.md base may be stale |
| Branch exists locally + remote | Ask: use local or reset to remote? |
| Plan changes mid-flight | Update plan.md, log the scope-change in log.md |
| "commando" on managed branch | Treat as resume |
| Multiple devs, same branch | Memory is local (gitignored) — each dev has their own |
| Developer provides a GitHub issue URL | Pull title + description into context.md references |

---

## Anti-Patterns

- **Don't skip discovery.** 2-line description → 200-line wrong fix.
- **Don't let plan.md go stale.** Reality changed? Update the plan.
- **Don't commit branch memory.** `.skills/branches/` is gitignored.
- **Don't create memory without discovery.** Context drives the files.
- **Don't assume context from previous conversations.** If it's not in the 4 files, you don't know it.
- **Don't read all 4 files on resume.** Read index.md first. It tells you what else you need.
