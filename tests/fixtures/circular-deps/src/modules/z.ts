import { x } from './x.js'

// Completes the cycle: z -> x
// Full cycle: x -> y -> z -> x

export function z() {
  return 'Z'
}

export function zUsesX() {
  return `Z using ${x()}`
}
