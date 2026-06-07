import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as loginAPI, getMe } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user');
      }
      setLoading(false);
    } else if (token) {
      getMe()
        .then(data => setUser(data))
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Online login (API call)
  const login = async (credentials) => {
    const data = await loginAPI(credentials);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  // Offline login (no API call)
  const loginOffline = (credentials) => {
    // ✅ Custom credentials
    const validUsername = 'Savita Bal Shiksha Niketan';
    const validPassword = '23wld!24';

    if (credentials.username === validUsername && credentials.password === validPassword) {
      const userData = { 
        id: 'admin', 
        name: 'Savita Bal Shiksha Niketan', 
        role: 'Admin',
        username: validUsername
      };
      localStorage.setItem('token', 'offline-token-123');
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return { token: 'offline-token-123', user: userData };
    }
    throw new Error('Invalid username or password');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, loginOffline, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);