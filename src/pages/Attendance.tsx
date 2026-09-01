import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useApp } from '@/store/AppContext';
import type { AttendanceRecord, AttendanceStatus, StaffMember } from '@/types';
import { IconCheck, IconPlus, IconSave, IconTrash, IconClose } from '@/components/Icons';
import XLSXStyle from 'xlsx-js-style';

// ── Excel helpers ─────────────────────────────────────────────────────────────
const XC = (v: any, bold = false, align: 'left'|'center'|'right' = 'left', bg = 'FFFFFF', color = '111827') => ({
  v, t: typeof v === 'number' ? 'n' : 's',
  s: {
    font: { bold, sz: 10, name: 'Calibri', color: { rgb: color } },
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    alignment: { horizontal: align, vertical: 'center' },
    border: { top:{style:'thin',color:{rgb:'E5E7EB'}}, bottom:{style:'thin',color:{rgb:'E5E7EB'}}, left:{style:'thin',color:{rgb:'E5E7EB'}}, right:{style:'thin',color:{rgb:'E5E7EB'}} },
  },
});
const HDR = (v: string) => XC(v, true, 'center', '111827', 'FFFFFF');
const slabel = (s: AttendanceStatus | null) => s === 'on_time' ? 'On Time' : s === 'late' ? 'Late' : s === 'leave' ? 'Leave' : '-';

function buildWsRows(rows: any[][], colWidths: number[]) {
  const ws: any = {};
  rows.forEach((row, r) => row.forEach((c, col) => { if (c) ws[XLSXStyle.utils.encode_cell({ r, c: col })] = c; }));
  ws['!ref'] = XLSXStyle.utils.encode_range({ s:{r:0,c:0}, e:{r:rows.length-1, c:colWidths.length-1} });
  ws['!cols'] = colWidths.map(w => ({ wch: w }));
  return ws as XLSXStyle.WorkSheet;
}

function exportDailyAttendance(date: string, records: AttendanceRecord[], staff: StaffMember[]) {
  const data = [['Name','Type','Status','Performance','Cleanliness','Negative','Overall','Total Score','Add-On Sales','Comment'].map(HDR)];
  staff.forEach((m, i) => {
    const r = records.find(x => x.staffId === m.id);
    const bg = i % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
    data.push([
      XC(m.name, true, 'left', bg),
      XC(m.type === 'ext' ? 'Ext' : 'Permanent', false, 'center', bg),
      XC(slabel(r?.status ?? null), false, 'center', bg),
      XC(r?.behavior ?? '-', false, 'center', bg),
      XC(r?.cleanliness ?? '-', false, 'center', bg),
      XC(r?.negativeMarks ?? 0, false, 'center', bg, (r?.negativeMarks ?? 0) < 0 ? 'DC2626' : '111827'),
      XC(r ? +r.overallPerformance.toFixed(1) : '-', false, 'center', bg),
      XC(r ? +r.totalScore.toFixed(1) : '-', true, 'center', bg),
      XC(r?.addOnSaleCount ?? 0, false, 'center', bg, '0369A1'),
      XC(r?.negativeComment || '-', false, 'left', bg),
    ]);
  });
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, buildWsRows(data, [22,12,10,12,12,10,10,12,12,28]), `Day ${date}`);
  XLSXStyle.writeFile(wb, `Attendance_Daily_${date}.xlsx`);
}

function exportPersonMonthly(staff: StaffMember, records: AttendanceRecord[], month: string) {
  const data = [['Date','Status','Performance','Cleanliness','Negative','Overall','Total Score','Add-On Sales','Comment'].map(HDR)];
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach((r, i) => {
    const bg = i % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
    data.push([
      XC(r.date, false, 'left', bg),
      XC(slabel(r.status), false, 'center', bg),
      XC(r.behavior ?? '-', false, 'center', bg),
      XC(r.cleanliness ?? '-', false, 'center', bg),
      XC(r.negativeMarks ?? 0, false, 'center', bg, (r.negativeMarks ?? 0) < 0 ? 'DC2626' : '111827'),
      XC(+r.overallPerformance.toFixed(1), false, 'center', bg),
      XC(+r.totalScore.toFixed(1), true, 'center', bg),
      XC(r.addOnSaleCount ?? 0, false, 'center', bg, '0369A1'),
      XC(r.negativeComment || '-', false, 'left', bg),
    ]);
  });
  const scored = sorted.filter(r => r.totalScore > 0);
  const avg = scored.length ? scored.reduce((s, r) => s + r.totalScore, 0) / scored.length : 0;
  data.push([
    XC('SUMMARY', true, 'left', 'F3F4F6'),
    XC(`OT:${sorted.filter(r=>r.status==='on_time').length} Late:${sorted.filter(r=>r.status==='late').length} Leave:${sorted.filter(r=>r.status==='leave').length}`, true, 'center', 'F3F4F6'),
    XC('',false,'center','F3F4F6'), XC('',false,'center','F3F4F6'), XC('',false,'center','F3F4F6'),
    XC('',false,'center','F3F4F6'),
    XC(`Avg: ${avg.toFixed(2)}`, true, 'center', 'F3F4F6'),
    XC(sorted.reduce((s,r)=>s+(r.addOnSaleCount??0),0), true, 'center', 'F3F4F6', '0369A1'),
    XC('',false,'left','F3F4F6'),
  ]);
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, buildWsRows(data, [13,10,12,12,10,10,12,12,28]), staff.name);
  XLSXStyle.writeFile(wb, `Attendance_${staff.name.replace(/\s+/g,'_')}_${month}.xlsx`);
}

function exportDashboardReport(
  leaderboard: { name: string; avgScore: number; lateCount: number; leaveCount: number; attendanceDays: number; addOnSales: number }[],
  period: string,
) {
  const data = [['#','Name','Avg Score','Late','Leave','Days Present','Add-On Sales'].map(HDR)];
  leaderboard.forEach((e, i) => {
    const bg = i % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
    data.push([
      XC(i+1, true, 'center', bg),
      XC(e.name, true, 'left', bg),
      XC(+e.avgScore.toFixed(2), false, 'right', bg),
      XC(e.lateCount, false, 'center', bg, 'D97706'),
      XC(e.leaveCount, false, 'center', bg, 'DC2626'),
      XC(e.attendanceDays, false, 'center', bg),
      XC(e.addOnSales, false, 'center', bg, '0369A1'),
    ]);
  });
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, buildWsRows(data, [5,22,12,8,8,14,14]), `Dashboard ${period}`);
  XLSXStyle.writeFile(wb, `Attendance_Dashboard_${period.replace(/[^a-zA-Z0-9]/g,'_')}.xlsx`);
}

