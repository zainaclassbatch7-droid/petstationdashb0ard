import { supabase } from './supabase';
import type {
  RevenueEntry, ExpenseEntry, CustomerRecord, AddOnEntry,
  AppSettings, User, StaffMember, AttendanceRecord, Employee,
  Ledger, TicketItem, WhatsAppTemplate, CashFlow, EmployeeCharge, FoodCostEntry, JournalEntry,
} from '@/types';

const APP_ID = 'petstation';

// ── INVOICE NUMBER ───────────────────────────────────────────────────────────
// Format: B17305 → B99999 → C00001 → C99999 → D00001 …
// counter 117305 → B17305, counter 199999 → B99999, counter 200000 → C00001

const INVOICE_OFFSET = 117304; // last counter before B17305

let localCounter = INVOICE_OFFSET;
// Prevents two concurrent calls from grabbing the same counter
let invoiceIssueLock: Promise<string> | null = null;

function counterToInvoiceNo(counter: number): string {
  const prefix = String.fromCharCode(65 + Math.floor((counter - 1) / 99999));
  const num = ((counter - 1) % 99999) + 1;
  return `${prefix}${String(num).padStart(5, '0')}`;
}

// Push a freed invoice number back into the recycled pool (sorted, FIFO)
export async function recycleInvoiceNo(invoiceNo: string): Promise<void> {
  const { data } = await supabase
    .from('app_config').select('value')
    .eq('app_id', APP_ID).eq('key', 'recycledInvoices').single();
  let list: string[] = [];
  try { if (data) list = JSON.parse(data.value); } catch { /* empty */ }
  list.push(invoiceNo);
  list.sort(); // lowest number reused first
  await supabase.from('app_config').upsert(
    { app_id: APP_ID, key: 'recycledInvoices', value: JSON.stringify(list) },
    { onConflict: 'app_id,key' }
  );
}

async function popRecycledInvoiceNo(): Promise<string | null> {
  const { data } = await supabase
    .from('app_config').select('value')
    .eq('app_id', APP_ID).eq('key', 'recycledInvoices').single();
  if (!data) return null;
  try {
    const list: string[] = JSON.parse(data.value);
    if (!list.length) return null;
    const next = list.shift()!;
    await supabase.from('app_config').upsert(
      { app_id: APP_ID, key: 'recycledInvoices', value: JSON.stringify(list) },
      { onConflict: 'app_id,key' }
    );
    return next;
  } catch { return null; }
}

export async function getNextInvoiceNo(): Promise<string> {
  // Chain calls so concurrent requests never race for the same counter
  const result = (invoiceIssueLock ?? Promise.resolve('')).then(async () => {
    try {
      const recycled = await popRecycledInvoiceNo();
      if (recycled) return recycled;

      const { data } = await Promise.race([
        supabase.from('app_config').select('value').eq('app_id', APP_ID).eq('key', 'invoiceCounter').single(),
        new Promise<{ data: null }>(resolve => setTimeout(() => resolve({ data: null }), 3000)),
      ]);
      let counter: number;
      if (data) {
        const parsed = parseInt(data.value, 10);
        counter = (!isNaN(parsed) && parsed >= INVOICE_OFFSET) ? parsed + 1 : INVOICE_OFFSET + 1;
      } else {
        counter = localCounter + 1;
      }
      localCounter = counter;
      await supabase.from('app_config').upsert(
        { app_id: APP_ID, key: 'invoiceCounter', value: String(counter) },
        { onConflict: 'app_id,key' }
      );
      return counterToInvoiceNo(counter);
    } catch {
      localCounter = localCounter + 1;
      return counterToInvoiceNo(localCounter);
    }
  });
  invoiceIssueLock = result;
  return result;
}

// ── REVENUE ───────────────────────────────────────────────────────────────────

export async function upsertRevenue(entry: RevenueEntry) {
  const { error } = await supabase.from('revenue_entries').upsert({
    id: entry.id, date: entry.date, items: entry.items,
    payment_method: entry.paymentMethod, total_amount: entry.totalAmount,
    created_by: entry.createdBy, created_at: entry.createdAt,
    synced: true, deletion_approval: entry.deletionApproval ?? null,
    invoice_no: entry.invoiceNo ?? null,
  }, { onConflict: 'id' });
  if (error) console.error('[supabase] upsertRevenue:', error.message);
}

