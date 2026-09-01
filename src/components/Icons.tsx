interface IconProps { className?: string; size?: number; }
const i = (d: string) => ({ className, size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);
const ip = (paths: string[]) => ({ className, size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
    {paths.map((d, k) => <path key={k} d={d} />)}
  </svg>
);

export const IconDashboard   = ip(['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10']);
export const IconBilling     = ip(['M20 12V22H4V12', 'M22 7H2v5h20V7z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z']);
export const IconExpenses    = ip(['M12 2v20', 'M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6']);
export const IconReports     = ip(['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8']);
export const IconLedgers     = ip(['M4 19.5A2.5 2.5 0 016.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z']);
export const IconQR          = ip(['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M17 17h4', 'M17 20v1h4']);
export const IconMarketing   = ip(['M22 12h-4l-3 9L9 3l-3 9H2']);
export const IconUsers       = ip(['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M9 11a4 4 0 100-8 4 4 0 000 8z', 'M23 21v-2a4 4 0 00-3-3.87', 'M16 3.13a4 4 0 010 7.75']);
export const IconSettings    = ip(['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z']);
export const IconLogout      = ip(['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4', 'M16 17l5-5-5-5', 'M21 12H9']);
export const IconPlus        = i('M12 5v14M5 12h14');
export const IconMinus       = i('M5 12h14');
export const IconTrash       = ip(['M3 6h18', 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2']);
export const IconEdit        = ip(['M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z']);
export const IconRefresh     = ip(['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15']);
export const IconDownload    = ip(['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3']);
export const IconEye         = ip(['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 100 6 3 3 0 000-6z']);
export const IconClose       = i('M18 6L6 18M6 6l12 12');
export const IconCheck       = i('M20 6L9 17l-5-5');
export const IconMenu        = ip(['M3 12h18', 'M3 6h18', 'M3 18h18']);
export const IconCloud       = ip(['M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z']);
export const IconAlert       = ip(['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', 'M12 9v4', 'M12 17h.01']);
export const IconKey         = ip(['M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4']);
export const IconLock        = ip(['M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z', 'M7 11V7a5 5 0 0110 0v4']);
export const IconTrendUp     = ip(['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6']);
export const IconTrendDown   = ip(['M23 18l-9.5-9.5-5 5L1 6', 'M17 18h6v-6']);
export const IconWallet      = ip(['M21 12V7H5a2 2 0 010-4h14v4', 'M3 5v14a2 2 0 002 2h16v-5', 'M18 12a2 2 0 000 4h4v-4z']);
export const IconReceipt     = ip(['M14 2H6a2 2 0 00-2 2v16l3-2 2 2 2-2 2 2 2-2 3 2V4a2 2 0 00-2-2z', 'M14 2v4h4', 'M8 13h2', 'M8 9h6', 'M8 17h2']);
export const IconBarChart    = ip(['M18 20V10', 'M12 20V4', 'M6 20v-6']);
export const IconShield      = ip(['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']);
export const IconUser        = ip(['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2', 'M12 11a4 4 0 100-8 4 4 0 000 8z']);
export const IconToggleOn    = ip(['M23 12a4 4 0 01-4 4H5a4 4 0 010-8h14a4 4 0 014 4z', 'M19 12a2 2 0 11-4 0 2 2 0 014 0z']);
export const IconToggleOff   = ip(['M1 12a4 4 0 004 4h14a4 4 0 000-8H5a4 4 0 00-4 4z', 'M9 12a2 2 0 11-4 0 2 2 0 014 0z']);
export const IconSave        = ip(['M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z', 'M17 21v-8H7v8', 'M7 3v5h8']);
export const IconExport      = ip(['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12']);
export const IconSync        = ip(['M1 4v6h6', 'M23 20v-6h-6', 'M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15']);
export const IconTicket      = ip(['M2 9a3 3 0 010-6h20a3 3 0 010 6', 'M2 15a3 3 0 000 6h20a3 3 0 000-6', 'M2 9h20v6H2z']);
export const IconBag         = ip(['M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 01-8 0']);
export const IconCalendar    = ip(['M3 4h18v18H3z', 'M16 2v4', 'M8 2v4', 'M3 10h18']);
export const IconInfo        = ip(['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M12 8h.01', 'M11 12h1v4h1']);
