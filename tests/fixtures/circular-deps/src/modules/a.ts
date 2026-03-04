import { b } from './b.js'

// Circular dependency: a.ts -> b.ts -> a.ts

export function a() {
  console.log('Function A')
  return 'A'
}

export function aUsesB() {
  return `A using ${b()}`
}
