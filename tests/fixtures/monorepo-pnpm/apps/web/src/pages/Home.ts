import { userHandler } from '@monorepo/web-api'
import { formatDate } from '@monorepo/shared-utils'

export function HomePage() {
  const handler = userHandler()
  const date = formatDate(new Date())
  
  return { handler, date }
}
