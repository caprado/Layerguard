export function formatDate(date: Date): string {
  return date.toISOString()
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-')
}
