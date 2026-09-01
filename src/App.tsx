import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from '@/store/AppContext';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Billing from '@/pages/Billing';
import Expenses from '@/pages/Expenses';
import Reports from '@/pages/Reports';
import Ledgers from '@/pages/Ledgers';
import Journal from '@/pages/Journal';
import QRCodes from '@/pages/QRCodes';
import Customers from '@/pages/Customers';
import WhatsApp from '@/pages/WhatsApp';
import Attendance from '@/pages/Attendance';
import AddOns from '@/pages/AddOns';
import Approvals from '@/pages/Approvals';
import UserManagement from '@/pages/UserManagement';
import Settings from '@/pages/Settings';
import type { Section, User } from '@/types';

const SECTION_ROUTES: Record<Section, string> = {
  billing: '/billing',
  expenses: '/expenses',
  reports: '/reports',
  ledgers: '/ledgers',
  journal: '/journal',
  settings: '/settings',
  qr_codes: '/qr-codes',
  marketing: '/qr-codes',
  customers: '/customers',
  whatsapp: '/whatsapp',
  attendance: '/attendance',
  add_ons: '/add-ons',
  approvals: '/approvals',
  user_management: '/users',
};

function getDefaultRoute(user: User | null) {
  if (!user) return '/login';
  const firstAllowedSection = user.permissions.find(section => SECTION_ROUTES[section]);
  return firstAllowedSection ? SECTION_ROUTES[firstAllowedSection] : '/login';
}

function ProtectedRoute({ children, section }: { children: React.ReactNode; section: string }) {
  const { state, can } = useApp();
  if (!state.currentUser) return <Navigate to="/login" replace />;
  if (!can(section as Parameters<typeof can>[0])) {
    return (
      <div className="card text-center py-16 mt-8">
        <p className="text-4xl mb-3">🔒</p>
        <p className="font-semibold text-slate-700">Access Denied</p>
        <p className="text-sm text-slate-500 mt-1">You don't have permission to view this section.</p>
        <p className="text-xs text-slate-400 mt-2">Contact a Super Admin to request access.</p>
      </div>
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { state } = useApp();
  return (
    <Routes>
      <Route path="/login" element={state.currentUser ? <Navigate to={getDefaultRoute(state.currentUser)} replace /> : <Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to={getDefaultRoute(state.currentUser)} replace />} />
        <Route path="/billing" element={<ProtectedRoute section="billing"><Billing /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute section="expenses"><Expenses /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute section="reports"><Reports /></ProtectedRoute>} />
        <Route path="/ledgers" element={<ProtectedRoute section="ledgers"><Ledgers /></ProtectedRoute>} />
        <Route path="/journal" element={<ProtectedRoute section="journal"><Journal /></ProtectedRoute>} />
        <Route path="/qr-codes" element={<ProtectedRoute section="qr_codes"><QRCodes /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute section="customers"><Customers /></ProtectedRoute>} />
        <Route path="/whatsapp" element={<ProtectedRoute section="whatsapp"><WhatsApp /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute section="attendance"><Attendance /></ProtectedRoute>} />
        <Route path="/add-ons" element={<ProtectedRoute section="add_ons"><AddOns /></ProtectedRoute>} />
        <Route path="/approvals" element={<ProtectedRoute section="approvals"><Approvals /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute section="user_management"><UserManagement /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute section="settings"><Settings /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to={getDefaultRoute(state.currentUser)} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
