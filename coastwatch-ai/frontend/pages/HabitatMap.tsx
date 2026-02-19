
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { useLocation } from 'react-router-dom';
import {
  MapPin, Bird, TreePine, AlertTriangle, Eye, Filter, Layers,
  Search, ChevronDown, Target, Flame, ShieldAlert, CheckCircle2,
  Maximize2, X, Clock, Waves, Mountain,
} from 'lucide-react';
import type { DetectionRecord } from '../types';

/* ── Marker Icon Factory ─────────────────────────────────────────────────── */
const svgIcon = (fill: string, stroke: string, size = 32) =>
  L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
      <circle cx="12" cy="9" r="3" fill="white" opacity="0.9"/>
    </svg>`,
  });

const HABITAT_COLORS: Record<string, { fill: string; stroke: string; label: string; bg: string }> = {
  'Marsh':          { fill: '#14b8a6', stroke: '#0d9488', label: 'Marsh',          bg: 'bg-teal-500' },
  'Barrier Island': { fill: '#f59e0b', stroke: '#d97706', label: 'Barrier Island', bg: 'bg-amber-500' },
  'Swamp':          { fill: '#8b5cf6', stroke: '#7c3aed', label: 'Swamp',          bg: 'bg-violet-500' },
  'Open Water':     { fill: '#3b82f6', stroke: '#2563eb', label: 'Open Water',     bg: 'bg-blue-500' },
};

const PRIORITY_ICON: Record<string, { fill: string; stroke: string }> = {
  'Critical':  { fill: '#ef4444', stroke: '#b91c1c' },
  'Elevated':  { fill: '#f59e0b', stroke: '#d97706' },
  'Standard':  { fill: '#14b8a6', stroke: '#0d9488' },
};

type MapTile = 'street' | 'satellite' | 'topo';
const TILE_URLS: Record<MapTile, { url: string; attribution: string; label: string }> = {
  street:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap', label: 'Street' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri', label: 'Satellite' },
  topo:      { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap', label: 'Terrain' },
};

/* ── Fly-to Helper Component ─────────────────────────────────────────────── */
const FlyTo = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom, { duration: 1.5 }); }, [center, zoom]);
  return null;
};

/* ── Sidebar Detection Card ─────────────────────────────────────────────── */
const DetectionCard = ({ d, isActive, onClick }: { d: DetectionRecord; isActive: boolean; onClick: () => void }) => {
  const priority = d.conservation_priority || 'Standard';
  const prioColor = priority === 'Critical' ? 'text-red-600' : priority === 'Elevated' ? 'text-amber-600' : 'text-teal-600';
  const prioBg = priority === 'Critical' ? 'bg-red-50' : priority === 'Elevated' ? 'bg-amber-50' : 'bg-teal-50';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl transition-all border ${
        isActive
          ? 'bg-teal-50 border-teal-300 shadow-md'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        {d.annotatedImageUrl && (
          <img src={d.annotatedImageUrl} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-800 truncate">{d.species}</h4>
            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${prioBg} ${prioColor}`}>{priority}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{d.count} detected · {d.habitatType}</p>
          <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-400">
            <Clock size={9} /> {new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {d.nestingDetected && <span className="text-amber-500 font-bold">🪺 Nesting</span>}
          </div>
        </div>
      </div>
    </button>
  );
};

