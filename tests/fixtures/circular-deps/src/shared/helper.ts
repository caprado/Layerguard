import { aUsesB } from '../modules/a.js'

// Cross-layer circular dependency attempt
// shared -> modules (this is allowed by flow rules)
// But modules -> shared would complete a cycle if it existed

export function sharedHelper() {
  return 'Shared Helper'
}

// This is valid: shared can import from modules
export function sharedUsesModule() {
  return `Shared: ${aUsesB()}`
}
