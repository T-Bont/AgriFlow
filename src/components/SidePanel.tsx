import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import './SidePanel.css'

interface SidePanelProps {
  title?: string
  children: ReactNode
}

export default function SidePanel({ title, children }: SidePanelProps) {
  const navigate = useNavigate()

  const handleClose = () => {
    navigate('/', { replace: false })
  }

  return (
    <div className="side-panel-root">
      <aside className="side-panel" aria-label={title ?? 'Panel'}>
        <header className={`side-panel-header${title ? '' : ' side-panel-header-solo'}`}>
          {title ? <h2 className="side-panel-title">{title}</h2> : <span className="side-panel-title-spacer" aria-hidden />}
          <button type="button" className="side-panel-close" onClick={handleClose} aria-label="Close panel">
            <X size={22} strokeWidth={2} aria-hidden />
          </button>
        </header>
        <div className="side-panel-body">{children}</div>
      </aside>
    </div>
  )
}
