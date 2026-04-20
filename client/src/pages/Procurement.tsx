import React, { useState, useEffect } from 'react'
import { ShoppingCart, CheckCircle2, XCircle, Plus, Loader2, X, ShieldAlert, Eye } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { API_BASE } from '../config'
import { useLoading } from '../context/LoadingContext'

interface ProcurementRequest {
  id: number
  item: string
  requestedBy: string
  reason: string
  type: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PURCHASED'
  itApproved: boolean
  adminApproved: boolean
  managerApproved: boolean
  receiptUrl?: string
  createdAt: string
}

interface ProcurementProps {
  userRole: string
}

const Procurement: React.FC<ProcurementProps> = ({ userRole }) => {
  const { withLoading } = useLoading()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showIntakeModal, setShowIntakeModal] = useState(false)
  const [showReceiptPreview, setShowReceiptPreview] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ProcurementRequest | null>(null)
  const [requests, setRequests] = useState<ProcurementRequest[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form states (New Request)
  const [item, setItem] = useState('')
  const [requestedBy, setRequestedBy] = useState('')
  const [reason, setReason] = useState('')
  const [type, setType] = useState('Laptop')

  // Intake states (Purchase Completion)
  const [intakeSerial, setIntakeSerial] = useState('')
  const [intakeModel, setIntakeModel] = useState('')
  const [intakeType, setIntakeType] = useState('Laptop')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const fetchData = async () => {
    withLoading(async () => {
      try {
        const token = localStorage.getItem('token')
        const headers = { Authorization: `Bearer ${token}` }
        const [procRes, empRes] = await Promise.all([
          fetch(`${API_BASE}/procurement`, { headers }),
          fetch(`${API_BASE}/employees`, { headers }),
        ])
        const procData = await procRes.json()
        const empData = await empRes.json()
        setRequests(procData)
        setEmployees(empData)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setIsLoading(false)
      }
    })
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSubmitRequest = async () => {
    await withLoading(async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_BASE}/procurement`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            item,
            requestedBy,
            reason,
            type,
          }),
        })
        if (res.ok) {
          setShowAddModal(false)
          fetchData()
          setItem('')
          setRequestedBy('')
          setReason('')
          setType('Laptop')
        }
      } catch (error) {
        console.error('Failed to submit request:', error)
      }
    })
  }

  const handleUpdateStatus = async (id: number, action: 'APPROVE' | 'REJECT') => {
    await withLoading(async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_BASE}/procurement/${id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action }),
        })
        if (res.ok) {
          const updated = await res.json()
          fetchData()
          setSelectedRequest(updated)
        }
      } catch (error) {
        console.error('Failed to update status:', error)
      }
    })
  }

  const handleIntakeSubmit = async () => {
    if (!selectedRequest || !intakeSerial || !intakeModel) return

    await withLoading(async () => {
      try {
        const token = localStorage.getItem('token')
        const formData = new FormData()
        formData.append('serial', intakeSerial)
        formData.append('model', intakeModel)
        formData.append('type', intakeType)
        formData.append('performedBy', `${userRole} Authority`)
        if (receiptFile) {
          formData.append('receipt', receiptFile)
        }

        const res = await fetch(`${API_BASE}/procurement/${selectedRequest.id}/intake`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (res.ok) {
          setShowIntakeModal(false)
          fetchData()
          setSelectedRequest(null)
          setIntakeSerial('')
          setIntakeModel('')
          setIntakeType('Laptop')
          setReceiptFile(null)
        }
      } catch (error) {
        console.error('Failed to process intake:', error)
      }
    })
  }

  const canApprove = (req: ProcurementRequest) => {
    if (userRole === 'IT' && !req.itApproved) return true
    if (userRole === 'Admin' && !req.adminApproved) return true
    if (userRole === 'Manager' && !req.managerApproved) return true
    return false
  }

  const getStatusInfo = (status: ProcurementRequest['status']) => {
    switch (status) {
      case 'PENDING':
        return { 
          label: 'Awaiting Approvals', 
          color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' 
        }
      case 'REJECTED':
        return { 
          label: 'Rejected', 
          color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' 
        }
      case 'APPROVED':
        return { 
          label: 'Fully Approved', 
          color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' 
        }
      case 'PURCHASED':
        return { 
          label: 'Purchased & Logged', 
          color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' 
        }
      default:
        return { label: status, color: 'bg-slate-100 dark:bg-slate-800' }
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
                          Requested by <span className="font-semibold">{req.requestedBy}</span> •
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
                </div>

                  <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Requested By</span>
                      <span className="font-semibold">{selectedRequest.requestedBy}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Type</span>
                      <span className="font-semibold">{selectedRequest.type}</span>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-2 tracking-wider">Approval Checklist</p>
                      <div className="flex flex-wrap gap-2">
                        <div className={`px-2 py-1 rounded flex items-center gap-1.5 text-[10px] font-bold border ${selectedRequest.itApproved ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                          IT {selectedRequest.itApproved ? <CheckCircle2 size={12} /> : null}
                        </div>
                        <div className={`px-2 py-1 rounded flex items-center gap-1.5 text-[10px] font-bold border ${selectedRequest.adminApproved ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                          ADMIN {selectedRequest.adminApproved ? <CheckCircle2 size={12} /> : null}
                        </div>
                        <div className={`px-2 py-1 rounded flex items-center gap-1.5 text-[10px] font-bold border ${selectedRequest.managerApproved ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                          MANAGER {selectedRequest.managerApproved ? <CheckCircle2 size={12} /> : null}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-400 uppercase font-bold mb-1">Reason</p>
                      <p className="text-sm text-slate-700 leading-relaxed italic">
                        "{selectedRequest.reason}"
                      </p>
                    </div>
                    {selectedRequest.receiptUrl && (
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-2">Verification</p>
                        <button
                          onClick={() => setShowReceiptPreview(true)}
                          className="flex items-center gap-2 text-xs text-harisco-blue font-bold hover:underline"
                        >
                          <Eye size={14} />
                          Preview Purchase Receipt
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedRequest.status === 'APPROVED' && (
                    <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                      <p className="text-xs text-green-700 font-medium flex items-center gap-2">
                        <CheckCircle2 size={14} />
                        Request fully approved. Proceed to intake.
                      </p>
                      {userRole === 'IT' || userRole === 'Admin' ? (
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
                          Only Admin or IT can finalize intake.
                        </p>
                      )}
                    </div>
                  )}

                  {selectedRequest.status === 'PENDING' && (
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      {canApprove(selectedRequest) ? (
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            onClick={() => handleUpdateStatus(selectedRequest.id, 'REJECT')}
                            variant="danger"
                            className="w-full flex items-center justify-center gap-2 text-xs"
                          >
                            <XCircle size={16} />
                            Reject Request
                          </Button>
                          <Button
                            onClick={() => handleUpdateStatus(selectedRequest.id, 'APPROVE')}
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
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Requested By
                </label>
                <select
                  className="input appearance-none bg-white py-2"
                  value={requestedBy}
                  onChange={(e) => setRequestedBy(e.target.value)}
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Reason for Request
                </label>
                <textarea
                  className="input min-h-[100px] py-3 resize-none"
                  placeholder="Explain why this equipment is needed..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
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
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Purchase Receipt (Image/PDF) <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-harisco-light file:text-harisco-blue hover:file:bg-blue-100"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowIntakeModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleIntakeSubmit} disabled={!intakeSerial || !receiptFile}>
                Finalize & Stock
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Receipt Preview Modal */}
      {showReceiptPreview && selectedRequest?.receiptUrl && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Verification: Purchase Receipt</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">PRQ-{selectedRequest.id} — {selectedRequest.item}</p>
              </div>
              <button
                onClick={() => setShowReceiptPreview(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-slate-50 overflow-auto p-4 flex items-center justify-center">
              {selectedRequest.receiptUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={`${API_BASE.replace('/api', '')}${selectedRequest.receiptUrl}#toolbar=0`}
                  className="w-full h-full rounded-lg shadow-sm border border-slate-200"
                  title="Receipt Preview"
                />
              ) : (
                <img
                  src={`${API_BASE.replace('/api', '')}${selectedRequest.receiptUrl}`}
                  alt="Receipt Preview"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
            <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
              <p className="text-[10px] text-slate-400">Viewing secure asset verification document.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Procurement
