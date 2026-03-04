// Repository layer - lowest layer, no dependencies on upper layers
// This follows clean architecture correctly

export interface User {
  id: string
  name: string
  email: string
}

export interface UserRepository {
  create(data: any): Promise<User>
  findById(id: string): Promise<User | null>
  findAll(): Promise<User[]>
}

// In-memory implementation for demo
const users: User[] = []

export function getUserRepository(): UserRepository {
  return {
    async create(data: any): Promise<User> {
      const user: User = {
        id: Math.random().toString(36),
        ...data,
      }
      users.push(user)
      return user
    },
    async findById(id: string): Promise<User | null> {
      return users.find(u => u.id === id) || null
    },
    async findAll(): Promise<User[]> {
      return users
    },
  }
}
