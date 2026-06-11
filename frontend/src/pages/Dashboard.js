import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getStudentStats, getTodayStats, getFeeStats, getPendingFees, updateFee, exportPendingFeesPDF, getStudents, getAttendanceByDate } from '../services/api';
import { exportStudentsPDF } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    feesCollected: 0,
    feesPending: 0,
    byClass: [] // ✅ Real chart data state
  });
  const [pendingFees, setPendingFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  const [studentDetail, setStudentDetail] = useState(null);
  const [myTodayStatus, setMyTodayStatus] = useState('Not Marked');

  useEffect(() => {
    loadDashboardData();

    // Close notification dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadDashboardData = async () => {
    const isStudent = user?.role?.toLowerCase() === 'student' || user?.role?.toLowerCase() === 'parent';

    try {
      setLoading(true);

      // ✅ Parallel Fetching: Sabhi calls ek sath start hongi
      const fetchPromises = [
        getStudentStats(),
        getTodayStats(),
        getFeeStats(),
        getPendingFees()
      ];

      // Agar student hai toh uski profile bhi parallel mein fetch karo
      if (isStudent) {
        fetchPromises.push(getStudents({ search: user?.mobile || user?.username }));
      }

      const results = await Promise.allSettled(fetchPromises);

      // Result Extraction
      const studentStats = results[0].status === 'fulfilled' ? (results[0].value?.data || results[0].value) : { total: 0, byClass: [] };
      const todayStats = results[1].status === 'fulfilled' ? results[1].value : { present: 0 };
      const feeStats = results[2].status === 'fulfilled' ? results[2].value : { collected: 0, pending: 0 };
      
      const pendingRes = results[3].status === 'fulfilled' ? results[3].value : [];
      const rawPending = Array.isArray(pendingRes) ? pendingRes : (pendingRes?.data || pendingRes?.fees || []);
      
      let pending = (user?.role?.toLowerCase() === 'student' || user?.role?.toLowerCase() === 'parent')
        ? rawPending.filter(f => f.studentId?.contact === user?.mobile)
        : rawPending;

      // Process Student Specific Data (Attendance)
      if (isStudent && results[4]?.status === 'fulfilled') {
        const stuRes = results[4].value;
        const list = stuRes?.data?.data || stuRes?.data || stuRes || [];
        const me = list.find(s => s.contact === user.mobile);
        if (me) {
          setStudentDetail(me);
          const todayStr = new Date().toISOString().split('T')[0];
          const attRes = await getAttendanceByDate(todayStr, me.class);
          const attList = attRes?.data || attRes || [];
          const myAtt = attList.find(a => (a.studentId?._id || a.studentId) === me._id);
          setMyTodayStatus(myAtt ? (myAtt.status === 'P' ? 'Present' : (myAtt.status === 'A' ? 'Absent' : 'Leave')) : 'Not Marked');
        }
      }

      // ✅ NEW: Fetch Student Academic Info & Personal Attendance

      // ✅ Super-Robust Data Extraction
      let extractedByClass = [];
      if (studentStats) {
        if (Array.isArray(studentStats.byClass)) extractedByClass = studentStats.byClass;
        else if (Array.isArray(studentStats.data)) extractedByClass = studentStats.data;
        else if (Array.isArray(studentStats)) extractedByClass = studentStats;
        // Agar data object format mein ho { "Class 1": 10 }
        else if (typeof studentStats === 'object' && !studentStats.total) {
          extractedByClass = Object.entries(studentStats).map(([key, val]) => ({ _id: key, count: val }));
        }
      }

      // ✅ Fix: Reducer check for all possible count keys
      const extractedTotal = 
        studentStats?.total || 
        studentStats?.count || 
        (Array.isArray(studentStats) ? studentStats.length : 0) || 
        extractedByClass.reduce((acc, curr) => acc + Number(curr.count || curr.total || curr.students || 0), 0);

      setStats({
        totalStudents: extractedTotal,
        presentToday: todayStats?.present || 0,
        feesCollected: feeStats?.collected || 0,
        feesPending: feeStats?.pending || 0,
        byClass: Array.isArray(extractedByClass) ? extractedByClass : []
      });

      setPendingFees(Array.isArray(pending) ? pending : []);

    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isStudent = user?.role?.toLowerCase() === 'student' || user?.role?.toLowerCase() === 'parent';

  const safePendingFees = Array.isArray(pendingFees) ? pendingFees : [];
  const displayFees = safePendingFees.slice(0, 5);

  // ✅ NEW: Show chart according to Classes (1-8) instead of just existing student data
  const SCHOOL_CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const rawByClass = stats.byClass || [];
  
  const classData = SCHOOL_CLASSES.map(cls => {
    // Find data for this specific class in the stats
    const found = rawByClass.find(c => String(c._id || c.class) === cls);
    return {
      name: `Class ${cls}`,
      count: found ? Number(found.count || 0) : 0
    };
  });

  const rawMax = Math.max(...classData.map(c => c.count || 0), 1);
  const maxCount = rawMax > 0 ? rawMax * 1.2 : 10; // Ensure maxCount is never 0 to avoid division by zero

  return (
    /* WRAPPER DIV ADDED - Ensures full dark background */
    <div className="dashboard-wrapper relative">
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-50">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">
              Welcome Back, <span className="text-indigo-400">{user?.name || 'User'}</span>
            </h1>
            <p className="text-slate-400 mt-2 text-base md:text-lg">Savita Bal Shiksha Niketan — Overview for today.</p>
            {isStudent && studentDetail && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Class {studentDetail.class}-{studentDetail.section} | Roll No: {studentDetail.rollNumber}</span>
              </div>
            )}
          </div>
        <div className="flex items-center gap-3 flex-wrap justify-start lg:justify-end mt-2 lg:mt-0">
          {/* Notification Bell Integrated into Header Actions */}
          <div className="relative" ref={notificationRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="notification-btn group" 
              title="Notifications"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {pendingFees.length > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900 group-hover:animate-ping shadow-lg"></span>
              )}
            </button>

            {showNotifications && (
              <div className="notification-dropdown absolute right-0 mt-3 w-72 md:w-80 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
                  <h4 className="text-white font-bold text-xs uppercase tracking-tight">Alerts</h4>
                  <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-black">
                    {pendingFees.length}
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar bg-slate-800/95">
                  {pendingFees.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 italic text-sm">No notifications</div>
                  ) : (
                    pendingFees.slice(0, 5).map((fee, i) => (
                      <div key={i} className="notification-item hover:bg-slate-700/30">
                        <p className="text-[13px] text-white font-bold">{fee?.studentId?.name || 'Student'}: ₹{fee.amount}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{fee.type} — {fee.month || 'Current Month'}</p>
                      </div>
                    ))
                  )}
                </div>
                <Link to="/fees" onClick={() => setShowNotifications(false)} className="flex items-center justify-center py-4 px-4 text-center text-[10px] font-black text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/5 transition-all border-t border-slate-700/50 bg-slate-800/50 uppercase tracking-[0.2em]">
                  <span>View All Records</span>
                  <span className="ml-2 text-xs">➜</span>
                </Link>
              </div>
            )}
          </div>

          {isAdmin && (
            <>
          <button 
            onClick={() => exportStudentsPDF('')}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30 active:scale-95 group whitespace-nowrap"
            style={{ padding: '10px 20px', fontSize: '13px', minHeight: '44px', border: 'none', cursor: 'pointer' }}
          >
            <svg className="w-5 h-5 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
            <span>Students PDF</span>
          </button>
          <button 
            onClick={() => exportPendingFeesPDF()}
            className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-500/30 active:scale-95 group whitespace-nowrap"
            style={{ padding: '10px 20px', fontSize: '13px', minHeight: '44px', border: 'none', cursor: 'pointer' }}
          >
            <svg className="w-5 h-5 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span>Pending Fees</span>
          </button>
            </>
          )}
        </div>
        </div>

        {/* Stats Cards */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-6 mb-8`}>
          {(() => {
            const studentTotalDue = pendingFees.reduce((acc, curr) => acc + (curr.amount || 0), 0);
            const totalPotential = stats.feesCollected + stats.feesPending;
            const collectionRate = totalPotential > 0 ? Math.round((stats.feesCollected / totalPotential) * 100) : 0;
            
            const items = isStudent ? [
              { 
                label: 'Attendance Status', 
                value: myTodayStatus, 
                icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
                theme: { text: myTodayStatus === 'Present' ? 'text-green-400' : 'text-amber-400', bg: 'bg-indigo-500/10', border: 'hover:border-indigo-500/50', glow: 'group-hover:bg-indigo-500/20', dot: 'bg-indigo-400' }
              },
              { 
                label: 'Total Due Fees', 
                value: `₹${studentTotalDue.toLocaleString()}`, 
                icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', 
                theme: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'hover:border-rose-500/50', glow: 'group-hover:bg-rose-500/20', dot: 'bg-rose-400' }
              }
            ] : [
            {  
              label: 'Total Students', 
              value: stats.totalStudents, 
              icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
              theme: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'hover:border-indigo-500/50', glow: 'group-hover:bg-indigo-500/20', dot: 'bg-indigo-400' }
            },
            { 
              label: 'Present Today', 
              value: stats.presentToday, 
              icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', 
              theme: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'hover:border-green-500/50', glow: 'group-hover:bg-green-500/20', dot: 'bg-green-400' }
            },
            { 
              label: 'Fees Collected', 
              value: `₹${stats.feesCollected.toLocaleString()}`, 
              icon: 'M9 8h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', 
              theme: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'hover:border-emerald-500/50', glow: 'group-hover:bg-emerald-500/20', dot: 'bg-emerald-400' }
            },
            { 
              label: 'Fees Pending', 
              value: `₹${stats.feesPending.toLocaleString()}`, 
              icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', 
              theme: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'hover:border-rose-500/50', glow: 'group-hover:bg-rose-500/20', dot: 'bg-rose-400' }
            }
          ];

          // Filter items based on role
          const visibleItems = (isAdmin || isStudent) ? items : items.slice(0, 2);

          return visibleItems.map((item, idx) => (
            <div key={idx} className={`relative overflow-hidden bg-slate-800/40 border border-slate-700/50 ${item.theme.border} transition-all duration-300 rounded-2xl p-6 group`}>
              <div className={`absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 ${item.theme.bg} rounded-full blur-2xl ${item.theme.glow} transition-colors`} />
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">{item.label}</p>
                  <p className={`text-4xl font-black ${item.theme.text} mt-2`}>{item.value}</p>
                </div>
                <div className={`w-14 h-14 ${item.theme.bg} rounded-2xl ${item.theme.text} flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                </div>
              </div>
              {item.label === 'Fees Collected' && (
                <div className="mt-3 w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-1000" 
                    style={{ width: `${collectionRate}%` }}
                  />
                </div>
              )}
              <div className="mt-4 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${item.theme.dot} ${item.label.includes('Collected') ? '' : 'animate-pulse'}`} />
                <p className="text-slate-500 text-xs font-medium">
                  {item.label === 'Fees Collected' ? `${collectionRate}% of total dues` : 'Updated just now'}
                </p>
              </div>
            </div>
          ));
          })()}
          {/* Note: Logic above wrapped in IIFE for stats calculation */}
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-800/20 border border-slate-700/30 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Quick Management</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Attendance', path: '/attendance', icon: '📋', color: 'bg-blue-500' },
              { label: 'Fees History', path: '/fees', icon: '💰', color: 'bg-emerald-500', hide: !isAdmin && user?.role?.toLowerCase() !== 'student' && user?.role?.toLowerCase() !== 'parent' },
              { label: 'Students List', path: '/students', icon: '👤', color: 'bg-indigo-500' },
              { label: 'Broadcast', path: '/announcements', icon: '📢', color: 'bg-amber-500' }
            ].filter(a => !a.hide).map((act, i) => (
              <Link 
                key={i} 
                to={act.path}
                className="flex flex-col md:flex-row items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl transition-all hover:-translate-y-1 group text-center md:text-left"
              >
                <span className={`w-14 h-14 shrink-0 ${act.color} rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-black/20 group-hover:scale-110 transition-transform`}>
                  {act.icon}
                </span>
                <span className="text-white font-semibold text-sm md:text-base">{act.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Charts & Pending Fees */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-white">Students Strength</h3>
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-xs rounded-full border border-indigo-500/20 font-bold">BY CLASS</span>
            </div>
          <div className="bar-chart">
              {classData.map((cls, idx) => (
              <div key={cls.name} className="bar-item group">
                <div className="bar-wrapper">
                  <div className="bar-tooltip z-20">
                      {cls.count} Students
                    </div>
                    <div 
                    className="bar"
                      style={{ 
                        height: `${Math.max((cls.count / maxCount) * 100, 2)}%`, // At least 2% height for visibility
                        animationDelay: `${idx * 0.1}s` // Staggered animation delay
                      }}
                    ></div>
                  </div>
                <span className="bar-label">{cls.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-white">Recent Pending Dues</h3>
              <Link to="/fees" className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-xs rounded-lg border border-indigo-500/20 font-bold transition-all">
                <span>View All</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            <div className="space-y-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
              {displayFees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 italic">
                  <span className="text-4xl mb-2">🎉</span>
                  <p>All fees are settled!</p>
                </div>
              ) : (
                displayFees.map((fee) => (
                  <div key={fee?._id || Math.random()} className="fee-item group">
                    <div className="flex items-center gap-4">
                      <div className="fee-icon shrink-0">
                        ₹
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm md:text-base truncate max-w-[140px] sm:max-w-none">{fee?.studentId?.name || 'Student Name'}</p>
                        <p className="text-indigo-400 text-[11px] font-bold tracking-wide uppercase">{fee?.type || 'Fee'} — {fee?.month}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-3">
                        <p className="text-rose-400 font-black text-lg">₹{fee?.amount || 0}</p>
                        {!isStudent && (
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if(!window.confirm('Mark this fee as Paid?')) return;
                            try {
                              await updateFee(fee._id, { status: 'Paid', paidDate: new Date() });
                              loadDashboardData(); // Data refresh taaki stats update ho jayein
                            } catch (e) { alert('Update failed'); }
                          }}
                          className="px-4 py-2 bg-green-600/10 hover:bg-green-600 text-green-400 hover:text-white text-[12px] font-black rounded-lg border border-green-500/30 transition-all cursor-pointer uppercase tracking-wider"
                        >
                          ✓ PAID
                        </button>
                        )}
                      </div>
                      {/* ✅ Fallback in Recent Pending Dues section */}
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest opacity-60">
                        Due: {(fee?.dueDate || fee?.date) ? new Date(fee.dueDate || fee.date).toLocaleDateString() : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;