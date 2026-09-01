import { useMemo, useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useApp } from '@/store/AppContext';
import { IconClose, IconTrash, IconPlus, IconMinus, IconCheck } from '@/components/Icons';

const today = format(new Date(), 'yyyy-MM-dd');

interface CartItem { addonId: string; name: string; price: number; quantity: number; }

export default function AddOns() {
  const { state, dispatch } = useApp();
  const [date, setDate] = useState(today);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [staffId, setStaffId] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(state.paymentMethods[0]?.id || 'cash');
  const [note, setNote] = useState('');
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeStaff = useMemo(
    () => state.staff.filter(m => m.active).sort((a, b) => a.name.localeCompare(b.name)),
    [state.staff],
  );
  const filteredStaff = useMemo(
    () => activeStaff.filter(m => m.name.toLowerCase().includes(staffSearch.toLowerCase())),
    [activeStaff, staffSearch],
  );
  const addons = useMemo(
    () => state.ticketItems.filter(t => t.category === 'addon' && t.price > 0),
    [state.ticketItems],
  );

  const entriesForDate = useMemo(
    () => state.addOnEntries.filter(e => e.date === date)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.addOnEntries, date],
  );

  const summaryByAddOn = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {};
    for (const e of entriesForDate) {
      map[e.ticketItemName] = {
        name: e.ticketItemName,
        count: (map[e.ticketItemName]?.count || 0) + e.count,
      };
    }
    return Object.values(map);
  }, [entriesForDate]);

  useEffect(() => {
    if (!focusItemId) return;
    const input = qtyRefs.current[focusItemId];
    if (input) { input.focus(); input.select(); setFocusItemId(null); }
  }, [focusItemId, cart]);

  useEffect(() => {
    const handleClick = () => setShowStaffDropdown(false);
    if (showStaffDropdown) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showStaffDropdown]);

  const addToCart = (id: string, name: string, price: number) => {
    setCart(prev => {
      const ex = prev.find(c => c.addonId === id);
      if (ex) return prev.map(c => c.addonId === id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { addonId: id, name, price, quantity: 1 }];
    });
    setFocusItemId(id);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev =>
      prev.map(c => c.addonId === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)
        .filter(c => c.quantity > 0)
    );
  };

  const setQty = (id: string, val: number) => {
    const q = Math.max(0, isNaN(val) ? 0 : val);
    setCart(prev => prev.map(c => c.addonId === id ? { ...c, quantity: q } : c).filter(c => c.quantity > 0));
  };

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const submit = () => {
    const member = activeStaff.find(s => s.id === staffId);
    if (!member || !cart.length || !state.currentUser) return;
    for (const item of cart) {
      dispatch({
        type: 'UPSERT_ADDON_ENTRY',
        payload: {
          id: `ao-${Date.now()}-${item.addonId}`,
          date,
          staffId: member.id,
          ticketItemId: item.addonId,
          ticketItemName: item.name,
          count: item.quantity,
          paymentMethod,
          note: note || undefined,
          submittedByUserId: state.currentUser.id,
          submittedByName: state.currentUser.name,
          createdAt: new Date().toISOString(),
        },
      });
    }
    setCart([]);
    setStaffId('');
    setStaffSearch('');
    setNote('');
    setPaymentMethod(state.paymentMethods[0]?.id || 'cash');
    setCartOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Add-ons & Experiences</h2>
          <p className="page-subtitle">Select your name and the add-on you gave</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" className="input w-auto" value={date} onChange={e => setDate(e.target.value)} />
          <button onClick={() => setCartOpen(true)} className="relative btn-primary gap-2 px-5 py-2.5">
            View Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Add-on buttons */}
      <div className="card space-y-4">
        <p className="section-title">Log an Add-On</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {addons.map(a => {
            const inCart = cart.find(c => c.addonId === a.id);
            return (
              <button
                key={a.id}
                onClick={() => { addToCart(a.id, a.name, a.price); setCartOpen(true); }}
                className="relative p-5 border-2 border-gray-100 rounded-2xl hover:border-gray-900 hover:shadow-md transition-all text-center bg-white"
              >
                {inCart && inCart.quantity > 0 && (
                  <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">
                    {inCart.quantity}
                  </span>
                )}
                <p className="font-semibold text-gray-900 text-sm leading-tight">{a.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-3">₹{a.price}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      {summaryByAddOn.length > 0 && (
        <div className="card">
          <p className="section-title mb-4">Add-On Summary for {date}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summaryByAddOn.map(addon => (
              <div key={addon.name} className="border border-gray-100 rounded-2xl p-4">
                <p className="font-semibold text-gray-900 mb-2">{addon.name}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total given</span>
                  <span className="font-bold text-gray-900">×{addon.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log */}
      <div className="card">
        <p className="section-title mb-4">Log for {date}</p>
        {entriesForDate.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No entries yet for this date</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Time', 'Staff', 'Add-On', 'Qty', 'Payment', 'Logged By', ''].map(h => (
                    <th key={h} className="py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entriesForDate.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 table-row-hover">
                    <td className="py-3 text-gray-400 text-xs">{new Date(e.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-3 font-medium text-gray-900">{activeStaff.find(s => s.id === e.staffId)?.name ?? e.staffId}</td>
                    <td className="py-3"><span className="badge-gray">{e.ticketItemName}</span></td>
                    <td className="py-3 font-bold text-gray-900">×{e.count}</td>
                    <td className="py-3"><span className="badge-gray">{e.paymentMethod?.toUpperCase()}</span></td>
                    <td className="py-3 text-gray-500 text-xs">{e.submittedByName}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => dispatch({ type: 'DELETE_ADDON_ENTRY', payload: e.id })} className="btn-icon">
                        <IconTrash size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CART MODAL ── */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 lg:p-4" onClick={() => setCartOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add-On Cart</h2>
                <p className="text-sm text-gray-400 mt-0.5">{cartCount} item{cartCount !== 1 ? 's' : ''} · ₹{cartTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setCart([]); }}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
                >
                  Clear Cart
                </button>
                <button onClick={() => setCartOpen(false)} className="btn-icon w-10 h-10">
                  <IconClose size={18} />
                </button>
              </div>
            </div>

            {/* Two-column body */}
            <div className="flex flex-1 min-h-0 divide-x divide-gray-100">

              {/* LEFT — add-on picker */}
              <div className="w-[40%] overflow-y-auto scrollbar-thin p-5 space-y-3 bg-gray-50/50">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 mb-3">Add-ons & Experiences</p>
                {addons.map(item => {
                  const inCart = cart.find(c => c.addonId === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item.id, item.name, item.price)}
                      className={`relative w-full rounded-3xl border-2 p-6 text-left shadow-sm transition hover:border-gray-900 hover:shadow-md ${
                        inCart && inCart.quantity > 0
                          ? 'border-gray-900 bg-gray-900'
                          : 'border-gray-100 bg-white'
                      }`}
                    >
                      {inCart && inCart.quantity > 0 && (
                        <span className="absolute top-4 right-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-900 text-xs font-bold">
                          {inCart.quantity}
                        </span>
                      )}
                      <p className={`text-lg font-bold ${inCart && inCart.quantity > 0 ? 'text-white' : 'text-gray-900'}`}>{item.name}</p>
                      <p className={`mt-3 text-3xl font-bold ${inCart && inCart.quantity > 0 ? 'text-gray-200' : 'text-gray-900'}`}>₹{item.price}</p>
                    </button>
                  );
                })}
              </div>

              {/* RIGHT — cart + checkout */}
              <div className="flex-1 flex flex-col min-h-0 bg-white">

                {/* Cart items */}
                <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-3">
                  {cart.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <IconPlus size={28} className="text-gray-300" />
                      </div>
                      <p className="font-medium text-gray-500">Cart is empty</p>
                      <p className="text-sm mt-1">Tap items on the left to add</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.addonId} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-400 mt-0.5">₹{item.price} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.addonId, -1)}
                            className="w-9 h-9 rounded-xl bg-white border-2 border-gray-200 hover:border-gray-900 hover:bg-gray-900 hover:text-white flex items-center justify-center transition-all">
                            <IconMinus size={13} />
                          </button>
                          <input type="number" min="0" value={item.quantity}
                            ref={el => { qtyRefs.current[item.addonId] = el; }}
                            onChange={e => setQty(item.addonId, parseInt(e.target.value))}
                            className="w-14 h-9 text-center text-lg font-bold text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 bg-white" />
                          <button onClick={() => updateQty(item.addonId, 1)}
                            className="w-9 h-9 rounded-xl bg-gray-900 text-white hover:bg-gray-700 flex items-center justify-center transition-all">
                            <IconPlus size={13} />
                          </button>
                        </div>
                        <p className="text-lg font-bold text-gray-900 w-20 text-right">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                        <button onClick={() => setQty(item.addonId, 0)}
                          className="w-9 h-9 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all">
                          <IconTrash size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer — staff, payment, submit */}
                <div className="px-6 py-5 border-t border-gray-100 space-y-4 bg-white shrink-0">

                  {/* Employee */}
                  <div onClick={e => e.stopPropagation()}>
                    <label className="label">Employee</label>
                    <div className="relative">
                      <input
                        type="text"
                        className="input w-full"
                        placeholder="Search or select employee…"
                        value={staffSearch}
                        onChange={e => { setStaffSearch(e.target.value); setShowStaffDropdown(true); }}
                        onFocus={() => setShowStaffDropdown(true)}
                      />
                      {showStaffDropdown && filteredStaff.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                          {filteredStaff.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl text-sm"
                              onClick={() => { setStaffId(m.id); setStaffSearch(m.name); setShowStaffDropdown(false); }}
                            >
                              {m.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment method */}
                  <div>
                    <label className="label">Payment Method</label>
                    <div className="grid grid-cols-3 gap-3">
                      {state.paymentMethods.map(pm => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id)}
                          className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                            paymentMethod === pm.id
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-900'
                          }`}
                        >{pm.name}</button>
                      ))}
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="label">Note <span className="text-gray-300 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Add details or customer note"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                  </div>

                  {/* Total + submit */}
                  <div className="flex items-center justify-between py-4 px-5 bg-gray-50 rounded-2xl">
                    <div>
                      <p className="text-sm text-gray-500">{cartCount} item{cartCount !== 1 ? 's' : ''} · <span className="capitalize">{paymentMethod}</span></p>
                      {staffSearch && staffId && <p className="text-sm font-medium text-gray-700">{staffSearch}</p>}
                    </div>
                    <p className="text-4xl font-bold text-gray-900">₹{cartTotal.toLocaleString('en-IN')}</p>
                  </div>

                  <button
                    onClick={submit}
                    disabled={!cart.length || !staffId}
                    className="btn-primary w-full py-4 text-base gap-3 rounded-2xl disabled:opacity-40"
                  >
                    <IconCheck size={18} />
                    Log Add-Ons — ₹{cartTotal.toLocaleString('en-IN')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
