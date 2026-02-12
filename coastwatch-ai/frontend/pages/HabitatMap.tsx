
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { MapPin } from 'lucide-react';
import type { DetectionRecord } from '../types';

const HabitatMap: React.FC = () => {
  const storeDetections = useStore(state => state.detections);
  const [detections, setDetections] = useState<DetectionRecord[]>([]);
  const [center] = useState<[number, number]>([29.5, -90.5]); // Louisiana Coast

  useEffect(() => {
    api.getDetections()
      .then(setDetections)
      .catch(() => setDetections(storeDetections));
  }, [storeDetections]);

  // Standard Leaflet marker fix for missing images
  const customIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
  });

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Habitat Intelligence Map</h2>
          <p className="text-slate-500 mt-1">Geospatial distribution of detected colonies across the Gulf Coast.</p>
        </div>
      </div>

      <div className="flex-1 rounded-3xl overflow-hidden border border-slate-200 shadow-2xl relative">
        <MapContainer 
          center={center} 
          zoom={8} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {detections.map((d, i) => (
            d.lat && d.lng && (
              <Marker key={i} position={[d.lat, d.lng]} icon={customIcon}>
                <Popup>
                  <div className="p-2 space-y-2">
                    <h4 className="font-bold text-slate-800">{d.species}</h4>
                    <p className="text-xs text-slate-500">Estimated Count: {d.count}</p>
                    <div className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-bold rounded uppercase">
                      {d.habitatType}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
        
        {/* Overlay Legend */}
        <div className="absolute bottom-6 left-6 z-[1000] bg-white/90 backdrop-blur p-4 rounded-2xl border border-slate-200 shadow-lg pointer-events-none">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Map Legend</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-teal-500 rounded-full" />
              <span className="text-xs font-bold text-slate-700">Active Colony</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-xs font-bold text-slate-700">Threat Detected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HabitatMap;
