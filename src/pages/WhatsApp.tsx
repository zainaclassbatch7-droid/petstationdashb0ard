import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { IconEdit, IconTrash, IconClose, IconCheck } from '@/components/Icons';

function IconWhatsApp({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const DEFAULT_TEMPLATES = [
  { name: 'Welcome', message: 'Hi {name}! 👋 Welcome to PetStation! We\'re so glad you visited us. Come back soon for more amazing experiences with our animals! 🐾' },
  { name: 'Thank You', message: 'Thank you for visiting PetStation, {name}! 🙏 We hope you had a wonderful time. We\'d love to see you again soon!' },
  { name: 'Special Offer', message: 'Hi {name}! 🎉 PetStation has a special offer just for you! Visit us this weekend and get exciting discounts. See you soon! 🐾' },
  { name: 'Feedback Request', message: 'Hi {name}! We hope you enjoyed your visit to PetStation. We\'d love to hear your feedback. Your opinion helps us improve! 😊' },
];

export default function WhatsApp() {
  const { state, dispatch } = useApp();
  const [tplName, setTplName] = useState('');
  const [tplMsg, setTplMsg] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [sendModal, setSendModal] = useState<{ templateId: string } | null>(null);
  const [customPhone, setCustomPhone] = useState('');
  const [customName, setCustomName] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [preview, setPreview] = useState('');

  const saveTemplate = () => {
    if (!tplName.trim() || !tplMsg.trim()) return;
    if (editId) {
      dispatch({ type: 'UPDATE_WA_TEMPLATE', payload: { id: editId, name: tplName.trim(), message: tplMsg.trim(), createdAt: new Date().toISOString() } });
      setEditId(null);
    } else {
      dispatch({ type: 'ADD_WA_TEMPLATE', payload: { id: `wa-${Date.now()}`, name: tplName.trim(), message: tplMsg.trim(), createdAt: new Date().toISOString() } });
    }
    setTplName(''); setTplMsg('');
  };

  const startEdit = (id: string) => {
    const t = state.whatsappTemplates.find(x => x.id === id);
    if (!t) return;
    setEditId(id); setTplName(t.name); setTplMsg(t.message);
  };

  const addDefault = (d: typeof DEFAULT_TEMPLATES[0]) => {
    dispatch({ type: 'ADD_WA_TEMPLATE', payload: { id: `wa-${Date.now()}`, name: d.name, message: d.message, createdAt: new Date().toISOString() } });
  };

  const buildMsg = (templateId: string, name: string) => {
    const t = state.whatsappTemplates.find(x => x.id === templateId);
    if (!t) return '';
    return t.message.replace(/\{name\}/gi, name || 'there').replace(/\{business\}/gi, 'PetStation');
  };

  const sendToPhone = (templateId: string, phone: string, name: string) => {
    const msg = buildMsg(templateId, name);
    const clean = phone.replace(/\D/g, '');
    const num = clean.startsWith('91') ? clean : `91${clean}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sendToSelected = () => {
    const targets = state.customers.filter(c => selectedCustomers.includes(c.id) && c.phone);
    targets.forEach(c => sendToPhone(sendModal!.templateId, c.phone, c.name));
    setSendModal(null);
    setSelectedCustomers([]);
  };

  const activeTpl = sendModal ? state.whatsappTemplates.find(t => t.id === sendModal.templateId) : null;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">WhatsApp</h2>
          <p className="page-subtitle">Manage message templates and send to customers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Template form */}
        <div className="card space-y-3">
          <p className="section-title">{editId ? 'Edit Template' : 'New Template'}</p>
          <div>
            <label className="label">Template Name</label>
            <input className="input" placeholder="e.g. Welcome Message" value={tplName} onChange={e => setTplName(e.target.value)} />
          </div>
          <div>
            <label className="label">
              Message
              <span className="normal-case font-normal text-gray-400 ml-1">— use {'{name}'} for customer name</span>
            </label>
            <textarea
              className="input min-h-32 resize-none"
              placeholder="Hi {name}, welcome to PetStation!..."
              value={tplMsg}
              onChange={e => setTplMsg(e.target.value)}
            />
            {tplMsg && (
              <p className="text-xs text-gray-400 mt-1">
                Preview: {tplMsg.replace(/\{name\}/gi, 'Rahul').replace(/\{business\}/gi, 'PetStation').slice(0, 80)}{tplMsg.length > 80 ? '...' : ''}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={saveTemplate} disabled={!tplName.trim() || !tplMsg.trim()} className="btn-primary flex-1 gap-1.5">
              <IconCheck size={14} />
              {editId ? 'Update' : 'Save Template'}
            </button>
            {editId && <button onClick={() => { setEditId(null); setTplName(''); setTplMsg(''); }} className="btn-secondary"><IconClose size={14} /></button>}
          </div>

          {/* Default templates */}
          {state.whatsappTemplates.length === 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick Start Templates</p>
              <div className="space-y-2">
                {DEFAULT_TEMPLATES.map(d => (
                  <button key={d.name} onClick={() => addDefault(d)} className="w-full text-left p-2.5 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
                    <p className="text-sm font-medium text-gray-800">{d.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{d.message.slice(0, 50)}...</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Templates list */}
        <div className="lg:col-span-2 space-y-3">
          {state.whatsappTemplates.length === 0 ? (
            <div className="card text-center py-14 text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <IconWhatsApp size={24} className="text-gray-300" />
              </div>
              <p className="font-medium text-gray-500">No templates yet</p>
              <p className="text-sm mt-1">Create a template or use the quick start options</p>
            </div>
          ) : (
            state.whatsappTemplates.map(t => (
              <div key={t.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{t.name}</p>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{t.message}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setSendModal({ templateId: t.id }); setPreview(buildMsg(t.id, 'Rahul')); setSelectedCustomers([]); setCustomPhone(''); setCustomName(''); }}
                      className="btn-secondary btn-sm gap-1.5 text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <IconWhatsApp size={13} />
                      Send
                    </button>
                    <button onClick={() => startEdit(t.id)} className="btn-icon"><IconEdit size={14} /></button>
                    <button onClick={() => { if (confirm('Delete template?')) dispatch({ type: 'DELETE_WA_TEMPLATE', payload: t.id }); }} className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"><IconTrash size={14} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Send modal */}
      {sendModal && activeTpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSendModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Send: {activeTpl.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{state.customers.filter(c => c.phone).length} customers with phone numbers</p>
              </div>
              <button onClick={() => setSendModal(null)} className="btn-icon"><IconClose size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5">
              {/* Preview */}
              <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Message Preview</p>
                <p className="text-sm text-gray-700 leading-relaxed">{preview || buildMsg(sendModal.templateId, 'Customer')}</p>
              </div>

              {/* Send to single custom number */}
              <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Send to Custom Number</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Name</label>
                    <input className="input" placeholder="Customer name" value={customName} onChange={e => { setCustomName(e.target.value); setPreview(buildMsg(sendModal.templateId, e.target.value || 'Customer')); }} />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" placeholder="+91XXXXXXXXXX" type="tel" value={customPhone} onChange={e => setCustomPhone(e.target.value)} />
                  </div>
                </div>
                <button
                  onClick={() => { sendToPhone(sendModal.templateId, customPhone, customName); }}
                  disabled={!customPhone.trim()}
                  className="btn-primary w-full gap-2"
                >
                  <IconWhatsApp size={15} />
                  Send to this number
                </button>
              </div>

              {/* Send to saved customers */}
              {state.customers.filter(c => c.phone).length > 0 && (
                <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Send to Saved Customers</p>
                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCustomers.length === state.customers.filter(c => c.phone).length}
                        onChange={() => {
                          const withPhone = state.customers.filter(c => c.phone).map(c => c.id);
                          setSelectedCustomers(selectedCustomers.length === withPhone.length ? [] : withPhone);
                        }}
                        className="w-3.5 h-3.5 rounded"
                      />
                      Select all
                    </label>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                    {state.customers.filter(c => c.phone).map(c => (
                      <label key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCustomers.includes(c.id)}
                          onChange={() => setSelectedCustomers(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                          className="w-4 h-4 rounded"
                        />
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.phone}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedCustomers.length > 0 && (
                    <button onClick={sendToSelected} className="btn-primary w-full gap-2">
                      <IconWhatsApp size={15} />
                      Send to {selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
