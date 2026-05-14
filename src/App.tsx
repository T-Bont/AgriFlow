import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { processSyncQueue, pullLatest } from '@/lib/sync'
import Layout from '@/components/Layout'
import SidePanel from '@/components/SidePanel'
import FullOverlay from '@/components/FullOverlay'
import Login from '@/pages/Login'
import MapEditLayoutView from '@/pages/MapEditLayoutView'
import FieldDetail from '@/pages/FieldDetail'
import LogPage from '@/pages/LogPage'
import Fields from '@/pages/Fields'
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
          <Route index element={null} />
          <Route
            path="fields"
            element={
              <SidePanel title="Fields">
                <Fields />
              </SidePanel>
            }
          />
          <Route
            path="inventory"
            element={
              <SidePanel title="Inventory">
                <Inventory />
              </SidePanel>
            }
          />
          <Route
            path="transactions"
            element={
              <SidePanel title="Transactions">
                <TransactionHistory />
              </SidePanel>
            }
          />
          <Route
            path="settings"
            element={
              <SidePanel title="Settings">
                <Settings />
              </SidePanel>
            }
          />
          <Route
            path="help"
            element={
              <SidePanel title="Help">
                <Help />
              </SidePanel>
            }
          />
          <Route
            path="field/:fieldId"
            element={
              <SidePanel>
                <FieldDetail />
              </SidePanel>
            }
          />
          <Route path="financials" element={<FullOverlay title="Financials"><Financials /></FullOverlay>} />
          <Route path="market" element={<FullOverlay title="Market"><Market /></FullOverlay>} />
          <Route path="map/edit" element={<FullOverlay><MapEditLayoutView /></FullOverlay>} />
          <Route path="field/:fieldId/log" element={<FullOverlay><LogPage /></FullOverlay>} />
          <Route path="log" element={<FullOverlay><LogPage /></FullOverlay>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
