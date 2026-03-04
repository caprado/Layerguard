import { getOrderRepository } from '../repository/index.js'

export interface OrderService {
  create(data: any): Promise<any>
}

export function createOrderService(): OrderService {
  const repo = getOrderRepository()
  
  return {
    async create(data: any) {
      return repo.create(data)
    },
  }
}
