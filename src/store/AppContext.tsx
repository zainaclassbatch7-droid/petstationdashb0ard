import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import React from 'react';
import { supabase } from '@/lib/supabase';
import type {
  User, Role, Section, TicketItem, PaymentMethod, Ledger, RevenueEntry,
  ExpenseEntry, Employee, EmployeeCharge, Animal, FoodCostEntry, CashFlow, AppSettings,
  CustomerRecord, WhatsAppTemplate, StaffMember, AttendanceRecord, AddOnEntry, JournalEntry,
} from '@/types';
import {
  upsertRevenue, deleteRevenue, fetchRevenue, recycleInvoiceNo,
  upsertExpense, deleteExpense, fetchExpenses,
  upsertCustomer, deleteCustomer, fetchCustomers,
  upsertAddonEntry, deleteAddonEntry, fetchAddonEntries,
  upsertAttendance, deleteAttendance, fetchAttendance,
  upsertEmployeeCharge, deleteEmployeeCharge, fetchEmployeeCharges,
  upsertFoodCost, deleteFoodCost, fetchFoodCosts,
  upsertJournalEntry, deleteJournalEntry, fetchJournalEntries,
  saveSettings, fetchSettings,
  saveUsers, fetchUsers,
  saveStaff, fetchStaff,
  saveEmployees, fetchEmployees,
  saveLedgers, fetchLedgers,
  saveTicketItems, fetchTicketItems,
  saveWhatsAppTemplates, fetchWhatsAppTemplates,
  saveCashFlows, fetchCashFlows,
} from '@/lib/dbSync';

// ── DEFAULT DATA ──────────────────────────────────────────────────────────────

const ALL_SECTIONS: Section[] = [
  'billing','expenses','reports','ledgers','journal','settings','qr_codes','marketing','customers','whatsapp','attendance','add_ons','approvals','user_management'
];

const SUPERADMIN_SECTIONS: Section[] = ALL_SECTIONS;
const ACCOUNTANT_SECTIONS: Section[] = ['expenses','reports','ledgers','journal'];
const EMPLOYEE_SECTIONS: Section[] = ['billing','add_ons'];
const MARKETING_SECTIONS: Section[] = ['qr_codes','marketing','customers','whatsapp'];
const MANAGER_SECTIONS: Section[] = ['attendance','approvals'];

const defaultUsers: User[] = [
  { id: 'sa1', name: 'Admin One', username: 'admin1', password: 'petstation1@A', role: 'superadmin', avatar: 'A', permissions: SUPERADMIN_SECTIONS, active: true },
  { id: 'sa2', name: 'Admin Two', username: 'admin2', password: 'petstation1@A', role: 'superadmin', avatar: 'B', permissions: SUPERADMIN_SECTIONS, active: true },
  { id: 'acc1', name: 'Accountant', username: 'accountant', password: 'petstation2026', role: 'accountant', avatar: 'C', permissions: ACCOUNTANT_SECTIONS, active: true },
  { id: 'emp1', name: 'Employee One', username: 'employee1', password: 'petstation2026', role: 'employee', avatar: 'E', permissions: EMPLOYEE_SECTIONS, active: true },
  { id: 'emp2', name: 'Employee Two', username: 'employee2', password: 'petstation2026', role: 'employee', avatar: 'F', permissions: EMPLOYEE_SECTIONS, active: true },
  { id: 'mkt1', name: 'Marketing', username: 'marketing', password: 'petstation2026', role: 'marketing', avatar: 'M', permissions: MARKETING_SECTIONS, active: true },
  { id: 'mgr1', name: 'Mizhar Ali', username: 'manager', password: 'petstation2026', role: 'manager', avatar: 'Z', permissions: MANAGER_SECTIONS, active: true },
];

const defaultTicketItems: TicketItem[] = [
  { id: 'entry-only', name: 'Entry Only', price: 150, category: 'entry' },
  { id: 'combo-entry', name: 'Combo Entry', price: 200, category: 'combo' },
  { id: 'fish-feed', name: 'Fish Feed', price: 30, category: 'addon' },
  { id: 'horse-ride', name: 'Horse Ride', price: 100, category: 'addon' },
  { id: 'macaw', name: 'Macaw', price: 50, category: 'addon' },
  { id: 'sun-conure', name: 'Sun Conure', price: 50, category: 'addon' },
  { id: 'snake', name: 'Snake', price: 50, category: 'addon' },
  { id: 'grey-parrot', name: 'Grey Parrot', price: 50, category: 'addon' },
  { id: 'iguana', name: 'Iguana', price: 50, category: 'addon' },
  { id: 'sugar-glider', name: 'Sugar Glider', price: 50, category: 'addon' },
  { id: 'arapima', name: 'Arapima', price: 0, category: 'addon' },
];

