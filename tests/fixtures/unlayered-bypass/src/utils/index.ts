import { libraryFunction } from '../lib/index.js'
import { miscHelper } from '../misc/helpers.js'

// VIOLATION: Importing from unlayered file (misc/helpers.ts)
// With unlayeredImports: 'error', this should fail

export function utilFunction() {
  // Valid: importing from lib layer
  const lib = libraryFunction()
  
  // Violation: importing from outside declared layers
  const helper = miscHelper()
  
  return `${lib} - ${helper}`
}
