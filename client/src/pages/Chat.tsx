import React, { useState, useEffect, useRef } from 'react'
import {
  Send,
  User as UserIcon,
  Check,
  CheckCheck,
  Search,
  MoreVertical,
  MessageSquare,
  Plus,
  X,
} from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { API_BASE, WS_URL } from '../config'

interface User {
  id: number
  name: string
  email: string
  role: string
  online?: boolean
  unreadCount?: number
  lastMessageAt?: string | null
  lastMessageContent?: string | null
  lastMessageSenderId?: number | null
}

interface Message {
  id: number
  content: string
  senderId: number
  receiverId: number
  timestamp: string
  isRead: boolean
}

interface ChatProps {
  userId: string
  userName: string
  userRole: string
}

const Chat: React.FC<ChatProps> = ({ userId }) => {
  const [users, setUsers] = useState<User[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [newChatSearch, setNewChatSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const socketRef = useRef<Socket | null>(null)
  const selectedUserRef = useRef<User | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentUserId = parseInt(userId)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    selectedUserRef.current = selectedUser
  }, [selectedUser])

  useEffect(() => {
    socketRef.current = io(WS_URL)

    socketRef.current.on('connect', () => {
      if (!isNaN(currentUserId)) {
        socketRef.current?.emit('register', currentUserId)
      }
    })

    socketRef.current.on('receive_message', (message: Message) => {
      const activeUser = selectedUserRef.current
      if (activeUser && message.senderId === activeUser.id) {
        setMessages((prev) => [...prev, message])
        socketRef.current?.emit('mark_read', {
          senderId: message.senderId,
          receiverId: currentUserId,
        })
        markMessagesAsRead(message.senderId)
      }
      fetchUsers() // Refresh list to update history/unread
    })

    socketRef.current.on('message_sent', (message: Message) => {
      setMessages((prev) => [...prev, message])
      fetchUsers() // Refresh list to ensure partner is in history
    })

    socketRef.current.on('messages_read', (data: { byUserId: number }) => {
      const activeUser = selectedUserRef.current
      if (activeUser && data.byUserId === activeUser.id) {
        setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })))
      }
    })

    fetchUsers()

    return () => {
      socketRef.current?.disconnect()
    }
  }, [userId])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/chat/users?historyOnly=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      console.error('Failed to fetch chat users:', error)
    }
  }

  const fetchAllUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/chat/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setAllUsers(data)
    } catch (error) {
      console.error('Failed to fetch all users:', error)
    }
  }

  useEffect(() => {
    if (showNewChatModal) {
      fetchAllUsers()
    }
  }, [showNewChatModal])

  useEffect(() => {
    if (selectedUser) {
      fetchHistory(selectedUser.id)
      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, unreadCount: 0 } : u)))
      markMessagesAsRead(selectedUser.id)
    }
  }, [selectedUser])

  const fetchHistory = async (otherUserId: number) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/chat/history/${otherUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setMessages(data)
    } catch (error) {
      console.error('Failed to fetch history:', error)
    }
  }

  const markMessagesAsRead = async (senderId: number) => {
    if (isNaN(currentUserId) || isNaN(senderId)) return
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_BASE}/chat/read/${senderId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      socketRef.current?.emit('mark_read', { senderId, receiverId: currentUserId })
    } catch (error) {
      console.error('Failed to mark read:', error)
    }
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedUser || isNaN(currentUserId)) return

    socketRef.current?.emit('send_message', {
      senderId: currentUserId,
      receiverId: selectedUser.id,
      content: newMessage,
    })

    setNewMessage('')
  }

  const sortedUsers = [...users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  )].sort((a, b) => {
    const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    if (dateA !== dateB) return dateB - dateA
    return (a.name || '').localeCompare(b.name || '')
  })

  const filteredAllUsers = allUsers.filter(
    (u) =>
      u.name?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(newChatSearch.toLowerCase()),
  )

  return (
    <div 
      className="flex h-[calc(100vh-140px)] rounded-2xl shadow-sm border overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
    >
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col transition-colors duration-300" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-body)' }}>
        <div className="p-4 border-b transition-colors duration-300" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400">Messages</h3>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="p-1.5 bg-harisco-blue text-white rounded-lg hover:bg-harisco-dark transition-all shadow-sm"
              title="New Chat"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm outline-none transition-all"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sortedUsers.length > 0 ? (
            sortedUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full p-4 flex items-center gap-3 transition-all cursor-pointer border-b ${
                  selectedUser?.id === user.id 
                    ? 'bg-blue-50 dark:bg-harisco-blue/20 border-r-4 border-harisco-blue shadow-inner' 
                    : user.unreadCount 
                      ? 'bg-harisco-blue/5' 
                      : 'hover:bg-harisco-blue/10 dark:hover:bg-white/5'
                }`}
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-slate-500" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <UserIcon size={24} />
                  </div>
                  {user.unreadCount ? (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800 animate-bounce">
                      {user.unreadCount}
                    </span>
                  ) : null}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center">
                    <h4 className={`text-sm font-bold leading-none ${user.unreadCount ? 'text-harisco-blue' : ''}`}>
                      {user.name || user.email}
                    </h4>
                  </div>
                  <p className="text-[10px] text-harisco-blue font-bold uppercase tracking-wider mt-1">
                    {user.role}
                  </p>
                  {user.lastMessageContent && (
                    <p className={`text-xs mt-1 truncate ${user.unreadCount ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-slate-400'}`}>
                      {user.lastMessageSenderId === currentUserId ? 'You: ' : ''}{user.lastMessageContent}
                    </p>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs">No active chats found. Start a new one!</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col transition-colors duration-300" style={{ backgroundColor: 'var(--bg-card)' }}>
        {selectedUser ? (
          <>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400" style={{ backgroundColor: 'var(--bg-body)' }}>
                  <UserIcon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {selectedUser.name || selectedUser.email}
                  </h3>
                  <p className="text-[10px] text-harisco-blue font-bold uppercase tracking-widest">{selectedUser.role}</p>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-harisco-blue/5">
                <MoreVertical size={20} />
              </button>
            </div>

            <div 
              className={`flex-1 overflow-y-auto p-6 transition-colors duration-300 ${messages.length === 0 ? 'flex flex-col items-center justify-center' : 'space-y-4'}`} 
              style={{ backgroundColor: 'var(--bg-body)' }}
            >
              {messages.length > 0 ? (
                <>
                  {messages.map((msg, index) => {
                    const isMine = msg.senderId === currentUserId
                    return (
                      <div
                        key={msg.id || index}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] p-4 rounded-2xl shadow-sm ${
                            isMine
                              ? 'bg-harisco-blue text-white rounded-tr-none'
                              : 'rounded-tl-none border'
                          }`}
                          style={!isMine ? { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' } : {}}
                        >
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <div className={`flex items-center gap-1 mt-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <span className={`text-[10px] ${isMine ? 'text-white/70' : 'text-slate-400'}`}>
                              {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Asia/Karachi'
                              })}
                            </span>
                            {isMine && (msg.isRead ? <CheckCheck size={14} className="text-white" /> : <Check size={14} className="text-white/70" />)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-harisco-blue mb-2">
                    <MessageSquare size={32} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Start Conversation</h4>
                  <p className="text-xs max-w-[200px] text-center">Your messages are encrypted and secure.</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                />
                <button
                  type="submit"
                  className="p-3 bg-harisco-blue text-white rounded-xl hover:bg-harisco-dark transition-all shadow-md active:scale-95"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-slate-200 mb-4" style={{ backgroundColor: 'var(--bg-body)' }}>
              <UserIcon size={40} />
            </div>
            <h3 className="text-lg font-bold">Your Messages</h3>
            <p className="text-slate-500 text-sm max-w-xs mt-2">
              Select a conversation from the sidebar or click the plus button to start a new chat.
            </p>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div 
            className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <h3 className="text-lg font-bold">Start New Conversation</h3>
                <p className="text-xs text-slate-400">Select a team member to message</p>
              </div>
              <button 
                onClick={() => setShowNewChatModal(false)}
                className="p-2 hover:bg-harisco-blue/5 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl text-sm outline-none transition-all"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {filteredAllUsers.length > 0 ? (
                filteredAllUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUser(user)
                      setShowNewChatModal(false)
                    }}
                    className="w-full p-4 flex items-center gap-4 hover:bg-harisco-blue/5 transition-all text-left border-b last:border-0"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400" style={{ backgroundColor: 'var(--bg-body)' }}>
                      <UserIcon size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold leading-none">{user.name || user.email}</h4>
                      <p className="text-[10px] text-harisco-blue font-bold uppercase tracking-widest mt-1">{user.role}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <UserIcon size={32} className="mx-auto mb-2 opacity-10" />
                  <p className="text-xs">No users found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Chat