const defaultPaymentMethods: PaymentMethod[] = [
  { id: 'cash', name: 'Cash' },
  { id: 'upi', name: 'UPI' },
  { id: 'upi-qr', name: 'UPI QR' },
  { id: 'card', name: 'Card Swipe', autoLink: true },
];

const defaultLedgers: Ledger[] = [
  { id: 'ducklings', name: 'Ducklings', category: 'expense', subledgers: [] },
  { id: 'pet-purchase', name: 'Pet Purchase', category: 'expense', subledgers: [{ id: 'aquatic', name: 'Aquatic' }, { id: 'birds', name: 'Birds' }, { id: 'reptiles', name: 'Reptiles' }] },
  { id: 'food', name: 'Food', category: 'expense', subledgers: [{ id: 'dog', name: 'Dog' }, { id: 'birds-food', name: 'Birds' }, { id: 'horse', name: 'Horse' }] },
  { id: 'salary', name: 'Salary', category: 'expense', subledgers: [{ id: 'dog-staff', name: 'Dog' }, { id: 'birds-staff', name: 'Birds' }, { id: 'horse-staff', name: 'Horse' }] },
  { id: 'others', name: 'Others', category: 'expense', subledgers: [] },
];

const defaultEmployees: Employee[] = [
  { id: 'emp-1', name: 'Ravi Kumar', role: 'Animal Keeper', baseSalary: 12000 },
  { id: 'emp-2', name: 'Suresh Babu', role: 'Horse Handler', baseSalary: 10000 },
  { id: 'emp-3', name: 'Priya Devi', role: 'Cashier', baseSalary: 11000 },
  { id: 'emp-4', name: 'Mohan Das', role: 'Cleaner', baseSalary: 8000 },
];

const defaultAnimals: Animal[] = [
  { id: 'ani-1', name: 'Tommy', species: 'Dog', section: 'Pets' },
  { id: 'ani-2', name: 'Polly', species: 'Macaw', section: 'Birds' },
  { id: 'ani-3', name: 'Sunny', species: 'Sun Conure', section: 'Birds' },
  { id: 'ani-4', name: 'Rex', species: 'Horse', section: 'Rides' },
  { id: 'ani-5', name: 'Slimy', species: 'Snake', section: 'Reptiles' },
];

const defaultStaff: StaffMember[] = [
  { id: 'st-1',  name: 'Shiji',         type: 'ext',       joinDate: '2024-01-01', active: true },
  { id: 'st-2',  name: 'Shoba',         type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-3',  name: 'Permila',       type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-4',  name: 'Thagam',        type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-5',  name: 'Lurdh Mariyam', type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-6',  name: 'Munzir',        type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-7',  name: 'Safwan',        type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-8',  name: 'Mishab',        type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-9',  name: 'Khalid',        type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-10', name: 'Shanal Jose',   type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-11', name: 'Jusna',         type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-12', name: 'Shafeek',       type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-13', name: 'Augustine',     type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-14', name: 'Elyas',         type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-15', name: 'Asif',          type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-16', name: 'Rex',           type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-17', name: 'Ajas',          type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-18', name: 'Hari',          type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-19', name: 'Shaheer',       type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-20', name: 'Marwan',        type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-21', name: 'Mashood',       type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-22', name: 'Fayiz',         type: 'permanent', joinDate: '2024-01-01', active: true },
  { id: 'st-23', name: 'Shibil',        type: 'permanent', joinDate: '2024-01-01', active: true },
];
const defaultSettings: AppSettings = {
  openingBalance: 0,
  adminPassword: 'petstation2026',
  enableOTP: false,
  whatsappNumber: '',
  autoReportTime: '22:00',
  backendUrl: 'http://localhost:3000',
  businessName: 'PetStation',
  businessAddress: 'Mattool Central, Kannur',
  businessPhone: '9746955534',
  businessGST: '32BWGPS0178G1ZJ',
  taxPercent: 18,
};

// ── LOCAL STORAGE PENDING QUEUE ─────────────────────────────────────────────
const LS_KEY = 'petstation_pending_entries';

function lsSavePending(entries: RevenueEntry[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(entries)); } catch { /* quota */ }
}

