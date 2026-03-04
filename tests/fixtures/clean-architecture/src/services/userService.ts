import { UserRepository, getUserRepository } from '../repository/userRepository.js'
import { createOrderRepository } from '../repository/orderRepository.js'

// VALID: services -> repository (allowed)
// VIOLATION: services should not import from handlers

export interface UserService {
  create(data: any): Promise<any>
  findById(id: string): Promise<any>
}

export function createUserService(): UserService {
  const repo = getUserRepository()
  
  return {
    async create(data: any) {
      return repo.create(data)
    },
    async findById(id: string) {
      return repo.findById(id)
    },
  }
}

// This is a VIOLATION - services should not import from handlers
// import { handleCreateUser } from '../handlers/userHandlers.js'
