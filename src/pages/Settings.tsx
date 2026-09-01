import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import type { TicketItem } from '@/types';
import { IconEdit, IconTrash, IconSave, IconExport, IconCheck } from '@/components/Icons';

export default function Settings() {
  const { state, dispatch } = useApp();
  const [backendUrl, setBackendUrl] = useState(state.settings.backendUrl);
  const [adminPassword, setAdminPassword] = useState(state.settings.adminPassword);
  const [openingBalance, setOpeningBalance] = useState(state.settings.openingBalance.toString());
  const [whatsappNumber, setWhatsappNumber] = useState(state.settings.whatsappNumber);
  const [businessName, setBusinessName] = useState(state.settings.businessName || 'PetStation');
  const [businessAddress, setBusinessAddress] = useState(state.settings.businessAddress || '');
  const [businessPhone, setBusinessPhone] = useState(state.settings.businessPhone || '');
  const [businessGST, setBusinessGST] = useState(state.settings.businessGST || '');
  const [taxPercent, setTaxPercent] = useState((state.settings.taxPercent ?? 18).toString());
  const [saved, setSaved] = useState(false);
  const [editItem, setEditItem] = useState<TicketItem | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCat, setNewItemCat] = useState<'entry' | 'combo' | 'addon'>('addon');

  const saveSettings = () => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { backendUrl, adminPassword, openingBalance: parseFloat(openingBalance) || 0, whatsappNumber, businessName, businessAddress, businessPhone, businessGST, taxPercent: parseFloat(taxPercent) || 0 } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addTicketItem = () => {
    if (!newItemName) return;
    dispatch({ type: 'ADD_TICKET_ITEM', payload: { id: `ti-${Date.now()}`, name: newItemName, price: parseFloat(newItemPrice) || 0, category: newItemCat } });
    setNewItemName(''); setNewItemPrice('');
  };

  const saveEditItem = () => {
    if (!editItem) return;
    dispatch({ type: 'UPDATE_TICKET_ITEM', payload: editItem });
    setEditItem(null);
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* System config */}
        <div className="card">
          <p className="section-title">System Configuration</p>
          <div className="space-y-3">
            <div>
              <label className="label">Business Name</label>
              <input className="input" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="PetStation" />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} placeholder="Mattool Central, Kannur" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Phone</label>
                <input className="input" value={businessPhone} onChange={e => setBusinessPhone(e.target.value)} placeholder="9746955534" />
              </div>
              <div>
                <label className="label">GST Number</label>
                <input className="input" value={businessGST} onChange={e => setBusinessGST(e.target.value)} placeholder="32BWGPS0178G1ZJ" />
              </div>
            </div>
            <div>
              <label className="label">Tax % (GST)</label>
              <input className="input" type="number" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} placeholder="18" />
            </div>
            <div>
              <label className="label">Backend URL (Zoo QR Server)</label>
              <input className="input" value={backendUrl} onChange={e => setBackendUrl(e.target.value)} placeholder="http://localhost:3000" />
            </div>
            <div>
              <label className="label">Admin Token</label>
              <input className="input" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
            </div>
            <div>
              <label className="label">Default Opening Balance (₹)</label>
              <input className="input" type="number" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} />
            </div>
            <div>
              <label className="label">WhatsApp Number</label>
              <input className="input" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="+91XXXXXXXXXX" />
            </div>
            <button onClick={saveSettings} className={`btn-primary w-full gap-2 ${saved ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
              {saved ? <IconCheck size={14} /> : <IconSave size={14} />}
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Ticket items */}
        <div className="card">
          <p className="section-title">Ticket & Add-on Items</p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin mb-4">
            {state.ticketItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                {editItem?.id === item.id ? (
                  <>
                    <input className="input flex-1 text-xs py-1.5" value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} />
                    <input className="input w-20 text-xs py-1.5" type="number" value={editItem.price} onChange={e => setEditItem({ ...editItem, price: parseFloat(e.target.value) || 0 })} />
                    <button onClick={saveEditItem} className="btn-icon text-emerald-600 hover:bg-emerald-50"><IconCheck size={13} /></button>
                    <button onClick={() => setEditItem(null)} className="btn-icon"><IconTrash size={13} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-gray-900">{item.name}</span>
                    <span className="badge-gray">{item.category}</span>
                    <span className="text-sm font-bold text-gray-900 w-14 text-right">₹{item.price}</span>
                    <button onClick={() => setEditItem({ ...item })} className="btn-icon"><IconEdit size={13} /></button>
                    <button onClick={() => { if (confirm('Delete this item?')) dispatch({ type: 'DELETE_TICKET_ITEM', payload: item.id }); }} className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"><IconTrash size={13} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="label">Add New Item</p>
            <div className="flex gap-2">
              <input className="input flex-1 text-sm" placeholder="Item name" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
              <input className="input w-24 text-sm" type="number" placeholder="Price" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <select className="input flex-1 text-sm" value={newItemCat} onChange={e => setNewItemCat(e.target.value as typeof newItemCat)}>
                <option value="entry">Entry</option>
                <option value="combo">Combo</option>
                <option value="addon">Add-on</option>
              </select>
              <button onClick={addTicketItem} className="btn-primary btn-sm gap-1.5">
                <IconPlus size={13} />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data management */}
      <div className="card border border-red-100">
        <p className="text-sm font-semibold text-red-700 mb-1">Data Management</p>
        <p className="text-sm text-gray-500 mb-4">All data is stored locally in your browser. Export a backup before clearing.</p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const data = localStorage.getItem('petstation-v2');
              if (!data) return;
              const blob = new Blob([data], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `petstation-backup-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
            }}
            className="btn-secondary gap-2"
          >
            <IconExport size={14} />
            Export Backup
          </button>
          <button
            onClick={() => {
              if (confirm('This will permanently clear ALL local data. Are you sure?')) {
                localStorage.removeItem('petstation-v2');
                window.location.reload();
              }
            }}
            className="btn-danger gap-2"
          >
            <IconTrash size={14} />
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
}

// need to import IconPlus locally
function IconPlus({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