function lsLoadPending(): RevenueEntry[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function lsRemovePending(id: string) {
  try {
    const list = lsLoadPending().filter(e => e.id !== id);
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch { /* quota */ }
}

// ── STATE ─────────────────────────────────────────────────────────────────────

interface AppState {
  currentUser: User | null;
  users: User[];
  ticketItems: TicketItem[];
  paymentMethods: PaymentMethod[];
  ledgers: Ledger[];
  revenueEntries: RevenueEntry[];
  expenseEntries: ExpenseEntry[];
  employeeCharges: EmployeeCharge[];
  foodCostEntries: FoodCostEntry[];
  employees: Employee[];
  animals: Animal[];
  cashFlows: CashFlow[];
  settings: AppSettings;
  staff: StaffMember[];
  attendanceRecords: AttendanceRecord[];
  addOnEntries: AddOnEntry[];
  customers: CustomerRecord[];
  whatsappTemplates: WhatsAppTemplate[];
  journalEntries: JournalEntry[];
  pendingSync: string[];
}

const initialState: AppState = {
  currentUser: null,
  users: defaultUsers,
  ticketItems: defaultTicketItems,
  paymentMethods: defaultPaymentMethods,
  ledgers: defaultLedgers,
  revenueEntries: [],
  expenseEntries: [],
  employeeCharges: [],
  foodCostEntries: [],
  employees: defaultEmployees,
  animals: defaultAnimals,
  cashFlows: [],
  settings: defaultSettings,
  staff: defaultStaff,
  attendanceRecords: [],
  addOnEntries: [],
  customers: [],
  whatsappTemplates: [],
  journalEntries: [],
  pendingSync: [],
};

// ── ACTIONS ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER_PERMISSIONS'; payload: { userId: string; permissions: Section[] } }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'TOGGLE_USER'; payload: string }
  | { type: 'DELETE_USER'; payload: string }
  | { type: 'ADD_REVENUE'; payload: RevenueEntry }
  | { type: 'DELETE_REVENUE'; payload: string }
  | { type: 'REQUEST_DELETE_REVENUE'; payload: { id: string; requestedBy?: string } }
  | { type: 'APPROVE_DELETE_REVENUE'; payload: string }
  | { type: 'REJECT_DELETE_REVENUE'; payload: { id: string; reason?: string } }
  | { type: 'MARK_SYNCED'; payload: string[] }
  | { type: 'ADD_EXPENSE'; payload: ExpenseEntry }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'UPDATE_EXPENSE_DESCRIPTION'; payload: { id: string; description: string } }
  | { type: 'ADD_EMPLOYEE_CHARGE'; payload: EmployeeCharge }
  | { type: 'DELETE_EMPLOYEE_CHARGE'; payload: string }
  | { type: 'ADD_FOOD_COST'; payload: FoodCostEntry }
  | { type: 'DELETE_FOOD_COST'; payload: string }
  | { type: 'ADD_EMPLOYEE'; payload: Employee }
  | { type: 'UPDATE_EMPLOYEE'; payload: Employee }
  | { type: 'DELETE_EMPLOYEE'; payload: string }
  | { type: 'ADD_TICKET_ITEM'; payload: TicketItem }
  | { type: 'UPDATE_TICKET_ITEM'; payload: TicketItem }
  | { type: 'DELETE_TICKET_ITEM'; payload: string }
  | { type: 'ADD_LEDGER'; payload: Ledger }
  | { type: 'UPDATE_LEDGER'; payload: Ledger }
  | { type: 'DELETE_LEDGER'; payload: string }
  | { type: 'REQUEST_DELETE_LEDGER'; payload: { id: string; requestedBy?: string } }
  | { type: 'APPROVE_DELETE_LEDGER'; payload: string }
  | { type: 'REJECT_DELETE_LEDGER'; payload: string }
  | { type: 'SET_OPENING_BALANCE'; payload: { date: string; amount: number } }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'UPSERT_CUSTOMER'; payload: CustomerRecord }
  | { type: 'DELETE_CUSTOMER'; payload: string }
  | { type: 'ADD_WA_TEMPLATE'; payload: WhatsAppTemplate }
  | { type: 'UPDATE_WA_TEMPLATE'; payload: WhatsAppTemplate }
  | { type: 'DELETE_WA_TEMPLATE'; payload: string }
  | { type: 'ADD_STAFF'; payload: StaffMember }
  | { type: 'UPDATE_STAFF'; payload: StaffMember }
  | { type: 'REMOVE_STAFF'; payload: { id: string; exitDate: string } }
  | { type: 'SAVE_ATTENDANCE'; payload: AttendanceRecord }
  | { type: 'DELETE_ATTENDANCE'; payload: string }
  | { type: 'UPSERT_ADDON_ENTRY'; payload: AddOnEntry }
  | { type: 'DELETE_ADDON_ENTRY'; payload: string }
  | { type: 'LOAD_REVENUE'; payload: RevenueEntry[] }
  | { type: 'LOAD_EXPENSES'; payload: ExpenseEntry[] }
  | { type: 'LOAD_CUSTOMERS'; payload: CustomerRecord[] }
  | { type: 'LOAD_ADDONS'; payload: AddOnEntry[] }
  | { type: 'LOAD_ATTENDANCE'; payload: AttendanceRecord[] }
  | { type: 'LOAD_EMPLOYEE_CHARGES'; payload: EmployeeCharge[] }
  | { type: 'LOAD_FOOD_COSTS'; payload: FoodCostEntry[] }
  | { type: 'LOAD_CONFIG'; payload: Partial<AppState> }
  | { type: 'SYNC_ALL_REVENUE' }
  | { type: 'RT_UPSERT_REVENUE'; payload: RevenueEntry }
  | { type: 'RT_DELETE_REVENUE'; payload: string }
  | { type: 'RT_UPSERT_EXPENSE'; payload: ExpenseEntry }
  | { type: 'RT_DELETE_EXPENSE'; payload: string }
  | { type: 'RT_UPSERT_CUSTOMER'; payload: CustomerRecord }
  | { type: 'RT_DELETE_CUSTOMER'; payload: string }
  | { type: 'RT_UPSERT_ADDON'; payload: AddOnEntry }
  | { type: 'RT_DELETE_ADDON'; payload: string }
  | { type: 'ADD_JOURNAL_ENTRY'; payload: JournalEntry }
  | { type: 'DELETE_JOURNAL_ENTRY'; payload: string };

