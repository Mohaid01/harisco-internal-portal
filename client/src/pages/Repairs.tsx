import React, { useState, useEffect } from 'react';
import { Wrench, CheckCircle2, XCircle, Clock, Loader2, Plus, X, ShieldAlert } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

interface Device {
  id: number;
  model: string;
  serial: string;
  status: string;
  assignedTo?: string;
}


interface Employee {
  id: number;
  name: string;
}

interface RepairRequest {
  id: number;
  deviceId: number;
  device: { model: string; serial: string };
  requester: string;
  description: string;
  status: 'PENDING_IT' | 'PENDING_ADMIN' | 'PENDING_MANAGER' | 'APPROVED' | 'REJECTED';

  createdAt: string;
}

interface RepairsProps {
  userRole: string;
  userName: string;
}

const API_BASE = 'http://localhost:5000/api';

const Repairs: React.FC<RepairsProps> = ({ userRole, userName }) => {

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<RepairRequest | null>(null);
  const [repairs, setRepairs] = useState<RepairRequest[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states (New Repair)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [requester, setRequester] = useState('');
  const [description, setDescription] = useState('');

  const fetchRepairs = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const [repRes, devRes, empRes] = await Promise.all([
        fetch(`${API_BASE}/repairs`, { headers }),
        fetch(`${API_BASE}/inventory`, { headers }),
        fetch(`${API_BASE}/employees`, { headers })
      ]);
      const [repData, devData, empData] = await Promise.all([repRes.json(), devRes.json(), empRes.json()]);
      setRepairs(repData);
      setDevices(devData);
      setEmployees(empData);
    } catch (error) {
      console.error('Failed to fetch repairs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRepairs();
  }, []);

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/repairs/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, performedBy: `${userRole} Authority` }),
      });
      if (res.ok) {
        fetchRepairs();
        setSelectedRepair(null);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleNewRepairSubmit = async () => {
    const finalRequester = userRole === 'Employee' ? userName : requester;
    if (!selectedDevice || !finalRequester || !description) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/repairs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          requester: finalRequester,
          description,
          performedBy: `${userRole} Authority`
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        fetchRepairs();
        // Reset form
        setSelectedDevice(null); setRequester(''); setDescription('');
      }
    } catch (error) {
      console.error('Failed to submit repair:', error);
    }
  };


  const canApprove = (status: string) => {
    if (userRole === 'IT' && status === 'PENDING_IT') return true;
    if (userRole === 'Admin' && status === 'PENDING_ADMIN') return true;
    if (userRole === 'Manager' && (status === 'PENDING_MANAGER' || status === 'APPROVED')) return true;
    return false;
  }

  const getStatusInfo = (status: RepairRequest['status']) => {
    switch (status) {
      case 'PENDING_IT': return { label: 'IT Review', icon: <Clock size={14} />, color: 'bg-blue-100 text-blue-700' };
      case 'PENDING_ADMIN': return { label: 'Admin Approval', icon: <Clock size={14} />, color: 'bg-purple-100 text-purple-700' };
      case 'PENDING_MANAGER': return { label: 'Manager Final', icon: <Clock size={14} />, color: 'bg-orange-100 text-orange-700' };
      case 'APPROVED': return { label: 'Authorized', icon: <CheckCircle2 size={14} />, color: 'bg-green-100 text-green-700' };
      case 'REJECTED': return { label: 'Rejected', icon: <XCircle size={14} />, color: 'bg-red-100 text-red-700' };
      default: return { label: status, icon: <Clock size={14} />, color: 'bg-slate-100' };
    }
  };


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
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Active Requests</h3>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-500 font-medium">Total: {repairs.length}</span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
              <Loader2 className="animate-spin" size={32} />
              <p>Loading repairs...</p>
            </div>
          ) : repairs.map((repair) => (
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
                    <h4 className="text-sm font-bold text-slate-900">REP-{repair.id} — {repair.device.model}</h4>
                    <p className="text-xs text-slate-500 mt-1">Requested by <span className="font-semibold">{repair.requester}</span></p>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusInfo(repair.status).color}`}>
                  {getStatusInfo(repair.status).icon}
                  {getStatusInfo(repair.status).label}
                </div>
              </div>
            </div>
          ))}
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Problem Description</label>
                  <p className="text-sm text-slate-700 mt-2 bg-slate-50 p-4 rounded-lg border border-slate-100 italic">
                    "{selectedRepair.description}"
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block">Approval Workflow</label>
                  <div className="space-y-4 relative ml-3 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                    <div className="relative pl-6 flex items-center justify-between">
                      <div className={`absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${selectedRepair.status === 'PENDING_IT' ? 'bg-harisco-blue animate-pulse' : 'bg-green-500'}`}></div>
                      <span className="text-xs font-semibold">IT Review</span>
                      <span className="text-[10px] text-harisco-blue font-bold uppercase">{selectedRepair.status === 'PENDING_IT' ? 'Active' : 'Completed'}</span>
                    </div>
                    <div className={`relative pl-6 flex items-center justify-between ${['PENDING_IT'].includes(selectedRepair.status) ? 'text-slate-300' : ''}`}>
                      <div className={`absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${selectedRepair.status === 'PENDING_ADMIN' ? 'bg-harisco-blue animate-pulse' : (['PENDING_IT'].includes(selectedRepair.status) ? 'bg-slate-200' : 'bg-green-500')}`}></div>
                      <span className="text-xs font-semibold">Admin Approval</span>
                      <span className="text-[10px] font-bold uppercase">{selectedRepair.status === 'PENDING_ADMIN' ? 'Active' : (['PENDING_IT'].includes(selectedRepair.status) ? 'Pending' : 'Completed')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedRepair.status !== 'APPROVED' && selectedRepair.status !== 'REJECTED' && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  {canApprove(selectedRepair.status) ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Button onClick={() => handleUpdateStatus(selectedRepair.id, 'REJECTED')} variant="danger" className="w-full flex items-center justify-center gap-2 text-xs">
                        <XCircle size={16} />
                        Reject
                      </Button>
                      <Button 
                        onClick={() => {
                          const stages = ['PENDING_IT', 'PENDING_ADMIN', 'PENDING_DIRECTOR', 'APPROVED'];
                          const next = stages[stages.indexOf(selectedRepair.status) + 1];
                          handleUpdateStatus(selectedRepair.id, next);
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
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Access Restricted</p>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">You don't have authority to approve this stage ({selectedRepair.status.replace('PENDING_', '')}).</p>
                      </div>
                    </div>
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
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Device (Model - Serial)</label>
                <select 
                  className="input appearance-none bg-white py-2"
                  value={selectedDevice?.id || ''}
                  onChange={(e) => {
                    const dev = devices.find(d => d.id === parseInt(e.target.value));
                    setSelectedDevice(dev || null);
                  }}
                >
                  <option value="">Search or select device...</option>
                  {(userRole === 'Employee' 
                    ? devices.filter(d => d.assignedTo === userName || d.assignedTo === localStorage.getItem('userEmail')) // Check both just in case
                    : devices
                  ).map(d => (
                    <option key={d.id} value={d.id}>{d.model} — {d.serial}</option>
                  ))}
                </select>
                {userRole === 'Employee' && devices.filter(d => d.assignedTo === userName).length === 0 && (
                  <p className="text-[10px] text-orange-600 font-medium">No devices are currently issued to you.</p>
                )}
              </div>

              {userRole !== 'Employee' ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Requester Name</label>
                  <select 
                    className="input appearance-none bg-white py-2"
                    value={requester}
                    onChange={(e) => setRequester(e.target.value)}
                  >
                    <option value="">Select employee...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.name}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Requesting As</p>
                  <p className="text-sm font-semibold text-slate-700">{userName}</p>
                </div>
              )
              }


              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Problem Description</label>
                <textarea 
                  className="input min-h-24 py-2" 
                  placeholder="Describe the issue in detail..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button 
                onClick={handleNewRepairSubmit} 
                disabled={!selectedDevice || !description || (userRole !== 'Employee' && !requester)}
              >
                Submit for IT Review
              </Button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Repairs;
