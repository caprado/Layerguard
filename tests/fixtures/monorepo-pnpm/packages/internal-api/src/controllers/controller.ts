// This package imports INTERNALS from another package
// This is a cross-package violation pattern

// BAD: Importing from internal implementation of web-api
// (pretending this is possible - in reality would need the file to exist)
import { createUserService } from '@monorepo/web-api/src/services/userService.js'

export function internalController() {
  // Using internal implementation detail of another package
  return createUserService()
}
