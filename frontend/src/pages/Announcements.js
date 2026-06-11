import React, { useState, useEffect } from 'react';
import './announcements.css';
import { useAuth } from '../context/AuthContext';

// ✅ FIX: Auto-detect API URL - works on both localhost and production
const BASE_URL = process.env.REACT_APP_API_URL || window.location.origin;
const API_BASE_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL.replace(/\/$/, '')}/api`;

const priorityColors = {
  low: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  normal: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  urgent: 'text-rose-400 bg-rose-400/10 border-rose-400/20'
};

const fieldStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s ease'
};

const getIcon = (name) => {
    const icons = {
      megaphone: '<svg class="w-6 h-6 sm:w-7 sm:h-7 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>',
      plus: '<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>',
      search: '<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>',
      pin: '<svg class="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>',
      edit: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
      delete: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
      empty: '<svg class="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>',
      spinner: '<svg class="animate-spin h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'
    };
  return icons[name] || '';
};

export default function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [pushStatus, setPushStatus] = useState(null);
  const [formData, setFormData] = useState({ 
    title: '', 
    content: '', 
    priority: 'normal', 
    targetAudience: 'all', 
    targetClass: '', 
    pinned: false, 
    expiresAt: '' 
  });

  // ✅ Helper: Base64 to Uint8Array
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  };

  // ✅ FIX: Fetch VAPID Public Key from correct endpoint
  const getVAPIDPublicKey = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/push/vapid-public-key`);
      if (!res.ok) {
        // Fallback to announcements endpoint
        const fallbackRes = await fetch(`${API_BASE_URL}/announcements/vapid-public-key`);
        if (!fallbackRes.ok) throw new Error(`Failed to fetch VAPID public key: ${fallbackRes.status}`);
        const data = await fallbackRes.json();
        return data.publicKey;
      }
      const data = await res.json();
      return data.publicKey;
    } catch (err) {
      console.error('❌ VAPID key fetch failed:', err);
      throw err;
    }
  };

  // ✅ FIX: Subscribe with real VAPID key
  const subscribeUser = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('✅ Already subscribed');
        return;
      }

      const vapidPublicKey = await getVAPIDPublicKey();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      console.log('✅ Push Subscription:', subscription);

      const res = await fetch(`${API_BASE_URL}/push/subscribe`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ subscription })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      console.log('✅ Subscription saved:', data);

    } catch (err) {
      console.error('❌ SW Subscribe Error:', err);
    }
  };

  // ✅ FIX: Load announcements with proper error handling
  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/announcements`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON - check API URL');
      }

      const data = await res.json();
      setAnnouncements(data.data || data || []);
    } catch (e) {
      console.error('❌ Load Announcements Error:', e);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadAnnouncements(); 
    
    if ("Notification" in window) {
      Notification.requestPermission().then(async (permission) => {
        if (permission === "granted") {
          console.log("✅ Notification permission granted.");
          try { 
            await subscribeUser();
          } catch (e) { 
            console.error("❌ Subscribe failed:", e); 
          }
        } else {
          console.log("⚠️ Notification permission:", permission);
        }
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData, postedBy: user?.name || 'Admin' };
      const method = editData ? 'PUT' : 'POST';
      const url = editData ? `${API_BASE_URL}/announcements/${editData._id}` : `${API_BASE_URL}/announcements`;
      
      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to publish`);
      const result = await response.json();
      setPushStatus(result.pushNotificationStatus);

      setShowForm(false);
      loadAnnouncements();
    } catch (e) {
      console.error('❌ Submit Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/announcements/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}: Delete failed`);
      
      loadAnnouncements();
    } catch (e) {
      console.error('❌ Delete Error:', e);
    }
  };

  const handleDeleteAll = async () => {
    if (announcements.length === 0) return alert('No announcements to delete.');
    if (!window.confirm(`⚠️ Warning: All ${announcements.length} announcements will be deleted forever. Proceed?`)) return;
    if (!window.confirm('Final confirmation: Are you absolutely sure?')) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/announcements/all`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}: Delete all failed`);
      loadAnnouncements();
    } catch (e) {
      console.error('❌ Delete All Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = announcements.filter(a => {
    const matchesFilter = filter === 'all' || a.priority === filter;
    const matchesSearch = !search || 
      a.title?.toLowerCase().includes(search.toLowerCase()) || 
      a.content?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto min-h-screen">
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 flex items-center gap-3 shadow-2xl border border-slate-700">
            <div dangerouslySetInnerHTML={{ __html: getIcon('spinner') }} />
            <span className="text-white font-medium">Loading...</span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <div dangerouslySetInnerHTML={{ __html: getIcon('megaphone') }} />
            Announcements
          </h1>
          <p className="text-slate-400 mt-1 text-base">Broadcast updates to the school community</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDeleteAll} className="btn-delete-all text-sm sm:text-base whitespace-nowrap" title="Delete All Announcements"
            >
              <div dangerouslySetInnerHTML={{ __html: getIcon('delete') }} />
              <span>Delete All</span>
            </button>
            <button 
              onClick={() => { setEditData(null); setFormData({ title: '', content: '', priority: 'normal', targetAudience: 'all', targetClass: '', pinned: false, expiresAt: '' }); setShowForm(true); }}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30 active:scale-95 text-sm sm:text-base whitespace-nowrap"
            >
              <div dangerouslySetInnerHTML={{ __html: getIcon('plus') }} />
              Create New
            </button>
          </div>
        )}
      </div>

      <div className="bg-slate-800/20 border border-slate-700/30 rounded-2xl p-4 mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {['all', 'urgent', 'high', 'normal', 'low'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${filter === f ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2" dangerouslySetInnerHTML={{ __html: getIcon('search') }} />
            <input 
              type="text" 
              placeholder="Search announcements..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:border-indigo-500 transition-colors outline-none text-sm"
            />
          </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/20 rounded-3xl border border-dashed border-slate-700">
             <div dangerouslySetInnerHTML={{ __html: getIcon('empty') }} />
             <p className="text-slate-500 font-medium">No announcements found</p>
          </div>
        ) : (
          filtered.map(a => (
          <div key={a._id} className={`group p-6 rounded-2xl border transition-all duration-300 hover:translate-x-1 ${a.pinned ? 'bg-indigo-500/5 border-indigo-500/40 shadow-lg shadow-indigo-500/5' : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-500'}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-2">
                {a.pinned && <div dangerouslySetInnerHTML={{ __html: getIcon('pin') }} />}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">{a.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${priorityColors[a.priority]}`}>{a.priority}</span>
                    {a.targetAudience !== 'all' && (
                       <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-700 text-slate-300">To: {a.targetAudience}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-tighter">Posted By {a.postedBy} • {new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditData(a); setFormData({ ...a }); setShowForm(true); }} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400" title="Edit"><div dangerouslySetInnerHTML={{ __html: getIcon('edit') }} /></button>
                  <button onClick={() => handleDelete(a._id)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-rose-400" title="Delete"><div dangerouslySetInnerHTML={{ __html: getIcon('delete') }} /></button>
                </div>
              )}
            </div>
            <p className="text-slate-300 mt-3 leading-relaxed text-sm sm:text-base">{a.content}</p>
          </div>
        )))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-3xl border border-slate-700 w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-700 bg-slate-800/50">
              <h2 className="text-xl font-black text-white uppercase tracking-tight">{editData ? '✏️ Edit' : '📢 New'} Announcement</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-all">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.3)', borderRadius: '20px', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--indigo)', marginBottom: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '4px solid var(--indigo)', marginLeft: '-24px', paddingLeft: '20px' }}>
                  Main Content
                </h3>
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Announcement Title *</label>
                    <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={fieldStyle} placeholder="e.g. Annual Sports Meet 2024" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Details & Information *</label>
                    <textarea required rows="5" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} style={{...fieldStyle, resize: 'none'}} placeholder="Type the message you want to broadcast..." />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Priority Level</label>
                  <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} style={fieldStyle}>
                    <option value="low">Low Priority</option>
                    <option value="normal">Normal</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent Announcement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Target Audience</label>
                  <select value={formData.targetAudience} onChange={e => setFormData({...formData, targetAudience: e.target.value})} style={fieldStyle}>
                    <option value="all">Everyone</option>
                    <option value="students">Students Only</option>
                    <option value="parents">Parents Only</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-700">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="pin-check" checked={formData.pinned} onChange={e => setFormData({...formData, pinned: e.target.checked})} className="w-5 h-5 rounded-lg border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500" />
                  <label htmlFor="pin-check" className="text-sm font-bold text-slate-300 cursor-pointer select-none">📌 Pin to top of board</label>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 sm:flex-none px-6 py-3 text-slate-400 font-bold hover:text-white hover:bg-slate-700/40 border border-slate-700/50 rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 sm:flex-none px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                    {editData ? 'Update Notice' : 'Publish Notice'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {pushStatus && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-lg z-50 text-sm font-medium animate-fade-in ${pushStatus && pushStatus.failed > 0 ? 'bg-red-500' : 'bg-green-500'}`}>
          {pushStatus && pushStatus.failed > 0 ? (
            <p>❌ Announcement published, but {pushStatus.failed} push notifications failed to send.</p>
          ) : (
            <p>✅ Announcement published! {pushStatus.sent} push notifications sent successfully.</p>
          )}
          <button onClick={() => setPushStatus(null)} className="absolute top-1 right-1 text-white opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}