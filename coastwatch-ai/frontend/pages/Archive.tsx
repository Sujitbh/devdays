
import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Search, Filter, Calendar, MapPin, Download, Loader2, FileSpreadsheet, X, Check, ChevronDown } from 'lucide-react';
import type { DetectionRecord } from '../types';

const Archive: React.FC = () => {
  const storeDetections = useStore(state => state.detections);
  const [detections, setDetections] = useState<DetectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportOpts, setExportOpts] = useState({ minConf: '', includeBoxes: false });

  useEffect(() => {
    // Fetch persisted detections from backend
    api.getDetections()
      .then((data) => {
        setDetections(data);
        setLoading(false);
      })
      .catch(() => {
        // Fall back to Zustand in-memory store
        setDetections(storeDetections);
        setLoading(false);
      });
  }, [storeDetections]);

  const filtered = filter
    ? detections.filter(d =>
        d.species.toLowerCase().includes(filter.toLowerCase()) ||
        d.habitatType.toLowerCase().includes(filter.toLowerCase())
      )
    : detections;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Image Archive</h2>
          <p className="text-slate-500 mt-1">Historical database of Louisiana coastal monitoring missions.</p>
        </div>
        <div className="flex gap-2">
           <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3 text-sm text-slate-500 font-medium">
              <Search size={16} />
              <input
                type="text"
                placeholder="Filter species..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="bg-transparent outline-none text-slate-700 w-32"
              />
           </div>
           <div className="relative">
             <button onClick={() => { setShowExport(!showExport); setExportDone(false); }} className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3 text-sm text-slate-600 font-bold hover:bg-slate-50 transition-all">
                <Download size={16} /> Export <ChevronDown size={14} className={`transition-transform ${showExport ? 'rotate-180' : ''}`} />
             </button>
             {showExport && (
               <div className="absolute right-0 top-12 z-50 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                 <div className="flex items-center justify-between">
                   <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><FileSpreadsheet size={14} className="text-teal-600" /> Export Options</h4>
                   <button onClick={() => setShowExport(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                 </div>
                 {filter && (
                   <div className="bg-teal-50 text-teal-700 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                     <Filter size={10} /> Exporting filtered: "{filter}"
                   </div>
                 )}
                 <div>
                   <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Min Confidence (%)</label>
                   <input type="number" min={0} max={100} value={exportOpts.minConf} onChange={e => setExportOpts(p => ({...p, minConf: e.target.value}))} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                 </div>
                 <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                   <input type="checkbox" checked={exportOpts.includeBoxes} onChange={e => setExportOpts(p => ({...p, includeBoxes: e.target.checked}))} className="accent-teal-600 w-3.5 h-3.5" />
                   Include bounding box details
                 </label>
                 <div className="flex gap-2 pt-1">
                   <button
                     disabled={exporting}
                     onClick={async () => {
                       setExporting(true);
                       try {
                         await api.exportCSV({
                           species: filter || undefined,
                           minConfidence: exportOpts.minConf ? Number(exportOpts.minConf) / 100 : undefined,
                           includeBoxes: exportOpts.includeBoxes,
                         });
                         setExportDone(true);
                         setTimeout(() => setShowExport(false), 1200);
                       } finally { setExporting(false); }
                     }}
                     className="flex-1 bg-teal-600 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-teal-700 transition-all disabled:opacity-50"
                   >
                     {exporting ? <><Loader2 size={12} className="animate-spin" /> Exporting...</> : exportDone ? <><Check size={12} /> Done!</> : <><Download size={12} /> CSV</>}
                   </button>
                   <button
                     disabled={exporting}
                     onClick={async () => { setExporting(true); try { await api.exportGeoJSON(); setExportDone(true); setTimeout(() => setShowExport(false), 1200); } finally { setExporting(false); } }}
                     className="bg-slate-100 text-slate-700 py-2 px-3 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all disabled:opacity-50"
                   >
                     GeoJSON
                   </button>
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-teal-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-slate-100 text-center space-y-4">
           <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <Search size={40} />
           </div>
           <h3 className="text-xl font-bold text-slate-800">No Archived Items Yet</h3>
           <p className="text-slate-400 max-w-sm mx-auto">Analyze your first survey image to start building the historical record.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((d, i) => (
            <div key={d.id || i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg transition-all group cursor-pointer">
              <div className="aspect-square bg-slate-200 relative">
                 <img src={d.annotatedImageUrl || d.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                 <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-black uppercase text-teal-700">
                    {(d.confidence * 100).toFixed(0)}% Conf.
                 </div>
              </div>
              <div className="p-4 space-y-3">
                 <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-800 leading-tight truncate">{d.species}</h4>
                    <span className="text-[10px] font-bold text-slate-400">{d.count} Detected</span>
                 </div>
                 <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                    <MapPin size={12} /> {d.lat?.toFixed(3)}, {d.lng?.toFixed(3)}
                 </div>
                 <div className="pt-3 border-t border-slate-50">
                    <span className="bg-slate-50 text-slate-500 text-[9px] font-bold uppercase px-2 py-1 rounded-md">{d.habitatType}</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Archive;
