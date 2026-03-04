import { Card } from '../../shared/ui/Card.js'
import { PaymentForm } from '../billing/PaymentForm.js'

// Dashboard feature
// VIOLATION: Importing from billing feature (isolated sublayer)

export function DashboardWidget() {
  PaymentForm() // violation
  return Card({ content: 'Dashboard' })
}
