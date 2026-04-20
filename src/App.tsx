import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { processSyncQueue, pullLatest } from '@/lib/sync'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import MapEditLayoutView from '@/pages/MapEditLayoutView'
import FieldDetail from '@/pages/FieldDetail'
import LogPage from '@/pages/LogPage'
import Inventory from '@/pages/Inventory'
import TransactionHistory from '@/pages/TransactionHistory'
import Financials from '@/pages/Financials'
import Market from '@/pages/Market'
import Settings from '@/pages/Settings'
import Help from '@/pages/Help'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function SyncOnReconnect() {
  useEffect(() => {
    const handler = async () => {
      if (navigator.onLine) {
        await processSyncQueue()
        await pullLatest()
      }
    }
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <SyncOnReconnect />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="map/edit" element={<MapEditLayoutView />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="market" element={<Market />} />
          <Route path="financials" element={<Financials />} />
          <Route path="transactions" element={<TransactionHistory />} />
          <Route path="settings" element={<Settings />} />
          <Route path="help" element={<Help />} />
          <Route path="field/:fieldId" element={<FieldDetail />} />
          <Route path="field/:fieldId/log" element={<LogPage />} />
          <Route path="log" element={<LogPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
