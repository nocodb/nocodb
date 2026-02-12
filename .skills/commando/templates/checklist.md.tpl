# Pre-PR Checklist: {branch-name}

> Walk through every item before creating the PR.
> Items are auto-populated based on work type and packages involved.

## Universal Gates

- [ ] All tasks in `plan.md` are complete or explicitly deferred with rationale
- [ ] No `console.log` / debug artifacts left in code
- [ ] No `TODO` or `FIXME` added without a linked issue
- [ ] `changelog.md` is up to date
- [ ] PR description drafted from `context.md` + `changelog.md`

## Type-Specific

### If Feature:
- [ ] Happy path works end-to-end
- [ ] Edge cases identified and handled (empty state, error state, loading state)
- [ ] Feature flag or rollback strategy considered
- [ ] Backwards compatible (no breaking changes to existing API)

### If Bug:
- [ ] Root cause identified and documented in `decisions.md`
- [ ] Fix addresses root cause, not just symptom
- [ ] Regression test added or manual test documented
- [ ] Verified the fix doesn't break adjacent features

### If Epic:
- [ ] This PR is a clean, self-contained slice
- [ ] No half-built features exposed to users
- [ ] Next steps documented for follow-up PRs

## Package-Specific

### If SDK touched:
- [ ] Types are accurate and exported
- [ ] SDK rebuilt: `cd packages/nocodb-sdk && pnpm run build:ee`
- [ ] API client methods match backend endpoints

### If Backend touched:
- [ ] CE/EE separation respected (no EE imports in CE code)
- [ ] Proper guards and ACL decorators applied
- [ ] Database migrations are reversible
- [ ] Service methods have proper error handling

### If Frontend touched:
- [ ] Component follows existing patterns (check `.skills/nocohub-frontend/`)
- [ ] Responsive / mobile considerations
- [ ] Loading and error states handled
- [ ] No hardcoded strings (i18n ready)
- [ ] Accessibility basics (keyboard nav, aria labels)

## Final Sanity

- [ ] `git diff develop...HEAD` reviewed — no surprise files
- [ ] Build passes locally
- [ ] Linter passes
- [ ] Commit history is clean and meaningful
