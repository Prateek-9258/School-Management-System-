import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudents, getStudentFees, updateFee, addFee, getPendingFees, deleteFee, generateBulkFees } from '../services/api';
import { exportFeesPDF } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth();

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

export default function Fees() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // RBAC: Teachers cannot access Fees
  useEffect(() => {
    if (user?.role?.toLowerCase() === 'teacher') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const isStudentOrParent = user?.role?.toLowerCase() === 'student' || user?.role?.toLowerCase() === 'parent';
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const [students,       setStudents]       = useState([]);
  const [loadingStudents,setLoadingStudents] = useState(true);
  const [searchStudent,  setSearchStudent]  = useState('');
  const [filterClass,    setFilterClass]    = useState('');

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentFees,     setStudentFees]     = useState([]);
  const [loadingFees,     setLoadingFees]     = useState(false);

  const [filterMonth,  setFilterMonth]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchHistory, setSearchHistory] = useState(''); // ✅ NEW: Search in history
  const [pendingFees, setPendingFees] = useState([]); // ✅ NEW: Global defaulters list

  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false); // ✅ NEW: Bulk modal state
  const [editingFee, setEditingFee] = useState(null); // ✅ NEW: State for editing
  const [form,      setForm]      = useState({
    type: 'Tuition', amount: '', dueDate: '', month: '', remarks: '', paymentMethod: 'Cash', status: 'Pending' 
  });
  const [bulkForm, setBulkForm] = useState({ type: 'Tuition', amount: '', dueDate: '', month: '', class: 'all' });
  const [saving,  setSaving]  = useState(false);
  const [feeError,setFeeError] = useState('');

  const classes = ['1','2','3','4','5','6','7','8'];

  const fetchPendingGlobal = async () => {
    try {
      const pRes = await getPendingFees();
      const pData = Array.isArray(pRes) ? pRes : (pRes?.data || []);
      setPendingFees(pData);
    } catch (e) { console.log(e); }
  };

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const params = { status: 'Active' };
      if (filterClass)   params.class  = filterClass;
      if (searchStudent) params.search = searchStudent;
      const res = await getStudents(params);
      const data = res?.data || res || [];
      setStudents(Array.isArray(data) ? data : []);
      fetchPendingGlobal();

    } catch (e) {
      console.error(e);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [filterClass, searchStudent]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // ✅ Auto-load student fees for student role
  useEffect(() => {
    if (isStudentOrParent && students.length > 0 && !selectedStudent) {
      const me = students.find(s => s.contact === user?.mobile);
      if (me) fetchStudentFees(me);
    }
  }, [students, isStudentOrParent, user, selectedStudent]);

  const fetchStudentFees = async (student) => {
    setSelectedStudent(student);
    setStudentFees([]);
    setLoadingFees(true);
    try {
       const res = await getStudentFees(student._id);
      const data = res?.data || res || [];
      setStudentFees(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setStudentFees([]);
    } finally {
      setLoadingFees(false);
    }
  };

  // ✅ Fix: toggleStatus function define kiya (Backend status 'Pending' ke saath)
  const toggleStatus = async (fee) => {
    const newStatus = fee.status === 'Paid' ? 'Pending' : 'Paid';
    const confirmMsg = newStatus === 'Paid' ? 'Mark this record as PAID?' : 'Mark this record as PENDING?';
    if(!window.confirm(confirmMsg)) return;

    const updateData = { 
      status: newStatus,
      paidDate: newStatus === 'Paid' ? new Date() : null 
    };
    
    try {
      await updateFee(fee._id, updateData);
      if (selectedStudent) fetchStudentFees(selectedStudent);
      fetchPendingGlobal();
    } catch (e) { console.error(e); }
  };

  // ✅ NEW: Delete fee record
  const handleDeleteFee = async (feeId) => {
    if (!window.confirm('Are you sure you want to delete this fee record? This action cannot be undone.')) return;
    try {
      await deleteFee(feeId);
      if (selectedStudent) fetchStudentFees(selectedStudent);
      fetchPendingGlobal();
    } catch (e) { console.error(e); alert('Failed to delete fee record'); }
  };

  // ✅ NEW: Open modal for editing
  const openEditFee = (fee) => {
    setEditingFee(fee);
    setForm({
      type: fee.type || 'Tuition',
      amount: fee.amount,
      dueDate: fee.dueDate ? fee.dueDate.split('T')[0] : (fee.date ? fee.date.split('T')[0] : ''),
      month: fee.month,
      remarks: fee.remarks || '',
      paymentMethod: fee.paymentMethod || 'Cash',
      status: fee.status || 'Pending'
    });
    setFeeError('');
    setShowModal(true);
  };

  const handleBulkGenerate = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Generate ${bulkForm.type} for all active students?`)) return;
    setSaving(true);
    try {
      await generateBulkFees(bulkForm);
      setShowBulkModal(false);
      alert('Fees generated successfully!');
      fetchPendingGlobal();
    } catch (err) { alert(err.message); } finally { setSaving(false); }
  };

  const handleAddFee = async (e) => {
    e.preventDefault();
    setSaving(true); setFeeError('');
    try {
      const payload = { ...form, dueDate: form.dueDate, date: form.dueDate, studentId: selectedStudent._id };
      
      if (editingFee) {
        await updateFee(editingFee._id, payload);
      } else {
        await addFee(payload);
      }

      setShowModal(false);
      setEditingFee(null);
      setForm({ type:'Tuition', amount:'', dueDate:'', month:'', remarks:'', paymentMethod: 'Cash', status: 'Pending' });
      fetchStudentFees(selectedStudent);
      fetchPendingGlobal(); // ✅ Refresh global pending list after adding
    } catch (err) {
      setFeeError(err.response?.data?.error || 'Failed to add fee');
    } finally { setSaving(false); }
  };

  const filteredFees = studentFees.filter(f => {
    if (filterMonth  && f.month   !== filterMonth)  return false;
    if (filterStatus && f.status  !== filterStatus) return false;
    if (searchHistory) { // ✅ NEW: Search logic
      const term = searchHistory.toLowerCase();
      return f.type?.toLowerCase().includes(term) || f.remarks?.toLowerCase().includes(term);
    }
    return true;
  });

  const totalDue    = studentFees.reduce((s, f) => s + (f.amount || 0), 0);
  const totalPaid   = studentFees.filter(f => f.status === 'Paid').reduce((s,f) => s + f.amount, 0);
  const totalUnpaid = studentFees.filter(f => f.status !== 'Paid').reduce((s,f) => s + f.amount, 0);

  const statusColor = { Paid:'badge-green', Pending:'badge-red', Partial:'badge-yellow' };

  return (
    <div style={{ display:'flex', flexWrap: 'wrap', gap:'20px', minHeight:'calc(100vh - 120px)' }}>

      {/* LEFT PANEL — Students List (Hidden for Student Role) */}
      {!isStudentOrParent && (
      <div style={{
        width: '100%', maxWidth: '300px', flex: '1 1 300px',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding:'16px', borderBottom:'1px solid var(--border)' }}>
          <h3 style={{ fontSize:'15px', fontWeight:'600', marginBottom:'12px' }}>
            👥 Students
          </h3>
          <div style={{
            display:'flex', alignItems:'center', gap:'8px',
            background:'var(--surface2)', border:'1px solid var(--border)',
            borderRadius:'8px', padding:'0 10px', marginBottom:'8px'
          }}>
            <span style={{color:'var(--muted)'}}>🔍</span>
            <input
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              placeholder="Search student..."
              style={{
                border:'none', background:'none', color:'var(--text)',
                fontFamily:'inherit', fontSize:'13px', padding:'8px 0',
                outline:'none', flex:1
              }}
            />
          </div>
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            style={{
              width:'100%', padding:'7px 10px',
              background:'var(--surface2)', border:'1px solid var(--border)',
              borderRadius:'8px', color:'var(--text)',
              fontFamily:'inherit', fontSize:'13px', outline:'none'
            }}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {loadingStudents ? (
            <div style={{ padding:'20px', textAlign:'center', color:'var(--muted)', fontSize:'13px' }}>
              Loading...
            </div>
          ) : students.length === 0 ? (
            <div style={{ padding:'20px', textAlign:'center', color:'var(--muted)', fontSize:'13px' }}>
              No students found
            </div>
          ) : (
            students.map(s => {
              const isSelected = selectedStudent?._id === s._id;
                // Find if this student has any pending amount in global list
                const studentPendingTotal = pendingFees
                  .filter(f => f.studentId?._id === s._id)
                  .reduce((acc, curr) => acc + (curr.amount || 0), 0);

              return (
                <div
                  key={s._id}
                  onClick={() => fetchStudentFees(s)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(79,142,247,0.1)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    transition: 'all 0.12s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight:'600', fontSize:'14px', color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                      {s.name}
                    </div>
                    {user?.role?.toLowerCase() === 'admin' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Parent click (selection) rokne ke liye
                          setSelectedStudent(s);
                              setEditingFee(null);
                              setForm({ type: 'Tuition', amount: '', dueDate: '', month: '', remarks: '', paymentMethod: 'Cash', status: 'Pending' });
                          setFeeError('');
                          setShowModal(true);
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          borderRadius: '6px',
                          background: 'rgba(34, 197, 94, 0.1)',
                          color: 'var(--green)',
                          border: '1px solid rgba(34, 197, 94, 0.2)',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        💰 Fee
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <div style={{ fontSize:'12px', color:'var(--muted)' }}>
                      Roll: {s.rollNumber} &nbsp;·&nbsp; Cls: {s.class}
                    </div>
                    {studentPendingTotal > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--red)', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                        ₹{studentPendingTotal} Due
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{
          padding:'10px 16px', borderTop:'1px solid var(--border)',
          fontSize:'12px', color:'var(--muted)', textAlign:'center'
        }}>
          {students.length} students
        </div>
      </div>
      )}

      {/* RIGHT PANEL — Fee Details */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* ✅ Global Back Button */}
        {!isStudentOrParent && (
        <div style={{ marginBottom: '12px' }}>
          <button 
            onClick={() => {
              if (selectedStudent) setSelectedStudent(null);
              else navigate(-1);
            }} 
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 12px' }}
          >
            <span style={{ fontSize: '18px' }}>←</span> 
            {selectedStudent ? 'Back to Student List' : 'Back to Previous Page'}
          </button>
        </div>
        )}

        {/* ✅ Bulk Actions Bar */}
        {!selectedStudent && user?.role?.toLowerCase() === 'admin' && (
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowBulkModal(true)} className="btn btn-primary" style={{ background: 'var(--indigo)', gap: '8px' }}>
              ⚡ Bulk Generate Monthly Fees
            </button>
          </div>
        )}

        {!selectedStudent && (
          <div style={{
            flex:1, display:'flex', flexDirection:'column',
            background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:'var(--radius)', color:'var(--text)', padding: '24px', overflowY: 'auto'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '20px' }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>💰</div>
              <div style={{ fontSize:'20px', fontWeight:'700' }}>Fee Management</div>
              <div style={{ fontSize:'14px', color:'var(--muted)', marginTop:'6px' }}>
                Select a student or manage recent pending dues below
              </div>
            </div>

            {pendingFees.length > 0 && (
              <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
                  🕒 Recent Pending Dues
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pendingFees.slice(0, 6).map(fee => (
                    <div key={fee._id} style={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px',
                      flexWrap: 'wrap', gap: '10px'
                    }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{fee?.studentId?.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '600' }}>{(fee.type || 'Fee')} — {fee.month}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '800', color: 'var(--red)', fontSize: '15px' }}>₹{fee.amount}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Due: {(fee.dueDate || fee.date) ? new Date(fee.dueDate || fee.date).toLocaleDateString('en-IN') : 'N/A'}</div>
                        </div>
                        <button 
                          onClick={() => toggleStatus(fee)}
                          style={{
                            padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--green)',
                            background: 'rgba(34, 197, 94, 0.1)', color: 'var(--green)', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
                          }}
                        >
                          ✓ PAID
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedStudent && (
          <>
            <div style={{
              background:'var(--surface)', border:'1px solid var(--border)',
              borderRadius:'var(--radius)', padding:'16px 20px',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              marginBottom:'16px', flexWrap:'wrap', gap:'12px'
            }}>
              <div>
                <h2 style={{ fontSize:'18px', fontWeight:'700' }}>{selectedStudent.name}</h2>
                <div style={{ fontSize:'13px', color:'var(--muted)', marginTop:'3px' }}>
                  Roll: {selectedStudent.rollNumber} &nbsp;·&nbsp;
                  Class {selectedStudent.class}-{selectedStudent.section} &nbsp;·&nbsp;
                  {selectedStudent.parentName && `Parent: ${selectedStudent.parentName}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {/* ✅ NEW: Export PDF Button */}
                <button 
                  onClick={() => exportFeesPDF(selectedStudent._id)}
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
                {user?.role?.toLowerCase() === 'admin' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => { setEditingFee(null); setForm({ type: 'Tuition', amount: '', dueDate: '', month: '', remarks: '', paymentMethod: 'Cash', status: 'Pending' }); setFeeError(''); setShowModal(true); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: '600'
                    }}
                  >
                    <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> Add Fee
                  </button>
                )}
              </div>
            </div>

            <div style={{
              display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))',
              gap:'12px', marginBottom:'16px'
            }}>
              {[
                { label:'Total Due',    value:`₹${totalDue.toLocaleString()}`,    color:'var(--accent)' },
                { label:'Total Paid',   value:`₹${totalPaid.toLocaleString()}`,   color:'var(--green)'  },
                { label:'Pending',      value:`₹${totalUnpaid.toLocaleString()}`, color:'var(--red)'    },
              ].map(stat => (
                <div key={stat.label} style={{
                  background:'var(--surface)', border:'1px solid var(--border)',
                  borderRadius:'var(--radius)', padding:'14px 16px'
                }}>
                  <div style={{ fontSize:'11px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize:'22px', fontWeight:'700', color: stat.color }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:'10px', marginBottom:'12px', flexWrap:'wrap' }}>
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                style={{
                  padding:'8px 12px', background:'var(--surface2)',
                  border:'1px solid var(--border)', borderRadius:'8px',
                  color:'var(--text)', fontFamily:'inherit', fontSize:'13px', outline:'none'
                }}
              >
                <option value="">All Months</option>
                {[...new Set(studentFees.map(f => f.month))].filter(Boolean).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{
                  padding:'8px 12px', background:'var(--surface2)',
                  border:'1px solid var(--border)', borderRadius:'8px',
                  color:'var(--text)', fontFamily:'inherit', fontSize:'13px', outline:'none'
                }}
              >
                <option value="">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
              </select>
              {/* ✅ NEW: History Search Input */}
              <div style={{
                display:'flex', alignItems:'center', gap:'6px',
                background:'var(--surface2)', border:'1px solid var(--border)',
                borderRadius:'8px', padding:'0 12px', flex: 1, minWidth: '150px'
              }}>
                <span style={{fontSize: '12px'}}>🔍</span>
                <input 
                  placeholder="Search remarks or type..." 
                  value={searchHistory} onChange={e => setSearchHistory(e.target.value)}
                  style={{ border:'none', background:'none', color:'var(--text)', fontSize:'13px', padding:'8px 0', outline:'none', width:'100%' }}
                />
              </div>
              <div style={{ fontSize:'13px', color:'var(--muted)', display:'flex', alignItems:'center' }}>
                {filteredFees.length} records
              </div>
            </div>

            <div style={{
              flex:1, background:'var(--surface)', border:'1px solid var(--border)',
              borderRadius:'var(--radius)', overflow:'hidden', display:'flex', flexDirection:'column'
            }}>
              {loadingFees ? (
                <div className="loading">Loading fees...</div>
              ) : filteredFees.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">💳</div>
                  <p>{studentFees.length === 0 ? 'No fee records found for this student' : 'No records match the filter'}</p>
                </div>
              ) : (
                <div style={{ overflowY:'auto', flex:1 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'14px' }}>
                    <thead style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:1 }}>
                      <tr><th style={{ padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>Month</th><th style={{ padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>Fee Type</th><th style={{ padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>Method</th><th style={{ padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>Amount</th><th style={{ padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>Due Date</th><th style={{ padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>Status</th>{user?.role?.toLowerCase() === 'admin' && (<th style={{ padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>Action</th>)}</tr>
                    </thead>
                    <tbody>
                      {filteredFees.map(fee => (
                        <tr key={fee._id} style={{ borderBottom:'1px solid var(--border)' }} onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}><td style={{ padding:'13px 16px', fontWeight:'500' }}>{fee.month || '—'}</td><td style={{ padding:'13px 16px' }}><span className="badge badge-blue">{fee.type}</span></td><td style={{ padding:'13px 16px', fontSize: '12px', color: 'var(--muted)' }}>{fee.paymentMethod || 'Cash'}</td><td style={{ padding:'13px 16px', fontFamily:'monospace', fontWeight:'600' }}>₹{fee.amount?.toLocaleString()}</td><td style={{ padding:'13px 16px', fontSize:'13px', color:'var(--muted)' }}>{(fee.dueDate || fee.date) ? new Date(fee.dueDate || fee.date).toLocaleDateString('en-IN') : '—'}</td><td style={{ padding:'13px 16px' }}><span className={`badge ${statusColor[fee.status] || 'badge-blue'}`}>{fee.status}</span>{fee.status === 'Paid' && fee.paidDate && (<div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{new Date(fee.paidDate).toLocaleDateString('en-IN')}</div>)}</td>{user?.role?.toLowerCase() === 'admin' && (<td style={{ padding:'13px 16px' }}><div style={{ display: 'flex', gap: '8px' }}><button onClick={() => openEditFee(fee)} style={{ padding: '8px 12px', background: 'rgba(79, 142, 247, 0.08)', border: '1px solid rgba(79, 142, 247, 0.3)', borderRadius: '8px', color: 'var(--accent)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' }} title="Edit Record">✏️</button><button onClick={() => toggleStatus(fee)} style={{ padding: '8px 16px', background: fee.status === 'Paid' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)', border: fee.status === 'Paid' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: fee.status === 'Paid' ? 'var(--red)' : 'var(--green)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap' }}>{fee.status === 'Paid' ? '↺ Mark Pending' : '✓ Mark Paid'}</button><button onClick={() => handleDeleteFee(fee._id)} style={{ padding: '8px 14px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: 'var(--red)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' }} title="Delete record">🗑️</button></div></td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ADD FEE MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto', width: '440px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px' }}>💳 {editingFee ? 'Edit' : 'Add'} Fee — {selectedStudent?.name}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            {feeError && <div className="error-msg">⚠ {feeError}</div>}
            <form onSubmit={handleAddFee}>
              
              <div style={{ marginBottom: '20px', padding: '20px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--accent)', marginBottom: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '4px solid var(--accent)', marginLeft: '-20px', paddingLeft: '16px' }}>
                  <span style={{ fontSize: '16px' }}>💳</span> Fee Information
                </h3>
              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Fee Type *</label>
                  <select 
                      value={form.type} 
                      onChange={e => setForm({...form, type:e.target.value})}
                    style={fieldStyle}
                  >
                    {['Tuition','Exam','Transport','Library','Other'].map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Amount (₹) *</label>
                  <input
                    type="number" min="1" required
                    value={form.amount}
                    onChange={e => setForm({...form, amount:e.target.value})}
                    placeholder="e.g. 500"
                    style={fieldStyle}
                  />
                </div>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Payment Method</label>
                <select 
                  value={form.paymentMethod} 
                  onChange={e => setForm({...form, paymentMethod:e.target.value})}
                  style={fieldStyle}
                >
                  <option value="Cash">💵 Cash</option>
                  <option value="Online">💳 Online / UPI</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                  <option value="Cheque">📜 Cheque</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Month *</label>
                  <select
                    value={form.month}
                    onChange={e => setForm({...form, month:e.target.value})}
                    required
                    style={fieldStyle}
                  >
                    <option value="">Select Month</option>
                      {MONTHS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Status</label>
                  <select 
                    value={form.status} 
                    onChange={e => setForm({...form, status:e.target.value})}
                    style={fieldStyle}
                  >
                    <option value="Pending">Pending (Unpaid)</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Due Date *</label>
                  <input
                    type="date" required
                    value={form.dueDate}
                    onChange={e => setForm({...form, dueDate:e.target.value})}
                    style={fieldStyle}
                  />
                </div>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '6px' }}>Remarks</label>
                <textarea
                  rows={2} 
                  value={form.remarks}
                  onChange={e => setForm({...form, remarks:e.target.value})}
                  placeholder="Optional note..."
                  style={{...fieldStyle, resize: 'vertical'}}
                />
              </div>
              </div>

              <div style={{ 
                display: 'flex', gap: '10px', justifyContent: 'flex-end', 
                marginTop: '12px', paddingTop: '16px', borderTop: '1px solid var(--border)' 
              }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ padding: '10px 20px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '10px 32px', fontWeight: '600', boxShadow: '0 4px 12px rgba(79, 142, 247, 0.2)' }}>
                  {saving ? 'Saving...' : editingFee ? 'Update Record' : 'Confirm & Add Fee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ NEW: BULK GENERATE MODAL */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBulkModal(false)}>
          <div className="modal" style={{ width: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>⚡ Bulk Generate Fees</h2>
              <button className="modal-close" onClick={() => setShowBulkModal(false)}>×</button>
            </div>
            <form onSubmit={handleBulkGenerate} style={{ padding: '5px' }}>
              <div style={{ marginBottom: '20px', padding: '20px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent)', marginBottom: '15px', fontWeight: '800' }}>
                  Configuration
                </h3>
                <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Select Class</label>
                <select value={bulkForm.class} onChange={e => setBulkForm({...bulkForm, class: e.target.value})} style={fieldStyle}>
                  <option value="all">All Classes</option>
                  {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Month</label>
                  <select value={bulkForm.month} onChange={e => setBulkForm({...bulkForm, month: e.target.value})} required style={fieldStyle}>
                    <option value="">Select Month</option>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Amount (₹)</label>
                  <input type="number" value={bulkForm.amount} onChange={e => setBulkForm({...bulkForm, amount: e.target.value})} required style={fieldStyle} />
                </div>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Fee Type</label>
                <select value={bulkForm.type} onChange={e => setBulkForm({...bulkForm, type: e.target.value})} style={fieldStyle}>
                  <option value="Tuition">Tuition Fee</option>
                  <option value="Exam">Exam Fee</option>
                  <option value="Transport">Transport Fee</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Due Date</label>
                <input type="date" value={bulkForm.dueDate} onChange={e => setBulkForm({...bulkForm, dueDate: e.target.value})} required style={fieldStyle} />
              </div>
              </div>
              <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(79, 142, 247, 0.05)', borderRadius: '8px', fontSize: '11px', color: 'var(--muted)' }}>
                ℹ️ Yeh action un saare bacho ke liye "Pending" fee generate kar dega jinki is mahine ki fee pehle se add nahi hai.
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowBulkModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
                  {saving ? 'Generating...' : 'Start Generation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}