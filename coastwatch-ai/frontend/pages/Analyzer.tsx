
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Loader2, Sparkles, CheckCircle, AlertCircle, Bird, Trash2,
  Download, SlidersHorizontal, SearchX, Image as ImageIcon,
  Layers, Eye, BarChart3, X, RefreshCw, FileImage, ArrowRight,
  ShieldAlert, Target, Crosshair, Flame, Activity, Zap, Map,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import type { DetectionResponse } from '../types';

// ── Batch queue item ────────────────────────────────────────────────────────
interface QueueItem {
  file: File;
  preview: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  result?: DetectionResponse;
  error?: string;
}

type ResultTab = 'summary' | 'species' | 'actions' | 'spatial' | 'compare' | 'detections' | 'debug';

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
  const [speciesInfo, setSpeciesInfo] = useState<any[]>([]);

  const addDetection = useStore(state => state.addDetection);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Derived state
  const active = queue[activeIdx];
  const result = active?.result ?? null;
  const error = active?.error ?? null;

  // ── Load species metadata on mount ────────────────────────────────────────
  useEffect(() => {
    api.getSpeciesInfo()
      .then(setSpeciesInfo)
      .catch(() => setSpeciesInfo([]));
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
  const handleExportPDF = () => {
    if (!result || !result.summary) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;
    
    // ── Header ──────────────────────────────────────────────────────────────
    doc.setFillColor(20, 184, 166); // Teal
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('PelicanEye', 15, 17);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Louisiana Coastal Wildlife AI Survey Report', 15, 25);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`, pageWidth - 15, 25, { align: 'right' });
    
    yPos = 45;
    doc.setTextColor(0, 0, 0);
    
    // ── Executive Summary ───────────────────────────────────────────────────
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text('Executive Summary', 15, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105); // Slate-600
    
    const summary = result.summary;
    const summaryLines = [
      `Primary Species: ${summary.species}`,
      `Total Count: ${summary.count} individuals`,
      `Confidence Level: ${(summary.confidence * 100).toFixed(1)}%`,
      `Habitat Type: ${summary.habitatType}`,
      `Survey Location: ${summary.colony_site || 'Louisiana Coastal Region'}`,
      `Analysis Status: ${summary.conservation_priority || 'Standard'} Priority`,
    ];
    
    summaryLines.forEach(line => {
      doc.text(line, 20, yPos);
      yPos += 6;
    });
    
    yPos += 5;
    
    // ── Conservation Status ─────────────────────────────────────────────────
    const speciesData = speciesInfo.find(s => 
      s.species.toLowerCase() === summary.species.toLowerCase()
    );
    
    if (speciesData) {
      doc.setFillColor(240, 253, 250); // Teal-50
      doc.roundedRect(15, yPos, pageWidth - 30, 22, 3, 3, 'F');
      doc.setDrawColor(153, 246, 228); // Teal-200
      doc.roundedRect(15, yPos, pageWidth - 30, 22, 3, 3, 'S');
      
      yPos += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(13, 148, 136); // Teal-600
      doc.text('Conservation Status', 20, yPos);
      yPos += 7;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Status: ${speciesData.status}  •  Monitoring: ${speciesData.monitoring_priority} Priority  •  Weight: ${speciesData.priority_weight}`, 20, yPos);
      yPos += 12;
    }
    
    // ── Detection Results ───────────────────────────────────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Detection Results', 15, yPos);
    yPos += 10;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    
    const detectionStats = [
      { label: 'Total Detections', value: result.detections?.length || 0 },
      { label: 'Clusters Identified', value: summary.clusters || 0 },
      { label: 'Nesting Activity', value: summary.nestingDetected ? 'Active' : 'None' },
      { label: 'Threats Detected', value: summary.threats?.length || 0 },
    ];
    
    const colWidth = (pageWidth - 30) / 2;
    let col = 0;
    detectionStats.forEach((stat, idx) => {
      const xPos = 20 + (col * colWidth);
      doc.setFont('helvetica', 'bold');
      doc.text(`${stat.label}:`, xPos, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(stat.value), xPos + 35, yPos);
      
      if (idx % 2 === 1) {
        yPos += 7;
        col = 0;
      } else {
        col = 1;
      }
    });
    
    yPos += 10;
    
    // ── Colony Health Score ─────────────────────────────────────────────────
    if (summary.colony_health_score) {
      // Check if we need a new page
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Colony Health Assessment', 15, yPos);
      yPos += 8;
      
      const healthScore = summary.colony_health_score;
      const scoreValue = healthScore.score || 0;
      const scoreColor = scoreValue >= 70 ? [16, 185, 129] : scoreValue >= 40 ? [251, 191, 36] : [239, 68, 68];
      
      // Score box
      doc.setFillColor(249, 250, 251); // Gray-50
      doc.roundedRect(15, yPos, 50, 18, 2, 2, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(15, yPos, 50, 18, 2, 2, 'S');
      
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...scoreColor);
      doc.text(scoreValue.toFixed(0), 40, yPos + 12, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text('Health Score', 40, yPos + 16, { align: 'center' });
      
      // Assessment text
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const assessment = healthScore.assessment || 'Standard colony health';
      const assessmentLines = doc.splitTextToSize(assessment, pageWidth - 90);
      doc.text(assessmentLines, 70, yPos + 6);
      
      yPos += 25;
      
      // Component breakdown
      if (healthScore.components) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('Health Score Components:', 20, yPos);
        yPos += 8;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const components = [
          { key: 'population_density', label: 'Population Density', weight: '30%' },
          { key: 'threat_impact', label: 'Threat Impact', weight: '30%' },
          { key: 'reproductive_success', label: 'Reproductive Success', weight: '25%' },
          { key: 'habitat_quality', label: 'Habitat Quality', weight: '10%' },
          { key: 'colony_structure', label: 'Colony Structure', weight: '5%' },
        ];
        
        components.forEach(comp => {
          const value = healthScore.components[comp.key] || 0;
          doc.setFont('helvetica', 'normal');
          doc.text(`${comp.label} (${comp.weight}):`, 25, yPos);
          doc.setFont('helvetica', 'bold');
          doc.text(value.toFixed(1), 90, yPos);
          
          // Progress bar
          const barWidth = 80;
          const barHeight = 4;
          const barX = 100;
          const barY = yPos - 3;
          
          doc.setFillColor(229, 231, 235); // Gray-200
          doc.roundedRect(barX, barY, barWidth, barHeight, 1, 1, 'F');
          
          const fillWidth = (value / 100) * barWidth;
          const barColor = value >= 70 ? [16, 185, 129] : value >= 40 ? [251, 191, 36] : [239, 68, 68];
          doc.setFillColor(...barColor);
          doc.roundedRect(barX, barY, fillWidth, barHeight, 1, 1, 'F');
          
          yPos += 8;
        });
      }
      
      yPos += 5;
    }
    
    // ── Life Stage Analysis ─────────────────────────────────────────────────
    if (summary.life_stages && Object.keys(summary.life_stages).length > 0) {
      // Check if we need a new page
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Life Stage Analysis', 15, yPos);
      yPos += 8;
      
      doc.setFillColor(236, 254, 255); // Cyan-50
      doc.roundedRect(15, yPos, pageWidth - 30, 35, 3, 3, 'F');
      
      yPos += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      
      const stages = [
        { key: 'egg_clutch', label: 'Egg Clutches' },
        { key: 'chick', label: 'Chicks' },
        { key: 'fledgling', label: 'Fledglings' },
        { key: 'nest_active', label: 'Active Nests' },
      ];
      
      stages.forEach(stage => {
        const count = summary.life_stages![stage.key] || 0;
        doc.text(`${stage.label}:`, 20, yPos);
        doc.setFont('helvetica', 'bold');
        doc.text(String(count), 60, yPos);
        doc.setFont('helvetica', 'normal');
        yPos += 6;
      });
      
      yPos += 5;
      
      // Breeding success metrics
      const eggs = summary.life_stages.egg_clutch || 0;
      const chicks = summary.life_stages.chick || 0;
      const fledglings = summary.life_stages.fledgling || 0;
      
      if (eggs > 0 || chicks > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 148, 136);
        doc.text('Breeding Success Indicators:', 20, yPos);
        yPos += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        
        if (eggs > 0 && chicks > 0) {
          const hatchRate = Math.round((chicks / eggs) * 100);
          doc.text(`Hatch Success Rate: ${hatchRate}%`, 25, yPos);
          yPos += 6;
        }
        
        if (chicks > 0 && fledglings > 0) {
          const fledgeRate = Math.round((fledglings / chicks) * 100);
          doc.text(`Fledgling Success Rate: ${fledgeRate}%`, 25, yPos);
          yPos += 6;
        }
      }
      
      yPos += 10;
    }
    
    // ── Conservation Recommendations ────────────────────────────────────────
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Conservation Recommendations', 15, yPos);
    yPos += 10;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    
    const recommendations = summary.nextSteps || [
      'Continue routine monitoring',
      'Document any changes in colony behavior',
      'Report significant population changes to Louisiana Department of Wildlife and Fisheries',
    ];
    
    recommendations.forEach((rec: string) => {
      const lines = doc.splitTextToSize(`• ${rec}`, pageWidth - 40);
      doc.text(lines, 20, yPos);
      yPos += lines.length * 5 + 2;
    });
    
    // ── Footer ──────────────────────────────────────────────────────────────
    const footerY = pageHeight - 15;
    doc.setDrawColor(229, 231, 235);
    doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
    
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'italic');
    doc.text('PelicanEye – AI-Powered Coastal Wildlife Conservation', 15, footerY);
    doc.text(`Page 1 of ${doc.getNumberOfPages()}`, pageWidth - 15, footerY, { align: 'right' });
    
    // ── Save PDF ────────────────────────────────────────────────────────────
    const fileName = `PelicanEye_${summary.species.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
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
          <button onClick={handleExportPDF} disabled={!result} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-40">
            <Download size={16} /> Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ═══════════════════════════════════════════════════════════════════
            LEFT COLUMN — Upload + Queue + Controls
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-4 space-y-4">
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
        <div className="lg:col-span-8 flex flex-col gap-4">
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
                <div className={`p-8 text-white ${
                  result.summary.conservation_priority === 'Critical'
                    ? 'bg-gradient-to-br from-red-600 to-rose-700'
                    : result.summary.conservation_priority === 'Elevated'
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                      : 'bg-gradient-to-br from-teal-600 to-cyan-600'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold">Analysis Complete</h3>
                      <p className="text-white/70 text-sm mt-1">
                        YOLOv8 Advanced Pipeline
                        {result.debug_info?.sliced_inference && ' · SAHI Slicing'}
                        {result.debug_info ? ` · ${result.debug_info.inference_ms.toFixed(0)}ms` : ''}
                      </p>
                    </div>
                    {result.summary.conservation_priority === 'Critical' ? (
                      <ShieldAlert size={32} className="animate-pulse" />
                    ) : (
                      <CheckCircle size={32} />
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-md">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Detections</p>
                      <p className="text-2xl font-black mt-1">{result.total_detections}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-md">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Confidence</p>
                      <p className="text-2xl font-black mt-1">{(result.summary.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-md">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Clusters</p>
                      <p className="text-2xl font-black mt-1">{result.spatial_clusters?.length ?? 0}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-md">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Priority</p>
                      <p className="text-base font-black leading-tight mt-1">{result.summary.conservation_priority}</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 bg-slate-50/50 overflow-x-auto">
                  {([
                    { key: 'summary', label: 'Summary', icon: BarChart3 },
                    { key: 'species', label: 'Species', icon: Bird },
                    { key: 'actions', label: 'Actions', icon: ShieldAlert },
                    { key: 'spatial', label: 'Spatial', icon: Crosshair },
                    { key: 'compare', label: 'Compare', icon: Eye },
                    { key: 'detections', label: 'Boxes', icon: Layers },
                    { key: 'debug', label: 'Debug', icon: FileImage },
                  ] as { key: ResultTab; label: string; icon: any }[]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setResultTab(tab.key)}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                        resultTab === tab.key
                          ? 'text-teal-600 border-b-2 border-teal-500 bg-white'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <tab.icon size={14} /> {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1" style={{ maxHeight: '520px' }}>
                  {resultTab === 'summary' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Primary Species</p>
                          <p className="text-base font-bold text-slate-800">{result.summary.species}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Habitat</p>
                          <p className="text-base font-bold text-slate-800">{result.summary.habitatType}</p>
                        </div>
                      </div>

                      {/* Conservation Priority Badge */}
                      <div className={`p-4 rounded-xl border flex items-center gap-4 ${
                        result.summary.conservation_priority === 'Critical'
                          ? 'bg-red-50 border-red-200'
                          : result.summary.conservation_priority === 'Elevated'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-emerald-50 border-emerald-200'
                      }`}>
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          result.summary.conservation_priority === 'Critical'
                            ? 'bg-red-100 text-red-600'
                            : result.summary.conservation_priority === 'Elevated'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          <ShieldAlert size={24} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">Conservation Priority</p>
                          <p className={`text-base font-black ${
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

                      {/* Colony Health Score - Enhanced */}
                      {result.colony_health_score && (
                        <div className="pt-3 border-t border-slate-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Colony Health Score</p>
                            <span className="text-[8px] text-slate-400 font-mono">Weighted Ecological Index</span>
                          </div>
                          
                          {/* Main Score Badge */}
                          <div className={`p-4 rounded-2xl border-2 ${
                            result.colony_health_score.score >= 75
                              ? 'bg-emerald-50 border-emerald-200'
                              : result.colony_health_score.score >= 50
                                ? 'bg-yellow-50 border-yellow-200'
                                : result.colony_health_score.score >= 25
                                  ? 'bg-red-50 border-red-200'
                                  : 'bg-red-100 border-red-300'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <span className="text-4xl">{result.colony_health_score.emoji}</span>
                                <div>
                                  <p className={`text-3xl font-black ${
                                    result.colony_health_score.score >= 75 ? 'text-emerald-700' :
                                    result.colony_health_score.score >= 50 ? 'text-yellow-700' :
                                    result.colony_health_score.score >= 25 ? 'text-red-600' : 'text-red-700'
                                  }`}>{result.colony_health_score.score}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">out of 100</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-lg font-black ${
                                  result.colony_health_score.score >= 75 ? 'text-emerald-700' :
                                  result.colony_health_score.score >= 50 ? 'text-yellow-700' :
                                  result.colony_health_score.score >= 25 ? 'text-red-600' : 'text-red-700'
                                }`}>{result.colony_health_score.grade}</p>
                                <p className="text-[9px] text-slate-500 font-medium mt-0.5">Status</p>
                              </div>
                            </div>
                            {result.colony_health_score.recommendation && (
                              <p className="text-xs text-slate-700 font-medium mt-2 pt-2 border-t border-slate-200">
                                💡 {result.colony_health_score.recommendation}
                              </p>
                            )}
                          </div>

                          {/* Component Breakdown */}
                          {result.colony_health_score.components && (
                            <div className="space-y-2">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Score Breakdown</p>
                              <div className="grid grid-cols-1 gap-2">
                                {result.colony_health_score.components.population_density !== undefined && (
                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold text-slate-600">Population Density</span>
                                      <span className="text-xs font-black text-teal-600">{result.colony_health_score.components.population_density.toFixed(1)}/30</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(result.colony_health_score.components.population_density / 30) * 100}%` }} />
                                    </div>
                                    {result.colony_health_score.components.density_value !== null && (
                                      <p className="text-[9px] text-slate-400 mt-1">{result.colony_health_score.components.density_value.toFixed(3)} birds/1000px²</p>
                                    )}
                                  </div>
                                )}
                                
                                {result.colony_health_score.components.threat_impact !== undefined && (
                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold text-slate-600">Threat Impact</span>
                                      <span className="text-xs font-black text-orange-600">{result.colony_health_score.components.threat_impact.toFixed(1)}/30</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(result.colony_health_score.components.threat_impact / 30) * 100}%` }} />
                                    </div>
                                    {result.colony_health_score.components.threat_penalty_raw > 0 && (
                                      <p className="text-[9px] text-red-500 mt-1">-{result.colony_health_score.components.threat_penalty_raw} penalty points from threats</p>
                                    )}
                                  </div>
                                )}
                                
                                {result.colony_health_score.components.reproductive_success !== undefined && (
                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold text-slate-600">Reproductive Success</span>
                                      <span className="text-xs font-black text-emerald-600">{result.colony_health_score.components.reproductive_success.toFixed(1)}/25</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(result.colony_health_score.components.reproductive_success / 25) * 100}%` }} />
                                    </div>
                                  </div>
                                )}
                                
                                {result.colony_health_score.components.habitat_quality !== undefined && (
                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold text-slate-600">Habitat Quality</span>
                                      <span className="text-xs font-black text-blue-600">{result.colony_health_score.components.habitat_quality}/10</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(result.colony_health_score.components.habitat_quality / 10) * 100}%` }} />
                                    </div>
                                  </div>
                                )}
                                
                                {result.colony_health_score.components.colony_structure !== undefined && (
                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold text-slate-600">Colony Structure</span>
                                      <span className="text-xs font-black text-purple-600">{result.colony_health_score.components.colony_structure}/5</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(result.colony_health_score.components.colony_structure / 5) * 100}%` }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {result.colony_health_score.methodology && (
                                <p className="text-[9px] text-slate-400 italic mt-2 pt-2 border-t border-slate-100">
                                  {result.colony_health_score.methodology}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

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

                  {resultTab === 'species' && result.summary && (
                    <div className="space-y-4">
                      {/* Species Header Card */}
                      <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4 rounded-2xl border border-teal-100">
                        <div className="flex items-start gap-3">
                          <div className="p-3 bg-white rounded-xl shadow-sm">
                            <Bird size={24} className="text-teal-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-black text-slate-800">{result.summary.species}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Primary species detected in survey</p>
                            {(() => {
                              const speciesData = speciesInfo.find(s => 
                                s.species.toLowerCase() === result.summary.species.toLowerCase()
                              );
                              if (speciesData) {
                                const statusColors: Record<string, string> = {
                                  'Recovered': 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                  'Stable': 'bg-blue-100 text-blue-700 border-blue-200',
                                  'Watch': 'bg-amber-100 text-amber-700 border-amber-200',
                                  'Declining': 'bg-orange-100 text-orange-700 border-orange-200',
                                  'Vulnerable': 'bg-red-100 text-red-700 border-red-200',
                                };
                                const statusColor = statusColors[speciesData.status] || 'bg-slate-100 text-slate-700 border-slate-200';
                                return (
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${statusColor}`}>
                                      {speciesData.status.toUpperCase()}
                                    </span>
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                                      speciesData.monitoring_priority === 'Critical' ? 'bg-red-50 text-red-600 border-red-200' :
                                      speciesData.monitoring_priority === 'Elevated' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                      'bg-slate-50 text-slate-600 border-slate-200'
                                    }`}>
                                      {speciesData.monitoring_priority} Priority
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-teal-600">{result.summary.count}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Detected</p>
                          </div>
                        </div>
                      </div>

                      {/* Louisiana Context */}
                      {result.summary.species.toLowerCase().includes('pelican') && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                          <p className="text-[9px] text-blue-600 font-bold uppercase mb-1.5 flex items-center gap-1">
                            <ShieldAlert size={10} /> Louisiana Conservation Context
                          </p>
                          <p className="text-xs text-blue-700 leading-relaxed">
                            The <strong>Brown Pelican</strong> is Louisiana's state bird and a conservation success story. 
                            Listed as endangered in 1970 due to DDT, it was removed from the Endangered Species List in 2009. 
                            Louisiana hosts the largest breeding colonies in North America. Post-Deepwater Horizon monitoring remains critical.
                          </p>
                        </div>
                      )}

                      {result.summary.species.toLowerCase().includes('spoonbill') && (
                        <div className="bg-pink-50 border border-pink-100 rounded-xl p-3">
                          <p className="text-[9px] text-pink-600 font-bold uppercase mb-1.5 flex items-center gap-1">
                            <ShieldAlert size={10} /> Louisiana Conservation Context
                          </p>
                          <p className="text-xs text-pink-700 leading-relaxed">
                            The <strong>Roseate Spoonbill</strong> is a Louisiana coastal treasure. Populations are sensitive to 
                            water quality and salinity changes. Coastal erosion and habitat loss threaten their shallow-water feeding grounds.
                          </p>
                        </div>
                      )}

                      {/* Life Stages Detection */}
                      {result.summary.life_stages && Object.keys(result.summary.life_stages).length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Life Stage Analysis</p>
                            <span className="text-[8px] text-slate-400 font-mono">Breeding Success Indicators</span>
                          </div>
                          
                          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                            {/* Life Stage Timeline */}
                            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50">
                              <div className="flex items-center justify-between text-center">
                                {[
                                  { key: 'egg_clutch', label: 'Eggs', emoji: '🥚', color: 'emerald' },
                                  { key: 'chick', label: 'Chicks', emoji: '🐣', color: 'amber' },
                                  { key: 'fledgling', label: 'Fledglings', emoji: '🐦', color: 'blue' },
                                  { key: 'nest_active', label: 'Active Nests', emoji: '🪺', color: 'teal' },
                                ].map((stage, idx) => {
                                  const count = result.summary.life_stages?.[stage.key] || 0;
                                  const isDetected = count > 0;
                                  return (
                                    <div key={stage.key} className="flex-1">
                                      {idx > 0 && (
                                        <div className="h-0.5 bg-slate-200 mx-auto mb-2" style={{ width: '80%' }} />
                                      )}
                                      <div className={`text-2xl mb-1 ${isDetected ? 'opacity-100' : 'opacity-20'}`}>
                                        {stage.emoji}
                                      </div>
                                      <p className="text-[9px] font-bold text-slate-600 uppercase">{stage.label}</p>
                                      <p className={`text-lg font-black mt-0.5 ${isDetected ? `text-${stage.color}-600` : 'text-slate-300'}`}>
                                        {count}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Breeding Success Metrics */}
                            <div className="p-4 space-y-2">
                              {(() => {
                                const eggs = result.summary.life_stages?.egg_clutch || 0;
                                const chicks = result.summary.life_stages?.chick || 0;
                                const fledglings = result.summary.life_stages?.fledgling || 0;
                                const activeNests = result.summary.life_stages?.nest_active || 0;
                                
                                const hatchSuccess = eggs > 0 ? Math.round((chicks / eggs) * 100) : 0;
                                const fledgeSuccess = chicks > 0 ? Math.round((fledglings / chicks) * 100) : 0;
                                
                                return (
                                  <>
                                    {eggs > 0 && chicks > 0 && (
                                      <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg">
                                        <span className="text-[10px] font-bold text-emerald-700">Hatch Success Rate</span>
                                        <span className="text-sm font-black text-emerald-600">{hatchSuccess}%</span>
                                      </div>
                                    )}
                                    
                                    {chicks > 0 && fledglings > 0 && (
                                      <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                                        <span className="text-[10px] font-bold text-blue-700">Fledgling Success Rate</span>
                                        <span className="text-sm font-black text-blue-600">{fledgeSuccess}%</span>
                                      </div>
                                    )}
                                    
                                    {activeNests > 0 && (
                                      <div className="flex items-center justify-between p-2 bg-teal-50 rounded-lg">
                                        <span className="text-[10px] font-bold text-teal-700">Active Breeding Detected</span>
                                        <span className="text-sm font-black text-teal-600">✓ Yes</span>
                                      </div>
                                    )}
                                    
                                    {result.summary.nestingDetected && (
                                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 mt-2">
                                        <p className="text-[9px] text-amber-700 font-bold">
                                          🚨 <strong>Critical Breeding Window:</strong> Ground access prohibited. 
                                          Maintain 300m buffer zone. Schedule follow-up survey in 14 days.
                                        </p>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Colony Site Context */}
                      {result.summary.colony_site && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Survey Location</p>
                          <p className="text-sm font-bold text-slate-700">{result.summary.colony_site}</p>
                          <p className="text-xs text-slate-500 mt-1">{result.summary.habitatType} habitat type</p>
                        </div>
                      )}

                      {/* Detection Details */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                          <p className="text-2xl font-black text-slate-800">{result.summary.count}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Total Count</p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                          <p className="text-2xl font-black text-teal-600">{(result.summary.confidence * 100).toFixed(0)}%</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Confidence</p>
                        </div>
                      </div>

                      {/* All Louisiana Species Info */}
                      {speciesInfo.length > 0 && (
                        <details className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                          <summary className="p-3 cursor-pointer font-bold text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                            View All Louisiana Coastal Species ({speciesInfo.length})
                          </summary>
                          <div className="p-3 border-t border-slate-100 space-y-2 max-h-60 overflow-y-auto">
                            {speciesInfo.map((sp, i) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                <div className="flex-1">
                                  <p className="text-xs font-bold text-slate-700">{sp.species}</p>
                                  <p className="text-[9px] text-slate-400">{sp.status} • {sp.monitoring_priority} Priority</p>
                                </div>
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black" style={{ backgroundColor: `${sp.color}20`, color: sp.color }}>
                                  {sp.priority_weight}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
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
      </div>
    </div>
  );
};

export default Analyzer;
