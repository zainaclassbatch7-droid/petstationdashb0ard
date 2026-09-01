import XLSXStyle from 'xlsx-js-style';
import type { RevenueEntry, ExpenseEntry, TicketItem, AddOnEntry, Ledger } from '@/types';

export interface ExportParams {
  label: string;
  revenueEntries: RevenueEntry[];
  expenseEntries: ExpenseEntry[];
  addOnEntries: AddOnEntry[];
  ticketItems: TicketItem[];
  ledgers: Ledger[];
}

// ── Border / style helpers ────────────────────────────────────────────────────

function border(color = 'D1D5DB') {
  const b = { style: 'thin', color: { rgb: color } };
  return { top: b, bottom: b, left: b, right: b };
}

function cell(v: any, s: any, t?: string, z?: string) {
  const type = t ?? (typeof v === 'number' ? 'n' : 's');
  return { v, t: type, s, ...(z ? { z } : {}) };
}

function col(w: number) { return { wch: w }; }

// Preset styles
const DARK    = '111827';
const GREEN   = '047857';
const GREENBG = 'DCFCE7';
const RED     = 'DC2626';
const REDBG   = 'FEF2F2';
const BLUE    = '1D4ED8';
const BLUEBG  = 'EFF6FF';
const GRAY    = 'F3F4F6';
const WHITE   = 'FFFFFF';
const STRIPE1 = 'F8FAFC';
const STRIPE2 = 'FFFFFF';

const hdrStyle = (bg: string, fg = WHITE) => ({
  font: { bold: true, color: { rgb: fg }, sz: 11, name: 'Calibri' },
  fill: { fgColor: { rgb: bg }, patternType: 'solid' },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: border(bg),
});

const kpiLabelStyle = (bg: string) => ({
  font: { bold: true, color: { rgb: WHITE }, sz: 10, name: 'Calibri' },
  fill: { fgColor: { rgb: bg }, patternType: 'solid' },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: border(bg),
});

const kpiValueStyle = (color: string, bg = WHITE) => ({
  font: { bold: true, color: { rgb: color }, sz: 18, name: 'Calibri' },
  fill: { fgColor: { rgb: bg }, patternType: 'solid' },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: border('E5E7EB'),
});

const rowStyle = (even: boolean, align: 'left' | 'center' | 'right' = 'left') => ({
  font: { sz: 10, name: 'Calibri', color: { rgb: '374151' } },
  fill: { fgColor: { rgb: even ? STRIPE1 : STRIPE2 }, patternType: 'solid' },
  alignment: { horizontal: align, vertical: 'center' },
  border: border('E5E7EB'),
});

const totalStyle = (align: 'left' | 'center' | 'right' = 'left') => ({
  font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: DARK } },
  fill: { fgColor: { rgb: GRAY }, patternType: 'solid' },
  alignment: { horizontal: align, vertical: 'center' },
  border: border('9CA3AF'),
});

const amtTotalStyle = (color: string, bg: string) => ({
  font: { bold: true, sz: 12, name: 'Calibri', color: { rgb: color } },
  fill: { fgColor: { rgb: bg }, patternType: 'solid' },
  alignment: { horizontal: 'right', vertical: 'center' },
  border: border(color),
});

// ── Billing line expander (mirrors getBillLines in Billing.tsx) ─────────────
const ENTRY_PRICE     = 150;
const PET_FEED_PRICE  = 50;
const LIVE_FEED_PRICE = 300;

function expandBillingItems(items: RevenueEntry['items']): { name: string; qty: number; unitPrice: number; total: number }[] {
  const rows: { name: string; qty: number; unitPrice: number; total: number }[] = [];
  for (const i of items) {
    const id  = i.ticketItemId;
    const qty = i.quantity;
    if (id === 'entry-only') {
      rows.push({ name: 'Entry Ticket', qty, unitPrice: ENTRY_PRICE, total: ENTRY_PRICE * qty });
    } else if (id === 'combo-entry') {
      rows.push({ name: 'Entry Ticket', qty, unitPrice: ENTRY_PRICE,    total: ENTRY_PRICE    * qty });
      rows.push({ name: 'Pet Feed',     qty, unitPrice: PET_FEED_PRICE, total: PET_FEED_PRICE * qty });
    } else if (id === 'ultimate-pet-lover-pass' || (i.name ?? '').trim().toLowerCase() === 'ultimate pet lover pass') {
      rows.push({ name: 'Ultimate Pet Lover Entry Ticket', qty, unitPrice: ENTRY_PRICE,     total: ENTRY_PRICE     * qty });
      rows.push({ name: 'Live Feed',                       qty, unitPrice: LIVE_FEED_PRICE, total: LIVE_FEED_PRICE * qty });
    } else {
      const unitPrice = i.unitPrice > 0 ? i.unitPrice : i.total / i.quantity;
      rows.push({ name: i.name ?? id, qty, unitPrice, total: i.total });
    }
  }
  return rows;
}

