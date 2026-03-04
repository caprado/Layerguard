#!/usr/bin/env node

import('../dist/cli/index.js').catch((err) => {
  console.error('Failed to start layerguard:', err.message)
  process.exit(1)
})
