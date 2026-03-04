import { helper } from '../utils/helper.js'

// This file imports from utils layer
// Should be valid since lib -> utils is allowed

export function libWithUtils() {
  return helper()
}
