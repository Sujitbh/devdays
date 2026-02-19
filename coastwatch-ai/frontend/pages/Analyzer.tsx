
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Loader2, Sparkles, CheckCircle, AlertCircle, Bird, Trash2,
  Download, SlidersHorizontal, SearchX, Image as ImageIcon, Clock,
  ChevronRight, Layers, Eye, BarChart3, X, RefreshCw, FileImage, ArrowRight,
  ShieldAlert, Target, Crosshair, Flame, Activity, Zap, Map,
} from 'lucide-react';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import type { DetectionResponse, DetectionRecord } from '../types';

// ── Batch queue item ────────────────────────────────────────────────────────
interface QueueItem {
  file: File;
  preview: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  result?: DetectionResponse;
  error?: string;
}

type ResultTab = 'summary' | 'actions' | 'spatial' | 'compare' | 'detections' | 'debug';

const Analyzer: React.FC = () => {
  // ── Queue / batch state ───────────────────────────────────────────────────
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [confThreshold, setConfThreshold] = useState(0.15);
  const [dragActive, setDragActive] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTab>('summary');
  const [showCompareSlider, setShowCompareSlider] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // ── History ───────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<DetectionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const addDetection = useStore(state => state.addDetection);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Derived state
  const active = queue[activeIdx];
  const result = active?.result ?? null;
  const error = active?.error ?? null;

  // ── Load history on mount ─────────────────────────────────────────────────
  useEffect(() => {
    setHistoryLoading(true);
    api.getDetections()
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  // ── File helpers ──────────────────────────────────────────────────────────
  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (incoming.length === 0) return;

    const items: QueueItem[] = [];
    incoming.forEach(f => {
      const reader = new FileReader();
      reader.onloadend = () => {
        items.push({ file: f, preview: reader.result as string, status: 'pending' });
        if (items.length === incoming.length) {
          setQueue(prev => {
            const next = [...prev, ...items];
            if (prev.length === 0) setActiveIdx(0);
            return next;
          });
        }
      };
      reader.readAsDataURL(f);
    });
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const removeFromQueue = (idx: number) => {
    setQueue(prev => prev.filter((_, i) => i !== idx));
    if (activeIdx >= queue.length - 1 && activeIdx > 0) setActiveIdx(activeIdx - 1);
  };

  const clearQueue = () => {
    setQueue([]);
    setActiveIdx(0);
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items?.length) setDragActive(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  // ── Analysis ──────────────────────────────────────────────────────────────
  const analyzeOne = async (idx: number, threshold: number) => {
    const item = queue[idx];
    if (!item || item.status === 'analyzing') return;

    setQueue(prev => prev.map((q, i) => i === idx ? { ...q, status: 'analyzing', error: undefined } : q));
    setActiveIdx(idx);
    setAnalyzing(true);

    try {
      const data = await api.detect(item.file, threshold);
      setQueue(prev => prev.map((q, i) => i === idx ? { ...q, status: 'done', result: data } : q));

      if (data.summary) {
        addDetection({
          id: crypto.randomUUID(),
          species: data.summary.species,
          count: data.summary.count,
          confidence: data.summary.confidence,
          habitatType: data.summary.habitatType as any,
          nestingDetected: data.summary.nestingDetected,
          notes: data.summary.notes,
          threats: data.summary.threats,
          lat: 29.0 + Math.random(),
          lng: -93.0 + Math.random() * 4,
          timestamp: new Date().toISOString(),
          imageUrl: data.original_image,
          annotatedImageUrl: data.annotated_image,
          boundingBoxes: data.detections,
        });
        // Refresh history
        api.getDetections().then(setHistory).catch(() => {});
      }
      setResultTab('summary');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Detection failed';
      setQueue(prev => prev.map((q, i) => i === idx ? { ...q, status: 'error', error: msg } : q));
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeAll = async () => {
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === 'pending' || queue[i].status === 'error') {
        await analyzeOne(i, confThreshold);
      }
    }
  };

  const retryWithLowerThreshold = async () => {
    const newThreshold = Math.max(0.01, confThreshold * 0.5);
    setConfThreshold(newThreshold);
    await analyzeOne(activeIdx, newThreshold);
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pelicaneye_${active?.file.name || 'analysis'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const doneCount = queue.filter(q => q.status === 'done').length;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">AI Analyzer</h2>
          <p className="text-slate-500 mt-1">Upload aerial survey imagery for YOLOv8 wildlife detection.</p>
        </div>
        <div className="flex gap-2">
          {queue.length > 1 && (
            <button onClick={clearQueue} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-all">
              <Trash2 size={14} /> Clear All
            </button>
          )}
          <button onClick={handleExportJSON} disabled={!result} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-40">
            <Download size={16} /> Export JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ═══════════════════════════════════════════════════════════════════
            LEFT COLUMN — Upload + Queue + Controls
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-5 space-y-4">
          {/* ── Drop Zone ─────────────────────────────────────────────────── */}
          <div
            ref={dropRef}
            onClick={() => !analyzing && fileInputRef.current?.click()}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative group aspect-[16/10] bg-white border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all overflow-hidden ${
              dragActive
                ? 'border-teal-500 bg-teal-50 shadow-xl scale-[1.01]'
                : active?.result?.annotated_image
                  ? 'border-teal-500 shadow-xl'
                  : active?.preview
                    ? 'border-teal-500 shadow-xl'
                    : 'border-slate-300 hover:border-teal-400'
            } ${analyzing ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
          >
            {dragActive ? (
              <div className="text-center p-12 animate-pulse">
                <div className="w-20 h-20 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload size={40} />
                </div>
                <h4 className="text-xl font-bold text-teal-700">Drop images here</h4>
                <p className="text-teal-500 mt-1 text-sm">Release to add to analysis queue</p>
              </div>
            ) : active?.result?.annotated_image ? (
              <>
                <img src={showHeatmap && active.result.heatmap_image ? active.result.heatmap_image : active.result.annotated_image} className="w-full h-full object-contain bg-black" alt="Annotated result" />
                <div className="absolute top-3 left-3 bg-teal-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-lg">
                  {active.result.total_detections} Detection{active.result.total_detections !== 1 ? 's' : ''}
                  {(active.result.spatial_clusters?.length ?? 0) > 0 && ` · ${active.result.spatial_clusters.length} Cluster${active.result.spatial_clusters.length !== 1 ? 's' : ''}`}
                </div>
                {active.result.summary?.conservation_priority && active.result.summary.conservation_priority !== 'Standard' && (
                  <div className={`absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg text-xs font-black shadow-lg ${
                    active.result.summary.conservation_priority === 'Critical'
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-amber-500 text-white'
                  }`}>
                    {active.result.summary.conservation_priority === 'Critical' ? '🚨' : '⚠️'} {active.result.summary.conservation_priority} Priority
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-1">
                  {active.result.heatmap_image && (
                    <button onClick={(e) => { e.stopPropagation(); setShowHeatmap(!showHeatmap); }} className={`p-2 rounded-lg text-xs font-bold transition-all ${showHeatmap ? 'bg-orange-500 text-white' : 'bg-black/60 text-white hover:bg-black/80'}`}>
                      <Flame size={14} />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setShowCompareSlider(!showCompareSlider); }} className="bg-black/60 text-white p-2 rounded-lg text-xs font-bold hover:bg-black/80 transition-all">
                    <Eye size={14} />
                  </button>
                </div>
              </>
            ) : active?.preview ? (
              <>
                <img src={active.preview} className="w-full h-full object-cover" alt="Preview" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button onClick={(e) => { e.stopPropagation(); removeFromQueue(activeIdx); }} className="bg-red-500 text-white p-3 rounded-full hover:scale-110 transition-transform">
                    <Trash2 size={20} />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center p-12">
                <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Upload size={40} />
                </div>
                <h4 className="text-xl font-bold text-slate-800">Drop Coastal Images</h4>
                <p className="text-slate-400 mt-2 text-sm">Drag & drop or click — supports multiple files</p>
                <p className="text-slate-300 mt-1 text-xs">TIFF, JPG, PNG from survey flights</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={onFileChange} />
          </div>

          {/* ── Image Queue (batch thumbnails) ────────────────────────────── */}
          {queue.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers size={12} /> Queue ({doneCount}/{queue.length})
                </p>
                {pendingCount > 0 && (
                  <button
                    onClick={analyzeAll}
                    disabled={analyzing}
                    className="text-[10px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 disabled:opacity-40"
                  >
                    <Sparkles size={10} /> Analyze All
                  </button>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                {queue.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className={`relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      i === activeIdx ? 'border-teal-500 shadow-md scale-105' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img src={item.preview} className="w-full h-full object-cover" alt="" />
                    {item.status === 'done' && (
                      <div className="absolute inset-0 bg-teal-500/20 flex items-center justify-center"><CheckCircle size={14} className="text-white drop-shadow" /></div>
                    )}
                    {item.status === 'analyzing' && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Loader2 size={14} className="text-white animate-spin" /></div>
                    )}
                    {item.status === 'error' && (
                      <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center"><AlertCircle size={14} className="text-red-300" /></div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); removeFromQueue(i); }} className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all" style={{ opacity: i === activeIdx ? 1 : undefined }}>
                      <X size={8} />
                    </button>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Error display ────────────────────────────────────────────── */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* ── Analyze Button ───────────────────────────────────────────── */}
          <button
            disabled={queue.length === 0 || analyzing}
            onClick={() => analyzeOne(activeIdx, confThreshold)}
            className="w-full bg-teal-600 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 shadow-xl shadow-teal-600/20 hover:bg-teal-700 disabled:bg-slate-300 disabled:shadow-none transition-all active:scale-[0.98]"
          >
            {analyzing ? (
              <><Loader2 size={22} className="animate-spin" /> Running YOLOv8 Detection...</>
            ) : (
              <><Sparkles size={22} /> {queue.length > 1 ? `Analyze Image ${activeIdx + 1}` : 'Run Intelligence Scan'}</>
            )}
          </button>

          {/* ── Confidence Slider ────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <SlidersHorizontal size={16} className="text-teal-500" />
                Confidence Threshold
              </div>
              <span className="text-sm font-black text-teal-600">{(confThreshold * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0.01}
              max={0.80}
              step={0.01}
              value={confThreshold}
              onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
              className="w-full accent-teal-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
              <span>More Detections (1%)</span>
              <span>Higher Precision (80%)</span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            CENTER COLUMN — Results with Tabs
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {analyzing ? (
            <div className="bg-teal-50 border border-teal-100 rounded-3xl p-10 text-center flex flex-col justify-center animate-pulse flex-1">
              <Bird size={56} className="mx-auto text-teal-500 mb-4" />
              <h3 className="text-xl font-bold text-teal-900">Identifying Colonies</h3>
              <p className="text-teal-700 mt-2 text-sm max-w-xs mx-auto">Running YOLOv8 inference on {active?.file.name}...</p>
              <div className="mt-4 w-48 h-1.5 bg-teal-200 rounded-full mx-auto overflow-hidden">
                <div className="w-1/2 h-full bg-teal-500 rounded-full animate-pulse" />
              </div>
            </div>

          ) : result?.summary ? (
            result.total_detections === 0 ? (
              /* ─── Zero-Detection ─────────────────────────────────────────── */
              <div className="bg-white border border-amber-200 rounded-3xl overflow-hidden shadow-xl">
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-6 text-white">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold">Scan Complete</h3>
                      <p className="text-amber-100 text-xs">YOLOv8 + PelicanEye Engine</p>
                    </div>
                    <SearchX size={28} />
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-md text-center">
                    <span className="text-base font-black">No Objects Detected</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    No objects found above <strong>{(confThreshold * 100).toFixed(0)}%</strong> confidence.
                  </p>

                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
                    <p className="text-[10px] font-bold text-amber-700 uppercase">Suggestions</p>
                    <ul className="text-xs text-amber-600 space-y-1 list-disc list-inside">
                      <li>Lower the confidence threshold</li>
                      <li>Use higher-resolution aerial imagery</li>
                      <li>Ensure subjects are visible at survey altitude</li>
                      <li>Try a different frame from the flight path</li>
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={retryWithLowerThreshold}
                      disabled={analyzing}
                      className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-amber-600 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <RefreshCw size={12} /> Auto-Retry ({Math.round(Math.max(1, confThreshold * 50))}%)
                    </button>
                    <button
                      onClick={() => { setConfThreshold(0.01); analyzeOne(activeIdx, 0.01); }}
                      disabled={analyzing}
                      className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-orange-600 transition-all disabled:opacity-40"
                    >
                      Scan at 1%
                    </button>
                  </div>

                  {result.debug_info && (
                    <details className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs">
                      <summary className="font-bold text-slate-500 cursor-pointer text-[10px]">Debug Info</summary>
                      <pre className="mt-2 text-[9px] text-slate-500 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(result.debug_info, null, 2)}</pre>
                    </details>
                  )}
                </div>
              </div>

            ) : (
              /* ─── Positive Results ───────────────────────────────────────── */
              <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xl flex flex-col">
                {/* Header */}
                <div className={`p-6 text-white ${
                  result.summary.conservation_priority === 'Critical'
                    ? 'bg-gradient-to-br from-red-600 to-rose-700'
                    : result.summary.conservation_priority === 'Elevated'
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                      : 'bg-gradient-to-br from-teal-600 to-cyan-600'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold">Analysis Complete</h3>
                      <p className="text-white/70 text-xs">
                        YOLOv8 Advanced Pipeline
                        {result.debug_info?.sliced_inference && ' · SAHI Slicing'}
                        {result.debug_info ? ` · ${result.debug_info.inference_ms.toFixed(0)}ms` : ''}
                      </p>
                    </div>
                    {result.summary.conservation_priority === 'Critical' ? (
                      <ShieldAlert size={28} className="animate-pulse" />
                    ) : (
                      <CheckCircle size={28} />
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-md">
                      <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">Detections</p>
                      <p className="text-xl font-black">{result.total_detections}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-md">
                      <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">Confidence</p>
                      <p className="text-xl font-black">{(result.summary.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-md">
                      <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">Clusters</p>
                      <p className="text-xl font-black">{result.spatial_clusters?.length ?? 0}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-md">
                      <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">Priority</p>
                      <p className="text-sm font-black leading-tight mt-0.5">{result.summary.conservation_priority}</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 bg-slate-50/50 overflow-x-auto">
                  {([
                    { key: 'summary', label: 'Summary', icon: BarChart3 },
                    { key: 'actions', label: 'Actions', icon: ShieldAlert },
                    { key: 'spatial', label: 'Spatial', icon: Crosshair },
                    { key: 'compare', label: 'Compare', icon: Eye },
                    { key: 'detections', label: 'Boxes', icon: Layers },
                    { key: 'debug', label: 'Debug', icon: FileImage },
                  ] as { key: ResultTab; label: string; icon: any }[]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setResultTab(tab.key)}
                      className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition-all ${
                        resultTab === tab.key
                          ? 'text-teal-600 border-b-2 border-teal-500 bg-white'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <tab.icon size={11} /> {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1" style={{ maxHeight: '420px' }}>
                  {resultTab === 'summary' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Primary Species</p>
                          <p className="text-sm font-bold text-slate-800">{result.summary.species}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Habitat</p>
                          <p className="text-sm font-bold text-slate-800">{result.summary.habitatType}</p>
                        </div>
                      </div>

                      {/* Conservation Priority Badge */}
                      <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                        result.summary.conservation_priority === 'Critical'
                          ? 'bg-red-50 border-red-200'
                          : result.summary.conservation_priority === 'Elevated'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-emerald-50 border-emerald-200'
                      }`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          result.summary.conservation_priority === 'Critical'
                            ? 'bg-red-100 text-red-600'
                            : result.summary.conservation_priority === 'Elevated'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          <ShieldAlert size={20} />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase text-slate-400">Conservation Priority</p>
                          <p className={`text-sm font-black ${
                            result.summary.conservation_priority === 'Critical'
                              ? 'text-red-700'
                              : result.summary.conservation_priority === 'Elevated'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}>{result.summary.conservation_priority}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <span className="bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-teal-100">{result.summary.habitatType}</span>
                        {result.summary.nestingDetected && (
                          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-100">Nesting Activity</span>
                        )}
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-blue-100">{result.total_detections} objects</span>
                        {result.debug_info?.tiny_object_count ? (
                          <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-purple-100">{result.debug_info.tiny_object_count} tiny</span>
                        ) : null}
                        {result.debug_info?.sliced_inference && (
                          <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-indigo-100">SAHI {result.debug_info.slice_grid}</span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Ecological Notes</p>
                        <p className="text-xs text-slate-600 leading-relaxed italic border-l-4 border-teal-500 pl-3 py-2 bg-slate-50/50 rounded-r-xl">
                          "{result.summary.notes}"
                        </p>
                      </div>

                      {result.summary.threats && result.summary.threats.length > 0 && (
                        <div className="pt-3 border-t border-slate-100">
                          <p className="text-[9px] text-red-400 font-bold uppercase mb-2">Threat Alerts</p>
                          <div className="flex flex-wrap gap-1.5">
                            {result.summary.threats.map((t, i) => (
                              <span key={i} className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border border-red-100">
                                <AlertCircle size={8} /> {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {resultTab === 'actions' && result.summary && (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-xl border ${
                        result.summary.conservation_priority === 'Critical'
                          ? 'bg-red-50 border-red-200'
                          : result.summary.conservation_priority === 'Elevated'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-emerald-50 border-emerald-200'
                      }`}>
                        <p className="text-[9px] font-bold uppercase text-slate-400 mb-2">Decision-Maker Brief</p>
                        <p className="text-sm font-bold text-slate-800 mb-1">{result.summary.species} — {result.summary.conservation_priority} Priority</p>
                        <p className="text-xs text-slate-600">{result.total_detections} detection(s) across {result.spatial_clusters?.length ?? 0} cluster(s) in {result.summary.habitatType} habitat.</p>
                      </div>

                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Target size={10} /> Recommended Actions
                        </p>
                        <div className="space-y-2">
                          {(result.summary.recommended_actions || []).map((action, i) => (
                            <div key={i} className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black ${
                                i === 0 && result.summary!.conservation_priority === 'Critical'
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-teal-100 text-teal-700'
                              }`}>{i + 1}</div>
                              <p className="text-xs text-slate-700 leading-relaxed pt-0.5">{action}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {result.summary.threats.length > 0 && (
                        <div>
                          <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest mb-2">Active Threats ({result.summary.threats.length})</p>
                          <div className="space-y-1">
                            {result.summary.threats.map((t, i) => (
                              <div key={i} className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                                <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
                                <span className="text-xs text-red-700 font-medium">{t}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {resultTab === 'spatial' && (
                    <div className="space-y-4">
                      {result.heatmap_image && (
                        <div className="space-y-1.5">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Density Heatmap</p>
                          <div className="rounded-xl overflow-hidden border border-slate-200">
                            <img src={result.heatmap_image} className="w-full" alt="Density heatmap" />
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-2">
                          Spatial Clusters ({result.spatial_clusters?.length ?? 0})
                        </p>
                        {(result.spatial_clusters?.length ?? 0) === 0 ? (
                          <p className="text-xs text-slate-400 italic">No spatial clusters formed — detections are dispersed.</p>
                        ) : (
                          <div className="space-y-2">
                            {result.spatial_clusters.map((cl) => (
                              <div key={cl.cluster_id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <Crosshair size={12} className="text-amber-500" /> Cluster {cl.cluster_id + 1}
                                  </span>
                                  <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-md">{cl.member_count} members</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                  <div>
                                    <span className="text-slate-400">Dominant: </span>
                                    <span className="text-slate-700 font-bold">{cl.dominant_class}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Confidence: </span>
                                    <span className="text-slate-700 font-bold">{(cl.avg_confidence * 100).toFixed(0)}%</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Spread: </span>
                                    <span className="text-slate-700 font-bold">{cl.spread_px.toFixed(0)}px</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Density: </span>
                                    <span className="text-slate-700 font-bold">{cl.density.toFixed(4)}/kpx²</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {result.debug_info && result.debug_info.tiny_object_count > 0 && (
                        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                          <p className="text-[9px] text-purple-600 font-bold uppercase mb-1">Tiny Object Analysis</p>
                          <p className="text-xs text-purple-700">
                            {result.debug_info.tiny_object_count} object(s) smaller than 32×32px detected.
                            {result.debug_info.sliced_inference
                              ? ` SAHI slicing (${result.debug_info.slice_grid}, ${result.debug_info.total_slices} tiles) enhanced detection recall for these distant subjects.`
                              : ' Multi-scale inference (640 + 1280) captured these at the higher resolution pass.'
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {resultTab === 'compare' && active && (
                    <div className="space-y-3">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Original vs Annotated</p>
                      <div className="relative rounded-xl overflow-hidden border border-slate-200" style={{ aspectRatio: '16/10' }}>
                        <img src={active.preview} className="w-full h-full object-cover absolute inset-0" alt="Original" />
                        <div
                          className="absolute inset-0 overflow-hidden"
                          style={{ width: `${comparePosition}%` }}
                        >
                          <img
                            src={result.annotated_image}
                            className="h-full object-cover"
                            style={{ width: `${10000 / comparePosition}%`, maxWidth: 'none' }}
                            alt="Annotated"
                          />
                        </div>
                        <div className="absolute inset-0" style={{ left: `${comparePosition}%`, width: '2px', background: 'white', boxShadow: '0 0 8px rgba(0,0,0,0.3)' }} />
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={comparePosition}
                          onChange={e => setComparePosition(Number(e.target.value))}
                          className="absolute bottom-2 left-4 right-4 accent-teal-500 opacity-70 hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 rounded">Annotated</div>
                        <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 rounded">Original</div>
                      </div>
                    </div>
                  )}

                  {resultTab === 'detections' && (
                    <div className="space-y-2">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        {result.detections.length} Bounding Box{result.detections.length !== 1 ? 'es' : ''}
                        {result.debug_info?.tiny_object_count ? ` (${result.debug_info.tiny_object_count} tiny)` : ''}
                      </p>
                      <div className="space-y-1">
                        {result.detections.map((d, i) => {
                          const boxW = Math.round(d.x2 - d.x1);
                          const boxH = Math.round(d.y2 - d.y1);
                          const isTiny = boxW < 32 && boxH < 32;
                          return (
                            <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${isTiny ? 'bg-purple-50 border-purple-100' : 'bg-slate-50 border-slate-100'}`}>
                              <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black ${isTiny ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>{i + 1}</span>
                                <span className="font-bold text-slate-700">{d.class_name}</span>
                                {isTiny && <span className="bg-purple-200 text-purple-700 text-[8px] font-bold px-1.5 py-0.5 rounded">TINY</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[9px] text-slate-400">{boxW}×{boxH}px</span>
                                {d.area_pct > 0 && <span className="text-[9px] text-slate-400">{d.area_pct.toFixed(2)}%</span>}
                                <span className={`font-black text-xs ${d.confidence >= 0.5 ? 'text-teal-600' : d.confidence >= 0.25 ? 'text-amber-600' : 'text-red-500'}`}>
                                  {(d.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {resultTab === 'debug' && result.debug_info && (
                    <div className="space-y-2">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Advanced Pipeline Diagnostics</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Model', value: result.debug_info.model_name },
                          { label: 'Image Size', value: `${result.debug_info.image_width}×${result.debug_info.image_height}` },
                          { label: 'Inference Size', value: `${result.debug_info.imgsz_used}px` },
                          { label: 'Confidence', value: `${(result.debug_info.conf_used * 100).toFixed(1)}%` },
                          { label: 'IoU', value: result.debug_info.iou_used.toFixed(2) },
                          { label: 'Inference Time', value: `${result.debug_info.inference_ms.toFixed(0)}ms` },
                          { label: 'Sliced (SAHI)', value: result.debug_info.sliced_inference ? `Yes (${result.debug_info.slice_grid})` : 'No' },
                          { label: 'Total Slices', value: result.debug_info.total_slices || 'N/A' },
                          { label: 'Pre-NMS Boxes', value: result.debug_info.pre_nms_count },
                          { label: 'Post-NMS Boxes', value: result.debug_info.post_nms_count },
                          { label: 'Merge Strategy', value: result.debug_info.merge_strategy || 'NMS' },
                          { label: 'Tiny Objects', value: result.debug_info.tiny_object_count },
                          { label: 'Spatial Clusters', value: result.debug_info.spatial_clusters },
                          { label: 'Color Mode', value: result.debug_info.image_mode },
                        ].map((item, i) => (
                          <div key={i} className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                            <p className="text-[8px] text-slate-400 font-bold uppercase">{item.label}</p>
                            <p className="text-xs font-bold text-slate-700 truncate">{String(item.value)}</p>
                          </div>
                        ))}
                      </div>
                      <details className="text-xs">
                        <summary className="font-bold text-slate-500 cursor-pointer text-[10px]">Raw JSON</summary>
                        <pre className="mt-1.5 text-[9px] text-slate-500 overflow-x-auto whitespace-pre-wrap bg-slate-50 p-2 rounded-lg">{JSON.stringify(result.debug_info, null, 2)}</pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            )

          ) : (
            /* ─── Empty State ──────────────────────────────────────────────── */
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl flex-1 flex flex-col items-center justify-center p-10 text-center opacity-60">
              <Bird size={44} className="text-slate-300 mb-4" />
              <p className="font-bold text-slate-600">No Active Data</p>
              <p className="text-xs text-slate-400 mt-1">Upload survey imagery to generate insights.</p>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT COLUMN — History Sidebar
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden h-full flex flex-col" style={{ maxHeight: '720px' }}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={12} /> Analysis History
              </h3>
              <span className="text-[10px] font-bold text-slate-400">{history.length} records</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="text-slate-300 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 opacity-50">
                  <ImageIcon size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-[10px] text-slate-400 font-bold">No past analyses</p>
                  <p className="text-[9px] text-slate-300 mt-0.5">Results will appear here</p>
                </div>
              ) : (
                history.map((record) => (
                  <div key={record.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100 hover:border-teal-200 transition-all cursor-pointer group">
                    <div className="flex gap-2.5">
                      {record.annotatedImageUrl && (
                        <img
                          src={record.annotatedImageUrl}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          alt=""
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{record.species}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] text-teal-600 font-bold">{record.count} det.</span>
                          <span className="text-[9px] text-slate-300">·</span>
                          <span className="text-[9px] text-slate-400">{(record.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {new Date(record.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <ChevronRight size={12} className="text-slate-300 group-hover:text-teal-500 transition-colors self-center flex-shrink-0" />
                    </div>
                    {record.nestingDetected && (
                      <div className="mt-1.5 flex gap-1">
                        <span className="bg-emerald-50 text-emerald-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-100">Nesting</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analyzer;
