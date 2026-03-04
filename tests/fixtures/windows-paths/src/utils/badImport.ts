import { libFn } from '../lib/index.js'

// This file imports from lib layer
// This is a VIOLATION - utils cannot import from lib
// (only lib -> utils is allowed, not utils -> lib)

export function badImport() {
  return libFn()
}
