
import React, { useState, useRef } from 'react';
import { Upload, Loader2, Sparkles, CheckCircle, AlertCircle, Bird, Trash2, Download } from 'lucide-react';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import type { DetectionResponse } from '../types';

const Analyzer: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addDetection = useStore(state => state.addDetection);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
      setResult(null);
      setError(null);
    }
  };

  const startAnalysis = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const data = await api.detect(file);
      setResult(data);
      // Also add to Zustand store for in-session map/archive use
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
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Detection failed';
      setError(msg);
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pelicaneye_analysis.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">AI Analyzer</h2>
          <p className="text-slate-500 mt-1">Upload high-resolution aerial imagery for colony detection.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={handleExportJSON} disabled={!result} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-40">
             <Download size={16} /> Export JSON
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Panel */}
        <div className="lg:col-span-7 space-y-6">
          <div 
            onClick={() => !analyzing && fileInputRef.current?.click()}
            className={`relative group aspect-[16/10] bg-white border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all overflow-hidden ${
              result?.annotated_image ? 'border-teal-500 shadow-xl' : preview ? 'border-teal-500 shadow-xl' : 'border-slate-300 hover:border-teal-400'
            } ${analyzing ? 'opacity-50' : 'cursor-pointer'}`}
          >
            {result?.annotated_image ? (
              <>
                <img src={result.annotated_image} className="w-full h-full object-contain bg-black" alt="Annotated result" />
                <div className="absolute top-3 left-3 bg-teal-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-lg">
                  {result.total_detections} Detection{result.total_detections !== 1 ? 's' : ''} Found
                </div>
              </>
            ) : preview ? (
              <>
                <img src={preview} className="w-full h-full object-cover" alt="Preview" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button onClick={(e) => { e.stopPropagation(); setPreview(null); setFile(null); }} className="bg-red-500 text-white p-3 rounded-full hover:scale-110 transition-transform"><Trash2 size={24} /></button>
                </div>
              </>
            ) : (
              <div className="text-center p-12">
                <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Upload size={40} />
                </div>
                <h4 className="text-xl font-bold text-slate-800">Drop Coastal Image</h4>
                <p className="text-slate-400 mt-2 text-sm">Supports TIFF, JPG, and PNG from survey flights</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onFileChange} />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button 
            disabled={!file || analyzing}
            onClick={startAnalysis}
            className="w-full bg-teal-600 text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl shadow-teal-600/20 hover:bg-teal-700 disabled:bg-slate-300 disabled:shadow-none transition-all active:scale-[0.98]"
          >
            {analyzing ? (
              <><Loader2 size={24} className="animate-spin" /> Running YOLOv8 Detection...</>
            ) : (
              <><Sparkles size={24} /> Run Intelligence Scan</>
            )}
          </button>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {analyzing ? (
             <div className="bg-teal-50 border border-teal-100 rounded-3xl p-12 text-center h-full flex flex-col justify-center animate-pulse">
                <Bird size={64} className="mx-auto text-teal-500 mb-6" />
                <h3 className="text-2xl font-bold text-teal-900">Identifying Colonies</h3>
                <p className="text-teal-700 mt-2 max-w-xs mx-auto">Running YOLOv8 object detection on aerial frame...</p>
             </div>
          ) : result?.summary ? (
            <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xl">
              <div className="bg-teal-600 p-8 text-white">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold">Analysis Complete</h3>
                    <p className="text-teal-100 text-sm">YOLOv8 + PelicanEye AI Engine</p>
                  </div>
                  <CheckCircle size={32} />
                </div>
                <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-between backdrop-blur-md">
                   <span className="text-xs font-bold uppercase tracking-widest">Avg Confidence</span>
                   <span className="text-2xl font-black">{(result.summary.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Primary Species</p>
                    <p className="text-lg font-bold text-slate-800">{result.summary.species}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Objects Detected</p>
                    <p className="text-lg font-bold text-slate-800">{result.total_detections}</p>
                  </div>
                </div>

                {/* Bounding Box Details */}
                {result.detections.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Detection Breakdown</p>
                    <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                      {result.detections.map((d, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg text-xs">
                          <span className="font-bold text-slate-700">{d.class_name}</span>
                          <span className="text-teal-600 font-bold">{(d.confidence * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Habitat Profile</p>
                   <div className="flex gap-2 flex-wrap">
                      <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-xs font-bold border border-teal-100">{result.summary.habitatType}</span>
                      {result.summary.nestingDetected && <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-100">Nesting Activity</span>}
                   </div>
                </div>

                <div className="space-y-2">
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ecological Notes</p>
                   <p className="text-sm text-slate-600 leading-relaxed italic border-l-4 border-teal-500 pl-4 py-2 bg-slate-50/50 rounded-r-xl">
                      "{result.summary.notes}"
                   </p>
                </div>

                {result.summary.threats && result.summary.threats.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] text-red-400 font-bold uppercase mb-2">Threat Alerts</p>
                    <div className="flex flex-wrap gap-2">
                      {result.summary.threats.map((t, i) => (
                        <span key={i} className="flex items-center gap-1.5 bg-red-50 text-red-600 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border border-red-100">
                          <AlertCircle size={10} /> {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl h-full flex flex-col items-center justify-center p-12 text-center opacity-60">
              <Bird size={48} className="text-slate-300 mb-4" />
              <p className="font-bold text-slate-600">No Active Data</p>
              <p className="text-xs text-slate-400 mt-1">Upload a survey flight frame to generate insights.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analyzer;
