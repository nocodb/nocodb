#!/bin/bash
set -e  # Exit on error

# cd to gui
cd ./packages/nc-gui

# Allow node to use 8 GB of ram
export NODE_OPTIONS="--max-old-space-size=8192"

# Clean previous build artifacts to ensure fresh build
echo "Cleaning previous build artifacts..."
rm -rf .nuxt .output dist

# Build and copy the gui to the right places
echo "Building GUI..."
pnpm run build:copy

# install the new gui
echo "Installing nc-lib-gui..."
pnpm i ../nc-lib-gui

# Make sure packages/nocodb/package.json has nc-lib-gui version set to "nc-lib-gui": "link:../nc-lib-gui"
cd ../../

echo "Running bootstrap..."
pnpm bootstrap

echo "Restarting nocodb service..."
sudo systemctl restart nocodb.service

echo "Done!"
