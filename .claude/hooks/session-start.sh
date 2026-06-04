#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install Cloud Functions dependencies
cd "$CLAUDE_PROJECT_DIR/functions"
npm install
