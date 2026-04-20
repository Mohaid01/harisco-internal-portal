import React, { useState, useEffect } from 'react'
import {
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Plus,
  X,
  ShieldAlert,
  ClipboardCheck,
  Eye,
} from 'lucide-react'
import Button from '../components/ui/Button'
import { API_BASE } from '../config'
import { useLoading } from '../context/LoadingContext'

interface Device {
  id: number
  model: string
  serial: string
  status: string
  assignedTo?: string
}

interface Employee {
  id: number
  name: string
}

interface RepairRequest {
  id: number
  deviceId: number
  device: { model: string; serial: string }
  requester: string
  description: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_REPAIR' | 'RESOLVED'
  itApproved: boolean
  adminApproved: boolean
  managerApproved: boolean
  repairType?: 'IN_HOUSE' | 'VENDOR' | null
  vendorName?: string | null
  vendorContact?: string | null
  repairCost?: string | null
  receiptUrl?: string | null
  fixDetails?: string | null
  partsReplaced?: string | null
  resolvedAt?: string | null

  createdAt: string
}

interface RepairsProps {
  userRole: string
  userName: string
}

const Repairs: React.FC<RepairsProps> = ({ userRole, userName }) => {
  const { withLoading } = useLoading()
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedRepair, setSelectedRepair] = useState<RepairRequest | null>(null)
  const [repairs, setRepairs] = useState<RepairRequest[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showReceiptPreview, setShowReceiptPreview] = useState(false)

  // Form states (New Repair)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [requester, setRequester] = useState('')
  const [description, setDescription] = useState('')

  // Form states (Resolve Repair)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [repairType, setRepairType] = useState<'IN_HOUSE' | 'VENDOR'>('IN_HOUSE')
  const [fixDetails, setFixDetails] = useState('')
  const [partsReplaced, setPartsReplaced] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [vendorContact, setVendorContact] = useState('')
  const [repairCost, setRepairCost] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const fetchRepairs = async () => {
    withLoading(async () => {
      try {
        setIsLoading(true)
        const token = localStorage.getItem('token')
        const headers = { Authorization: `Bearer ${token}` }
        const [repRes, devRes, empRes] = await Promise.all([
          fetch(`${API_BASE}/repairs`, { headers }),
          fetch(`${API_BASE}/inventory`, { headers }),
          fetch(`${API_BASE}/employees`, { headers }),
        ])
        const [repData, devData, empData] = await Promise.all([
          repRes.json(),
          devRes.json(),
          empRes.json(),
        ])
        if (userRole === 'Employee') {
          setRepairs(repData.filter((r: any) => r.requester === userName))
        } else {
          setRepairs(repData)
        }
        setDevices(devData)
        setEmployees(empData)
      } catch (error) {
        console.error('Failed to fetch repairs:', error)
      } finally {
        setIsLoading(false)
      }
    })
  }

  useEffect(() => {
    fetchRepairs()
  }, [])

  const handleUpdateStatus = async (id: number, action: 'APPROVE' | 'REJECT') => {
    await withLoading(async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_BASE}/repairs/${id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action }),
        })
        if (res.ok) {
          const updated = await res.json()
          fetchRepairs()
          setSelectedRepair(updated)
        }
      } catch (error) {
        console.error('Failed to update status:', error)
      }
    })
  }

  const handleInRepair = async (id: number) => {
    await withLoading(async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_BASE}/repairs/${id}/in-repair`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const updated = await res.json()
          fetchRepairs()
          setSelectedRepair(updated)
        }
      } catch (error) {
        console.error('Failed to mark as in-repair:', error)
      }
    })
  }

  const handleResolveSubmit = async () => {
    if (!selectedRepair) return
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('repairType', repairType)
    formData.append('fixDetails', fixDetails)
    if (partsReplaced) formData.append('partsReplaced', partsReplaced)

    if (repairType === 'VENDOR') {
      formData.append('vendorName', vendorName)
      formData.append('vendorContact', vendorContact)
      formData.append('repairCost', repairCost)
      if (receiptFile) {
        formData.append('receiptImage', receiptFile)
      }
    }

    await withLoading(async () => {
      try {
        const res = await fetch(`${API_BASE}/repairs/${selectedRepair.id}/resolve`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })

        if (res.ok) {
          const updated = await res.json()
          setShowResolveModal(false)
          fetchRepairs()
          setSelectedRepair(updated)
          // Reset form
          setRepairType('IN_HOUSE')
          setFixDetails('')
          setPartsReplaced('')
          setVendorName('')
          setVendorContact('')
          setRepairCost('')
          setReceiptFile(null)
        } else {
          console.error('Failed to resolve repair')
        }
      } catch (error) {
        console.error('Failed to submit resolution:', error)
      }
    })
  }

  const handleNewRepairSubmit = async () => {
    const finalRequester = userRole === 'Employee' ? userName : requester
    if (!selectedDevice || !finalRequester || !description) return

    await withLoading(async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_BASE}/repairs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            deviceId: selectedDevice.id,
            requester: finalRequester,
            description,
            performedBy: `${userRole} Authority`,
          }),
        })

        if (res.ok) {
          setShowAddModal(false)
          fetchRepairs()
          // Reset form
          setSelectedDevice(null)
          setRequester('')
          setDescription('')
        }
      } catch (error) {
        console.error('Failed to submit repair:', error)
      }
    })
  }

  const canApprove = (req: RepairRequest) => {
    if (userRole === 'IT' && !req.itApproved) return true
    if (userRole === 'Admin' && !req.adminApproved) return true
    if (userRole === 'Manager' && !req.managerApproved) return true
    return false
  }

  const getStatusInfo = (status: RepairRequest['status']) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Awaiting Approvals', icon: <Clock size={14} />, color: 'bg-blue-100 text-blue-700' }
      case 'REJECTED':
        return { label: 'Rejected', icon: <XCircle size={14} />, color: 'bg-red-100 text-red-700' }
      case 'APPROVED':
        return {
          label: 'Fully Approved',
          icon: <ClipboardCheck size={14} />,
          color: 'bg-green-100 text-green-700',
        }
      case 'IN_REPAIR':
        return {
          label: 'In Repair',
          icon: <Wrench size={14} />,
          color: 'bg-indigo-100 text-indigo-700',
        }
      case 'RESOLVED':
        return {
          label: 'Resolved',
          icon: <CheckCircle2 size={14} />,
          color: 'bg-emerald-100 text-emerald-700',
        }
      default:
        return { label: status, icon: <Clock size={14} />, color: 'bg-slate-100' }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-lg">Repair Management</h3>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
          <Plus size={18} />
          New Repair Request
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Repair List */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              {userRole === 'Employee' ? 'Your Active Requests' : 'Active Requests'}
            </h3>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-500 font-medium">
                Total: {repairs.length}
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
              <Loader2 className="animate-spin" size={32} />
              <p>Loading repairs...</p>
            </div>
          ) : (
            repairs.map((repair) => (
              <div
                key={repair.id}
                onClick={() => setSelectedRepair(repair)}
                className={`card !p-0 cursor-pointer transition-all hover:border-harisco-blue/30 ${selectedRepair?.id === repair.id ? 'ring-2 ring-harisco-blue/20 border-harisco-blue' : ''}`}
              >
                <div className="p-5 flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                      <Wrench size={22} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        REP-{repair.id} — {repair.device.model}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Requested by <span className="font-semibold">{repair.requester}</span>
                      </p>
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusInfo(repair.status).color}`}
                  >
                    {getStatusInfo(repair.status).icon}
                    {getStatusInfo(repair.status).label}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Details / Approval Panel */}
        <div className="card h-fit sticky top-0">
          {selectedRepair ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Request Details</h3>
                <p className="text-xs text-slate-400 font-mono mt-1">REP-{selectedRepair.id}</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Device</span>
                    <span className="text-xs font-semibold">{selectedRepair.device.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Serial</span>
                    <span className="text-xs font-mono">{selectedRepair.device.serial}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Problem Description
                  </label>
                  <p className="text-sm text-slate-700 mt-2 bg-slate-50 p-4 rounded-lg border border-slate-100 italic">
                    "{selectedRepair.description}"
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-2 tracking-wider">Approval Checklist</p>
                  <div className="flex flex-wrap gap-2">
                    <div className={`px-2 py-1 rounded flex items-center gap-1.5 text-[10px] font-bold border ${selectedRepair.itApproved ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      IT {selectedRepair.itApproved ? <CheckCircle2 size={12} /> : null}
                    </div>
                    <div className={`px-2 py-1 rounded flex items-center gap-1.5 text-[10px] font-bold border ${selectedRepair.adminApproved ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      ADMIN {selectedRepair.adminApproved ? <CheckCircle2 size={12} /> : null}
                    </div>
                    <div className={`px-2 py-1 rounded flex items-center gap-1.5 text-[10px] font-bold border ${selectedRepair.managerApproved ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      MANAGER {selectedRepair.managerApproved ? <CheckCircle2 size={12} /> : null}
                    </div>
                  </div>
                </div>

                {selectedRepair.status === 'PENDING' && (
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    {canApprove(selectedRepair) ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={() => handleUpdateStatus(selectedRepair.id, 'REJECTED')}
                          variant="danger"
                          className="w-full flex items-center justify-center gap-2 text-xs"
                        >
                          <XCircle size={16} />
                          Reject Request
                        </Button>
                        <Button
                          onClick={() => handleUpdateStatus(selectedRepair.id, 'APPROVE')}
                          className="w-full flex items-center justify-center gap-2 text-xs"
                        >
                          <CheckCircle2 size={16} />
                          Approve Stage
                        </Button>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
                        <ShieldAlert size={18} className="text-slate-400" />
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                            Sign-off Required
                          </p>
                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                            {userRole === 'Employee' 
                              ? 'Waiting for IT, Admin, and Manager sign-off.' 
                              : 'You have already signed off or lack authority for this request.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedRepair.status === 'APPROVED' && (
                  <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                    <p className="text-xs text-green-700 font-medium flex items-center gap-2">
                      <CheckCircle2 size={14} />
                      Request fully approved. Move to Repair Phase.
                    </p>
                    {userRole === 'IT' || userRole === 'Admin' ? (
                      <div className={`grid ${userRole === 'IT' ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mt-3`}>
                        {userRole === 'IT' && (
                          <Button
                            onClick={() => {
                              setRepairType('IN_HOUSE')
                              setShowResolveModal(true)
                            }}
                            className="flex items-center justify-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white py-2"
                          >
                            <CheckCircle2 size={14} />
                            Fix In-House
                          </Button>
                        )}
                        <Button
                          onClick={() => handleInRepair(selectedRepair.id)}
                          className="flex items-center justify-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white py-2"
                        >
                          <Wrench size={14} />
                          Send to Vendor
                        </Button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic mt-2">
                        Only Admin or IT can start the repair process.
                      </p>
                    )}
                  </div>
                )}

                {selectedRepair.status === 'RESOLVED' && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-2">
                      <CheckCircle2 size={16} /> Resolution Details
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="block text-emerald-600/70 font-semibold mb-0.5 uppercase tracking-wider text-[9px]">
                          Repair Type
                        </span>
                        <span className="font-medium text-emerald-900">
                          {selectedRepair.repairType === 'VENDOR'
                            ? 'External Vendor'
                            : 'In-House IT'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-emerald-600/70 font-semibold mb-0.5 uppercase tracking-wider text-[9px]">
                          Resolved Date
                        </span>
                        <span className="font-medium text-emerald-900">
                          {selectedRepair.resolvedAt
                            ? new Date(selectedRepair.resolvedAt).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                      {selectedRepair.repairType === 'VENDOR' && (
                        <>
                          <div>
                            <span className="block text-emerald-600/70 font-semibold mb-0.5 uppercase tracking-wider text-[9px]">
                              Vendor
                            </span>
                            <span className="font-medium text-emerald-900">
                              {selectedRepair.vendorName}
                            </span>
                          </div>
                          <div>
                            <span className="block text-emerald-600/70 font-semibold mb-0.5 uppercase tracking-wider text-[9px]">
                              Cost
                            </span>
                            <span className="font-medium text-emerald-900">
                              PKR {selectedRepair.repairCost}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-emerald-200/50">
                      <span className="block text-emerald-600/70 font-semibold mb-1 uppercase tracking-wider text-[9px]">
                        Fix Details
                      </span>
                      <p className="text-xs text-emerald-900 leading-relaxed">
                        {selectedRepair.fixDetails}
                      </p>
                    </div>
                    {selectedRepair.partsReplaced && (
                      <div className="mt-2 pt-2 border-t border-emerald-200/50">
                        <span className="block text-emerald-600/70 font-semibold mb-1 uppercase tracking-wider text-[9px]">
                          Parts Replaced
                        </span>
                        <p className="text-xs text-emerald-900 leading-relaxed">
                          {selectedRepair.partsReplaced}
                        </p>
                      </div>
                    )}
                    {selectedRepair.receiptUrl && (
                        <div className="col-span-2 pt-2 mt-2 border-t border-emerald-100">
                          <button
                            onClick={() => setShowReceiptPreview(true)}
                            className="flex items-center gap-2 text-[10px] text-harisco-blue font-bold hover:underline"
                          >
                            <Eye size={12} />
                            Preview Repair Receipt
                          </button>
                        </div>
                      )}
                  </div>
                )}
              </div>

              {selectedRepair.status !== 'RESOLVED' && selectedRepair.status !== 'REJECTED' && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  {['PENDING_IT', 'PENDING_ADMIN', 'PENDING_MANAGER'].includes(
                    selectedRepair.status,
                  ) &&
                    canApprove(selectedRepair.status) && (
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={() => handleUpdateStatus(selectedRepair.id, 'REJECTED')}
                          variant="danger"
                          className="w-full flex items-center justify-center gap-2 text-xs"
                        >
                          <XCircle size={16} />
                          Reject
                        </Button>
                        <Button
                          onClick={() => {
                            const stages = [
                              'PENDING_IT',
                              'PENDING_ADMIN',
                              'PENDING_MANAGER',
                              'APPROVED',
                            ]
                            const next = stages[stages.indexOf(selectedRepair.status) + 1]
                            handleUpdateStatus(selectedRepair.id, next)
                          }}
                          className="w-full flex items-center justify-center gap-2 text-xs"
                        >
                          <CheckCircle2 size={16} />
                          Approve Stage
                        </Button>
                      </div>
                    )}

                  {['PENDING_IT', 'PENDING_ADMIN', 'PENDING_MANAGER'].includes(
                    selectedRepair.status,
                  ) &&
                    !canApprove(selectedRepair.status) && (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
                        <ShieldAlert size={18} className="text-slate-400" />
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                            Access Restricted
                          </p>
                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                            You don't have authority to approve this stage.
                          </p>
                        </div>
                      </div>
                    )}



                  {selectedRepair.status === 'IN_REPAIR' && ['IT', 'Admin'].includes(userRole) && (
                    <Button
                      onClick={() => {
                        setRepairType('VENDOR')
                        setShowResolveModal(true)
                      }}
                      className="w-full flex items-center justify-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 size={16} />
                      Complete Vendor Repair
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-4">
              <Wrench size={48} className="opacity-20" />
              <p className="text-sm">Select a request to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* New Repair Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">New Repair Request</h3>
                <p className="text-sm text-slate-500">Submit a device for repair approval.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Select Device (Model - Serial)
                </label>
                <select
                  className="input appearance-none bg-white py-2"
                  value={selectedDevice?.id || ''}
                  onChange={(e) => {
                    const dev = devices.find((d) => d.id === parseInt(e.target.value))
                    setSelectedDevice(dev || null)
                    if (dev?.assignedTo) {
                      setRequester(dev.assignedTo)
                    } else {
                      setRequester('')
                    }
                  }}
                >
                  <option value="">Search or select device...</option>
                  {(userRole === 'Employee'
                    ? devices.filter(
                        (d) =>
                          (d.assignedTo === userName ||
                            d.assignedTo === localStorage.getItem('userEmail')) &&
                          d.status !== 'REPAIR',
                      )
                    : devices.filter((d) => d.status !== 'REPAIR')
                  ).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.model} — {d.serial}
                    </option>
                  ))}
                </select>
                {userRole === 'Employee' &&
                  devices.filter((d) => d.assignedTo === userName).length === 0 && (
                    <p className="text-[10px] text-orange-600 font-medium">
                      No devices are currently issued to you.
                    </p>
                  )}
                {userRole === 'Employee' &&
                  devices.filter((d) => d.assignedTo === userName).length > 0 &&
                  devices.filter((d) => d.assignedTo === userName && d.status !== 'REPAIR')
                    .length === 0 && (
                    <p className="text-[10px] text-amber-600 font-medium">
                      All your issued devices are already in the repair workflow.
                    </p>
                  )}
              </div>

              {userRole !== 'Employee' ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Requester Name
                  </label>
                  <select
                    className={`input appearance-none bg-white py-2 ${selectedDevice?.assignedTo ? 'bg-slate-50 cursor-not-allowed opacity-70' : ''}`}
                    value={requester}
                    onChange={(e) => setRequester(e.target.value)}
                    disabled={!!selectedDevice?.assignedTo}
                  >
                    <option value="">Select employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                  {selectedDevice?.assignedTo && (
                    <p className="text-[10px] text-blue-600 font-medium">
                      Note: Locked to current device owner ({selectedDevice.assignedTo}).
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                    Requesting As
                  </p>
                  <p className="text-sm font-semibold text-slate-700">{userName}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Problem Description
                </label>
                <textarea
                  className="input min-h-24 py-2"
                  placeholder="Describe the issue in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleNewRepairSubmit}
                disabled={
                  !selectedDevice || !description || (userRole !== 'Employee' && !requester)
                }
              >
                Submit for IT Review
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Repair Modal */}
      {showResolveModal && selectedRepair && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Complete Repair</h3>
                <p className="text-sm text-slate-500">
                  Record final details and return to employee.
                </p>
              </div>
              <button
                onClick={() => setShowResolveModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {selectedRepair.status !== 'IN_REPAIR' && (
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    onClick={() => setRepairType('IN_HOUSE')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${repairType === 'IN_HOUSE' ? 'bg-white shadow text-harisco-blue' : 'text-slate-500 hover:bg-slate-200/50'}`}
                  >
                    In-House Fix
                  </button>
                  <button
                    onClick={() => setRepairType('VENDOR')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${repairType === 'VENDOR' ? 'bg-white shadow text-harisco-blue' : 'text-slate-500 hover:bg-slate-200/50'}`}
                  >
                    External Vendor
                  </button>
                </div>
              )}

              {repairType === 'VENDOR' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Vendor Name *
                    </label>
                    <input
                      className="input py-2"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      placeholder="e.g. iFixit Pro"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Vendor Contact *
                    </label>
                    <input
                      className="input py-2"
                      value={vendorContact}
                      onChange={(e) => setVendorContact(e.target.value)}
                      placeholder="Phone / Email"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Repair Cost *
                    </label>
                    <input
                      className="input py-2"
                      value={repairCost}
                      onChange={(e) => setRepairCost(e.target.value)}
                      placeholder="PKR 5,000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Receipt (Img/PDF) *
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-md p-1"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Fix Details *
                </label>
                <textarea
                  className="input min-h-24 py-2 text-sm"
                  placeholder={
                    repairType === 'IN_HOUSE'
                      ? 'Describe what IT did to fix the device...'
                      : "Describe the vendor's repair notes..."
                  }
                  value={fixDetails}
                  onChange={(e) => setFixDetails(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Parts Replaced (Optional)
                </label>
                <input
                  className="input py-2 text-sm"
                  placeholder="e.g. Replaced 1x 8GB RAM Module"
                  value={partsReplaced}
                  onChange={(e) => setPartsReplaced(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-400 max-w-[200px] leading-tight">
                Device will be marked as ISSUED and returned to employee.
              </span>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowResolveModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleResolveSubmit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={
                    !fixDetails ||
                    (repairType === 'VENDOR' &&
                      (!vendorName || !vendorContact || !repairCost || !receiptFile))
                  }
                >
                  Complete Resolution
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Receipt Preview Modal */}
      {showReceiptPreview && selectedRepair?.receiptUrl && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-harisco-blue/10 rounded flex items-center justify-center text-harisco-blue">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Repair Receipt Preview</h3>
                  <p className="text-[10px] text-slate-400 font-mono">REP-{selectedRepair.id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowReceiptPreview(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-100/50 flex justify-center">
              {selectedRepair.receiptUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={`${API_BASE.replace('/api', '')}${selectedRepair.receiptUrl}`}
                  className="w-full h-full min-h-[70vh] rounded-lg shadow-lg"
                  title="Receipt PDF"
                />
              ) : (
                <img
                  src={`${API_BASE.replace('/api', '')}${selectedRepair.receiptUrl}`}
                  alt="Repair Receipt"
                  className="max-w-full h-auto rounded-lg shadow-lg object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Repairs
