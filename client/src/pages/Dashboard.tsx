import React, { useState, useEffect } from 'react'
import {
  Users,
  Smartphone,
  Wrench,
  AlertCircle,
  Loader2,
  Activity,
  Filter,
  Search,
  X,
  Calendar,
  Download,
} from 'lucide-react'
import Button from '../components/ui/Button'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const API_BASE = 'http://localhost:5000/api'

interface ActivityLog {
  id: number
  action: string
  details: string
  performedBy: string
  timestamp: string
}

interface DashboardProps {
  userRole: string
}

const Dashboard: React.FC<DashboardProps> = ({ userRole }) => {
  const [stats, setStats] = useState({
    employees: 0,
    devices: 0,
    repairs: 0,
    procurements: 0,
  })
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [allActivities, setAllActivities] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAllModal, setShowAllModal] = useState(false)

  // Filter states
  const [filterType, setFilterType] = useState('ALL')
  const [filterTimeRange, setFilterTimeRange] = useState('ALL')

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const [emp, dev, rep, pro, act] = await Promise.all([
        fetch(`${API_BASE}/employees`, { headers }).then((r) => r.json()),
        fetch(`${API_BASE}/inventory`, { headers }).then((r) => r.json()),
        fetch(`${API_BASE}/repairs`, { headers }).then((r) => r.json()),
        fetch(`${API_BASE}/procurement`, { headers }).then((r) => r.json()),
        fetch(`${API_BASE}/activity`, { headers }).then((r) => r.json()),
      ])

      if (userRole === 'Employee') {
        // Employees only see their own repairs and procurements
        setStats({
          employees: 0,
          devices: 0,
          repairs: rep.filter((r: any) => r.status !== 'APPROVED' && r.status !== 'REJECTED')
            .length, // Filter by requester later
          procurements: pro.filter((p: any) => p.status !== 'PURCHASED').length, // Filter by requester later
        })
        setAllActivities(act.filter((a: any) => a.performedBy?.includes('Employee')))
        setActivities(act.filter((a: any) => a.performedBy?.includes('Employee')).slice(0, 6))
      } else {
        setStats({
          employees: emp.length,
          devices: dev.filter((d: any) => d.status === 'IN_STOCK').length,
          repairs: rep.filter((r: any) => r.status !== 'APPROVED' && r.status !== 'REJECTED')
            .length,
          procurements: pro.filter((p: any) => p.status !== 'PURCHASED').length,
        })

        // IT, Admin, and Manager see all logs
        if (userRole === 'IT' || userRole === 'Admin' || userRole === 'Manager') {
          setAllActivities(act)
          setActivities(act.slice(0, 6))
        } else {
          setAllActivities([])
          setActivities([])
        }
      }

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const statCards = [
    {
      label: 'Total Employees',
      value: stats.employees,
      icon: <Users className="text-blue-600" />,
      trend: 'Active users',
      roles: ['IT', 'DIRECTOR', 'ADMIN'],
    },
    {
      label: 'Devices in Stock',
      value: stats.devices,
      icon: <Smartphone className="text-green-600" />,
      trend: 'Available assets',
      roles: ['IT', 'DIRECTOR', 'ADMIN'],
    },
    {
      label: 'Active Repairs',
      value: stats.repairs,
      icon: <Wrench className="text-amber-600" />,
      trend: 'Pending IT/Admin',
    },
    {
      label: 'Pending Procurements',
      value: stats.procurements,
      icon: <AlertCircle className="text-red-600" />,
      trend: 'Approval pipeline',
    },
  ].filter((card) => !card.roles || card.roles.includes(userRole))

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return date.toLocaleDateString()
  }

  const filteredActivities = allActivities.filter((act) => {
    const matchesType = filterType === 'ALL' || act.action.includes(filterType)

    const actDate = new Date(act.timestamp)
    const now = new Date()
    const diffMs = now.getTime() - actDate.getTime()
    let matchesTime = true

    if (filterTimeRange === '15_MIN') {
      matchesTime = diffMs <= 15 * 60 * 1000
    } else if (filterTimeRange === '1_HOUR') {
      matchesTime = diffMs <= 60 * 60 * 1000
    } else if (filterTimeRange === '4_HOURS') {
      matchesTime = diffMs <= 4 * 60 * 60 * 1000
    } else if (filterTimeRange === 'TODAY') {
      matchesTime = actDate.toDateString() === now.toDateString()
    } else if (filterTimeRange === 'LAST_7_DAYS') {
      const lastWeek = new Date()
      lastWeek.setDate(now.getDate() - 7)
      matchesTime = actDate >= lastWeek
    }

    return matchesType && matchesTime
  })

  const exportToCSV = () => {
    if (filteredActivities.length === 0) return
    const headers = ['Timestamp', 'User', 'Action', 'Details']
    const rows = filteredActivities.map((act) => [
      new Date(act.timestamp).toLocaleString(),
      act.performedBy || 'System',
      act.action,
      act.details.replace(/,/g, ' '), // Remove commas to avoid breaking CSV format
    ])

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `harisco_audit_log_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToPDF = () => {
    if (filteredActivities.length === 0) return
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text('HarisCo Internal Portal - Audit Log', 14, 22)

    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30)
    doc.text(`Filters: Time (${filterTimeRange}) | Type (${filterType})`, 14, 36)

    const tableData = filteredActivities.map((act) => [
      new Date(act.timestamp).toLocaleString(),
      act.performedBy || 'System',
      act.action,
      act.details,
    ])

    autoTable(doc, {
      startY: 45,
      head: [['Timestamp', 'User', 'Action', 'Details']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [43, 76, 126] }, // HarisCo Blueish
      styles: { fontSize: 9 },
      columnStyles: { 3: { cellWidth: 80 } },
    })

    doc.save(`harisco_audit_log_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-4">
        <Loader2 className="animate-spin" size={48} />
        <p className="text-sm font-medium">Synchronizing portal data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.label} className="card flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-2">{stat.trend}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">{stat.icon}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activities */}
        {(userRole === 'IT' || userRole === 'DIRECTOR' || userRole === 'STAFF') && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Activity size={18} className="text-harisco-blue" />
                Recent Activity Log
              </h3>
              {(userRole === 'IT' || userRole === 'DIRECTOR') && (
                <button
                  onClick={() => setShowAllModal(true)}
                  className="text-xs text-harisco-blue font-bold hover:underline"
                >
                  View All
                </button>
              )}
            </div>
            <div className="space-y-6">
              {activities.length > 0 ? (
                activities.map((act) => (
                  <div key={act.id} className="flex gap-4 group">
                    <div
                      className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${act.action === 'LOGOUT' ? 'bg-red-400' : 'bg-harisco-blue'} group-hover:scale-125 transition-transform`}
                    ></div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="text-sm text-slate-800 leading-snug">
                          <span className="font-bold text-slate-900">{act.action}:</span>{' '}
                          {act.details}
                        </p>
                        <span className="text-[10px] text-slate-400 font-medium ml-2 whitespace-nowrap">
                          {formatRelativeTime(act.timestamp)}
                        </span>
                      </div>
                      <p className="text-[10px] text-harisco-blue font-bold uppercase tracking-wider mt-1">
                        Performed by: {act.performedBy || 'System'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-400 py-12 text-sm">
                  No activity recorded yet.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="card bg-slate-900 text-white border-none shadow-harisco overflow-hidden relative">
            <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-harisco-blue/20 rounded-full blur-3xl"></div>
            <h3 className="text-base font-bold mb-4 relative z-10">Portal Status</h3>
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-sm opacity-70">Database Connection</span>
                <span className="flex items-center gap-2 text-xs font-bold text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  STABLE
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm opacity-70">Automated Backups</span>
                <span className="text-xs font-bold">DAILY (00:00)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View All Activities Modal */}
      {showAllModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="text-harisco-blue" />
                  Full System Audit Log
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Detailed history of all actions performed in the portal.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="text-xs py-1.5" onClick={exportToCSV}>
                  <Download size={14} className="mr-1.5" /> CSV
                </Button>
                <Button variant="primary" className="text-xs py-1.5" onClick={exportToPDF}>
                  <Download size={14} className="mr-1.5" /> PDF
                </Button>
                <button
                  onClick={() => setShowAllModal(false)}
                  className="ml-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-white border-b border-slate-100 flex gap-4 items-end">
              <div className="w-64">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                  Time Range
                </label>
                <div className="relative">
                  <Calendar
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <select
                    className="input pl-10 py-2"
                    value={filterTimeRange}
                    onChange={(e) => setFilterTimeRange(e.target.value)}
                  >
                    <option value="ALL">All Time</option>
                    <option value="15_MIN">Last 15 Minutes</option>
                    <option value="1_HOUR">Last 1 Hour</option>
                    <option value="4_HOURS">Last 4 Hours</option>
                    <option value="TODAY">Today</option>
                    <option value="LAST_7_DAYS">Last 7 Days</option>
                  </select>
                </div>
              </div>
              <div className="w-56">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                  Activity Type
                </label>
                <select
                  className="input py-2"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="ALL">All Activities</option>
                  <option value="LOGIN">Logins</option>
                  <option value="LOGOUT">Logouts</option>
                  <option value="DEVICE">Inventory</option>
                  <option value="REPAIR">Repairs</option>
                  <option value="PROCUREMENT">Procurement</option>
                  <option value="EMPLOYEE">Employees</option>
                </select>
              </div>
              <Button
                variant="secondary"
                className="px-6"
                onClick={() => {
                  setFilterType('ALL')
                  setFilterTimeRange('ALL')
                }}
              >
                Clear Filters
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActivities.length > 0 ? (
                    filteredActivities.map((act) => (
                      <tr key={act.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-slate-400">
                          {new Date(act.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-harisco-blue uppercase tracking-tight bg-harisco-light px-2 py-0.5 rounded">
                            {act.performedBy || 'System'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                              act.action.includes('REJECT') || act.action === 'LOGOUT'
                                ? 'bg-red-100 text-red-700'
                                : act.action.includes('CREATE') || act.action === 'LOGIN'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {act.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{act.details}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        <Activity size={48} className="mx-auto opacity-10 mb-4" />
                        <p>No audit logs found matching your filters.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
