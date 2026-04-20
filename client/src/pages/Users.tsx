import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Shield, Search, UserCheck, Mail, Loader2, X } from 'lucide-react';
import { API_BASE } from '../config';

interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', role: 'Employee' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setError(data.error || 'You do not have permission to view this page.');
        setUsers([]);
      }
    } catch (err) {
      setError('Failed to connect to server. Please try again.');
    } finally {

      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newUser),
      });

      if (!response.ok) throw new Error('Failed to add user');

      await fetchUsers();
      setShowModal(false);
      setNewUser({ email: '', role: 'Employee' });
    } catch (err) {
      setError('Could not add user. Please check the email.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this user\'s access?')) return;

    try {
      await fetch(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setUsers(users.filter((u) => u.id !== id));
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'IT': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Admin': return 'bg-red-100 text-red-700 border-red-200';
      case 'Manager': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="text-indigo-600" size={24} />
            User Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">Control who can access the HarisCo Portal and their permissions.</p>
        </div>
        {localStorage.getItem('userRole') === 'IT' && (
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary flex items-center gap-2 justify-center"
          >
            <UserPlus size={18} />
            Add Authorized User
          </button>
        )}
      </div>



      {/* Search and Table Card */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or email..."
              className="input pl-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">User Identity</th>
                <th className="px-6 py-4">Access Level</th>
                <th className="px-6 py-4">Authorized On</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} />
                    <p className="text-slate-500 mt-2">Loading authorized users...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <p className="text-slate-500">No users found matching your search.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                          {user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{user.name || 'Not Logged In Yet'}</div>
                          <div className="text-sm text-slate-500 flex items-center gap-1">
                            <Mail size={12} />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Revoke Access"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="text-indigo-600" size={20} />
                Authorize New User
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <Shield size={16} />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Email or Username</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    className="input pl-10"
                    placeholder="e.g. employee@gmail.com or admin"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Access Role</label>
                <select
                  className="input"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="Employee">Employee (Basic Access)</option>
                  <option value="Manager">Manager (Team View)</option>
                  <option value="Admin">Admin (Full Control)</option>
                  <option value="IT">IT (System Admin)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  IT and Admin roles can manage users and system settings.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <UserCheck size={18} />}
                  Grant Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
