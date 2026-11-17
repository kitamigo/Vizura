import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout.jsx'
import Header from './components/layout/Header.jsx'

import Dashboard from './pages/dashboard/Dashboard.jsx'
import Payroll from './pages/payroll/Payroll.jsx'
import Analytics from './pages/analytics/Analytics.jsx'
import Roster from './pages/roster/Roster.jsx'
import EmployeeManagement from './pages/employees/EmployeeManagement.jsx'
import Settings from './pages/settings/Settings.jsx'

import Login from './pages/auth/Login.jsx'
import Register from './pages/auth/Register.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'

function App() {
  const { pathname } = useLocation()
  const isAuthPage = pathname === '/login' || pathname === '/register'

  return (
    <>
      {!isAuthPage && <Header />}

      <Routes>

        {/* Authentication pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* App shell */}
        <Route path="/app" element={<MainLayout />}>

          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />

          <Route
            path="payroll"
            element={
              <ProtectedRoute>
                <Payroll />
              </ProtectedRoute>
            }
          />

          <Route
            path="roster"
            element={
              <ProtectedRoute>
                <Roster />
              </ProtectedRoute>
            }
          />

          <Route
            path="employees"
            element={
              <ProtectedRoute>
                <EmployeeManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

        </Route>

        {/* Fallback */}
        <Route path="*" element={<div>404 Not Found</div>} />

      </Routes>
    </>
  )
}

export default App