import { utilFunction } from '../utils/index.js'

// This file is also NOT in any declared layer
// Unlayered files can import from layered files freely
// (they are not subject to rules)

export function moreHelpers() {
  return utilFunction()
}