export async function deleteRevenue(id: string) {
  const { error } = await supabase.from('revenue_entries').delete().eq('id', id);
  if (error) console.error('[supabase] deleteRevenue:', error.message);
}

export async function fetchRevenue(): Promise<RevenueEntry[]> {
  const allRows: any[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('revenue_entries').select('*')
      .order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (error) { console.error('[supabase] fetchRevenue:', error.message); break; }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return allRows.map(r => ({
    id: r.id, date: r.date, items: r.items,
    paymentMethod: r.payment_method, totalAmount: r.total_amount,
    createdBy: r.created_by, createdAt: r.created_at,
    synced: true, deletionApproval: r.deletion_approval,
    invoiceNo: r.invoice_no ?? undefined,
  }));
}

// ── EXPENSES ──────────────────────────────────────────────────────────────────

export async function upsertExpense(entry: ExpenseEntry) {
  const { error } = await supabase.from('expense_entries').upsert({
    id: entry.id, date: entry.date, ledger_id: entry.ledgerId,
    subledger_id: entry.subledgerId ?? null, amount: entry.amount,
    payment_method: entry.paymentMethod, description: entry.description,
    note: entry.note ?? null, created_by: entry.createdBy, created_at: entry.createdAt,
  }, { onConflict: 'id' });
  if (error) console.error('[supabase] upsertExpense:', error.message);
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from('expense_entries').delete().eq('id', id);
  if (error) console.error('[supabase] deleteExpense:', error.message);
}

export async function fetchExpenses(): Promise<ExpenseEntry[]> {
  const { data, error } = await supabase.from('expense_entries').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[supabase] fetchExpenses:', error.message); return []; }
  return (data ?? []).map(r => ({
    id: r.id, date: r.date, ledgerId: r.ledger_id, subledgerId: r.subledger_id,
    amount: r.amount, paymentMethod: r.payment_method, description: r.description,
    note: r.note, createdBy: r.created_by, createdAt: r.created_at,
  }));
}

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────

export async function upsertCustomer(c: CustomerRecord) {
  const { error } = await supabase.from('customers').upsert({
    id: c.id, name: c.name, phone: c.phone,
    visit_count: c.visitCount, total_spent: c.totalSpent,
    last_visit: c.lastVisit, created_at: c.createdAt,
  }, { onConflict: 'id' });
  if (error) console.error('[supabase] upsertCustomer:', error.message);
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) console.error('[supabase] deleteCustomer:', error.message);
}

export async function fetchCustomers(): Promise<CustomerRecord[]> {
  const allRows: any[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('customers').select('*')
      .order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (error) { console.error('[supabase] fetchCustomers:', error.message); break; }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return allRows.map(r => ({
    id: r.id, name: r.name, phone: r.phone,
    visitCount: r.visit_count, totalSpent: r.total_spent,
    lastVisit: r.last_visit, createdAt: r.created_at,
  }));
}

// ── ADD-ONS ───────────────────────────────────────────────────────────────────

export async function upsertAddonEntry(e: AddOnEntry) {
  const { error } = await supabase.from('addon_entries').upsert({
    id: e.id, date: e.date, staff_id: e.staffId,
    ticket_item_id: e.ticketItemId, ticket_item_name: e.ticketItemName,
    count: e.count, payment_method: e.paymentMethod ?? null,
    submitted_by_user_id: e.submittedByUserId, submitted_by_name: e.submittedByName,
    note: e.note ?? null, created_at: e.createdAt,
  }, { onConflict: 'id' });
  if (error) console.error('[supabase] upsertAddonEntry:', error.message);
}

export async function deleteAddonEntry(id: string) {
  const { error } = await supabase.from('addon_entries').delete().eq('id', id);
  if (error) console.error('[supabase] deleteAddonEntry:', error.message);
}

export async function fetchAddonEntries(): Promise<AddOnEntry[]> {
  const { data, error } = await supabase.from('addon_entries').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[supabase] fetchAddonEntries:', error.message); return []; }
  return (data ?? []).map(r => ({
    id: r.id, date: r.date, staffId: r.staff_id,
    ticketItemId: r.ticket_item_id, ticketItemName: r.ticket_item_name,
    count: r.count, paymentMethod: r.payment_method,
    submittedByUserId: r.submitted_by_user_id, submittedByName: r.submitted_by_name,
    note: r.note, createdAt: r.created_at,
  }));
}

// ── APP CONFIG (settings, users, staff, employees, ledgers, ticketItems, templates, cashFlows) ──

async function saveConfig(key: string, value: unknown) {
  const { error } = await supabase.from('app_config').upsert(
    { app_id: APP_ID, key, value: JSON.stringify(value) },
    { onConflict: 'app_id,key' }
  );
  if (error) console.error(`[supabase] saveConfig(${key}):`, error.message);
}

async function loadConfig<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase.from('app_config')
    .select('value').eq('app_id', APP_ID).eq('key', key).single();
  if (error || !data) return null;
  try { return JSON.parse(data.value) as T; } catch { return null; }
}

