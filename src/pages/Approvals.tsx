import { useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { IconReceipt } from '@/components/Icons';

export default function Approvals() {
  const { state, dispatch, isManager } = useApp();

  const pendingRevenue = useMemo(() => state.revenueEntries.filter(e => e.deletionApproval?.status === 'pending'), [state.revenueEntries]);
  const pendingLedgers = useMemo(() => state.ledgers.filter(l => l.deletionApproval?.status === 'pending'), [state.ledgers]);

  if (!pendingRevenue.length && !pendingLedgers.length) return (
    <div className="card text-center py-12 text-gray-400">
      <IconReceipt size={36} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">No approval requests</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="section-title">Approvals</p>
      <div className="grid grid-cols-1 gap-3">
        {pendingRevenue.map(p => (
          <div key={p.id} className="p-4 bg-white rounded-2xl shadow-sm flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">₹{p.totalAmount.toLocaleString('en-IN')}</p>
                {p.invoiceNo && <span className="badge-gray">{p.invoiceNo}</span>}
                <span className="badge-red">Billing Delete</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{p.items.map(i => { const t = state.ticketItems.find(x => x.id === i.ticketItemId); return `${t?.name} ×${i.quantity}`; }).join(', ')}</p>
              <p className="text-xs text-gray-400 mt-1">Date: {p.date} · Time: {new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()} · By: {p.createdBy} · {p.paymentMethod.toUpperCase()}</p>
              <p className="text-xs text-gray-400 mt-1">Requested by: {p.deletionApproval?.requestedBy || 'Unknown'} · {new Date(p.createdAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
            </div>
            <div className="flex items-center gap-2">
              {isManager() ? (
                <>
                  <button onClick={() => dispatch({ type: 'APPROVE_DELETE_REVENUE', payload: p.id })} className="btn-primary px-3 py-2 gap-2">Approve</button>
                  <button onClick={() => dispatch({ type: 'REJECT_DELETE_REVENUE', payload: { id: p.id } })} className="btn-secondary px-3 py-2 gap-2">Reject</button>
                </>
              ) : (
                <span className="badge badge-yellow">Sent for approval</span>
              )}
            </div>
          </div>
        ))}
        {pendingLedgers.map(l => (
          <div key={l.id} className="p-4 bg-white rounded-2xl shadow-sm flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{l.name}</p>
                <span className="badge-yellow">{l.category}</span>
                <span className="badge-red">Ledger Delete</span>
              </div>
              {l.subledgers.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">Sub-ledgers: {l.subledgers.map(s => s.name).join(', ')}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Requested by: {l.deletionApproval?.requestedBy || 'Unknown'} · {new Date(l.deletionApproval?.requestedAt ?? '').toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
            </div>
            <div className="flex items-center gap-2">
              {isManager() ? (
                <>
                  <button onClick={() => dispatch({ type: 'APPROVE_DELETE_LEDGER', payload: l.id })} className="btn-primary px-3 py-2 gap-2">Approve</button>
                  <button onClick={() => dispatch({ type: 'REJECT_DELETE_LEDGER', payload: l.id })} className="btn-secondary px-3 py-2 gap-2">Reject</button>
                </>
              ) : (
                <span className="badge badge-yellow">Sent for approval</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
