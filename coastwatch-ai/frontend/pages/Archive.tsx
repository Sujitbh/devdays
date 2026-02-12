
import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Search, Filter, Calendar, MapPin, Download, Loader2 } from 'lucide-react';
import type { DetectionRecord } from '../types';

const Archive: React.FC = () => {
  const storeDetections = useStore(state => state.detections);
  const [detections, setDetections] = useState<DetectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

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
           <button onClick={() => api.exportCSV()} className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3 text-sm text-slate-500 font-medium hover:bg-slate-50">
              <Download size={16} /> CSV
           </button>
           <button onClick={() => api.exportGeoJSON()} className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3 text-sm text-slate-500 font-medium hover:bg-slate-50">
              <Download size={16} /> GeoJSON
           </button>
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