// ── Build a worksheet from a 2‑D array of cell objects ───────────────────────
function buildWs(data: any[][], colWidths: number[], rowHeights?: Record<number, number>): XLSXStyle.WorkSheet {
  const ws: any = {};
  let maxR = 0, maxC = 0;
  data.forEach((row, r) => {
    row.forEach((c, col) => {
      if (!c) return;
      ws[XLSXStyle.utils.encode_cell({ r, c: col })] = c;
      if (r > maxR) maxR = r;
      if (col > maxC) maxC = col;
    });
  });
  ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  ws['!cols'] = colWidths.map(w => col(w));
  if (rowHeights) {
    ws['!rows'] = [];
    Object.entries(rowHeights).forEach(([r, h]) => { (ws['!rows'] as any[])[Number(r)] = { hpt: h }; });
  }
  return ws as XLSXStyle.WorkSheet;
}

// ── Sheet 1: Summary ─────────────────────────────────────────────────────────
function buildSummarySheet(p: ExportParams): XLSXStyle.WorkSheet {
  const totalRevenue = p.revenueEntries.reduce((s, e) => s + e.totalAmount, 0)
    + p.addOnEntries.reduce((s, e) => { const t = p.ticketItems.find(x => x.id === e.ticketItemId); return s + (t?.price || 0) * e.count; }, 0);
  const totalExpenses = p.expenseEntries.reduce((s, e) => s + e.amount, 0);
  const net = totalRevenue - totalExpenses;
  const txCount = p.revenueEntries.length;
  const pmSplit: Record<string, number> = {};
  p.revenueEntries.forEach(e => { pmSplit[e.paymentMethod] = (pmSplit[e.paymentMethod] || 0) + e.totalAmount; });

  // 8 columns (A–H)
  const COLS = 8;
  const titleStyle = {
    font: { bold: true, sz: 18, name: 'Calibri', color: { rgb: DARK } },
    fill: { fgColor: { rgb: 'F1F5F9' }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: border('CBD5E1'),
  };
  const periodLabelStyle = { font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: '6B7280' } }, fill: { fgColor: { rgb: GRAY }, patternType: 'solid' }, alignment: { horizontal: 'center', vertical: 'center' }, border: border('D1D5DB') };
  const periodValueStyle = { font: { bold: true, sz: 12, name: 'Calibri', color: { rgb: DARK } }, fill: { fgColor: { rgb: WHITE }, patternType: 'solid' }, alignment: { horizontal: 'left', vertical: 'center' }, border: border('E5E7EB') };

  const ws: any = {};
  const merges: any[] = [];

  const set = (r: number, c: number, v: any, s: any, t?: string, z?: string) => {
    ws[XLSXStyle.utils.encode_cell({ r, c })] = { v, t: t ?? (typeof v === 'number' ? 'n' : 's'), s, ...(z ? { z } : {}) };
  };
  const mrg = (r1: number, c1: number, r2: number, c2: number) => merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });

  // Row 0 – Title
  set(0, 0, 'PETSTATION  —  REPORT SUMMARY', titleStyle);
  mrg(0, 0, 0, COLS - 1);

  // Row 1 – Period
  set(1, 0, 'PERIOD', periodLabelStyle);
  mrg(1, 0, 1, 1);
  set(1, 2, p.label, periodValueStyle);
  mrg(1, 2, 1, COLS - 1);

  // Row 2 – spacer (empty)

  // Rows 3–5 – KPI cards (2 cols each)
  // Revenue
  set(3, 0, 'TOTAL REVENUE', kpiLabelStyle(GREEN)); mrg(3, 0, 3, 1);
  set(4, 0, `Rs ${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, kpiValueStyle(GREEN, 'F0FDF4')); mrg(4, 0, 5, 1);
  // Expenses
  set(3, 2, 'TOTAL EXPENSES', kpiLabelStyle(RED)); mrg(3, 2, 3, 3);
  set(4, 2, `Rs ${totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, kpiValueStyle(RED, REDBG)); mrg(4, 2, 5, 3);
  // Net
  const netColor = net >= 0 ? GREEN : RED;
  const netBg = net >= 0 ? 'F0FDF4' : REDBG;
  set(3, 4, net >= 0 ? 'NET PROFIT' : 'NET LOSS', kpiLabelStyle(netColor)); mrg(3, 4, 3, 5);
  set(4, 4, `Rs ${Math.abs(net).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, kpiValueStyle(netColor, netBg)); mrg(4, 4, 5, 5);
  // Transactions
  set(3, 6, 'TRANSACTIONS', kpiLabelStyle(BLUE)); mrg(3, 6, 3, 7);
  set(4, 6, String(txCount), kpiValueStyle(BLUE, BLUEBG)); mrg(4, 6, 5, 7);

  // Row 6 spacer

  // Row 7 – section header
  set(7, 0, 'PAYMENT METHOD BREAKDOWN', hdrStyle(DARK));
  mrg(7, 0, 7, COLS - 1);

  // Row 8 – sub-headers
  set(8, 0, 'Payment Method', hdrStyle('374151')); mrg(8, 0, 8, 3);
  set(8, 4, 'Amount (Rs)', hdrStyle('374151')); mrg(8, 4, 8, COLS - 1);

  let pr = 9;
  const pmArr = Object.entries(pmSplit).sort((a, b) => b[1] - a[1]);
  pmArr.forEach(([method, amt], i) => {
    const s = rowStyle(i % 2 === 0);
    const sAmt = { ...rowStyle(i % 2 === 0, 'right'), font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: GREEN } } };
    set(pr, 0, method.toUpperCase(), s); mrg(pr, 0, pr, 3);
    set(pr, 4, amt, sAmt, 'n', '#,##0.00'); mrg(pr, 4, pr, COLS - 1);
    pr++;
  });
  // Total
  set(pr, 0, 'TOTAL', totalStyle()); mrg(pr, 0, pr, 3);
  set(pr, 4, pmArr.reduce((s, [, a]) => s + a, 0), amtTotalStyle(GREEN, 'F0FDF4'), 'n', '#,##0.00'); mrg(pr, 4, pr, COLS - 1);

  ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: pr + 2, c: COLS - 1 } });
  ws['!merges'] = merges;
  ws['!cols'] = Array(COLS).fill(col(16));
  ws['!rows'] = [{ hpt: 40 }, { hpt: 26 }, { hpt: 8 }, { hpt: 24 }, { hpt: 42 }, { hpt: 20 }, { hpt: 8 }, { hpt: 24 }, { hpt: 22 }];
  return ws as XLSXStyle.WorkSheet;
}

// ── Sheet 2: Transactions ────────────────────────────────────────────────────
function buildTransactionsSheet(p: ExportParams): XLSXStyle.WorkSheet {
  const sorted = [...p.revenueEntries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const headers = ['#', 'Date', 'Time', 'Invoice', 'Item', 'Qty', 'Unit Price', 'Amount', 'Payment'];
  const data: any[][] = [headers.map(h => cell(h, hdrStyle(DARK)))];

  const billHdrBg = 'EFF6FF';
  const billHdrColor = '1E3A8A';
  const billHdrStyle = {
    font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: billHdrColor } },
    fill: { fgColor: { rgb: billHdrBg }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: border('BFDBFE'),
  };
  const billTotalStyle = {
    font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: GREEN } },
    fill: { fgColor: { rgb: GREENBG }, patternType: 'solid' },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: border('6EE7B7'),
  };
  const billTotalLabelStyle = {
    font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: DARK } },
    fill: { fgColor: { rgb: GREENBG }, patternType: 'solid' },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: border('6EE7B7'),
  };

  const merges: any[] = [];
  let rowIdx = 1;
  let txNum = 0;

  sorted.forEach((entry, ei) => {
    txNum++;
    const d = new Date(entry.createdAt);
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
    const even = ei % 2 === 0;

    // Bill header row (spans all cols)
    const billLabel = `Bill #${txNum}  ·  ${entry.invoiceNo || '—'}  ·  ${entry.date}  ·  ${timeStr}  ·  ${entry.paymentMethod.toUpperCase()}`;
    data.push([
      cell(billLabel, billHdrStyle),
      cell('', billHdrStyle),
      cell('', billHdrStyle),
      cell('', billHdrStyle),
      cell('', billHdrStyle),
      cell('', billHdrStyle),
      cell('', billHdrStyle),
      cell('', billHdrStyle),
      cell('', billHdrStyle),
    ]);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 8 } });
    rowIdx++;

    // Item rows — expanded into individual billing lines
    const expanded = expandBillingItems(entry.items);
    expanded.forEach(line => {
      const rs = rowStyle(even);
      data.push([
        cell('', rs),
        cell(entry.date, rs),
        cell(timeStr, rs),
        cell(entry.invoiceNo || '—', rs),
        cell(line.name, rs),
        cell(line.qty, { ...rs, alignment: { horizontal: 'center', vertical: 'center' } }, 'n'),
        cell(line.unitPrice, { ...rs, alignment: { horizontal: 'right', vertical: 'center' } }, 'n', '#,##0.00'),
        cell(line.total, { ...rs, alignment: { horizontal: 'right', vertical: 'center' } }, 'n', '#,##0.00'),
        cell(entry.paymentMethod.toUpperCase(), { ...rs, alignment: { horizontal: 'center', vertical: 'center' } }),
      ]);
      rowIdx++;
    });

    // Bill total row
    const totQty = expanded.reduce((s, l) => s + l.qty, 0);
    data.push([
      cell('', billTotalLabelStyle),
      cell('', billTotalLabelStyle),
      cell('', billTotalLabelStyle),
      cell('', billTotalLabelStyle),
      cell('Bill Total', billTotalLabelStyle),
      cell(totQty, { ...billTotalLabelStyle, alignment: { horizontal: 'center', vertical: 'center' } }, 'n'),
      cell('', billTotalLabelStyle),
      cell(entry.totalAmount, billTotalStyle, 'n', '#,##0.00'),
      cell('', billTotalLabelStyle),
    ]);
    rowIdx++;

    // Spacer
    data.push(Array(9).fill(cell('', { fill: { fgColor: { rgb: 'FFFFFF' }, patternType: 'solid' } })));
    rowIdx++;
  });

  // Grand total
  const grandTotal = sorted.reduce((s, e) => s + e.totalAmount, 0);
  const grandQty = sorted.reduce((s, e) => s + expandBillingItems(e.items).reduce((ss, l) => ss + l.qty, 0), 0);
  data.push([
    cell(`${sorted.length} Bills`, totalStyle('center')),
    cell('', totalStyle()),
    cell('', totalStyle()),
    cell('', totalStyle()),
    cell('GRAND TOTAL', totalStyle('right')),
    cell(grandQty, { ...totalStyle('center') }, 'n'),
    cell('', totalStyle()),
    cell(grandTotal, amtTotalStyle(GREEN, 'F0FDF4'), 'n', '#,##0.00'),
    cell('', totalStyle()),
  ]);

  const ws = buildWs(data, [5, 12, 10, 12, 24, 7, 14, 14, 11], { 0: 22 });
  ws['!merges'] = merges;
  return ws;
}

