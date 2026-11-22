import { useState, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import type { ExpenseEntry } from '@/types';
import { format } from 'date-fns';
import { IconTrash } from '@/components/Icons';
import { IconCheck } from '@/components/Icons';

const today = format(new Date(), 'yyyy-MM-dd');

function EditableDescription({ entry }: { entry: ExpenseEntry }) {
  const { dispatch } = useApp();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.description);

  const save = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== entry.description)
      dispatch({ type: 'UPDATE_EXPENSE_DESCRIPTION', payload: { id: entry.id, description: trimmed } });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          className="input py-1 text-sm"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(entry.description); setEditing(false); } }}
        />
        <button type="button" className="btn-icon text-emerald-600" onClick={save}><IconCheck size={13} /></button>
      </div>
    );
  }

  return (
    <span
      className="text-gray-600 cursor-pointer hover:text-gray-900 hover:underline underline-offset-2"
      onClick={() => setEditing(true)}
      title="Click to edit description"
    >
      {entry.description}
    </span>
  );
}

export default function Expenses() {
  const { state, dispatch } = useApp();
  const [date, setDate] = useState(today);
  const [ledgerId, setLedgerId] = useState('');
  const [subledgerId, setSubledgerId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');

  const sortedLedgers = useMemo(
    () => [...state.ledgers].sort((a, b) => a.name.localeCompare(b.name)),
    [state.ledgers],
  );

  const selectedLedger = sortedLedgers.find(l => l.id === ledgerId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerId || !partyId || !amount || !description) return alert('Fill required fields');
    const entry: ExpenseEntry = {
      id: `exp-${Date.now()}`,
      date, ledgerId, partyId,
      subledgerId: subledgerId || undefined,
      amount: parseFloat(amount),
      paymentMethod, description, note,
      createdBy: state.currentUser?.name || 'Unknown',
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_EXPENSE', payload: entry });
    setAmount(''); setDescription(''); setNote(''); setSubledgerId(''); setPartyId('');
  };

  const filtered = useMemo(() =>
    state.expenseEntries.filter(e => e.date === date).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [state.expenseEntries, date]
  );
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
        <div>
          <h2 className="page-title">Expenses</h2>
          <p className="text-sm text-gray-500 mt-1">All entries and additions apply to the selected date.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-600 whitespace-nowrap">Selected Date</label>
          <input
            type="date"
            className="input w-auto text-base font-semibold text-gray-900"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form */}
        <div className="card">
          <p className="section-title">Add Expense</p>
          <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="label">Party *</label>
                  <select className="input" value={partyId} onChange={e => setPartyId(e.target.value)} required>
                    <option value="">Select party...</option>
                    {state.parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Ledger *</label>
                  <select className="input" value={ledgerId} onChange={e => { setLedgerId(e.target.value); setSubledgerId(''); }} required>
                    <option value="">Select ledger...</option>
                    {sortedLedgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                {selectedLedger?.subledgers.length ? (
                  <div>
                    <label className="label">Sub-ledger</label>
                    <select className="input" value={subledgerId} onChange={e => setSubledgerId(e.target.value)}>
                      <option value="">None</option>
                      {selectedLedger.subledgers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                ) : null}
                <div>
                  <label className="label">Amount (₹) *</label>
                  <input type="text" inputMode="decimal" className="input" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    {state.paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Description *</label>
                  <input className="input" placeholder="What was this expense for?" value={description} onChange={e => setDescription(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Note</label>
                  <input className="input" placeholder="Optional note..." value={note} onChange={e => setNote(e.target.value)} />
                </div>
                <button type="submit" className="btn-primary w-full">Add Expense</button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="section-title mb-0">Expense Entries</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{format(new Date(date), 'dd MMM yyyy')}</span>
              <span className="badge-red font-semibold">₹{filteredTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No expenses for this date</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Party', 'Ledger', 'Description', 'Payment', 'Amount', ''].map(h => (
                      <th key={h} className={`py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const ledger = state.ledgers.find(l => l.id === e.ledgerId);
                    const sub = ledger?.subledgers.find(s => s.id === e.subledgerId);
                    const party = state.parties.find(p => p.id === e.partyId);
                    return (
                      <tr key={e.id} className="border-b border-gray-50 table-row-hover">
                        <td className="py-3">{party?.name ?? 'Others'}</td>
                        <td className="py-3">
                          <span className="font-medium text-gray-900">{ledger?.name ?? e.ledgerId}</span>
                          {sub && <span className="text-gray-400"> / {sub.name}</span>}
                        </td>
                        <td className="py-3">
                          <EditableDescription entry={e} />
                        </td>
                        <td className="py-3"><span className="badge-gray">{e.paymentMethod.toUpperCase()}</span></td>
                        <td className="py-3 text-right font-bold text-red-600">₹{e.amount.toLocaleString('en-IN')}</td>
                        <td className="py-3 text-right">
                          <button onClick={() => { if (confirm('Delete this expense?')) dispatch({ type: 'DELETE_EXPENSE', payload: e.id }); }} className="btn-icon">
                            <IconTrash size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
