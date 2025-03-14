#!/usr/bin/expect -f

# Configure timeout for each expect command
set timeout 20

# Start your main script
set env(PATH) "$env(WORKING_DIR)/mocks:$env(PATH)"

spawn bash ../../noco.sh

expect "Do you want to reinstall NocoDB*"
send "N\r"

expect "Enter your choice: "
send "5\r"

expect "Enter your choice: "
send "0\r"

expect EOF