import { Button } from '../../shared/ui/Button.js'
import { formatCurrency } from '../../shared/utils/format.js'

// Auth feature - valid imports from shared

export function LoginForm() {
  return Button({ label: 'Login' })
}

export function formatPrice(amount: number) {
  return formatCurrency(amount, 'USD')
}
