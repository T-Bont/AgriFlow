import { Outlet, NavLink } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/stores/toast'
import './Layout.css'

export default function Layout() {
  const { user } = useAuth()
  const toastMessage = useToast((s) => s.message)

  const handleLogout = () => {
    void supabase.auth.signOut()
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-header-left">
          <h1 className="layout-title">AgriFlow</h1>
          <span className="layout-farm">{user?.user_metadata?.farm_name ?? 'My Farm'}</span>
        </div>
        <button type="button" className="layout-logout-button" onClick={handleLogout}>
          Log out
        </button>
      </header>
      <nav className="layout-nav" aria-label="Main">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'layout-nav-link active' : 'layout-nav-link')} end>
          Home
        </NavLink>
        <NavLink to="/inventory" className={({ isActive }) => (isActive ? 'layout-nav-link active' : 'layout-nav-link')}>
          Inventory
        </NavLink>
        <NavLink to="/market" className={({ isActive }) => (isActive ? 'layout-nav-link active' : 'layout-nav-link')}>
          Market
        </NavLink>
        <NavLink to="/financials" className={({ isActive }) => (isActive ? 'layout-nav-link active' : 'layout-nav-link')}>
          Financials
        </NavLink>
        <NavLink
          to="/transactions"
          className={({ isActive }) => (isActive ? 'layout-nav-link active' : 'layout-nav-link')}
        >
          Transaction history
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'layout-nav-link active' : 'layout-nav-link')}>
          Settings
        </NavLink>
        <NavLink to="/help" className={({ isActive }) => (isActive ? 'layout-nav-link active' : 'layout-nav-link')}>
          Help
        </NavLink>
      </nav>
      <main className="layout-main">
        <Outlet />
      </main>
      {toastMessage && (
        <div className="toast" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
