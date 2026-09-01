import { useState } from 'react';
import { Outlet, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useApp } from '@/store/AppContext';
import type { Section } from '@/types';
import {
  IconBilling, IconExpenses, IconReports, IconLedgers,
  IconQR, IconUsers, IconSettings, IconLogout, IconMenu, IconClose, IconUser, IconCalendar, IconTicket, IconAlert,
} from '@/components/Icons';

function IconWhatsAppNav({ className = '', size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const IconCalendarNav = IconCalendar;

const NAV_ITEMS: { path: string; label: string; section: Section; Icon: React.FC<{ className?: string; size?: number }> }[] = [
  { path: '/billing',   label: 'Billing',          section: 'billing',         Icon: IconBilling },
  { path: '/expenses',  label: 'Expenses',         section: 'expenses',        Icon: IconExpenses },
  { path: '/reports',   label: 'Reports',          section: 'reports',         Icon: IconReports },
  { path: '/ledgers',   label: 'Ledgers',          section: 'ledgers',         Icon: IconLedgers },
  { path: '/journal',   label: 'Journal',          section: 'journal',         Icon: IconReports },
  { path: '/qr-codes',  label: 'QR Dashboard',     section: 'qr_codes',        Icon: IconQR },
  { path: '/customers',  label: 'Customers',         section: 'customers',       Icon: IconUser },
  { path: '/whatsapp',   label: 'WhatsApp',          section: 'whatsapp',        Icon: IconWhatsAppNav },
  { path: '/attendance', label: 'Attendance',         section: 'attendance',      Icon: IconCalendarNav },
  { path: '/add-ons',    label: 'Add-Ons',            section: 'add_ons',         Icon: IconTicket },
  { path: '/approvals',   label: 'Approvals',          section: 'approvals',        Icon: IconAlert },
  { path: '/users',      label: 'User Management',   section: 'user_management', Icon: IconUsers },
  { path: '/settings',  label: 'Settings',         section: 'settings',        Icon: IconSettings },
];

const ROLE_BADGE: Record<string, string> = {
  superadmin: 'badge-green',
  accountant: 'badge-blue',
  employee:   'badge-gray',
  marketing:  'badge-purple',
  manager:    'badge-green',
};

const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Super Admin',
  accountant: 'Accountant',
  employee:   'Employee',
  marketing:  'Marketing',
  manager:    'Manager',
};

export default function Layout() {
  const { state, dispatch, can } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (!state.currentUser) return <Navigate to="/login" replace />;

  const visibleNav = NAV_ITEMS.filter(n => can(n.section));
  const currentPage = NAV_ITEMS.find(n => n.path === location.pathname)?.label || 'Billing';

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Brand */}
      <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-gray-900 overflow-hidden flex-shrink-0 flex items-center justify-center">
          <img src="/logo.png" alt="PetStation" className="w-full h-full object-contain p-0.5" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm leading-tight">PetStation</p>
          <p className="text-xs text-gray-400">Management System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {visibleNav.map(({ path, label, Icon }) => {
          const isActive = location.pathname === path;
          return (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white' : 'text-gray-400'} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50">
          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center font-semibold text-white text-xs flex-shrink-0">
            {state.currentUser!.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{state.currentUser!.name}</p>
            <span className={`text-xs ${ROLE_BADGE[state.currentUser!.role]}`}>
              {ROLE_LABEL[state.currentUser!.role]}
            </span>
          </div>
          <button
            onClick={() => dispatch({ type: 'LOGOUT' })}
            className="btn-icon flex-shrink-0"
            title="Sign out"
          >
            <IconLogout size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-56 flex-col fixed inset-y-0 left-0 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 flex flex-col z-50 shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gray-900 overflow-hidden">
            <img src="/logo.png" alt="" className="w-full h-full object-contain p-0.5" />
          </div>
          <span className="font-bold text-gray-900 text-sm">PetStation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">{currentPage}</span>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="btn-icon">
            {mobileOpen ? <IconClose size={18} /> : <IconMenu size={18} />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ml-56 min-h-screen">
        <div className="lg:hidden h-14" />
        {/* Top bar for desktop */}
        <div className="hidden lg:flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
          <div>
            <h1 className="text-base font-semibold text-gray-900">{currentPage}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`badge ${state.currentUser!.role === 'superadmin' ? 'badge-green' : 'badge-gray'}`}>
              {ROLE_LABEL[state.currentUser!.role]}
            </span>
            <span className="text-sm font-medium text-gray-700">{state.currentUser!.name}</span>
          </div>
        </div>
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
