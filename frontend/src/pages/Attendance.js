import React, { useEffect, useState } from 'react';
import { getStudents, markBulkAttendance, getAttendanceByDate } from '../services/api';
import { exportAttendancePDF } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './attendance.css';

const monthNames = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export default function Attendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear,  setSelectedYear]  = useState(today.getFullYear());
  const [filterClass,   setFilterClass]   = useState('all');
  const [students,      setStudents]      = useState([]);
  const [attGrid,       setAttGrid]       = useState({});
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [toast,         setToast]         = useState(null);

  const classes = ['1','2','3','4','5','6','7','8'];

  // RBAC: Students/Parents cannot access Registry
  useEffect(() => {
    const role = user?.role?.toLowerCase();
    if (role === 'student' || role === 'parent') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Chunk array helper for 413 fix
  const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  const getDates = (year, month) => {
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      const m = String(month + 1).padStart(2, '0');
      return `${year}-${m}-${d}`;
    });
  };

  const dates = getDates(selectedYear, selectedMonth);

  const dayLabel = (dateStr) => {
    const d = new Date(dateStr);
    return ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()];
  };

  const isSunday = (dateStr) => new Date(dateStr).getDay() === 0;
  const isToday  = (dateStr) => dateStr === today.toISOString().split('T')[0];

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = filterClass === 'all'
        ? { section: 'A' }
        : { class: filterClass, section: 'A' };

      // ✅ Parallel Fetching for Registry
      const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      
      const [stuRes, attRes] = await Promise.all([
        getStudents(params),
        getAttendanceByDate(monthPrefix, filterClass === 'all' ? '' : filterClass)
      ]);

      const stuList = stuRes?.data || stuRes || [];
      let safeList = Array.isArray(stuList) ? stuList : [];

      setStudents(safeList);

      const grid = {};
      safeList.forEach(s => { grid[s._id] = {}; });

      const attData = attRes?.data || attRes || [];
      const safeAttData = Array.isArray(attData) ? attData : [];

      safeAttData.forEach(a => {
        const sid = a.studentId?._id || a.studentId;
        if (sid && grid[sid] !== undefined) {
          grid[sid][a.date] = a.status;
        }
      });

      safeList.forEach(s => {
        dates.forEach(date => {
          if (!grid[s._id][date]) grid[s._id][date] = '';
        });
      });

      setAttGrid(grid);
    } catch (err) {
      console.error('FetchAll error:', err);
      showToast('Failed to load data', 'error');
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchAll(); }, [selectedMonth, selectedYear, filterClass]);

  // Mark all students present for TODAY
  const markAllPresentToday = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (!dates.includes(todayStr)) {
      return showToast("Fast-mark only works if today is in the selected month", "error");
    }
    
    setAttGrid(prev => {
      const newGrid = { ...prev };
      students.forEach(s => {
        if (!newGrid[s._id]) newGrid[s._id] = {};
        newGrid[s._id][todayStr] = 'P';
      });
      return newGrid;
    });
    showToast("Marked all as Present for today. Don't forget to SAVE!");
  };

  const setStatus = (studentId, date, status) => {
    setAttGrid(prev => {
      const currentStatus = prev[studentId]?.[date];
      const newStatus = currentStatus === status ? '' : status;
      return {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [date]: newStatus
        }
      };
    });
  };

  // ✅ FIXED: Sequential chunked save to prevent race conditions
  const handleSave = async () => {
    setSaving(true); 
    setSaved(false);

    try {
      const allRecords = [];
      dates.forEach(date => {
        students.forEach(s => {
          const status = attGrid[s._id]?.[date] || '';
          // ✅ FIX: Only save records with actual status (skip empty)
          if (status) {
            allRecords.push({
              studentId: s._id,
              date,
              status: status,
              class: s.class,
              section: 'A'
            });
          }
        });
      });

      // ✅ FIX: Smaller chunk size (500) for reliability
      const chunks = chunkArray(allRecords, 500);
      
      // ✅ FIX: Sequential save instead of Promise.all to avoid race conditions
      let totalSaved = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        await markBulkAttendance({ records: chunk });
        totalSaved += chunk.length;
        console.log(`✅ Chunk ${i + 1}/${chunks.length} saved (${chunk.length} records)`);
      }

      setSaved(true);
      showToast(`Saved ${totalSaved} attendance records!`);
      setTimeout(() => setSaved(false), 3000);

    } catch (err) {
      console.error('Save error:', err);
      showToast(err.message || 'Failed to save attendance', 'error');
    } finally { 
      setSaving(false); 
    }
  };

  const getSummary = (studentId) => {
    const rec = attGrid[studentId] || {};
    const present = Object.values(rec).filter(v => v === 'P').length;
    const absent  = Object.values(rec).filter(v => v === 'A').length;
    return { present, absent };
  };

  const groupedStudents = filterClass === 'all'
    ? classes.reduce((acc, c) => {
        const list = students.filter(s => String(s.class) === String(c));
        if (list.length > 0) acc[c] = list;
        return acc;
      }, {})
    : { [filterClass]: students };

  const thStyle = (sticky = false) => ({
    padding: '8px 4px',
    textAlign: 'center',
    background: 'var(--surface2)',
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    fontWeight: '600',
    color: 'var(--muted)',
    fontSize: '10px',
    position: sticky ? 'sticky' : 'static',
    left: sticky ? 0 : 'auto',
    zIndex: sticky ? 2 : 1,
    whiteSpace: 'nowrap'
  });

  const tdStyle = () => ({
    padding: '4px 3px',
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    verticalAlign: 'middle',
    textAlign: 'center'
  });

  const renderTable = (stuList) => (
    <div className="card" style={{ padding:0, overflowX:'auto', marginBottom:'24px' }}>
      <table style={{ borderCollapse:'collapse', minWidth:'100%', fontSize:'12px' }}>
        <thead>
          <tr><th style={thStyle(true)}>Student</th>{dates.map(d => (<th key={d} style={{ ...thStyle(), background: isToday(d) ? 'var(--accent)' : isSunday(d) ? 'rgba(239,68,68,0.1)' : 'var(--surface2)', color: isToday(d) ? '#fff' : isSunday(d) ? 'var(--red)' : 'var(--muted)', minWidth: '60px', padding: '8px 2px' }}><div style={{ fontSize:'10px' }}>{dayLabel(d)}</div><div style={{ fontWeight:'700', fontSize:'13px' }}>{parseInt(d.split('-')[2])}</div></th>))}<th style={{ ...thStyle(), minWidth:'80px' }}>Total</th></tr>
        </thead>
        <tbody>
          {stuList.map((s, idx) => {
            const { present, absent } = getSummary(s._id);
            return (
              <tr key={s._id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <td style={{ ...tdStyle(), minWidth: '110px', textAlign: 'left', padding: '6px 10px', fontWeight: '500', position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface2)', zIndex: 1 }}><div>{s.name}</div><div style={{ fontSize:'11px', color:'var(--muted)' }}>Roll {s.rollNumber}</div>
                </td>{dates.map(date => { const status = attGrid[s._id]?.[date] || ''; return ( <td key={date} style={tdStyle()}><div style={{ display:'flex', gap:'5px', justifyContent:'center', padding: '4px 0' }}><button onClick={() => setStatus(s._id, date, 'P')} style={{ width: '26px', height: '26px', borderRadius: '6px', border: status === 'P' ? '2px solid var(--green)' : '1px solid var(--border)', cursor: 'pointer', fontWeight: '700', fontSize: '11px', background: status === 'P' ? 'rgba(34,197,94,0.2)' : 'transparent', color: status === 'P' ? 'var(--green)' : 'var(--muted)', transition: 'all 0.1s', lineHeight: 1 }}>P</button><button onClick={() => setStatus(s._id, date, 'A')} style={{ width: '26px', height: '26px', borderRadius: '6px', border: status === 'A' ? '2px solid var(--red)' : 
                  '1px solid var(--border)', cursor: 'pointer', fontWeight: '700', fontSize: '11px', background: status === 'A' ? 'rgba(239,68,68,0.2)' : 'transparent', color: status === 'A' ? 'var(--red)' : 'var(--muted)', transition: 'all 0.1s', lineHeight: 1 }}>A</button></div></td> ); })}<td style={{ ...tdStyle(), fontWeight:'600' }}><span style={{ color:'var(--green)', fontSize:'12px' }}>{present}P</span>{' / '}
                  <span style={{ color:'var(--red)', fontSize:'12px' }}>{absent}A</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white px-4 py-3 rounded-lg shadow-lg z-50 text-sm font-medium animate-fade-in`}>
          {toast.message}
        </div>
      )}

      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: '1 1 300px' }}>
          <h1 className="text-3xl font-extrabold text-white">Attendance Registry</h1>
          <p className="text-slate-400 mt-1 text-base"><strong>{monthNames[selectedMonth]} {selectedYear}</strong> — Monthly Attendance Sheet</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => exportAttendancePDF(monthNames[selectedMonth], selectedYear, filterClass)}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(79, 142, 247, 0.25)',
              background: 'rgba(79, 142, 247, 0.05)',
              color:'var(--accent)',
              cursor:'pointer',
              fontSize:'13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(79, 142, 247, 0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(79, 142, 247, 0.05)'}
          >
            <span style={{ fontSize: '14px' }}>📄</span> Export PDF
          </button>
          {/* ✅ FIX: Mark All Present button */}
          <button 
            onClick={markAllPresentToday}
            disabled={saving}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              background: 'rgba(34, 197, 94, 0.05)',
              color: 'var(--green)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.05)'}
          >
            <span style={{ fontSize: '14px' }}>✅</span> Mark All Present
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || students.length === 0}>
            {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save All'}
          </button>
        </div>
      </div>

      <div style={{ display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
        <select className="filter-select" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
          {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select className="filter-select" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
          {[today.getFullYear()-1, today.getFullYear(), today.getFullYear()+1].map(y =>
            <option key={y} value={y}>{y}</option>
          )}
        </select>
        <select className="filter-select" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="all">📋 All Classes</option>
          {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading attendance sheet...</div>
      ) : students.length === 0 ? (
        <div className="empty-state"><div className="icon">👥</div><p>Student Not Found</p></div>
      ) : filterClass === 'all' ? (
        Object.entries(groupedStudents).map(([cls, stuList]) => (
          <div key={cls}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              margin: '8px 0 10px', padding: '8px 14px',
              background: 'var(--surface2)', borderRadius: '8px',
              borderLeft: '3px solid var(--accent)'
            }}>
              <span style={{ fontWeight:'700', fontSize:'15px', color:'var(--accent)' }}>Class {cls}</span>
              <span style={{ fontSize:'13px', color:'var(--muted)' }}>{stuList.length} students</span>
            </div>
            {renderTable(stuList)}
          </div>
        ))
      ) : (
        renderTable(students)
      )}
    </div>
  );
}