export const saveSettings = (s: AppSettings) => saveConfig('settings', s);
export const fetchSettings = () => loadConfig<AppSettings>('settings');

export const saveUsers = (u: User[]) => saveConfig('users', u);
export const fetchUsers = () => loadConfig<User[]>('users');

export const saveStaff = (s: StaffMember[]) => saveConfig('staff', s);
export const fetchStaff = () => loadConfig<StaffMember[]>('staff');

export const saveEmployees = (e: Employee[]) => saveConfig('employees', e);
export const fetchEmployees = () => loadConfig<Employee[]>('employees');

export const saveLedgers = (l: Ledger[]) => saveConfig('ledgers', l);
export const fetchLedgers = () => loadConfig<Ledger[]>('ledgers');

export const saveTicketItems = (t: TicketItem[]) => saveConfig('ticketItems', t);
export const fetchTicketItems = () => loadConfig<TicketItem[]>('ticketItems');

export const saveWhatsAppTemplates = (t: WhatsAppTemplate[]) => saveConfig('whatsappTemplates', t);
export const fetchWhatsAppTemplates = () => loadConfig<WhatsAppTemplate[]>('whatsappTemplates');

export const saveCashFlows = (c: CashFlow[]) => saveConfig('cashFlows', c);
export const fetchCashFlows = () => loadConfig<CashFlow[]>('cashFlows');

export const saveBillMessage = (msg: string) => saveConfig('billMessage', msg);
export const fetchBillMessage = () => loadConfig<string>('billMessage');

export interface BillLayout { beforeFooterImage?: string; beforeFooterText?: string; }
export const saveBillLayout = (l: BillLayout) => saveConfig('billLayout', l);
export const fetchBillLayout = () => loadConfig<BillLayout>('billLayout');

// ── ATTENDANCE ────────────────────────────────────────────────────────────────

export async function upsertAttendance(r: AttendanceRecord) {
  const { error } = await supabase.from('attendance_records').upsert({
    id: r.id, date: r.date, staff_id: r.staffId, status: r.status,
    substitute_support: r.substituteSupport ?? null,
    behavior: r.behavior ?? null, cleanliness: r.cleanliness ?? null,
    add_on_manual_count: r.addOnManualCount ?? null,
    add_on_sale_count: r.addOnSaleCount ?? null,
    negative_marks: r.negativeMarks, negative_comment: r.negativeComment ?? null,
    overall_performance: r.overallPerformance, total_score: r.totalScore,
    recorded_by: r.recordedBy, created_at: r.createdAt,
  }, { onConflict: 'id' });
  if (error) console.error('[supabase] upsertAttendance:', error.message);
}

export async function deleteAttendance(id: string) {
  const { error } = await supabase.from('attendance_records').delete().eq('id', id);
  if (error) console.error('[supabase] deleteAttendance:', error.message);
}

