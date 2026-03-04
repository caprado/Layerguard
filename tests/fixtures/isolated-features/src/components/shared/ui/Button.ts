// Shared Button component
// Can be imported by any feature

export interface ButtonProps {
  label: string
  onClick?: () => void
}

export function Button(props: ButtonProps) {
  return `<button>${props.label}</button>`
}
