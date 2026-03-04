import { y } from './y.js'

// Part of indirect cycle: x -> y -> z -> x

export function x() {
  return 'X'
}

export function xUsesY() {
  return `X using ${y()}`
}
