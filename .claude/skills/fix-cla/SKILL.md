---
name: fix-cla
description: Rewrite commits from an unsigned/unknown author to the current git user to fix CLA failures on PRs
---

# fix-cla — CLA Author Rewrite

Fixes CLA check failures caused by commits from authors who haven't signed the CLA. Accepts a **GitHub username** (as shown by the CLA bot) or an **email address**. Rewrites those commits to use the current git user's identity.

## Invocation

```
/fix-cla
/fix-cla ncRaju
/fix-cla ncRaju feat/my-branch
/fix-cla raju@nocodb.com
/fix-cla raju@nocodb.com feat/my-branch
```

- No args → defaults to `ncRaju` (the most common unsigned author)
- First arg → **GitHub username** (e.g. `ncRaju`) OR an **email** (e.g. `raju@nocodb.com`)
- Second arg → the branch to fix (default: current branch)

## Arg Resolution

Before doing anything else, determine whether arg 1 is a username or an email:

```
if arg1 contains "@"  →  it is an email  →  TARGET_EMAIL = arg1
else                  →  it is a username →  resolve to email (see below)
```

**Resolving a username to email:**

A GitHub username like `ncRaju` does not appear directly in git commits — git stores the author's **name** and **email**. The CLA bot derives its username from the commit email.

Run this to find all emails used by commits whose author name resembles the username (case-insensitive, partial match):

```bash
USERNAME="${1:-ncRaju}"
FORK_POINT=$(git merge-base HEAD origin/develop)
git log --format="%an <%ae>" ${FORK_POINT}..HEAD \
  | sort -u \
  | grep -i "${USERNAME}"
```

This may return zero, one, or multiple matches. Handle each case:

- **0 matches** — widen search: try matching just the first 4+ chars of the username against author names, and also try searching by `nc`-stripped version (e.g. `ncRaju` → `Raju`):
  ```bash
  STRIPPED=$(echo "${USERNAME}" | sed 's/^nc//')
  git log --format="%an <%ae>" ${FORK_POINT}..HEAD | sort -u | grep -i "${STRIPPED}"
  ```
- **1 match** — use that email automatically, report it to the user
- **2+ matches** — show all matches and use `AskUserQuestion` to let the user pick which email(s) to rewrite

If no match is found after widened search, report the names + emails of ALL unique authors on the branch and ask the user to identify which one matches the CLA username.

Once resolved, set `TARGET_EMAIL` and proceed.

## Flow

```
/fix-cla
  → Phase 0: Resolve arg (username → email, or use email directly)
  → Phase 1: Detect current branch + compute fork point
  → Phase 2: Find unsigned commits (filter by TARGET_EMAIL)
  → Phase 3: Show summary, ask for confirmation
  → Phase 4: Create backup branch, rewrite with git filter-branch
  → Phase 5: Verify fork point preserved + results
  → Phase 6: Remind to force push
```

## Phase 1: Detect Branch + Fork Point

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
```

If an explicit branch was passed as arg 2, checkout that branch first.

**CRITICAL — always use the actual fork point as the rewrite range, not `develop..HEAD`.**

Using `develop..HEAD` is dangerous: if any TARGET_EMAIL commits were merged into develop before the branch was rebased, they exist in BOTH develop and the branch. Rewriting them (changing their SHA) breaks the shared history, shifting the fork point far back and causing a massive PR diff explosion.

```bash
FORK_POINT=$(git merge-base HEAD origin/develop)
```

## Phase 2: Find Unsigned Commits

```bash
git log --format="%h %an <%ae> %s" ${FORK_POINT}..HEAD | grep "${TARGET_EMAIL}"
```

Count the matches. If 0 → report "No commits from ${TARGET_EMAIL} found on this branch. CLA should be clean." and stop.

Also get current user identity:

```bash
CURRENT_NAME=$(git config user.name)
CURRENT_EMAIL=$(git config user.email)
```

## Phase 3: Confirm

Show the user:

- Branch being fixed
- Resolved target: `{name} <{TARGET_EMAIL}>` (include original username arg if it was a username)
- Replacement identity: `{CURRENT_NAME} <{CURRENT_EMAIL}>`
- Number of commits to rewrite
- First 5 commit subjects

Use `AskUserQuestion` with options:

- **Rewrite commits (local only)** — proceed, no push
- **Cancel** — abort

## Phase 4: Backup + Rewrite

Create a backup branch before touching anything:

```bash
git branch ${BRANCH}-backup-pre-cla $(git rev-parse HEAD)
```

Clear any leftover filter-branch backup refs:

```bash
git for-each-ref --format="%(refname)" refs/original/ \
  | while read ref; do git update-ref -d "$ref"; done
```

Rewrite using `FORK_POINT..HEAD`:

```bash
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --env-filter "
if [ \"\$GIT_AUTHOR_EMAIL\" = \"${TARGET_EMAIL}\" ]; then
    export GIT_AUTHOR_NAME=\"${CURRENT_NAME}\"
    export GIT_AUTHOR_EMAIL=\"${CURRENT_EMAIL}\"
fi
if [ \"\$GIT_COMMITTER_EMAIL\" = \"${TARGET_EMAIL}\" ]; then
    export GIT_COMMITTER_NAME=\"${CURRENT_NAME}\"
    export GIT_COMMITTER_EMAIL=\"${CURRENT_EMAIL}\"
fi
" -- ${FORK_POINT}..HEAD
```

## Phase 5: Verify

After rewrite, confirm the fork point is unchanged:

```bash
NEW_FORK=$(git merge-base HEAD origin/develop)
```

If `NEW_FORK != FORK_POINT` → something went wrong. Warn the user and suggest restoring from the backup branch.

Also confirm no ncRaju commits remain and show the diff stat:

```bash
git log --format="%h %an <%ae>" ${NEW_FORK}..HEAD | sort -u
git log --format="%an <%ae>" ${NEW_FORK}..HEAD | grep "${TARGET_EMAIL}" | wc -l
git diff --stat ${NEW_FORK}..HEAD | tail -3
```

## Phase 6: Remind to Push

Output a clear message:

```
✅ Done. All commits from <original arg> (<TARGET_EMAIL>) have been rewritten to <CURRENT_NAME> <CURRENT_EMAIL>.
   Backup preserved at: {BRANCH}-backup-pre-cla

Since history was rewritten, force push is required:

  git push origin {BRANCH} --force-with-lease

After pushing, trigger the CLA bot to re-check by posting a comment on the PR:
  @cla-assistant recheck
```

## Rules

- **Always use `FORK_POINT..HEAD` (merge-base), never `develop..HEAD`** — this is the most critical rule
- Always create a backup branch before rewriting
- Never push automatically — always leave that to the user
- Always clear `refs/original/` backup refs before running `filter-branch`
- After rewrite, always verify the fork point didn't change — if it did, the rewrite was wrong
- If `git filter-branch` fails, report the error and suggest using `git filter-repo` as an alternative
- If the branch is `develop` or `main`, refuse and explain why
