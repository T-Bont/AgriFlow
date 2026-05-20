import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/stores/toast'
import MapShell from '@/components/MapShell'
import FAB from '@/components/FAB'
import {
  Sprout,
  LandPlot,
  Package,
  Receipt,
  LineChart,
  TrendingUp,
  Settings,
  HelpCircle,
  Menu,
  ChevronLeft,
  ChevronRight,
  Map as MapIcon,
  LogOut,
} from 'lucide-react'
import './Layout.css'

const RAIL_STORAGE_KEY = 'agriflow-rail-collapsed'

export default function Layout() {
  const { user } = useAuth()
  const toastMessage = useToast((s) => s.message)
  const location = useLocation()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [railCollapsed, setRailCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(RAIL_STORAGE_KEY) === '1'
  })

  useEffect(() => {
    window.localStorage.setItem(RAIL_STORAGE_KEY, railCollapsed ? '1' : '0')
  }, [railCollapsed])

  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    void supabase.auth.signOut()
  }

  const farmLabel = user?.user_metadata?.farm_name ?? 'My Farm'

  const path = location.pathname
  const hideFab =
    path === '/log' ||
    /\/log$/.test(path) ||
    path === '/financials' ||
    path === '/market' ||
    path.startsWith('/map/edit')
  const showFab = !hideFab

  const railWidth = railCollapsed ? 72 : 168

  return (
    <div
      className={`layout-app${railCollapsed ? ' layout-rail-collapsed' : ''}`}
      style={{ '--layout-rail-width': `${railWidth}px` } as React.CSSProperties}
    >
      <aside className="layout-rail" aria-label="Main navigation">
        <div className="layout-rail-brand">
          <Sprout className="layout-rail-logo-icon" aria-hidden size={28} strokeWidth={2} />
          {!railCollapsed && <span className="layout-rail-title">AgriFlow</span>}
        </div>

        <nav className="layout-rail-nav">
          <NavLink to="/fields" className={navClass}>
            <LandPlot size={22} strokeWidth={2} aria-hidden />
            {!railCollapsed && <span>Fields</span>}
          </NavLink>
          <NavLink to="/inventory" className={navClass}>
            <Package size={22} strokeWidth={2} aria-hidden />
            {!railCollapsed && <span>Inventory</span>}
          </NavLink>
          <NavLink to="/transactions" className={navClass}>
            <Receipt size={22} strokeWidth={2} aria-hidden />
            {!railCollapsed && <span>Transactions</span>}
          </NavLink>
          <NavLink to="/financials" className={navClass}>
            <LineChart size={22} strokeWidth={2} aria-hidden />
            {!railCollapsed && <span>Financials</span>}
          </NavLink>
          <NavLink to="/market" className={navClass}>
            <TrendingUp size={22} strokeWidth={2} aria-hidden />
            {!railCollapsed && <span>Market</span>}
          </NavLink>
        </nav>

        <div className="layout-rail-spacer" />

        <nav className="layout-rail-footer">
          <NavLink to="/settings" className={navClass}>
            <Settings size={22} strokeWidth={2} aria-hidden />
            {!railCollapsed && <span>Settings</span>}
          </NavLink>
          <NavLink to="/help" className={navClass}>
            <HelpCircle size={22} strokeWidth={2} aria-hidden />
            {!railCollapsed && <span>Help</span>}
          </NavLink>
          <button type="button" className="layout-rail-link layout-rail-logout" onClick={handleLogout}>
            <LogOut size={22} strokeWidth={2} aria-hidden />
            {!railCollapsed && <span>Log out</span>}
          </button>
          <button
            type="button"
            className="layout-rail-collapse"
            onClick={() => setRailCollapsed((c) => !c)}
            aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {railCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </nav>
      </aside>

      {mobileDrawerOpen && (
        <button
          type="button"
          className="layout-drawer-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}
      <div className={`layout-drawer${mobileDrawerOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Menu">
        <div className="layout-drawer-header">
          <span className="layout-drawer-title">Menu</span>
        </div>
        <nav className="layout-drawer-nav">
          <NavLink to="/fields" className={drawerNavClass} onClick={() => setMobileDrawerOpen(false)}>
            <LandPlot size={22} aria-hidden /> Fields
          </NavLink>
          <NavLink to="/inventory" className={drawerNavClass} onClick={() => setMobileDrawerOpen(false)}>
            <Package size={22} aria-hidden /> Inventory
          </NavLink>
          <NavLink to="/transactions" className={drawerNavClass} onClick={() => setMobileDrawerOpen(false)}>
            <Receipt size={22} aria-hidden /> Transactions
          </NavLink>
          <NavLink to="/financials" className={drawerNavClass} onClick={() => setMobileDrawerOpen(false)}>
            <LineChart size={22} aria-hidden /> Financials
          </NavLink>
          <NavLink to="/market" className={drawerNavClass} onClick={() => setMobileDrawerOpen(false)}>
            <TrendingUp size={22} aria-hidden /> Market
          </NavLink>
          <NavLink to="/settings" className={drawerNavClass} onClick={() => setMobileDrawerOpen(false)}>
            <Settings size={22} aria-hidden /> Settings
          </NavLink>
          <NavLink to="/help" className={drawerNavClass} onClick={() => setMobileDrawerOpen(false)}>
            <HelpCircle size={22} aria-hidden /> Help
          </NavLink>
          <button type="button" className="layout-drawer-logout" onClick={handleLogout}>
            <LogOut size={22} aria-hidden /> Log out
          </button>
        </nav>
      </div>

      <div className="layout-main-column">
        <header className="layout-mobile-top">
          <button
            type="button"
            className="layout-mobile-menu-btn"
            aria-label="Open menu"
            onClick={() => setMobileDrawerOpen(true)}
          >
            <Menu size={24} strokeWidth={2} aria-hidden />
          </button>
          <span className="layout-mobile-farm">{farmLabel}</span>
          <NavLink to="/settings" className="layout-mobile-settings" aria-label="Settings">
            <Settings size={22} strokeWidth={2} aria-hidden />
          </NavLink>
        </header>

        <div className="layout-map-stack">
          <div className="layout-map-shell-layer">
            <MapShell />
          </div>
          <div className="layout-outlet-layer">
            <Outlet />
          </div>
          {showFab && (
            <div className="layout-fab-wrap">
              <FAB />
            </div>
          )}
        </div>

        <nav className="layout-mobile-tabs" aria-label="Primary">
          <NavLink to="/" end className={tabClass}>
            <MapIcon size={22} strokeWidth={2} aria-hidden />
            <span>Map</span>
          </NavLink>
          <NavLink to="/fields" className={tabClass}>
            <LandPlot size={22} strokeWidth={2} aria-hidden />
            <span>Fields</span>
          </NavLink>
          <NavLink to="/transactions" className={tabClass}>
            <Receipt size={22} strokeWidth={2} aria-hidden />
            <span>Transactions</span>
          </NavLink>
          <NavLink to="/inventory" className={tabClass}>
            <Package size={22} strokeWidth={2} aria-hidden />
            <span>Inventory</span>
          </NavLink>
        </nav>
      </div>

      {toastMessage && (
        <div className="toast" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  )
}

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'layout-rail-link active' : 'layout-rail-link'
}

function drawerNavClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'layout-drawer-link active' : 'layout-drawer-link'
}

function tabClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'layout-tab active' : 'layout-tab'
}
