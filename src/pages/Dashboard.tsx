import { useMemo, useState, useEffect } from 'react';
import { useApp } from '@/store/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { IconTrendUp, IconTrendDown, IconWallet, IconReceipt, IconSync, IconAlert, IconCloud } from '@/components/Icons';

const COLORS = ['#111827', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

export default function Dashboard() {
  const { state, dispatch, isManager } = useApp();
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const syncPending = async () => {
    if (!online || !state.pendingSync.length) return;
    setSyncing(true);
    try {
      const pending = state.revenueEntries.filter(e => state.pendingSync.includes(e.id));
      const res = await fetch(`${state.settings.backendUrl}/api/billing/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': state.settings.adminPassword },
        body: JSON.stringify({ entries: pending }),
      });
      if (res.ok) dispatch({ type: 'MARK_SYNCED', payload: pending.map(e => e.id) });
    } catch { /* offline */ }
    setSyncing(false);
  };

  const todayStats = useMemo(() => {
    const rev = state.revenueEntries.filter(e => e.date === today);
    const exp = state.expenseEntries.filter(e => e.date === today);
    const totalRevenue = rev.reduce((s, e) => s + e.totalAmount, 0);
    const totalExpenses = exp.reduce((s, e) => s + e.amount, 0);
    return { totalRevenue, totalExpenses, net: totalRevenue - totalExpenses, txns: rev.length };
  }, [state.revenueEntries, state.expenseEntries, today]);

  const monthStats = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now), end = endOfMonth(now);
    const inMonth = (d: string) => isWithinInterval(parseISO(d), { start, end });
    return {
      revenue: state.revenueEntries.filter(e => inMonth(e.date)).reduce((s, e) => s + e.totalAmount, 0),
      expenses: state.expenseEntries.filter(e => inMonth(e.date)).reduce((s, e) => s + e.amount, 0),
    };
  }, [state.revenueEntries, state.expenseEntries]);

  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    return {
      name: format(subDays(new Date(), 6 - i), 'EEE'),
      revenue: state.revenueEntries.filter(e => e.date === d).reduce((s, e) => s + e.totalAmount, 0),
      expenses: state.expenseEntries.filter(e => e.date === d).reduce((s, e) => s + e.amount, 0),
    };
  }), [state.revenueEntries, state.expenseEntries]);

  const entryTicketSplit = useMemo(() => {
    // Count total tickets sold today (exclude addons)
    const counts: Record<string, number> = {};
    let total = 0;
    state.revenueEntries.filter(e => e.date === today).forEach(e => {
      e.items.forEach(i => {
        const t = state.ticketItems.find(x => x.id === i.ticketItemId);
        if (!t || t.category === 'addon') return;
        counts[t.name] = (counts[t.name] || 0) + i.quantity;
        total += i.quantity;
      });
    });
    return { total, data: Object.entries(counts).map(([name, value]) => ({ name, value })) };
  }, [state.revenueEntries, state.ticketItems, today]);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const pendingApprovals = useMemo(() => state.revenueEntries.filter(e => e.deletionApproval?.status === 'pending'), [state.revenueEntries]);

  const statCards = [
    { label: "Today's Revenue",  value: fmt(todayStats.totalRevenue),  Icon: IconReceipt,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: "Today's Expenses", value: fmt(todayStats.totalExpenses), Icon: IconTrendDown, color: 'text-red-600',     bg: 'bg-red-50' },
    { label: 'Net Cashflow',     value: fmt(todayStats.net),           Icon: IconWallet,    color: todayStats.net >= 0 ? 'text-emerald-600' : 'text-red-600', bg: todayStats.net >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    { label: 'Transactions',     value: todayStats.txns.toString(),    Icon: IconTrendUp,   color: 'text-blue-600',    bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Overview</h2>
          <p className="page-subtitle">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${online ? 'badge-green' : 'badge-red'}`}>
            {online ? 'Online' : 'Offline'}
          </span>
          {state.pendingSync.length > 0 && (
            <button onClick={syncPending} disabled={syncing || !online} className="btn-secondary btn-sm gap-1.5">
              <IconSync size={13} />
              {syncing ? 'Syncing...' : `Sync ${state.pendingSync.length}`}
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="stat-card">
            <div>
              <p className="stat-label">{s.label}</p>
              <p className="stat-value">{s.value}</p>
            </div>
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.Icon size={17} className={s.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Month summary */}
      <div className="card">
        <p className="section-title">{format(new Date(), 'MMMM yyyy')} — Monthly Summary</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Revenue',    value: fmt(monthStats.revenue),                          cls: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Expenses',   value: fmt(monthStats.expenses),                         cls: 'text-red-700',     bg: 'bg-red-50' },
            { label: 'Net Profit', value: fmt(monthStats.revenue - monthStats.expenses),    cls: 'text-blue-700',    bg: 'bg-blue-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart */}
        <div className="card">
          <p className="section-title">Last 7 Days — Revenue vs Expenses</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last7} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: unknown) => fmt(v as number)}
                contentStyle={{ borderRadius: 10, border: '1px solid #f1f5f9', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12 }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="revenue"  fill="#111827" name="Revenue"  radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#e2e8f0" name="Expenses" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card">
          <p className="section-title">Transaction split</p>
              <div className="mb-3 grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Revenue</p>
                  <p className="text-lg font-bold text-gray-900">{`₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 2 }).format(todayStats.totalRevenue)}`}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Visitors</p>
                  <p className="text-lg font-bold text-gray-900">{entryTicketSplit.total.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Transactions</p>
                  <p className="text-lg font-bold text-gray-900">{todayStats.txns.toLocaleString('en-IN')}</p>
                </div>
              </div>
              {entryTicketSplit.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={entryTicketSplit.data}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${Math.round(percent * 100)}%`}
                  >
                    {entryTicketSplit.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: unknown) => [`${v}`, 'Tickets']}
                    contentStyle={{ borderRadius: 10, border: '1px solid #f1f5f9', fontSize: 12 }}
                    labelFormatter={(label: any) => `${label}`}
                    // custom payload will show percentage in tooltip via payload[0].payload
                    itemSorter={() => 0}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex flex-col items-center justify-center text-gray-400">
                <IconReceipt size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No transactions today</p>
              </div>
            )}
        </div>
      </div>

      {/* Pending sync banner */}
      {state.pendingSync.length > 0 && (
        <div className="alert-warning">
          <IconAlert size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">{state.pendingSync.length} billing {state.pendingSync.length === 1 ? 'entry' : 'entries'} pending sync</p>
            <p className="text-xs mt-0.5 text-amber-700">Data is saved locally. Connect to internet and click Sync to push to backend.</p>
          </div>
          <button onClick={syncPending} disabled={syncing || !online} className="ml-auto btn-sm bg-amber-100 text-amber-800 hover:bg-amber-200 border-0 flex items-center gap-1.5">
            <IconCloud size={13} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {/* Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="card">
          <p className="section-title">Approvals</p>
          <div className="space-y-3 mt-2">
            {pendingApprovals.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">₹{p.totalAmount.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-500">{p.items.map(i => { const t = state.ticketItems.find(x => x.id === i.ticketItemId); return `${t?.name}×${i.quantity}`; }).join(', ')}</p>
                  <p className="text-xs text-gray-400">Sent for approval · {new Date(p.deletionApproval?.requestedAt || p.createdAt).toLocaleString('en-IN')}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isManager() ? (
                    <>
                      <button onClick={() => dispatch({ type: 'APPROVE_DELETE_REVENUE', payload: p.id })} className="btn-primary btn-sm">Approve</button>
                      <button onClick={() => dispatch({ type: 'REJECT_DELETE_REVENUE', payload: { id: p.id } })} className="btn-secondary btn-sm">Reject</button>
                    </>
                  ) : (
                    <span className="badge badge-yellow">Sent for approval</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
