
import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Database, Image as ImageIcon, Map as MapIcon,
  ShieldAlert, Settings, LogOut, Search, Bell, BookOpen
} from 'lucide-react';
import { useStore } from '../store/useStore';

const Layout: React.FC = () => {
  const { user, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/archive', label: 'Image Archive', icon: Database },
    { path: '/analyzer', label: 'AI Analyzer', icon: ImageIcon },
    { path: '/map', label: 'Habitat Map', icon: MapIcon },
    { path: '/alerts', label: 'Priority Alerts', icon: ShieldAlert },
    { path: '/transparency', label: 'AI Transparency', icon: BookOpen },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return <Outlet />;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col text-slate-300 shadow-2xl z-30">
        <div className="p-8">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform">P</div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight leading-none">PelicanEye</h1>
              <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest font-black">CoastWatch AI</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${isActive
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-sm'
                    : 'hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <Icon size={20} className={`${isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-1">
          <Link
            to="/settings"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-400 hover:text-white group hover:bg-slate-800 ${location.pathname === '/settings' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : ''
              }`}
          >
            <Settings size={20} className="group-hover:rotate-45 transition-transform" />
            <span className="font-medium text-sm">Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 transition-all text-slate-400 hover:text-red-400"
          >
            <LogOut size={20} />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-20">
          <div className="relative w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search surveys, species, or locations..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-6">
            <button className="relative text-slate-400 hover:text-slate-600 transition-colors">
              <Bell size={22} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
            </button>
            <div className="h-8 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800 leading-none">{user?.name || 'User'}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">{user?.role || 'Role'}</p>
              </div>
              <div className="w-10 h-10 bg-slate-200 rounded-xl overflow-hidden shadow-inner flex items-center justify-center text-slate-400">
                {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <div className="font-bold">{user?.name?.[0] || 'U'}</div>}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
