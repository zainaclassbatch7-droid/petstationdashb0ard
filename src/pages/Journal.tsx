import { useState, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import type { JournalEntry, JournalField } from '@/types';
import { format } from 'date-fns';
import { IconTrash } from '@/components/Icons';

const today = format(new Date(), 'yyyy-MM-dd');

export default function Journal() {
  const { state, dispatch } = useApp();
  const [date, setDate] = useState(today);
  const [field, setField] = useState<JournalField>('salary');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return alert('Fill required fields');
    const balance = state.journalEntries
      .filter(j => j.field === field)
      .reduce((s, j) => j.type === 'add' ? s + j.amount : s - j.amount, 0);
    if (parseFloat(amount) > balance) return alert(`Insufficient balance for ${field}. Available: ₹${balance.toLocaleString('en-IN')}`);
    const entry: JournalEntry = {
      id: `jnl-${Date.now()}`,
      date, type: 'withdraw', field,
      amount: parseFloat(amount),
      description,
      createdBy: state.currentUser?.name || 'Unknown',
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_JOURNAL_ENTRY', payload: entry });
    setAmount(''); setDescription('');
  };

  const entries = useMemo(() =>
    [...state.journalEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [state.journalEntries]
  );

  const salaryAdded = entries.filter(e => e.field === 'salary' && e.type === 'add').reduce((s, e) => s + e.amount, 0);
  const salaryWithdrawn = entries.filter(e => e.field === 'salary' && e.type === 'withdraw').reduce((s, e) => s + e.amount, 0);
  const salaryBalance = salaryAdded - salaryWithdrawn;

  const maintenanceAdded = entries.filter(e => e.field === 'maintenance' && e.type === 'add').reduce((s, e) => s + e.amount, 0);
  const maintenanceWithdrawn = entries.filter(e => e.field === 'maintenance' && e.type === 'withdraw').reduce((s, e) => s + e.amount, 0);
  const maintenanceBalance = maintenanceAdded - maintenanceWithdrawn;

  const salaryEntries = entries.filter(e => e.field === 'salary' && e.date === date);
  const maintenanceEntries = entries.filter(e => e.field === 'maintenance' && e.date === date);

  const EntryTable = ({ list }: { list: JournalEntry[] }) => (
    list.length === 0 ? (
      <p className="text-sm text-gray-400 text-center py-6">No entries yet</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Date', 'Type', 'Description', 'Amount', ''].map(h => (
                <th key={h} className={`py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map(e => (
              <tr key={e.id} className="border-b border-gray-50 table-row-hover">
                <td className="py-3 text-gray-500 whitespace-nowrap">{format(new Date(e.date), 'dd MMM yyyy')}</td>
                <td className="py-3">
                  <span className={e.type === 'add' ? 'badge-green' : 'badge-red'}>{e.type === 'add' ? 'Added' : 'Withdrawn'}</span>
                </td>
                <td className="py-3 text-gray-600">{e.description}</td>
                <td className={`py-3 text-right font-bold whitespace-nowrap ${e.type === 'add' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {e.type === 'add' ? '+' : '-'}₹{e.amount.toLocaleString('en-IN')}
                </td>
                <td className="py-3 text-right">
                  <button onClick={() => { if (confirm('Delete this entry?')) dispatch({ type: 'DELETE_JOURNAL_ENTRY', payload: e.id }); }} className="btn-icon">
                    <IconTrash size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="page-title">Journal</h2>
          <p className="page-subtitle">Withdraw from salary & maintenance funds set aside in Expenses.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="text-center px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 min-w-[110px]">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Salary</p>
            <p className="font-bold text-emerald-700 text-lg mt-0.5">₹{salaryBalance.toLocaleString('en-IN')}</p>
            <p className="text-[11px] text-emerald-500 mt-0.5">of ₹{salaryAdded.toLocaleString('en-IN')} added</p>
          </div>
          <div className="text-center px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100 min-w-[110px]">
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Maintenance</p>
            <p className="font-bold text-blue-700 text-lg mt-0.5">₹{maintenanceBalance.toLocaleString('en-IN')}</p>
            <p className="text-[11px] text-blue-500 mt-0.5">of ₹{maintenanceAdded.toLocaleString('en-IN')} added</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Withdraw Form */}
        <div className="card">
          <p className="section-title mb-4">Withdraw from Journal</p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Field *</label>
              <div className="grid grid-cols-2 gap-2">
                {(['salary', 'maintenance'] as JournalField[]).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setField(f)}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors capitalize ${
                      field === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Available: ₹{(field === 'salary' ? salaryBalance : maintenanceBalance).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="text" inputMode="decimal" className="input" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
            </div>
            <div>
              <label className="label">Description *</label>
              <input className="input" placeholder="What is this withdrawal for?" value={description} onChange={e => setDescription(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary w-full">Withdraw</button>
          </form>
        </div>

        {/* Section for selected field only */}
        <div className="lg:col-span-2">
          {field === 'salary' ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="section-title mb-0">Salary — {format(new Date(date), 'dd MMM yyyy')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Added: ₹{salaryAdded.toLocaleString('en-IN')} · Withdrawn: ₹{salaryWithdrawn.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Balance</p>
                  <p className={`text-xl font-bold ${salaryBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>₹{salaryBalance.toLocaleString('en-IN')}</p>
                </div>
              </div>
              <EntryTable list={salaryEntries} />
            </div>
          ) : (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="section-title mb-0">Maintenance — {format(new Date(date), 'dd MMM yyyy')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Added: ₹{maintenanceAdded.toLocaleString('en-IN')} · Withdrawn: ₹{maintenanceWithdrawn.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Balance</p>
                  <p className={`text-xl font-bold ${maintenanceBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>₹{maintenanceBalance.toLocaleString('en-IN')}</p>
                </div>
              </div>
              <EntryTable list={maintenanceEntries} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
