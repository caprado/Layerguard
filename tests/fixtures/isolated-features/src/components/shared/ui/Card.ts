// Shared Card component

export interface CardProps {
  content: string
}

export function Card(props: CardProps) {
  return `<div class="card">${props.content}</div>`
}