// ── Sheet 3: Expenses ────────────────────────────────────────────────────────
function buildExpensesSheet(p: ExportParams): XLSXStyle.WorkSheet {
  const headers = ['Date', 'Ledger', 'Sub-ledger', 'Description', 'Payment', 'Amount (Rs)'];
  const data: any[][] = [headers.map(h => cell(h, hdrStyle(DARK)))];

  const sorted = [...p.expenseEntries].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach((e, i) => {
    const ledger = p.ledgers.find(l => l.id === e.ledgerId);
    const sub = ledger?.subledgers?.find(s => s.id === e.subledgerId);
    const s = rowStyle(i % 2 === 0);
    data.push([
      cell(e.date, s),
      cell(ledger?.name || e.ledgerId, s),
      cell(sub?.name || '—', s),
      cell(e.description || '—', s),
      cell(e.paymentMethod.toUpperCase(), { ...s, alignment: { horizontal: 'center', vertical: 'center' } }),
      cell(e.amount, { ...s, alignment: { horizontal: 'right', vertical: 'center' } }, 'n', '#,##0.00'),
    ]);
  });

  const total = sorted.reduce((s, e) => s + e.amount, 0);
  data.push([
    cell('', totalStyle()), cell('', totalStyle()), cell('', totalStyle()),
    cell('', totalStyle()), cell('TOTAL', totalStyle('right')),
    cell(total, amtTotalStyle(RED, REDBG), 'n', '#,##0.00'),
  ]);

  return buildWs(data, [13, 18, 15, 36, 11, 16], { 0: 22 });
}

