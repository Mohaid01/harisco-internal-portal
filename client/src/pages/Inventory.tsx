import React, { useState, useEffect } from 'react';
import { Search, Plus, Monitor, Laptop, Tablet, Smartphone, Pencil, UserCheck, X, Loader2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

interface Device {
  id: number;
  serial: string;
  model: string;
  type: string;
  status: 'IN_STOCK' | 'ISSUED' | 'REPAIR';
  assignedTo?: string;
}

interface Employee {
  id: number;
  name: string;
}

const API_BASE = 'http://localhost:5000/api';

const Inventory: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [formSerial, setFormSerial] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formType, setFormType] = useState('Laptop');
  const [formStatus, setFormStatus] = useState('IN_STOCK');
  const [issueEmployee, setIssueEmployee] = useState('');

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const [devRes, empRes] = await Promise.all([
        fetch(`${API_BASE}/inventory`, { headers }),
        fetch(`${API_BASE}/employees`, { headers })
      ]);
      const [devData, empData] = await Promise.all([devRes.json(), empRes.json()]);
      setDevices(devData);
      setEmployees(empData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (device: Device) => {
    setSelectedDevice(device);
    setModalMode('edit');
    setFormSerial(device.serial);
    setFormModel(device.model);
    setFormType(device.type);
    setFormStatus(device.status);
    setShowAddModal(true);
  };

  const handleAddNew = () => {
    setSelectedDevice(null);
    setModalMode('add');
    setFormSerial('');
    setFormModel('');
    setFormType('Laptop');
    setFormStatus('IN_STOCK');
    setShowAddModal(true);
  };

  const handleSaveDevice = async () => {
    try {
      const url = modalMode === 'add' ? `${API_BASE}/inventory` : `${API_BASE}/inventory/${selectedDevice?.id}`;
      const method = modalMode === 'add' ? 'POST' : 'PUT';
      const token = localStorage.getItem('token');
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          serial: formSerial,
          model: formModel,
          type: formType,
          status: formStatus
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to save device:', error);
    }
  };

  const handleIssue = (device: Device | null) => {
    setSelectedDevice(device);
    setIssueEmployee('');
    setShowIssueModal(true);
  };

  const handleConfirmIssue = async () => {
    if (!selectedDevice || !issueEmployee) return;
    
    try {
      const token = localStorage.getItem('token');
      const selectedEmp = employees.find(e => e.id === parseInt(issueEmployee));
      const res = await fetch(`${API_BASE}/inventory/${selectedDevice.id}/issue`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ assignedTo: selectedEmp?.name }),
      });

      if (res.ok) {
        setShowIssueModal(false);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to issue device:', error);
    }
  };

  const getStatusStyle = (status: Device['status']) => {
    switch (status) {
      case 'IN_STOCK': return 'bg-green-100 text-green-700';
      case 'ISSUED': return 'bg-blue-100 text-blue-700';
      case 'REPAIR': return 'bg-amber-100 text-amber-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'laptop': return <Laptop size={18} />;
      case 'monitor': return <Monitor size={18} />;
      case 'mobile': return <Smartphone size={18} />;
      default: return <Tablet size={18} />;
    }
  };

  const filteredDevices = devices.filter(device => 
    device.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.serial.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (device.assignedTo?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search serial or model..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-harisco-blue/10 focus:border-harisco-blue transition-all"
          />
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            className="flex items-center gap-2"
            onClick={() => handleIssue(null)}
          >
            Issue Device
          </Button>
          <Button onClick={handleAddNew} className="flex items-center gap-2">
            <Plus size={18} />
            Add Device
          </Button>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Device Info</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned To</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin" size={24} />
                    <p className="text-sm">Loading inventory...</p>
                  </div>
                </td>
              </tr>
            ) : filteredDevices.length > 0 ? (
              filteredDevices.map((device) => (
                <tr key={device.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-50 rounded flex items-center justify-center border border-slate-100 text-slate-400">
                        {getTypeIcon(device.type)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{device.model}</p>
                        <p className="text-[10px] font-mono text-slate-400">{device.serial}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(device.status)}`}>
                      {device.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {device.assignedTo ? (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <UserCheck size={14} className="text-harisco-blue" />
                        {device.assignedTo}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {device.status === 'IN_STOCK' && (
                        <button 
                          onClick={() => handleIssue(device)}
                          className="p-1.5 text-harisco-blue hover:bg-harisco-light rounded transition-colors"
                          title="Issue to Employee"
                        >
                          <UserCheck size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleEdit(device)}
                        className="p-1.5 text-slate-400 hover:text-harisco-blue hover:bg-slate-100 rounded transition-colors"
                        title="Edit Device"
                      >
                        <Pencil size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm">
                  No devices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">{modalMode === 'add' ? 'Add New Device' : 'Edit Device'}</h3>
                <p className="text-sm text-slate-500">{modalMode === 'add' ? 'Register a new asset.' : 'Update device information.'}</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <Input 
                label="Serial Number" 
                placeholder="e.g. SN-12345678" 
                value={formSerial}
                onChange={(e) => setFormSerial(e.target.value)}
              />
              <Input 
                label="Model Name" 
                placeholder="e.g. Dell Latitude 5420" 
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Device Type</label>
                  <select 
                    className="input appearance-none bg-white py-2"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                  >
                    <option>Laptop</option>
                    <option>Monitor</option>
                    <option>Mobile</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                  <select 
                    className="input appearance-none bg-white py-2"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                  >
                    <option value="IN_STOCK">IN STOCK</option>
                    <option value="ISSUED">ISSUED</option>
                    <option value="REPAIR">REPAIR</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button onClick={handleSaveDevice}>
                {modalMode === 'add' ? 'Add to Stock' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Device Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Issue Device</h3>
                <p className="text-sm text-slate-500">Assign this asset to an employee.</p>
              </div>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-slate-600">
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
                  {devices.filter(d => d.status === 'IN_STOCK').map(d => (
                    <option key={d.id} value={d.id}>{d.model} — {d.serial}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assign To Employee</label>
                <select 
                  className="input appearance-none bg-white py-2"
                  value={issueEmployee}
                  onChange={(e) => setIssueEmployee(e.target.value)}
                >
                  <option value="">Search or select employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-amber-50 text-amber-700 rounded-lg text-xs border border-amber-100 flex gap-2 italic">
                <span className="shrink-0">ℹ️</span>
                <span>This action will change the device status to <b>ISSUED</b> and log the transaction.</span>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowIssueModal(false)}>Cancel</Button>
              <Button onClick={handleConfirmIssue} disabled={!selectedDevice || !issueEmployee}>
                Confirm Assignment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
