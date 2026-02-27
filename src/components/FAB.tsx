import { Link, useLocation } from 'react-router-dom'
import './FAB.css'

interface FABProps {
  to?: string
  onClick?: () => void
}

export default function FAB({ to = '/log', onClick }: FABProps) {
  const location = useLocation()
  const isFieldDetail = location.pathname.startsWith('/field/')
  const target = isFieldDetail ? `${location.pathname}/log` : to

  if (onClick) {
    return (
      <button
        type="button"
        className="fab"
        onClick={onClick}
        aria-label="Add record"
      >
        +
      </button>
    )
  }
  return (
    <Link to={target} className="fab" aria-label="Add record">
      +
    </Link>
  )
}
