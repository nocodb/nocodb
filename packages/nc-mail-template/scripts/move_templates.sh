#!/bin/bash

# Move the templates in the dist folder to the
# packages/nocodb/src/services/mail/templates folder


SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# cd to the root of the nocodb repo
cd "$SCRIPT_DIR/../../.."

# Move the templates

mv -f packages/nc-mail-template/dist/* packages/nocodb/src/ee/services/mail/templates

# Remove the dist folder

rm -rf packages/nc-mail-templates/.dist