type AttendanceSection = 'attendance' | 'employee_review' | 'add_staff' | 'remove_staff' | 'dashboard';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; className: string }[] = [
  { value: 'on_time', label: 'On Time', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  { value: 'late', label: 'Late', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  { value: 'leave', label: 'Leave', className: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
];

const SECTION_OPTIONS: { id: AttendanceSection; label: string; description: string }[] = [
  { id: 'attendance', label: 'Attendance', description: 'Open register and mark everyone together' },
  { id: 'employee_review', label: 'Employee Review', description: 'Review one employee at a time' },
  { id: 'add_staff', label: 'Add Staff', description: 'Create new staff with joining date' },
  { id: 'remove_staff', label: 'Remove Staff', description: 'Mark resigned staff with exit date' },
  { id: 'dashboard', label: 'Dashboard', description: 'Day-wise and month-wise summary' },
];

const today = format(new Date(), 'yyyy-MM-dd');

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getStaffTypeLabel = (type: StaffMember['type']) => type === 'ext' ? 'Ext Staff' : 'Permanent';

function getStatusMeta(status: AttendanceStatus | null) {
  if (!status) return { value: null, label: 'Not Marked', className: 'bg-gray-100 text-gray-400 ring-1 ring-gray-200' };
  return STATUS_OPTIONS.find(option => option.value === status) ?? STATUS_OPTIONS[0];
}

function computeOverallPerformance(performance?: number, cleanliness?: number, negativeMarks = 0) {
  const baseAverage = Math.round((((performance ?? 0) + (cleanliness ?? 0)) / 2) * 10) / 10;
  return clamp(baseAverage + negativeMarks, 0, 10);
}

function computeTotalScore(performance?: number, cleanliness?: number, addOnSaleCount?: number, negativeMarks = 0) {
  return (performance ?? 0) + (cleanliness ?? 0) + (addOnSaleCount ?? 0) + negativeMarks;
}

function createAttendanceRecord(
  date: string,
  staffId: string,
  recordedBy: string,
  autoAddOnCount = 0,
  existing?: AttendanceRecord,
  overrides?: Partial<AttendanceRecord>,
): AttendanceRecord {
  const draft: AttendanceRecord = {
    id: `${date}-${staffId}`,
    date,
    staffId,
    status: existing?.status ?? overrides?.status ?? 'on_time',
    behavior: existing?.behavior,
    cleanliness: existing?.cleanliness,
    negativeMarks: existing?.negativeMarks ?? 0,
    negativeComment: existing?.negativeComment ?? '',
    overallPerformance: existing?.overallPerformance ?? 0,
    totalScore: existing?.totalScore ?? 0,
    addOnSaleCount: existing?.addOnSaleCount ?? 0,
    addOnManualCount: existing?.addOnManualCount ?? 0,
    substituteSupport: existing?.substituteSupport ?? 0,
    recordedBy,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    ...overrides,
  };

  draft.addOnSaleCount = autoAddOnCount + (draft.addOnManualCount ?? 0);
  draft.overallPerformance = computeOverallPerformance(draft.behavior, draft.cleanliness, draft.negativeMarks);
  draft.totalScore = computeTotalScore(draft.behavior, draft.cleanliness, draft.addOnSaleCount, draft.negativeMarks);

  return draft;
}

export default function Attendance() {
  const { state, dispatch, isManager } = useApp();
  const [selectedDate, setSelectedDate] = useState(today);
  const [monthFilter, setMonthFilter] = useState(today.slice(0, 7));
  const [activeSection, setActiveSection] = useState<AttendanceSection>('attendance');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [reviewMonthFilter, setReviewMonthFilter] = useState(today.slice(0, 7));
  const [dashboardPeriod, setDashboardPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [dashboardYear, setDashboardYear] = useState(new Date().getFullYear());
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerMode, setRegisterMode] = useState<'attendance' | 'eod'>('attendance');
  const [compactRegister, setCompactRegister] = useState(false);
  const [collapsedRows, setCollapsedRows] = useState<Record<string, boolean>>({});
  const [addStaffForm, setAddStaffForm] = useState({
    name: '',
    type: 'permanent' as StaffMember['type'],
    joinDate: today,
  });
  const [staffExitDates, setStaffExitDates] = useState<Record<string, string>>({});
  const [draftRows, setDraftRows] = useState<Record<string, Partial<AttendanceRecord>>>({});
  const [activeStatusTab, setActiveStatusTab] = useState<AttendanceStatus | null>(null);

  const recordsForDay = useMemo(
    () => state.attendanceRecords.filter(record => record.date === selectedDate),
    [selectedDate, state.attendanceRecords],
  );

  const activeStaffForDay = useMemo(
    () => state.staff
      .filter(member => member.active)
      .filter(member => member.joinDate <= selectedDate)
      .filter(member => !member.exitDate || member.exitDate >= selectedDate)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [selectedDate, state.staff],
  );

  const recordsByStaff = useMemo(
    () => Object.fromEntries(recordsForDay.map(record => [record.staffId, record])),
    [recordsForDay],
  );

  const addOnTotalsByStaffForDay = useMemo(() => {
    const totals: Record<string, number> = {};
    state.addOnEntries
      .filter(e => e.date === selectedDate)
      .forEach(e => { totals[e.staffId] = (totals[e.staffId] ?? 0) + e.count; });
    return totals;
  }, [state.addOnEntries, selectedDate]);

  const leaderboard = useMemo(() => {
    const prefix = dashboardPeriod === 'yearly' ? String(dashboardYear) : monthFilter;
    const periodRecords = state.attendanceRecords.filter(r => r.date.startsWith(prefix));
    return state.staff.filter(m => m.active).sort((a, b) => a.name.localeCompare(b.name)).map(member => {
      const staffRecords = periodRecords.filter(r => r.staffId === member.id);
      const scored = staffRecords.filter(r => r.totalScore > 0);
      return {
        staffId: member.id, name: member.name,
        avgScore: scored.length ? scored.reduce((s, r) => s + r.totalScore, 0) / scored.length : 0,
        lateCount: staffRecords.filter(r => r.status === 'late').length,
        leaveCount: staffRecords.filter(r => r.status === 'leave').length,
        attendanceDays: staffRecords.length,
        addOnSales: staffRecords.reduce((s, r) => s + (r.addOnSaleCount ?? 0), 0),
      };
    }).sort((a, b) => b.avgScore - a.avgScore);
  }, [state.staff, state.attendanceRecords, monthFilter, dashboardPeriod, dashboardYear]);

  const daySummary = useMemo(() => {
    const onTime = recordsForDay.filter(record => record.status === 'on_time').length;
    const late = recordsForDay.filter(record => record.status === 'late').length;
    const leave = recordsForDay.filter(record => record.status === 'leave').length;
    const totalAddOnSales = recordsForDay.reduce((sum, record) => sum + (record.addOnSaleCount ?? 0), 0);
    const scored = recordsForDay.filter(record => record.totalScore > 0);

    return {
      activeStaff: activeStaffForDay.length,
      onTime,
      late,
      leave,
      totalAddOnSales,
      averageScore: scored.length ? scored.reduce((sum, record) => sum + record.totalScore, 0) / scored.length : 0,
    };
  }, [activeStaffForDay.length, recordsForDay]);

  const selectedStaff = useMemo(
    () => activeStaffForDay.find(member => member.id === (selectedStaffId || activeStaffForDay[0]?.id)),
    [activeStaffForDay, selectedStaffId],
  );

  const selectedStaffMonthRecords = useMemo(() => {
    if (!selectedStaff) return [];
    return state.attendanceRecords
      .filter(record => record.staffId === selectedStaff.id && record.date.startsWith(reviewMonthFilter))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [reviewMonthFilter, selectedStaff, state.attendanceRecords]);

  const selectedStaffSummary = useMemo(() => {
    if (!selectedStaff) {
      return {
        avgScore: 0,
        onTime: 0,
        late: 0,
        leave: 0,
        addOnSales: 0,
      };
    }

    const scored = selectedStaffMonthRecords.filter(record => record.totalScore > 0);
    return {
      avgScore: scored.length ? scored.reduce((sum, record) => sum + record.totalScore, 0) / scored.length : 0,
      onTime: selectedStaffMonthRecords.filter(record => record.status === 'on_time').length,
      late: selectedStaffMonthRecords.filter(record => record.status === 'late').length,
      leave: selectedStaffMonthRecords.filter(record => record.status === 'leave').length,
      addOnSales: selectedStaffMonthRecords.reduce((sum, record) => sum + (record.addOnSaleCount ?? 0), 0),
    };
  }, [selectedStaff, selectedStaffMonthRecords]);

  const handleMorningStatus = (staffId: string, status: AttendanceStatus) => {
    const existing = recordsByStaff[staffId];
    const record = createAttendanceRecord(
      selectedDate,
      staffId,
      state.currentUser?.name ?? 'Manager',
      addOnTotalsByStaffForDay[staffId] ?? 0,
      existing,
      { status },
    );

    dispatch({ type: 'SAVE_ATTENDANCE', payload: record });
  };

  const handleDraftChange = (staffId: string, patch: Partial<AttendanceRecord>) => {
    setDraftRows(current => ({
      ...current,
      [staffId]: {
        ...(current[staffId] ?? {}),
        ...patch,
      },
    }));
  };

  const handleScoreChange = (staffId: string, field: 'behavior' | 'cleanliness', raw: string, min: number, max: number) => {
    if (raw === '' || raw === '-') {
      handleDraftChange(staffId, { [field]: undefined });
      return;
    }
    const n = Number(raw);
    if (!isNaN(n)) handleDraftChange(staffId, { [field]: clamp(n, min, max) });
  };

  const handleNegativeChange = (staffId: string, raw: string) => {
    if (raw === '' || raw === '-') {
      handleDraftChange(staffId, { negativeMarks: 0 });
      return;
    }
    const n = Number(raw);
    if (!isNaN(n)) handleDraftChange(staffId, { negativeMarks: clamp(n, -10, 0) });
  };

  const handleSaveAllRows = () => {
    rows.forEach(row => {
      if (row.hasUnsavedChanges || !row.saved) {
        if (!row.status && !row.hasUnsavedChanges) return;
        const existing = recordsByStaff[row.member.id];
        const draft = draftRows[row.member.id] ?? {};
        const record = createAttendanceRecord(
          selectedDate,
          row.member.id,
          state.currentUser?.name ?? 'Manager',
          addOnTotalsByStaffForDay[row.member.id] ?? 0,
          existing,
          draft,
        );
        dispatch({ type: 'SAVE_ATTENDANCE', payload: record });
      }
    });

    setDraftRows({});
    setRegisterOpen(false);
  };

  const toggleCollapsedRow = (staffId: string) => {
    setCollapsedRows(current => ({
      ...current,
      [staffId]: !current[staffId],
    }));
  };

  const handleAddStaff = (event: React.FormEvent) => {
    event.preventDefault();
    const name = addStaffForm.name.trim();
    if (!name) return;

    dispatch({
      type: 'ADD_STAFF',
      payload: {
        id: `st-${Date.now()}`,
        name,
        type: addStaffForm.type,
        joinDate: addStaffForm.joinDate,
        active: true,
      },
    });

    setAddStaffForm({
      name: '',
      type: 'permanent',
      joinDate: today,
    });
  };

  const handleRemoveStaff = (staffId: string) => {
    const exitDate = staffExitDates[staffId] || selectedDate;
    dispatch({ type: 'REMOVE_STAFF', payload: { id: staffId, exitDate } });
  };

  const rows = activeStaffForDay.map(member => {
    const saved = recordsByStaff[member.id];
    const draft = draftRows[member.id] ?? {};
    const merged = { ...saved, ...draft };
    const negativeMarks = Number(merged.negativeMarks ?? saved?.negativeMarks ?? 0);
    const performance = merged.behavior ?? saved?.behavior;
    const cleanliness = merged.cleanliness ?? saved?.cleanliness;
    const addOnAutoCount = addOnTotalsByStaffForDay[member.id] ?? 0;
    const addOnManualCount = Number(merged.addOnManualCount ?? saved?.addOnManualCount ?? 0);
    const addOnSaleCount = addOnAutoCount + addOnManualCount;
    const status = merged.status ?? saved?.status ?? null;

    return {
      member,
      saved,
      status,
      performance,
      cleanliness,
      negativeMarks,
      addOnAutoCount,
      addOnManualCount,
      addOnSaleCount,
      negativeComment: merged.negativeComment ?? saved?.negativeComment ?? '',
      overallPerformance: computeOverallPerformance(performance, cleanliness, negativeMarks),
      totalScore: computeTotalScore(performance, cleanliness, addOnSaleCount, negativeMarks),
      hasUnsavedChanges: Object.keys(draft).length > 0,
    };
  });

  const attendanceMarkedCount = rows.filter(row => !!row.saved).length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Staff Attendance & Performance</h2>
          <p className="page-subtitle">
            Staff attendance and performance tracking system.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={event => setSelectedDate(event.target.value)}
            className="input w-auto"
          />
          <input
            type="month"
            value={monthFilter}
            onChange={event => setMonthFilter(event.target.value)}
            className="input w-auto"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {SECTION_OPTIONS.map(section => {
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`text-left rounded-2xl border px-4 py-4 transition-all ${
                active
                  ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-900'}`}>{section.label}</p>
              <p className={`text-xs mt-1 ${active ? 'text-gray-200' : 'text-gray-500'}`}>{section.description}</p>
            </button>
          );
        })}
      </div>

      {!isManager() && (
        <div className="alert-warning">
          <div>
            <p className="font-semibold">Read-only context</p>
            <p className="text-sm mt-1">Only the manager or super admin should update daily attendance and performance.</p>
          </div>
        </div>
      )}

      {activeSection === 'attendance' && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <p className="section-title mb-1">Attendance</p>
                <p className="text-sm text-gray-500 leading-6">Manage daily attendance and end-of-day scoring from one place.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Selected Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={event => setSelectedDate(event.target.value)}
                    className="input w-full sm:w-[180px]"
                  />
                </div>
                <div>
                  <label className="label">Month Filter</label>
                  <input
                    type="month"
                    value={monthFilter}
                    onChange={event => setMonthFilter(event.target.value)}
                    className="input w-full sm:w-[180px]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <div className="stat-card min-h-[112px]">
              <div>
                <p className="stat-label">Active Staff</p>
                <p className="stat-value">{daySummary.activeStaff}</p>
              </div>
              <span className="badge-gray">Day Wise</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveStatusTab(activeStatusTab === 'on_time' ? null : 'on_time')}
              className={`stat-card min-h-[112px] text-left transition-all ${activeStatusTab === 'on_time' ? 'ring-2 ring-emerald-400' : 'hover:ring-1 hover:ring-emerald-200'}`}
            >
              <div>
                <p className="stat-label">On Time</p>
                <p className="stat-value text-emerald-700">{daySummary.onTime}</p>
              </div>
              <span className="badge-green">Morning</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStatusTab(activeStatusTab === 'late' ? null : 'late')}
              className={`stat-card min-h-[112px] text-left transition-all ${activeStatusTab === 'late' ? 'ring-2 ring-amber-400' : 'hover:ring-1 hover:ring-amber-200'}`}
            >
              <div>
                <p className="stat-label">Late</p>
                <p className="stat-value text-amber-700">{daySummary.late}</p>
              </div>
              <span className="badge-yellow">Monitor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStatusTab(activeStatusTab === 'leave' ? null : 'leave')}
              className={`stat-card min-h-[112px] text-left transition-all ${activeStatusTab === 'leave' ? 'ring-2 ring-red-400' : 'hover:ring-1 hover:ring-red-200'}`}
            >
              <div>
                <p className="stat-label">Leave</p>
                <p className="stat-value text-red-700">{daySummary.leave}</p>
              </div>
              <span className="badge-red">Absent</span>
            </button>
            <div className="stat-card min-h-[112px]">
              <div>
                <p className="stat-label">Add-On Sales</p>
                <p className="stat-value text-sky-700">{daySummary.totalAddOnSales}</p>
              </div>
              <span className="badge-blue">Selected Day</span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)] gap-6 items-start">
            <div className="card overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4">
                <div className="flex flex-col gap-1">
                  <p className="section-title mb-0">Attendance Register</p>
                  <p className="text-sm text-gray-500">Choose which register you want to open for the selected day.</p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-5 text-left transition-all hover:border-emerald-200 hover:bg-emerald-100 min-h-[136px] flex flex-col justify-between"
                    onClick={() => {
                      setRegisterMode('attendance');
                      setRegisterOpen(true);
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Attendance</p>
                      <p className="text-sm text-emerald-700 mt-2 leading-6">Morning register for marking `On Time`, `Late`, or `Leave` for all staff.</p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-900/70 mt-4">Open morning register</span>
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl border border-sky-100 bg-sky-50 px-5 py-5 text-left transition-all hover:border-sky-200 hover:bg-sky-100 min-h-[136px] flex flex-col justify-between"
                    onClick={() => {
                      setRegisterMode('eod');
                      setRegisterOpen(true);
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-sky-900">EOD</p>
                      <p className="text-sm text-sky-700 mt-2 leading-6">End-of-day register for performance, cleanliness, add-on sales, and comments.</p>
                    </div>
                    <span className="text-xs font-semibold text-sky-900/70 mt-4">Open end-of-day register</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="section-title mb-0">Today's Snapshot</p>
                  <span className="badge-gray">{format(new Date(selectedDate), 'dd MMM')}</span>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-gray-50 px-4 py-3.5 flex items-center justify-between border border-gray-100">
                    <span className="text-sm text-gray-500">Attendance Logged</span>
                    <span className="text-lg font-semibold text-gray-900">{recordsForDay.length}</span>
                  </div>
                  <div className="rounded-2xl bg-gray-50 px-4 py-3.5 flex items-center justify-between border border-gray-100">
                    <span className="text-sm text-gray-500">Average Score</span>
                    <span className="text-lg font-semibold text-gray-900">{daySummary.averageScore.toFixed(1)}</span>
                  </div>
                  <div className="rounded-2xl bg-gray-50 px-4 py-3.5 flex items-center justify-between border border-gray-100">
                    <span className="text-sm text-gray-500">Add-On Sales</span>
                    <span className="text-lg font-semibold text-sky-700">{daySummary.totalAddOnSales}</span>
                  </div>
                </div>
              </div>

              <div className="card space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="section-title mb-0">Status Split</p>
                  <span className="badge-gray">Selected Day</span>
                </div>
                <div className="space-y-3">
                  {([
                    { status: 'on_time' as AttendanceStatus, label: 'On Time', count: daySummary.onTime, border: 'border-emerald-100', bg: activeStatusTab === 'on_time' ? 'bg-emerald-100' : 'bg-emerald-50', textLabel: 'text-emerald-800', textCount: 'text-emerald-900', nameCls: 'text-emerald-700' },
                    { status: 'late' as AttendanceStatus, label: 'Late', count: daySummary.late, border: 'border-amber-100', bg: activeStatusTab === 'late' ? 'bg-amber-100' : 'bg-amber-50', textLabel: 'text-amber-800', textCount: 'text-amber-900', nameCls: 'text-amber-700' },
                    { status: 'leave' as AttendanceStatus, label: 'Leave', count: daySummary.leave, border: 'border-red-100', bg: activeStatusTab === 'leave' ? 'bg-red-100' : 'bg-red-50', textLabel: 'text-red-800', textCount: 'text-red-900', nameCls: 'text-red-700' },
                  ]).map(({ status, label, count, border, bg, textLabel, textCount, nameCls }) => {
                    const names = activeStaffForDay
                      .filter(m => recordsByStaff[m.id]?.status === status)
                      .map(m => m.name);
                    const isOpen = activeStatusTab === status;
                    return (
                      <div key={status} className={`rounded-2xl border ${border} ${bg} transition-all overflow-hidden`}>
                        <button
                          type="button"
                          onClick={() => setActiveStatusTab(isOpen ? null : status)}
                          className="w-full px-4 py-3.5 flex items-center justify-between gap-3"
                        >
                          <span className={`text-sm font-medium ${textLabel}`}>{label}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-semibold ${textCount}`}>{count}</span>
                            <span className={`text-xs ${textLabel} opacity-60`}>{isOpen ? '^' : 'v'}</span>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 space-y-1">
                            {names.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No records yet for {selectedDate}</p>
                            ) : names.map(name => (
                              <div key={name} className={`text-sm font-medium ${nameCls} flex items-center gap-2`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
                                {name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {registerOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm p-2 lg:p-4 overflow-hidden">
              <div className="w-full h-full max-w-7xl mx-auto bg-white rounded-3xl shadow-2xl border border-gray-100 ring-1 ring-black/5 overflow-hidden flex flex-col">
                <div className="px-5 lg:px-8 py-5 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500 font-semibold">
                      {registerMode === 'attendance' ? 'Attendance Register' : 'EOD Register'}
                    </p>
                    <h3 className="text-2xl font-semibold text-gray-900 mt-2">{format(new Date(selectedDate), 'dd MMM yyyy')}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {registerMode === 'attendance'
                        ? 'Mark attendance for all staff in one place.'
                        : 'Update daily performance and end-of-day scoring for all staff.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => exportDailyAttendance(selectedDate, recordsForDay, activeStaffForDay)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download
                    </button>
                    <button type="button" className="btn-icon" onClick={() => setRegisterOpen(false)}>
                      <IconClose size={18} />
                    </button>
                  </div>
                </div>

                <div className="px-5 lg:px-8 py-3.5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 bg-gray-50/80">
                  <div className="text-sm text-gray-500">
                    {attendanceMarkedCount} of {rows.length} entries already saved for this date.
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => setCompactRegister(current => !current)}
                  >
                    {compactRegister ? 'Expanded View' : 'Compact View'}
                  </button>
                </div>

                <div className="p-4 lg:p-6 overflow-y-auto scrollbar-thin flex-1 min-h-0">
                  {compactRegister ? (
                    <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-white shadow-sm">
                      <table className="w-full min-w-[880px] text-xs">
                        <thead className="bg-gray-100">
                          <tr className="border-b border-gray-200">
                            <th className="sticky left-0 z-10 bg-gray-100 px-2 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">Staff</th>
                            <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">Type</th>
                            <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">On Time</th>
                            <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">Late</th>
                            <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">Leave</th>
                            {registerMode === 'eod' && (
                              <>
                                <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">Perf.</th>
                                <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">Clean.</th>
                                <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">Neg.</th>
                                <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">Overall</th>
                                <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">Total</th>
                                <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">Comment</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(row => (
                            <tr key={row.member.id} className="border-b border-gray-100 bg-white">
                              <td className="sticky left-0 z-10 bg-white px-2 py-2 font-medium text-gray-900 whitespace-nowrap border-r border-gray-100">{row.member.name}</td>
                              <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{row.member.type === 'ext' ? 'Ext' : 'Perm'}</td>
                              {STATUS_OPTIONS.map(option => (
                                <td key={option.value} className="px-2 py-2">
                                  <button
                                    type="button"
                                    onClick={() => handleMorningStatus(row.member.id, option.value)}
                                    className={`h-6 min-w-12 rounded border text-[11px] font-semibold ${
                                      row.status === option.value
                                        ? option.value === 'on_time'
                                          ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                          : option.value === 'late'
                                            ? 'border-amber-300 bg-amber-100 text-amber-800'
                                            : 'border-red-300 bg-red-100 text-red-800'
                                        : 'border-gray-200 bg-white text-gray-500'
                                    }`}
                                  >
                                    {option.value === 'on_time' ? 'OT' : option.value === 'late' ? 'LT' : 'LV'}
                                  </button>
                                </td>
                              ))}
                              {registerMode === 'eod' && (
                                <>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      max={10}
                                      className="w-14 rounded border border-gray-200 px-2 py-1 text-xs"
                                      value={row.performance ?? ''}
                                      disabled={row.status === 'leave'}
                                      onChange={event => handleScoreChange(row.member.id, 'behavior', event.target.value, 0, 10)}
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      max={10}
                                      className="w-14 rounded border border-gray-200 px-2 py-1 text-xs"
                                      value={row.cleanliness ?? ''}
                                      disabled={row.status === 'leave'}
                                      onChange={event => handleScoreChange(row.member.id, 'cleanliness', event.target.value, 0, 10)}
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min={-10}
                                      max={0}
                                      className="w-14 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 font-semibold"
                                      value={row.negativeMarks}
                                      disabled={row.status === 'leave'}
                                      onChange={event => handleNegativeChange(row.member.id, event.target.value)}
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{row.overallPerformance.toFixed(1)}</td>
                                  <td className={`px-2 py-2 whitespace-nowrap font-semibold ${row.negativeMarks < 0 ? 'text-red-600' : 'text-gray-700'}`}>{row.totalScore.toFixed(1)}</td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="text"
                                      className="w-36 rounded border border-gray-200 px-2 py-1 text-xs"
                                      value={row.negativeComment}
                                      disabled={row.status === 'leave'}
                                      onChange={event => handleDraftChange(row.member.id, { negativeComment: event.target.value })}
                                    />
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rows.map(row => {
                        const statusMeta = getStatusMeta(row.status);
                        const isLeave = row.status === 'leave';
                        const isCollapsed = !!collapsedRows[row.member.id];

                        return (
                          <div key={row.member.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-lg font-semibold text-gray-900">{row.member.name}</h4>
                                  <span className={row.member.type === 'ext' ? 'badge-blue' : 'badge-gray'}>{getStaffTypeLabel(row.member.type)}</span>
                                  <span className={`text-xs inline-flex px-2.5 py-1 rounded-full ${statusMeta.className}`}>{statusMeta.label}</span>
                                </div>
                                <p className="text-sm text-gray-500 mt-2">Joined on {row.member.joinDate}</p>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex flex-wrap gap-2">
                                  {STATUS_OPTIONS.map(option => {
                                    const active = row.status === option.value;
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        className={`px-3 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors ${active ? option.className : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}`}
                                        onClick={() => handleMorningStatus(row.member.id, option.value)}
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  onClick={() => toggleCollapsedRow(row.member.id)}
                                >
                                  {isCollapsed ? 'Expand' : 'Collapse'}
                                </button>
                              </div>
                            </div>

                            {isCollapsed ? (
                              <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
                                {registerMode === 'eod' ? (
                                  <>
                                    <div>
                                      <label className="label">Performance</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={10}
                                        className="input"
                                        value={row.performance ?? ''}
                                        disabled={isLeave}
                                        onChange={event => handleScoreChange(row.member.id, 'behavior', event.target.value, 0, 10)}
                                      />
                                    </div>
                                    <div>
                                      <label className="label">Cleanliness</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={10}
                                        className="input"
                                        value={row.cleanliness ?? ''}
                                        disabled={isLeave}
                                        onChange={event => handleScoreChange(row.member.id, 'cleanliness', event.target.value, 0, 10)}
                                      />
                                    </div>
                                    <div>
                                      <label className="label text-red-600">Negative</label>
                                      <input
                                        type="number"
                                        min={-10}
                                        max={0}
                                        className="input border-red-200 bg-red-50 text-red-700 font-semibold"
                                        value={row.negativeMarks}
                                        disabled={isLeave}
                                        onChange={event => handleNegativeChange(row.member.id, event.target.value)}
                                      />
                                    </div>
                                    <div className="rounded-2xl bg-gray-50 px-3 py-3 flex flex-col justify-center">
                                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Overall / Total</p>
                                      <p className="text-sm font-semibold mt-1"><span className="text-gray-900">{row.overallPerformance.toFixed(1)}</span> / <span className={row.negativeMarks < 0 ? 'text-red-600' : 'text-gray-900'}>{row.totalScore.toFixed(1)}</span></p>
                                    </div>
                                  </>
                                ) : (
                                  <div className="col-span-full rounded-2xl bg-gray-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm text-gray-700">Attendance can still be marked directly in compact view.</p>
                                    <span className={`text-xs inline-flex px-3 py-1.5 rounded-full ${statusMeta.className}`}>{statusMeta.label}</span>
                                  </div>
                                )}
                              </div>
                            ) : registerMode === 'eod' ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mt-5">
                                <div>
                                  <label className="label">Performance</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    className="input"
                                    value={row.performance ?? ''}
                                    disabled={isLeave}
                                    onChange={event => handleScoreChange(row.member.id, 'behavior', event.target.value, 0, 10)}
                                  />
                                </div>
                                <div>
                                  <label className="label">Cleanliness</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    className="input"
                                    value={row.cleanliness ?? ''}
                                    disabled={isLeave}
                                    onChange={event => handleScoreChange(row.member.id, 'cleanliness', event.target.value, 0, 10)}
                                  />
                                </div>
                                <div>
                                  <label className="label text-red-600">Negative Marks</label>
                                  <input
                                    type="number"
                                    min={-10}
                                    max={0}
                                    className="input border-red-200 bg-red-50 text-red-700 font-semibold"
                                    value={row.negativeMarks}
                                    disabled={isLeave}
                                    onChange={event => handleNegativeChange(row.member.id, event.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="label text-sky-600">Add-On Sales</label>
                                  <input
                                    type="number"
                                    min={0}
                                    className="input"
                                    value={row.addOnManualCount || ''}
                                    disabled={isLeave}
                                    placeholder="0"
                                    onChange={event => handleDraftChange(row.member.id, { addOnManualCount: Math.max(0, Number(event.target.value)) })}
                                  />
                                </div>
                                <div className="rounded-2xl bg-gray-50 px-4 py-3 flex flex-col justify-center">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Overall / Total</p>
                                  <p className="text-base font-semibold mt-2"><span className="text-gray-900">{row.overallPerformance.toFixed(1)}</span> / <span className={row.negativeMarks < 0 ? 'text-red-600' : 'text-gray-900'}>{row.totalScore.toFixed(1)}</span></p>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Attendance Status</p>
                                  <p className="text-sm text-gray-700 mt-1">Morning attendance can be updated for all staff from this register.</p>
                                </div>
                                <span className={`text-xs inline-flex px-3 py-1.5 rounded-full ${statusMeta.className}`}>{statusMeta.label}</span>
                              </div>
                            )}

                            {registerMode === 'eod' && !isCollapsed && (
                              <div className="mt-4">
                                <label className="label">Comment</label>
                                <input
                                  type="text"
                                  className="input"
                                  value={row.negativeComment}
                                  disabled={isLeave}
                                  placeholder="Optional manager note"
                                  onChange={event => handleDraftChange(row.member.id, { negativeComment: event.target.value })}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="px-4 lg:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                  <div className="text-sm text-gray-500">Save the full register after marking all required staff.</div>
                  <div className="flex items-center gap-3">
                    <button type="button" className="btn-secondary" onClick={() => setRegisterOpen(false)}>
                      Close
                    </button>
                    <button type="button" className="btn-primary" onClick={handleSaveAllRows}>
                      <IconSave size={14} />
                      Save Register
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSection === 'employee_review' && (
        <div className="space-y-5">
          {/* Employee selector */}
          <div className="card">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="section-title mb-1">Employee Review</p>
                <p className="text-sm text-gray-500">Select an employee to view their performance breakdown for the month.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="input min-w-[200px]"
                  value={selectedStaff?.id ?? ''}
                  onChange={event => setSelectedStaffId(event.target.value)}
                >
                  {activeStaffForDay.map(member => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
                <input type="month" className="input w-auto" value={reviewMonthFilter} onChange={e => setReviewMonthFilter(e.target.value)} />
                {selectedStaff && (
                  <button
                    type="button"
                    onClick={() => exportPersonMonthly(selectedStaff, selectedStaffMonthRecords, reviewMonthFilter)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download Report
                  </button>
                )}
              </div>
            </div>
          </div>

          {selectedStaff && (() => {
            const totalDays = selectedStaffMonthRecords.length;
            const onTimePct = totalDays ? Math.round((selectedStaffSummary.onTime / totalDays) * 100) : 0;
            const latePct   = totalDays ? Math.round((selectedStaffSummary.late   / totalDays) * 100) : 0;
            const leavePct  = totalDays ? Math.round((selectedStaffSummary.leave  / totalDays) * 100) : 0;

            // bar chart data - daily total scores
            const scoreRecords = [...selectedStaffMonthRecords].reverse();
            const maxScore = Math.max(...scoreRecords.map(r => r.totalScore), 1);

            // performance vs cleanliness avg
            const scored = selectedStaffMonthRecords.filter(r => r.behavior && r.cleanliness);
            const avgPerf  = scored.length ? scored.reduce((s, r) => s + (r.behavior ?? 0), 0) / scored.length : 0;
            const avgClean = scored.length ? scored.reduce((s, r) => s + (r.cleanliness ?? 0), 0) / scored.length : 0;
            const avgNeg   = selectedStaffMonthRecords.reduce((s, r) => s + (r.negativeMarks ?? 0), 0) / (totalDays || 1);

            // pie chart - attendance split (CSS conic-gradient)
            const onTimeDeg = (selectedStaffSummary.onTime / (totalDays || 1)) * 360;
            const lateDeg   = (selectedStaffSummary.late   / (totalDays || 1)) * 360;
            const pieGradient = `conic-gradient(#10b981 0deg ${onTimeDeg}deg, #f59e0b ${onTimeDeg}deg ${onTimeDeg + lateDeg}deg, #ef4444 ${onTimeDeg + lateDeg}deg 360deg)`;

            return (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
                  <div className="stat-card">
                    <div>
                      <p className="stat-label">Employee</p>
                      <p className="text-base font-bold text-gray-900 mt-1 truncate">{selectedStaff.name}</p>
                    </div>
                    <span className={selectedStaff.type === 'ext' ? 'badge-blue' : 'badge-gray'}>{getStaffTypeLabel(selectedStaff.type)}</span>
                  </div>
                  <div className="stat-card">
                    <div>
                      <p className="stat-label">Avg Score</p>
                      <p className="stat-value text-gray-900">{selectedStaffSummary.avgScore.toFixed(1)}</p>
                    </div>
                    <span className="badge-blue">Month</span>
                  </div>
                  <div className="stat-card">
                    <div>
                      <p className="stat-label">On Time</p>
                      <p className="stat-value text-emerald-700">{selectedStaffSummary.onTime}</p>
                    </div>
                    <span className="badge-green">{onTimePct}%</span>
                  </div>
                  <div className="stat-card">
                    <div>
                      <p className="stat-label">Late / Leave</p>
                      <p className="stat-value text-amber-700">{selectedStaffSummary.late} / {selectedStaffSummary.leave}</p>
                    </div>
                    <span className="badge-yellow">Month</span>
                  </div>
                  <div className="stat-card">
                    <div>
                      <p className="stat-label">Add-On Sales</p>
                      <p className="stat-value text-sky-700">{selectedStaffSummary.addOnSales}</p>
                    </div>
                    <span className="badge-blue">Month</span>
                  </div>
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                  {/* Daily Score Bar Chart */}
                  <div className="card lg:col-span-2">
                    <p className="section-title mb-4">Daily Total Score</p>
                    {scoreRecords.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No scored records this month</p>
                    ) : (
                      <>
                        <div className="flex items-end gap-1 h-36">
                          {scoreRecords.map(r => (
                            <div key={r.id} className="flex-1 flex flex-col items-center gap-0.5 group">
                              <span className="text-[10px] font-semibold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">{r.totalScore.toFixed(1)}</span>
                              <div
                                className={`w-full rounded-t-md transition-all ${
                                  r.negativeMarks < 0 ? 'bg-red-400' :
                                  r.totalScore >= 20 ? 'bg-emerald-500' :
                                  r.totalScore >= 10 ? 'bg-sky-500' : 'bg-gray-300'
                                }`}
                                style={{ height: `${(r.totalScore / maxScore) * 120}px`, minHeight: r.totalScore > 0 ? '3px' : '0' }}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {scoreRecords.map(r => (
                            <div key={r.id} className="flex-1 text-center text-[10px] text-gray-400 truncate">{r.date.slice(8)}</div>
                          ))}
                        </div>
                        <div className="flex gap-4 mt-3 flex-wrap">
                          {[['bg-emerald-500','>=20 (High)'],['bg-sky-500','>=10 (Mid)'],['bg-gray-300','Low'],['bg-red-400','Negative']].map(([cls, lbl]) => (
                            <div key={lbl} className="flex items-center gap-1.5">
                              <span className={`w-3 h-3 rounded-sm ${cls}`} />
                              <span className="text-xs text-gray-500">{lbl}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Attendance Pie */}
                  <div className="card flex flex-col items-center justify-center gap-5">
                    <p className="section-title self-start">Attendance Split</p>
                    {totalDays === 0 ? (
                      <p className="text-sm text-gray-400">No records</p>
                    ) : (
                      <>
                        <div
                          className="w-36 h-36 rounded-full flex-shrink-0"
                          style={{ background: pieGradient }}
                        >
                          <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle, white 52%, transparent 52%)' }}>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-gray-900">{totalDays}</p>
                              <p className="text-xs text-gray-400">days</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 w-full">
                          {[['bg-emerald-500','On Time', selectedStaffSummary.onTime, onTimePct],
                            ['bg-amber-400', 'Late',    selectedStaffSummary.late,   latePct],
                            ['bg-red-500',   'Leave',   selectedStaffSummary.leave,  leavePct],
                          ].map(([cls, lbl, val, pct]) => (
                            <div key={String(lbl)} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${cls}`} />
                                <span className="text-sm text-gray-600">{lbl}</span>
                              </div>
                              <span className="text-sm font-semibold text-gray-900">{val} <span className="text-xs text-gray-400">({pct}%)</span></span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Performance breakdown bars */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="card">
                    <p className="section-title mb-4">Avg Performance Breakdown</p>
                    <div className="space-y-4">
                      {[['Performance', avgPerf, 10, 'bg-sky-500'],
                        ['Cleanliness', avgClean, 10, 'bg-emerald-500'],
                        ['Avg Negative', Math.abs(avgNeg), 10, 'bg-red-400'],
                      ].map(([lbl, val, max, cls]) => (
                        <div key={String(lbl)}>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{lbl}</span>
                            <span className="text-sm font-bold text-gray-900">{Number(val).toFixed(1)} / {max}</span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${cls}`} style={{ width: `${(Number(val) / Number(max)) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add-on sales bar chart */}
                  <div className="card">
                    <p className="section-title mb-4">Daily Add-On Sales</p>
                    {scoreRecords.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No records</p>
                    ) : (
                      <>
                        <div className="flex items-end gap-1 h-28">
                          {scoreRecords.map(r => {
                            const maxAddon = Math.max(...scoreRecords.map(x => x.addOnSaleCount ?? 0), 1);
                            return (
                              <div key={r.id} className="flex-1 flex flex-col items-center gap-0.5 group">
                                <span className="text-[10px] font-semibold text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity">{r.addOnSaleCount ?? 0}</span>
                                <div
                                  className="w-full rounded-t-md bg-sky-400 transition-all"
                                  style={{ height: `${((r.addOnSaleCount ?? 0) / maxAddon) * 96}px`, minHeight: (r.addOnSaleCount ?? 0) > 0 ? '3px' : '0' }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {scoreRecords.map(r => (
                            <div key={r.id} className="flex-1 text-center text-[10px] text-gray-400 truncate">{r.date.slice(8)}</div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Review history log */}
                <div className="card">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="section-title mb-1">Daily Log</p>
                      <p className="text-sm text-gray-500">Day-wise performance records for {selectedStaff.name}</p>
                    </div>
                    <span className="badge-yellow">{monthFilter}</span>
                  </div>
                  {selectedStaffMonthRecords.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No records for this month.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {['Date','Status','Performance','Cleanliness','Negative','Overall','Total','Add-Ons','Comment'].map(h => (
                              <th key={h} className="py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-left pr-4">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedStaffMonthRecords.map(record => {
                            const sm = getStatusMeta(record.status);
                            return (
                              <tr key={record.id} className="border-b border-gray-50 table-row-hover">
                                <td className="py-3 font-medium text-gray-900 pr-4 whitespace-nowrap">{record.date}</td>
                                <td className="py-3 pr-4">
                                  <span className={`text-xs inline-flex px-2 py-0.5 rounded-full ${sm.className}`}>{sm.label}</span>
                                </td>
                                <td className="py-3 pr-4 text-gray-700">{record.behavior ?? '-'}</td>
                                <td className="py-3 pr-4 text-gray-700">{record.cleanliness ?? '-'}</td>
                                <td className={`py-3 pr-4 font-semibold ${(record.negativeMarks ?? 0) < 0 ? 'text-red-600' : 'text-gray-400'}`}>{record.negativeMarks ?? 0}</td>
                                <td className="py-3 pr-4 font-semibold text-gray-900">{record.overallPerformance.toFixed(1)}</td>
                                <td className="py-3 pr-4 font-bold text-gray-900">{record.totalScore.toFixed(1)}</td>
                                <td className="py-3 pr-4 text-sky-700 font-semibold">{record.addOnSaleCount ?? 0}</td>
                                <td className="py-3 text-gray-500 text-xs">{record.negativeComment || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {activeSection === 'add_staff' && (
        <div className="card max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-title mb-1">Add New Staff</p>
              <p className="text-sm text-gray-500">Create a staff member and record the joining date.</p>
            </div>
            <span className="badge-green">Manager</span>
          </div>

          <form onSubmit={handleAddStaff} className="space-y-3">
            <div>
              <label className="label">New Staff Name</label>
              <input
                className="input"
                value={addStaffForm.name}
                onChange={event => setAddStaffForm(current => ({ ...current, name: event.target.value }))}
                placeholder="Enter staff name"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={addStaffForm.type}
                  onChange={event => setAddStaffForm(current => ({ ...current, type: event.target.value as StaffMember['type'] }))}
                >
                  <option value="permanent">Permanent</option>
                  <option value="ext">Ext Staff</option>
                </select>
              </div>
              <div>
                <label className="label">Date of Joining</label>
                <input
                  type="date"
                  className="input"
                  value={addStaffForm.joinDate}
                  onChange={event => setAddStaffForm(current => ({ ...current, joinDate: event.target.value }))}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              <IconPlus size={15} />
              Add Staff Member
            </button>
          </form>
        </div>
      )}

      {activeSection === 'remove_staff' && (
        <div className="card">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="section-title mb-1">Remove Existing Staff</p>
                <p className="text-sm text-gray-500">Choose a staff member and capture the exit date before removing them from active lists.</p>
              </div>
              <span className="badge-red">Exit</span>
            </div>

            <div className="space-y-3 max-h-[28rem] overflow-y-auto scrollbar-thin pr-1">
              {state.staff.filter(member => member.active).sort((a, b) => a.name.localeCompare(b.name)).map(member => (
                <div key={member.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{getStaffTypeLabel(member.type)}</p>
                    </div>
                    <span className="badge-gray">{member.joinDate}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-3">
                    <input
                      type="date"
                      className="input"
                      value={staffExitDates[member.id] ?? selectedDate}
                      onChange={event => setStaffExitDates(current => ({ ...current, [member.id]: event.target.value }))}
                    />
                    <button type="button" className="btn-danger btn-sm" onClick={() => handleRemoveStaff(member.id)}>
                      <IconTrash size={14} />
                      Exit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="stat-card">
              <div>
                <p className="stat-label">Active Staff</p>
                <p className="stat-value">{daySummary.activeStaff}</p>
              </div>
              <span className="badge-gray">Day Wise</span>
            </div>
            <div className="stat-card">
              <div>
                <p className="stat-label">On Time</p>
                <p className="stat-value text-emerald-700">{daySummary.onTime}</p>
              </div>
              <span className="badge-green">Morning</span>
            </div>
            <div className="stat-card">
              <div>
                <p className="stat-label">Late</p>
                <p className="stat-value text-amber-700">{daySummary.late}</p>
              </div>
              <span className="badge-yellow">Monitor</span>
            </div>
            <div className="stat-card">
              <div>
                <p className="stat-label">Leave</p>
                <p className="stat-value text-red-700">{daySummary.leave}</p>
              </div>
              <span className="badge-red">Absent</span>
            </div>
            <div className="stat-card">
              <div>
                <p className="stat-label">Add-On Sales</p>
                <p className="stat-value text-sky-700">{daySummary.totalAddOnSales}</p>
              </div>
              <span className="badge-blue">Selected Day</span>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="section-title mb-1">Employee Dashboard</p>
                <p className="text-sm text-gray-500">Selected day summary for attendance and score tracking.</p>
              </div>
              <span className="badge-blue">View Points</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Average Score</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{daySummary.averageScore.toFixed(1)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Attendance Logged</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{recordsForDay.length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <p className="section-title mb-1">Staff Leaderboard</p>
                <p className="text-sm text-gray-500">Avg score, attendance, late, leave and add-on report by staff.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                  {(['monthly', 'yearly'] as const).map(p => (
                    <button key={p} type="button" onClick={() => setDashboardPeriod(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dashboardPeriod === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
                {dashboardPeriod === 'monthly'
                  ? <input type="month" className="input w-auto" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
                  : <input type="number" min={2020} max={2099} className="input w-24 text-center" value={dashboardYear} onChange={e => setDashboardYear(Number(e.target.value))} />
                }
                <button
                  type="button"
                  onClick={() => exportDashboardReport(leaderboard, dashboardPeriod === 'monthly' ? monthFilter : String(dashboardYear))}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Employee', 'Avg Score', 'Late Count', 'Leave Count', 'Attendance', 'Add-On Sales'].map(header => (
                      <th key={header} className={`py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 ${header === 'Employee' ? 'text-left' : 'text-right'}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr key={entry.staffId} className="border-b border-gray-50 table-row-hover">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                            {index + 1}
                          </span>
                          <span className="font-medium text-gray-900">{entry.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-semibold text-gray-900">{entry.avgScore.toFixed(2)}</td>
                      <td className="py-3 text-right text-amber-700 font-medium">{entry.lateCount}</td>
                      <td className="py-3 text-right text-red-700 font-medium">{entry.leaveCount}</td>
                      <td className="py-3 text-right text-gray-700">{entry.attendanceDays}</td>
                      <td className="py-3 text-right text-sky-700 font-medium">{entry.addOnSales}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card-flat flex flex-wrap items-center gap-3 justify-between">
        <div>
          <p className="font-semibold text-gray-900">Manager login</p>
          <p className="text-sm text-gray-500">Username `manager` is assigned to Mizhar Ali for this dashboard.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
          <IconCheck size={15} />
          Attendance, scoring, and staff maintenance are available in one place.
        </div>
      </div>
    </div>
  );
}
