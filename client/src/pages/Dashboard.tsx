import React, { useState, useEffect } from 'react'
import {
  Users,
  Smartphone,
  Wrench,
  AlertCircle,
  Loader2,
  Activity,
  X,
  Calendar,
  Download,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import Button from '../components/ui/Button'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { API_BASE } from '../config'
import { useLoading } from '../context/LoadingContext'

interface ActivityLog {
  id: number
  action: string
  details: string
  performedBy: string
  timestamp: string
}

interface Device {
  id: number
  serial: string
  model: string
  type: string
  status: string
  assignedTo?: string
}

interface DashboardProps {
  userRole: string
  userName: string
}

const Dashboard: React.FC<DashboardProps> = ({ userRole, userName }) => {
  const { withLoading } = useLoading()
  const [stats, setStats] = useState({
    employees: 0,
    devices: 0,
    repairs: 0,
    procurements: 0,
  })
  const [inventoryStats, setInventoryStats] = useState<any[]>([])
  const [activeRequests, setActiveRequests] = useState<any[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [allActivities, setAllActivities] = useState<ActivityLog[]>([])
  const [userDevices, setUserDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAllModal, setShowAllModal] = useState(false)

  // Filter states
  const [filterType, setFilterType] = useState('ALL')
  const [filterTimeRange, setFilterTimeRange] = useState('ALL')

  const fetchData = async () => {
    withLoading(async () => {
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

        const filteredUserDevices = dev.filter(
          (d: any) =>
            d.assignedTo &&
            (d.assignedTo === userName || d.assignedTo === localStorage.getItem('userEmail')),
        )
        setUserDevices(filteredUserDevices)

        // Aggregate Inventory Stats
        const invSummary = [
          {
            name: 'In Stock',
            value: dev.filter((d: any) => d.status === 'IN_STOCK').length,
            color: '#10b981',
          },
          {
            name: 'Issued',
            value: dev.filter((d: any) => d.status === 'ISSUED').length,
            color: '#3b82f6',
          },
          {
            name: 'In Repair',
            value: dev.filter((d: any) => d.status === 'REPAIR').length,
            color: '#f59e0b',
          },
        ].filter((s) => s.value > 0)
        setInventoryStats(invSummary)

        // Aggregate Active Requests for the user
        const userRepairs = rep
          .filter(
            (r: any) =>
              r.requester === userName && r.status !== 'RESOLVED' && r.status !== 'REJECTED',
          )
          .map((r: any) => ({ ...r, type: 'REPAIR' }))

        const userProcurements = pro
          .filter(
            (p: any) =>
              p.requestedBy === userName && p.status !== 'PURCHASED' && p.status !== 'REJECTED',
          )
          .map((p: any) => ({ ...p, type: 'PROCUREMENT' }))

        const allActive = [...userRepairs, ...userProcurements]
          .sort(
            (a, b) =>
              new Date(b.createdAt || b.timestamp).getTime() -
              new Date(a.createdAt || a.timestamp).getTime(),
          )
          .slice(0, 5)
        setActiveRequests(allActive)

        if (userRole === 'Employee') {
          // Employees only see their own repairs and procurements
          setStats({
            employees: 0,
            devices: 0,
            repairs: userRepairs.length,
            procurements: userProcurements.length,
          })
          setAllActivities(act)
          setActivities(act.slice(0, 6))
        } else {
          setStats({
            employees: emp.length,
            devices: dev.filter((d: any) => d.status === 'IN_STOCK').length,
            repairs: rep.filter(
              (r: any) =>
                r.status !== 'APPROVED' && r.status !== 'REJECTED' && r.status !== 'RESOLVED',
            ).length,
            procurements: pro.filter(
              (p: any) => p.status !== 'PURCHASED' && p.status !== 'REJECTED',
            ).length,
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
    })
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
      roles: ['IT', 'Admin', 'Manager'],
    },
    {
      label: 'Devices in Stock',
      value: stats.devices,
      icon: <Smartphone className="text-green-600" />,
      trend: 'Available assets',
      roles: ['IT', 'Admin', 'Manager'],
    },
    {
      label: 'Active Repairs',
      value: stats.repairs,
      icon: <Wrench className="text-amber-600" />,
      trend: 'Pending IT/Admin',
      roles: ['IT', 'Admin', 'Manager'],
    },
    {
      label: 'Pending Procurements',
      value: stats.procurements,
      icon: <AlertCircle className="text-red-600" />,
      trend: 'Approval pipeline',
      roles: ['IT', 'Admin', 'Manager'],
    },
  ].filter((card) => !card.roles || card.roles.includes(userRole))

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return date.toLocaleDateString('en-US', { timeZone: 'Asia/Karachi' })
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
      new Date(act.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Karachi' }),
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
    doc.text(
      `Generated on: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })}`,
      14,
      30,
    )
    doc.text(`Filters: Time (${filterTimeRange}) | Type (${filterType})`, 14, 36)

    const tableData = filteredActivities.map((act) => [
      new Date(act.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Karachi' }),
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

  const getRequestStep = (req: any) => {
    const status = req.status
    if (status === 'REJECTED') return 1
    
    // Calculate signature count
    let sigs = 0
    if (req.itApproved) sigs++
    if (req.adminApproved) sigs++
    if (req.managerApproved) sigs++

    if (req.type === 'REPAIR') {
      if (status === 'RESOLVED') return 4
      if (status === 'IN_REPAIR' || status === 'APPROVED') return 3
      if (sigs > 0) return 2
      return 1
    } else {
      if (status === 'PURCHASED') return 4
      if (status === 'APPROVED') return 3
      if (sigs > 0) return 2
      return 1
    }
  }

  const steps = ['Received', 'Review', 'Action', 'Ready']

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-4">
        <Loader2 className="animate-spin" size={48} />
        <p className="text-sm font-medium">Synchronizing portal data...</p>
      </div>
    )
  }

  const getStatColors = (label: string) => {
    switch (label) {
      case 'Total Employees': return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
      case 'Devices in Stock': return 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'
      case 'Active Repairs': return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
      case 'Pending Procurements': return 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
      default: return 'bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400'
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.label} className="card flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-2">{stat.trend}</p>
            </div>
            <div className={`p-3 rounded-lg [&>svg]:w-6 [&>svg]:h-6 ${getStatColors(stat.label)}`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activities */}
        <div className="lg:col-span-2 space-y-8">
          {userRole === 'Employee' && activeRequests.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Clock size={18} className="text-harisco-blue" />
                  Request Status Timeline
                </h3>
                <span className="text-xs text-slate-400 font-medium">Active Requests</span>
              </div>
              <div className="space-y-8">
                {activeRequests.map((req) => {
                  const currentStep = getRequestStep(req)
                  return (
                    <div key={req.id} className="relative">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <span className="text-[10px] font-bold text-harisco-blue uppercase tracking-widest px-2 py-0.5 bg-harisco-light rounded mb-1 inline-block">
                            {req.type === 'REPAIR'
                              ? `REPAIR: ${req.device?.model}`
                              : `PROCUREMENT: ${req.item}`}
                          </span>
                          <p className="text-xs text-slate-500 italic">
                            Current Status: {req.status.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between relative">
                        {/* Progress Line */}
                        <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-100 -z-0"></div>
                        <div
                          className="absolute top-4 left-0 h-0.5 bg-harisco-blue transition-all duration-500 -z-0"
                          style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                        ></div>

                        {steps.map((step, idx) => {
                          const stepNum = idx + 1
                          const isCompleted = currentStep > stepNum
                          const isCurrent = currentStep === stepNum

                          return (
                            <div
                              key={step}
                              className="flex flex-col items-center relative z-10 bg-white px-2"
                            >
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                                  isCompleted
                                    ? 'bg-harisco-blue border-harisco-blue text-white'
                                    : isCurrent
                                      ? 'bg-white border-harisco-blue text-harisco-blue'
                                      : 'bg-white border-slate-200 text-slate-300'
                                }`}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 size={16} />
                                ) : (
                                  <span className="text-xs font-bold">{stepNum}</span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] mt-2 font-bold uppercase tracking-tighter ${
                                  isCurrent ? 'text-harisco-blue' : 'text-slate-400'
                                }`}
                              >
                                {step}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Activity size={18} className="text-harisco-blue" />
                Recent Activity Log
              </h3>
              <button
                onClick={() => setShowAllModal(true)}
                className="text-xs text-harisco-blue font-bold hover:underline"
              >
                View All
              </button>
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
                      <p className="text-[10px] text-harisco-blue font-bold uppercase tracking-wider mt-1 opacity-70">
                        {act.details.toLowerCase().includes('inactivity') ||
                        act.details.toLowerCase().includes('auto')
                          ? `Auto Performed by: ${act.performedBy || 'System'}`
                          : `Performed by: ${act.performedBy || 'System'}`}
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
        </div>

        <div className="space-y-8">
          {userRole !== 'Employee' && inventoryStats.length > 0 && (
            <div className="card">
              <h3 className="text-base font-bold flex items-center gap-2 mb-6">
                <Smartphone size={18} className="text-harisco-blue" />
                Inventory Health
              </h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventoryStats}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {inventoryStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {inventoryStats.map((stat) => (
                  <div
                    key={stat.name}
                    className="text-center p-2 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      {stat.name}
                    </p>
                    <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {userDevices.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Smartphone size={18} className="text-harisco-blue" />
                  Your Devices
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">
                  {userDevices.length} Total
                </span>
              </div>
              <div className="space-y-3">
                {userDevices.map((device) => (
                  <div
                    key={device.id}
                    className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-harisco-blue/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-200 text-slate-400 group-hover:text-harisco-blue transition-colors shadow-sm shrink-0">
                        <Smartphone size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{device.model}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate">
                          {device.serial}
                        </p>
                      </div>
                      <span
                        className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0 ${
                          device.status === 'REPAIR'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {device.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                          {new Date(act.timestamp).toLocaleString('en-US', {
                            timeZone: 'Asia/Karachi',
                          })}
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
