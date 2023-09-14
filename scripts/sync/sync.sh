#!/bin/bash

START_COMMIT="$1"
END_COMMIT="$2"

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# cd to the root of the nocodb repo
cd "$SCRIPT_DIR/../../../nocodb"

git remote add ee ../nocohub

git fetch ee

# cd to the root of the nocohub
cd "$SCRIPT_DIR/../.."

commit_data=$(cd ../nocodb; git log --format="%H|%an|%ae|%s" --no-merges "$START_COMMIT".."$END_COMMIT")

# Split the commit data into an array
IFS=$'\n' read -rd '' -a commit_data <<<"$commit_data"

# Iterate over the commit data
for commit_info in "${commit_data[@]}"; do
  # Get the commit date, author, and SHA
  commit_sha=$(echo "$commit_info" | cut -d'|' -f1)
  commit_author=$(echo "$commit_info" | cut -d'|' -f2)
  commit_author_mail=$(echo "$commit_info" | cut -d'|' -f3)
  commit_message=$(echo "$commit_info" | cut -d'|' -f4)

  git cherry-pick "$commit_sha" --no-commit --signoff

  cat scripts/sync/exclude-list.txt | sed 's/^/":/;s/$/"/' | tr '\n' ' ' | xargs git reset --

  git commit -m "$commit_message" --author="$commit_author <$commit_author_mail>" --signoff

  git reset --hard

  git clean -fd
done