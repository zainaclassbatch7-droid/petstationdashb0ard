// ── AUTH ──────────────────────────────────────────────────────────────────────
export type Role = 'superadmin' | 'accountant' | 'employee' | 'marketing' | 'manager';

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: Role;
  avatar: string;
  permissions: Section[];
  active: boolean;
}

export type Section =
  | 'billing'
  | 'expenses'
  | 'reports'
  | 'ledgers'
  | 'journal'
  | 'settings'
  | 'qr_codes'
  | 'marketing'
  | 'customers'
  | 'whatsapp'
  | 'attendance'
  | 'add_ons'
  | 'approvals'
  | 'user_management';

// ── BILLING ───────────────────────────────────────────────────────────────────
export interface TicketItem {
  id: string;
  name: string;
  price: number;
  category: 'entry' | 'combo' | 'addon';
}

export interface PaymentMethod {
  id: string;
  name: string;
  autoLink?: boolean;
}

export interface RevenueEntry {
  id: string;
  date: string;
  invoiceNo?: string;
  items: { ticketItemId: string; name?: string; quantity: number; unitPrice: number; total: number }[];
  paymentMethod: string;
  totalAmount: number;
  note?: string;
  createdBy: string;
  createdAt: string;
  synced?: boolean;
  deletionApproval?: { status: 'pending' | 'approved' | 'rejected'; requestedBy?: string; requestedAt?: string };
}

// ── EXPENSES ──────────────────────────────────────────────────────────────────
export interface Subledger { id: string; name: string; }
export interface Ledger {
  id: string;
  name: string;
  category: 'expense' | 'asset' | 'liability';
  subledgers: Subledger[];
  deletionApproval?: { status: 'pending' | 'approved' | 'rejected'; requestedBy?: string; requestedAt?: string };
}

export interface ExpenseEntry {
  id: string;
  date: string;
  ledgerId: string;
  subledgerId?: string;
  amount: number;
  paymentMethod: string;
  description: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  synced?: boolean;
}

// ── EMPLOYEES ─────────────────────────────────────────────────────────────────
export interface Employee {
  id: string;
  name: string;
  role: string;
  baseSalary: number;
}

export interface EmployeeCharge {
  id: string;
  date: string;
  employeeId: string;
  chargeType: 'salary' | 'advance' | 'bonus' | 'deduction' | 'other';
  amount: number;
  paymentMethod: string;
  description: string;
  note?: string;
  createdBy: string;
  createdAt: string;
}

// ── ANIMALS ───────────────────────────────────────────────────────────────────
export interface Animal {
  id: string;
  name: string;
  species: string;
  section: string;
}

export interface FoodCostEntry {
  id: string;
  date: string;
  animalId: string;
  foodItem: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  paymentMethod: string;
  note?: string;
  createdBy: string;
  createdAt: string;
}

// ── ATTENDANCE ────────────────────────────────────────────────────────────────
export type AttendanceStatus = 'on_time' | 'late' | 'leave';

export interface StaffMember {
  id: string;
  name: string;
  type: 'permanent' | 'ext';
  joinDate: string;
  exitDate?: string;
  active: boolean;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  staffId: string;
  status: AttendanceStatus;
  substituteSupport?: number;   // 1-10
  behavior?: number;            // 1-10
  cleanliness?: number;         // 1-10
  addOnManualCount?: number;
  addOnSaleCount?: number;
  negativeMarks: number;        // 0 to -10
  negativeComment?: string;
  overallPerformance: number;   // computed: behavior + cleanliness + negativeMarks
  totalScore: number;           // substituteSupport + behavior + cleanliness + negativeMarks
  recordedBy: string;
  createdAt: string;
}

export interface AddOnEntry {
  id: string;
  date: string;
  staffId: string;
  ticketItemId: string;
  ticketItemName: string;
  count: number;
  paymentMethod?: string;
  submittedByUserId: string;
  submittedByName: string;
  note?: string;
  createdAt: string;
}

// ── CUSTOMERS ────────────────────────────────────────────────────────────────
export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  visitCount: number;
  totalSpent: number;
  lastVisit: string;
  createdAt: string;
}

// ── WHATSAPP ──────────────────────────────────────────────────────────────────
export interface WhatsAppTemplate {
  id: string;
  name: string;
  message: string;
  createdAt: string;
}

// ── CASH FLOW ─────────────────────────────────────────────────────────────────
export interface CashFlow {
  date: string;
  openingBalance: number;
  closingBalance: number;
}

export interface AppSettings {
  openingBalance: number;
  adminPassword: string;
  enableOTP: boolean;
  whatsappNumber: string;
  autoReportTime: string;
  backendUrl: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessGST: string;
  taxPercent: number;
}

// ── JOURNAL ──────────────────────────────────────────────────────────────────
export type JournalEntryType = 'add' | 'withdraw';
export type JournalField = 'salary' | 'maintenance';

export interface JournalEntry {
  id: string;
  date: string;
  type: JournalEntryType;
  field: JournalField;
  amount: number;
  description: string;
  createdBy: string;
  createdAt: string;
}

// ── QR ────────────────────────────────────────────────────────────────────────
export interface QRCode {
  token: string;
  label: string;
  location: string;
  animal_id: string | null;
  animal_name?: string;
  qr_image: string;
  created_at: string;
}

export interface ZooAnimal {
  id: string;
  name: string;
  species: string;
  description: string;
  habitat: string;
  diet: string;
  lifespan: string;
  conservation_status: string;
  fun_facts: string[];
  image_url: string;
  video_url: string;
  links: { label: string; url: string }[];
  custom_content: string;
}
