import { createUserService } from '../services/userService.js'

export function userHandler() {
  return createUserService()
}
