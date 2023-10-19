#!/bin/bash

START_COMMIT="$1"
END_COMMIT="$2"

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# cd to the root of the nocodb repo
cd "$SCRIPT_DIR/../../../nocodb"

if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  git fetch --quiet --unshallow origin
else
  git fetch --quiet
fi


# cd to the root of the nocohub
cd "$SCRIPT_DIR/../.."

git remote remove oss > /dev/null 2> /dev/null

git remote add oss ../nocodb > /dev/null 2> /dev/null

git fetch --quiet oss

commit_data=$(cd ../nocodb; git log --reverse --format="%H|%an|%ae|%s" --no-merges "$START_COMMIT".."$END_COMMIT")

# Split the commit data into an array
IFS=$'\n' read -rd '' -a commit_data <<<"$commit_data"

information="## Commits:\n\`\`\`"

# Iterate over the commit data
for commit_info in "${commit_data[@]}"; do
  # Get the commit date, author, and SHA
  commit_sha=$(echo "$commit_info" | cut -d'|' -f1)
  commit_author=$(echo "$commit_info" | cut -d'|' -f2)
  commit_author_mail=$(echo "$commit_info" | cut -d'|' -f3)
  commit_message=$(echo "$commit_info" | cut -d'|' -f4)

  information="$information\n- $commit_message by $commit_author"

  git cherry-pick "$commit_sha" --no-commit > /dev/null 2> /dev/null

  git add .

  cat scripts/sync/exclude-list.txt | sed 's/^/":/;s/$/"/' | tr '\n' ' ' | xargs git reset --quiet --

  git config user.name "$commit_author"
  git config user.email "$commit_author_mail"

  git commit -m "$commit_message" --author="$commit_author <$commit_author_mail>" > /dev/null 2> /dev/null

  git reset --hard > /dev/null 2> /dev/null

  git clean -fd > /dev/null 2> /dev/null
done

echo -e "$information\n\`\`\`"