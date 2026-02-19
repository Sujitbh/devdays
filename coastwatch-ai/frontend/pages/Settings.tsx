
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  Settings as SettingsIcon, User, Bell, Palette, Lock, Database, 
  Eye, Volume2, MapPin, Zap, HelpCircle, Info, Moon, Sun, Check,
  AlertCircle, Save, RotateCcw, Mail, Shield, Clock, BarChart3,
} from 'lucide-react';

type Theme = 'light' | 'dark' | 'auto';
type NotificationLevel = 'all' | 'high-medium' | 'high-only' | 'disabled';

const Settings: React.FC = () => {
  const user = useStore(state => state.user);
  const [theme, setTheme] = useState<Theme>('light');
  const [notificationLevel, setNotificationLevel] = useState<NotificationLevel>('high-medium');
  const [savedMessage, setSavedMessage] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('profile');

  // Profile Settings
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    organization: 'Audubon Coast',
  });

  // Alert Preferences
  const [alertPrefs, setAlertPrefs] = useState({
    emailAlerts: true,
    pushAlerts: true,
    soundAlerts: false,
    dailyDigest: true,
  });

  // Map Settings
  const [mapPrefs, setMapPrefs] = useState({
    defaultZoom: 10,
    showHeatmap: true,
    showClusters: true,
    showThreatZones: true,
    basemap: 'satellite' as 'satellite' | 'map' | 'terrain',
  });

  // Analysis Settings
  const [analysisPrefs, setAnalysisPrefs] = useState({
    confidenceThreshold: 0.6,
    minDetectionSize: 0.01,
    enableSpatialClustering: true,
    enableHeatmaps: true,
    autoGenerateAlerts: true,
    nmsIoU: 0.5,
  });

  // Data Settings
  const [dataPrefs, setDataPrefs] = useState({
    autoBackup: true,
    backupFrequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    retentionDays: 365,
    exportFormat: 'csv' as 'csv' | 'geojson' | 'both',
    compressionEnabled: true,
  });

  const handleProfileChange = (field: keyof typeof profileForm, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
    showSaved();
  };

  const handleAlertChange = (field: keyof typeof alertPrefs, value: boolean) => {
    setAlertPrefs(prev => ({ ...prev, [field]: value }));
    showSaved();
  };

  const handleMapChange = (field: keyof typeof mapPrefs, value: any) => {
    setMapPrefs(prev => ({ ...prev, [field]: value }));
    showSaved();
  };

  const handleAnalysisChange = (field: keyof typeof analysisPrefs, value: any) => {
    setAnalysisPrefs(prev => ({ ...prev, [field]: value }));
    showSaved();
  };

  const handleDataChange = (field: keyof typeof dataPrefs, value: any) => {
    setDataPrefs(prev => ({ ...prev, [field]: value }));
    showSaved();
  };

  const showSaved = () => {
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-teal-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const SectionHeader = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
    <div className="flex items-start gap-4">
      <div className="p-3 rounded-xl bg-teal-50">
        <Icon size={24} className="text-teal-600" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
    </div>
  );

  const SettingRow = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
    <div className="py-4 border-b border-slate-200 last:border-0 flex items-center justify-between">
      <div>
        <p className="font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  const SettingGroup = ({ id, icon: Icon, title, description, children }: { id: string; icon: any; title: string; description: string; children: React.ReactNode }) => (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <button
        onClick={() => setExpandedSection(expandedSection === id ? null : id)}
        className="w-full p-6 flex items-start gap-4 hover:bg-slate-50/50 transition-colors"
      >
        <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-slate-200 transition-colors">
          <Icon size={24} className="text-slate-700" />
        </div>
        <div className="text-left flex-1">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
      </button>
      {expandedSection === id && (
        <div className="p-6 bg-slate-50/30 border-t border-slate-200 space-y-0">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      {/* — Header — */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Settings</h2>
          <p className="text-slate-500 mt-1">Manage your preferences, integrations, and account settings.</p>
        </div>
        {savedMessage && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold animate-in fade-in">
            <Check size={16} /> Settings saved
          </div>
        )}
      </div>

      {/* — Profile Section — */}
      <SettingGroup
        id="profile"
        icon={User}
        title="Profile & Account"
        description="Manage your personal information and account details."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
            <input
              value={profileForm.name}
              onChange={e => handleProfileChange('name', e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
            <input
              value={profileForm.email}
              disabled
              className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">Contact your administrator to change email</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Organization</label>
            <input
              value={profileForm.organization}
              onChange={e => handleProfileChange('organization', e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
            />
          </div>
        </div>
      </SettingGroup>

      {/* — Notification Section — */}
      <SettingGroup
        id="notifications"
        icon={Bell}
        title="Notifications & Alerts"
        description="Control how and when you receive alerts and notifications."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">Alert Level</label>
            <div className="space-y-2">
              {[
                { value: 'high-only', label: 'Critical Only', desc: 'Only High severity alerts' },
                { value: 'high-medium', label: 'High & Medium', desc: 'High and Medium severity alerts (recommended)' },
                { value: 'all', label: 'All Alerts', desc: 'All severity levels including Low' },
                { value: 'disabled', label: 'Disabled', desc: 'Disable all alerts' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <input
                    type="radio"
                    checked={notificationLevel === opt.value}
                    onChange={() => {
                      setNotificationLevel(opt.value as NotificationLevel);
                      showSaved();
                    }}
                    className="w-4 h-4 text-teal-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <SettingRow
              label="Email Notifications"
              description="Receive alerts via email"
            >
              <ToggleSwitch
                checked={alertPrefs.emailAlerts}
                onChange={v => handleAlertChange('emailAlerts', v)}
              />
            </SettingRow>
            <SettingRow
              label="Push Notifications"
              description="Browser or mobile notifications"
            >
              <ToggleSwitch
                checked={alertPrefs.pushAlerts}
                onChange={v => handleAlertChange('pushAlerts', v)}
              />
            </SettingRow>
            <SettingRow
              label="Sound Alerts"
              description="Play audio alert for critical events"
            >
              <ToggleSwitch
                checked={alertPrefs.soundAlerts}
                onChange={v => handleAlertChange('soundAlerts', v)}
              />
            </SettingRow>
            <SettingRow
              label="Daily Digest"
              description="Receive daily summary email at 8 AM"
            >
              <ToggleSwitch
                checked={alertPrefs.dailyDigest}
                onChange={v => handleAlertChange('dailyDigest', v)}
              />
            </SettingRow>
          </div>
        </div>
      </SettingGroup>

      {/* — Map Settings — */}
      <SettingGroup
        id="map"
        icon={MapPin}
        title="Map & Visualization"
        description="Configure map display, layers, and basemap options."
      >
        <div className="space-y-4">
          <SettingRow label="Basemap Type">
            <select
              value={mapPrefs.basemap}
              onChange={e => handleMapChange('basemap', e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-teal-500/20 outline-none"
            >
              <option value="satellite">Satellite</option>
              <option value="map">Street Map</option>
              <option value="terrain">Terrain</option>
            </select>
          </SettingRow>
          <SettingRow
            label="Default Zoom Level"
            description={`Current: ${mapPrefs.defaultZoom}x`}
          >
            <input
              type="range"
              min="5"
              max="18"
              value={mapPrefs.defaultZoom}
              onChange={e => handleMapChange('defaultZoom', parseInt(e.target.value))}
              className="w-32"
            />
          </SettingRow>
          <SettingRow label="Show Heatmaps">
            <ToggleSwitch
              checked={mapPrefs.showHeatmap}
              onChange={v => handleMapChange('showHeatmap', v)}
            />
          </SettingRow>
          <SettingRow label="Show Detection Clusters">
            <ToggleSwitch
              checked={mapPrefs.showClusters}
              onChange={v => handleMapChange('showClusters', v)}
            />
          </SettingRow>
          <SettingRow label="Show Threat Zones">
            <ToggleSwitch
              checked={mapPrefs.showThreatZones}
              onChange={v => handleMapChange('showThreatZones', v)}
            />
          </SettingRow>
        </div>
      </SettingGroup>

      {/* — Analysis Settings — */}
      <SettingGroup
        id="analysis"
        icon={Zap}
        title="Analysis & Detection"
        description="Fine-tune AI detection and analysis parameters."
      >
        <div className="space-y-4">
          <SettingRow
            label="Confidence Threshold"
            description={`Only show detections with ≥${(analysisPrefs.confidenceThreshold * 100).toFixed(0)}% confidence`}
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={analysisPrefs.confidenceThreshold}
                onChange={e => handleAnalysisChange('confidenceThreshold', parseFloat(e.target.value))}
                className="w-24"
              />
              <span className="text-sm font-bold text-slate-700 w-12">{(analysisPrefs.confidenceThreshold * 100).toFixed(0)}%</span>
            </div>
          </SettingRow>
          <SettingRow
            label="Min Detection Size"
            description={`Skip detections smaller than ${(analysisPrefs.minDetectionSize * 100).toFixed(1)}% of image`}
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.01"
                max="0.5"
                step="0.01"
                value={analysisPrefs.minDetectionSize}
                onChange={e => handleAnalysisChange('minDetectionSize', parseFloat(e.target.value))}
                className="w-24"
              />
              <span className="text-sm font-bold text-slate-700 w-12">{(analysisPrefs.minDetectionSize * 100).toFixed(1)}%</span>
            </div>
          </SettingRow>
          <SettingRow label="Spatial Clustering">
            <ToggleSwitch
              checked={analysisPrefs.enableSpatialClustering}
              onChange={v => handleAnalysisChange('enableSpatialClustering', v)}
            />
          </SettingRow>
          <SettingRow label="Heatmap Generation">
            <ToggleSwitch
              checked={analysisPrefs.enableHeatmaps}
              onChange={v => handleAnalysisChange('enableHeatmaps', v)}
            />
          </SettingRow>
          <SettingRow label="Auto-Generate Alerts">
            <ToggleSwitch
              checked={analysisPrefs.autoGenerateAlerts}
              onChange={v => handleAnalysisChange('autoGenerateAlerts', v)}
            />
          </SettingRow>
          <SettingRow
            label="NMS IoU Threshold"
            description={`Merge overlapping boxes with IoU > ${analysisPrefs.nmsIoU}`}
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={analysisPrefs.nmsIoU}
                onChange={e => handleAnalysisChange('nmsIoU', parseFloat(e.target.value))}
                className="w-24"
              />
              <span className="text-sm font-bold text-slate-700 w-12">{analysisPrefs.nmsIoU.toFixed(2)}</span>
            </div>
          </SettingRow>
        </div>
      </SettingGroup>

      {/* — Data Settings — */}
      <SettingGroup
        id="data"
        icon={Database}
        title="Data & Storage"
        description="Manage backups, retention, and export settings."
      >
        <div className="space-y-4">
          <SettingRow label="Auto-Backup">
            <ToggleSwitch
              checked={dataPrefs.autoBackup}
              onChange={v => handleDataChange('autoBackup', v)}
            />
          </SettingRow>
          {dataPrefs.autoBackup && (
            <SettingRow label="Backup Frequency">
              <select
                value={dataPrefs.backupFrequency}
                onChange={e => handleDataChange('backupFrequency', e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-teal-500/20 outline-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </SettingRow>
          )}
          <SettingRow
            label="Data Retention"
            description={`Keep records for ${dataPrefs.retentionDays} days`}
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="30"
                max="1095"
                step="30"
                value={dataPrefs.retentionDays}
                onChange={e => handleDataChange('retentionDays', parseInt(e.target.value))}
                className="w-24"
              />
              <span className="text-sm font-bold text-slate-700 w-16">{dataPrefs.retentionDays}d</span>
            </div>
          </SettingRow>
          <SettingRow label="Default Export Format">
            <select
              value={dataPrefs.exportFormat}
              onChange={e => handleDataChange('exportFormat', e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-teal-500/20 outline-none"
            >
              <option value="csv">CSV</option>
              <option value="geojson">GeoJSON</option>
              <option value="both">Both</option>
            </select>
          </SettingRow>
          <SettingRow label="Compression">
            <ToggleSwitch
              checked={dataPrefs.compressionEnabled}
              onChange={v => handleDataChange('compressionEnabled', v)}
            />
          </SettingRow>
        </div>
      </SettingGroup>

      {/* — Appearance Section — */}
      <SettingGroup
        id="appearance"
        icon={Palette}
        title="Appearance"
        description="Customize the look and feel of the application."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">Theme</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'light' as Theme, label: 'Light', icon: Sun },
                { value: 'dark' as Theme, label: 'Dark', icon: Moon },
                { value: 'auto' as Theme, label: 'Auto', icon: BarChart3 },
              ].map(opt => {
                const ThemeIcon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setTheme(opt.value);
                      showSaved();
                    }}
                    className={`p-4 border rounded-xl font-bold transition-all flex flex-col items-center gap-2 ${
                      theme === opt.value
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <ThemeIcon size={20} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SettingGroup>

      {/* — Security Section — */}
      <SettingGroup
        id="security"
        icon={Shield}
        title="Security"
        description="Manage passwords, API keys, and security settings."
      >
        <div className="space-y-4">
          <button className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <Lock size={18} className="text-slate-500 group-hover:text-slate-700" />
              <div>
                <p className="font-bold text-slate-800">Change Password</p>
                <p className="text-xs text-slate-500">Update your account password</p>
              </div>
            </div>
            <span className="text-slate-400">→</span>
          </button>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">Two-Factor Authentication</p>
              <p className="text-xs text-amber-700 mt-0.5">Not yet enabled. Enable 2FA for enhanced security.</p>
              <button className="mt-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors">
                Enable 2FA
              </button>
            </div>
          </div>
        </div>
      </SettingGroup>

      {/* — Help & Info — */}
      <SettingGroup
        id="help"
        icon={HelpCircle}
        title="Help & Information"
        description="Access documentation and application information."
      >
        <div className="space-y-2">
          <button className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors font-bold text-slate-800 text-sm">
            → View Documentation
          </button>
          <button className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors font-bold text-slate-800 text-sm">
            → Request Support
          </button>
          <button className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors font-bold text-slate-800 text-sm">
            → About PelicanEye
          </button>
          <div className="pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500 font-bold uppercase">App Version</p>
            <p className="text-sm font-bold text-slate-700 mt-1">v1.0.0 (Build 2026.02.18)</p>
          </div>
        </div>
      </SettingGroup>

      {/* — Footer — */}
      <div className="flex items-center justify-between pt-4 pb-8 border-t border-slate-200">
        <p className="text-xs text-slate-400 font-bold uppercase">Settings auto-save</p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock size={12} /> Last updated: just now
        </div>
      </div>
    </div>
  );
};

export default Settings;