export async function fetchAttendance(): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase.from('attendance_records').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[supabase] fetchAttendance:', error.message); return []; }
  return (data ?? []).map(r => ({
    id: r.id, date: r.date, staffId: r.staff_id, status: r.status,
    substituteSupport: r.substitute_support, behavior: r.behavior,
    cleanliness: r.cleanliness, addOnManualCount: r.add_on_manual_count,
    addOnSaleCount: r.add_on_sale_count, negativeMarks: r.negative_marks,
    negativeComment: r.negative_comment, overallPerformance: r.overall_performance,
    totalScore: r.total_score, recordedBy: r.recorded_by, createdAt: r.created_at,
  }));
}

// ── EMPLOYEE CHARGES ──────────────────────────────────────────────────────────

export async function upsertEmployeeCharge(e: EmployeeCharge) {
  const { error } = await supabase.from('employee_charges').upsert({
    id: e.id, date: e.date, employee_id: e.employeeId, charge_type: e.chargeType,
    amount: e.amount, payment_method: e.paymentMethod, description: e.description,
    note: e.note ?? null, created_by: e.createdBy, created_at: e.createdAt,
  }, { onConflict: 'id' });
  if (error) console.error('[supabase] upsertEmployeeCharge:', error.message);
}

export async function deleteEmployeeCharge(id: string) {
  const { error } = await supabase.from('employee_charges').delete().eq('id', id);
  if (error) console.error('[supabase] deleteEmployeeCharge:', error.message);
}

export async function fetchEmployeeCharges(): Promise<EmployeeCharge[]> {
  const { data, error } = await supabase.from('employee_charges').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[supabase] fetchEmployeeCharges:', error.message); return []; }
  return (data ?? []).map(r => ({
    id: r.id, date: r.date, employeeId: r.employee_id, chargeType: r.charge_type,
    amount: r.amount, paymentMethod: r.payment_method, description: r.description,
    note: r.note, createdBy: r.created_by, createdAt: r.created_at,
  }));
}

// ── FOOD COSTS ────────────────────────────────────────────────────────────────

export async function upsertFoodCost(e: FoodCostEntry) {
  const { error } = await supabase.from('food_cost_entries').upsert({
    id: e.id, date: e.date, animal_id: e.animalId, food_item: e.foodItem,
    quantity: e.quantity, unit: e.unit, unit_cost: e.unitCost, total_cost: e.totalCost,
    payment_method: e.paymentMethod, note: e.note ?? null,
    created_by: e.createdBy, created_at: e.createdAt,
  }, { onConflict: 'id' });
  if (error) console.error('[supabase] upsertFoodCost:', error.message);
}

export async function deleteFoodCost(id: string) {
  const { error } = await supabase.from('food_cost_entries').delete().eq('id', id);
  if (error) console.error('[supabase] deleteFoodCost:', error.message);
}

export async function fetchFoodCosts(): Promise<FoodCostEntry[]> {
  const { data, error } = await supabase.from('food_cost_entries').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[supabase] fetchFoodCosts:', error.message); return []; }
  return (data ?? []).map(r => ({
    id: r.id, date: r.date, animalId: r.animal_id, foodItem: r.food_item,
    quantity: r.quantity, unit: r.unit, unitCost: r.unit_cost, totalCost: r.total_cost,
    paymentMethod: r.payment_method, note: r.note,
    createdBy: r.created_by, createdAt: r.created_at,
  }));
}

// ── JOURNAL ENTRIES ───────────────────────────────────────────────────────────

export async function upsertJournalEntry(e: JournalEntry) {
  const { error } = await supabase.from('journal_entries').upsert({
    id: e.id, date: e.date, type: e.type, field: e.field,
    amount: e.amount, description: e.description,
    created_by: e.createdBy, created_at: e.createdAt,
  }, { onConflict: 'id' });
  if (error) console.error('[supabase] upsertJournalEntry:', error.message);
}

export async function deleteJournalEntry(id: string) {
  const { error } = await supabase.from('journal_entries').delete().eq('id', id);
  if (error) console.error('[supabase] deleteJournalEntry:', error.message);
}

export async function fetchJournalEntries(): Promise<JournalEntry[]> {
  const { data, error } = await supabase.from('journal_entries').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[supabase] fetchJournalEntries:', error.message); return []; }
  return (data ?? []).map(r => ({
    id: r.id, date: r.date, type: r.type, field: r.field,
    amount: r.amount, description: r.description,
    createdBy: r.created_by, createdAt: r.created_at,
  }));
}
