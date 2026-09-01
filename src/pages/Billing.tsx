import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '@/store/AppContext';
import type { RevenueEntry } from '@/types';
import { format } from 'date-fns';
import { saveBillMessage, fetchBillMessage, saveBillLayout, fetchBillLayout, getNextInvoiceNo, upsertRevenue } from '@/lib/dbSync';
import type { BillLayout } from '@/lib/dbSync';
import { IconPlus, IconMinus, IconTrash, IconClose, IconCheck, IconSync, IconReceipt } from '@/components/Icons';
interface CartItem { ticketItemId: string; name: string; price: number; quantity: number; }
function QtyInput({ item, qtyRefs, setQty, removeIfZero }: {
  item: CartItem;
  qtyRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  setQty: (id: string, val: number) => void;
  removeIfZero: (id: string) => void;
}) {
  const [draft, setDraft] = useState(String(item.quantity));
  useEffect(() => { setDraft(String(item.quantity)); }, [item.quantity]);
  return (
    <input
      type="text" inputMode="numeric" pattern="[0-9]*"
      value={draft}
      ref={el => { qtyRefs.current[item.ticketItemId] = el; }}
      onFocus={e => e.target.select()}
      onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
      onChange={e => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setDraft(val);
        setQty(item.ticketItemId, val === '' ? 0 : parseInt(val));
      }}
      onBlur={() => { removeIfZero(item.ticketItemId); setDraft(String(item.quantity)); }}
      className="w-14 h-9 text-center text-lg font-bold text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 bg-white"
    />
  );
}

// Module-level lock — survives React re-renders, prevents double checkout
let checkoutInProgress = false;

