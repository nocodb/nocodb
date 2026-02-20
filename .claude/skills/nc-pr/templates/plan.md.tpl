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

### Phase V: Verify
- [ ] **V.1** [M] — {what to test}
- [ ] **V.2** [S] — Self-review against checklist below
{If backend API work, add:}
- [ ] **V.3** [M] — Build API test script (.claude/branches/{branch}/test.ts), run against live backend
- [ ] **V.4** [S] — Fix failures, re-run until all pass
- [ ] **V.5** [S] — Log walkthrough results in log.md

## Scope
**In:** {what's included}
**Out:** {what's deferred — and to where}

## Pre-PR Checklist
- [ ] No console.log / debug artifacts
- [ ] No TODO without linked issue
- [ ] git diff develop...HEAD reviewed — no surprise files
- [ ] Build passes
- [ ] Linter passes
