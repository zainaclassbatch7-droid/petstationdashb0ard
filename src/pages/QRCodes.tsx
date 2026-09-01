import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { useApp } from '@/store/AppContext';
import type { QRCode, ZooAnimal } from '@/types';
import {
  IconAlert,
  IconBarChart,
  IconClose,
  IconDashboard,
  IconDownload,
  IconEdit,
  IconEye,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUser,
} from '@/components/Icons';

type Tab = 'qrcodes' | 'dashboard';

type AnalyticsSummary = {
  totalScans: number;
  uniqueDevices: number;
  totalVisitors: number;
  topAnimals: { name: string; scan_count: number }[];
};

type AnimalDraft = {
  name: string;
  species: string;
  description: string;
  habitat: string;
  diet: string;
  lifespan: string;
  conservation_status: string;
  image_url: string;
  video_url: string;
  factsText: string;
  linksText: string;
  custom_content: string;
};

const EMPTY_ANIMAL_DRAFT: AnimalDraft = {
  name: '',
  species: '',
  description: '',
  habitat: '',
  diet: '',
  lifespan: '',
  conservation_status: 'Least Concern',
  image_url: '',
  video_url: '',
  factsText: '',
  linksText: '',
  custom_content: '',
};

function AnimalSelect({ animals, value, onChange }: {
  animals: ZooAnimal[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = animals.filter(a =>
    !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.species.toLowerCase().includes(q.toLowerCase()),
  );
  const selected = animals.find(a => a.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQ(''); }}
        className="input text-xs py-1 w-full text-left flex items-center justify-between gap-1"
      >
        <span className="truncate">{selected ? `${selected.name} (${selected.species})` : 'Unassigned'}</span>
        <span className="text-gray-400 flex-shrink-0">v</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-gray-400"
              placeholder="Search animal..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <div className="max-h-44 overflow-y-auto scrollbar-thin">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${!value ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
            >
              Unassigned
            </button>
            {filtered.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => { onChange(a.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${value === a.id ? 'font-semibold text-gray-900 bg-gray-50' : 'text-gray-700'}`}
              >
                {a.name} <span className="text-gray-400">({a.species})</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No results</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function formatLinksText(links: ZooAnimal['links']) {
  return (links || []).map(link => `${link.label} | ${link.url}`).join('\n');
}

function parseLinksText(linksText: string) {
  return linksText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [label, ...rest] = line.split('|');
      return label && rest.length ? { label: label.trim(), url: rest.join('|').trim() } : null;
    })
    .filter((item): item is { label: string; url: string } => Boolean(item?.label && item.url));
}

export default function QRCodes() {
  const { state } = useApp();
  const [tab, setTab] = useState<Tab>('qrcodes');

  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [animals, setAnimals] = useState<ZooAnimal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [label, setLabel] = useState('');
  const [location, setLocation] = useState('');
  const [animalId, setAnimalId] = useState('');
  const [viewQR, setViewQR] = useState<QRCode | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const [selected, setSelected] = useState<ZooAnimal | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [animalSearch, setAnimalSearch] = useState('');
  const [showAnimalForm, setShowAnimalForm] = useState(false);
  const [editingAnimalId, setEditingAnimalId] = useState<string | null>(null);
  const [animalDraft, setAnimalDraft] = useState<AnimalDraft>(EMPTY_ANIMAL_DRAFT);
  const [savingAnimal, setSavingAnimal] = useState(false);

  const BASE = state.settings.backendUrl;
  const TOKEN = state.settings.adminPassword;
  const headers = { 'Content-Type': 'application/json', 'x-admin-token': TOKEN };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [qRes, aRes, anRes] = await Promise.all([
        fetch(`${BASE}/api/admin/qrcodes`, { headers }),
        fetch(`${BASE}/api/admin/animals`, { headers }),
        fetch(`${BASE}/api/admin/analytics`, { headers }),
      ]);

      if (!qRes.ok) throw new Error('Authentication failed. Check backend URL and token in Settings.');

      setQrCodes(await qRes.json());
      if (aRes.ok) setAnimals(await aRes.json());
      if (anRes.ok) setAnalytics(await anRes.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [BASE, TOKEN]);

  const createQR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    try {
      await fetch(`${BASE}/api/admin/qrcodes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ label, location, animal_id: animalId || null }),
      });
      setLabel('');
      setLocation('');
      setAnimalId('');
      setShowForm(false);
      load();
    } catch {
      setError('Failed to create QR code.');
    }
  };

  const deleteQR = async (token: string) => {
    if (!confirm('Delete this QR code?')) return;
    await fetch(`${BASE}/api/admin/qrcodes/${token}`, { method: 'DELETE', headers });
    load();
  };

  const reassign = async (token: string, nextAnimalId: string) => {
    await fetch(`${BASE}/api/admin/qrcodes/${token}/assign`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ animal_id: nextAnimalId || null }),
    });
    load();
  };

  const openAnimalForm = (animal?: ZooAnimal) => {
    setEditingAnimalId(animal?.id ?? null);
    setAnimalDraft(animal ? {
      name: animal.name || '',
      species: animal.species || '',
      description: animal.description || '',
      habitat: animal.habitat || '',
      diet: animal.diet || '',
      lifespan: animal.lifespan || '',
      conservation_status: animal.conservation_status || 'Least Concern',
      image_url: animal.image_url || '',
      video_url: animal.video_url || '',
      factsText: (animal.fun_facts || []).join('\n'),
      linksText: formatLinksText(animal.links || []),
      custom_content: animal.custom_content || '',
    } : EMPTY_ANIMAL_DRAFT);
    setShowAnimalForm(true);
  };

  const closeAnimalForm = () => {
    setShowAnimalForm(false);
    setEditingAnimalId(null);
    setAnimalDraft(EMPTY_ANIMAL_DRAFT);
  };

  const saveAnimal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animalDraft.name.trim()) {
      setError('Animal name is required.');
      return;
    }

    setSavingAnimal(true);
    setError('');

    const body = {
      name: animalDraft.name.trim(),
      species: animalDraft.species.trim(),
      description: animalDraft.description.trim(),
      habitat: animalDraft.habitat.trim(),
      diet: animalDraft.diet.trim(),
      lifespan: animalDraft.lifespan.trim(),
      conservation_status: animalDraft.conservation_status.trim(),
      image_url: animalDraft.image_url.trim(),
      video_url: animalDraft.video_url.trim(),
      fun_facts: animalDraft.factsText.split('\n').map(item => item.trim()).filter(Boolean),
      links: parseLinksText(animalDraft.linksText),
      custom_content: animalDraft.custom_content.trim(),
    };

    try {
      await fetch(
        editingAnimalId ? `${BASE}/api/admin/animals/${editingAnimalId}` : `${BASE}/api/admin/animals`,
        {
          method: editingAnimalId ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify(body),
        },
      );
      closeAnimalForm();
      load();
    } catch {
      setError('Failed to save animal profile.');
    } finally {
      setSavingAnimal(false);
    }
  };

  const deleteAnimal = async (animal: ZooAnimal) => {
    if (!confirm(`Delete "${animal.name}"? This cannot be undone.`)) return;
    await fetch(`${BASE}/api/admin/animals/${animal.id}`, { method: 'DELETE', headers });
    if (selected?.id === animal.id) setSelected(null);
    load();
  };

  const filtered = qrCodes.filter(qr => {
    const q = search.toLowerCase();
    if (!q) return true;
    const animal = animals.find(a => a.id === qr.animal_id);
    return qr.label.toLowerCase().includes(q)
      || (qr.location || '').toLowerCase().includes(q)
      || (animal?.name || '').toLowerCase().includes(q)
      || (animal?.species || '').toLowerCase().includes(q);
  });

  const filteredAnimals = animals.filter(animal => {
    const q = animalSearch.toLowerCase();
    if (!q) return true;
    return animal.name.toLowerCase().includes(q) || animal.species.toLowerCase().includes(q);
  });

  const downloadAll = async () => {
    setDownloadingAll(true);
    const zip = new JSZip();
    for (const qr of filtered) {
      if (!qr.qr_image) continue;
      const base64 = qr.qr_image.split(',')[1];
      zip.file(`${qr.label.replace(/[^a-zA-Z0-9\-_]/g, '-')}.png`, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'PetStation-QRCodes.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    setDownloadingAll(false);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'qrcodes', label: 'QR Codes' },
    { id: 'dashboard', label: 'Dashboard' },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">QR Dashboard</h2>
          <p className="page-subtitle">Manage QR codes, animal profiles, dashboard content, and visitor analytics</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary gap-2">
          <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="alert-error">
          <IconAlert size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">{error}</p>
            <p className="text-xs mt-0.5 text-red-600">Make sure the zoo backend is running and the URL / token in Settings is correct.</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
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

      {tab === 'qrcodes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <input
                className="input w-full sm:w-64"
                placeholder="Search label, location or animal..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="flex gap-2 text-sm">
                <span className="bg-gray-100 rounded-lg px-3 py-1.5 font-medium text-gray-600">{qrCodes.length} total</span>
                <span className="bg-emerald-50 text-emerald-700 rounded-lg px-3 py-1.5 font-medium">{qrCodes.filter(q => q.animal_id).length} assigned</span>
                <span className="bg-amber-50 text-amber-700 rounded-lg px-3 py-1.5 font-medium">{qrCodes.filter(q => !q.animal_id).length} unassigned</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={downloadAll} disabled={downloadingAll || filtered.length === 0} className="btn-secondary gap-2">
                <IconDownload size={14} />
                {downloadingAll ? 'Downloading...' : `Download All (${filtered.length})`}
              </button>
              <button onClick={() => setShowForm(true)} className="btn-primary gap-2">
                <IconPlus size={14} /> New QR Code
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-400 text-sm">Loading QR codes...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              {search ? 'No QR codes match your search.' : 'No QR codes yet. Create one to get started.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {filtered.map(qr => {
                const animal = animals.find(a => a.id === qr.animal_id);
                return (
                  <div key={qr.token} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-gray-200 transition-all flex flex-col">
                    <div className="bg-gray-50 flex items-center justify-center p-5 cursor-pointer aspect-square" onClick={() => setViewQR(qr)}>
                      {qr.qr_image
                        ? <img src={qr.qr_image} alt={qr.label} className="w-full h-full object-contain" />
                        : <div className="text-gray-300 text-xs">No image</div>}
                    </div>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm truncate">{qr.label}</p>
                        {qr.location && <p className="text-xs text-gray-400 truncate">{qr.location}</p>}
                      </div>
                      {animal ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                          <span className="text-xs text-emerald-700 font-medium truncate">{animal.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                          <span className="text-xs text-amber-600 font-medium">Unassigned</span>
                        </div>
                      )}
                      <AnimalSelect animals={animals} value={qr.animal_id || ''} onChange={id => reassign(qr.token, id)} />
                      <div className="flex gap-1.5 mt-1">
                        <button onClick={() => setViewQR(qr)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-all">
                          <IconEye size={12} /> View
                        </button>
                        {qr.qr_image && (
                          <a href={qr.qr_image} download={`${qr.label.replace(/\s+/g, '-')}.png`} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-all">
                            <IconDownload size={12} />
                          </a>
                        )}
                        <button onClick={() => deleteQR(qr.token)} className="flex items-center justify-center px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-red-400 hover:border-red-300 hover:bg-red-50 transition-all">
                          <IconTrash size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'dashboard' && (
        <div className="space-y-5">
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Total Scans', value: analytics.totalScans, Icon: IconBarChart },
                { label: 'Unique Visitors', value: analytics.uniqueDevices, Icon: IconUser },
                { label: 'Registered Visitors', value: analytics.totalVisitors, Icon: IconUser },
              ].map(stat => (
                <div key={stat.label} className="stat-card">
                  <div>
                    <p className="stat-label">{stat.label}</p>
                    <p className="stat-value">{stat.value}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <stat.Icon size={17} className="text-gray-500" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.35fr] gap-5">
            <div className="space-y-5">
              {analytics?.topAnimals && analytics.topAnimals.length > 0 && (
                <div className="card">
                  <p className="section-title">Most Scanned Animals</p>
                  <div className="space-y-3 mt-3">
                    {analytics.topAnimals.slice(0, 8).map((animal, index) => (
                      <div key={animal.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-300 w-4 text-right">{index + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">{animal.name}</span>
                            <span className="text-xs text-gray-400">{animal.scan_count} scans</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${(animal.scan_count / analytics.topAnimals[0].scan_count) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="section-title">Animal Dashboard Content</p>
                    <p className="text-xs text-gray-500 mt-1">Edit profile copy, dashboard links, media, and custom content.</p>
                  </div>
                  <button onClick={() => openAnimalForm()} className="btn-primary gap-2">
                    <IconPlus size={14} /> Add Animal
                  </button>
                </div>
                <div className="mt-3">
                  <input
                    className="input"
                    placeholder="Search animal name or species..."
                    value={animalSearch}
                    onChange={e => setAnimalSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-[32rem] overflow-y-auto scrollbar-thin mt-3">
                  {filteredAnimals.map(animal => (
                    <div
                      key={animal.id}
                      className="w-full text-left p-3 border border-gray-100 rounded-xl hover:border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <button type="button" onClick={() => setSelected(selected?.id === animal.id ? null : animal)} className="w-full text-left">
                        <div className="flex items-center gap-3">
                          {animal.image_url
                            ? <img src={animal.image_url} alt={animal.name} className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                            : <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0"><IconDashboard size={16} /></div>}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{animal.name}</p>
                            <p className="text-xs text-gray-400 truncate">{animal.species || 'No species yet'}</p>
                          </div>
                          <span className={`badge flex-shrink-0 ${
                            animal.conservation_status === 'Endangered' ? 'badge-red'
                              : animal.conservation_status === 'Vulnerable' ? 'badge-yellow'
                                : 'badge-green'
                          }`}
                          >
                            {animal.conservation_status || 'Unknown'}
                          </span>
                        </div>
                      </button>

                      {selected?.id === animal.id && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600 space-y-2">
                          {animal.habitat && <p><span className="font-medium text-gray-700">Habitat:</span> {animal.habitat}</p>}
                          {animal.diet && <p><span className="font-medium text-gray-700">Diet:</span> {animal.diet}</p>}
                          {animal.lifespan && <p><span className="font-medium text-gray-700">Lifespan:</span> {animal.lifespan}</p>}
                          {animal.description && <p className="text-xs text-gray-500 leading-relaxed">{animal.description}</p>}

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-gray-400 uppercase tracking-wide">Facts</p>
                              <p className="font-semibold text-gray-800 mt-1">{animal.fun_facts?.length || 0}</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-gray-400 uppercase tracking-wide">Links</p>
                              <p className="font-semibold text-gray-800 mt-1">{animal.links?.length || 0}</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-gray-400 uppercase tracking-wide">Custom</p>
                              <p className="font-semibold text-gray-800 mt-1">{animal.custom_content ? 'Yes' : 'No'}</p>
                            </div>
                          </div>

                          {animal.links?.length ? (
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Dashboard Links</p>
                              <div className="space-y-1">
                                {animal.links.slice(0, 3).map(link => (
                                  <p key={`${link.label}-${link.url}`} className="text-xs text-gray-600 truncate">{link.label}</p>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {animal.custom_content ? (
                            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              {animal.custom_content.length > 140 ? `${animal.custom_content.slice(0, 140)}...` : animal.custom_content}
                            </div>
                          ) : null}

                          <div className="flex gap-2 pt-1 flex-wrap">
                            <button type="button" onClick={e => { e.stopPropagation(); openAnimalForm(animal); }} className="btn-secondary gap-2">
                              <IconEdit size={14} /> Edit
                            </button>
                            <a
                              href={`${BASE}/dashboards?id=${animal.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="btn-secondary gap-2"
                            >
                              <IconEye size={14} /> View Dashboard
                            </a>
                            <button type="button" onClick={e => { e.stopPropagation(); deleteAnimal(animal); }} className="btn-secondary gap-2 text-red-500 border-red-200 hover:bg-red-50">
                              <IconTrash size={14} /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {!filteredAnimals.length && <p className="text-sm text-gray-400 py-4 text-center">No animals found.</p>}
                </div>
              </div>
            </div>

            <div className="card">
              <p className="section-title">Dashboard Content Guide</p>
              <div className="mt-3 space-y-3 text-sm text-gray-600">
                <p>Each animal profile now supports the same content model used by the zoo QR dashboard: description text, fun facts, links, media URLs, and custom content.</p>
                <div className="rounded-xl bg-gray-50 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Links format</p>
                  <p className="text-xs text-gray-600">Use one line per link in this format:</p>
                  <code className="block text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700">Learn more | https://example.com</code>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Custom content</p>
                  <p className="text-xs text-gray-600">Add extra dashboard copy or HTML-supported content that should appear beneath the standard animal details.</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 text-xs text-emerald-800">
                  Use <span className="font-semibold">View Dashboard</span> on an animal card to preview how the public animal dashboard will open from the QR system.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Create QR Code</h3>
              <button onClick={() => setShowForm(false)} className="btn-icon"><IconClose size={16} /></button>
            </div>
            <form onSubmit={createQR} className="space-y-3">
              <div>
                <label className="label">Label *</label>
                <input className="input" placeholder="e.g. Enclosure A" value={label} onChange={e => setLabel(e.target.value)} required />
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" placeholder="e.g. Zone 1" value={location} onChange={e => setLocation(e.target.value)} />
              </div>
              <div>
                <label className="label">Assign Animal</label>
                <AnimalSelect animals={animals} value={animalId} onChange={setAnimalId} />
              </div>
              <button type="submit" className="btn-primary w-full">Generate QR Code</button>
            </form>
          </div>
        </div>
      )}

      {showAnimalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeAnimalForm}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{editingAnimalId ? 'Edit Animal Dashboard' : 'Add Animal Dashboard'}</h3>
                <p className="text-sm text-gray-500 mt-1">Update public dashboard text, links, and media for this animal.</p>
              </div>
              <button onClick={closeAnimalForm} className="btn-icon"><IconClose size={16} /></button>
            </div>

            <form onSubmit={saveAnimal} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Animal Name *</label>
                  <input className="input" value={animalDraft.name} onChange={e => setAnimalDraft(prev => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Species</label>
                  <input className="input" value={animalDraft.species} onChange={e => setAnimalDraft(prev => ({ ...prev, species: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Habitat</label>
                  <input className="input" value={animalDraft.habitat} onChange={e => setAnimalDraft(prev => ({ ...prev, habitat: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Diet</label>
                  <input className="input" value={animalDraft.diet} onChange={e => setAnimalDraft(prev => ({ ...prev, diet: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Lifespan</label>
                  <input className="input" value={animalDraft.lifespan} onChange={e => setAnimalDraft(prev => ({ ...prev, lifespan: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Conservation Status</label>
                  <select className="input" value={animalDraft.conservation_status} onChange={e => setAnimalDraft(prev => ({ ...prev, conservation_status: e.target.value }))}>
                    {['Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Critically Endangered'].map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Image URL</label>
                  <input className="input" value={animalDraft.image_url} onChange={e => setAnimalDraft(prev => ({ ...prev, image_url: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Video URL</label>
                  <input className="input" value={animalDraft.video_url} onChange={e => setAnimalDraft(prev => ({ ...prev, video_url: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-28" value={animalDraft.description} onChange={e => setAnimalDraft(prev => ({ ...prev, description: e.target.value }))} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Fun Facts</label>
                  <textarea
                    className="input min-h-36"
                    placeholder={'One fact per line'}
                    value={animalDraft.factsText}
                    onChange={e => setAnimalDraft(prev => ({ ...prev, factsText: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Dashboard Links</label>
                  <textarea
                    className="input min-h-36"
                    placeholder={'One link per line\nLabel | https://example.com'}
                    value={animalDraft.linksText}
                    onChange={e => setAnimalDraft(prev => ({ ...prev, linksText: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">Custom Content</label>
                <textarea
                  className="input min-h-32"
                  placeholder="Extra dashboard text or custom HTML-supported content"
                  value={animalDraft.custom_content}
                  onChange={e => setAnimalDraft(prev => ({ ...prev, custom_content: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeAnimalForm} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={savingAnimal} className="btn-primary gap-2">
                  {savingAnimal ? 'Saving...' : 'Save Animal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewQR && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewQR(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl flex overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex-1 bg-gray-50 flex items-center justify-center p-10">
              <img src={viewQR.qr_image} alt={viewQR.label} className="w-full max-w-[260px] rounded-2xl border border-gray-200 shadow-sm" />
            </div>

            <div className="w-80 flex flex-col p-6 gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{viewQR.label}</h3>
                  {viewQR.location && <p className="text-sm text-gray-400 mt-0.5">{viewQR.location}</p>}
                </div>
                <button onClick={() => setViewQR(null)} className="btn-icon flex-shrink-0"><IconClose size={16} /></button>
              </div>

              <p className="text-xs text-gray-400 break-all bg-gray-50 rounded-xl px-3 py-2">{state.settings.backendUrl}/scan/{viewQR.token}</p>

              <div className="flex-1">
                <label className="label mb-1">Assigned Animal</label>
                <AnimalSelect
                  animals={animals}
                  value={viewQR.animal_id || ''}
                  onChange={id => {
                    reassign(viewQR.token, id);
                    setViewQR(prev => prev ? { ...prev, animal_id: id || null } : prev);
                  }}
                />
                {(() => {
                  const animal = animals.find(a => a.id === viewQR.animal_id);
                  return animal ? (
                    <div className="mt-3 p-3 bg-emerald-50 rounded-xl space-y-1">
                      <p className="text-sm font-semibold text-emerald-900">{animal.name}</p>
                      <p className="text-xs text-emerald-700">{animal.species}</p>
                    </div>
                  ) : (
                    <div className="mt-3 p-3 bg-amber-50 rounded-xl">
                      <p className="text-xs text-amber-700">No animal assigned to this QR code</p>
                    </div>
                  );
                })()}
              </div>

              <div className="flex flex-col gap-2 mt-auto">
                <a href={viewQR.qr_image} download={`${viewQR.label.replace(/\s+/g, '-')}.png`} className="btn-primary w-full gap-2 flex items-center justify-center py-3">
                  <IconDownload size={14} /> Download QR
                </a>
                <button onClick={() => { deleteQR(viewQR.token); setViewQR(null); }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors">
                  <IconTrash size={14} /> Delete QR Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
