import { useState, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { IconTrash, IconUser, IconClose } from '@/components/Icons';

function IconWhatsApp({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export default function Customers() {
  const { state, dispatch } = useApp();
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [msgModal, setMsgModal] = useState<{ phone: string; name: string } | null>(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [customMsg, setCustomMsg] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return state.customers
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .filter(c => !fromDate || c.lastVisit >= fromDate)
      .filter(c => !toDate   || c.lastVisit <= toDate)
      .sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());
  }, [state.customers, search, fromDate, toDate]);

  const totalCustomers = state.customers.length;
  // Only total customers are needed in this view

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectAll = () =>
    setSelected(selected.length === filtered.length ? [] : filtered.map(c => c.id));

  const buildMessage = (name: string) => {
    const tpl = state.whatsappTemplates.find(t => t.id === selectedTemplate);
    const base = tpl ? tpl.message : customMsg;
    return base.replace(/\{name\}/gi, name).replace(/\{business\}/gi, 'PetStation');
  };

  const openWhatsApp = (phone: string, name: string) => {
    const msg = buildMessage(name);
    const clean = phone.replace(/\D/g, '');
    const num = clean.startsWith('91') ? clean : `91${clean}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sendBulk = () => {
    const targets = state.customers.filter(c => selected.includes(c.id) && c.phone);
    targets.forEach((c, i) => {
      setTimeout(() => openWhatsApp(c.phone, c.name), i * 800);
    });
    setBulkModal(false);
    setSelected([]);
  };

  const MessageComposer = ({ onSend, onClose }: { onSend: () => void; onClose: () => void }) => (
    <div className="space-y-4">
      <div>
        <label className="label">Use Template</label>
        <select className="input" value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); if (e.target.value) { const t = state.whatsappTemplates.find(x => x.id === e.target.value); setCustomMsg(t?.message || ''); } }}>
          <option value="">Custom message...</option>
          {state.whatsappTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Message <span className="normal-case font-normal text-gray-400">— use {'{name}'} for customer name</span></label>
        <textarea
          className="input min-h-28 resize-none"
          placeholder="Type your message... Use {name} to personalise"
          value={customMsg}
          onChange={e => { setCustomMsg(e.target.value); setSelectedTemplate(''); }}
        />
      </div>
      <div className="flex gap-3">
        <button onClick={onSend} disabled={!customMsg.trim()} className="btn-primary flex-1 gap-2">
          <IconWhatsApp size={15} />
          Send via WhatsApp
        </button>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Customers</h2>
          <p className="page-subtitle">Visitor records collected from billing</p>
        </div>
        {selected.length > 0 && (
          <button onClick={() => setBulkModal(true)} className="btn-primary gap-2">
            <IconWhatsApp size={15} />
            Message {selected.length} selected
          </button>
        )}
      </div>

      {/* Stats: show only Total Customers */}
      <div className="grid grid-cols-1 gap-4">
        <div className="card text-center py-4 w-full max-w-xs">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Customers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalCustomers}</p>
        </div>
      </div>

      {/* Search + select all */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            className="input flex-1 min-w-48"
            placeholder="Search by name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">From</label>
            <input type="date" className="input w-auto" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">To</label>
            <input type="date" className="input w-auto" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          {(fromDate || toDate) && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => { setFromDate(''); setToDate(''); }}>Clear</button>
          )}
          {filtered.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={selectAll} className="w-4 h-4 rounded" />
              Select all
            </label>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <IconUser size={24} className="text-gray-300" />
            </div>
            <p className="font-medium text-gray-500">No customers yet</p>
            <p className="text-sm mt-1">Customer details entered during billing will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-3 w-8"></th>
                  {['Name', 'Phone', 'Visits', 'Last Visit', ''].map(h => (
                    <th key={h} className={`py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${h === 'Visits' ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 table-row-hover">
                    <td className="py-3">
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded" />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-semibold text-gray-600 text-xs flex-shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-gray-600">{c.phone || <span className="text-gray-300">—</span>}</td>
                    <td className="py-3 text-center">
                      <span className="badge-gray">{c.visitCount}</span>
                    </td>
                    <td className="py-3 text-gray-400 text-xs">{new Date(c.lastVisit).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {c.phone && (
                          <button
                            onClick={() => { setCustomMsg(''); setSelectedTemplate(''); setMsgModal({ phone: c.phone, name: c.name }); }}
                            className="btn-icon text-green-500 hover:bg-green-50"
                            title="Send WhatsApp"
                          >
                            <IconWhatsApp size={15} />
                          </button>
                        )}
                        <button onClick={() => { if (confirm('Delete this customer?')) dispatch({ type: 'DELETE_CUSTOMER', payload: c.id }); }} className="btn-icon">
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Single message modal */}
      {msgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setMsgModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">Send WhatsApp</h3>
                <p className="text-sm text-gray-400 mt-0.5">{msgModal.name} · {msgModal.phone}</p>
              </div>
              <button onClick={() => setMsgModal(null)} className="btn-icon"><IconClose size={16} /></button>
            </div>
            <MessageComposer
              onSend={() => { openWhatsApp(msgModal.phone, msgModal.name); setMsgModal(null); }}
              onClose={() => setMsgModal(null)}
            />
          </div>
        </div>
      )}

      {/* Bulk message modal */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setBulkModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">Bulk WhatsApp</h3>
                <p className="text-sm text-gray-400 mt-0.5">Sending to {selected.length} customers</p>
              </div>
              <button onClick={() => setBulkModal(false)} className="btn-icon"><IconClose size={16} /></button>
            </div>
            <MessageComposer onSend={sendBulk} onClose={() => setBulkModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
