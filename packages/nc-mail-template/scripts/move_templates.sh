#!/bin/bash

# Move the templates in the dist folder to their respective
# packages/nocodb/src/services/mail/templates folders based on EE/CE
# Remove -ee suffix for EE files during move

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# cd to the root of the nocodb repo
cd "$SCRIPT_DIR/../../.." || exit

# Move EE templates (files ending with -ee.ts) and remove -ee suffix
for file in packages/nc-mail-template/dist/*-ee.ts; do
  if [ -f "$file" ]; then
    # Get the filename without path and -ee suffix
    filename=$(basename "$file" | sed 's/-ee\.ts$/.ts/')
    mv -f "$file" "packages/nocodb/src/ee/services/mail/templates/$filename"
  fi
done

# Move CE templates (all other .ts files)
for file in packages/nc-mail-template/dist/*.ts; do
  if [ -f "$file" ]; then
    mv -f "$file" packages/nocodb/src/services/mail/templates/
  fi
done

# Remove the dist folder
rm -rf packages/nc-mail-templates/dist