/* ── Main Component ──────────────────────────────────────────────────────── */
const HabitatMap: React.FC = () => {
  const storeDetections = useStore(state => state.detections);
  const location = useLocation();
  const [detections, setDetections] = useState<DetectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [tileLayer, setTileLayer] = useState<MapTile>('satellite');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [habitatFilter, setHabitatFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showThreats, setShowThreats] = useState(true);
  const [showNesting, setShowNesting] = useState(true);

  // Initial center: Louisiana coast default
  const defaultCenter: [number, number] = [29.5, -90.5];

  useEffect(() => {
    api.getDetections()
      .then(data => { setDetections(data); setLoading(false); })
      .catch(() => { setDetections(storeDetections); setLoading(false); });
  }, [storeDetections]);

  // Handle navigation from Alerts page with coordinates
  useEffect(() => {
    const state = location.state as any;
    if (state?.lat && state?.lng) {
      setFlyTarget({ center: [state.lat, state.lng], zoom: 14 });
    }
  }, [location.state]);

  // Filtering
  const filtered = useMemo(() => {
    let result = detections;
    if (habitatFilter !== 'all') result = result.filter(d => d.habitatType === habitatFilter);
    if (priorityFilter !== 'all') result = result.filter(d => d.conservation_priority === priorityFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.species.toLowerCase().includes(q) ||
        d.habitatType.toLowerCase().includes(q) ||
        d.notes?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [detections, habitatFilter, priorityFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: filtered.length,
    species: new Set(filtered.map(d => d.species)).size,
    nesting: filtered.filter(d => d.nestingDetected).length,
    critical: filtered.filter(d => d.conservation_priority === 'Critical').length,
    threats: filtered.reduce((acc, d) => acc + d.threats.length, 0),
  }), [filtered]);

  const focusDetection = (d: DetectionRecord) => {
    setSelectedId(d.id);
    setFlyTarget({ center: [d.lat, d.lng], zoom: 14 });
  };

  const tile = TILE_URLS[tileLayer];

  return (
    <div className="h-full flex flex-col gap-4 animate-in fade-in duration-500">
      {/* — Header Bar — */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Habitat Intelligence Map</h2>
          <p className="text-slate-500 mt-1">Geospatial distribution of detected wildlife across the Gulf Coast.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-2">
            <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600">{stats.total} Detections</span>
            <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600">{stats.species} Species</span>
            {stats.critical > 0 && <span className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[10px] font-bold text-red-600">{stats.critical} Critical</span>}
            {stats.nesting > 0 && <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-600">{stats.nesting} Nesting</span>}
          </div>
        </div>
      </div>

      {/* — Map + Sidebar Container — */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-80 flex-shrink-0 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800">Detections</h3>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <Search size={12} className="text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search species, habitat..."
                  className="bg-transparent outline-none text-xs text-slate-700 flex-1"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap gap-1.5">
              <select
                value={habitatFilter}
                onChange={e => setHabitatFilter(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-[10px] font-bold bg-white"
              >
                <option value="all">All Habitats</option>
                <option value="Marsh">Marsh</option>
                <option value="Barrier Island">Barrier Island</option>
                <option value="Swamp">Swamp</option>
                <option value="Open Water">Open Water</option>
              </select>
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-[10px] font-bold bg-white"
              >
                <option value="all">All Priority</option>
                <option value="Critical">Critical</option>
                <option value="Elevated">Elevated</option>
                <option value="Standard">Standard</option>
              </select>
            </div>

            {/* Detection List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <p className="text-sm text-slate-400 text-center py-8">Loading detections...</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8">
                  <Bird size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">No detections found</p>
                </div>
              ) : (
                filtered.map(d => (
                  <DetectionCard
                    key={d.id}
                    d={d}
                    isActive={selectedId === d.id}
                    onClick={() => focusDetection(d)}
                  />
                ))
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-slate-200 text-center">
              <p className="text-[9px] text-slate-400 font-bold">{filtered.length} of {detections.length} shown</p>
            </div>
          </div>
        )}

        {/* Map Area */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 shadow-2xl relative">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-4 left-4 z-[1000] bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md hover:shadow-lg transition-all text-xs font-bold text-slate-700 flex items-center gap-2"
            >
              <Filter size={14} /> Panel
            </button>
          )}

          <MapContainer
            center={defaultCenter}
            zoom={8}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer attribution={tile.attribution} url={tile.url} />

            {flyTarget && <FlyTo center={flyTarget.center} zoom={flyTarget.zoom} />}

            {/* Detection Markers */}
            {filtered.map((d) => {
              if (!d.lat || !d.lng) return null;
              const priority = d.conservation_priority || 'Standard';
              const iconColors = PRIORITY_ICON[priority] || PRIORITY_ICON.Standard;
              const icon = svgIcon(iconColors.fill, iconColors.stroke, selectedId === d.id ? 40 : 30);

              return (
                <React.Fragment key={d.id}>
                  <Marker
                    position={[d.lat, d.lng]}
                    icon={icon}
                    eventHandlers={{ click: () => setSelectedId(d.id) }}
                  >
                    <Popup maxWidth={320} minWidth={280}>
                      <div className="space-y-3 p-1" style={{ font: '13px/1.5 system-ui, sans-serif' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {d.annotatedImageUrl && (
                            <img src={d.annotatedImageUrl} style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover' }} />
                          )}
                          <div>
                            <h4 style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b', margin: 0 }}>{d.species}</h4>
                            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>{d.count} individuals · {(d.confidence * 100).toFixed(0)}% conf</p>
                          </div>
                        </div>

                        {/* Badge row */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 800,
                            textTransform: 'uppercase',
                            background: priority === 'Critical' ? '#fef2f2' : priority === 'Elevated' ? '#fffbeb' : '#f0fdfa',
                            color: priority === 'Critical' ? '#dc2626' : priority === 'Elevated' ? '#d97706' : '#0d9488',
                          }}>{priority}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 800,
                            textTransform: 'uppercase', background: '#f1f5f9', color: '#475569',
                          }}>{d.habitatType}</span>
                          {d.nestingDetected && (
                            <span style={{
                              padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 800,
                              textTransform: 'uppercase', background: '#fef3c7', color: '#92400e',
                            }}>🪺 Nesting</span>
                          )}
                        </div>

                        {/* Threats */}
                        {d.threats.length > 0 && (
                          <div>
                            <p style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Threats</p>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {d.threats.map((t, i) => (
                                <span key={i} style={{
                                  padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                                  background: '#fef2f2', color: '#dc2626',
                                }}>{t}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {d.notes && (
                          <p style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.5', margin: 0, borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                            {d.notes}
                          </p>
                        )}

                        {/* Coordinates */}
                        <p style={{ fontSize: '9px', color: '#94a3b8', margin: 0 }}>
                          {d.lat.toFixed(4)}°N, {Math.abs(d.lng).toFixed(4)}°W
                        </p>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Nesting radius ring */}
                  {showNesting && d.nestingDetected && (
                    <Circle
                      center={[d.lat, d.lng]}
                      radius={300}
                      pathOptions={{ color: '#f59e0b', fillColor: '#fef3c7', fillOpacity: 0.15, weight: 1.5, dashArray: '6,4' }}
                    />
                  )}

                  {/* Threat radius ring */}
                  {showThreats && d.threats.length > 0 && (
                    <Circle
                      center={[d.lat, d.lng]}
                      radius={200 + d.threats.length * 100}
                      pathOptions={{ color: '#ef4444', fillColor: '#fef2f2', fillOpacity: 0.08, weight: 1, dashArray: '4,6' }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </MapContainer>

          {/* — Map Controls Overlay — */}
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            {/* Tile Layer Switcher */}
            <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              {(['street', 'satellite', 'topo'] as MapTile[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTileLayer(t)}
                  className={`block w-full px-4 py-2 text-xs font-bold transition-all ${
                    tileLayer === t ? 'bg-teal-600 text-white' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {TILE_URLS[t].label}
                </button>
              ))}
            </div>

            {/* Layer Toggles */}
            <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-3 space-y-2">
              <p className="text-[8px] font-black text-slate-400 uppercase">Layers</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showNesting} onChange={() => setShowNesting(!showNesting)} className="w-3.5 h-3.5 rounded text-amber-500" />
                <span className="text-[10px] font-bold text-slate-700">Nesting Zones</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showThreats} onChange={() => setShowThreats(!showThreats)} className="w-3.5 h-3.5 rounded text-red-500" />
                <span className="text-[10px] font-bold text-slate-700">Threat Radii</span>
              </label>
            </div>
          </div>

          {/* — Legend Overlay — */}
          <div className="absolute bottom-6 left-6 z-[1000] bg-white/95 backdrop-blur p-4 rounded-2xl border border-slate-200 shadow-lg pointer-events-none">
            <p className="text-[8px] font-black uppercase text-slate-400 mb-3 tracking-widest">Map Legend</p>
            <div className="space-y-2">
              {/* Conservation Priority markers */}
              {Object.entries(PRIORITY_ICON).map(([label, colors]) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full" style={{ background: colors.fill }} />
                  <span className="text-[10px] font-bold text-slate-700">{label} Priority</span>
                </div>
              ))}
              <div className="my-2 border-t border-slate-200" />
              {/* Habitat types */}
              {Object.entries(HABITAT_COLORS).map(([label, cfg]) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-3.5 h-2 rounded-sm ${cfg.bg}`} />
                  <span className="text-[10px] font-bold text-slate-700">{cfg.label}</span>
                </div>
              ))}
              <div className="my-2 border-t border-slate-200" />
              {/* Rings */}
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-amber-400" />
                <span className="text-[10px] font-bold text-slate-700">Nesting Zone (300m)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-red-400" />
                <span className="text-[10px] font-bold text-slate-700">Threat Radius</span>
              </div>
            </div>
          </div>

          {/* — Selected Detection Info Bar — */}
          {selectedId && (() => {
            const sel = filtered.find(d => d.id === selectedId);
            if (!sel) return null;
            return (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 max-w-lg">
                {sel.annotatedImageUrl && (
                  <img src={sel.annotatedImageUrl} className="w-14 h-14 rounded-xl object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 text-sm">{sel.species}</h4>
                  <p className="text-[10px] text-slate-500">{sel.count} · {sel.habitatType} · {(sel.confidence * 100).toFixed(0)}% confidence</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default HabitatMap;
