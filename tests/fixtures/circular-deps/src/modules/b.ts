import { a } from './a.js'

// This creates a cycle: b.ts -> a.ts -> b.ts

export function b() {
  console.log('Function B')
  return 'B'
}

export function bUsesA() {
  return `B using ${a()}`
}
