import { createUserService } from '../services/userService.js'
import { getUserRepository } from '../repository/userRepository.js'

// VALID: handlers -> services (allowed)
// VIOLATION: handlers -> repository (not allowed directly)

export async function handleCreateUser(request: any) {
  // This is correct - goes through services layer
  const userService = createUserService()
  const user = await userService.create(request.body)
  
  return { status: 201, body: user }
}

export async function handleGetUser(request: any) {
  // This is a VIOLATION - handlers should not access repository directly
  // Should go through services layer instead
  const repo = getUserRepository()
  const user = await repo.findById(request.params.id)
  
  return { status: 200, body: user }
}
