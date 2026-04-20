import React, { useState, useEffect, useCallback } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Smartphone,
  Wrench,
  LogOut,
  ShoppingCart,
  ShieldCheck,
  MessageSquare,
  Sun,
  Moon,
} from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { API_BASE, WS_URL } from '../config'
import { useLoading } from '../context/LoadingContext'
import { useTheme } from '../context/ThemeContext'
import NotificationPanel from './NotificationPanel'

interface LayoutProps {
  onLogout: () => void
  userRole: string
  userName: string
  onRoleChange: (role: any) => void
  userId: string
}

const INACTIVITY_LIMIT = 30 * 60 * 1000 // 30 minutes

const Layout: React.FC<LayoutProps> = ({ onLogout, userRole, userName, userId }) => {
  const { withLoading } = useLoading()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)

  // Auto-logout Logic
  useEffect(() => {
    let timer: NodeJS.Timeout

    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        handleLogout('Session expired due to inactivity', true)
      }, INACTIVITY_LIMIT)
    }

    const handleInteraction = () => resetTimer()

    window.addEventListener('mousemove', handleInteraction)
    window.addEventListener('keydown', handleInteraction)
    window.addEventListener('click', handleInteraction)

    resetTimer()

    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('click', handleInteraction)
    }
  }, [])

  const handleLogout = async (reason = 'User logged out', isTimeout = false) => {
    await withLoading(async () => {
      try {
        const token = localStorage.getItem('token')
        await fetch(`${API_BASE}/activity`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'LOGOUT',
            details: reason,
            performedBy: userName,
          }),
        })
      } catch (e) {}

      if (isTimeout) {
        sessionStorage.setItem('logoutMessage', 'You have been logged out due to inactivity.')
      }

      onLogout()
    })
  }

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const res = await fetch(`${API_BASE}/chat/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setUnreadChatCount(data.count)
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const [notifsRes, countRes] = await Promise.all([
        fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [notifs, count] = await Promise.all([notifsRes.json(), countRes.json()])
      setNotifications(Array.isArray(notifs) ? notifs : [])
      setUnreadNotifCount(count.count || 0)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
  }, [])

  const handleMarkRead = async (id: number) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
      setUnreadNotifCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification read:', error)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadNotifCount(0)
    } catch (error) {
      console.error('Failed to mark all read:', error)
    }
  }

  useEffect(() => {
    fetchUnreadCount()
    fetchNotifications()

    const socket: Socket = io(WS_URL)
    socket.on('connect', () => {
      if (userId) socket.emit('register', parseInt(userId))
    })

    socket.on('receive_message', () => {
      fetchUnreadCount()
    })

    socket.on('notification', (notif: any) => {
      setNotifications((prev) => [notif, ...prev])
      setUnreadNotifCount((prev) => prev + 1)
    })

    return () => {
      socket.disconnect()
    }
  }, [userId])

  useEffect(() => {
    fetchUnreadCount()
    fetchNotifications()
    const interval = setInterval(() => {
      fetchUnreadCount()
      fetchNotifications()
    }, 60000)
    return () => clearInterval(interval)
  }, [location.pathname])

  const navItems = [
    {
      icon: <LayoutDashboard size={20} />,
      label: 'Dashboard',
      path: '/dashboard',
      roles: ['IT', 'Admin', 'Manager', 'Employee'],
    },
    {
      icon: <Users size={20} />,
      label: 'Employees',
      path: '/employees',
      roles: ['IT', 'Admin', 'Manager'],
    },
    {
      icon: <Smartphone size={20} />,
      label: 'Inventory',
      path: '/inventory',
      roles: ['IT', 'Admin', 'Manager'],
    },
    {
      icon: <ShoppingCart size={20} />,
      label: 'Procurement',
      path: '/procurement',
      roles: ['IT', 'Admin', 'Manager'],
    },
    {
      icon: <Wrench size={20} />,
      label: 'Repairs',
      path: '/repairs',
      roles: ['IT', 'Admin', 'Manager', 'Employee'],
    },
    {
      icon: <ShieldCheck size={20} />,
      label: 'User Management',
      path: '/users',
      roles: ['IT'],
    },
    {
      icon: <MessageSquare size={20} />,
      label: 'Chat',
      path: '/chat',
      roles: ['IT', 'Admin', 'Manager'],
    },
  ]

  const filteredNavItems = navItems.filter((item) => item.roles.includes(userRole))

  return (
    <div className="flex h-screen overflow-hidden">
      <aside 
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        className="w-64 border-r flex flex-col transition-colors duration-300"
      >
        <div className="p-6">
          <div className="flex items-center gap-3">
            <img src="/assets/logo.png" alt="HarisCo Logo" className="w-10 h-10 object-contain" />
            <h1 className="text-xl font-bold tracking-tight">HarisCo</h1>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-semibold">
            Internal Portal
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-harisco-blue/10 text-harisco-blue'
                  : 'text-slate-500 hover:bg-harisco-blue/5 hover:text-harisco-blue'
              }`}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.label === 'Chat' && unreadChatCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  {unreadChatCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <button
            onClick={() => handleLogout()}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header 
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          className="h-16 border-b flex items-center justify-between px-8 z-20 transition-colors duration-300"
        >
          <h2 className="text-lg font-semibold">
            {navItems.find((n) => n.path === location.pathname)?.label || 'Internal Portal'}
          </h2>
          <div className="flex items-center gap-4 relative">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors hover:bg-harisco-blue/5 text-slate-500"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <NotificationPanel
              notifications={notifications}
              unreadCount={unreadNotifCount}
              isOpen={notifOpen}
              onToggle={() => setNotifOpen((v) => !v)}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
            />

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-tight">
                  {userName || 'User'}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-tighter text-harisco-blue">
                  {userRole} AUTHORITY
                </p>
              </div>
              <button
                onClick={() => handleLogout()}
                className="w-9 h-9 bg-harisco-blue text-white rounded-lg flex items-center justify-center font-bold shadow-sm hover:bg-red-600 transition-colors group relative"
                title="Logout"
              >
                <span>{(userName || 'U').charAt(0).toUpperCase()}</span>
                <div className="absolute inset-0 bg-red-600 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <LogOut size={16} />
                </div>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
