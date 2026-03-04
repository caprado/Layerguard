export function createUserService() {
  return {
    create: (data: any) => ({ id: '1', ...data })
  }
}
