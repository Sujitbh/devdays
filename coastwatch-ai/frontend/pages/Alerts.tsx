
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import {
  ShieldAlert, ArrowRight, MapPin, Clock, Filter, Bird,
  TreePine, AlertTriangle, Cpu, ChevronDown, CheckCircle2,
  XCircle, Bell, TrendingUp, Target, Flame, Eye,
  Search, BarChart3, Waves, Mountain, Droplets, Download,
  Calendar, MoreVertical, Trash2, Copy, AlertCircle,
  TrendingDown, Users, Map, Link2, Tag, Zap,
} from 'lucide-react';
import type { Alert, DetectionRecord, OperationalRecommendation } from '../types';

type FilterSeverity = 'all' | 'High' | 'Medium' | 'Low';
type FilterCategory = 'all' | 'wildlife' | 'habitat' | 'threat' | 'system';
type ViewMode = 'list' | 'timeline';

type TrendPoint = { label: string; count: number };
type AlertTrend = {
  points: TrendPoint[];
  deltaPct: number;
  direction: 'up' | 'down' | 'stable';
  summary: string;
};

const SEVERITY_CONFIG = {
  Critical: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', icon: 'text-rose-500', dot: 'bg-rose-500', glow: 'shadow-rose-100' },
  High:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',       icon: 'text-red-500',    dot: 'bg-red-500',    glow: 'shadow-red-100' },
  Medium: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',   icon: 'text-amber-500',  dot: 'bg-amber-500',  glow: 'shadow-amber-100' },
  Low:    { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',     icon: 'text-blue-500',   dot: 'bg-blue-500',   glow: 'shadow-blue-100' },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  wildlife: { label: 'Wildlife',  icon: Bird,          color: 'text-teal-600' },
  habitat:  { label: 'Habitat',   icon: TreePine,      color: 'text-emerald-600' },
  threat:   { label: 'Threat',    icon: AlertTriangle, color: 'text-red-500' },
  system:   { label: 'System',    icon: Cpu,           color: 'text-indigo-500' },
};

const Alerts: React.FC = () => {
  const navigate = useNavigate();
  const storeAlerts = useStore(state => state.alerts);
  const [backendAlerts, setBackendAlerts] = useState<Alert[]>([]);
  const [detections, setDetections] = useState<DetectionRecord[]>([]);
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [loading, setLoading] = useState(true);
  const [recommendationMap, setRecommendationMap] = useState<Record<string, OperationalRecommendation[]>>({});
  const [recommendationLoading, setRecommendationLoading] = useState<Record<string, boolean>>({});
  const [trendMap, setTrendMap] = useState<Record<string, AlertTrend | null>>({});
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [alerts, detects] = await Promise.all([
          api.getAlerts().catch(() => []),
          api.getDetections().catch(() => []),
        ]);
        setBackendAlerts(alerts);
        setDetections(detects);
      } catch (err) {
        console.error('Failed to load alerts:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Generate dynamic alerts from detections (similar to before)
  const dynamicAlerts: Alert[] = useMemo(() => {
    if (!detections.length) return [];
    const generated: Alert[] = [];
    for (const d of detections) {
      if (d.conservation_priority === 'Critical') {
        generated.push({
          id: `dyn-${d.id}`,
          severity: 'High',
          category: 'wildlife',
          title: `Critical: ${d.species}`,
          location: `${d.lat.toFixed(2)}°N, ${Math.abs(d.lng).toFixed(2)}°W`,
          species: d.species,
          description: `${d.count} detection(s) at ${(d.confidence * 100).toFixed(0)}% confidence. ${d.nestingDetected ? 'Nesting confirmed.' : ''}`,
          timestamp: d.timestamp,
          action: d.recommended_actions?.[0] || 'Immediate action required.',
          detectionId: d.id,
          resolved: false,
        });
      }
    }
    return generated;
  }, [detections]);

  // Combine all alerts
  const allAlerts = useMemo(() => {
    const combined = [...(backendAlerts || []), ...storeAlerts, ...dynamicAlerts];
    // Dedupe by id
    const seen = new Set<string>();
    return combined.filter(a => {
      const key = a.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [backendAlerts, storeAlerts, dynamicAlerts]);

  // Apply filters + search + date range
  const filtered = useMemo(() => {
    let result = allAlerts;

    if (!showResolved) result = result.filter(a => !a.resolved);
    if (severityFilter !== 'all') result = result.filter(a => a.severity === severityFilter);
    if (categoryFilter !== 'all') result = result.filter(a => a.category === categoryFilter);

    if (dateRange.from) {
      const fromDate = new Date(dateRange.from);
      result = result.filter(a => new Date(a.timestamp) >= fromDate);
    }
    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59);
      result = result.filter(a => new Date(a.timestamp) <= toDate);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        (a.species || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [allAlerts, severityFilter, categoryFilter, showResolved, searchQuery, dateRange]);

  // Stats
  const stats = useMemo(() => ({
    high: allAlerts.filter(a => a.severity === 'High' && !a.resolved).length,
    medium: allAlerts.filter(a => a.severity === 'Medium' && !a.resolved).length,
    low: allAlerts.filter(a => a.severity === 'Low' && !a.resolved).length,
    resolved: allAlerts.filter(a => a.resolved).length,
  }), [allAlerts]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkResolve = () => {
    selectedIds.forEach(id => {
      const alert = allAlerts.find(a => a.id === id);
      if (alert && alert.id.startsWith('dyn-')) {
        // Backend alert
        api.updateAlert(id, { resolved: true }).catch(() => {});
      }
    });
    setSelectedIds(new Set());
  };

  const bulkDelete = () => {
    selectedIds.forEach(id => {
      if (!id.startsWith('dyn-')) {
        api.deleteAlert(id).catch(() => {});
      }
    });
    setSelectedIds(new Set());
  };

  const exportAlerts = () => {
    const csv = [
      ['ID', 'Severity', 'Category', 'Title', 'Location', 'Species', 'Timestamp', 'Action', 'Resolved'].join(','),
      ...filtered.map(a =>
        [a.id, a.severity, a.category, `"${a.title}"`, a.location, a.species || '', a.timestamp, `"${a.action}"`, a.resolved ? 'Yes' : 'No'].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alerts_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadOperationalRecommendations = async (alertId: string) => {
    if (recommendationMap[alertId] || recommendationLoading[alertId]) return;
    setRecommendationLoading(prev => ({ ...prev, [alertId]: true }));
    try {
      const recs = await api.getAlertRecommendations(alertId);
      setRecommendationMap(prev => ({ ...prev, [alertId]: recs }));
    } catch {
      setRecommendationMap(prev => ({ ...prev, [alertId]: [] }));
    } finally {
      setRecommendationLoading(prev => ({ ...prev, [alertId]: false }));
    }
  };

  const buildTrendForAlert = (alert: Alert): AlertTrend | null => {
    const speciesKey = (alert.species || '').trim().toLowerCase();
    if (!speciesKey) return null;

    const speciesRecords = detections
      .filter(d => d.species.toLowerCase() === speciesKey)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (speciesRecords.length < 2) return null;

    const byDay = new Map<string, number>();
    for (const rec of speciesRecords) {
      const key = new Date(rec.timestamp).toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + rec.count);
    }

    const points: TrendPoint[] = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([day, count]) => ({ label: day.slice(5), count }));

    if (points.length < 2) return null;

    const recentWindow = points.slice(-3);
    const previousWindow = points.slice(Math.max(0, points.length - 6), Math.max(0, points.length - 3));
    const avg = (arr: TrendPoint[]) => (arr.length ? arr.reduce((s, p) => s + p.count, 0) / arr.length : 0);
    const recentAvg = avg(recentWindow);
    const prevAvg = avg(previousWindow);

    const deltaPct = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : (recentAvg > 0 ? 100 : 0);
    const direction: 'up' | 'down' | 'stable' =
      deltaPct > 10 ? 'up' : deltaPct < -10 ? 'down' : 'stable';

    const summary =
      direction === 'up'
        ? 'Rising trend in detections over recent surveys.'
        : direction === 'down'
          ? 'Declining trend detected. Consider follow-up field verification.'
          : 'Trend appears stable across recent survey windows.';

    return {
      points,
      deltaPct: Number(deltaPct.toFixed(1)),
      direction,
      summary,
    };
  };

  const toggleTrendForAlert = (alert: Alert) => {
    const nextId = expandedTrendId === alert.id ? null : alert.id;
    setExpandedTrendId(nextId);
    if (nextId && !(alert.id in trendMap)) {
      setTrendMap(prev => ({ ...prev, [alert.id]: buildTrendForAlert(alert) }));
    }
  };

  const AlertCard = ({ alert }: { alert: Alert }) => {
    const sev = SEVERITY_CONFIG[alert.severity];
    const cat = CATEGORY_CONFIG[alert.category || 'system'];
    const CatIcon = cat.icon;
    const isExpanded = expandedId === alert.id;
    const isSelected = selectedIds.has(alert.id);

    return (
      <div
        key={alert.id}
        onClick={() => {
          const nextExpanded = isExpanded ? null : alert.id;
          setExpandedId(nextExpanded);
          if (nextExpanded) {
            loadOperationalRecommendations(alert.id);
          }
        }}
        className={`bg-white rounded-2xl border overflow-hidden transition-all cursor-pointer ${
          alert.resolved
            ? 'border-slate-200 opacity-60'
            : alert.severity === 'High' || alert.severity === 'Critical'
              ? `border-red-200 shadow-lg ${sev.glow}`
              : 'border-slate-200 shadow-sm hover:shadow-md'
        } ${isSelected ? 'ring-2 ring-teal-500' : ''}`}
      >
        <div className={`h-1 ${sev.dot}`} />
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={e => toggleSelect(alert.id, e as any)}
              onClick={e => e.stopPropagation()}
              className="w-5 h-5 rounded border-slate-300 text-teal-600 mt-1 flex-shrink-0"
            />

            {/* Icon */}
            <div className={`p-3 rounded-xl flex-shrink-0 ${sev.bg}`}>
              <CatIcon size={22} className={sev.icon} />
            </div>

            {/* Body */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-base font-bold ${alert.resolved ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {alert.title}
                  </h3>
                  {alert.severity === 'High' && !alert.resolved && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${sev.badge}`}>
                    {alert.severity}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mb-3">{alert.description}</p>

              {/* Meta row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 items-center text-[10px] font-bold text-slate-400">
                <div className="flex items-center gap-1.5">
                  <MapPin size={11} /> {alert.location}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={11} /> {new Date(alert.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                {alert.species && (
                  <div className="flex items-center gap-1.5 text-teal-500">
                    <Bird size={11} /> {alert.species}
                  </div>
                )}
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 animate-in fade-in">
                  <div className="bg-slate-50 p-4 rounded-xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Recommended Action</p>
                    <p className="text-sm font-bold text-slate-800">{alert.action}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        navigate('/map', { state: { lat: parseFloat(alert.location.split('°')[0]), lng: parseFloat(alert.location.split('°')[1].split('W')[0]) * -1 } });
                      }}
                      className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:border-teal-200 transition-all"
                    >
                      <Map size={14} /> View on Map
                    </button>
                    {alert.detectionId && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          navigate('/analyzer', { state: { detectionId: alert.detectionId } });
                        }}
                        className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:border-teal-200 transition-all"
                      >
                        <Link2 size={14} /> View Detection
                      </button>
                    )}
                    <button className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:border-teal-200 transition-all">
                      <Users size={14} /> Assign Team
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        toggleTrendForAlert(alert);
                      }}
                      className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 text-xs font-bold transition-all ${
                        expandedTrendId === alert.id
                          ? 'bg-teal-50 text-teal-700 border-teal-200'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-teal-50 hover:border-teal-200'
                      }`}
                    >
                      <BarChart3 size={14} /> Trend
                    </button>
                  </div>

                  {expandedTrendId === alert.id && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Trend Analysis (Last 7 Surveys)</p>
                        {trendMap[alert.id] && (
                          <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${
                            trendMap[alert.id]!.direction === 'up'
                              ? 'bg-emerald-50 text-emerald-700'
                              : trendMap[alert.id]!.direction === 'down'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}>
                            {trendMap[alert.id]!.deltaPct > 0 ? '+' : ''}{trendMap[alert.id]!.deltaPct}%
                          </span>
                        )}
                      </div>

                      {!trendMap[alert.id] ? (
                        <p className="text-xs text-slate-500">Insufficient species history for trend modeling (need at least 2 prior surveys).</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-7 gap-1 items-end h-16">
                            {(() => {
                              const points = trendMap[alert.id]!.points;
                              const maxVal = Math.max(...points.map(p => p.count), 1);
                              return points.map((p, idx) => (
                                <div key={`${p.label}-${idx}`} className="flex flex-col items-center gap-1">
                                  <div
                                    className="w-full bg-teal-500/80 rounded-t"
                                    style={{ height: `${Math.max(8, (p.count / maxVal) * 48)}px` }}
                                    title={`${p.label}: ${p.count}`}
                                  />
                                  <span className="text-[8px] text-slate-400 font-bold">{p.label}</span>
                                </div>
                              ));
                            })()}
                          </div>
                          <p className="text-xs text-slate-600 flex items-center gap-1.5">
                            {trendMap[alert.id]!.direction === 'up' ? (
                              <TrendingUp size={14} className="text-emerald-600" />
                            ) : trendMap[alert.id]!.direction === 'down' ? (
                              <TrendingDown size={14} className="text-red-600" />
                            ) : (
                              <BarChart3 size={14} className="text-slate-500" />
                            )}
                            {trendMap[alert.id]!.summary}
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Operational Playbook</p>
                      {recommendationLoading[alert.id] && (
                        <span className="text-[9px] text-slate-400 font-bold">Loading...</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {(recommendationMap[alert.id] || []).map((rec, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                          <p className="text-xs font-black text-slate-700 flex items-center gap-2">
                            {rec.threat_detected}
                            {rec.ai_driven && <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">AI-driven</span>}
                          </p>
                          <p className="text-[10px] text-slate-500"><strong>Trigger:</strong> {rec.trigger_condition}</p>
                          <p className="text-[10px] text-slate-700"><strong>Action:</strong> {rec.recommended_action}</p>
                          <p className="text-[10px] text-slate-500"><strong>Reasoning:</strong> {rec.reasoning}</p>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <p className="text-slate-500"><strong>Priority:</strong> {rec.priority_level}</p>
                            <p className="text-slate-500"><strong>Time:</strong> {rec.estimated_response_time}</p>
                            <p className="text-slate-500"><strong>Agency:</strong> {rec.responsible_agency}</p>
                            <p className="text-slate-500"><strong>Impact:</strong> {rec.expected_impact}</p>
                          </div>
                        </div>
                      ))}
                      {!recommendationLoading[alert.id] && (recommendationMap[alert.id] || []).length === 0 && (
                        <p className="text-xs text-slate-500">No operational recommendations available for this alert.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        api.updateAlert(alert.id, { resolved: !alert.resolved }).catch(() => {});
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${
                        alert.resolved
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                    >
                      {alert.resolved ? '↻ Re-open' : '✓ Mark Resolved'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      {/* — Header with stats — */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Priority Alerts</h2>
          <p className="text-slate-500 mt-1">AI-generated threat intelligence and automated action items.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200'}`}>
            List View
          </button>
          <button onClick={() => setViewMode('timeline')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'timeline' ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200'}`}>
            Timeline
          </button>
          <button onClick={exportAlerts} className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 hover:bg-slate-50 flex items-center gap-2">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* — KPI Cards — */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Critical', count: stats.high, color: 'red', icon: Flame },
          { label: 'Warning', count: stats.medium, color: 'amber', icon: AlertTriangle },
          { label: 'Info', count: stats.low, color: 'blue', icon: Bell },
          { label: 'Resolved', count: stats.resolved, color: 'emerald', icon: CheckCircle2 },
        ].map(kpi => (
          <div key={kpi.label} className={`bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-all cursor-pointer`} onClick={() => {
            if (kpi.label === 'Critical') setSeverityFilter(f => f === 'High' ? 'all' : 'High');
            else if (kpi.label === 'Warning') setSeverityFilter(f => f === 'Medium' ? 'all' : 'Medium');
            else if (kpi.label === 'Info') setSeverityFilter(f => f === 'Low' ? 'all' : 'Low');
            else setShowResolved(!showResolved);
          }}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${kpi.color}-50 text-${kpi.color}-500`}>
              <kpi.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">{kpi.count}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* — Filters & Search — */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Filters:</span>
          {(['all', 'High', 'Medium', 'Low'] as FilterSeverity[]).map(s => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                severityFilter === s
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
          <span className="text-slate-200">|</span>
          {(['all', 'wildlife', 'habitat', 'threat', 'system'] as FilterCategory[]).map(c => {
            const cfg = c !== 'all' ? CATEGORY_CONFIG[c] : null;
            return (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                  categoryFilter === c
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cfg && <cfg.icon size={10} />} {c === 'all' ? 'All Types' : cfg?.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-start">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <Search size={14} className="text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search alerts..."
              className="bg-transparent outline-none text-sm text-slate-700 flex-1"
            />
          </div>
          <input
            type="date"
            value={dateRange.from || ''}
            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <input
            type="date"
            value={dateRange.to || ''}
            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* — Bulk Actions — */}
      {selectedIds.size > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center justify-between">
          <span className="font-bold text-teal-900">{selectedIds.size} alert(s) selected</span>
          <div className="flex gap-2">
            <button onClick={bulkResolve} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700">
              Mark Resolved
            </button>
            <button onClick={bulkDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">
              Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="px-4 py-2 bg-white border border-teal-200 rounded-lg text-sm font-bold hover:bg-teal-50">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* — Alert List — */}
      {loading ? (
        <div className="text-center py-12">Loading alerts...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-16 text-center">
          <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-700">All Clear</h3>
          <p className="text-sm text-slate-400 mt-1">No alerts match your current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(alert => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* — Footer — */}
      <div className="text-center text-[10px] text-slate-400 font-medium pt-4">
        Showing {filtered.length} of {allAlerts.length} total alerts
      </div>
    </div>
  );
};

export default Alerts;
