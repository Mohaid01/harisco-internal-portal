import React, { useState, useEffect } from 'react'
import {
  Search,
  Plus,
  MoreVertical,
  Mail,
  Building2,
  Loader2,
  Phone,
  CreditCard,
} from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { API_BASE } from '../config'
import { useLoading } from '../context/LoadingContext'

interface Employee {
  id: number
  name: string
  email: string
  cnic: string
  phoneNumber: string
  department: string
  designation: string
}

const DEPARTMENTS = ['Engineering', 'Operations', 'IT', 'HR', 'Marketing', 'Finance', 'Logistics']
const DESIGNATIONS = [
  'Manager',
  'Developer',
  'Lead',
  'Executive',
  'Intern',
  'Accountant',
  'Officer',
]

const Employees: React.FC = () => {
  const { withLoading } = useLoading()
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cnic, setCnic] = useState('')
  const [phone, setPhone] = useState('')
  const [dept, setDept] = useState(DEPARTMENTS[0])
  const [designation, setDesignation] = useState(DESIGNATIONS[0])

  const fetchEmployees = async () => {
    withLoading(async () => {
      try {
        setIsLoading(true)
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_BASE}/employees`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        setEmployees(data)
      } catch (error) {
        console.error('Failed to fetch employees:', error)
      } finally {
        setIsLoading(false)
      }
    })
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  const handleAddEmployee = async () => {
    await withLoading(async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_BASE}/employees`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            email,
            cnic,
            phoneNumber: phone,
            department: dept,
            designation,
          }),
        })
        if (res.ok) {
          setShowAddModal(false)
          fetchEmployees()
          // Clear form
          setName('')
          setEmail('')
          setCnic('')
          setPhone('')
          setDept(DEPARTMENTS[0])
          setDesignation(DESIGNATIONS[0])
        }
      } catch (error) {
        console.error('Failed to add employee:', error)
      }
    })
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-harisco-blue/10 focus:border-harisco-blue transition-all"
          />
        </div>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
          <Plus size={18} />
          Add Employee
        </Button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Employee
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Contact Info
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Loader2 className="animate-spin" size={24} />
                    <p className="text-sm">Loading employees...</p>
                  </div>
                </td>
              </tr>
            ) : filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-harisco-light text-harisco-blue rounded-full flex items-center justify-center font-bold text-sm">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{emp.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <CreditCard size={10} /> {emp.cnic || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-slate-600">
                        <Mail size={12} className="text-slate-400" />
                        {emp.email}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-600">
                        <Phone size={12} className="text-slate-400" />
                        {emp.phoneNumber || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <Building2 size={14} className="text-slate-400" />
                        {emp.department}
                      </div>
                      <p className="text-xs text-slate-400 ml-5">{emp.designation}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1 text-slate-400 hover:text-slate-600 rounded">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm">
                  No employees found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold">Add New Employee</h3>
              <p className="text-sm text-slate-500">Register a new team member to the portal.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  placeholder="e.g. Haris Ahmed"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="e.g. haris@harisco.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="CNIC Number"
                  placeholder="e.g. 42101-XXXXXXX-X"
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                />
                <Input
                  label="Phone Number"
                  placeholder="e.g. 0300-XXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Department
                  </label>
                  <select
                    className="input appearance-none bg-white py-2"
                    value={dept}
                    onChange={(e) => setDept(e.target.value)}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Designation
                  </label>
                  <select
                    className="input appearance-none bg-white py-2"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                  >
                    {DESIGNATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddEmployee}>Save Employee</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Employees
