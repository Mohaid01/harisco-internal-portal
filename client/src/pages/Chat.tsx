import React, { useState, useEffect, useRef } from 'react'
import { Send, User as UserIcon, Check, CheckCheck, Search, MoreVertical, MessageSquare } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { API_BASE, WS_URL } from '../config'

interface User {
  id: number
  name: string
  email: string
  role: string
  online?: boolean
  unreadCount?: number
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

const Chat: React.FC<ChatProps> = ({ userId, userName, userRole }) => {
  const [users, setUsers] = useState<User[]>([])
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
    // Initialize Socket
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
        // Mark as read immediately if we're in the chat
        socketRef.current?.emit('mark_read', {
          senderId: message.senderId,
          receiverId: currentUserId
        })
        // Also call the API to persist the read status
        markMessagesAsRead(message.senderId)
      } else {
        // Increment unread count for other users
        setUsers((prev) =>
          prev.map((u) =>
            u.id === message.senderId ? { ...u, unreadCount: (u.unreadCount || 0) + 1 } : u
          )
        )
      }
    })

    socketRef.current.on('message_sent', (message: Message) => {
      setMessages((prev) => [...prev, message])
    })

    socketRef.current.on('messages_read', (data: { byUserId: number }) => {
      const activeUser = selectedUserRef.current
      if (activeUser && data.byUserId === activeUser.id) {
        setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })))
      }
    })

    // Fetch initial users
    fetchUsers()

    return () => {
      socketRef.current?.disconnect()
    }
  }, [userId]) // Run on mount or when userId changes

  // Fetch users whenever userId changes
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/chat/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      console.error('Failed to fetch chat users:', error)
    }
  }

  // Fetch history when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      fetchHistory(selectedUser.id)
      // Reset unread count
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, unreadCount: 0 } : u))
      )
      // Mark as read in DB
      markMessagesAsRead(selectedUser.id)
    }
  }, [selectedUser])

  const fetchHistory = async (otherUserId: number) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/chat/history/${otherUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
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
        headers: { Authorization: `Bearer ${token}` }
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
      content: newMessage
    })

    setNewMessage('')
  }

  const filteredUsers = users.filter((u) =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-harisco-blue/20 outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className={`w-full p-4 flex items-center gap-3 transition-all cursor-pointer border-b border-slate-50 ${
                selectedUser?.id === user.id 
                  ? 'bg-blue-50 border-r-4 border-harisco-blue shadow-inner' 
                  : 'hover:bg-slate-100'
              }`}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                  <UserIcon size={24} />
                </div>
              </div>
              <div className="flex-1 text-left">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-bold text-slate-800 leading-none">{user.name || user.email}</h4>
                  {user.unreadCount ? (
                    <span className="bg-harisco-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {user.unreadCount}
                    </span>
                  ) : null}
                </div>
                <p className="text-[10px] text-harisco-blue font-bold uppercase tracking-wider mt-1">{user.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <UserIcon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedUser.name || selectedUser.email}</h3>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50">
                <MoreVertical size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
              {messages.length > 0 ? (
                messages.map((msg, index) => {
                  const isMine = msg.senderId === currentUserId
                  return (
                    <div key={msg.id || index} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] p-4 rounded-2xl shadow-sm ${
                          isMine
                            ? 'bg-harisco-blue text-white rounded-tr-none'
                            : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[10px] ${isMine ? 'text-white/70' : 'text-slate-400'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMine && (
                            msg.isRead ? (
                              <CheckCheck size={14} className="text-white" />
                            ) : (
                              <Check size={14} className="text-white/70" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <MessageSquare size={48} className="opacity-20" />
                  <p className="text-sm">No messages yet. Say hi!</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-harisco-blue/20 outline-none transition-all"
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
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
              <UserIcon size={40} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Your Messages</h3>
            <p className="text-slate-500 text-sm max-w-xs mt-2">
              Select a user from the sidebar to start a secure one-on-one conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Chat
