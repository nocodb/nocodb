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
git log --format="%an <%ae>" develop..HEAD \
  | sort -u \
  | grep -i "${USERNAME}"
```

This may return zero, one, or multiple matches. Handle each case:

- **0 matches** — widen search: try matching just the first 4+ chars of the username against author names, and also try searching by `nc`-stripped version (e.g. `ncRaju` → `Raju`):
  ```bash
  STRIPPED=$(echo "${USERNAME}" | sed 's/^nc//I')
  git log --format="%an <%ae>" develop..HEAD | sort -u | grep -i "${STRIPPED}"
  ```
- **1 match** — use that email automatically, report it to the user
- **2+ matches** — show all matches and use `AskUserQuestion` to let the user pick which email(s) to rewrite

If no match is found after widened search, report the names + emails of ALL unique authors on the branch and ask the user to identify which one matches the CLA username.

Once resolved, set `TARGET_EMAIL` and proceed.

## Flow

```
/fix-cla
  → Phase 0: Resolve arg (username → email, or use email directly)
  → Phase 1: Detect current branch + base branch
  → Phase 2: Find unsigned commits (filter by TARGET_EMAIL)
  → Phase 3: Show summary, ask for confirmation
  → Phase 4: Rewrite with git filter-branch
  → Phase 5: Verify, show results
  → Phase 6: Remind to force push
```

## Phase 1: Detect Branch

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASE=develop
```

If an explicit branch was passed as arg 2, checkout that branch first.

## Phase 2: Find Unsigned Commits

```bash
git log --format="%h %an <%ae> %s" ${BASE}..HEAD | grep "${TARGET_EMAIL}"
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

## Phase 4: Rewrite

Clear any leftover filter-branch backup refs before running:

```bash
git for-each-ref --format="%(refname)" refs/original/ \
  | while read ref; do git update-ref -d "$ref"; done
```

Then rewrite:

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
" -- ${BASE}..HEAD
```

## Phase 5: Verify

After rewrite, run:

```bash
git log --format="%h %an <%ae>" ${BASE}..HEAD | sort -u
```

Confirm no commits remain from `TARGET_EMAIL`. Show the unique authors list.

## Phase 6: Remind to Push

Output a clear message:

```
✅ Done. All commits from <original arg> (<TARGET_EMAIL>) have been rewritten to <CURRENT_NAME> <CURRENT_EMAIL>.

Since history was rewritten, force push is required:

  git push origin {BRANCH} --force-with-lease

After pushing, trigger the CLA bot to re-check by posting a comment on the PR:
  @cla-assistant recheck
```

## Rules

- Never push automatically — always leave that to the user
- Never rewrite commits that are already on `develop` (use `develop..HEAD` range)
- Always clear `refs/original/` backup refs before running `filter-branch` to avoid "backup already exists" errors
- If `git filter-branch` fails, report the error and suggest using `git filter-repo` as an alternative
- If the branch is `develop` or `main`, refuse and explain why
