#!/usr/bin/env expect -f
#
# Drives noco.sh through the interactive wizard for a local install.
# Preflight is skipped and curl is mocked, so it runs offline on any OS.

set timeout 30
set here [file dirname [file normalize [info script]]]
set env(PATH) "$here/../../mocks:$env(PATH)"
set env(NOCO_SKIP_PREFLIGHT) "1"

spawn bash "$here/../../../noco.sh"

# Domain prompt — type localhost (local mode)
expect "Domain or IP*"
send "localhost\r"

# Postgres — 1) Bundled
expect ">*"
send "1\r"

# Redis — 1) Bundled
expect ">*"
send "1\r"

# Summary confirmation — accept default (Y)
expect "Proceed?*"
send "\r"

expect eof