// ── Sheet 4: Item Sales ──────────────────────────────────────────────────────
function buildItemSalesSheet(p: ExportParams): XLSXStyle.WorkSheet {
  const salesMap: Record<string, { category: string; qty: number; revenue: number }> = {};
  p.revenueEntries.forEach(e => {
    expandBillingItems(e.items).forEach(line => {
      if (!salesMap[line.name]) salesMap[line.name] = { category: 'entry', qty: 0, revenue: 0 };
      salesMap[line.name].qty += line.qty;
      salesMap[line.name].revenue += line.total;
    });
  });
  p.addOnEntries.forEach(e => {
    const t = p.ticketItems.find(x => x.id === e.ticketItemId);
    const key = t?.name ?? e.ticketItemId;
    if (!salesMap[key]) salesMap[key] = { category: 'addon', qty: 0, revenue: 0 };
    salesMap[key].qty += e.count;
    salesMap[key].revenue += (t?.price || 0) * e.count;
  });

  const headers = ['Item', 'Category', 'Qty Sold', 'Revenue (Rs)'];
  const data: any[][] = [headers.map(h => cell(h, hdrStyle(DARK)))];

  const rows = Object.entries(salesMap).sort((a, b) => b[1].revenue - a[1].revenue);
  rows.forEach(([name, d], i) => {
    const s = rowStyle(i % 2 === 0);
    data.push([
      cell(name, s),
      cell(d.category.toUpperCase(), { ...s, alignment: { horizontal: 'center', vertical: 'center' } }),
      cell(d.qty, { ...s, alignment: { horizontal: 'center', vertical: 'center' } }, 'n'),
      cell(d.revenue, { ...s, alignment: { horizontal: 'right', vertical: 'center' } }, 'n', '#,##0.00'),
    ]);
  });

  const totalQty = rows.reduce((s, [, d]) => s + d.qty, 0);
  const totalRev = rows.reduce((s, [, d]) => s + d.revenue, 0);
  data.push([
    cell('TOTAL', totalStyle()),
    cell('', totalStyle()),
    cell(totalQty, { ...totalStyle('center') }, 'n'),
    cell(totalRev, amtTotalStyle(GREEN, 'F0FDF4'), 'n', '#,##0.00'),
  ]);

  return buildWs(data, [30, 13, 11, 16], { 0: 22 });
}

