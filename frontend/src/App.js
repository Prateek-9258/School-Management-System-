import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './responsive-fix.css'; 
import Login      from './pages/Login';
import Signup     from './pages/Signup';
import Dashboard  from './pages/Dashboard';
import Students   from './pages/Students';
import Attendance from './pages/Attendance';
import Fees       from './pages/Fees';
import Layout     from './components/Layout';
import Announcements from './pages/Announcements';

// ✅ NEW: Import PWA components
import InstallPrompt from './components/InstallPrompt';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <Routes>
          <Route path="/login"  element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index           element={<Dashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="fees"     element={<Fees />} />
            {/* ✅ NEW: Announcement route */}
            <Route path="announcements" element={<Announcements />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        {/* ✅ NEW: PWA Install Prompt */}
        <InstallPrompt />
      </AuthProvider>
    </BrowserRouter>
  );
}