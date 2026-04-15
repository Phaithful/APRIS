import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext.jsx'
import { useAuth } from './context/AuthContext.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'

import AppLayout from './components/layout/AppLayout.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ImageAnalysis from './pages/ImageAnalysis.jsx'
import Analytics from './pages/Analytics.jsx'
import FarmManager from './pages/FarmManager.jsx'
import Alerts from './pages/Alerts.jsx'
import Encyclopedia from './pages/Encyclopedia.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import Profile from './pages/Profile.jsx'
import AiChat from './pages/AiChat.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-[#F7F6F2]">
    <div className="w-8 h-8 border-4 border-[#2E7D52] border-t-transparent rounded-full animate-spin" />
  </div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <ErrorBoundary>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>} >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/image-analysis" element={<ImageAnalysis />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/farms" element={<FarmManager />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/encyclopedia" element={<Encyclopedia />} />
          <Route path="/ai-chat" element={<AiChat />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}
