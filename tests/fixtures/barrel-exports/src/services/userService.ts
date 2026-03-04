import { getUserRepository } from '../repository/index.js'

// Service uses repository internally - this is VALID
// services -> repository is allowed

export interface UserService {
  create(data: any): Promise<any>
}

export function createUserService(): UserService {
  const repo = getUserRepository()
  
  return {
    async create(data: any) {
      // Business logic here
      return repo.create(data)
    },
  }
}
