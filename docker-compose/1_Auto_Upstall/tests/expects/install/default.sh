#!/usr/bin/expect -f

# Configure timeout for each expect command
set timeout 10

# Start your main script
set env(PATH) "$env(WORKING_DIR)/mocks:$env(PATH)"

spawn bash ../../noco.sh

# Respond to script prompts
expect "Enter the IP address or domain name for the NocoDB instance (default: localhost):"
send "\r"

expect "Show Advanced Options*"
send "\r"

expect "Do you want to start the management menu*"
send "N\r"

expect eof
