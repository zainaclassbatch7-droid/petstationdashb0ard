import { useState, useEffect } from 'react';
import { useApp } from '@/store/AppContext';
import type { ZooAnimal } from '@/types';
import { IconAlert, IconBarChart, IconUser } from '@/components/Icons';

export default function Marketing() {
  const { state } = useApp();
  const [animals, setAnimals] = useState<ZooAnimal[]>([]);
  const [selected, setSelected] = useState<ZooAnimal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState<{
    totalScans: number; uniqueDevices: number; totalVisitors: number;
    topAnimals: { name: string; scan_count: number }[];
  } | null>(null);

  const BASE = state.settings.backendUrl;
  const TOKEN = state.settings.adminPassword;
  const headers = { 'Content-Type': 'application/json', 'x-admin-token': TOKEN };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [aRes, anRes] = await Promise.all([
          fetch(`${BASE}/api/admin/analytics`, { headers }),
          fetch(`${BASE}/api/admin/animals`, { headers }),
        ]);
        if (aRes.ok) setAnalytics(await aRes.json());
        if (anRes.ok) setAnimals(await anRes.json());
      } catch { setError('Cannot connect to backend'); }
      setLoading(false);
    };
    load();
  }, [BASE, TOKEN]);

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Marketing & Analytics</h2>
          <p className="page-subtitle">Visitor engagement and animal profile data</p>
        </div>
      </div>

      {error && (
        <div className="alert-error">
          <IconAlert size={16} className="flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Scans',          value: analytics.totalScans,    Icon: IconBarChart },
            { label: 'Unique Visitors',       value: analytics.uniqueDevices, Icon: IconUser },
            { label: 'Registered Visitors',   value: analytics.totalVisitors, Icon: IconUser },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div>
                <p className="stat-label">{s.label}</p>
                <p className="stat-value">{s.value}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <s.Icon size={17} className="text-gray-500" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {analytics?.topAnimals && analytics.topAnimals.length > 0 && (
          <div className="card">
            <p className="section-title">Most Scanned Animals</p>
            <div className="space-y-3">
              {analytics.topAnimals.slice(0, 8).map((a, i) => (
                <div key={a.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{a.name}</span>
                      <span className="text-xs text-gray-400">{a.scan_count} scans</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-900 rounded-full transition-all"
                        style={{ width: `${(a.scan_count / analytics.topAnimals[0].scan_count) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <p className="section-title">Animal Profiles</p>
          {loading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
              {animals.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelected(selected?.id === a.id ? null : a)}
                  className="w-full text-left p-3 border border-gray-100 rounded-xl hover:border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {a.image_url && <img src={a.image_url} alt={a.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-100" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{a.name}</p>
                      <p className="text-xs text-gray-400 truncate">{a.species}</p>
                    </div>
                    <span className={`badge flex-shrink-0 ${
                      a.conservation_status === 'Endangered' ? 'badge-red' :
                      a.conservation_status === 'Vulnerable' ? 'badge-yellow' : 'badge-green'
                    }`}>
                      {a.conservation_status}
                    </span>
                  </div>
                  {selected?.id === a.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600 space-y-1.5">
                      {a.habitat  && <p><span className="font-medium text-gray-700">Habitat:</span> {a.habitat}</p>}
                      {a.diet     && <p><span className="font-medium text-gray-700">Diet:</span> {a.diet}</p>}
                      {a.lifespan && <p><span className="font-medium text-gray-700">Lifespan:</span> {a.lifespan}</p>}
                      {a.description && <p className="text-xs text-gray-400 mt-2 leading-relaxed">{a.description}</p>}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