// ── Sheet 5: All Transactions (flat list) ────────────────────────────────────
function buildAllTransactionsSheet(p: ExportParams): XLSXStyle.WorkSheet {
  const headers = ['Time', 'Invoice', 'Items', 'Payment', 'Amount'];
  const data: any[][] = [headers.map(h => cell(h, hdrStyle(DARK)))];

  const sorted = [...p.revenueEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  sorted.forEach((e, i) => {
    const timeStr = new Date(e.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
    const itemsStr = expandBillingItems(e.items)
      .map(line => `${line.name} ×${line.qty} (Rs ${line.total.toLocaleString('en-IN')})`)
      .join(', ');
    const s = rowStyle(i % 2 === 0);
    data.push([
      cell(timeStr, { ...s, alignment: { horizontal: 'center', vertical: 'center' } }),
      cell(e.invoiceNo || '—', s),
      cell(itemsStr, s),
      cell(e.paymentMethod.toUpperCase(), { ...s, alignment: { horizontal: 'center', vertical: 'center' } }),
      cell(e.totalAmount, { ...s, alignment: { horizontal: 'right', vertical: 'center' } }, 'n', '#,##0.00'),
    ]);
  });

  const total = sorted.reduce((s, e) => s + e.totalAmount, 0);
  data.push([
    cell(`${sorted.length} transactions`, totalStyle('center')),
    cell('', totalStyle()), cell('', totalStyle()),
    cell('TOTAL', totalStyle('right')),
    cell(total, amtTotalStyle(GREEN, 'F0FDF4'), 'n', '#,##0.00'),
  ]);

  return buildWs(data, [12, 14, 48, 12, 14], { 0: 22 });
}

// ── Main export ───────────────────────────────────────────────────────────────
export function exportReportExcel(params: ExportParams) {
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, buildSummarySheet(params), 'Summary');
  XLSXStyle.utils.book_append_sheet(wb, buildAllTransactionsSheet(params), 'All Transactions');
  XLSXStyle.utils.book_append_sheet(wb, buildTransactionsSheet(params), 'Transactions');
  XLSXStyle.utils.book_append_sheet(wb, buildExpensesSheet(params), 'Expenses');
  XLSXStyle.utils.book_append_sheet(wb, buildItemSalesSheet(params), 'Item Sales');
  XLSXStyle.writeFile(wb, `PetStation_Report_${params.label.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}
