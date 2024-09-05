#!/usr/bin/expect -f
# shellcheck shell=bash

# Configure timeout for each expect command
set timeout 10

# Start your main script
set env(PATH) "$env(WORKING_DIR)/mocks:$env(PATH)"

spawn bash ../../noco.sh

# Respond to script prompts
expect "Enter the IP address or domain name for the NocoDB instance (default: localhost):"
send "192.168.1.10\r"

expect "Show Advanced Options*"
send "\r"

expect "Do you want to start the management menu*"
send "N\r"

expect eof
