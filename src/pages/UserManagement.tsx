import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import type { User, Role, Section } from '@/types';
import { ALL_SECTIONS } from '@/store/AppContext';
import { IconKey, IconLock, IconPlus, IconShield } from '@/components/Icons';

const SECTION_LABELS: Record<Section, string> = {
  billing:         'Billing',
  expenses:        'Expenses',
  reports:         'Reports',
  ledgers:         'Ledgers',
  journal:         'Journal',
  settings:        'Settings',
  qr_codes:        'QR Codes',
  marketing:       'QR Dashboard',
  customers:       'Customers',
  whatsapp:        'WhatsApp',
  attendance:      'Attendance',
  add_ons:         'Add-Ons',
  approvals:       'Approvals',
  user_management: 'User Management',
};

const ROLE_BADGE: Record<Role, string> = {
  superadmin: 'badge-green',
  accountant: 'badge-blue',
  employee:   'badge-gray',
  marketing:  'badge-purple',
  manager:    'badge-green',
};

const ROLE_LABEL: Record<Role, string> = {
  superadmin: 'Super Admin',
  accountant: 'Accountant',
  employee:   'Employee',
  marketing:  'Marketing',
  manager:    'Manager',
};

export default function UserManagement() {
  const { state, dispatch, isSuperAdmin } = useApp();
  const [editPerms, setEditPerms] = useState<string | null>(null);
  const [tempPerms, setTempPerms] = useState<Section[]>([]);
  const [editPassword, setEditPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editUser, setEditUser] = useState<string | null>(null);
  const [tempUser, setTempUser] = useState({ name: '', username: '', role: 'employee' as Role });
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', username: '', password: 'petstation2026', role: 'employee' as Role });

  if (!isSuperAdmin()) {
    return (
      <div className="card text-center py-20">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <IconLock size={24} className="text-gray-400" />
        </div>
        <p className="font-semibold text-gray-900">Access Restricted</p>
        <p className="text-sm text-gray-500 mt-1">Only Super Admins can manage users and permissions.</p>
      </div>
    );
  }

  const startEditPerms = (user: User) => { setEditPerms(user.id); setTempPerms([...user.permissions]); };
  const togglePerm = (s: Section) => setTempPerms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const savePerms = () => {
    if (!editPerms) return;
    dispatch({ type: 'UPDATE_USER_PERMISSIONS', payload: { userId: editPerms, permissions: tempPerms } });
    setEditPerms(null);
  };

  const addUser = () => {
    if (!newUser.name || !newUser.username) return alert('Name and username are required');
    const defaultPerms: Record<Role, Section[]> = {
      superadmin: ALL_SECTIONS,
      accountant: ['billing','expenses','reports','ledgers','customers','whatsapp','attendance'],
      employee:   ['billing'],
      marketing:  ['qr_codes','marketing','customers','whatsapp'],
      manager:    ['attendance','approvals'],
    };
    dispatch({
      type: 'ADD_USER',
      payload: { id: `usr-${Date.now()}`, ...newUser, avatar: newUser.name.charAt(0).toUpperCase(), permissions: defaultPerms[newUser.role], active: true },
    });
    setNewUser({ name: '', username: '', password: 'petstation2026', role: 'employee' });
    setShowAdd(false);
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">User Management</h2>
          <p className="page-subtitle">Manage accounts and section permissions</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary gap-2">
          <IconPlus size={14} />
          Add User
        </button>
      </div>

      {/* Add user form */}
      {showAdd && (
        <div className="card border-2 border-gray-200">
          <p className="section-title">New User</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input" value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} placeholder="username" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value as Role }))}>
                <option value="superadmin">Super Admin</option>
                <option value="accountant">Accountant</option>
                <option value="employee">Employee</option>
                <option value="marketing">Marketing</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addUser} className="btn-primary">Create User</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Users list */}
      <div className="space-y-3">
        {state.users.map(user => (
          <div key={user.id} className={`card transition-opacity ${!user.active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                  {user.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{user.name}</p>
                    <span className={ROLE_BADGE[user.role]}>{ROLE_LABEL[user.role]}</span>
                    {!user.active && <span className="badge-red">Disabled</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">@{user.username}</p>
                </div>
              </div>

              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => { setEditUser(user.id); setTempUser({ name: user.name, username: user.username, role: user.role }); setEditPerms(null); setEditPassword(null); }}
                  className="btn-secondary btn-sm gap-1.5"
                >
                  Edit
                </button>
                {user.role !== 'superadmin' && (
                  <button onClick={() => startEditPerms(user)} className="btn-secondary btn-sm gap-1.5">
                    <IconKey size={12} />
                    Permissions
                  </button>
                )}
                <button
                  onClick={() => { setEditPassword(user.id); setNewPassword(user.password); setShowPassword(false); }}
                  className="btn-secondary btn-sm gap-1.5"
                >
                  <IconLock size={12} />
                  Password
                </button>
                {user.id !== state.currentUser?.id && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${user.name}? This cannot be undone.`)) {
                        dispatch({ type: 'DELETE_USER', payload: user.id });
                      }
                    }}
                    className="btn-sm gap-1.5 btn-ghost text-red-500 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Permissions display */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {user.role === 'superadmin' ? (
                <span className="badge-green flex items-center gap-1.5">
                  <IconShield size={11} /> Full Access
                </span>
              ) : (
                user.permissions.map(p => (
                  <span key={p} className="badge-gray">{SECTION_LABELS[p]}</span>
                ))
              )}
            </div>

            {/* Edit user panel */}
            {editUser === user.id && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-700 mb-3">Edit {user.name}</p>
                <div className="grid grid-cols-2 gap-3 max-w-lg">
                  <div>
                    <label className="label">Full Name</label>
                    <input className="input" value={tempUser.name} onChange={e => setTempUser(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Username</label>
                    <input className="input" value={tempUser.username} onChange={e => setTempUser(p => ({ ...p, username: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <select className="input" value={tempUser.role} onChange={e => setTempUser(p => ({ ...p, role: e.target.value as Role }))}>
                      <option value="superadmin">Super Admin</option>
                      <option value="accountant">Accountant</option>
                      <option value="employee">Employee</option>
                      <option value="marketing">Marketing</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      if (!tempUser.name.trim() || !tempUser.username.trim()) return alert('Name and username are required');
                      dispatch({ type: 'UPDATE_USER', payload: { ...user, name: tempUser.name.trim(), username: tempUser.username.trim(), role: tempUser.role, avatar: tempUser.name.trim().charAt(0).toUpperCase() } });
                      setEditUser(null);
                    }}
                    className="btn-primary btn-sm"
                  >
                    Save Changes
                  </button>
                  <button onClick={() => setEditUser(null)} className="btn-secondary btn-sm">Cancel</button>
                </div>
              </div>
            )}

            {/* Password panel */}
            {editPassword === user.id && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-700 mb-3">Password for {user.name}</p>
                <div className="flex items-center gap-2 max-w-sm">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input flex-1"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="New password"
                  />
                  <button onClick={() => setShowPassword(p => !p)} className="btn-secondary btn-sm px-3">
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      if (!newPassword.trim()) return alert('Password cannot be empty');
                      dispatch({ type: 'UPDATE_USER', payload: { ...user, password: newPassword.trim() } });
                      setEditPassword(null);
                    }}
                    className="btn-primary btn-sm"
                  >
                    Save Password
                  </button>
                  <button onClick={() => setEditPassword(null)} className="btn-secondary btn-sm">Cancel</button>
                </div>
              </div>
            )}

            {/* Edit permissions panel */}
            {editPerms === user.id && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-700 mb-3">Edit access for {user.name}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_SECTIONS.filter(s => s !== 'user_management').map(section => (
                    <label key={section} className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={tempPerms.includes(section)}
                        onChange={() => togglePerm(section)}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700">{SECTION_LABELS[section]}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={savePerms} className="btn-primary btn-sm">Save Permissions</button>
                  <button onClick={() => setEditPerms(null)} className="btn-secondary btn-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
