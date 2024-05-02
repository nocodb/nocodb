#!/usr/bin/expect -f

# Configure timeout for each expect command
set timeout 10

# Start your main script
spawn bash ../../noco.sh

expect "Do you want to reinstall NocoDB*"
send "N\r"

expect "Enter your choice: "
send "1\r"

expect "Enter your choice: "
send "0\r"

expect EOF