function reducer(state: AppState, action: Action): AppState {
  let next: AppState;
  switch (action.type) {
    case 'LOGIN': return { ...state, currentUser: action.payload };
    case 'LOGOUT': return { ...state, currentUser: null };
    case 'UPDATE_USER_PERMISSIONS':
      next = { ...state, users: state.users.map(u => u.id === action.payload.userId ? { ...u, permissions: action.payload.permissions } : u) };
      saveUsers(next.users); break;
    case 'ADD_USER':
      next = { ...state, users: [...state.users, action.payload] };
      saveUsers(next.users); break;
    case 'UPDATE_USER':
      next = { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) };
      saveUsers(next.users); break;
    case 'TOGGLE_USER':
      next = { ...state, users: state.users.map(u => u.id === action.payload ? { ...u, active: !u.active } : u) };
      saveUsers(next.users); break;
    case 'DELETE_USER':
      next = { ...state, users: state.users.filter(u => u.id !== action.payload) };
      saveUsers(next.users); break;
    case 'ADD_REVENUE':
      next = { ...state, revenueEntries: [...state.revenueEntries, action.payload], pendingSync: [...state.pendingSync, action.payload.id] };
      lsSavePending([...state.revenueEntries.filter(e => !e.synced), action.payload]);
      break;
    case 'DELETE_REVENUE':
      next = { ...state, revenueEntries: state.revenueEntries.filter(e => e.id !== action.payload) };
      deleteRevenue(action.payload);
      break;
    case 'REQUEST_DELETE_REVENUE': {
      const { id, requestedBy } = action.payload;
      next = { ...state, revenueEntries: state.revenueEntries.map(e => e.id === id ? { ...e, deletionApproval: { status: 'pending', requestedBy, requestedAt: new Date().toISOString() } } : e) };
      upsertRevenue(next.revenueEntries.find(e => e.id === id)!);
      break;
    }
    case 'APPROVE_DELETE_REVENUE': {
      const id = action.payload as string;
      const toDelete = state.revenueEntries.find(e => e.id === id);
      next = { ...state, revenueEntries: state.revenueEntries.filter(e => e.id !== id), pendingSync: state.pendingSync.filter(pid => pid !== id) };
      deleteRevenue(id);
      if (toDelete?.invoiceNo) recycleInvoiceNo(toDelete.invoiceNo);
      break;
    }
    case 'REJECT_DELETE_REVENUE': {
      const { id } = action.payload as { id: string; reason?: string };
      next = { ...state, revenueEntries: state.revenueEntries.map(e => e.id === id ? { ...e, deletionApproval: { ...e.deletionApproval!, status: 'rejected' } } : e) };
      upsertRevenue(next.revenueEntries.find(e => e.id === id)!);
      break;
    }
    case 'MARK_SYNCED':
      next = { ...state, pendingSync: state.pendingSync.filter(id => !action.payload.includes(id)), revenueEntries: state.revenueEntries.map(e => action.payload.includes(e.id) ? { ...e, synced: true } : e) };
      action.payload.forEach(lsRemovePending);
      break;
    case 'ADD_EXPENSE': next = { ...state, expenseEntries: [...state.expenseEntries, action.payload] }; upsertExpense(action.payload); break;
    case 'DELETE_EXPENSE': {
      next = { ...state, expenseEntries: state.expenseEntries.filter(e => e.id !== action.payload) };
      deleteExpense(action.payload);
      // If this was a journal-linked expense, also delete the journal entry
      if (action.payload.startsWith('exp-jnl-')) {
        const jnlId = action.payload.replace('exp-jnl-', 'jnl-');
        next = { ...next, journalEntries: next.journalEntries.filter(e => e.id !== jnlId) };
        deleteJournalEntry(jnlId);
      }
      break;
    }
    case 'UPDATE_EXPENSE_DESCRIPTION': {
      const updated = state.expenseEntries.map(e => e.id === action.payload.id ? { ...e, description: action.payload.description } : e);
      next = { ...state, expenseEntries: updated };
      const entry = updated.find(e => e.id === action.payload.id);
      if (entry) upsertExpense(entry);
      break;
    }
    case 'ADD_EMPLOYEE_CHARGE':
      next = { ...state, employeeCharges: [...state.employeeCharges, action.payload] };
      upsertEmployeeCharge(action.payload); break;
    case 'DELETE_EMPLOYEE_CHARGE':
      next = { ...state, employeeCharges: state.employeeCharges.filter(e => e.id !== action.payload) };
      deleteEmployeeCharge(action.payload); break;
    case 'ADD_FOOD_COST':
      next = { ...state, foodCostEntries: [...state.foodCostEntries, action.payload] };
      upsertFoodCost(action.payload); break;
    case 'DELETE_FOOD_COST':
      next = { ...state, foodCostEntries: state.foodCostEntries.filter(e => e.id !== action.payload) };
      deleteFoodCost(action.payload); break;
    case 'ADD_EMPLOYEE':
      next = { ...state, employees: [...state.employees, action.payload] };
      saveEmployees([...state.employees, action.payload]); break;
    case 'UPDATE_EMPLOYEE':
      next = { ...state, employees: state.employees.map(e => e.id === action.payload.id ? action.payload : e) };
      saveEmployees(next.employees); break;
    case 'DELETE_EMPLOYEE':
      next = { ...state, employees: state.employees.filter(e => e.id !== action.payload) };
      saveEmployees(next.employees); break;
    case 'ADD_TICKET_ITEM':
      next = { ...state, ticketItems: [...state.ticketItems, action.payload] };
      saveTicketItems(next.ticketItems); break;
    case 'UPDATE_TICKET_ITEM':
      next = { ...state, ticketItems: state.ticketItems.map(t => t.id === action.payload.id ? action.payload : t) };
      saveTicketItems(next.ticketItems); break;
    case 'DELETE_TICKET_ITEM':
      next = { ...state, ticketItems: state.ticketItems.filter(t => t.id !== action.payload) };
      saveTicketItems(next.ticketItems); break;
    case 'ADD_LEDGER':
      next = { ...state, ledgers: [...state.ledgers, action.payload] };
      saveLedgers(next.ledgers); break;
    case 'UPDATE_LEDGER':
      next = { ...state, ledgers: state.ledgers.map(l => l.id === action.payload.id ? action.payload : l) };
      saveLedgers(next.ledgers); break;
    case 'DELETE_LEDGER':
      next = { ...state, ledgers: state.ledgers.filter(l => l.id !== action.payload) };
      saveLedgers(next.ledgers); break;
    case 'REQUEST_DELETE_LEDGER': {
      next = { ...state, ledgers: state.ledgers.map(l => l.id === action.payload.id ? { ...l, deletionApproval: { status: 'pending', requestedBy: action.payload.requestedBy, requestedAt: new Date().toISOString() } } : l) };
      saveLedgers(next.ledgers); break;
    }
    case 'APPROVE_DELETE_LEDGER':
      next = { ...state, ledgers: state.ledgers.filter(l => l.id !== action.payload) };
      saveLedgers(next.ledgers); break;
    case 'REJECT_DELETE_LEDGER':
      next = { ...state, ledgers: state.ledgers.map(l => l.id === action.payload ? { ...l, deletionApproval: { ...l.deletionApproval!, status: 'rejected' } } : l) };
      saveLedgers(next.ledgers); break;
    case 'SET_OPENING_BALANCE': {
      const ex = state.cashFlows.find(c => c.date === action.payload.date);
      next = ex
        ? { ...state, cashFlows: state.cashFlows.map(c => c.date === action.payload.date ? { ...c, openingBalance: action.payload.amount } : c) }
        : { ...state, cashFlows: [...state.cashFlows, { date: action.payload.date, openingBalance: action.payload.amount, closingBalance: 0 }] };
      saveCashFlows(next.cashFlows); break;
    }
    case 'UPDATE_SETTINGS':
      next = { ...state, settings: { ...state.settings, ...action.payload } };
      saveSettings(next.settings); break;
    case 'UPSERT_CUSTOMER': {
      const exists = state.customers.find(c => c.id === action.payload.id);
      next = exists
        ? { ...state, customers: state.customers.map(c => c.id === action.payload.id ? action.payload : c) }
        : { ...state, customers: [...state.customers, action.payload] };
      upsertCustomer(action.payload);
      break;
    }
    case 'DELETE_CUSTOMER': next = { ...state, customers: state.customers.filter(c => c.id !== action.payload) }; deleteCustomer(action.payload); break;
    case 'ADD_WA_TEMPLATE':
      next = { ...state, whatsappTemplates: [...state.whatsappTemplates, action.payload] };
      saveWhatsAppTemplates(next.whatsappTemplates); break;
    case 'UPDATE_WA_TEMPLATE':
      next = { ...state, whatsappTemplates: state.whatsappTemplates.map(t => t.id === action.payload.id ? action.payload : t) };
      saveWhatsAppTemplates(next.whatsappTemplates); break;
    case 'DELETE_WA_TEMPLATE':
      next = { ...state, whatsappTemplates: state.whatsappTemplates.filter(t => t.id !== action.payload) };
      saveWhatsAppTemplates(next.whatsappTemplates); break;
    case 'ADD_STAFF':
      next = { ...state, staff: [...state.staff, action.payload] };
      saveStaff(next.staff); break;
    case 'UPDATE_STAFF':
      next = { ...state, staff: state.staff.map(s => s.id === action.payload.id ? action.payload : s) };
      saveStaff(next.staff); break;
    case 'REMOVE_STAFF':
      next = { ...state, staff: state.staff.map(s => s.id === action.payload.id ? { ...s, active: false, exitDate: action.payload.exitDate } : s) };
      saveStaff(next.staff); break;
    case 'SAVE_ATTENDANCE': {
      const exists = state.attendanceRecords.find(r => r.id === action.payload.id);
      next = exists
        ? { ...state, attendanceRecords: state.attendanceRecords.map(r => r.id === action.payload.id ? action.payload : r) }
        : { ...state, attendanceRecords: [...state.attendanceRecords, action.payload] };
      upsertAttendance(action.payload); break;
    }
    case 'DELETE_ATTENDANCE':
      next = { ...state, attendanceRecords: state.attendanceRecords.filter(r => r.id !== action.payload) };
      deleteAttendance(action.payload); break;
    case 'UPSERT_ADDON_ENTRY': {
      const exists = state.addOnEntries.find(entry => entry.id === action.payload.id);
      next = exists
        ? { ...state, addOnEntries: state.addOnEntries.map(entry => entry.id === action.payload.id ? action.payload : entry) }
        : { ...state, addOnEntries: [...state.addOnEntries, action.payload] };
      upsertAddonEntry(action.payload);
      break;
    }
    case 'DELETE_ADDON_ENTRY': next = { ...state, addOnEntries: state.addOnEntries.filter(entry => entry.id !== action.payload) }; deleteAddonEntry(action.payload); break;
    case 'LOAD_REVENUE': {
      // Merge: keep any local entries not yet in DB, replace rest with DB version
      const dbIds = new Set(action.payload.map((e: RevenueEntry) => e.id));
      const localOnly = state.revenueEntries.filter(e => !dbIds.has(e.id));
      next = { ...state, revenueEntries: [...action.payload, ...localOnly] }; break;
    }
    case 'LOAD_EXPENSES': next = { ...state, expenseEntries: action.payload }; break;
    case 'LOAD_CUSTOMERS': next = { ...state, customers: action.payload }; break;
    case 'LOAD_ADDONS': next = { ...state, addOnEntries: action.payload }; break;
    case 'LOAD_ATTENDANCE': next = { ...state, attendanceRecords: action.payload }; break;
    case 'LOAD_EMPLOYEE_CHARGES': next = { ...state, employeeCharges: action.payload }; break;
    case 'LOAD_FOOD_COSTS': next = { ...state, foodCostEntries: action.payload }; break;
    case 'LOAD_CONFIG': next = { ...state, ...action.payload }; break;
    case 'SYNC_ALL_REVENUE':
      // Fire upserts but do NOT mark synced here — syncWithRetry will handle MARK_SYNCED on success
      next = { ...state };
      break;
    case 'RT_UPSERT_REVENUE': {
      // Always upsert by id — replace if exists (mark synced), or add if new from another device
      const exists = state.revenueEntries.find(e => e.id === action.payload.id);
      return { ...state, revenueEntries: exists
        ? state.revenueEntries.map(e => e.id === action.payload.id ? { ...action.payload, synced: true } : e)
        : [action.payload, ...state.revenueEntries] };
    }
    case 'RT_DELETE_REVENUE':
      return { ...state, revenueEntries: state.revenueEntries.filter(e => e.id !== action.payload) };
    case 'RT_UPSERT_EXPENSE': {
      const exists = state.expenseEntries.find(e => e.id === action.payload.id);
      return { ...state, expenseEntries: exists
        ? state.expenseEntries.map(e => e.id === action.payload.id ? action.payload : e)
        : [action.payload, ...state.expenseEntries] };
    }
    case 'RT_DELETE_EXPENSE':
      return { ...state, expenseEntries: state.expenseEntries.filter(e => e.id !== action.payload) };
    case 'RT_UPSERT_CUSTOMER': {
      const exists = state.customers.find(c => c.id === action.payload.id);
      return { ...state, customers: exists
        ? state.customers.map(c => c.id === action.payload.id ? action.payload : c)
        : [action.payload, ...state.customers] };
    }
    case 'RT_DELETE_CUSTOMER':
      return { ...state, customers: state.customers.filter(c => c.id !== action.payload) };
    case 'RT_UPSERT_ADDON': {
      const exists = state.addOnEntries.find(e => e.id === action.payload.id);
      return { ...state, addOnEntries: exists
        ? state.addOnEntries.map(e => e.id === action.payload.id ? action.payload : e)
        : [action.payload, ...state.addOnEntries] };
    }
    case 'RT_DELETE_ADDON':
      return { ...state, addOnEntries: state.addOnEntries.filter(e => e.id !== action.payload) };
    case 'ADD_JOURNAL_ENTRY':
      next = { ...state, journalEntries: [...state.journalEntries, action.payload] };
      upsertJournalEntry(action.payload); break;
    case 'DELETE_JOURNAL_ENTRY':
      next = { ...state, journalEntries: state.journalEntries.filter(e => e.id !== action.payload) };
      deleteJournalEntry(action.payload); break;
    default: return state;
  }
  return next;
}