export default function Billing() {
  const { state, dispatch } = useApp();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lastEntry, setLastEntry] = useState<RevenueEntry | null>(null);
  const [lastCustomer, setLastCustomer] = useState({ name: '', phone: '' });
  const [cartOpen, setCartOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const isCheckingOutRef = useRef(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  const paymentOptions = [
    { id: 'cash', label: 'Cash' },
    { id: 'upi', label: 'UPI' },
    { id: 'card', label: 'Card' },
  ];

  const entryTickets = state.ticketItems.filter(t => t.category !== 'addon');
  const addons = state.ticketItems.filter(t => t.category === 'addon');
  const [groupCount, setGroupCount] = useState(0);
  const [groupPrice, setGroupPrice] = useState(0);
  const [groupName, setGroupName] = useState('');
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const customerNameRef = useRef<HTMLInputElement | null>(null);
  const customerPhoneRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!focusItemId) return;
    const input = qtyRefs.current[focusItemId];
    if (input) {
      input.focus();
      input.select();
      setFocusItemId(null);
    }
  }, [focusItemId, cart]);

  const [printConfirm, setPrintConfirm] = useState(false);
  const [addonModal, setAddonModal] = useState<{ id: string; name: string; price: number } | null>(null);
  const printConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paymentBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const printBtnRef = useRef<HTMLButtonElement | null>(null);
  const paymentMethodRef = useRef(paymentMethod);
  useEffect(() => { paymentMethodRef.current = paymentMethod; }, [paymentMethod]);
  const checkoutRef = useRef<() => void>(() => {});
  const cartRef = useRef(cart);
  const paymentMethodStateRef = useRef(paymentMethod);
  const customerNameRef2 = useRef(customerName);
  const customerPhoneRef2 = useRef(customerPhone);
  useEffect(() => { cartRef.current = cart; }, [cart]);
  useEffect(() => { paymentMethodStateRef.current = paymentMethod; }, [paymentMethod]);
  useEffect(() => { customerNameRef2.current = customerName; }, [customerName]);
  useEffect(() => { customerPhoneRef2.current = customerPhone; }, [customerPhone]);

  const successOpenRef = useRef(false);
  useEffect(() => { successOpenRef.current = successOpen; }, [successOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Always let success modal intercept first
      if (successOpenRef.current) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          setPrintConfirm(false);
          isCheckingOutRef.current = false;
          setIsCheckingOut(false);
          setSuccessOpen(false);
        }
        return;
      }

      // Shift+ArrowLeft → add Entry Only, Shift+ArrowRight → add Combo Entry
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const target = e.key === 'ArrowLeft'
          ? state.ticketItems.find(t => t.id === 'entry-only')
          : state.ticketItems.find(t => t.id === 'combo-entry');
        if (target) addToCart(target.id, target.name, target.price);
        return;
      }

      if (e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        const target = state.ticketItems.find(t => t.name.trim().toLowerCase() === 'ultimate pet lover pass');
        if (target) addToCart(target.id, target.name, target.price);
        return;
      }

      if (e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        if (groupCount > 0) {
          const id = 'group-ticket';
          const total = groupCount * groupPrice;
          const label = groupName.trim()
            ? `Group Ticket (${groupName.trim()} (₹${groupPrice})) x ${groupCount}`
            : `Group Ticket (₹${groupPrice}) x ${groupCount}`;
          setCart(prev => {
            const ex = prev.find(c => c.ticketItemId === id);
            if (ex) return prev.map(c => c.ticketItemId === id ? { ...c, quantity: 1, price: total, name: label } : c);
            return [...prev, { ticketItemId: id, name: label, price: total, quantity: 1 }];
          });
          setCartOpen(true);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (addonModal) { setAddonModal(null); return; }
        if (!cartOpen) return;
        setCart([]);
        setPaymentMethod('');
        setCustomerName('');
        setCustomerPhone('');
        setGroupName('');
        setPrintConfirm(false);
        setCartOpen(false);
        return;
      }

      if (!cartOpen) return;

      // Backspace on a qty input → let it work naturally (setQty handles 0)
      if (e.key === 'Backspace') {
        const active = document.activeElement as HTMLInputElement;
        const cartIds = cart.map(c => c.ticketItemId);
        const focusedId = cartIds.find(id => qtyRefs.current[id] === active);
        if (focusedId) return; // let the input handle it natively
      }

      // Enter → select payment → focus print → confirm → print
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!cart.filter(c => c.quantity > 0).length) return;
        const active = document.activeElement as HTMLElement;
        const focusedPayment = paymentOptions.find(o => paymentBtnRefs.current[o.id] === active);
        if (focusedPayment) {
          setPaymentMethod(focusedPayment.id);
          paymentMethodRef.current = focusedPayment.id;
          setTimeout(() => printBtnRef.current?.focus(), 0);
          return;
        }
        if (active === printBtnRef.current) {
          if (!printConfirm) {
            setPrintConfirm(true);
            if (printConfirmTimer.current) clearTimeout(printConfirmTimer.current);
            printConfirmTimer.current = setTimeout(() => setPrintConfirm(false), 3000);
          } else {
            setPrintConfirm(false);
            if (printConfirmTimer.current) clearTimeout(printConfirmTimer.current);
            checkoutRef.current();
          }
          return;
        }
        if (!paymentMethod) { const b = paymentBtnRefs.current[paymentOptions[0]?.id]; if (b) b.focus(); }
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const cartIds = cart.map(c => c.ticketItemId);
        const focusableEls: HTMLElement[] = [
          ...cartIds.map(id => qtyRefs.current[id]).filter(Boolean) as HTMLInputElement[],
          customerNameRef.current,
          customerPhoneRef.current,
          ...paymentOptions.map(o => paymentBtnRefs.current[o.id]).filter(Boolean) as HTMLButtonElement[],
        ].filter(Boolean) as HTMLElement[];
        if (!focusableEls.length) return;
        const active = document.activeElement as HTMLElement;
        const idx = focusableEls.indexOf(active);
        const next = idx === -1 ? 0
          : e.key === 'ArrowDown'
            ? (idx + 1) % focusableEls.length
            : (idx - 1 + focusableEls.length) % focusableEls.length;
        focusableEls[next].focus();
        (focusableEls[next] as HTMLInputElement).select?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartOpen, addonModal, cart, state.ticketItems, printConfirm]);

  const addToCart = (id: string, name: string, price: number) => {
    setCart(prev => {
      const ex = prev.find(c => c.ticketItemId === id);
      if (ex) return prev.map(c => c.ticketItemId === id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ticketItemId: id, name, price, quantity: 0 }];
    });
    setFocusItemId(id);
    setCartOpen(true);
  };

  const setQty = (id: string, val: number) => {
    const q = Math.max(0, isNaN(val) ? 0 : val);
    setCart(prev => prev.map(c => c.ticketItemId === id ? { ...c, quantity: q } : c));
  };

  const removeIfZero = (id: string) => {
    setCart(prev => prev.filter(c => !(c.ticketItemId === id && c.quantity === 0)));
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(c => c.ticketItemId === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const syncAll = async () => {
    setIsSyncing(true);
    const unsynced = state.revenueEntries.filter(e => !e.synced && !e.deletionApproval);
    await Promise.allSettled(unsynced.map(e =>
      upsertRevenue(e).then(() => dispatch({ type: 'MARK_SYNCED', payload: [e.id] }))
    ));
    setIsSyncing(false);
  };

  const unsyncedCount = state.revenueEntries.filter(e => !e.synced).length;
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  const groupNameRef = useRef(groupName);
  useEffect(() => { groupNameRef.current = groupName; }, [groupName]);


  const getBillLines = (items: RevenueEntry['items']) => {
    const rows: { name: string; hsn: string; price: number; qty: number; taxPct: number; total: number }[] = [];
    for (const i of items) {
      const id = i.ticketItemId;
      const qty = i.quantity;
      if (id === 'entry-only') {
        rows.push({ name: 'Entry Ticket', hsn: draftHsnEntry, price: +(draftEntryPrice / 1.18).toFixed(2), qty, taxPct: 18, total: draftEntryPrice * qty });
      } else if (id === 'combo-entry') {
        rows.push({ name: 'Entry Ticket', hsn: draftHsnEntry, price: +(draftComboEntryPrice / 1.18).toFixed(2), qty, taxPct: 18, total: draftComboEntryPrice * qty });
        rows.push({ name: 'Pet Feed', hsn: draftHsnLiveFeed, price: draftPetFeedPrice, qty, taxPct: 0, total: draftPetFeedPrice * qty });
      } else if (id === 'ultimate-pet-lover-pass' || (i.name ?? '').trim().toLowerCase() === 'ultimate pet lover pass') {
        rows.push({ name: 'Ultimate Pet Lover Entry Ticket', hsn: draftHsnEntry, price: +(draftEntryPrice / 1.18).toFixed(2), qty, taxPct: 18, total: draftEntryPrice * qty });
        rows.push({ name: 'Live Feed', hsn: draftHsnLiveFeed, price: draftLiveFeedPrice, qty, taxPct: 0, total: draftLiveFeedPrice * qty });
      } else {
        const unitPrice = i.unitPrice > 0 ? i.unitPrice : i.total / i.quantity;
        rows.push({ name: i.name ?? id, hsn: '', price: unitPrice, qty, taxPct: state.settings.taxPercent ?? 18, total: i.total });
      }
    }
    return rows;
  };

  const printTicket = (entry: RevenueEntry) => {
    const s = state.settings;
    const layout = billLayout;
    const billRows = getBillLines(entry.items);
    const ultimateQty = entry.items.filter(i => i.ticketItemId === 'ultimate-pet-lover-pass' || (i.name ?? '').trim().toLowerCase() === 'ultimate pet lover pass').reduce((s, i) => s + i.quantity, 0);
    const lines = billRows.map(r => `<tr>
        <td style="padding:4px 0;font-size:12px;">${r.name}</td>
        <td style="text-align:center;font-size:12px;">${r.hsn}</td>
        <td style="text-align:center;font-size:12px;">${r.price.toFixed(2)}</td>
        <td style="text-align:center;font-size:12px;">${r.qty}</td>
        <td style="text-align:center;font-size:12px;">${r.taxPct}</td>
        <td style="text-align:right;font-size:12px;">${r.total.toFixed(2)}</td>
      </tr>`).join('');

    const dateStr = new Date(entry.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' });
    const timeStr = new Date(entry.createdAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true }).toUpperCase();
    const totalQty = entry.items.reduce((s, i) => s + i.quantity, 0);

    const html = `
      <div style="font-family:monospace;width:100%;box-sizing:border-box;padding:8px;">
        <div style="text-align:center;margin-bottom:8px;">
          <img src="/logo.png" style="width:120px;height:120px;object-fit:contain;display:block;margin:0 auto 4px;" />
          <div style="font-size:16px;font-weight:bold;letter-spacing:1px;">${s.businessName || 'PetStation'}</div>
        </div>
        <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:6px 0;margin-bottom:8px;text-align:center;font-size:12px;">
          <div style="font-weight:bold;">${s.businessAddress || ''}</div>
          ${s.businessPhone ? `<div>TEL : ${s.businessPhone}</div>` : ''}
          ${s.businessGST ? `<div>GST : ${s.businessGST}</div>` : ''}
        </div>
        <div style="font-size:12px;margin-bottom:6px;">
          <div>Date &nbsp;&nbsp;: ${dateStr} - ${timeStr}</div>
          <div>Invoice : ${entry.invoiceNo || '-'}</div>
        </div>
        <div style="border-top:1px dashed #000;padding-top:6px;margin-bottom:6px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="text-align:left;font-size:11px;padding-bottom:4px;">Particulars</th>
              <th style="text-align:center;font-size:11px;padding-bottom:4px;">HSN</th>
              <th style="text-align:center;font-size:11px;padding-bottom:4px;">Price</th>
              <th style="text-align:center;font-size:11px;padding-bottom:4px;">Qty</th>
              <th style="text-align:center;font-size:11px;padding-bottom:4px;">Tax%</th>
              <th style="text-align:right;font-size:11px;padding-bottom:4px;">Amount</th>
            </tr></thead>
            <tbody style="border-top:1px dashed #000;">${lines}</tbody>
          </table>
        </div>
        <div style="border-top:1px dashed #000;padding-top:6px;font-size:13px;font-weight:bold;margin-bottom:4px;">
          ${ultimateQty > 0 ? `<div>ULTIMATE PET LOVER : ${ultimateQty}</div>` : ''}
          ${totalQty - ultimateQty > 0 ? `<div>ENTRY : ${totalQty - ultimateQty}</div>` : ''}
          <div style="font-size:15px;">TOTAL : Rs ${entry.totalAmount.toFixed(2)}/-</div>
        </div>
        ${layout.beforeFooterImage || layout.beforeFooterText ? `<div style="border-top:1px dashed #000;padding-top:6px;margin-top:6px;text-align:center;">${layout.beforeFooterImage ? `<img src="${layout.beforeFooterImage}" style="max-width:100%;max-height:80px;object-fit:contain;display:block;margin:0 auto 4px;" />` : ''}${layout.beforeFooterText ? `<div style="font-size:11px;color:#333;white-space:pre-wrap;">${layout.beforeFooterText}</div>` : ''}</div>` : ''}
        <div style="border-top:1px dashed #000;padding-top:6px;font-size:11px;color:#555;text-align:center;margin-top:6px;">${customMessage}</div>
      </div>`;

    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Ticket</title><style>
      @page { size: 80mm auto; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; width: 80mm; }
      body { display: inline-block; }
    </style></head><body>${html}<script>
      window.onload = function() { window.print(); window.close(); };
    <\/script></body></html>`);
    win.document.close();
  };

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const checkout = async () => {
    // Module-level lock: prevents double-fire even across re-renders
    if (checkoutInProgress) return;
    checkoutInProgress = true;
    if (isCheckingOutRef.current) { checkoutInProgress = false; return; }
    isCheckingOutRef.current = true;
    setIsCheckingOut(true);
    const pm = paymentMethodRef.current;
    const positiveItems = cartRef.current.filter(c => c.quantity > 0);
    if (!positiveItems.length || !pm) {
      isCheckingOutRef.current = false;
      checkoutInProgress = false;
      setIsCheckingOut(false);
      return;
    }
    const invoiceNo = await getNextInvoiceNo();
    const snapName = customerNameRef2.current.trim();
    const snapPhone = customerPhoneRef2.current.trim();
    const entry: RevenueEntry = {
      id: crypto.randomUUID(),
      date: today,
      invoiceNo,
      items: positiveItems.map(c => ({ ticketItemId: c.ticketItemId, name: c.name, quantity: c.quantity, unitPrice: c.price, total: c.price * c.quantity })),
      paymentMethod: pm,
      totalAmount: positiveItems.reduce((s, c) => s + c.price * c.quantity, 0),
      createdBy: stateRef.current.currentUser?.name || 'Unknown',
      createdAt: new Date().toISOString(),
      synced: false,
    };
    // Save immediately — do not wait for Done button
    dispatch({ type: 'ADD_REVENUE', payload: entry });
    upsertRevenue(entry).then(() => dispatch({ type: 'MARK_SYNCED', payload: [entry.id] })).catch(() => {});
    if (snapName) {
      const existing = stateRef.current.customers.find(c => c.phone === snapPhone && snapPhone !== '') || stateRef.current.customers.find(c => c.name.toLowerCase() === snapName.toLowerCase() && !snapPhone);
      if (existing) {
        dispatch({ type: 'UPSERT_CUSTOMER', payload: { ...existing, visitCount: existing.visitCount + 1, totalSpent: existing.totalSpent + entry.totalAmount, lastVisit: today } });
      } else {
        dispatch({ type: 'UPSERT_CUSTOMER', payload: { id: `cust-${Date.now()}`, name: snapName, phone: snapPhone, visitCount: 1, totalSpent: entry.totalAmount, lastVisit: today, createdAt: new Date().toISOString() } });
      }
    }
    setLastEntry(entry);
    setLastCustomer({ name: snapName, phone: snapPhone });
    setCart([]);
    setPaymentMethod('');
    setCustomerName('');
    setCustomerPhone('');
    setGroupName('');
    setPrintConfirm(false);
    setCartOpen(false);
    setSuccessOpen(true);
    isCheckingOutRef.current = false;
    checkoutInProgress = false;
    setIsCheckingOut(false);
    printTicket(entry);
  };
  checkoutRef.current = checkout;

  const [addonQty, setAddonQty] = useState(1);
  const [addonPayment, setAddonPayment] = useState('cash');
  const [billPreviewOpen, setBillPreviewOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState('Thank you for visiting PetStation!');
  const [billLayout, setBillLayout] = useState<BillLayout>({});
  // Editable bill header fields (local draft, saved on click)
  const [draftName, setDraftName] = useState(state.settings.businessName || 'PetStation');
  const [draftAddress, setDraftAddress] = useState(state.settings.businessAddress || '');
  const [draftPhone, setDraftPhone] = useState(state.settings.businessPhone || '');
  const [draftGST, setDraftGST] = useState(state.settings.businessGST || '');
  const [draftTax, setDraftTax] = useState(String(state.settings.taxPercent ?? 18));
  const [draftEntryPrice, setDraftEntryPrice] = useState(150);
  const [draftComboEntryPrice, setDraftComboEntryPrice] = useState(150);
  const [draftPetFeedPrice, setDraftPetFeedPrice] = useState(50);
  const [draftLiveFeedPrice, setDraftLiveFeedPrice] = useState(300);
  const [draftHsnEntry, setDraftHsnEntry] = useState('9508');
  const [draftHsnPetFeed, setDraftHsnPetFeed] = useState('1206');
  const [draftHsnLiveFeed, setDraftHsnLiveFeed] = useState('0106');
  const [billSaved, setBillSaved] = useState(false);

  useEffect(() => {
    fetchBillMessage().then(msg => { if (msg) setCustomMessage(msg); });
    fetchBillLayout().then(l => { if (l) setBillLayout(l); });
  }, []);
  const saveCustomMessage = (msg: string) => {
    setCustomMessage(msg);
    saveBillMessage(msg);
  };
  const saveBillChanges = () => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: {
      businessName: draftName, businessAddress: draftAddress,
      businessPhone: draftPhone, businessGST: draftGST,
      taxPercent: parseFloat(draftTax) || 0,
    } });
    saveBillLayout(billLayout);
    setBillSaved(true);
    setTimeout(() => setBillSaved(false), 2000);
  };

  const openAddonModal = (item: { id: string; name: string; price: number }) => {
    setAddonModal(item);
    setAddonQty(1);
    setAddonPayment('cash');
  };

  const confirmAddon = () => {
    if (!addonModal || addonQty <= 0) return;
    const { id, name, price } = addonModal;
    const qty = addonQty;
    const payment = addonPayment;
    setCart(prev => {
      const ex = prev.find(c => c.ticketItemId === id);
      if (ex) return prev.map(c => c.ticketItemId === id ? { ...c, quantity: qty } : c);
      return [...prev, { ticketItemId: id, name, price, quantity: qty }];
    });
    setPaymentMethod(payment);
    setAddonModal(null);
    setCartOpen(true);
  };

  const todayEntries = useMemo(() =>
    state.revenueEntries
      .filter(e => e.date === today)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [state.revenueEntries, today]
  );

  const [closingOpen, setClosingOpen] = useState(false);

  const closingStats = useMemo(() => {
    const rev = state.revenueEntries.filter(e => e.date === today);
    const exp = state.expenseEntries.filter(e => e.date === today);
    const methods = ['cash', 'upi', 'card'];
    const revByMethod: Record<string, number> = {};
    const expByMethod: Record<string, number> = {};
    methods.forEach(m => {
      revByMethod[m] = rev.filter(e => e.paymentMethod === m).reduce((s, e) => s + e.totalAmount, 0);
      expByMethod[m] = exp.filter(e => e.paymentMethod === m).reduce((s, e) => s + e.amount, 0);
    });
    // include any other payment methods
    [...rev, ...exp].forEach(e => {
      if (!methods.includes(e.paymentMethod)) {
        revByMethod[e.paymentMethod] = (revByMethod[e.paymentMethod] || 0) + (('totalAmount' in e) ? (e as any).totalAmount : 0);
        expByMethod[e.paymentMethod] = (expByMethod[e.paymentMethod] || 0) + (('amount' in e) ? (e as any).amount : 0);
      }
    });
    const totalRevenue = rev.reduce((s, e) => s + e.totalAmount, 0);
    const totalExpenses = exp.reduce((s, e) => s + e.amount, 0);
    const cashFlow = state.cashFlows.find(c => c.date === today);
    const opening = cashFlow?.openingBalance || 0;
    return { revByMethod, expByMethod, totalRevenue, totalExpenses, net: totalRevenue - totalExpenses, transactions: rev.length, opening, allMethods: [...new Set([...Object.keys(revByMethod), ...Object.keys(expByMethod)].filter(m => (revByMethod[m] || 0) + (expByMethod[m] || 0) > 0))] };
  }, [state.revenueEntries, state.expenseEntries, state.cashFlows, today]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Billing</h2>
          <p className="page-subtitle">Offline-capable — data saved locally</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setClosingOpen(true)} className="btn-danger gap-2 px-5 py-2.5">
            Close Billing
          </button>
          <span className={`badge ${isOnline ? 'badge-green' : 'badge-yellow'}`}>
            {isOnline ? 'Online' : 'Offline Mode'}
          </span>
          {unsyncedCount > 0 && (
            <button onClick={syncAll} disabled={isSyncing || !isOnline} className="btn-secondary gap-2 px-5 py-2.5">
              <IconSync size={16} />
              {isSyncing ? 'Syncing...' : `Sync ${unsyncedCount} bills to DB`}
            </button>
          )}
          <button onClick={() => setBillPreviewOpen(true)} className="btn-secondary gap-2 px-5 py-2.5">
            <IconReceipt size={16} />
            Show Bill Layout
          </button>
          <button onClick={() => setCartOpen(true)} className="relative btn-primary gap-2 px-5 py-2.5">
            <IconReceipt size={16} />
            View Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>


      {/* Transactions */}
      <div className="card">
        <p className="section-title">Transactions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entryTickets.map(item => {
            const inCart = cart.find(c => c.ticketItemId === item.id);
            return (
              <button
                key={item.id}
                onClick={() => addToCart(item.id, item.name, item.price)}
                className="relative p-6 border-2 border-gray-100 rounded-2xl hover:border-gray-900 hover:shadow-md transition-all text-left bg-white group"
              >
                {inCart && inCart.quantity > 0 && (
                  <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">
                    {inCart.quantity}
                  </span>
                )}
                <p className="text-lg font-bold text-gray-900">{item.name}</p>
                <span className="badge-gray mt-1 inline-block capitalize">{item.category}</span>
                <p className="text-3xl font-bold text-gray-900 mt-4">₹{item.price}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 group-hover:text-gray-700 transition-colors font-medium">
                  <IconPlus size={12} /> Tap to add
                </div>
              </button>
            );
          })}

          {/* Group ticket */}
          <div className="relative p-6 border-2 border-gray-100 rounded-2xl bg-white flex flex-col gap-4">
            <div>
              <p className="text-lg font-bold text-gray-900">Group</p>
              <span className="badge-gray mt-1 inline-block">group</span>
            </div>
            <div>
              <label className="label">Group Name</label>
              <input
                type="text"
                className="input font-medium"
                placeholder="e.g. School Trip"
                value={groupName}
                onClick={e => e.stopPropagation()}
                onChange={e => setGroupName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">People</label>
                <input
                  type="number"
                  min={1}
                  className="input text-center font-bold"
                  value={groupCount}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setGroupCount(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div>
                <label className="label">Price / head</label>
                <input
                  type="number"
                  min={0}
                  className="input text-center font-bold"
                  value={groupPrice}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setGroupPrice(Math.max(0, Number(e.target.value)))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-gray-900">₹{groupCount * groupPrice}</p>
              <button
                className="btn-primary px-4 py-2 gap-2 text-sm"
                onClick={() => {
                  const id = 'group-ticket';
                  const total = groupCount * groupPrice;
                        const label = groupName.trim()
                          ? `Group Ticket (${groupName.trim()} (₹${groupPrice})) x ${groupCount}`
                          : `Group Ticket (₹${groupPrice}) x ${groupCount}`;
                  setCart(prev => {
                    const ex = prev.find(c => c.ticketItemId === id);
                          if (ex) return prev.map(c => c.ticketItemId === id ? { ...c, quantity: 1, price: total, name: label } : c);
                          return [...prev, { ticketItemId: id, name: label, price: total, quantity: 1 }];
                  });
                  setCartOpen(true);
                }}
              >
                <IconPlus size={14} /> Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add-ons */}
      <div className="card">
        <p className="section-title mb-4">Add-ons & Experiences</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {addons.map(item => {
            const inCart = cart.find(c => c.ticketItemId === item.id);
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.price === 0) return;
                  if (inCart && inCart.quantity > 0) { setCartOpen(true); return; }
                  openAddonModal(item);
                }}
                disabled={item.price === 0}
                className={`relative flex flex-col items-start gap-1 rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                  inCart && inCart.quantity > 0
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-100 bg-white hover:border-gray-900 hover:shadow-sm'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {inCart && inCart.quantity > 0 && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white text-gray-900 text-xs font-bold flex items-center justify-center">
                    {inCart.quantity}
                  </span>
                )}
                <p className={`text-sm font-semibold leading-tight ${inCart && inCart.quantity > 0 ? 'text-white' : 'text-gray-900'}`}>{item.name}</p>
                <p className={`text-base font-bold ${inCart && inCart.quantity > 0 ? 'text-gray-200' : 'text-gray-700'}`}>
                  {item.price > 0 ? `₹${item.price}` : 'TBD'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transactions table */}
      <div className="card">
        <p className="section-title">Today's Transactions</p>
        {todayEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><p className="text-sm">No transactions today</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Time', 'Invoice', 'Items', 'Payment', 'Amount', 'Sync', ''].map(h => (
                    <th key={h} className={`py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${h === 'Amount' ? 'text-right' : h === 'Sync' ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayEntries.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 table-row-hover">
                    <td className="py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(e.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}</td>
                    <td className="py-3 text-xs font-medium text-gray-500">{e.invoiceNo || '—'}</td>
                    <td className="py-3 text-gray-700 max-w-xs truncate">{e.items.map(i => { const t = state.ticketItems.find(x => x.id === i.ticketItemId); const name = i.name ?? t?.name ?? i.ticketItemId; return i.ticketItemId === 'group-ticket' ? name : `${name} ×${i.quantity}`; }).join(', ')}</td>
                    <td className="py-3"><span className="badge-gray capitalize">{e.paymentMethod}</span></td>
                    <td className="py-3 text-right font-bold text-gray-900">₹{e.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-center">
                      {e.deletionApproval?.status === 'pending' ? (
                        <span className="badge-red">Approval pending</span>
                      ) : e.deletionApproval?.status === 'rejected' ? (
                        <span className="badge-yellow">Approval rejected</span>
                      ) : e.synced ? (
                        <span className="badge-green">Synced</span>
                      ) : (
                        <span className="badge-yellow">Pending</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {e.deletionApproval?.status === 'pending' ? (
                        <button className="btn-secondary btn-sm px-3 py-2" disabled>Pending approval</button>
                      ) : (
                        <button
                          onClick={() => {
                            if (confirm('Delete this transaction? This will request approval for deletion.')) {
                              dispatch({ type: 'REQUEST_DELETE_REVENUE', payload: { id: e.id, requestedBy: state.currentUser?.id } });
                              alert('Deletion requested. Approval pending.');
                            }
                          }}
                          className="btn-danger btn-sm px-3 py-2"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CART MODAL ──────────────────────────────────────────────────────── */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 lg:p-4" onClick={() => { setCart([]); setPaymentMethod(''); setCustomerName(''); setCustomerPhone(''); setGroupName(''); setCartOpen(false); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Current Order</h2>
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
                <button onClick={() => { setCart([]); setPaymentMethod(''); setCustomerName(''); setCustomerPhone(''); setGroupName(''); setCartOpen(false); }} className="btn-icon w-10 h-10">
                  <IconClose size={18} />
                </button>
              </div>
            </div>

            {/* Two-column body */}
            <div className="flex flex-1 min-h-0 divide-x divide-gray-100">

              {/* LEFT — item picker */}
              <div className="w-[40%] overflow-y-auto scrollbar-thin p-5 space-y-5 bg-gray-50/50">

                {/* Transactions */}
                <div className="rounded-3xl border border-gray-100 bg-white p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Transactions</p>
                  </div>
                  <div className="space-y-3">
                    {entryTickets.map(item => {
                      const inCart = cart.find(c => c.ticketItemId === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => addToCart(item.id, item.name, item.price)}
                          className="relative w-full rounded-3xl border-2 border-gray-100 bg-white p-6 text-left shadow-sm transition hover:border-gray-900 hover:shadow-md"
                        >
                          {inCart && inCart.quantity > 0 && (
                            <span className="absolute top-4 right-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                              {inCart.quantity}
                            </span>
                          )}
                          <p className="text-lg font-bold text-gray-900">{item.name}</p>
                          <p className="mt-3 text-3xl font-bold text-gray-900">₹{item.price}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Group tile */}
                <div className="rounded-3xl border border-gray-100 bg-white p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Group Ticket</p>
                  </div>
                  <div>
                    <label className="label text-xs">Group Name</label>
                    <input type="text" className="input font-medium py-2" placeholder="e.g. School Trip" value={groupName}
                      onChange={e => setGroupName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">People</label>
                      <input type="number" min={0} className="input text-center font-bold py-2" value={groupCount}
                        onChange={e => setGroupCount(Math.max(0, Number(e.target.value)))} />
                    </div>
                    <div>
                      <label className="label text-xs">₹ / head</label>
                      <input type="number" min={0} className="input text-center font-bold py-2" value={groupPrice}
                        onChange={e => setGroupPrice(Math.max(0, Number(e.target.value)))} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold text-gray-900">₹{groupCount * groupPrice}</p>
                    <button
                      className="btn-primary px-3 py-2 gap-1 text-sm"
                      onClick={() => {
                        const id = 'group-ticket';
                        const total = groupCount * groupPrice;
                        const label = groupName.trim()
                          ? `Group Ticket (${groupName.trim()} (₹${groupPrice})) x ${groupCount}`
                          : `Group Ticket (₹${groupPrice}) x ${groupCount}`;
                        setCart(prev => {
                          const ex = prev.find(c => c.ticketItemId === id);
                          if (ex) return prev.map(c => c.ticketItemId === id ? { ...c, quantity: 1, price: total, name: label } : c);
                          return [...prev, { ticketItemId: id, name: label, price: total, quantity: 1 }];
                        });
                      }}
                      disabled={groupCount <= 0}
                    >
                      <IconPlus size={13} /> Add
                    </button>
                  </div>
                </div>

                {/* Add-ons */}
                <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Add-ons & Experiences</p>
                  <div className="grid grid-cols-2 gap-2">
                    {addons.map(item => {
                      const inCart = cart.find(c => c.ticketItemId === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.price === 0) return;
                            if (inCart && inCart.quantity > 0) { setCartOpen(false); setAddonModal(item); setAddonQty(1); setAddonPayment('cash'); return; }
                            setCartOpen(false); openAddonModal(item);
                          }}
                          disabled={item.price === 0}
                          className={`relative flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2 text-left transition-all ${
                            inCart && inCart.quantity > 0
                              ? 'border-gray-900 bg-gray-900'
                              : 'border-gray-100 bg-white hover:border-gray-900 hover:shadow-sm'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {inCart && inCart.quantity > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white text-gray-900 text-[10px] font-bold flex items-center justify-center">
                              {inCart.quantity}
                            </span>
                          )}
                          <p className={`text-xs font-semibold leading-tight ${inCart && inCart.quantity > 0 ? 'text-white' : 'text-gray-900'}`}>{item.name}</p>
                          <p className={`text-sm font-bold ${inCart && inCart.quantity > 0 ? 'text-gray-300' : 'text-gray-600'}`}>{item.price > 0 ? `₹${item.price}` : 'TBD'}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* RIGHT — cart + checkout */}
              <div className="flex-1 flex flex-col min-h-0 bg-white">

                {/* Cart items */}
                <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-3">
                  {cart.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <IconReceipt size={28} className="text-gray-300" />
                      </div>
                      <p className="font-medium text-gray-500">Cart is empty</p>
                      <p className="text-sm mt-1">Tap items on the left to add</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.ticketItemId} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          {item.ticketItemId !== 'group-ticket' && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-sm text-gray-400">₹</span>
                              <input
                                type="text" inputMode="numeric"
                                value={item.price}
                                readOnly
                                onFocus={e => e.target.select()}
                                className="w-20 h-7 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-2 focus:outline-none bg-gray-100 cursor-not-allowed"
                              />
                              <span className="text-sm text-gray-400">each</span>
                            </div>
                          )}
                        </div>
                        {item.ticketItemId !== 'group-ticket' ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQty(item.ticketItemId, -1)}
                              className="w-9 h-9 rounded-xl bg-white border-2 border-gray-200 hover:border-gray-900 hover:bg-gray-900 hover:text-white flex items-center justify-center transition-all">
                              <IconMinus size={13} />
                            </button>
                            <QtyInput item={item} qtyRefs={qtyRefs} setQty={setQty} removeIfZero={removeIfZero} />
                            <button onClick={() => updateQty(item.ticketItemId, 1)}
                              className="w-9 h-9 rounded-xl bg-gray-900 text-white hover:bg-gray-700 flex items-center justify-center transition-all">
                              <IconPlus size={13} />
                            </button>
                          </div>
                        ) : null}
                        <p className="text-lg font-bold text-gray-900 w-20 text-right">₹{item.price.toLocaleString('en-IN')}</p>
                        <button onClick={() => setCart(prev => prev.filter(c => c.ticketItemId !== item.ticketItemId))}
                          className="w-9 h-9 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all">
                          <IconTrash size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Customer + checkout footer */}
                <div className="px-6 py-5 border-t border-gray-100 space-y-4 bg-white shrink-0">
                {/* Customer */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Customer Name <span className="text-gray-300 font-normal">(optional)</span></label>
                      <input ref={customerNameRef} className="input py-2" placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Phone <span className="text-gray-300 font-normal">(optional)</span></label>
                      <input ref={customerPhoneRef} className="input py-2" placeholder="Phone" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                    </div>
                  </div>

                  {/* Payment method buttons */}
                  <div>
                    <label className="label">Payment Method</label>
                    <div className="grid grid-cols-3 gap-3">
                      {paymentOptions.map(option => (
                        <button
                          key={option.id}
                          ref={el => { paymentBtnRefs.current[option.id] = el; }}
                          type="button"
                          onClick={() => setPaymentMethod(option.id)}
                          className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${paymentMethod === option.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-900'}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Total + checkout */}
                  <div className="flex items-center justify-between py-4 px-5 bg-gray-50 rounded-2xl">
                    <div>
                      <p className="text-sm text-gray-500">{cartCount} item{cartCount !== 1 ? 's' : ''} · <span className="capitalize">{paymentMethod}</span></p>
                      {customerName && <p className="text-sm font-medium text-gray-700">{customerName}{customerPhone ? ` · ${customerPhone}` : ''}</p>}
                    </div>
                    <p className="text-4xl font-bold text-gray-900">₹{cartTotal.toLocaleString('en-IN')}</p>
                  </div>

                  <button ref={printBtnRef} onClick={() => { if (!printConfirm) { setPrintConfirm(true); if (printConfirmTimer.current) clearTimeout(printConfirmTimer.current); printConfirmTimer.current = setTimeout(() => setPrintConfirm(false), 3000); } else { setPrintConfirm(false); checkout(); } }} disabled={!cart.length || !paymentMethod || isCheckingOut} className={`w-full py-4 text-base gap-3 rounded-2xl flex items-center justify-center font-semibold transition disabled:opacity-40 ${printConfirm ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-0' : 'btn-primary'}`}>
                    <IconCheck size={18} />
                    Print Ticket — ₹{cartTotal.toLocaleString('en-IN')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADDON MODAL ─────────────────────────────────────────────────────── */}
      {addonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAddonModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">{addonModal.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">₹{addonModal.price} per unit</p>
              </div>
              <button onClick={() => setAddonModal(null)} className="btn-icon w-8 h-8"><IconClose size={15} /></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Quantity */}
              <div>
                <label className="label text-xs mb-1.5">Quantity</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAddonQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-white border-2 border-gray-200 hover:border-gray-900 hover:bg-gray-900 hover:text-white flex items-center justify-center transition-all">
                    <IconMinus size={13} />
                  </button>
                  <input type="number" min={1} value={addonQty} onChange={e => setAddonQty(Math.max(1, Number(e.target.value)))}
                    className="w-16 h-8 text-center text-base font-bold text-gray-900 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-gray-900 bg-white" />
                  <button onClick={() => setAddonQty(q => q + 1)} className="w-8 h-8 rounded-lg bg-gray-900 text-white hover:bg-gray-700 flex items-center justify-center transition-all">
                    <IconPlus size={13} />
                  </button>
                  <span className="text-sm font-bold text-gray-400 ml-1">= ₹{(addonModal.price * addonQty).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Payment — Cash & UPI only */}
              <div>
                <label className="label text-xs mb-1.5">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {['cash', 'upi'].map(id => (
                    <button key={id} type="button" onClick={() => setAddonPayment(id)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition capitalize ${
                        addonPayment === id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-900'
                      }`}>{id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total + confirm */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-xs text-gray-400">{addonQty} × {addonModal.name} · <span className="capitalize">{addonPayment}</span></p>
                  <p className="text-xl font-bold text-gray-900">₹{(addonModal.price * addonQty).toLocaleString('en-IN')}</p>
                </div>
                <button onClick={confirmAddon} className="btn-primary px-4 py-2.5 text-sm gap-2 rounded-xl">
                  <IconCheck size={14} /> Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BILL PREVIEW MODAL ─────────────────────────────────────────────── */}
      {billPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setBillPreviewOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Bill Layout</h2>
                <p className="text-sm text-gray-400 mt-0.5">Edit fields, then save — all future prints will reflect changes</p>
              </div>
              <button onClick={() => setBillPreviewOpen(false)} className="btn-icon w-10 h-10"><IconClose size={18} /></button>
            </div>

            <div className="flex flex-1 min-h-0 divide-x divide-gray-100 overflow-hidden">
              {/* LEFT — live preview */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-8 bg-gray-50 flex items-start justify-center">
                <div style={{ fontFamily: 'monospace', width: 300, background: '#fff', padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}>
                  <div style={{ textAlign: 'center', marginBottom: 10 }}>
                    <img src="/logo.png" style={{ width: 120, height: 120, objectFit: 'contain', display: 'block', margin: '0 auto 6px' }} />
                    <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 1 }}>{draftName || 'PetStation'}</div>
                  </div>
                  <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0', marginBottom: 8, textAlign: 'center', fontSize: 12 }}>
                    <div style={{ fontWeight: 'bold' }}>{draftAddress || 'Mattool Central, Kannur'}</div>
                    {draftPhone && <div>TEL : {draftPhone}</div>}
                    {draftGST && <div>GST : {draftGST}</div>}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>
                    <div>Date &nbsp;&nbsp;: {new Date().toLocaleDateString('en-IN')} - {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}</div>
                    <div>Invoice : A#1</div>
                  </div>
                  <div style={{ borderTop: '1px dashed #000', paddingTop: 6, marginBottom: 6 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>
                        <th style={{ textAlign: 'left', fontSize: 11, paddingBottom: 4 }}>Particulars</th>
                        <th style={{ textAlign: 'center', fontSize: 11, paddingBottom: 4 }}>HSN</th>
                        <th style={{ textAlign: 'center', fontSize: 11, paddingBottom: 4 }}>Price</th>
                        <th style={{ textAlign: 'center', fontSize: 11, paddingBottom: 4 }}>Qty</th>
                        <th style={{ textAlign: 'center', fontSize: 11, paddingBottom: 4 }}>Tax%</th>
                        <th style={{ textAlign: 'right', fontSize: 11, paddingBottom: 4 }}>Amt</th>
                      </tr></thead>
                      <tbody style={{ borderTop: '1px dashed #000' }}>
                        <tr>
                          <td style={{ padding: '3px 0', fontSize: 12 }}>Entry Ticket</td>
                          <td style={{ textAlign: 'center', fontSize: 12 }}>{draftHsnEntry}</td>
                          <td style={{ textAlign: 'center', fontSize: 12 }}>{(draftEntryPrice / 1.18).toFixed(2)}</td>
                          <td style={{ textAlign: 'center', fontSize: 12 }}>1</td>
                          <td style={{ textAlign: 'center', fontSize: 12 }}>18</td>
                          <td style={{ textAlign: 'right', fontSize: 12 }}>{(draftEntryPrice).toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '3px 0', fontSize: 12 }}>Pet Feed</td>
                          <td style={{ textAlign: 'center', fontSize: 12 }}>{draftHsnLiveFeed}</td>
                          <td style={{ textAlign: 'center', fontSize: 12 }}>{(draftPetFeedPrice).toFixed(2)}</td>
                          <td style={{ textAlign: 'center', fontSize: 12 }}>1</td>
                          <td style={{ textAlign: 'center', fontSize: 12 }}>0</td>
                          <td style={{ textAlign: 'right', fontSize: 12 }}>{(draftPetFeedPrice).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div style={{ borderTop: '1px dashed #000', paddingTop: 6, fontSize: 13, fontWeight: 'bold', marginBottom: 4 }}>
                    <div>ENTRY : 1</div>
                    <div style={{ fontSize: 15 }}>TOTAL : Rs {(draftEntryPrice + draftPetFeedPrice).toFixed(2)}/-</div>
                  </div>
                  {/* Before-footer block */}
                  {(billLayout.beforeFooterImage || billLayout.beforeFooterText) && (
                    <div style={{ borderTop: '1px dashed #000', paddingTop: 6, marginTop: 6, textAlign: 'center' }}>
                      {billLayout.beforeFooterImage && <img src={billLayout.beforeFooterImage} style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain', display: 'block', margin: '0 auto 4px' }} />}
                      {billLayout.beforeFooterText && <div style={{ fontSize: 11, color: '#333', whiteSpace: 'pre-wrap' }}>{billLayout.beforeFooterText}</div>}
                    </div>
                  )}
                  <div style={{ borderTop: '1px dashed #000', paddingTop: 6, fontSize: 11, color: '#555', textAlign: 'center', marginTop: 6 }}>
                    {customMessage}
                  </div>
                </div>
              </div>

              {/* RIGHT — editor panel */}
              <div className="w-96 shrink-0 flex flex-col overflow-y-auto scrollbar-thin p-6 space-y-5 bg-white">
                {/* Business info */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-900">Business Info</p>
                  <div>
                    <label className="label">Business Name</label>
                    <input className="input text-sm" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="PetStation" />
                  </div>
                  <div>
                    <label className="label">Address</label>
                    <input className="input text-sm" value={draftAddress} onChange={e => setDraftAddress(e.target.value)} placeholder="Mattool Central, Kannur" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Phone</label>
                      <input className="input text-sm" value={draftPhone} onChange={e => setDraftPhone(e.target.value)} placeholder="9746955534" />
                    </div>
                    <div>
                      <label className="label">GST</label>
                      <input className="input text-sm" value={draftGST} onChange={e => setDraftGST(e.target.value)} placeholder="32BWGPS0178G1ZJ" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Tax % (GST)</label>
                    <input className="input text-sm" type="number" value={draftTax} onChange={e => setDraftTax(e.target.value)} placeholder="18" />
                  </div>
                </div>

                {/* Ticket pricing & HSN */}
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-900">Ticket Prices & HSN Codes</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Entry Price (incl. GST)</label>
                      <input className="input text-sm" type="number" value={draftEntryPrice} onChange={e => setDraftEntryPrice(Number(e.target.value))} placeholder="150" />
                    </div>
                    <div>
                      <label className="label">Entry HSN</label>
                      <input className="input text-sm" value={draftHsnEntry} onChange={e => setDraftHsnEntry(e.target.value)} placeholder="9508" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Combo Entry Price (incl. GST)</label>
                      <input className="input text-sm" type="number" value={draftComboEntryPrice} onChange={e => setDraftComboEntryPrice(Number(e.target.value))} placeholder="150" />
                    </div>
                    <div>
                      <label className="label">Pet Feed Price (incl. GST)</label>
                      <input className="input text-sm" type="number" value={draftPetFeedPrice} onChange={e => setDraftPetFeedPrice(Number(e.target.value))} placeholder="50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Pet Feed HSN</label>
                      <input className="input text-sm" value={draftHsnPetFeed} onChange={e => setDraftHsnPetFeed(e.target.value)} placeholder="1206" />
                    </div>
                    <div>
                      <label className="label">Live Feed Price</label>
                      <input className="input text-sm" type="number" value={draftLiveFeedPrice} onChange={e => setDraftLiveFeedPrice(Number(e.target.value))} placeholder="300" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Live Feed HSN</label>
                      <input className="input text-sm" value={draftHsnLiveFeed} onChange={e => setDraftHsnLiveFeed(e.target.value)} placeholder="0106" />
                    </div>
                  </div>
                </div>

                {/* Before-footer block */}
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-900">Before Thank You — Image & Text</p>
                  <p className="text-xs text-gray-400">Shown above the footer message on every bill</p>
                  <div>
                    <label className="label">Image (upload)</label>
                    <input
                      type="file" accept="image/*"
                      className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-xs file:font-semibold hover:file:bg-gray-200 cursor-pointer"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => setBillLayout(prev => ({ ...prev, beforeFooterImage: ev.target?.result as string }));
                        reader.readAsDataURL(file);
                      }}
                    />
                    {billLayout.beforeFooterImage && (
                      <div className="mt-2 flex items-center gap-2">
                        <img src={billLayout.beforeFooterImage} className="h-12 rounded border border-gray-100 object-contain" />
                        <button className="text-xs text-red-500 hover:underline" onClick={() => setBillLayout(prev => ({ ...prev, beforeFooterImage: undefined }))}>Remove</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">Text</label>
                    <textarea
                      className="input w-full min-h-[70px] resize-none text-sm"
                      value={billLayout.beforeFooterText || ''}
                      onChange={e => setBillLayout(prev => ({ ...prev, beforeFooterText: e.target.value }))}
                      placeholder="e.g. Scan QR to follow us!"
                    />
                  </div>
                </div>

                {/* Footer message */}
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-900">Thank You Message</p>
                  <textarea
                    className="input w-full min-h-[80px] resize-none text-sm"
                    value={customMessage}
                    onChange={e => saveCustomMessage(e.target.value)}
                    placeholder="e.g. Thank you for visiting PetStation!"
                  />
                </div>

                <button onClick={saveBillChanges} className={`btn-primary w-full py-3 gap-2 ${billSaved ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
                  <IconCheck size={15} />
                  {billSaved ? 'Saved! All bills updated.' : 'Save & Apply to All Bills'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS MODAL ───────────────────────────────────────────────────── */}
      {successOpen && lastEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setPrintConfirm(false); isCheckingOutRef.current = false; setIsCheckingOut(false); setSuccessOpen(false); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-emerald-500 px-8 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                <IconCheck size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Ticket Printed!</h3>
              <p className="text-emerald-100 text-sm mt-1">Transaction recorded successfully</p>
            </div>

            <div className="px-8 py-6 space-y-3">
              {/* Customer info if provided */}
              {lastCustomer.name && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-sm flex-shrink-0">
                    {lastCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{lastCustomer.name}</p>
                    {lastCustomer.phone && <p className="text-xs text-gray-400">{lastCustomer.phone}</p>}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {lastEntry.items.map(i => {
                  const t = state.ticketItems.find(x => x.id === i.ticketItemId);
                  return (
                    <div key={i.ticketItemId} className="flex justify-between text-sm">
                      <span className="text-gray-600">{i.name ?? t?.name ?? i.ticketItemId} <span className="text-gray-400">×{i.quantity}</span></span>
                      <span className="font-medium text-gray-900">₹{i.total}</span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Payment</span>
                  <span className="font-medium capitalize">{lastEntry.paymentMethod}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-gray-900">Total Paid</span>
                  <span className="text-2xl font-bold text-gray-900">₹{lastEntry.totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {(() => { const live = state.revenueEntries.find(e => e.id === lastEntry.id); return !live?.synced && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                  <IconSync size={12} />
                  Pending sync to backend
                </div>
              ); })()}

              <div className="mt-2">
                <button onClick={() => { setPrintConfirm(false); isCheckingOutRef.current = false; setIsCheckingOut(false); setSuccessOpen(false); }} className="btn-primary w-full py-3">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── CLOSE BILLING MODAL ────────────────────────────────────────── */}
      {closingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setClosingOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-red-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">End of Day Summary</h2>
                  <p className="text-red-200 text-sm mt-0.5">{format(new Date(today), 'EEEE, dd MMM yyyy')}</p>
                </div>
                <button onClick={() => setClosingOpen(false)} className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                  <IconClose size={16} className="text-white" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Revenue', value: `₹${closingStats.totalRevenue.toLocaleString('en-IN')}`, cls: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: 'Total Expenses', value: `₹${closingStats.totalExpenses.toLocaleString('en-IN')}`, cls: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Net', value: `₹${Math.abs(closingStats.net).toLocaleString('en-IN')}`, cls: closingStats.net >= 0 ? 'text-emerald-700' : 'text-red-600', bg: closingStats.net >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
                ].map(k => (
                  <div key={k.label} className={`rounded-2xl ${k.bg} px-4 py-3 text-center`}>
                    <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                    <p className={`text-lg font-bold mt-1 ${k.cls}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Transactions count + opening */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-blue-50 px-4 py-3 text-center">
                  <p className="text-xs text-gray-500 font-medium">Transactions</p>
                  <p className="text-lg font-bold text-blue-700 mt-1">{closingStats.transactions}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 text-center">
                  <p className="text-xs text-gray-500 font-medium">Opening Balance</p>
                  <p className="text-lg font-bold text-gray-700 mt-1">₹{closingStats.opening.toLocaleString('en-IN')}</p>
                </div>
              </div>

              {/* Payment method breakdown */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Payment Method Breakdown</p>
                <div className="rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="grid grid-cols-4 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span>Method</span><span className="text-right">Revenue</span><span className="text-right">Expenses</span><span className="text-right">Net</span>
                  </div>
                  {closingStats.allMethods.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No transactions today</p>
                  ) : (
                    closingStats.allMethods.map((m, i) => {
                      const rev = closingStats.revByMethod[m] || 0;
                      const exp = closingStats.expByMethod[m] || 0;
                      const net = rev - exp;
                      return (
                        <div key={m} className={`grid grid-cols-4 px-4 py-3 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <span className="font-semibold text-gray-900 capitalize">{m}</span>
                          <span className="text-right font-medium text-emerald-700">₹{rev.toLocaleString('en-IN')}</span>
                          <span className="text-right font-medium text-red-600">₹{exp.toLocaleString('en-IN')}</span>
                          <span className={`text-right font-bold ${net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{Math.abs(net).toLocaleString('en-IN')}</span>
                        </div>
                      );
                    })
                  )}
                  <div className="grid grid-cols-4 px-4 py-3 bg-gray-100 text-sm font-bold border-t border-gray-200">
                    <span className="text-gray-900">Total</span>
                    <span className="text-right text-emerald-700">₹{closingStats.totalRevenue.toLocaleString('en-IN')}</span>
                    <span className="text-right text-red-600">₹{closingStats.totalExpenses.toLocaleString('en-IN')}</span>
                    <span className={`text-right ${closingStats.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{Math.abs(closingStats.net).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Cash closing balance */}
              {(closingStats.revByMethod['cash'] || closingStats.opening) > 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Cash Closing Balance</p>
                    <p className="text-xs text-amber-600 mt-0.5">Opening + Cash Revenue − Cash Expenses</p>
                  </div>
                  <p className="text-xl font-bold text-amber-800">
                    ₹{(closingStats.opening + (closingStats.revByMethod['cash'] || 0) - (closingStats.expByMethod['cash'] || 0)).toLocaleString('en-IN')}
                  </p>
                </div>
              )}

              <button onClick={() => setClosingOpen(false)} className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
