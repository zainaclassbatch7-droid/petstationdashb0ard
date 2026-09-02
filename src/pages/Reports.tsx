import { useMemo, useState, useCallback } from 'react';
import { exportReportExcel } from '@/lib/exportExcel';
import { useApp } from '@/store/AppContext';
import type { RevenueEntry, TicketItem, AddOnEntry, StaffMember } from '@/types';
import { format, eachDayOfInterval, getDaysInMonth } from 'date-fns';
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type ViewMode = 'revenue' | 'expenses' | 'combined';

type ReportTab = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'daily',   label: 'Daily' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly',  label: 'Yearly' },
  { id: 'custom',  label: 'Custom Range' },
];

const today = format(new Date(), 'yyyy-MM-dd');
const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function SummaryCards({ revenue, expenses, net, transactions }: { revenue: number; expenses: number; net: number; transactions: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'Total Revenue',  value: fmt(revenue),          cls: 'text-emerald-700' },
        { label: 'Total Expenses', value: fmt(expenses),         cls: 'text-red-700' },
        { label: 'Net Profit',     value: fmt(net),              cls: net >= 0 ? 'text-emerald-700' : 'text-red-700' },
        { label: 'Transactions',   value: transactions.toString(), cls: 'text-blue-700' },
      ].map(s => (
        <div key={s.label} className="card text-center">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
          <p className={`text-xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function PaymentAndCash({ paymentSplit, opening, cashExpenses }: {
  paymentSplit: Record<string, number>;
  opening: number;
  cashExpenses: number;
}) {
  const totalRevenue = Object.values(paymentSplit).reduce((s, v) => s + v, 0);
  const cashRevenue = paymentSplit['cash'] || 0;
  const cashClosing = opening + cashRevenue - cashExpenses;
  const nonCashMethods = Object.entries(paymentSplit).filter(([m]) => m !== 'cash');
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="card">
        <p className="section-title">Payment Split</p>
        {!Object.keys(paymentSplit).length ? (
          <p className="text-gray-400 text-sm mt-2">No revenue entries</p>
        ) : (
          <div className="space-y-2 mt-2">
            {Object.entries(paymentSplit).map(([method, amount]) => {
              const pct = totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0;
              return (
                <div key={method} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700 capitalize">{method}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-semibold">{pct}%</span>
                    <span className="font-bold text-gray-900">{fmt(amount)}</span>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg border-t border-gray-200">
              <span className="font-semibold text-gray-900">Total Revenue</span>
              <span className="font-bold text-emerald-700">{fmt(totalRevenue)}</span>
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <p className="section-title">Cash Flow</p>
        <div className="space-y-1 mt-2">
          {[
            { label: 'Opening Balance', value: fmt(opening) },
            { label: 'Cash Revenue',    value: fmt(cashRevenue) },
            { label: 'Cash Expenses',   value: fmt(cashExpenses) },
          ].map(row => (
            <div key={row.label} className="flex justify-between py-2 text-sm">
              <span className="text-gray-500">{row.label}</span>
              <span className="text-gray-700">{row.value}</span>
            </div>
          ))}
          <div className="flex justify-between py-2.5 border-t border-gray-100 font-bold">
            <span className="text-gray-900">Closing Balance (Cash)</span>
            <span className="text-emerald-700">{fmt(cashClosing)}</span>
          </div>
          {nonCashMethods.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-3 pb-1">Digital Collections</p>
              {nonCashMethods.map(([method, amount]) => (
                <div key={method} className="flex justify-between py-2 text-sm">
                  <span className="text-gray-500 capitalize">{method}</span>
                  <span className="font-bold text-blue-700">{fmt(amount)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2.5 border-t border-gray-100 font-bold">
                <span className="text-gray-900">Total Digital</span>
                <span className="text-blue-700">{fmt(nonCashMethods.reduce((s, [, a]) => s + a, 0))}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const PIE_COLORS = ['#111827','#0f766e','#f59e0b','#3b82f6'];

const TICKET_TYPE_LABELS: Record<string, string> = {
  entry: 'Entry Ticket',
  combo: 'Combo Ticket',
  ultimate: 'Ultimate Pet Lover Ticket',
  group: 'Group Ticket',
};

function getTicketTypeKey(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('group')) return 'group';
  if (lower.includes('ultimate')) return 'ultimate';
  if (lower.includes('combo')) return 'combo';
  return 'entry';
}

function TransactionSalesPie({ entrySales, entryTotal }: {
  entrySales: [string, { qty: number; revenue: number; txCount: number }][];
  entryTotal: number;
}) {
  // entrySales keys are already the canonical label names from getOriginalTicketTypeName
  // so we aggregate directly by matching against TICKET_TYPE_LABELS values
  const typeMap: Record<string, { qty: number; revenue: number; txCount: number }> = {
    entry: { qty: 0, revenue: 0, txCount: 0 },
    combo: { qty: 0, revenue: 0, txCount: 0 },
    ultimate: { qty: 0, revenue: 0, txCount: 0 },
    group: { qty: 0, revenue: 0, txCount: 0 },
  };
  entrySales.forEach(([name, d]) => {
    const key = getTicketTypeKey(name);
    typeMap[key].qty += d.qty;
    typeMap[key].revenue += d.revenue;
    typeMap[key].txCount += d.txCount;
  });
  const data = Object.entries(typeMap)
    .filter(([, d]) => d.qty > 0)
    .map(([key, d]) => ({ name: TICKET_TYPE_LABELS[key], value: d.qty, revenue: d.revenue, qty: d.qty, txCount: d.txCount }));
  const totalQty = data.reduce((s, d) => s + d.qty, 0);
  const totalTx  = data.reduce((s, d) => s + d.txCount, 0);

  if (!data.length) return (
    <div className="card">
      <p className="section-title mb-2">Ticket Sales</p>
      <p className="text-gray-400 text-sm text-center py-6">No sales</p>
    </div>
  );
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">Ticket Sales</p>
        <div className="text-right">
          <p className="text-sm font-bold text-emerald-700">{fmt(entryTotal)}</p>
          <p className="text-xs text-gray-400"><span className="font-bold text-gray-700">{totalQty}</span> tickets · <span className="font-bold text-gray-700">{totalTx}</span> transactions</p>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row items-center gap-8">
        <div className="w-56 h-56 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={54} outerRadius={88} paddingAngle={3}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip
                formatter={(_v: any, __: any, props: any) => [
                  <span key="v"><span style={{fontWeight:700}}>{props.payload?.qty} tickets</span> &nbsp;<span style={{color:'#6b7280',fontWeight:400}}>{totalQty > 0 ? Math.round((props.payload?.qty / totalQty) * 100) : 0}%</span></span>,
                  props.payload?.name,
                ]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 w-full">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-left">Ticket Type</th>
                <th className="py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">%</th>
                <th className="py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Tickets</th>
                <th className="py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Transactions</th>
                <th className="py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => {
                const pct = totalQty > 0 ? Math.round((item.qty / totalQty) * 100) : 0;
                return (
                  <tr key={item.name} className="border-b border-gray-50">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-medium text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-gray-500">{pct}%</td>
                    <td className="py-3 text-right font-bold text-gray-900">{item.qty}</td>
                    <td className="py-3 text-right text-gray-600">{item.txCount}</td>
                    <td className="py-3 text-right font-bold text-emerald-700">{fmt(item.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td className="py-3 text-sm font-semibold text-gray-700">Total</td>
                <td className="py-3 text-right text-gray-500">100%</td>
                <td className="py-3 text-right font-bold text-gray-900">{totalQty}</td>
                <td className="py-3 text-right text-gray-600">{totalTx}</td>
                <td className="py-3 text-right font-bold text-emerald-700">{fmt(entryTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function GroupTicketSales({ entrySales, revenueEntries, ticketItems }: {
  entrySales: [string, { qty: number; revenue: number; txCount: number }][];
  revenueEntries: RevenueEntry[];
  ticketItems: TicketItem[];
}) {
  const groupItemIds = new Set(ticketItems.filter(t => t.name.toLowerCase().includes('group')).map(t => t.id));
  const rows: { name: string; price: number; qty: number; total: number }[] = [];
  revenueEntries.forEach(entry => {
    entry.items.forEach(item => {
      if (!groupItemIds.has(item.ticketItemId)) return;
      const t = ticketItems.find(x => x.id === item.ticketItemId);
      rows.push({ name: t?.name ?? item.ticketItemId, price: item.unitPrice, qty: item.quantity, total: item.total });
    });
  });
  const totalRevenue = entrySales.filter(([name]) => getTicketTypeKey(name) === 'group').reduce((s, [, d]) => s + d.revenue, 0);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="section-title">Group Ticket Sales</p>
        <span className="text-sm font-bold text-emerald-700">{fmt(totalRevenue)}</span>
      </div>
      {!rows.length ? (
        <p className="text-gray-400 text-sm text-center py-6">No group ticket sales</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Group Name', 'Ticket Price', 'Quantity', 'Total Price'].map(h => (
                <th key={h} className={`py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide ${h === 'Group Name' ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 table-row-hover">
                <td className="py-3 font-medium text-gray-900">{row.name}</td>
                <td className="py-3 text-right text-gray-600">{fmt(row.price)}</td>
                <td className="py-3 text-right text-gray-600">{row.qty}</td>
                <td className="py-3 text-right font-bold text-emerald-700">{fmt(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ItemSalesTables({ entrySales, addonSales, entryTotal, addonTotal, revenueEntries, ticketItems }: {
  entrySales: [string, { qty: number; revenue: number; txCount: number }][];
  addonSales: [string, { qty: number; revenue: number; txCount: number }][];
  entryTotal: number;
  addonTotal: number;
  revenueEntries: RevenueEntry[];
  ticketItems: TicketItem[];
}) {
  return (
    <div className="space-y-5">
      {/* Ticket Sales — full width */}
      <TransactionSalesPie entrySales={entrySales} entryTotal={entryTotal} />
      {/* Add-on Sales + Group Ticket Sales — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">Add-on Sales</p>
            <span className="text-sm font-bold text-emerald-700">{fmt(addonTotal)}</span>
          </div>
          {!addonSales.length ? (
            <p className="text-gray-400 text-sm text-center py-6">No sales</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Item', 'Qty', 'Revenue'].map(h => (
                    <th key={h} className={`py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide ${h !== 'Item' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {addonSales.map(([name, data]) => (
                  <tr key={name} className="border-b border-gray-50 table-row-hover">
                    <td className="py-3 font-medium text-gray-900">{name}</td>
                    <td className="py-3 text-right text-gray-600">{data.qty}</td>
                    <td className="py-3 text-right font-bold text-emerald-700">{fmt(data.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <GroupTicketSales entrySales={entrySales} revenueEntries={revenueEntries} ticketItems={ticketItems} />
      </div>
    </div>
  );
}

type TrendPoint = {
  label: string;
  visitors: number;
  revenue: number;
  tickets: number;
  transactions: number;
};
type TicketBreakdownPoint = {
  label: string;
  tickets: number;
  ticketBreakdown: { name: string; qty: number; revenue: number }[];
};

function OverviewChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: TrendPoint[];
}) {
  return (
    <div className="card">
      <div>
        <p className="section-title">{title}</p>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </div>

      <div className="mt-5 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="count"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="revenue"
              orientation="right"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `Rs ${Number(value).toLocaleString('en-IN')}`}
            />
            <Tooltip
              formatter={(value: any, name: any) => {
                const numericValue = Number(value ?? 0);
                if (name === 'Revenue') return [fmt(numericValue), name];
                return [numericValue.toLocaleString('en-IN'), name];
              }}
              contentStyle={{
                borderRadius: '16px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
              }}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: 12 }} />
            <Bar yAxisId="count" dataKey="visitors" name="Visitors" fill="#0f766e" radius={[8, 8, 0, 0]} maxBarSize={36} />
            <Bar yAxisId="count" dataKey="transactions" name="Transactions" fill="#f59e0b" radius={[8, 8, 0, 0]} maxBarSize={36} />
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#111827"
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 0, fill: '#111827' }}
              activeDot={{ r: 5, strokeWidth: 0, fill: '#111827' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-teal-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-teal-700 font-semibold">Visitors</p>
          <p className="text-lg font-bold text-teal-900 mt-1">{data.reduce((sum, item) => sum + item.visitors, 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-2xl bg-amber-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">Transactions</p>
          <p className="text-lg font-bold text-amber-900 mt-1">{data.reduce((sum, item) => sum + item.transactions, 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-2xl bg-gray-100 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-gray-700 font-semibold">Revenue</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{fmt(data.reduce((sum, item) => sum + item.revenue, 0))}</p>
        </div>
      </div>
    </div>
  );
}

function TicketBreakdownCard({ points }: { points: TicketBreakdownPoint[] }) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const activePoint = selectedLabel
    ? points.find(point => point.label === selectedLabel) ?? null
    : points.find(point => point.tickets > 0) ?? null;

  if (!points.some(point => point.tickets > 0)) {
    return null;
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="section-title">Transaction Breakdown</p>
            <p className="text-xs text-gray-500 mt-1">Choose a period to inspect which transactions contributed to the totals.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
          {points.filter(point => point.tickets > 0).map(point => (
            <button
              key={point.label}
              type="button"
              onClick={() => setSelectedLabel(point.label)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activePoint?.label === point.label ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {point.label}
            </button>
          ))}
        </div>
      </div>

      {activePoint && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="section-title">{activePoint.label} Transaction Breakdown</p>
            <span className="text-sm font-semibold text-gray-500">Total Transactions: {activePoint.tickets}</span>
          </div>
          {!activePoint.ticketBreakdown.length ? (
            <p className="text-sm text-gray-400 mt-3">No transaction sales recorded for this period.</p>
          ) : (
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Transaction', 'Qty', 'Revenue'].map(h => (
                    <th key={h} className={`py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide ${h === 'Transaction' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activePoint.ticketBreakdown.map(item => (
                  <tr key={item.name} className="border-b border-gray-50 table-row-hover">
                    <td className="py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="py-3 text-right text-gray-600">{item.qty}</td>
                    <td className="py-3 text-right font-bold text-emerald-700">{fmt(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function ExpenseTableDetailed({ expenses, ledgers }: { expenses: any[]; ledgers: any[] }) {
  // Group by ledger → subledger → entries
  const grouped = ledgers.map(ledger => {
    const ledgerExp = expenses.filter(e => e.ledgerId === ledger.id);
    if (!ledgerExp.length) return null;
    const total = ledgerExp.reduce((s: number, e: any) => s + e.amount, 0);
    // group by subledger
    const bySubledger: Record<string, { name: string; entries: any[]; total: number }> = {};
    ledgerExp.forEach((e: any) => {
      const sub = ledger.subledgers?.find((s: any) => s.id === e.subledgerId);
      const key = sub?.id ?? '__none__';
      const name = sub?.name ?? '';
      if (!bySubledger[key]) bySubledger[key] = { name, entries: [], total: 0 };
      bySubledger[key].entries.push(e);
      bySubledger[key].total += e.amount;
    });
    return { ledger, total, bySubledger };
  }).filter(Boolean);

  if (!grouped.length) return (
    <div className="card">
      <p className="section-title">Expense Breakdown</p>
      <p className="text-gray-400 text-sm text-center py-6 mt-2">No expenses recorded for this period</p>
    </div>
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">Expense Breakdown</p>
        <span className="text-sm font-bold text-red-600">{fmt(expenses.reduce((s: number, e: any) => s + e.amount, 0))}</span>
      </div>
      <div className="space-y-4">
        {grouped.map((g: any) => (
          <div key={g.ledger.id} className="rounded-xl border border-gray-100 overflow-hidden">
            {/* Ledger header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
              <span className="text-sm font-semibold text-gray-900">{g.ledger.name}</span>
              <span className="text-sm font-bold text-red-600">{fmt(g.total)}</span>
            </div>
            {/* Subledger groups */}
            {Object.entries(g.bySubledger).map(([key, sub]: [string, any]) => (
              <div key={key}>
                {sub.name && (
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50 border-t border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide pl-2">{sub.name}</span>
                    <span className="text-xs font-semibold text-red-500">{fmt(sub.total)}</span>
                  </div>
                )}
                {sub.entries.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{e.description || '—'}</span>
                      <span className="text-xs text-gray-400 capitalize flex-shrink-0">{e.paymentMethod}</span>
                    </div>
                    <span className="text-sm font-semibold text-red-600 flex-shrink-0 ml-3">{fmt(e.amount)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpenseTableCollapsible({ expenses, ledgers }: { expenses: any[]; ledgers: any[] }) {
  const [openLedger, setOpenLedger] = useState<string | null>(null);

  const grouped = ledgers.map(ledger => {
    const ledgerExp = expenses.filter((e: any) => e.ledgerId === ledger.id);
    if (!ledgerExp.length) return null;
    return { ledger, total: ledgerExp.reduce((s: number, e: any) => s + e.amount, 0), entries: ledgerExp };
  }).filter(Boolean);

  if (!grouped.length) return (
    <div className="card">
      <p className="section-title">Expense Breakdown</p>
      <p className="text-gray-400 text-sm text-center py-6 mt-2">No expenses recorded for this period</p>
    </div>
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">Expense Breakdown</p>
        <span className="text-sm font-bold text-red-600">{fmt(expenses.reduce((s: number, e: any) => s + e.amount, 0))}</span>
      </div>
      <div className="space-y-2">
        {grouped.map((g: any) => {
          const isOpen = openLedger === g.ledger.id;
          return (
            <div key={g.ledger.id} className="rounded-xl border border-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenLedger(isOpen ? null : g.ledger.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{g.ledger.name}</span>
                  <span className="text-xs text-gray-400">{g.entries.length} entr{g.entries.length !== 1 ? 'ies' : 'y'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-red-600">{fmt(g.total)}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </button>
              {isOpen && (
                <div className="divide-y divide-gray-50">
                  {g.entries.map((e: any) => {
                    const sub = g.ledger.subledgers?.find((s: any) => s.id === e.subledgerId);
                    return (
                      <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-700 truncate">{e.description || '—'}</p>
                            {sub && <p className="text-xs text-gray-400">{sub.name}</p>}
                          </div>
                          <span className="text-xs text-gray-400 capitalize flex-shrink-0">{e.paymentMethod}</span>
                        </div>
                        <span className="text-sm font-semibold text-red-600 flex-shrink-0 ml-3">{fmt(e.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// kept for backward compat — daily uses Detailed, others use Collapsible
function ExpenseTable({ expenses, ledgers }: { expenses: any[]; ledgers: any[] }) {
  return <ExpenseTableCollapsible expenses={expenses} ledgers={ledgers} />;
}



function getOriginalTicketTypeName(ticketItemId: string, itemName: string | undefined, ticketItems: any[]): string {
  // Check ticketItemId directly first (reliable for hardcoded IDs)
  const idLower = ticketItemId.toLowerCase();
  if (idLower.includes('group')) return 'Group Ticket';
  if (idLower.includes('ultimate')) return 'Ultimate Pet Lover Ticket';
  if (idLower.includes('combo')) return 'Combo Ticket';
  // Fall back to stored item name or ticketItems lookup
  const t = ticketItems.find((x: any) => x.id === ticketItemId);
  const name = (t?.name ?? itemName ?? '').toLowerCase();
  if (name.includes('group')) return 'Group Ticket';
  if (name.includes('ultimate')) return 'Ultimate Pet Lover Ticket';
  if (name.includes('combo')) return 'Combo Ticket';
  if (name.includes('entry')) return 'Entry Ticket';
  return 'Entry Ticket';
}

function buildItemSales(rev: any[], ticketItems: any[], addonEntries: AddOnEntry[] = []) {
  const entrySales: Record<string, { qty: number; revenue: number; txCount: number }> = {};
  const addonSales: Record<string, { qty: number; revenue: number; txCount: number }> = {};
  rev.forEach(entry => {
    entry.items.forEach((item: any) => {
      const t = ticketItems.find((x: any) => x.id === item.ticketItemId);
      if (t?.category === 'addon') {
        const key = t?.name ?? item.name ?? item.ticketItemId;
        if (!addonSales[key]) addonSales[key] = { qty: 0, revenue: 0, txCount: 0 };
        addonSales[key].qty += item.quantity;
        addonSales[key].revenue += item.total;
        addonSales[key].txCount += 1;
      } else {
        // Use stored item.name first (set at billing time), then fall back to ticketItems lookup
        const key = getOriginalTicketTypeName(item.ticketItemId, item.name ?? t?.name, ticketItems);
        if (!entrySales[key]) entrySales[key] = { qty: 0, revenue: 0, txCount: 0 };
        entrySales[key].qty += item.quantity;
        entrySales[key].revenue += item.total;
        entrySales[key].txCount += 1;
      }
    });
  });
  addonEntries.forEach(entry => {
    const t = ticketItems.find((x: any) => x.id === entry.ticketItemId);
    const key = t?.name ?? entry.ticketItemId;
    if (!addonSales[key]) addonSales[key] = { qty: 0, revenue: 0, txCount: 0 };
    addonSales[key].qty += entry.count;
    addonSales[key].revenue += (t?.price || 0) * entry.count;
    addonSales[key].txCount += 1;
  });
  return {
    entrySales: Object.entries(entrySales).sort((a, b) => b[1].revenue - a[1].revenue) as [string, { qty: number; revenue: number; txCount: number }][],
    addonSales: Object.entries(addonSales).sort((a, b) => b[1].revenue - a[1].revenue) as [string, { qty: number; revenue: number; txCount: number }][],
    entryTotal: Object.values(entrySales).reduce((s, v) => s + v.revenue, 0),
    addonTotal: Object.values(addonSales).reduce((s, v) => s + v.revenue, 0),
  };
}

function buildPaymentSplit(rev: any[], ticketItems: any[], addonEntries: AddOnEntry[] = []) {
  const split: Record<string, number> = {};
  rev.forEach(e => { split[e.paymentMethod] = (split[e.paymentMethod] || 0) + e.totalAmount; });
  addonEntries.forEach(entry => {
    if (!entry.paymentMethod) return;
    const ticket = ticketItems.find((x: any) => x.id === entry.ticketItemId);
    split[entry.paymentMethod] = (split[entry.paymentMethod] || 0) + ((ticket?.price || 0) * entry.count);
  });
  return split;
}

function buildAddOnStaffBreakdown(addonEntries: AddOnEntry[], staff: StaffMember[], ticketItems: TicketItem[]) {
  const breakdown: Record<string, { name: string; count: number; revenue: number }> = {};
  addonEntries.forEach(entry => {
    const staffMember = staff.find(s => s.id === entry.staffId);
    const name = staffMember?.name ?? entry.staffId;
    const ticket = ticketItems.find(t => t.id === entry.ticketItemId);
    if (!breakdown[name]) breakdown[name] = { name, count: 0, revenue: 0 };
    breakdown[name].count += entry.count;
    breakdown[name].revenue += (ticket?.price || 0) * entry.count;
  });
  return Object.values(breakdown).sort((a, b) => b.revenue - a.revenue);
}

function summarizeEntries(revenueEntries: RevenueEntry[], ticketItems: TicketItem[], addonEntries: AddOnEntry[] = []) {
  const ticketBreakdownMap: Record<string, { qty: number; revenue: number }> = {};

  revenueEntries.forEach(entry => {
    entry.items.forEach(item => {
      const ticket = ticketItems.find(ticketItem => ticketItem.id === item.ticketItemId);
      const name = ticket?.name ?? item.ticketItemId;
      if (!ticketBreakdownMap[name]) ticketBreakdownMap[name] = { qty: 0, revenue: 0 };
      ticketBreakdownMap[name].qty += item.quantity;
      ticketBreakdownMap[name].revenue += item.total;
    });
  });

  addonEntries.forEach(entry => {
    const ticket = ticketItems.find(ticketItem => ticketItem.id === entry.ticketItemId);
    const name = ticket?.name ?? entry.ticketItemId;
    if (!ticketBreakdownMap[name]) ticketBreakdownMap[name] = { qty: 0, revenue: 0 };
    ticketBreakdownMap[name].qty += entry.count;
    ticketBreakdownMap[name].revenue += (ticket?.price || 0) * entry.count;
  });

  const visitors = revenueEntries.reduce((sum, entry) => (
    sum + entry.items.reduce((itemSum, item) => {
      const ticket = ticketItems.find(ticketItem => ticketItem.id === item.ticketItemId);
      return ticket?.category === 'addon' ? itemSum : itemSum + item.quantity;
    }, 0)
  ), 0);
  const revenue = revenueEntries.reduce((sum, entry) => sum + entry.totalAmount, 0) + addonEntries.reduce((sum, entry) => {
    const ticket = ticketItems.find(ticketItem => ticketItem.id === entry.ticketItemId);
    return sum + (ticket?.price || 0) * entry.count;
  }, 0);
  const tickets = revenueEntries.reduce((sum, entry) => sum + entry.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)
    + addonEntries.reduce((sum, entry) => sum + entry.count, 0);
  const transactions = revenueEntries.length;

  return {
    visitors,
    revenue,
    tickets,
    transactions,
    ticketBreakdown: Object.entries(ticketBreakdownMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue),
  };
}

function buildDailyHourlyBars(revenueEntries: RevenueEntry[], ticketItems: TicketItem[], addonEntries: AddOnEntry[] = []): TicketBreakdownPoint[] {
  const HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  return HOURS.map(hour => {
    const hourEntries = revenueEntries.filter(entry => new Date(entry.createdAt).getHours() === hour);
    const hourAddOns = addonEntries.filter(entry => new Date(entry.createdAt).getHours() === hour);
    const summary = summarizeEntries(hourEntries, ticketItems, hourAddOns);

    return {
      label: hour <= 12 ? `${hour}am` : `${hour - 12}pm`,
      tickets: summary.tickets,
      ticketBreakdown: summary.ticketBreakdown,
    };
  });
}

function buildTrendPoints(
  labels: string[],
  getEntries: (label: string, index: number) => RevenueEntry[],
  getAddOns: (label: string, index: number) => AddOnEntry[],
  ticketItems: TicketItem[],
): TrendPoint[] {
  return labels.map((label, index) => {
    const summary = summarizeEntries(getEntries(label, index), ticketItems, getAddOns(label, index));
    return {
      label,
      visitors: summary.visitors,
      revenue: summary.revenue,
      tickets: summary.tickets,
      transactions: summary.transactions,
    };
  });
}

function DownloadExcelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-all"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download Excel
    </button>
  );
}

// ── DAILY ─────────────────────────────────────────────────────────────────────
function DailyReport({ view }: { view: ViewMode }) {
  const { state } = useApp();
  const [date, setDate] = useState(today);

  const r = useMemo(() => {
    const rev = state.revenueEntries.filter(e => e.date === date);
    const exp = state.expenseEntries.filter(e => e.date === date);
    const addOns = state.addOnEntries.filter(e => e.date === date);
    const paymentSplit = buildPaymentSplit(rev, state.ticketItems, addOns);
    const cashFlow = state.cashFlows.find(c => c.date === date);
    const opening = cashFlow?.openingBalance || 0;
    const cashExpenses = exp.filter(e => e.paymentMethod === 'cash').reduce((s, e) => s + e.amount, 0);
    const hourlyBreakdown = buildDailyHourlyBars(rev, state.ticketItems, addOns);
    return {
      totalRevenue: rev.reduce((s, e) => s + e.totalAmount, 0) + addOns.reduce((s, e) => {
        const ticket = state.ticketItems.find(t => t.id === e.ticketItemId);
        return s + (ticket?.price || 0) * e.count;
      }, 0),
      totalExpenses: exp.reduce((s, e) => s + e.amount, 0),
      transactions: rev.length,
      paymentSplit,
      opening,
      cashExpenses,
      hourlyBars: buildTrendPoints(
        hourlyBreakdown.map(point => point.label),
        (_, index) => {
          const hour = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20][index];
          return rev.filter(entry => new Date(entry.createdAt).getHours() === hour);
        },
        (_, index) => {
          const hour = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20][index];
          return addOns.filter(entry => new Date(entry.createdAt).getHours() === hour);
        },
        state.ticketItems,
      ),
      hourlyBreakdown,
      expenses: exp,
      addOnStaffBreakdown: buildAddOnStaffBreakdown(addOns, state.staff, state.ticketItems),
      rev,
      ...buildItemSales(rev, state.ticketItems, addOns),
    };
  }, [state, date]);

  const handleExport = useCallback(() => {
    exportReportExcel({
      label: format(new Date(date), 'dd MMM yyyy'),
      revenueEntries: r.rev,
      expenseEntries: r.expenses,
      addOnEntries: state.addOnEntries.filter(e => e.date === date),
      ticketItems: state.ticketItems,
      ledgers: state.ledgers,
    });
  }, [date, r, state]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-sm text-gray-400">{format(new Date(date), 'EEEE, dd MMM yyyy')}</span>
        <div className="flex items-center gap-2">
          <DownloadExcelBtn onClick={handleExport} />
          <label className="text-sm font-medium text-gray-600">Date</label>
          <input type="date" className="input w-auto" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <SummaryCards revenue={r.totalRevenue} expenses={r.totalExpenses} net={r.totalRevenue - r.totalExpenses} transactions={r.transactions} />
      {view !== 'expenses' && <OverviewChart title="Hourly Performance" subtitle="Visitors and tickets are shown as bars, while revenue is shown as a line through the day." data={r.hourlyBars} />}
      {view !== 'expenses' && <TicketBreakdownCard points={r.hourlyBreakdown} />}
      {view !== 'expenses' && <PaymentAndCash paymentSplit={r.paymentSplit} opening={r.opening} cashExpenses={r.cashExpenses} />}
      {view !== 'expenses' && <ItemSalesTables entrySales={r.entrySales} addonSales={r.addonSales} entryTotal={r.entryTotal} addonTotal={r.addonTotal} revenueEntries={r.rev} ticketItems={state.ticketItems} />}
      {view !== 'expenses' && r.addOnStaffBreakdown.length > 0 && (
        <div className="card">
          <p className="section-title mb-4">Add-On Staff Split</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">{['Employee','Add-Ons','Revenue'].map(h => <th key={h} className="py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-left">{h}</th>)}</tr></thead>
              <tbody>{r.addOnStaffBreakdown.map(row => <tr key={row.name} className="border-b border-gray-50 table-row-hover"><td className="py-3 font-medium text-gray-900">{row.name}</td><td className="py-3 text-gray-700">×{row.count}</td><td className="py-3 font-semibold text-right text-gray-900">₹{row.revenue}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      {view !== 'revenue' && <ExpenseTableDetailed expenses={r.expenses} ledgers={state.ledgers} />}
      {view !== 'expenses' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title">All Transactions</p>
            <span className="text-sm font-bold text-gray-500">{r.transactions} total</span>
          </div>
          {r.rev.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No transactions for this day</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Time', 'Invoice', 'Items', 'Payment', 'Amount'].map(h => (
                      <th key={h} className={`py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.rev.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(e => (
                    <tr key={e.id} className="border-b border-gray-50 table-row-hover">
                      <td className="py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
                      </td>
                      <td className="py-3 text-gray-500 text-xs">{e.invoiceNo || '—'}</td>
                      <td className="py-3 text-gray-700 max-w-xs">
                        {e.items.map((item, idx) => {
                          const t = state.ticketItems.find(x => x.id === item.ticketItemId);
                          return (
                            <div key={idx} className="text-xs">
                              {item.name ?? t?.name ?? item.ticketItemId} <span className="text-gray-400">×{item.quantity}</span>
                              <span className="text-gray-400 ml-1">₹{item.total.toLocaleString('en-IN')}</span>
                            </div>
                          );
                        })}
                      </td>
                      <td className="py-3"><span className="badge-gray capitalize">{e.paymentMethod}</span></td>
                      <td className="py-3 text-right font-bold text-gray-900">₹{e.totalAmount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={4} className="py-3 text-sm font-semibold text-gray-700">Total</td>
                    <td className="py-3 text-right text-base font-bold text-emerald-700">{fmt(r.rev.reduce((s, e) => s + e.totalAmount, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── WEEKLY ────────────────────────────────────────────────────────────────────
function WeeklyReport({ view }: { view: ViewMode }) {
  const { state } = useApp();
  const [weekOf, setWeekOf] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
  });

  const r = useMemo(() => {
    // Parse ISO week string e.g. "2026-W22" → Monday of that week
    const [yearStr, weekStr] = weekOf.split('-W');
    const weekYear = Number(yearStr);
    const weekNum = Number(weekStr);
    const jan4 = new Date(weekYear, 0, 4);
    const startMonday = new Date(jan4);
    startMonday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (weekNum - 1) * 7);
    const start = startMonday;
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const days = eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
    const rev = state.revenueEntries.filter(e => days.includes(e.date));
    const exp = state.expenseEntries.filter(e => days.includes(e.date));
    const addOns = state.addOnEntries.filter(e => days.includes(e.date));
    const paymentSplit = buildPaymentSplit(rev, state.ticketItems, addOns);
    const cashExpenses = exp.filter(e => e.paymentMethod === 'cash').reduce((s, e) => s + e.amount, 0);
    const labels = days.map(d => format(new Date(d), 'EEE'));
    const trend = buildTrendPoints(
      labels,
      (_, index) => state.revenueEntries.filter(e => e.date === days[index]),
      (_, index) => state.addOnEntries.filter(e => e.date === days[index]),
      state.ticketItems,
    );
    const breakdown = days.map((d, index) => {
      const summary = summarizeEntries(
        state.revenueEntries.filter(e => e.date === d),
        state.ticketItems,
        state.addOnEntries.filter(e => e.date === d),
      );
      return { label: labels[index], tickets: summary.tickets, ticketBreakdown: summary.ticketBreakdown };
    });
    return {
      totalRevenue: rev.reduce((s, e) => s + e.totalAmount, 0) + addOns.reduce((s, e) => {
        const ticket = state.ticketItems.find(t => t.id === e.ticketItemId);
        return s + (ticket?.price || 0) * e.count;
      }, 0),
      totalExpenses: exp.reduce((s, e) => s + e.amount, 0),
      transactions: rev.length,
      paymentSplit,
      cashExpenses,
      trend,
      breakdown,
      expenses: exp,
      rangeLabel: `${format(start, 'dd MMM')} – ${format(end, 'dd MMM yyyy')}`,
      ...buildItemSales(rev, state.ticketItems, addOns),
    };
  }, [state, weekOf]);

  const handleExport = useCallback(() => {
    const [yearStr, weekStr] = weekOf.split('-W');
    const weekYear = Number(yearStr);
    const weekNum = Number(weekStr);
    const jan4 = new Date(weekYear, 0, 4);
    const startMonday = new Date(jan4);
    startMonday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (weekNum - 1) * 7);
    const end = new Date(startMonday); end.setDate(startMonday.getDate() + 6);
    const days = eachDayOfInterval({ start: startMonday, end }).map(d => format(d, 'yyyy-MM-dd'));
    exportReportExcel({
      label: r.rangeLabel,
      revenueEntries: state.revenueEntries.filter(e => days.includes(e.date)),
      expenseEntries: state.expenseEntries.filter(e => days.includes(e.date)),
      addOnEntries: state.addOnEntries.filter(e => days.includes(e.date)),
      ticketItems: state.ticketItems,
      ledgers: state.ledgers,
    });
  }, [weekOf, r.rangeLabel, state]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-sm text-gray-400">{r.rangeLabel}</span>
        <div className="flex items-center gap-2">
          <DownloadExcelBtn onClick={handleExport} />
          <label className="text-sm font-medium text-gray-600">Week</label>
          <input type="week" className="input w-auto" value={weekOf} onChange={e => setWeekOf(e.target.value)} />
        </div>
      </div>
      <SummaryCards revenue={r.totalRevenue} expenses={r.totalExpenses} net={r.totalRevenue - r.totalExpenses} transactions={r.transactions} />
      {view !== 'expenses' && <OverviewChart title="Weekly Performance" subtitle="Compare visitors and tickets each day while revenue tracks as a line across the week." data={r.trend} />}
      {view !== 'expenses' && <TicketBreakdownCard points={r.breakdown} />}
      {view !== 'expenses' && <PaymentAndCash paymentSplit={r.paymentSplit} opening={0} cashExpenses={r.cashExpenses} />}
      {view !== 'expenses' && <ItemSalesTables entrySales={r.entrySales} addonSales={r.addonSales} entryTotal={r.entryTotal} addonTotal={r.addonTotal} revenueEntries={state.revenueEntries.filter(e => { const [yearStr, weekStr] = weekOf.split('-W'); const weekYear = Number(yearStr); const weekNum = Number(weekStr); const jan4 = new Date(weekYear, 0, 4); const startMonday = new Date(jan4); startMonday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (weekNum - 1) * 7); const end = new Date(startMonday); end.setDate(startMonday.getDate() + 6); const days = eachDayOfInterval({ start: startMonday, end }).map(d => format(d, 'yyyy-MM-dd')); return days.includes(e.date); })} ticketItems={state.ticketItems} />}
      {view !== 'revenue' && <ExpenseTable expenses={r.expenses} ledgers={state.ledgers} />}
    </div>
  );
}

// ── MONTHLY ───────────────────────────────────────────────────────────────────
function MonthlyReport({ view }: { view: ViewMode }) {
  const { state } = useApp();
  const [month, setMonth] = useState(today.slice(0, 7));

  const r = useMemo(() => {
    const rev = state.revenueEntries.filter(e => e.date.startsWith(month));
    const exp = state.expenseEntries.filter(e => e.date.startsWith(month));
    const addOns = state.addOnEntries.filter(e => e.date.startsWith(month));
    const paymentSplit = buildPaymentSplit(rev, state.ticketItems, addOns);
    const cashExpenses = exp.filter(e => e.paymentMethod === 'cash').reduce((s, e) => s + e.amount, 0);
    const daysInMonth = getDaysInMonth(new Date(`${month}-01`));
    const dates = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
    const labels = dates.map((_, index) => String(index + 1));
    const trend = buildTrendPoints(
      labels,
      (_, index) => state.revenueEntries.filter(e => e.date === dates[index]),
      (_, index) => state.addOnEntries.filter(e => e.date === dates[index]),
      state.ticketItems,
    );
    const breakdown = dates.map((d, index) => {
      const summary = summarizeEntries(
        state.revenueEntries.filter(e => e.date === d),
        state.ticketItems,
        state.addOnEntries.filter(e => e.date === d),
      );
      return { label: labels[index], tickets: summary.tickets, ticketBreakdown: summary.ticketBreakdown };
    });
    return {
      totalRevenue: rev.reduce((s, e) => s + e.totalAmount, 0) + addOns.reduce((s, e) => {
        const ticket = state.ticketItems.find(t => t.id === e.ticketItemId);
        return s + (ticket?.price || 0) * e.count;
      }, 0),
      totalExpenses: exp.reduce((s, e) => s + e.amount, 0),
      transactions: rev.length,
      paymentSplit,
      cashExpenses,
      trend,
      breakdown,
      expenses: exp,
      ...buildItemSales(rev, state.ticketItems, addOns),
    };
  }, [state, month]);

  const handleExport = useCallback(() => {
    exportReportExcel({
      label: format(new Date(`${month}-01`), 'MMMM yyyy'),
      revenueEntries: state.revenueEntries.filter(e => e.date.startsWith(month)),
      expenseEntries: state.expenseEntries.filter(e => e.date.startsWith(month)),
      addOnEntries: state.addOnEntries.filter(e => e.date.startsWith(month)),
      ticketItems: state.ticketItems,
      ledgers: state.ledgers,
    });
  }, [month, state]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-sm text-gray-400">{format(new Date(`${month}-01`), 'MMMM yyyy')}</span>
        <div className="flex items-center gap-2">
          <DownloadExcelBtn onClick={handleExport} />
          <label className="text-sm font-medium text-gray-600">Month</label>
          <input type="month" className="input w-auto" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
      </div>
      <SummaryCards revenue={r.totalRevenue} expenses={r.totalExpenses} net={r.totalRevenue - r.totalExpenses} transactions={r.transactions} />
      {view !== 'expenses' && <OverviewChart title="Monthly Performance" subtitle="Track daily visitors and ticket volume with revenue overlaid as a line for the selected month." data={r.trend} />}
      {view !== 'expenses' && <TicketBreakdownCard points={r.breakdown} />}
      {view !== 'expenses' && <PaymentAndCash paymentSplit={r.paymentSplit} opening={0} cashExpenses={r.cashExpenses} />}
      {view !== 'expenses' && <ItemSalesTables entrySales={r.entrySales} addonSales={r.addonSales} entryTotal={r.entryTotal} addonTotal={r.addonTotal} revenueEntries={state.revenueEntries.filter(e => e.date.startsWith(month))} ticketItems={state.ticketItems} />}
      {view !== 'revenue' && <ExpenseTable expenses={r.expenses} ledgers={state.ledgers} />}
    </div>
  );
}

// ── YEARLY ────────────────────────────────────────────────────────────────────
function YearlyReport({ view }: { view: ViewMode }) {
  const { state } = useApp();
  const [year, setYear] = useState(new Date().getFullYear());

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const r = useMemo(() => {
    const rev = state.revenueEntries.filter(e => e.date.startsWith(String(year)));
    const exp = state.expenseEntries.filter(e => e.date.startsWith(String(year)));
    const addOns = state.addOnEntries.filter(e => e.date.startsWith(String(year)));
    const paymentSplit = buildPaymentSplit(rev, state.ticketItems, addOns);
    const cashExpenses = exp.filter(e => e.paymentMethod === 'cash').reduce((s, e) => s + e.amount, 0);
    const monthKeys = MONTHS.map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const trend = buildTrendPoints(
      MONTHS,
      (_, index) => state.revenueEntries.filter(e => e.date.startsWith(monthKeys[index])),
      (_, index) => state.addOnEntries.filter(e => e.date.startsWith(monthKeys[index])),
      state.ticketItems,
    );
    const breakdown = MONTHS.map((label, index) => {
      const summary = summarizeEntries(
        state.revenueEntries.filter(e => e.date.startsWith(monthKeys[index])),
        state.ticketItems,
        state.addOnEntries.filter(e => e.date.startsWith(monthKeys[index])),
      );
      return { label, tickets: summary.tickets, ticketBreakdown: summary.ticketBreakdown };
    });
    const monthlyRevenue = MONTHS.map((label, i) => {
      const m = `${year}-${String(i + 1).padStart(2, '0')}`;
      const monthAddOns = state.addOnEntries.filter(e => e.date.startsWith(m));
      return {
        label,
        revenue: state.revenueEntries.filter(e => e.date.startsWith(m)).reduce((s, e) => s + e.totalAmount, 0)
          + monthAddOns.reduce((s, e) => {
            const ticket = state.ticketItems.find(t => t.id === e.ticketItemId);
            return s + (ticket?.price || 0) * e.count;
          }, 0),
        expenses: state.expenseEntries.filter(e => e.date.startsWith(m)).reduce((s, e) => s + e.amount, 0),
      };
    });
    return {
      totalRevenue: rev.reduce((s, e) => s + e.totalAmount, 0) + addOns.reduce((s, e) => {
        const ticket = state.ticketItems.find(t => t.id === e.ticketItemId);
        return s + (ticket?.price || 0) * e.count;
      }, 0),
      totalExpenses: exp.reduce((s, e) => s + e.amount, 0),
      transactions: rev.length,
      paymentSplit,
      cashExpenses,
      trend,
      breakdown,
      expenses: exp,
      monthlyRevenue,
      ...buildItemSales(rev, state.ticketItems, addOns),
    };
  }, [state, year]);

  const handleExport = useCallback(() => {
    exportReportExcel({
      label: String(year),
      revenueEntries: state.revenueEntries.filter(e => e.date.startsWith(String(year))),
      expenseEntries: state.expenseEntries.filter(e => e.date.startsWith(String(year))),
      addOnEntries: state.addOnEntries.filter(e => e.date.startsWith(String(year))),
      ticketItems: state.ticketItems,
      ledgers: state.ledgers,
    });
  }, [year, state]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-sm text-gray-400">{year}</span>
        <div className="flex items-center gap-2">
          <DownloadExcelBtn onClick={handleExport} />
          <label className="text-sm font-medium text-gray-600">Year</label>
          <select className="input w-auto" value={year} onChange={e => setYear(Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      <SummaryCards revenue={r.totalRevenue} expenses={r.totalExpenses} net={r.totalRevenue - r.totalExpenses} transactions={r.transactions} />
      {view !== 'expenses' && <OverviewChart title="Yearly Performance" subtitle="See monthly visitors and tickets as bars, with revenue layered as a line across the year." data={r.trend} />}
      {view !== 'expenses' && <TicketBreakdownCard points={r.breakdown} />}
      {view !== 'expenses' && (
        <div className="card">
          <p className="section-title">Month-wise Breakdown</p>
          <table className="w-full text-sm mt-3">
            <thead><tr className="border-b border-gray-100">{['Month','Revenue','Expenses','Net'].map(h => <th key={h} className={`py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide ${h==='Month'?'text-left':'text-right'}`}>{h}</th>)}</tr></thead>
            <tbody>{r.monthlyRevenue.map(({label,revenue,expenses})=>(<tr key={label} className="border-b border-gray-50 table-row-hover"><td className="py-3 font-medium text-gray-900">{label}</td><td className="py-3 text-right text-emerald-700 font-semibold">{fmt(revenue)}</td><td className="py-3 text-right text-red-600 font-semibold">{fmt(expenses)}</td><td className={`py-3 text-right font-bold ${revenue-expenses>=0?'text-emerald-700':'text-red-600'}`}>{fmt(revenue-expenses)}</td></tr>))}</tbody>
          </table>
        </div>
      )}
      {view !== 'expenses' && <PaymentAndCash paymentSplit={r.paymentSplit} opening={0} cashExpenses={r.cashExpenses} />}
      {view !== 'expenses' && <ItemSalesTables entrySales={r.entrySales} addonSales={r.addonSales} entryTotal={r.entryTotal} addonTotal={r.addonTotal} revenueEntries={state.revenueEntries.filter(e => e.date.startsWith(String(year)))} ticketItems={state.ticketItems} />}
      {view !== 'revenue' && <ExpenseTable expenses={r.expenses} ledgers={state.ledgers} />}
    </div>
  );
}

// ── CUSTOM RANGE ─────────────────────────────────────────────────────────────
function CustomReport({ view }: { view: ViewMode }) {
  const { state } = useApp();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const r = useMemo(() => {
    const from = fromDate <= toDate ? fromDate : toDate;
    const to   = fromDate <= toDate ? toDate   : fromDate;
    const rev  = state.revenueEntries.filter(e => e.date >= from && e.date <= to);
    const exp  = state.expenseEntries.filter(e => e.date >= from && e.date <= to);
    const addOns = (state.addOnEntries ?? []).filter(e => e.date >= from && e.date <= to);
    const paymentSplit = buildPaymentSplit(rev, state.ticketItems, addOns);
    const cashExpenses = exp.filter(e => e.paymentMethod === 'cash').reduce((s, e) => s + e.amount, 0);

    // Build day-by-day trend
    const days = eachDayOfInterval({ start: new Date(from), end: new Date(to) }).map(d => format(d, 'yyyy-MM-dd'));
    const labels = days.map(d => format(new Date(d), 'dd MMM'));
    const trend = buildTrendPoints(
      labels,
      (_, i) => state.revenueEntries.filter(e => e.date === days[i]),
      (_, i) => (state.addOnEntries ?? []).filter(e => e.date === days[i]),
      state.ticketItems,
    );
    const breakdown = days.map((d, i) => {
      const summary = summarizeEntries(
        state.revenueEntries.filter(e => e.date === d),
        state.ticketItems,
        (state.addOnEntries ?? []).filter(e => e.date === d),
      );
      return { label: labels[i], tickets: summary.tickets, ticketBreakdown: summary.ticketBreakdown };
    });

    return {
      totalRevenue: rev.reduce((s, e) => s + e.totalAmount, 0) + addOns.reduce((s, e) => {
        const t = state.ticketItems.find(x => x.id === e.ticketItemId);
        return s + (t?.price || 0) * e.count;
      }, 0),
      totalExpenses: exp.reduce((s, e) => s + e.amount, 0),
      transactions: rev.length,
      paymentSplit,
      cashExpenses,
      trend,
      breakdown,
      expenses: exp,
      days: days.length,
      rangeLabel: from === to ? format(new Date(from), 'dd MMM yyyy') : `${format(new Date(from), 'dd MMM yyyy')} – ${format(new Date(to), 'dd MMM yyyy')}`,
      ...buildItemSales(rev, state.ticketItems, addOns),
    };
  }, [state, fromDate, toDate]);

  const handleExport = useCallback(() => {
    const from = fromDate <= toDate ? fromDate : toDate;
    const to   = fromDate <= toDate ? toDate   : fromDate;
    exportReportExcel({
      label: r.rangeLabel,
      revenueEntries: state.revenueEntries.filter(e => e.date >= from && e.date <= to),
      expenseEntries: state.expenseEntries.filter(e => e.date >= from && e.date <= to),
      addOnEntries: (state.addOnEntries ?? []).filter(e => e.date >= from && e.date <= to),
      ticketItems: state.ticketItems,
      ledgers: state.ledgers,
    });
  }, [fromDate, toDate, r.rangeLabel, state]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-sm text-gray-400">{r.rangeLabel} · {r.days} day{r.days !== 1 ? 's' : ''}</span>
        <div className="flex flex-wrap items-center gap-3">
          <DownloadExcelBtn onClick={handleExport} />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">From</label>
            <input type="date" className="input w-auto" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">To</label>
            <input type="date" className="input w-auto" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>
      </div>
      <SummaryCards revenue={r.totalRevenue} expenses={r.totalExpenses} net={r.totalRevenue - r.totalExpenses} transactions={r.transactions} />
      {view !== 'expenses' && <OverviewChart title="Custom Range Performance" subtitle={`Daily visitors, tickets and revenue from ${r.rangeLabel}.`} data={r.trend} />}
      {view !== 'expenses' && <TicketBreakdownCard points={r.breakdown} />}
      {view !== 'expenses' && <PaymentAndCash paymentSplit={r.paymentSplit} opening={0} cashExpenses={r.cashExpenses} />}
      {view !== 'expenses' && <ItemSalesTables entrySales={r.entrySales} addonSales={r.addonSales} entryTotal={r.entryTotal} addonTotal={r.addonTotal} revenueEntries={state.revenueEntries.filter(e => { const from = fromDate <= toDate ? fromDate : toDate; const to = fromDate <= toDate ? toDate : fromDate; return e.date >= from && e.date <= to; })} ticketItems={state.ticketItems} />}
      {view !== 'revenue' && <ExpenseTable expenses={r.expenses} ledgers={state.ledgers} />}
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function Reports() {
  const [tab, setTab] = useState<ReportTab>('daily');
  const [view, setView] = useState<ViewMode>('combined');

  const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
    { value: 'combined', label: 'Revenue & Expenses' },
    { value: 'revenue',  label: 'Revenue Only' },
    { value: 'expenses', label: 'Expenses Only' },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <h2 className="page-title">Reports</h2>
      </div>

      {/* Tabs + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          className="input w-auto"
          value={view}
          onChange={e => setView(e.target.value as ViewMode)}
        >
          {VIEW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {tab === 'daily'   && <DailyReport   view={view} />}
      {tab === 'weekly'  && <WeeklyReport  view={view} />}
      {tab === 'monthly' && <MonthlyReport view={view} />}
      {tab === 'yearly'  && <YearlyReport  view={view} />}
      {tab === 'custom'  && <CustomReport  view={view} />}
    </div>
  );
}
