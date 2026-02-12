
import React, { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Users, Target, Activity, ShieldAlert, Zap, Cpu, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { DashboardStats } from '../types';

const mockChartData = [
  { name: 'Feb', value: 420 },
  { name: 'Mar', value: 580 },
  { name: 'Apr', value: 890 },
  { name: 'May', value: 1450 },
  { name: 'Jun', value: 1100 },
];

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [modelStatus, setModelStatus] = useState<{ loaded: boolean; checked: boolean }>({ loaded: false, checked: false });

  useEffect(() => {
    // Fetch real stats from backend
    api.getStats().then(setStats).catch(() => {
      // Fallback to zeros if backend unreachable
      setStats({ totalImages: 0, totalDetections: 0, nestsDetected: 0, speciesCount: 0, speciesList: [], landLossAlerts: 0 });
    });

    // Check model health
    api.health().then(h => setModelStatus({ loaded: h.model_loaded, checked: true })).catch(() => {
      setModelStatus({ loaded: false, checked: true });
    });
  }, []);
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Conservation Overview</h2>
          <p className="text-slate-500 mt-1">Status of Louisiana's coastal habitat monitoring program.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/analyzer" className="bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all">
            <Zap size={18} /> New Analysis
          </Link>
          <button onClick={() => api.exportCSV()} className="bg-white px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm">
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Survey Images', value: stats ? stats.totalImages.toLocaleString() : '—', change: stats && stats.totalImages > 0 ? `${stats.totalDetections} det.` : 'No data', icon: Target, color: 'teal' },
          { label: 'Active Nests', value: stats ? stats.nestsDetected.toLocaleString() : '—', change: stats && stats.nestsDetected > 0 ? 'Detected' : 'Pending', icon: Activity, color: 'blue' },
          { label: 'Species Diversity', value: stats ? String(stats.speciesCount) : '—', change: stats?.speciesList?.length ? stats.speciesList.slice(0, 2).join(', ') : 'Awaiting scans', icon: Users, color: 'purple' },
          { label: 'Threat Severity', value: stats && stats.landLossAlerts > 0 ? 'High' : 'Low', change: stats ? `${stats.landLossAlerts} sites` : '0 sites', icon: ShieldAlert, color: 'red' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-${stat.color}-50 text-${stat.color}-600 group-hover:scale-110 transition-transform`}>
                <stat.icon size={22} />
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${stat.change.includes('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
                {stat.change}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold text-slate-800">Migration & Nesting Trends</h3>
            <select className="bg-slate-50 border-none rounded-lg text-sm font-bold text-slate-500 px-3 py-1 outline-none">
              <option>Last 6 Months</option>
              <option>Yearly View</option>
            </select>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                  cursor={{stroke: '#0d9488', strokeWidth: 1}}
                />
                <Area type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Status */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Cpu size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">AI Model Status</h3>
          </div>
          
          <div className="space-y-6 flex-1">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500 font-medium">Model Engine</span>
                <span className={`font-bold uppercase text-[10px] ${modelStatus.loaded ? 'text-teal-600' : 'text-orange-500'}`}>
                  {modelStatus.checked ? (modelStatus.loaded ? 'YOLOv8 Ready' : 'Offline') : 'Checking...'}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className={`h-full ${modelStatus.loaded ? 'bg-teal-500 w-[94%]' : 'bg-orange-400 w-[20%]'}`} />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-xs text-slate-500 font-bold uppercase mb-2">Confidence Threshold</p>
              <input type="range" className="w-full accent-teal-600" min="0" max="100" defaultValue="85" />
              <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-bold uppercase">
                <span>Fast (60%)</span>
                <span>Precise (85%)</span>
              </div>
            </div>

            <div className="p-4 border border-dashed border-slate-200 rounded-2xl flex-1 flex flex-col justify-center items-center text-center">
              <p className="text-sm font-bold text-slate-700">Infrastructure Health</p>
              <p className="text-xs text-slate-400 mt-1">Processing nodes online: 12/12</p>
              <div className="flex gap-1 mt-3">
                {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="w-2 h-4 bg-emerald-500 rounded-sm animate-pulse" style={{animationDelay: `${i*0.1}s`}} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
