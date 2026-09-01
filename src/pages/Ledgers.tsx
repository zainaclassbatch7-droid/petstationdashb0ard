import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import type { Ledger } from '@/types';
import { IconEdit, IconTrash, IconPlus, IconClose } from '@/components/Icons';

export default function Ledgers() {
  const { state, dispatch } = useApp();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'expense' | 'asset' | 'liability'>('expense');
  const [editId, setEditId] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) return;
    if (editId) {
      const existing = state.ledgers.find(l => l.id === editId)!;
      dispatch({ type: 'UPDATE_LEDGER', payload: { ...existing, name: name.trim(), category } });
      setEditId(null);
    } else {
      dispatch({ type: 'ADD_LEDGER', payload: { id: `led-${Date.now()}`, name: name.trim(), category, subledgers: [] } });
    }
    setName(''); setCategory('expense');
  };

  const startEdit = (l: Ledger) => { setEditId(l.id); setName(l.name); setCategory(l.category); };

  const addSub = (ledgerId: string) => {
    if (!subName.trim()) return;
    const ledger = state.ledgers.find(l => l.id === ledgerId)!;
    dispatch({ type: 'UPDATE_LEDGER', payload: { ...ledger, subledgers: [...ledger.subledgers, { id: `sub-${Date.now()}`, name: subName.trim() }] } });
    setSubName(''); setAddingSubFor(null);
  };

  const removeSub = (ledgerId: string, subId: string) => {
    const ledger = state.ledgers.find(l => l.id === ledgerId)!;
    dispatch({ type: 'UPDATE_LEDGER', payload: { ...ledger, subledgers: ledger.subledgers.filter(s => s.id !== subId) } });
  };

  const CAT_BADGE: Record<string, string> = { expense: 'badge-red', asset: 'badge-green', liability: 'badge-yellow' };

  const sortedLedgers = [...state.ledgers].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <div className="page-header">
        <h2 className="page-title">Ledgers</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form */}
        <div className="card">
          <p className="section-title">{editId ? 'Edit Ledger' : 'Add Ledger'}</p>
          <div className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="Ledger name..." value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={category} onChange={e => setCategory(e.target.value as typeof category)}>
                <option value="expense">Expense</option>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={save} className="btn-primary flex-1">{editId ? 'Update Ledger' : 'Add Ledger'}</button>
              {editId && (
                <button onClick={() => { setEditId(null); setName(''); }} className="btn-secondary">
                  <IconClose size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2 space-y-3">
          {sortedLedgers.map(ledger => (
            <div key={ledger.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-gray-900">{ledger.name}</span>
                  <span className={CAT_BADGE[ledger.category]}>{ledger.category}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(ledger)} className="btn-icon" title="Edit">
                    <IconEdit size={14} />
                  </button>
                  <button onClick={() => dispatch({ type: 'REQUEST_DELETE_LEDGER', payload: { id: ledger.id, requestedBy: state.currentUser?.name ?? 'Unknown' } })} className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50" title="Request Delete" disabled={!!ledger.deletionApproval && ledger.deletionApproval.status === 'pending'}>
                    {ledger.deletionApproval?.status === 'pending' ? <span className="text-[10px] font-semibold text-amber-500 px-1">Pending</span> : <IconTrash size={14} />}
                  </button>
                </div>
              </div>

              {ledger.subledgers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {ledger.subledgers.map(s => (
                    <span key={s.id} className="badge-gray flex items-center gap-1.5">
                      {s.name}
                      <button onClick={() => removeSub(ledger.id, s.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <IconClose size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {addingSubFor === ledger.id ? (
                <div className="flex gap-2 mt-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Sub-ledger name..."
                    value={subName}
                    onChange={e => setSubName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSub(ledger.id)}
                    autoFocus
                  />
                  <button onClick={() => addSub(ledger.id)} className="btn-primary btn-sm">Add</button>
                  <button onClick={() => setAddingSubFor(null)} className="btn-secondary btn-sm">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSubFor(ledger.id)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 font-medium transition-colors mt-1"
                >
                  <IconPlus size={12} /> Add Sub-ledger
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
