
import React from 'react';
import { useStore } from '../store/useStore';
import { ShieldAlert, ArrowRight, MapPin, Clock } from 'lucide-react';

const Alerts: React.FC = () => {
  const alerts = useStore(state => state.alerts);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500">
      <div>
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Priority Alerts</h2>
        <p className="text-slate-500 mt-1">Automated environmental threat intelligence based on AI survey analysis.</p>
      </div>

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div key={alert.id} className="bg-white rounded-3xl border border-slate-100 p-6 flex items-start gap-6 shadow-sm hover:shadow-md transition-shadow group">
            <div className={`p-4 rounded-2xl flex-shrink-0 ${
              alert.severity === 'High' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'
            }`}>
              <ShieldAlert size={28} />
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                 <h3 className="text-lg font-bold text-slate-800">{alert.title}</h3>
                 <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                    alert.severity === 'High' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                 }`}>
                    {alert.severity} Priority
                 </span>
              </div>
              
              <p className="text-sm text-slate-600 leading-relaxed">{alert.description}</p>
              
              <div className="flex gap-4 items-center pt-2">
                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                    <MapPin size={12} /> {alert.location}
                 </div>
                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                    <Clock size={12} /> {alert.timestamp}
                 </div>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-50">
                 <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between group-hover:bg-slate-100 transition-colors cursor-pointer">
                    <div>
                       <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Recommended Action</p>
                       <p className="text-sm font-bold text-slate-800">{alert.action}</p>
                    </div>
                    <ArrowRight className="text-teal-600 group-hover:translate-x-2 transition-transform" size={20} />
                 </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alerts;
