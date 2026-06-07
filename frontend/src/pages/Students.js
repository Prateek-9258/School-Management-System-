import React, { useEffect, useState } from 'react';
import { getStudents, addStudent, updateStudent, deleteStudent, getAttendanceByDate, markBulkAttendance, addFee } from '../services/api';
import { exportStudentsPDF } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './students.css';
import ImportStudents from './Import';

const EMPTY = { name:'', rollNumber:'', class:'', section:'A', gender:'Male', dob:'', parentName:'', contact:'', email:'', address:'', penNo:'' };

const deleteAllStudentsAPI = () => {
  const token = localStorage.getItem('token');
  return fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5005/api'}/students/all`, {
    method: 'DELETE',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }).then(r => r.json());
};

const FEE_EMPTY = { amount: '', month: 'January', type: 'Tuition Fee', status: 'Paid', dueDate: '' };

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s ease'
};

export default function Students() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const isStaff = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'teacher';
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [todayAttendance, setTodayAttendance] = useState({});
  
  // ✅ NEW: Fee Modal states
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState(FEE_EMPTY);

  // ✅ NEW: Total data state
  const [totalData, setTotalData] = useState({
    total: 0,
    filtered: 0,
    classCounts: {}
  });

  // ✅ Student attendance stats
  const [studentAttStats, setStudentAttStats] = useState({ present: 0, absent: 0 });

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterClass && filterClass !== 'all') {
        params.class = filterClass;
      }
      const responseData = await getStudents(params);

      // ✅ NEW: Direct handling of the backend object { success, data, total, classCounts }
      let list = [];
      
      if (responseData && responseData.success && Array.isArray(responseData.data)) {
        list = responseData.data;
        setTotalData({
          total: responseData.total || list.length,
          filtered: responseData.count || list.length,
          classCounts: responseData.classCounts || {}
        });
      } else if (Array.isArray(responseData)) {
        list = responseData;
        const counts = {};
        list.forEach(s => { counts[s.class] = (counts[s.class] || 0) + 1; });
        setTotalData({ total: list.length, filtered: list.length, classCounts: counts });
      }

      // ✅ NEW: Sort list numerically by Class then Roll Number
      list.sort((a, b) => {
        const classCompare = String(a.class).localeCompare(String(b.class), undefined, { numeric: true });
        if (classCompare !== 0) return classCompare;
        return String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true });
      });
      setStudents(list);

    } catch (err) {
      console.error('Fetch error:', err);
      setStudents([]);
      setTotalData({ total: 0, filtered: 0, classCounts: {} });
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAttendance = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const res = await getAttendanceByDate(todayStr, filterClass === 'all' ? '' : filterClass);
      const data = res?.data || res || [];
      const map = {};
      data.forEach(a => {
        const id = a.studentId?._id || a.studentId;
        if (id) map[id] = a.status;
      });
      setTodayAttendance(map);
    } catch (e) {
      console.error('Attendance fetch error:', e);
    }
  };

  const toggleAttendance = async (student) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentStatus = todayAttendance[student._id];
    
    // Cycle logic: Unmarked -> Present -> Absent -> Unmarked
    let newStatus = 'P';
    if (currentStatus === 'P') newStatus = 'A';
    else if (currentStatus === 'A') newStatus = '';
    
    try {
      await markBulkAttendance({
        records: [{
          studentId: student._id,
          date: todayStr,
          status: newStatus,
          class: student.class,
          section: student.section || 'A'
        }]
      });
      setTodayAttendance(prev => ({ ...prev, [student._id]: newStatus }));
    } catch (err) {
      console.error('Toggle attendance error:', err);
    }
  };

  useEffect(() => {
    fetchStudents(); 
    fetchTodayAttendance();
  }, [search, filterClass]);

  // ✅ NEW: Fetch attendance summary for student view
  useEffect(() => {
    if (!isStaff && students.length > 0) {
      const me = students.find(s => s.contact === user?.mobile);
      if (me) {
        const monthPrefix = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        getAttendanceByDate(monthPrefix).then(res => {
          const data = res?.data || res || [];
          const records = data.filter(a => (a.studentId?._id || a.studentId) === me._id);
          setStudentAttStats({
            present: records.filter(r => r.status === 'P').length,
            absent: records.filter(r => r.status === 'A').length
          });
        }).catch(err => console.log('Attendance stats error:', err));
      }
    }
  }, [students, isStaff, user]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setError(''); setShowModal(true); };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ ...s, dob: s.dob ? s.dob.split('T')[0] : '', status: s.status || 'Active', penNo: s.penNo || '' });
    setError('');
    setShowModal(true);
  };

  // ✅ NEW: Open Fee Modal
  const openFeeModal = (s) => {
    setEditing(s);
    setFeeForm({ ...FEE_EMPTY, amount: '' });
    setShowFeeModal(true);
  };

  const handleFeeSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Use standardized API service instead of direct fetch
      const payload = { ...feeForm, date: feeForm.dueDate, studentId: editing._id };
      await addFee(payload);
      
      setShowFeeModal(false);
      alert('Fee recorded successfully!');
    } catch (err) {
      alert(err.message);
    } finally { setSaving(false); }
  };

  const closeModal = () => setShowModal(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const { _id, __v, createdAt, updatedAt, ...updateData } = form;
        await updateStudent(editing._id, updateData);
      } else {
        await addStudent(form);
      }
      closeModal();
      fetchStudents();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save student');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this student?')) return;
    await deleteStudent(id);
    fetchStudents();
  };

  // ✅ NEW: Function to trigger sync from UI
  const handleSyncLogins = async () => {
    if (!window.confirm('Yeh saare students ke liye login accounts create/fix kar dega. Continue?')) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/students/sync-all-logins', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.message || 'Sync Successful');
      fetchStudents();
    } catch (err) { alert('Sync failed: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteAll = async () => {
    if (students.length === 0) return alert('No students to delete.');

    const confirm1 = window.confirm(`⚠️ ${students.length} students will be deleted! Are you sure?`);
    if (!confirm1) return;

    const confirm2 = window.confirm('This action cannot be undone. Do you want to proceed?');
    if (!confirm2) return;

    try {
      await deleteAllStudentsAPI();
      fetchStudents();
      alert('All students deleted successfully.');
    } catch (err) {
      alert('Failed to delete students: ' + err.message);
    }
  };

  const classes = ['1','2','3','4','5','6','7','8'];
  const sections = ['A'];

  // RBAC: Student/Parent Profile View
  if (!isStaff && !loading) {
    const myProfile = students.find(s => s._id === user?.studentId || s.contact === user?.mobile);
    
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎓</div>
          <h1 className="text-3xl font-black text-white">{myProfile?.name || user?.name}</h1>
          <p className="text-indigo-400 font-bold mb-8">Student Profile Summary</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Academic Info</p>
              <p className="text-white"><strong>Class:</strong> {myProfile?.class || 'N/A'}</p>
              <p className="text-white"><strong>Roll No:</strong> {myProfile?.rollNumber || 'N/A'}</p>
              {/* PEN No is hidden here for student role */}
            </div>
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Personal Details</p>
              <p className="text-white"><strong>Parent:</strong> {myProfile?.parentName || 'N/A'}</p>
              <p className="text-white"><strong>Contact:</strong> {myProfile?.contact || 'N/A'}</p>
              <p className="text-white"><strong>Gender:</strong> {myProfile?.gender || 'N/A'}</p>
            </div>
          </div>

          {/* Attendance Stats Cards */}
          <div className="mt-8 bg-slate-800/80 p-8 rounded-3xl border border-indigo-500/30 shadow-2xl">
            <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-6">Attendance Record (This Month)</h3>
            <div className="flex justify-center gap-12">
              <div className="text-center">
                <div className="text-5xl font-black text-green-400">{studentAttStats.present}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-2">Days Present</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-black text-rose-400">{studentAttStats.absent}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-2">Days Absent</div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex gap-4 justify-center">
            <button onClick={() => window.location.href='/fees'} className="btn btn-primary">View My Fees</button>
            <button onClick={() => window.alert('Attendance tracking for students coming soon!')} className="btn btn-ghost">Attendance Record</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'16px', marginBottom: '20px'}}>
        <div style={{ flex: '1 1 300px' }}>
          <h1>Students</h1>
          <p style={{ fontSize: '14px', margin: '4px 0' }}>
            Manage all student records · 
            <span style={{color:'var(--accent)',fontWeight:'500'}}>
               {totalData.filtered}/{totalData.total} Students
            </span>
          </p>

          {/* ✅ NEW: Class-wise count badges */}
          {Object.keys(totalData.classCounts).length > 0 && (
            <div style={{display:'flex',gap:'8px',marginTop:'8px',flexWrap:'wrap'}}>
              {Object.entries(totalData.classCounts).map(([cls, count]) => (
                <span 
                  key={cls}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: filterClass === cls ? 'var(--accent)' : 'var(--surface2)',
                    color: filterClass === cls ? '#fff' : 'var(--muted)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: '1px solid var(--border)'
                  }}
                  onClick={() => setFilterClass(filterClass === cls ? '' : cls)}
                >
                  Class {cls}: {count}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap', justifyContent: 'flex-start'}}>
          <ImportStudents onImportSuccess={fetchStudents} />
          <button 
            onClick={() => exportStudentsPDF(filterClass)}
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
          >
            <span style={{ fontSize: '14px' }}>📄</span> Export PDF
          </button>
          {user?.role?.toLowerCase() === 'admin' && (
            <React.Fragment>
              <button 
                className="btn btn-primary" 
                onClick={openAdd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '600',
                  padding: '10px 18px'
                }}
              >
                <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> Add Student
              </button>
              <button
                onClick={handleDeleteAll}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  background: 'rgba(239, 68, 68, 0.05)',
                  color:'var(--red)',
                  cursor:'pointer',
                  fontSize:'13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontSize: '14px' }}>🗑️</span> Delete All
              </button>
              <button
                onClick={handleSyncLogins}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  background: 'rgba(16, 185, 129, 0.05)',
                  color:'var(--green)',
                  cursor:'pointer',
                  fontSize:'13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontSize: '14px' }}>🔄</span> Sync Logins
              </button>
            </React.Fragment>
          )}
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Search name, class or roll..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
            <option value="all">All Classes</option>
            {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👥</div>
            <p>No students found</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Sr.</th><th>Roll No</th><th>Name</th><th>Class</th><th>Section</th><th>PEN No</th><th>Gender</th><th>Parent</th><th>Contact</th><th>Today's Attendance</th>{user?.role?.toLowerCase() === 'admin' && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {students.map((s, index) => (
                  <tr key={s._id}>
                    <td><span style={{fontFamily:'monospace',fontSize:'13px',color:'var(--muted)'}}>{index + 1}</span></td><td><span style={{fontFamily:'monospace',fontSize:'13px',color:'var(--accent)'}}>{s.rollNumber}</span></td><td><span style={{fontWeight:'500'}}>{s.name}</span></td><td><span style={{fontWeight:'600',color:'var(--accent)'}}>{s.class}</span></td><td><span style={{fontWeight:'600'}}>{s.section}</span></td><td><span style={{fontFamily:'monospace',fontSize:'13px',color:'var(--muted)'}}>{s.penNo || '—'}</span></td><td>{s.gender}</td><td style={{color:'var(--muted)',fontSize:'13px'}}>{s.parentName || '—'}</td><td style={{fontSize:'13px'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text)' }}>{s.contact || '—'}</span>
                        {s.contact && (
                          <a 
                            href={`https://wa.me/91${s.contact}?text=Hello, this is regarding student ${s.name} (Roll: ${s.rollNumber}) from Savita Bal Shiksha Niketan.`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ textDecoration: 'none', fontSize: '20px', lineHeight: 1, filter: 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.6))', cursor: 'pointer' }}
                            title="Message on WhatsApp"
                          >💬</a>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleAttendance(s)}
                        className={`badge ${
                          !todayAttendance[s._id] ? 'badge-blue' : 
                          todayAttendance[s._id] === 'P' ? 'badge-green' : 'badge-red'
                        }`}
                        style={{ border:'none', cursor:'pointer', padding:'8px 12px', minWidth:'70px', textAlign:'center', fontSize: '11px', fontWeight: '600' }}
                      >
                        {!todayAttendance[s._id] ? 'Mark' : todayAttendance[s._id] === 'P' ? 'P' : 'A'}
                      </button>
                    </td>
                    {user?.role?.toLowerCase() === 'admin' && (
                      <td>
                        <div style={{display:'flex', gap:'6px', flexWrap: 'nowrap'}}>
                          <button 
                            className="btn btn-ghost" 
                            style={{
                              padding: '8px 14px',
                              fontSize: '13px',
                              borderRadius: '6px',
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }} 
                            onClick={() => openEdit(s)}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className="btn btn-ghost" 
                            style={{
                              padding: '8px 14px',
                              fontSize: '13px',
                              borderRadius: '6px',
                              color: 'var(--green)',
                              background: 'rgba(34, 197, 94, 0.05)',
                              border: '1px solid rgba(34, 197, 94, 0.1)'
                            }} 
                            onClick={() => openFeeModal(s)}
                          >
                            💰 Fee
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '6px', fontWeight: '500' }} 
                            onClick={() => handleDelete(s._id)}
                          >
                            🗑️ Del
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Student' : 'Add New Student'}</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '24px', padding: '20px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--accent)', marginBottom: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '4px solid var(--accent)', marginLeft: '-20px', paddingLeft: '16px' }}>
                  <span style={{ fontSize: '16px' }}>👤</span> Basic Information
                </h3>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Full Name *</label>
                    <input 
                      value={form.name} 
                      onChange={e => setForm({...form,name:e.target.value})} 
                      required 
                      placeholder="Student full name"
                      style={{ borderRadius: '10px', border: '1px solid var(--border)', padding: '12px', background: 'var(--surface2)', fontSize: '14px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Roll Number *</label>
                    <input value={form.rollNumber} onChange={e => setForm({...form,rollNumber:e.target.value})} required placeholder="e.g. 101" style={{ borderRadius: '10px', border: '1px solid var(--border)', padding: '12px', background: 'var(--surface2)', fontSize: '14px' }} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Class *</label>
                    <select 
                      value={form.class} 
                      onChange={e => setForm({...form,class:e.target.value})} 
                      required
                      style={fieldStyle}
                    >
                      <option value="">Select Class</option>
                      {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Section *</label>
                    <select 
                      value={form.section} 
                      onChange={e => setForm({...form,section:e.target.value})} 
                      required
                      style={fieldStyle}
                    >
                      {sections.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '24px', padding: '20px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text)', marginBottom: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '4px solid #cbd5e1', marginLeft: '-20px', paddingLeft: '16px' }}>
                  <span style={{ fontSize: '16px' }}>📝</span> Personal Details
                </h3>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Gender</label>
                    <select 
                      value={form.gender} 
                      onChange={e => setForm({...form,gender:e.target.value})}
                      style={fieldStyle}
                    >
                      {['Male','Female','Other'].map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Date of Birth</label>
                    <input 
                      type="date" 
                      value={form.dob} 
                      onChange={e => setForm({...form,dob:e.target.value})} 
                      style={fieldStyle}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>PEN No</label>
                    <input 
                      value={form.penNo} 
                      onChange={e => setForm({...form,penNo:e.target.value})} 
                      placeholder="e.g. 12345678" 
                      style={fieldStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Parent Name</label>
                    <input 
                      value={form.parentName} 
                      onChange={e => setForm({...form,parentName:e.target.value})} 
                      placeholder="Father/Mother name" 
                      style={fieldStyle}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '20px', padding: '20px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text)', marginBottom: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '4px solid #cbd5e1', marginLeft: '-20px', paddingLeft: '16px' }}>
                  <span style={{ fontSize: '16px' }}>📞</span> Contact & Address
                </h3>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Contact</label>
                    <input 
                      value={form.contact} 
                      onChange={e => setForm({...form,contact:e.target.value})} 
                      placeholder="10-digit mobile" 
                      style={fieldStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Email</label>
                    <input 
                      type="email" 
                      value={form.email} 
                      onChange={e => setForm({...form,email:e.target.value})} 
                      placeholder="email@example.com"
                      style={fieldStyle}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Address</label>
                  <textarea 
                    rows={2} 
                    value={form.address} 
                    onChange={e => setForm({...form,address:e.target.value})} 
                    style={{...fieldStyle, resize:'vertical'}} 
                    placeholder="Full residential address"
                  />
                </div>
              </div>

              {editing && (
                <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(239, 68, 68, 0.02)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '8px' }}>Student Status</label>
                    <select 
                      value={form.status} 
                      onChange={e => setForm({...form,status:e.target.value})}
                      style={fieldStyle}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:'12px',justifyContent:'flex-end',marginTop:'12px', paddingTop: '16px', borderTop: '1px solid var(--border)'}}>
                <button type="button" className="btn btn-ghost" onClick={closeModal} style={{ padding: '10px 20px' }}>Cancel</button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={saving}
                  style={{ padding: '10px 32px', fontWeight: '600', boxShadow: '0 4px 12px rgba(79, 142, 247, 0.2)' }}
                >
                  {saving ? 'Saving...' : (editing ? 'Update Student' : 'Add Student')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ NEW: Collect Fee Modal */}
      {showFeeModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowFeeModal(false)}>
          <div className="modal" style={{ maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px' }}>💰 Collect Fee: {editing?.name}</h2>
              <button className="modal-close" onClick={() => setShowFeeModal(false)}>×</button>
            </div>
            <form onSubmit={handleFeeSubmit} style={{ padding: '5px' }}>
              <div style={{ marginBottom: '20px', padding: '20px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--accent)', marginBottom: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '4px solid var(--accent)', marginLeft: '-20px', paddingLeft: '16px' }}>
                  <span style={{ fontSize: '16px' }}>💵</span> Payment Information
                </h3>
                
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Amount (Rs.) *</label>
                  <input 
                    type="number" 
                    value={feeForm.amount} 
                    onChange={e => setFeeForm({...feeForm, amount: e.target.value})} 
                    required 
                    placeholder="e.g. 1000"
                    style={fieldStyle} 
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Month *</label>
                    <select value={feeForm.month} onChange={e => setFeeForm({...feeForm, month: e.target.value})} style={fieldStyle}>
                      {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Status</label>
                    <select value={feeForm.status} onChange={e => setFeeForm({...feeForm, status: e.target.value})} style={fieldStyle}>
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Due Date *</label>
                  <input 
                    type="date" 
                    value={feeForm.dueDate} 
                    onChange={e => setFeeForm({...feeForm, dueDate: e.target.value})} 
                    required 
                    style={fieldStyle} 
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Fee Type</label>
                  <select value={feeForm.type} onChange={e => setFeeForm({...feeForm, type: e.target.value})} style={fieldStyle}>
                    <option value="Tuition Fee">Tuition Fee</option>
                    <option value="Examination Fee">Examination Fee</option>
                    <option value="Admission Fee">Admission Fee</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{display:'flex', gap:'12px', marginTop:'12px', paddingTop: '16px', borderTop: '1px solid var(--border)'}}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowFeeModal(false)} style={{ flex: 1, padding: '10px' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2, padding: '10px', fontWeight: '600', boxShadow: '0 4px 12px rgba(79, 142, 247, 0.2)' }}>
                  {saving ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}