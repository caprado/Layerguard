import { z } from './z.js'

// Part of indirect cycle: x -> y -> z -> x

export function y() {
  return 'Y'
}

export function yUsesZ() {
  return `Y using ${z()}`
}
