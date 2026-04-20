import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Inventory from './pages/Inventory'
import Repairs from './pages/Repairs'
import Procurement from './pages/Procurement'
import Login from './pages/Login'
import Users from './pages/Users'
import Chat from './pages/Chat'

export type UserRole = 'IT' | 'Admin' | 'Manager' | 'Employee'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('isAuthenticated') === 'true',
  )
  const [userRole, setUserRole] = useState<UserRole>(
    (localStorage.getItem('userRole') as UserRole) || 'Manager',
  )
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '')
  const [userId, setUserId] = useState(localStorage.getItem('userId') || '')

  const handleLogin = (
    status: boolean,
    role: UserRole = 'Manager',
    name: string = '',
    userId: string = '',
  ) => {
    setIsAuthenticated(status)
    setUserRole(role)
    setUserName(name)
    setUserId(userId)
    localStorage.setItem('isAuthenticated', String(status))
    localStorage.setItem('userRole', role)
    localStorage.setItem('userName', name)
    localStorage.setItem('userId', userId)
  }

  const handleRoleChange = (role: UserRole) => {
    setUserRole(role)
    localStorage.setItem('userRole', role)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />
        <Route
          path="/login"
          element={
            <Login
              onLogin={(role: UserRole, name: string, id: string) =>
                handleLogin(true, role, name, id)
              }
            />
          }
        />

        {/* Protected Routes */}
        <Route
          element={
            isAuthenticated ? (
              <Layout
                onLogout={() => handleLogin(false)}
                userRole={userRole}
                userName={userName}
                onRoleChange={handleRoleChange}
                userId={userId}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="dashboard" element={<Dashboard userRole={userRole} userName={userName} />} />
          <Route path="employees" element={userRole === 'Employee' ? <Navigate to="/dashboard" replace /> : <Employees />} />
          <Route path="inventory" element={userRole === 'Employee' ? <Navigate to="/dashboard" replace /> : <Inventory />} />
          <Route path="procurement" element={userRole === 'Employee' ? <Navigate to="/dashboard" replace /> : <Procurement userRole={userRole} />} />
          <Route path="repairs" element={<Repairs userRole={userRole} userName={userName} />} />
          <Route
            path="users"
            element={userRole === 'IT' ? <Users /> : <Navigate to="/dashboard" replace />}
          />
          <Route
            path="chat"
            element={userRole === 'Employee' ? <Navigate to="/dashboard" replace /> : <Chat userId={userId} userName={userName} userRole={userRole} />}
          />
        </Route>

        {/* Fallback */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
