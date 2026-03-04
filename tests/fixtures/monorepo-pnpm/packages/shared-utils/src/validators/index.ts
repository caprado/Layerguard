export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isRequired(value: any): boolean {
  return value !== undefined && value !== null && value !== ''
}
