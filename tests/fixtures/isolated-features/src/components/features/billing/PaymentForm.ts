import { Button } from '../../shared/ui/Button.js'
import { LoginForm } from '../auth/LoginForm.js'

// Billing feature
// VIOLATION: Importing from auth feature (isolated sublayer)
// Features should not import from other features

export function PaymentForm() {
  LoginForm() // violation
  return Button({ label: 'Pay' })
}
