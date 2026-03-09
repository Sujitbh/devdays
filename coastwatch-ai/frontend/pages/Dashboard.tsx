
import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from 'recharts';
import {
  TrendingUp, Target, Activity, ShieldAlert, Zap, Cpu, Loader2,
  Bird, Eye, AlertTriangle, MapPin, Clock, ChevronRight,
  TreePine, Waves, Mountain, Droplets, Camera, FileImage,
  Download, FileSpreadsheet, Filter, X, Check, Heart,
  AlertCircle, Flame, BookOpen,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { DashboardStats, DetectionRecord, ColonySiteHealth } from '../types';

const PIE_COLORS = ['#0d9488', '#0891b2', '#7c3aed', '#e11d48', '#f59e0b', '#10b981', '#6366f1', '#ec4899'];

const HABITAT_ICONS: Record<string, any> = {
  'Marsh': TreePine,
  'Barrier Island': Mountain,
  'Salt Marsh': TreePine,
  'Swamp': Droplets,
  'Cypress Swamp': Droplets,
  'Open Water': Waves,
  'Open Water / Estuary': Waves,
  'Spoil Island': Mountain,
  'Freshwater Marsh': TreePine,
  'Mangrove Fringe': TreePine,
};

// Colony health score color
const healthColor = (score: number | null) => {
  if (score === null) return { bg: 'bg-slate-100', text: 'text-slate-500', bar: '#94a3b8' };
  if (score >= 75) return { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: '#10b981' };
  if (score >= 50) return { bg: 'bg-amber-50', text: 'text-amber-700', bar: '#f59e0b' };
  return { bg: 'bg-red-50', text: 'text-red-700', bar: '#ef4444' };
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDetections, setRecentDetections] = useState<DetectionRecord[]>([]);
  const [colonyHealth, setColonyHealth] = useState<ColonySiteHealth[]>([]);
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
      api.getColonyHealth().catch(() => []),
    ]).then(([s, d, h, ch]) => {
      setStats(s as DashboardStats);
      setRecentDetections(d as DetectionRecord[]);
      setModelStatus({ loaded: (h as any).model_loaded, checked: true });
      setColonyHealth(ch as ColonySiteHealth[]);
      setLoading(false);
    });
  }, []);

  // Derived chart data
  const speciesData = recentDetections.length > 0
    ? Object.entries(
      recentDetections.reduce((acc, d) => {
        acc[d.species] = (acc[d.species] || 0) + d.count;
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    : [{ name: 'Awaiting scans', value: 1 }];

  const threatCounts = recentDetections.length > 0
    ? Object.entries(
      recentDetections.flatMap(d => d.threats || []).reduce((acc, t) => {
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : [];

  const timelineData = recentDetections.length > 0
    ? recentDetections.slice(0, 20).reverse().map((d) => ({
      name: new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      detections: d.count,
      health: d.colony_health_score?.score ?? null,
    }))
    : [{ name: 'Mar', detections: 0, health: null }];

  const totalAnimals = recentDetections.reduce((s, d) => s + d.count, 0);
  const avgConfidence = recentDetections.length > 0
    ? recentDetections.reduce((s, d) => s + d.confidence, 0) / recentDetections.length
    : 0;
  const nestingCount = recentDetections.filter(d => d.nestingDetected).length;
  const avgHealth = stats?.avgColonyHealth ?? null;
  const criticalSites = stats?.criticalSites ?? 0;

  // Sites with health data for the health card list
  const sitesWithData = colonyHealth.filter(s => s.health_score !== null).sort((a, b) => (a.health_score ?? 100) - (b.health_score ?? 100));

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
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Conservation Overview</h2>
          <p className="text-slate-500 mt-1">Louisiana coastal wildlife monitoring — real-time colony intelligence.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/analyzer" className="bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all">
            <Zap size={18} /> New Analysis
          </Link>
          <Link to="/transparency" className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
            <BookOpen size={16} /> Transparency
          </Link>
          <div className="relative">
            <button onClick={() => { setShowExport(!showExport); setExportDone(false); }} className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
              <Download size={16} /> Export
            </button>
            {showExport && (
              <div className="absolute right-0 top-12 z-50 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet size={16} className="text-teal-600" /> Export Report</h4>
                  <button onClick={() => setShowExport(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Filter by Species</label>
                    <input value={exportOpts.species} onChange={e => setExportOpts(p => ({ ...p, species: e.target.value }))} placeholder="e.g. Pelican" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={exportOpts.includeBoxes} onChange={e => setExportOpts(p => ({ ...p, includeBoxes: e.target.checked }))} className="accent-teal-600 w-4 h-4" />
                    Include bounding box details
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        await api.exportCSV({ species: exportOpts.species || undefined, includeBoxes: exportOpts.includeBoxes });
                        setExportDone(true);
                        setTimeout(() => setShowExport(false), 1200);
                      } finally { setExporting(false); }
                    }}
                    className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-teal-700 transition-all disabled:opacity-50"
                  >
                    {exporting ? <><Loader2 size={14} className="animate-spin" /> Exporting...</> : exportDone ? <><Check size={14} /> Downloaded!</> : <><Download size={14} /> CSV</>}
                  </button>
                  <button disabled={exporting} onClick={async () => { setExporting(true); try { await api.exportGeoJSON(); } finally { setExporting(false); } }} className="bg-slate-100 text-slate-700 py-2.5 px-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all disabled:opacity-50">GeoJSON</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Survey Images', value: stats?.totalImages ?? 0, icon: Camera, color: 'teal', sub: 'drone scans' },
          { label: 'Total Detections', value: totalAnimals, icon: Target, color: 'cyan', sub: 'wildlife objects' },
          { label: 'Active Nests', value: nestingCount, icon: Bird, color: 'emerald', sub: 'confirmed sites' },
          { label: 'Species Found', value: stats?.speciesCount ?? 0, icon: Eye, color: 'violet', sub: speciesData[0]?.name !== 'Awaiting scans' ? speciesData[0]?.name.split(' ').slice(0, 2).join(' ') : '—' },
          { label: 'Avg Confidence', value: `${(avgConfidence * 100).toFixed(0)}%`, icon: Activity, color: 'blue', sub: 'detection avg' },
          { label: 'Threat Alerts', value: threatCounts.length, icon: ShieldAlert, color: 'red', sub: threatCounts.length > 0 ? 'active threats' : 'none' },
          { label: 'Avg Health', value: avgHealth !== null ? `${avgHealth}` : '—', icon: Heart, color: 'pink', sub: avgHealth !== null ? (avgHealth >= 75 ? '🟢 Healthy' : avgHealth >= 50 ? '🟡 Stressed' : '🔴 Critical') : 'no data' },
          { label: 'Critical Sites', value: criticalSites, icon: AlertCircle, color: 'orange', sub: 'health < 50' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className={`p-1.5 rounded-lg inline-flex bg-${kpi.color}-50 text-${kpi.color}-600 mb-2 group-hover:scale-110 transition-transform`}>
              <kpi.icon size={16} />
            </div>
            <p className="text-xl font-black text-slate-800">{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{kpi.label}</p>
            <p className="text-[8px] text-slate-300 font-medium truncate">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Row 2: Timeline + Species + Colony Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Detection + Health Timeline */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Detection Timeline</h3>
              <p className="text-xs text-slate-400 mt-0.5">Wildlife count + Colony Health per survey</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-teal-500 rounded-full" /> Detections</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full" /> Health Score</span>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="gradDet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradHealth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: 12 }} />
                <Area type="monotone" dataKey="detections" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#gradDet)" />
                <Area type="monotone" dataKey="health" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#gradHealth)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Species Donut */}
        <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Species Breakdown</h3>
          <p className="text-xs text-slate-400 mb-3">{speciesData.length} species detected</p>
          <div className="flex-1 flex items-center justify-center">
            <div className="relative">
              <PieChart width={180} height={180}>
                <Pie data={speciesData} cx={90} cy={90} innerRadius={48} outerRadius={75} paddingAngle={3} dataKey="value">
                  {speciesData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
              </PieChart>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-xl font-black text-slate-800">{totalAnimals}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Total</p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-1.5 mt-2">
            {speciesData.slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-600 font-medium truncate max-w-[120px]">{s.name}</span>
                </div>
                <span className="font-bold text-slate-800">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Colony Health Cards */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Colony Health</h3>
              <p className="text-xs text-slate-400">Monitored Louisiana colony sites</p>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Heart size={16} />
            </div>
          </div>
          {sitesWithData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
              <Bird size={28} className="text-slate-300 mb-2" />
              <p className="text-xs text-slate-400 font-bold">Run a survey scan to see<br />Colony Health Scores</p>
            </div>
          ) : (
            <div className="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar">
              {sitesWithData.slice(0, 6).map((site, i) => {
                const hc = healthColor(site.health_score);
                return (
                  <div key={i} className={`${hc.bg} rounded-xl px-3 py-2.5 border border-transparent hover:shadow-sm transition-all`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{site.name}</p>
                        <p className="text-[9px] text-slate-500 font-medium">{site.habitat} · {site.survey_count} surveys</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className={`text-lg font-black ${hc.text}`}>{site.health_score ?? '—'}</p>
                        <p className={`text-[8px] font-bold uppercase ${hc.text}`}>{site.health_grade}</p>
                      </div>
                    </div>
                    {site.health_score !== null && (
                      <div className="mt-1.5 w-full bg-white/50 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${site.health_score}%`, backgroundColor: hc.bar }} />
                      </div>
                    )}
                    {site.top_threats.length > 0 && (
                      <div className="mt-1.5 flex gap-1 flex-wrap">
                        {site.top_threats.slice(0, 2).map((t, j) => (
                          <span key={j} className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold truncate max-w-[130px]">
                            {t.threat.split('—')[0].trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Active Threats + Life Stages + AI Model */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Threats */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Active Threats</h3>
          <p className="text-xs text-slate-400 mb-4">Louisiana-specific threat detection results</p>
          {threatCounts.length > 0 ? (
            <div className="space-y-2">
              {threatCounts.map(([threat, count], i) => {
                const isOil = threat.toLowerCase().includes('oil');
                const isPredator = threat.toLowerCase().includes('predator') || threat.toLowerCase().includes('feral');
                const isFlood = threat.toLowerCase().includes('flood') || threat.toLowerCase().includes('erosion');
                const color = isOil ? 'bg-orange-50 border-orange-100 text-orange-600' :
                  isPredator ? 'bg-red-50 border-red-100 text-red-500' :
                    isFlood ? 'bg-blue-50 border-blue-100 text-blue-500' :
                      'bg-amber-50 border-amber-100 text-amber-600';
                return (
                  <div key={i} className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 ${color}`}>
                    {isOil ? <Flame size={13} className="flex-shrink-0" /> : <AlertTriangle size={13} className="flex-shrink-0" />}
                    <p className="text-xs font-bold text-slate-700 truncate flex-1">{threat.split('—')[0].trim()}</p>
                    <span className="text-[9px] font-black bg-white/70 px-2 py-0.5 rounded-full">{count}×</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 opacity-50">
              <ShieldAlert size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-400 font-bold">No threats detected</p>
            </div>
          )}
        </div>

        {/* Life Stage Tracking */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Life-Stage Tracking</h3>
          <p className="text-xs text-slate-400 mb-4">Reproductive pipeline — egg → chick → fledgling</p>
          {(() => {
            const allStages = recentDetections.reduce((acc, r) => {
              if (r.life_stages) {
                Object.entries(r.life_stages).forEach(([k, v]) => {
                  acc[k] = (acc[k] || 0) + (v as number);
                });
              }
              return acc;
            }, {} as Record<string, number>);

            const stageOrder = ['egg_clutch', 'chick', 'fledgling', 'nest_active', 'nest_inactive'];
            const stageLabels: Record<string, string> = {
              egg_clutch: '🥚 Egg Clutch', chick: '🐣 Chick', fledgling: '🐦 Fledgling',
              nest_active: '🪺 Active Nest', nest_inactive: '🪹 Inactive Nest',
            };
            const hasData = stageOrder.some(s => allStages[s] > 0);

            if (!hasData) {
              return (
                <div className="text-center py-8 opacity-50">
                  <Bird size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400 font-bold">Life-stage data appears after scanning<br />with the custom PelicanEye model</p>
                </div>
              );
            }

            const max = Math.max(...stageOrder.map(s => allStages[s] || 0), 1);
            return (
              <div className="space-y-3">
                {stageOrder.map(stage => {
                  const val = allStages[stage] || 0;
                  return (
                    <div key={stage}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-slate-700">{stageLabels[stage]}</span>
                        <span className="font-black text-slate-500">{val}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full" style={{ width: `${(val / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* AI System Status */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Cpu size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">AI Pipeline</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">3-Stage Louisiana Model</p>
            </div>
          </div>

          <div className="space-y-2.5 flex-1">
            {[
              { label: 'Stage 1: Habitat Classifier', status: 'Active', color: 'teal' },
              { label: 'Stage 2: Species Detector', status: modelStatus.loaded ? 'YOLOv8 Ready' : 'Offline', color: modelStatus.loaded ? 'teal' : 'orange' },
              { label: 'Stage 3: Threat Analyzer', status: 'Active', color: 'teal' },
              { label: 'Colony Health Engine', status: 'Active', color: 'teal' },
              { label: 'Alert System', status: 'Active', color: 'emerald' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                <span className="text-[11px] font-medium text-slate-600">{item.label}</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-${item.color}-100 text-${item.color}-700`}>
                  {item.status}
                </span>
              </div>
            ))}

            <div className="p-3 border border-dashed border-teal-200 rounded-xl bg-teal-50/30 mt-2">
              <p className="text-[9px] font-bold text-teal-600 uppercase mb-1">Custom Model Classes</p>
              <p className="text-[10px] text-teal-800">
                10 Louisiana bird species + 5 life stages + 5 threat classes = <span className="font-black">20 custom classes</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Recent Detections Feed */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Recent Survey Detections</h3>
            <p className="text-xs text-slate-400 mt-0.5">Latest Louisiana coastal wildlife survey results with health scores</p>
          </div>
          <Link to="/archive" className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors">
            View All <ChevronRight size={14} />
          </Link>
        </div>

        {recentDetections.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {recentDetections.slice(0, 7).map((d) => {
              const hc = healthColor(d.colony_health_score?.score ?? null);
              return (
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
                      {d.colony_site && (
                        <span className="text-[8px] font-medium text-slate-400 flex items-center gap-0.5 hidden sm:flex">
                          <MapPin size={8} /> {d.colony_site}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{d.habitatType} · {d.count} detected · {(d.confidence * 100).toFixed(0)}% conf</p>
                  </div>
                  {d.colony_health_score && (
                    <div className={`flex-shrink-0 ${hc.bg} rounded-xl px-3 py-1.5 text-center`}>
                      <p className={`text-base font-black ${hc.text}`}>{d.colony_health_score.score}</p>
                      <p className={`text-[8px] font-bold ${hc.text}`}>{d.colony_health_score.emoji}</p>
                    </div>
                  )}
                  <div className="text-right flex-shrink-0 hidden md:block">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock size={10} />
                      {new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {d.conservation_priority !== 'Standard' && (
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded mt-0.5 inline-block ${d.conservation_priority === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                        {d.conservation_priority}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-slate-200 group-hover:text-teal-500 transition-colors flex-shrink-0" />
                </div>
              );
            })}
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
