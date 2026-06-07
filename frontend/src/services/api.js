// API BASE URL - Proxy use karo
// ✅ Change this to use environment variable or your Render URL
// const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5005/api';
const API_BASE_URL = 'https://school-management-system-dszc.onrender.com/api';
const BACKEND_URL = API_BASE_URL;

// Helper function with error handling
const apiCall = async (endpoint, options = {}) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || `Invalid Credentials (Error: ${response.status})`);
    }
    return response.json();
  } catch (err) {
    if (err.message === 'Failed to fetch') {
      throw new Error('Backend not running. Start: cd backend && npm run dev');
    }
    throw err;
  }
};

// ============== AUTH ==============
export const login = (credentials) => apiCall('/auth/login', {
  method: 'POST', body: JSON.stringify(credentials)
});

export const getMe = () => apiCall('/auth/me');

// ============== STUDENTS ==============
export const getStudents = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiCall(`/students${query ? '?' + query : ''}`);
};

export const addStudent = (data) => apiCall('/students', { method: 'POST', body: JSON.stringify(data) });
export const updateStudent = (id, data) => apiCall(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteStudent = (id) => apiCall(`/students/${id}`, { method: 'DELETE' });
export const getStudentStats = () => apiCall('/students/stats');

// ============== ATTENDANCE ==============
export const getAttendanceByDate = (date, className) => {
  const query = new URLSearchParams({ date, ...(className && { class: className }) }).toString();
  return apiCall(`/attendance${query ? '?' + query : ''}`);
};

export const markBulkAttendance = (data) => apiCall('/attendance/bulk', { method: 'POST', body: JSON.stringify(data) });
export const getTodayStats = () => apiCall('/attendance/today-stats');

// ============== FEES ==============
export const getStudentFees = (studentId) => apiCall(`/fees/student/${studentId}`);
export const getFeeStats = () => apiCall('/fees/stats');
export const getPendingFees = () => apiCall('/fees/pending');
export const addFee = (data) => apiCall('/fees', { method: 'POST', body: JSON.stringify(data) });
export const generateBulkFees = (data) => apiCall('/fees/bulk-generate', { method: 'POST', body: JSON.stringify(data) });
export const updateFee = (id, data) => apiCall(`/fees/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteFee = (id) => apiCall(`/fees/${id}`, { method: 'DELETE' });

// ============== NOTIFICATIONS ==============
export const getNotifications = (userId) => apiCall(`/notifications/${userId}`);
export const getUnreadCount = (userId) => apiCall(`/notifications/${userId}/unread-count`);
export const markAsRead = (id) => apiCall(`/notifications/${id}/read`, { method: 'PUT' });
export const markAllAsRead = (userId) => apiCall(`/notifications/${userId}/read-all`, { method: 'PUT' });
export const deleteNotification = (id) => apiCall(`/notifications/${id}`, { method: 'DELETE' });

// ============== ANNOUNCEMENTS ==============
export const getAnnouncements = () => apiCall('/announcements');
export const createAnnouncement = (data) => apiCall('/announcements', { method: 'POST', body: JSON.stringify(data) });
export const updateAnnouncement = (id, data) => apiCall(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAnnouncement = (id) => apiCall(`/announcements/${id}`, { method: 'DELETE' });

// ============== EXPORT PDF ==============
export const exportStudentsPDF = (classFilter) => {
  window.open(`${BACKEND_URL}/export/students?classFilter=${classFilter || ''}`, '_blank');
};
export const exportAttendancePDF = (month, year, className) => {
  window.open(`${BACKEND_URL}/export/attendance?month=${month}&year=${year}&className=${className}`, '_blank');
};
export const exportFeesPDF = (studentId) => {
  window.open(`${BACKEND_URL}/export/fees/${studentId}`, '_blank');
};
export const exportPendingFeesPDF = () => {
  window.open(`${BACKEND_URL}/export/fees/pending-report`, '_blank');
};

const api = {
  login, getMe, getStudents, addStudent, updateStudent, deleteStudent, getStudentStats,
  getAttendanceByDate, markBulkAttendance, getTodayStats,
  getStudentFees, getFeeStats, getPendingFees, addFee, updateFee, deleteFee,
  getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  exportStudentsPDF, exportAttendancePDF, exportFeesPDF, exportPendingFeesPDF
};

export default api;