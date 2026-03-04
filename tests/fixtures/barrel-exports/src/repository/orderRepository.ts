export interface Order {
  id: string
  total: number
}

export interface OrderRepository {
  create(data: any): Promise<Order>
}

export function getOrderRepository(): OrderRepository {
  return {
    async create(data: any): Promise<Order> {
      return { id: '1', ...data }
    },
  }
}
