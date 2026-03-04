// VIOLATION: Importing directly from repository bypasses services layer
// This should be caught even though there's a barrel file
import { getUserRepository } from '../repository/index.js'

export async function badHandler(data: any) {
  // Direct repository access - violation!
  const repo = getUserRepository()
  return repo.create(data)
}
