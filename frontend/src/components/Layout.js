import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import './layout.css';

const navItems = [
  { path: '/',           icon: '⊞', label: 'Dashboard'  },
  { path: '/students',   icon: '👥', label: 'Students'   },
  { path: '/attendance', icon: '✅', label: 'Attendance' },
  { path: '/fees',       icon: '💳', label: 'Fees'       },
  { path: '/announcements', icon: '📢', label: 'Announcements' }, // ✅ NEW
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    // ✅ Security Guard: Agar user ya token nahi hai, toh login par bhejo
    const token = localStorage.getItem('token');
    if (!user && !token) {
      navigate('/login', { replace: true });
    }

    const onResize = () => { if (window.innerWidth > 768) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [user, navigate]);

  // ✅ Don't render sidebar/header if not authenticated to prevent UI flicker
  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <header className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(prev => !prev)} aria-label="Toggle menu">
          <span className={'hamburger-icon ' + (sidebarOpen ? 'open' : '')}>
            <span></span><span></span><span></span>
          </span>
        </button>
        <div className="topbar-title"><span>🎓</span> School System</div>
        {/* ✅ NEW: Notification Bell */}
        <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <NotificationBell />
          <div className="topbar-avatar">
            {user && user.name ? user.name[0].toUpperCase() : '?'}
          </div>
        </div>
      </header>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={'sidebar ' + (sidebarOpen ? 'sidebar-open' : '')}>
        <div className="sidebar-logo">
          <div className="logo-icon">🎓</div>
          <div><h2>School Management</h2><span>School System</span></div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.path}
              className={'nav-item ' + (location.pathname === item.path ? 'active' : '')}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{user && user.name ? user.name[0].toUpperCase() : '?'}</div>
            <div className="user-details">
              <div className="user-name">{user && user.name}</div>
              <div className="user-role">{user && user.role}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>Sign Out</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}