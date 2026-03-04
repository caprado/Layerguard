import { createUserService, createOrderService } from '../services/index.js'

// VALID: Importing from services barrel counts as services layer
// Even though userService internally uses repository

export async function createUserHandler(data: any) {
  const userService = createUserService()
  return userService.create(data)
}

export async function createOrderHandler(data: any) {
  const orderService = createOrderService()
  return orderService.create(data)
}
