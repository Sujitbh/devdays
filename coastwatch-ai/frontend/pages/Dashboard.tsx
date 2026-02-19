
import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import {
  TrendingUp, Users, Target, Activity, ShieldAlert, Zap, Cpu, Loader2,
  Bird, Eye, AlertTriangle, MapPin, Clock, ChevronRight, Layers,
  TreePine, Waves, Mountain, Droplets, Camera, FileImage,
  Download, FileSpreadsheet, Filter, X, Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { DashboardStats, DetectionRecord } from '../types';

const PIE_COLORS = ['#0d9488', '#0891b2', '#7c3aed', '#e11d48', '#f59e0b', '#10b981', '#6366f1', '#ec4899'];

const HABITAT_ICONS: Record<string, any> = {
  'Marsh': TreePine,
  'Barrier Island': Mountain,
  'Swamp': Droplets,
  'Open Water': Waves,
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDetections, setRecentDetections] = useState<DetectionRecord[]>([]);
  const [modelStatus, setModelStatus] = useState<{ loaded: boolean; checked: boolean }>({ loaded: false, checked: false });
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportOpts, setExportOpts] = useState({ species: '', habitat: '', minConf: '', includeBoxes: false });

  useEffect(() => {
    Promise.all([
      api.getStats().catch(() => ({
        totalImages: 0, totalDetections: 0, nestsDetected: 0,
        speciesCount: 0, speciesList: [], landLossAlerts: 0,
      })),
      api.getDetections().catch(() => []),
      api.health().catch(() => ({ model_loaded: false })),
    ]).then(([s, d, h]) => {
      setStats(s as DashboardStats);
      setRecentDetections(d as DetectionRecord[]);
      setModelStatus({ loaded: (h as any).model_loaded, checked: true });
      setLoading(false);
    });
  }, []);

  // ── Derived chart data ────────────────────────────────────────────────
  const speciesData = recentDetections.length > 0
    ? Object.entries(
        recentDetections.reduce((acc, d) => {
          acc[d.species] = (acc[d.species] || 0) + d.count;
          return acc;
        }, {} as Record<string, number>)
      ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    : [{ name: 'Awaiting scans', value: 1 }];

  const habitatData = recentDetections.length > 0
    ? Object.entries(
        recentDetections.reduce((acc, d) => {
          acc[d.habitatType] = (acc[d.habitatType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([name, count]) => ({ name, count }))
    : [];

  const threatCounts = recentDetections.length > 0
    ? Object.entries(
        recentDetections.flatMap(d => d.threats || []).reduce((acc, t) => {
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : [];

  const timelineData = recentDetections.length > 0
    ? recentDetections.slice(0, 20).reverse().map((d, i) => ({
        name: new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        detections: d.count,
        confidence: Math.round(d.confidence * 100),
      }))
    : [
        { name: 'Feb', detections: 0, confidence: 0 },
        { name: 'Mar', detections: 0, confidence: 0 },
      ];

  const totalAnimals = recentDetections.reduce((s, d) => s + d.count, 0);
  const avgConfidence = recentDetections.length > 0
    ? recentDetections.reduce((s, d) => s + d.confidence, 0) / recentDetections.length
    : 0;
  const nestingCount = recentDetections.filter(d => d.nestingDetected).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 size={40} className="text-teal-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-bold">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Conservation Overview</h2>
          <p className="text-slate-500 mt-1">Real-time status of Louisiana's coastal habitat monitoring.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/analyzer" className="bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all">
            <Zap size={18} /> New Analysis
          </Link>
          <div className="relative">
            <button onClick={() => { setShowExport(!showExport); setExportDone(false); }} className="bg-white px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
              <Download size={16} /> Export
            </button>
            {showExport && (
              <div className="absolute right-0 top-12 z-50 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet size={16} className="text-teal-600" /> Export Report</h4>
                  <button onClick={() => setShowExport(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Filter by Species</label>
                    <input value={exportOpts.species} onChange={e => setExportOpts(p => ({...p, species: e.target.value}))} placeholder="e.g. Pelican" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Filter by Habitat</label>
                    <input value={exportOpts.habitat} onChange={e => setExportOpts(p => ({...p, habitat: e.target.value}))} placeholder="e.g. Marsh" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Min Confidence (%)</label>
                    <input type="number" min={0} max={100} value={exportOpts.minConf} onChange={e => setExportOpts(p => ({...p, minConf: e.target.value}))} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={exportOpts.includeBoxes} onChange={e => setExportOpts(p => ({...p, includeBoxes: e.target.checked}))} className="accent-teal-600 w-4 h-4" />
                    Include bounding box details
                  </label>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        await api.exportCSV({
                          species: exportOpts.species || undefined,
                          habitat: exportOpts.habitat || undefined,
                          minConfidence: exportOpts.minConf ? Number(exportOpts.minConf) / 100 : undefined,
                          includeBoxes: exportOpts.includeBoxes,
                        });
                        setExportDone(true);
                        setTimeout(() => setShowExport(false), 1200);
                      } finally { setExporting(false); }
                    }}
                    className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-teal-700 transition-all disabled:opacity-50"
                  >
                    {exporting ? <><Loader2 size={14} className="animate-spin" /> Exporting...</> : exportDone ? <><Check size={14} /> Downloaded!</> : <><Download size={14} /> Download CSV</>}
                  </button>
                  <button
                    disabled={exporting}
                    onClick={async () => { setExporting(true); try { await api.exportGeoJSON(); setExportDone(true); setTimeout(() => setShowExport(false), 1200); } finally { setExporting(false); } }}
                    className="bg-slate-100 text-slate-700 py-2.5 px-4 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    GeoJSON
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center">Report includes summary statistics & species breakdown</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Survey Images', value: stats?.totalImages ?? 0, icon: Camera, color: 'teal', sub: 'total scans' },
          { label: 'Total Detections', value: totalAnimals, icon: Target, color: 'cyan', sub: 'wildlife objects' },
          { label: 'Active Nests', value: nestingCount, icon: Bird, color: 'emerald', sub: 'confirmed sites' },
          { label: 'Species Found', value: stats?.speciesCount ?? 0, icon: Layers, color: 'violet', sub: speciesData[0]?.name !== 'Awaiting scans' ? speciesData[0]?.name : '—' },
          { label: 'Avg Confidence', value: `${(avgConfidence * 100).toFixed(0)}%`, icon: Eye, color: 'blue', sub: 'detection avg' },
          { label: 'Threat Alerts', value: threatCounts.length, icon: ShieldAlert, color: 'red', sub: threatCounts.length > 0 ? threatCounts[0][0] : 'none' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-xl bg-${kpi.color}-50 text-${kpi.color}-600 group-hover:scale-110 transition-transform`}>
                <kpi.icon size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-800">{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{kpi.label}</p>
            <p className="text-[9px] text-slate-300 font-medium truncate mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Row 2: Timeline Chart + Species Breakdown ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detection Timeline */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Detection Timeline</h3>
              <p className="text-xs text-slate-400 mt-0.5">Wildlife detections across recent survey sessions</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-teal-500 rounded-full" /> Detections</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-violet-500 rounded-full" /> Confidence %</span>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="gradDet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradConf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: 12 }}
                  cursor={{ stroke: '#0d9488', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="detections" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#gradDet)" />
                <Area type="monotone" dataKey="confidence" stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#gradConf)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Species Donut */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Species Breakdown</h3>
          <p className="text-xs text-slate-400 mb-4">{speciesData.length} species identified</p>
          <div className="flex-1 flex items-center justify-center">
            <div className="relative">
              <PieChart width={200} height={200}>
                <Pie
                  data={speciesData}
                  cx={100}
                  cy={100}
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {speciesData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }}
                />
              </PieChart>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-black text-slate-800">{totalAnimals}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Total</p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {speciesData.slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-600 font-medium truncate max-w-[130px]">{s.name}</span>
                </div>
                <span className="font-bold text-slate-800">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Habitat + Threats + Recent Activity ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Habitat Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Habitat Distribution</h3>
          <p className="text-xs text-slate-400 mb-5">Survey coverage by habitat type</p>
          {habitatData.length > 0 ? (
            <div className="space-y-3">
              {habitatData.map((h, i) => {
                const Icon = HABITAT_ICONS[h.name] || MapPin;
                const pct = Math.round((h.count / recentDetections.length) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className="text-teal-500" />
                        <span className="text-sm font-bold text-slate-700">{h.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-500">{h.count} scans · {pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${PIE_COLORS[i % PIE_COLORS.length]}, ${PIE_COLORS[(i + 1) % PIE_COLORS.length]})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 opacity-50">
              <MapPin size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-400 font-bold">No habitat data yet</p>
            </div>
          )}
        </div>

        {/* Threat Summary */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Active Threats</h3>
          <p className="text-xs text-slate-400 mb-5">Top threats from recent analyses</p>
          {threatCounts.length > 0 ? (
            <div className="space-y-2.5">
              {threatCounts.map(([threat, count], i) => (
                <div key={i} className="flex items-center gap-3 bg-red-50/50 border border-red-100 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{threat}</p>
                  </div>
                  <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{count}×</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 opacity-50">
              <ShieldAlert size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-400 font-bold">No threats detected</p>
            </div>
          )}
        </div>

        {/* Model & System Status */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Cpu size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">AI Engine</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">System Status</p>
            </div>
          </div>

          <div className="space-y-4 flex-1">
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3.5 py-2.5">
              <span className="text-xs font-medium text-slate-500">Model</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${modelStatus.loaded ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-600'}`}>
                {modelStatus.checked ? (modelStatus.loaded ? 'YOLOv8 Ready' : 'Offline') : 'Checking...'}
              </span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3.5 py-2.5">
              <span className="text-xs font-medium text-slate-500">Backend</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Connected</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3.5 py-2.5">
              <span className="text-xs font-medium text-slate-500">Detections</span>
              <span className="text-xs font-bold text-slate-700">{stats?.totalDetections ?? 0} processed</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3.5 py-2.5">
              <span className="text-xs font-medium text-slate-500">Species DB</span>
              <span className="text-xs font-bold text-slate-700">{stats?.speciesCount ?? 0} catalogued</span>
            </div>

            <div className="p-3 border border-dashed border-slate-200 rounded-xl flex flex-col items-center text-center mt-auto">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Processing Nodes</p>
              <div className="flex gap-0.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-4 rounded-sm ${modelStatus.loaded ? 'bg-emerald-500' : i < 3 ? 'bg-orange-400' : 'bg-slate-200'}`}
                    style={{ animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </div>
              <p className="text-[9px] text-slate-400 mt-1.5">{modelStatus.loaded ? '12/12 online' : '3/12 online'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 4: Recent Detections Feed ────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Recent Detections</h3>
            <p className="text-xs text-slate-400 mt-0.5">Latest wildlife survey results</p>
          </div>
          <Link to="/archive" className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors">
            View All <ChevronRight size={14} />
          </Link>
        </div>

        {recentDetections.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {recentDetections.slice(0, 6).map((d) => (
              <div key={d.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/50 transition-colors group">
                {d.annotatedImageUrl ? (
                  <img src={d.annotatedImageUrl} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-slate-200" alt="" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileImage size={20} className="text-slate-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">{d.species}</p>
                    {d.nestingDetected && (
                      <span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">Nesting</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{d.notes?.slice(0, 80)}...</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-teal-600">{d.count} det.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{(d.confidence * 100).toFixed(0)}% conf</p>
                </div>
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock size={10} />
                    {new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-300 mt-0.5">
                    <MapPin size={10} />
                    {d.habitatType}
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-200 group-hover:text-teal-500 transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 opacity-50">
            <Bird size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-500">No detections yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Head to the <Link to="/analyzer" className="text-teal-600 hover:underline font-bold">AI Analyzer</Link> to run your first survey scan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
