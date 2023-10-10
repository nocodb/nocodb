#!/bin/bash

ACTIVE_BRANCH=$(git rev-parse --abbrev-ref HEAD)

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# cd to the root of the nocohub repo
cd "$SCRIPT_DIR/../.."

commit_data=$(git log --reverse --format="%H|%an|%ae|%s" --no-merges develop.."$ACTIVE_BRANCH")

# Split the commit data into an array
IFS=$'\n' read -rd '' -a commit_data <<<"$commit_data"

# cd to the root of the nocodb repo
cd "$SCRIPT_DIR/../../../nocodb"

git remote add ee ../nocohub

git fetch ee "$ACTIVE_BRANCH"

# create sync branch
git checkout -b "nc-$ACTIVE_BRANCH"

# Iterate over the commit data
for commit_info in "${commit_data[@]}"; do
  # Get the commit date, author, and SHA
  commit_sha=$(echo "$commit_info" | cut -d'|' -f1)
  commit_author=$(echo "$commit_info" | cut -d'|' -f2)
  commit_author_mail=$(echo "$commit_info" | cut -d'|' -f3)
  commit_message=$(echo "$commit_info" | cut -d'|' -f4)

  git cherry-pick -X theirs "$commit_sha" --no-commit

  git add .

  cat ../nocohub/scripts/sync/exclude-list.txt | sed 's/^/":/;s/$/"/' | tr '\n' ' ' | xargs git reset --

  git config user.name "$commit_author"
  git config user.email "$commit_author_mail"

  git commit -m "$commit_message" --author="$commit_author <$commit_author_mail>"

  git reset --hard

  git clean -fd
done