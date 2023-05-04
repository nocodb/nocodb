#!/bin/bash
# Ask the user for their name

echo Enter database type
read db

echo Enter database host
read host

echo Enter database port
read port

echo Enter database username
read username

echo Enter database password
read password

echo Enter database database
read database

echo "$db://$host:$port?u=$username&p=$password&d=$database"
