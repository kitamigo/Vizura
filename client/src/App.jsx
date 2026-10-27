import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout.jsx'
import Header from './components/layout/Header.jsx'

import Dashboard from './pages/dashboard/Dashboard.jsx'
import Payroll from './pages/payroll/Payroll.jsx'
import Analytics from './pages/analytics/Analytics.jsx'
import Roster from './pages/roster/Roster.jsx'

import Login from './pages/auth/Login.jsx'
import Register from './pages/auth/Register.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'

function App() {
  return (
    <>
      <Header />

      <Routes>

        {/* Authentication pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

<<<<<<< Updated upstream
        {/* Opens the roster before authentication for editing - TEMPORARY */}
=======
        {/* Open the roster before authentication */}
>>>>>>> Stashed changes
        <Route path="/" element={<Navigate to="/app/roster" replace />} />

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
            element={<Roster />}
          />

        </Route>

        {/* Fallback */}
        <Route path="*" element={<div>404 Not Found</div>} />

      </Routes>
    </>
  )
}

export default App