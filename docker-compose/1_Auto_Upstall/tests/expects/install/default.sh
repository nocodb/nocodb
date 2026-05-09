#!/usr/bin/expect -f

# Configure timeout for each expect command
set timeout 30

# Mocks for nproc/clear etc.
set env(PATH) "$env(WORKING_DIR)/mocks:$env(PATH)"

# Spawn the script (no flags — fully interactive)
spawn bash ../../noco.sh

# Domain prompt — accept default (localhost / detected IP)
expect "Domain or IP*"
send "\r"

# Postgres choice — pick 1 (Bundled)
expect ">*"
send "1\r"

# Redis choice — pick 1 (Bundled)
expect ">*"
send "1\r"

# Summary confirmation — accept default Y
expect "Proceed?*"
send "\r"

expect eof
