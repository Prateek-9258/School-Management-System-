import React, { useState, useEffect, useRef } from 'react';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification } from '../services/api';

const NotificationBell = ({ userId = 'admin' }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  useEffect(() => { fetchNotifications(); const i = setInterval(fetchNotifications, 30000); return () => clearInterval(i); }, [userId]);
  useEffect(() => { const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);

  const fetchNotifications = async () => {
  try {
    const data = await getNotifications(userId);
    setNotifications(Array.isArray(data) ? data : []);
    const countData = await getUnreadCount(userId);
    setUnreadCount(countData?.count || 0);
  } catch (err) {
    // ✅ 404 pe silently ignore, empty show karo
    console.log('Notifications not available yet');
    setNotifications([]);
    setUnreadCount(0);
  }
};

  const handleMarkRead = async (id, e) => { e.stopPropagation(); await markAsRead(id); fetchNotifications(); };
  const handleMarkAllRead = async () => { await markAllAsRead(userId); fetchNotifications(); };
  const handleDelete = async (id, e) => { e.stopPropagation(); await deleteNotification(id); fetchNotifications(); };

  const formatTime = (t) => {
    const d = new Date(t), n = new Date(), diff = (n - d) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  const getIcon = (type) => ({ fee: '💰', attendance: '📋', announcement: '📢', system: '⚙️' }[type] || '🔔');

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-slate-700/50">
        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h3 className="font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-1">
              <button onClick={handleMarkAllRead} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white" title="Mark all read">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n._id || n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-700/50 cursor-pointer border-b border-slate-700/50 last:border-0 ${!n.read ? 'bg-slate-700/20' : ''}`}>
                  <span className="text-xl mt-0.5">{getIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm font-medium truncate ${!n.read ? 'text-white' : 'text-slate-300'}`}>{n.title}</p>
                      {!n.read && <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatTime(n.createdAt || n.timestamp)}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {!n.read && <button onClick={(e) => handleMarkRead(n._id || n.id, e)} className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-indigo-400"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>}
                    <button onClick={(e) => handleDelete(n._id || n.id, e)} className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-red-400"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;