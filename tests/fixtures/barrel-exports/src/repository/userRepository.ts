export interface User {
  id: string
  name: string
}

export interface UserRepository {
  create(data: any): Promise<User>
}

export function getUserRepository(): UserRepository {
  return {
    async create(data: any): Promise<User> {
      return { id: '1', ...data }
    },
  }
}
