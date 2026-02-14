
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Analyzer from './pages/Analyzer';
import Archive from './pages/Archive';
import HabitatMap from './pages/HabitatMap';
import Alerts from './pages/Alerts';
import { useStore } from './store/useStore';

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const user = useStore(state => state.user);
  const token = useStore(state => state.token);
  if (!user || !token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  const user = useStore(state => state.user);
  const token = useStore(state => state.token);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={user && token ? <Navigate to="/dashboard" replace /> : <Login />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="analyzer" element={<Analyzer />} />
          <Route path="archive" element={<Archive />} />
          <Route path="map" element={<HabitatMap />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
