const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

// Login
router.post('/login', async (req, res) => {
  const { username: inputUser, password } = req.body;
  
  if (!inputUser || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  let usernameInput = inputUser.trim();

  // ✅ Student Login Fix: Agar input sirf numbers aur common symbols hai, toh ise clean karo
  if (/^[0-9\s-+()]+$/.test(usernameInput)) {
    usernameInput = usernameInput.replace(/\D/g, ''); // Sirf digits rakho
  }

  try {
    console.log(`\n============== LOGIN ATTEMPT: ${inputUser} (Cleaned: ${usernameInput}) ==============`);

    // ✅ FIX: Case-insensitive search using Regex
    const user = await User.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${usernameInput.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') } },
        { email: { $regex: new RegExp(`^${usernameInput.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') } }
      ]
    });

    if (!user) {
      console.log(`❌ LOGIN FAIL: User "${usernameInput}" not found in database`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    console.log(`🔍 USER FOUND: ${user.username} (Role: ${user.role}). Checking password...`);
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      console.log(`❌ LOGIN FAIL: Password did not match for ${user.username}`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // ✅ Role check handles student specific tokens
    const role = user.role?.toLowerCase();
    const token = role === 'admin' ? 'demo-token-123' : 
                  role === 'teacher' ? 'demo-token-teacher-456' : 
                  `demo-token-student-${user._id}`;

    console.log(`✅ ${role} logged in: ${user.username}`);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        username: user.username,
        mobile: user.mobile // Frontend use this to fetch academic details
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token === 'demo-token-123') {
    res.json({
      id: 'admin',
      name: 'Savita Bal Shiksha Niketan',
      role: 'admin'
    });
  } else if (token === 'demo-token-teacher-456') {
    res.json({
      id: 'teacher1',
      name: 'Prerna Saini',
      role: 'teacher'
    });
  } else if (token && token.startsWith('demo-token-student-')) {
    try {
      const userId = token.replace('demo-token-student-', '');
      const user = await User.findById(userId);
      if (!user) return res.status(401).json({ error: 'Student not found' });
      
      res.json({
        id: user._id,
        name: user.name,
        role: 'student',
        mobile: user.mobile
      });
    } catch (err) {
      res.status(401).json({ error: 'Invalid student session' });
    }
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// ✅ Forgot Password: Check if user exists
router.post('/forgot-password', async (req, res) => {
  const { mobile } = req.body;
  try {
    const user = await User.findOne({ mobile: mobile.trim() });
    if (!user) {
      return res.status(404).json({ error: 'User with this mobile number not found' });
    }
    // Note: Real SMS logic here using Twilio/Fast2SMS. 
    // For now, we simulate sending success.
    console.log(`📩 OTP Request for: ${mobile}. Simulated OTP: 123456`);
    res.json({ message: 'OTP sent successfully (Simulated)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Reset Password: Update new password in DB
router.post('/reset-password', async (req, res) => {
  const { mobile, newPassword } = req.body;
  try {
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ mobile: mobile.trim() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Password hash karke update karein
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    console.log(`🔑 Password reset successful for: ${mobile}`);
    res.json({ message: 'Password changed successfully! You can now login.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;