// ── CONTEXT ───────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  can: (section: Section) => boolean;
  isSuperAdmin: () => boolean;
  isManager: () => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = React.useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Tracks entries currently being retried to avoid duplicate retry loops
  const syncingIds = useRef<Set<string>>(new Set());

  // Auto-sync a single entry with exponential backoff retries — stable ref, no stale closure
  const syncWithRetryRef = useRef<(entry: RevenueEntry, attempt?: number) => void>(null!);
  syncWithRetryRef.current = (entry: RevenueEntry, attempt = 0) => {
    if (syncingIds.current.has(entry.id) && attempt === 0) return; // already retrying
    syncingIds.current.add(entry.id);
    upsertRevenue(entry).then(() => {
      syncingIds.current.delete(entry.id);
      dispatch({ type: 'MARK_SYNCED', payload: [entry.id] });
    }).catch(() => {
      const delay = Math.min(2000 * 2 ** attempt, 60000);
      setTimeout(() => {
        const current = stateRef.current.revenueEntries.find(e => e.id === entry.id);
        if (current && !current.synced) {
          syncWithRetryRef.current(current, attempt + 1);
        } else {
          syncingIds.current.delete(entry.id);
        }
      }, delay);
    });
  };

  // Trigger sync whenever a new entry is added to pendingSync
  const prevPendingRef = useRef<string[]>([]);
  useEffect(() => {
    const newIds = state.pendingSync.filter(id => !prevPendingRef.current.includes(id));
    newIds.forEach(id => {
      const entry = state.revenueEntries.find(e => e.id === id);
      if (entry && !entry.synced) syncWithRetryRef.current(entry);
    });
    prevPendingRef.current = state.pendingSync;
  }, [state.pendingSync]);

  // When coming back online, retry all still-pending entries
  useEffect(() => {
    const retry = () => {
      if (!navigator.onLine) return;
      stateRef.current.revenueEntries
        .filter(e => !e.synced && !e.deletionApproval)
        .forEach(e => syncWithRetryRef.current(e, 0));
    };
    window.addEventListener('online', retry);
    const interval = setInterval(retry, 60000);
    return () => {
      window.removeEventListener('online', retry);
      clearInterval(interval);
    };
  }, []);

  // ── Load everything from Supabase on startup ───────────────────────────────
  useEffect(() => {
    // Restore any unsynced entries saved to localStorage (survives tab close / refresh)
    const lsPending = lsLoadPending();
    if (lsPending.length) {
      lsPending.forEach(e => dispatch({ type: 'ADD_REVENUE', payload: e }));
    }

    // Run all fetches independently so one failure doesn't block others
    fetchRevenue().then(revenue => {
      if (revenue.length) dispatch({ type: 'LOAD_REVENUE', payload: revenue });
      // Wait for state to flush, then retry any still-unsynced local entries
      setTimeout(() => {
        stateRef.current.revenueEntries
          .filter(e => !e.synced && !e.deletionApproval)
          .forEach(e => syncWithRetryRef.current(e, 0));
      }, 1000);
    }).catch(() => {
      // If initial fetch fails, retry unsynced entries anyway
      setTimeout(() => {
        stateRef.current.revenueEntries
          .filter(e => !e.synced && !e.deletionApproval)
          .forEach(e => syncWithRetryRef.current(e, 0));
      }, 3000);
    });
    fetchExpenses().then(expenses => { if (expenses.length) dispatch({ type: 'LOAD_EXPENSES', payload: expenses }); });
    fetchCustomers().then(customers => { if (customers.length) dispatch({ type: 'LOAD_CUSTOMERS', payload: customers }); });
    fetchAddonEntries().then(addons => { if (addons.length) dispatch({ type: 'LOAD_ADDONS', payload: addons }); });
    fetchAttendance().then(attendance => { if (attendance.length) dispatch({ type: 'LOAD_ATTENDANCE', payload: attendance }); });
    fetchEmployeeCharges().then(empCharges => { if (empCharges.length) dispatch({ type: 'LOAD_EMPLOYEE_CHARGES', payload: empCharges }); });
    fetchFoodCosts().then(foodCosts => { if (foodCosts.length) dispatch({ type: 'LOAD_FOOD_COSTS', payload: foodCosts }); });
    fetchJournalEntries().then(journals => { if (journals.length) dispatch({ type: 'LOAD_CONFIG', payload: { journalEntries: journals } }); });
    Promise.all([
      fetchSettings(), fetchUsers(), fetchStaff(), fetchEmployees(),
      fetchLedgers(), fetchTicketItems(), fetchWhatsAppTemplates(), fetchCashFlows(),
    ]).then(([settings, users, staff, employees, ledgers, ticketItems, waTemplates, cashFlows]) => {
      const config: Partial<AppState> = {};
      if (settings)            config.settings = { ...defaultSettings, ...settings };
      if (users?.length)       config.users = users;
      if (staff?.length)       config.staff = staff;
      if (employees?.length)   config.employees = employees;
      if (ledgers?.length)     config.ledgers = ledgers;
      if (ticketItems?.length) config.ticketItems = ticketItems;
      if (waTemplates?.length) config.whatsappTemplates = waTemplates;
      if (cashFlows?.length)   config.cashFlows = cashFlows;
      if (Object.keys(config).length) dispatch({ type: 'LOAD_CONFIG', payload: config });
    }).catch(e => console.error('[supabase] config fetch error:', e));

    const mapRevenue = (r: any): RevenueEntry => ({
      id: r.id, date: r.date, items: r.items,
      paymentMethod: r.payment_method, totalAmount: r.total_amount,
      createdBy: r.created_by, createdAt: r.created_at,
      synced: true, deletionApproval: r.deletion_approval,
      invoiceNo: r.invoice_no ?? undefined,
    });
    const mapExpense = (r: any): ExpenseEntry => ({
      id: r.id, date: r.date, ledgerId: r.ledger_id,
      subledgerId: r.subledger_id, amount: r.amount,
      paymentMethod: r.payment_method, description: r.description,
      note: r.note, createdBy: r.created_by, createdAt: r.created_at,
    });
    const mapCustomer = (r: any): CustomerRecord => ({
      id: r.id, name: r.name, phone: r.phone,
      visitCount: r.visit_count, totalSpent: r.total_spent,
      lastVisit: r.last_visit, createdAt: r.created_at,
    });
    const mapAddon = (r: any): AddOnEntry => ({
      id: r.id, date: r.date, staffId: r.staff_id,
      ticketItemId: r.ticket_item_id, ticketItemName: r.ticket_item_name,
      count: r.count, paymentMethod: r.payment_method,
      submittedByUserId: r.submitted_by_user_id, submittedByName: r.submitted_by_name,
      note: r.note, createdAt: r.created_at,
    });

    const channel = supabase
      .channel('realtime-all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'revenue_entries' }, ({ new: n }) => {
        dispatch({ type: 'RT_UPSERT_REVENUE', payload: mapRevenue(n) });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'revenue_entries' }, ({ new: n }) => {
        dispatch({ type: 'RT_UPSERT_REVENUE', payload: mapRevenue(n) });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'revenue_entries' }, ({ old }) => {
        dispatch({ type: 'RT_DELETE_REVENUE', payload: (old as any).id });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_entries' }, ({ eventType, new: n, old }) => {
        if (eventType === 'DELETE') dispatch({ type: 'RT_DELETE_EXPENSE', payload: (old as any).id });
        else dispatch({ type: 'RT_UPSERT_EXPENSE', payload: mapExpense(n) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, ({ eventType, new: n, old }) => {
        if (eventType === 'DELETE') dispatch({ type: 'RT_DELETE_CUSTOMER', payload: (old as any).id });
        else dispatch({ type: 'RT_UPSERT_CUSTOMER', payload: mapCustomer(n) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'addon_entries' }, ({ eventType, new: n, old }) => {
        if (eventType === 'DELETE') dispatch({ type: 'RT_DELETE_ADDON', payload: (old as any).id });
        else dispatch({ type: 'RT_UPSERT_ADDON', payload: mapAddon(n) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, ({ eventType, new: n, old }) => {
        if (eventType === 'DELETE') {
          dispatch({ type: 'DELETE_JOURNAL_ENTRY', payload: (old as any).id });
        } else {
          const j: JournalEntry = { id: n.id, date: n.date, type: n.type, field: n.field, amount: n.amount, description: n.description, createdBy: n.created_by, createdAt: n.created_at };
          dispatch({ type: 'ADD_JOURNAL_ENTRY', payload: j });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const can = (section: Section) => {
    if (!state.currentUser) return false;
    if (state.currentUser.role === 'superadmin') return true;
    return state.currentUser.permissions.includes(section);
  };

  const isSuperAdmin = () => state.currentUser?.role === 'superadmin';
  const isManager = () => state.currentUser?.role === 'manager' || state.currentUser?.role === 'superadmin';

  return <AppContext.Provider value={{ state, dispatch, can, isSuperAdmin, isManager }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export type { AppState, Action, Role, Section };
export { ALL_SECTIONS, SUPERADMIN_SECTIONS };
