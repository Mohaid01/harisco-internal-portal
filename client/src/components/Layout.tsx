import React, { useState, useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Smartphone,
  Wrench,
  LogOut,
  Bell,
  ShoppingCart,
  Loader2,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { API_BASE, WS_URL } from '../config'

interface LayoutProps {
  onLogout: () => void
  userRole: string
  userName: string
  onRoleChange: (role: any) => void
  userId: string
}

const INACTIVITY_LIMIT = 30 * 60 * 1000 // 30 minutes

const Layout: React.FC<LayoutProps> = ({ onLogout, userRole, userName, userId }) => {
  const location = useLocation()
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [isNotifLoading, setIsNotifLoading] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)

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
          performedBy: userName
        }),
      })
    } catch (e) {}

    if (isTimeout) {
      sessionStorage.setItem('logoutMessage', 'You have been logged out due to inactivity.')
    }

    onLogout()
  }

  // Fetch Notifications
  const fetchNotifications = async () => {
    try {
      setIsNotifLoading(true)
      const token = localStorage.getItem('token')

      const [resActivity, resChat] = await Promise.all([
        fetch(`${API_BASE}/activity`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/chat/unread-messages`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const activities = await resActivity.json()
      const unreadChats = await resChat.json()

      // Combine and sort by timestamp
      const combined = [...unreadChats, ...activities.slice(0, 10)]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8)

      setNotifications(combined)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setIsNotifLoading(false)
    }
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

  useEffect(() => {
    fetchUnreadCount()

    // Set up Socket for real-time unread updates
    const socket: Socket = io(WS_URL)
    socket.on('connect', () => {
      if (userId) socket.emit('register', parseInt(userId))
    })

    socket.on('receive_message', () => {
      // Refresh count when a new message arrives
      fetchUnreadCount()
    })

    return () => {
      socket.disconnect()
    }
  }, [userId])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000) // Poll every minute as fallback
    return () => clearInterval(interval)
  }, [location.pathname])

  useEffect(() => {
    if (showNotifications) {
      fetchNotifications()
    }
  }, [showNotifications])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Karachi',
    })
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <img src="/assets/logo.png" alt="HarisCo Logo" className="w-10 h-10 object-contain" />
            <h1 className="text-xl font-bold tracking-tight text-slate-800">HarisCo</h1>
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
                  ? 'bg-harisco-light text-harisco-blue'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => handleLogout()}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-20">
          <h2 className="text-lg font-semibold text-slate-700">
            {navItems.find((n) => n.path === location.pathname)?.label || 'Internal Portal'}
          </h2>
          <div className="flex items-center gap-4 relative">
            {userRole !== 'Employee' && (
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`relative p-2 rounded-full transition-colors ${showNotifications ? 'bg-slate-100 text-harisco-blue' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Bell size={20} />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl py-2 animate-in fade-in zoom-in duration-150 origin-top-right">
                    <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Recent System Activity
                      </span>
                      {isNotifLoading && (
                        <Loader2 size={12} className="animate-spin text-harisco-blue" />
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 cursor-pointer"
                          >
                            <p className="text-xs text-slate-800 font-medium">{notif.details}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {formatTime(notif.timestamp)} • {notif.action}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-xs text-slate-400">
                          No recent activity
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="h-8 w-px bg-slate-200 mx-2"></div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  {userName || 'User'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter text-harisco-blue">
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
