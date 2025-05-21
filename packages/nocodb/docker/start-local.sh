#!/bin/sh

if [ ! -d "${NC_TOOL_DIR}"  ]; then
  mkdir -p "$NC_TOOL_DIR"
fi

node docker/index.js
