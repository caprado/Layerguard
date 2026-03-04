import { getUserRepository } from './userRepository.js'

// Order repository - another repository example
// VALID: repositories can import from other repositories (same layer)

export interface Order {
  id: string
  userId: string
  total: number
}

export interface OrderRepository {
  create(data: any): Promise<Order>
  findByUserId(userId: string): Promise<Order[]>
}

const orders: Order[] = []

export function createOrderRepository(): OrderRepository {
  return {
    async create(data: any): Promise<Order> {
      const order: Order = {
        id: Math.random().toString(36),
        ...data,
      }
      orders.push(order)
      return order
    },
    async findByUserId(userId: string): Promise<Order[]> {
      return orders.filter(o => o.userId === userId)
    },
  }
}
