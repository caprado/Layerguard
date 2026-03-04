import { useState } from '../hooks/useState.js'

export function Button() {
  const state = useState('idle')
  return `<button>${state}</button>`
}
