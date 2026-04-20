import React, { useEffect, useRef } from 'react'
import { Bell, X, CheckCheck, Zap, ClipboardCheck, Cpu, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../config'

interface Notification {
  id: number
  type: string
  title: string
  message: string
  link?: string | null
  isRead: boolean
  createdAt: string
}

interface NotificationPanelProps {
  notifications: Notification[]
  unreadCount: number
  isOpen: boolean
  onToggle: () => void
  onMarkRead: (id: number) => void
  onMarkAllRead: () => void
}

const typeIcon = (type: string) => {
  switch (type) {
    case 'APPROVAL_REQUIRED': return <Zap size={14} className="text-amber-500" />
    case 'REQUEST_UPDATED':   return <ClipboardCheck size={14} className="text-green-500" />
    case 'DEVICE_ASSIGNED':   return <Cpu size={14} className="text-blue-500" />
    case 'DIGEST':            return <BarChart3 size={14} className="text-purple-500" />
    default:                  return <Bell size={14} className="text-slate-400" />
  }
}

const typeStyle = (type: string) => {
  switch (type) {
    case 'APPROVAL_REQUIRED': return 'border-l-amber-400'
    case 'REQUEST_UPDATED':   return 'border-l-green-400'
    case 'DEVICE_ASSIGNED':   return 'border-l-blue-400'
    case 'DIGEST':            return 'border-l-purple-400'
    default:                  return 'border-l-slate-300'
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  unreadCount,
  isOpen,
  onToggle,
  onMarkRead,
  onMarkAllRead,
}) => {
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onToggle()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onToggle])

  const handleClick = (notif: Notification) => {
    onMarkRead(notif.id)
    if (notif.link) navigate(notif.link)
    onToggle()
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={onToggle}
        className="relative p-2 rounded-lg transition-colors hover:bg-harisco-blue/5 text-slate-500"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute right-0 top-12 w-96 rounded-2xl shadow-2xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-harisco-blue" />
              <h3 className="font-bold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-harisco-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="text-[11px] text-harisco-blue hover:underline flex items-center gap-1"
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
              <button onClick={onToggle} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-harisco-blue/5">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[420px] overflow-y-auto divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {notifications.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <Bell size={28} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`w-full text-left px-4 py-3 border-l-4 transition-colors ${typeStyle(notif.type)} ${
                    notif.isRead
                      ? 'opacity-60 hover:opacity-80 hover:bg-harisco-blue/5'
                      : 'hover:bg-harisco-blue/5'
                  }`}
                  style={!notif.isRead ? { backgroundColor: 'var(--bg-body)' } : {}}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{typeIcon(notif.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-bold truncate ${!notif.isRead ? 'text-slate-900 dark:text-slate-100' : ''}`}>
                          {notif.title}
                        </p>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-harisco-blue shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationPanel
