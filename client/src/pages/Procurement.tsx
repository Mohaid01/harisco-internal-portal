import React, { useState, useEffect } from 'react'
import { ShoppingCart, CheckCircle2, XCircle, Plus, Loader2, X, ShieldAlert } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

interface ProcurementRequest {
  id: number
  item: string
  estimatedCost: string
  requester: string
  type: string
  status: 'PENDING_IT' | 'PENDING_ADMIN' | 'PENDING_MANAGER' | 'APPROVED' | 'PURCHASED'

  createdAt: string
}

interface ProcurementProps {
  userRole: string
}

const API_BASE = 'http://localhost:5000/api'

const Procurement: React.FC<ProcurementProps> = ({ userRole }) => {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showIntakeModal, setShowIntakeModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ProcurementRequest | null>(null)
  const [requests, setRequests] = useState<ProcurementRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form states (New Request)
  const [item, setItem] = useState('')
  const [cost, setCost] = useState('')
  const [dept, setDept] = useState('Engineering')
  const [type, setType] = useState('Laptop')

  // Intake states (Purchase Completion)
  const [intakeSerial, setIntakeSerial] = useState('')
  const [intakeModel, setIntakeModel] = useState('')
  const [intakeType, setIntakeType] = useState('Laptop')

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/procurement`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setRequests(data)
    } catch (error) {
      console.error('Failed to fetch procurement requests:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleSubmitRequest = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/procurement`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          item,
          estimatedCost: cost,
          requester: dept,
          type,
        }),
      })
      if (res.ok) {
        setShowAddModal(false)
        fetchRequests()
        setItem('')
        setCost('')
        setType('Laptop')
      }
    } catch (error) {
      console.error('Failed to submit request:', error)
    }
  }

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/procurement/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, performedBy: `${userRole} Authority` }),
      })
      if (res.ok) {
        fetchRequests()
        setSelectedRequest(null)
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const handleIntakeSubmit = async () => {
    if (!selectedRequest || !intakeSerial || !intakeModel) return

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/procurement/${selectedRequest.id}/intake`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          serial: intakeSerial,
          model: intakeModel,
          type: intakeType,
          performedBy: `${userRole} Authority`,
        }),
      })

      if (res.ok) {
        setShowIntakeModal(false)
        fetchRequests()
        setSelectedRequest(null)
        setIntakeSerial('')
        setIntakeModel('')
        setIntakeType('Laptop')
      }
    } catch (error) {
      console.error('Failed to process intake:', error)
    }
  }

  const canApprove = (status: string) => {
    if (userRole === 'IT' && status === 'PENDING_IT') return true
    if (userRole === 'ADMIN' && status === 'PENDING_ADMIN') return true
    if (userRole === 'DIRECTOR' && (status === 'PENDING_DIRECTOR' || status === 'APPROVED'))
      return true
    return false
  }

  const getStatusInfo = (status: ProcurementRequest['status']) => {
    switch (status) {
      case 'PENDING_IT':
        return { label: 'IT Review', color: 'bg-blue-100 text-blue-700' }
      case 'PENDING_ADMIN':
        return { label: 'Admin Approval', color: 'bg-purple-100 text-purple-700' }
      case 'PENDING_MANAGER':
        return { label: 'Manager Sign-off', color: 'bg-orange-100 text-orange-700' }
      case 'APPROVED':
        return { label: 'Approved (To Purchase)', color: 'bg-green-100 text-green-700' }
      case 'PURCHASED':
        return { label: 'Purchased & Logged', color: 'bg-slate-100 text-slate-700' }
      default:
        return { label: status, color: 'bg-slate-100' }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-lg">Asset Procurement</h3>
        {userRole !== 'Employee' && (

          <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
            <Plus size={18} />
            New Request
          </Button>
        )}
      </div>

      {userRole === 'Employee' ? (
        <div className="card flex flex-col items-center justify-center p-20 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900">Procurement Restricted</h4>
            <p className="text-slate-500 mt-2 max-w-sm">
              Regular employees cannot initiate procurement directly from the portal. Please contact
              your **Admin** or **Manager** to request new hardware.
            </p>
          </div>

          <Button variant="secondary" className="mt-4">
            Learn More About Policy
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                <Loader2 className="animate-spin" size={32} />
                <p>Loading requests...</p>
              </div>
            ) : (
              requests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className={`card !p-0 cursor-pointer transition-all hover:border-harisco-blue/30 ${selectedRequest?.id === req.id ? 'ring-2 ring-harisco-blue/20 border-harisco-blue' : ''}`}
                >
                  <div className="p-5 flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                        <ShoppingCart size={22} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          PRQ-{req.id} — {req.item}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Requested by <span className="font-semibold">{req.requester}</span> •
                          Type: {req.type}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusInfo(req.status).color}`}
                    >
                      {getStatusInfo(req.status).label}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card h-fit sticky top-0">
            {selectedRequest ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Request Details</h3>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      PRQ-{selectedRequest.id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">
                      Est. Cost
                    </p>
                    <p className="text-lg font-bold text-harisco-blue">
                      {selectedRequest.estimatedCost.startsWith('Rs.')
                        ? selectedRequest.estimatedCost
                        : `Rs. ${selectedRequest.estimatedCost}`}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Item</span>
                      <span className="font-semibold">{selectedRequest.item}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Type</span>
                      <span className="font-semibold">{selectedRequest.type}</span>
                    </div>
                  </div>

                  {selectedRequest.status === 'APPROVED' && (
                    <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                      <p className="text-xs text-green-700 font-medium flex items-center gap-2">
                        <CheckCircle2 size={14} />
                        This request is approved. Proceed to intake the new asset.
                      </p>
                      {userRole === 'DIRECTOR' || userRole === 'ADMIN' ? (
                        <Button
                          onClick={() => {
                            setIntakeModel(selectedRequest.item)
                            setIntakeType(selectedRequest.type)
                            setShowIntakeModal(true)
                          }}
                          className="w-full mt-3 !bg-green-600 hover:!bg-green-700 text-xs py-2"
                        >
                          Complete Purchase & Stock
                        </Button>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic mt-2">
                          Only Admin/Director can finalize intake.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {selectedRequest.status !== 'APPROVED' &&
                  selectedRequest.status !== 'PURCHASED' && (
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      {canApprove(selectedRequest.status) ? (
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            onClick={() => handleUpdateStatus(selectedRequest.id, 'REJECTED')}
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
                                'PENDING_DIRECTOR',
                                'APPROVED',
                              ]
                              const next = stages[stages.indexOf(selectedRequest.status) + 1]
                              handleUpdateStatus(selectedRequest.id, next)
                            }}
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
                              Access Restricted
                            </p>
                            <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                              You don't have authority to approve this stage (
                              {selectedRequest.status.replace('PENDING_', '')}).
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-4">
                <ShoppingCart size={48} className="opacity-20" />
                <p className="text-sm text-center">
                  Select a procurement request
                  <br />
                  to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold">New Procurement Request</h3>
              <p className="text-sm text-slate-500">Request new equipment for a department.</p>
            </div>
            <div className="p-6 space-y-4">
              <Input
                label="Item Name"
                placeholder="e.g. MacBook Pro"
                value={item}
                onChange={(e) => setItem(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Device Type
                  </label>
                  <select
                    className="input appearance-none bg-white py-2"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option>Laptop</option>
                    <option>Monitor</option>
                    <option>Mobile</option>
                    <option>Other</option>
                  </select>
                </div>
                <Input
                  label="Est. Cost (Rs.)"
                  placeholder="e.g. 150,000"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Requesting Department
                </label>
                <select
                  className="input appearance-none bg-white py-2"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                >
                  <option>Engineering</option>
                  <option>HR</option>
                  <option>Marketing</option>
                  <option>Operations</option>
                </select>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitRequest}>Submit Request</Button>
            </div>
          </div>
        </div>
      )}

      {/* Intake Modal */}
      {showIntakeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Asset Intake</h3>
                <p className="text-sm text-slate-500">Add the purchased device to Inventory.</p>
              </div>
              <button
                onClick={() => setShowIntakeModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-xs border border-blue-100 mb-2">
                <strong>Procurement:</strong> {selectedRequest?.item} ({selectedRequest?.type})
              </div>
              <Input
                label="Serial Number"
                placeholder="Enter serial for the new device..."
                value={intakeSerial}
                onChange={(e) => setIntakeSerial(e.target.value)}
              />
              <Input
                label="Model Name"
                value={intakeModel}
                onChange={(e) => setIntakeModel(e.target.value)}
              />
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Device Type
                </label>
                <select
                  className="input appearance-none bg-white py-2"
                  value={intakeType}
                  onChange={(e) => setIntakeType(e.target.value)}
                >
                  <option>Laptop</option>
                  <option>Monitor</option>
                  <option>Mobile</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowIntakeModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleIntakeSubmit} disabled={!intakeSerial}>
                Finalize & Stock
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Procurement
