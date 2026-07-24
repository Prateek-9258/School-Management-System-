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

// ✅ NEW: simple hook to detect mobile viewport so we can switch
// between the desktop grid table and the mobile card layout.
function useIsMobile(breakpoint = 641) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);

  return isMobile;
}

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

  const isMobile = useIsMobile(); // ✅ NEW

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

  // ✅ single source of truth for column widths.
  // Both header row and every student row use this SAME string,
  // so columns can never drift apart — no <table> auto-width guessing involved.
  const gridTemplate = `var(--col-name) repeat(${dates.length}, var(--col-date)) var(--col-total)`;

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = filterClass === 'all'
        ? { section: 'A' }
        : { class: filterClass, section: 'A' };

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

  // ✅ NEW: used by the compact mobile card view — one tap cycles
  // through blank -> Present -> Absent -> blank, saving space vs
  // showing two separate P/A buttons per day.
  const cycleStatus = (studentId, date) => {
    setAttGrid(prev => {
      const current = prev[studentId]?.[date] || '';
      const next = current === '' ? 'P' : current === 'P' ? 'A' : '';
      return {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [date]: next
        }
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const allRecords = [];
      dates.forEach(date => {
        students.forEach(s => {
          const status = attGrid[s._id]?.[date] || '';
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

      const chunks = chunkArray(allRecords, 500);

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

  // ===== Desktop / tablet view: grid-based table =====
  const renderGridTable = (stuList) => (
    <div className="card att-grid-wrap">
      <div className="att-grid" style={{ gridTemplateColumns: gridTemplate }}>
        {/* Header row */}
        <div className="att-row att-header-row" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="att-cell att-cell-name att-sticky-col att-header-cell">Student</div>
          {dates.map(d => (
            <div
              key={d}
              className={`att-cell att-cell-date att-header-cell ${isToday(d) ? 'att-today' : ''} ${isSunday(d) ? 'att-sunday' : ''}`}
            >
              <div className="att-day-label">{dayLabel(d)}</div>
              <div className="att-day-num">{parseInt(d.split('-')[2])}</div>
            </div>
          ))}
          <div className="att-cell att-cell-total att-header-cell">Total</div>
        </div>

        {/* Student rows */}
        {stuList.map((s, idx) => {
          const { present, absent } = getSummary(s._id);
          return (
            <div
              key={s._id}
              className="att-row"
              style={{
                gridTemplateColumns: gridTemplate,
                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
              }}
            >
              <div
                className="att-cell att-cell-name att-sticky-col"
                style={{ background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}
              >
                <div className="att-student-name">{s.name}</div>
                <div className="att-student-roll">Roll {s.rollNumber}</div>
              </div>

              {dates.map(date => {
                const status = attGrid[s._id]?.[date] || '';
                return (
                  <div key={date} className="att-cell att-cell-date">
                    <div className="att-btn-group">
                      <button
                        onClick={() => setStatus(s._id, date, 'P')}
                        className={`att-btn ${status === 'P' ? 'att-btn-present' : ''}`}
                      >
                        P
                      </button>
                      <button
                        onClick={() => setStatus(s._id, date, 'A')}
                        className={`att-btn ${status === 'A' ? 'att-btn-absent' : ''}`}
                      >
                        A
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="att-cell att-cell-total">
                <span className="att-present-count">{present}P</span>
                {' / '}
                <span className="att-absent-count">{absent}A</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ===== Mobile view: one card per student =====
  const renderCardView = (stuList) => (
    <div className="att-cards-wrap">
      {stuList.map(s => {
        const { present, absent } = getSummary(s._id);
        return (
          <div key={s._id} className="att-card">
            <div className="att-card-header">
              <div>
                <div className="att-card-name">{s.name}</div>
                <div className="att-card-roll">Roll {s.rollNumber}</div>
              </div>
              <div className="att-card-summary">
                <span className="att-present-count">{present}P</span>
                {' / '}
                <span className="att-absent-count">{absent}A</span>
              </div>
            </div>

            <div className="att-card-days">
              {dates.map(date => {
                const status = attGrid[s._id]?.[date] || '';
                const stateClass =
                  status === 'P' ? 'att-chip-present' :
                  status === 'A' ? 'att-chip-absent' : '';
                return (
                  <button
                    key={date}
                    onClick={() => cycleStatus(s._id, date)}
                    className={`att-day-chip ${isToday(date) ? 'att-chip-today' : ''} ${isSunday(date) ? 'att-chip-sunday' : ''}`}
                  >
                    <span className="att-day-chip-label">
                      {dayLabel(date)} {parseInt(date.split('-')[2])}
                    </span>
                    <span className={`att-day-chip-status ${stateClass}`}>
                      {status || '–'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderStudents = (stuList) => (
    isMobile ? renderCardView(stuList) : renderGridTable(stuList)
  );

  return (
    <div>
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
            className="btn-export"
          >
            <span style={{ fontSize: '14px' }}>📄</span> Export PDF
          </button>
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
            <div className="class-group-header">
              <span className="class-name">Class {cls}</span>
              <span className="student-count">{stuList.length} students</span>
            </div>
            {renderStudents(stuList)}
          </div>
        ))
      ) : (
        renderStudents(students)
      )}
    </div>
  );
}