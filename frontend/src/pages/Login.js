import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth(); // loginOffline ki jagah login use karein
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ 
    username: '', 
    password: '' 
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password States
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Number, 2: OTP, 3: New Password
  const [mobile, setMobile] = useState(localStorage.getItem('last_forgot_mobile') || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSendOTP = async () => {
    if (mobile.length < 10) return alert('Please enter a valid 10-digit number');
    localStorage.setItem('last_forgot_mobile', mobile); // Number ko save kiya
    setLoading(true);
    try { 
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:10000'}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile })
      });
      if (res.ok) {
        setForgotStep(2);
        alert('OTP has been sent to your mobile (Simulated: 123456)');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send OTP');
      }
    } catch (e) {
      alert('Failed to send SMS. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = () => {
    if (otp === '123456') { // Simulated verification
      setForgotStep(3);
    } else {
      alert('Invalid OTP. Please enter 123456 for testing.');
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:10000'}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, newPassword })
      });
      if (res.ok) {
        alert('Success! Your password has been changed.');
        setShowForgot(false);
        setForgotStep(1);
      } else {
        const data = await res.json();
        alert(data.error || 'Reset failed');
      }
    } catch (e) { alert('Error resetting password'); }
    finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // ✅ Calling the real login that hits the backend
      await login(credentials); 
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--background)',
      padding: '20px'
    }}>
      <div className="login-card" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        background: 'var(--surface)',
        borderRadius: '24px',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        textAlign: 'center'
      }}>
        <div className="login-header" style={{ marginBottom: '32px' }}>
          <div className="logo" style={{ fontSize: '48px', marginBottom: '16px' }}>🎓</div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text)', marginBottom: '8px' }}>School Management</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Savita Bal Shiksha Niketan</p>
        </div>
        
        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
          {error && <div className="error-msg">{error}</div>}
          
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--muted)', marginBottom: '8px' }}>Username / School Name</label>
            <input
              type="text"
              placeholder="e.g. teacher or school name"
              value={credentials.username}
              onChange={e => setCredentials({...credentials, username: e.target.value})}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                outline: 'none',
                fontSize: '14px',
                transition: 'border-color 0.2s'
              }}
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--muted)', marginBottom: '8px' }}>Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={credentials.password}
              onChange={e => setCredentials({...credentials, password: e.target.value})}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                outline: 'none',
                fontSize: '14px',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          <div style={{ textAlign: 'right', marginBottom: '24px' }}>
            <button 
              type="button"
              onClick={() => { setShowForgot(true); setForgotStep(1); }}
              style={{ 
                background: 'none', border: 'none', padding: 0,
                fontSize: '12px', color: 'var(--accent)', 
                fontWeight: '600', cursor: 'pointer' 
              }}
            >
              Forgot Password?
            </button>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '16px',
              background: 'var(--accent)',
              boxShadow: '0 8px 20px rgba(79, 142, 247, 0.25)',
              cursor: 'pointer',
              border: 'none'
            }}
          >
            {loading ? 'Loading...' : 'Login'}
          </button>
        </form>
      </div>

      {/* Forgot Password SMS Modal */}
      {showForgot && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '20px', backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'var(--surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '380px',
            border: '1px solid var(--border)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>💬</div>
            <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '20px', fontWeight: '800' }}>Forgot Password</h3>
            
            {forgotStep === 1 && (
              <>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>Enter Registered Mobile Number</p>
                <input 
                  type="text" placeholder="Mobile Number" value={mobile} 
                  onChange={e => {
                    setMobile(e.target.value);
                    localStorage.setItem('last_forgot_mobile', e.target.value); // Type karte hi save hoga
                  }} 
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', marginBottom: '20px', outline: 'none' }}
                />
                <button onClick={handleSendOTP} disabled={loading} style={{ width: '100%', padding: '14px', background: 'var(--accent)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
                  {loading ? 'Sending...' : 'Send SMS OTP'}
                </button>
              </>
            )}
            {forgotStep === 2 && (
              <>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>Enter the 6-digit OTP sent to {mobile}.</p>
                <input 
                  type="text" placeholder="Enter 6-digit OTP" value={otp} 
                  onChange={e => setOtp(e.target.value)} 
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', marginBottom: '20px', outline: 'none', textAlign: 'center', letterSpacing: '4px', fontWeight: '800' }}
                />
                <button onClick={handleVerifyOTP} style={{ width: '100%', padding: '14px', background: 'var(--green)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
                  Verify & Reset
                </button>
              </>
            )}
            {forgotStep === 3 && (
              <>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>Enter your new strong password.</p>
                <input 
                  type="password" placeholder="New Password" value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', marginBottom: '20px', outline: 'none' }}
                />
                <button onClick={handleResetPassword} disabled={loading} style={{ width: '100%', padding: '14px', background: 'var(--accent)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
                  {loading ? 'Updating...' : 'Change Password'}
                </button>
              </>
            )}
            
            <button onClick={() => setShowForgot(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', width: '100%', marginTop: '20px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
              Cancel / Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}