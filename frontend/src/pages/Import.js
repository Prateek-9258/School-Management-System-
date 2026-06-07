import React, { useState, useRef } from 'react';
import axios from 'axios';
import './import.css';

const ImportStudents = ({ onImportSuccess }) => {
  const [file,    setFile]    = useState(null);
  const [msg,     setMsg]     = useState('');
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState([]);
  const fileInputRef = useRef(null);  // input reset ke liye

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMsg('');
    setColumns([]);
  };

  const handleImport = async () => {
    if (!file) return setMsg('Pehle file select karo');

    setLoading(true);
    setMsg('');
    setColumns([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const res = await axios.post('/api/import/students', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });

      setMsg(res.data.message);

      if (res.data.skipped?.length > 0) {
        console.warn('Skipped rows:', res.data.skipped);
      }

      // File input reset karo import ke baad
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (onImportSuccess) onImportSuccess();

    } catch (err) {
      const errData = err.response?.data;
      setMsg('❌ ' + (errData?.message || err.message));
      if (errData?.columnsFound) setColumns(errData.columnsFound);

      // Error par bhi file reset karo
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="import-container">
      <div className="import-controls">
        <input
          ref={fileInputRef}
          type="file"
          className="import-input"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
        />
        <button className="import-btn" onClick={handleImport} disabled={loading || !file}>
          {loading ? 'Importing...' : '📥 Import'}
        </button>
      </div>

      {msg && (
        <p className={`import-msg ${msg.includes('❌') ? 'error' : 'success'}`}>
          {msg}
        </p>
      )}

      {columns.length > 0 && (
        <div style={{
          marginTop: '8px', padding: '10px 14px',
          background: 'rgba(239,68,68,0.08)', borderRadius: '8px',
          border: '1px solid rgba(239,68,68,0.2)', fontSize: '12px'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--red)' }}>
            Aapki Excel mein yeh columns mile:
          </div>
          <div style={{ color: 'var(--text)', fontFamily: 'monospace' }}>
            {columns.join(', ')}
          </div>
          <div style={{ marginTop: '6px', color: 'var(--muted)' }}>
            ⚠️ Excel mein <strong>Name</strong> aur <strong>Class</strong> column hona zaroori hai.
          </div>
        </div>
      )}

      <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--muted)', lineHeight: '1.6' }}>
        📋 Excel format: <strong>Name</strong>, <strong>Class</strong>, Roll Number, PEN No, Section, Gender, Parent Name, Contact
      </div>
    </div>
  );
};

export default ImportStudents;
