import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import './FullOverlay.css'

interface FullOverlayProps {
  title?: string
  children: ReactNode
}

export default function FullOverlay({ title, children }: FullOverlayProps) {
  const navigate = useNavigate()

  const handleClose = () => {
    navigate('/', { replace: false })
  }

  return (
    <div className="full-overlay-root">
      <div className="full-overlay" role="dialog" aria-modal="true" aria-label={title ?? 'Full screen'}>
        <header className={`full-overlay-header${title ? '' : ' full-overlay-header-solo'}`}>
          {title ? <h2 className="full-overlay-title">{title}</h2> : <span className="full-overlay-title-spacer" aria-hidden />}
          <button type="button" className="full-overlay-close" onClick={handleClose} aria-label="Close">
            <X size={22} strokeWidth={2} aria-hidden />
          </button>
        </header>
        <div className="full-overlay-body">{children}</div>
      </div>
    </div>
  )
}
