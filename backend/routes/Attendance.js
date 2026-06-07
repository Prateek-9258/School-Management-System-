const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');

// Get attendance by date and class
router.get('/', async (req, res) => {
  try {
    const { date, class: className } = req.query;
    
    const query = {};
    if (date) {
      // Regex ka use karke month (YYYY-MM) ya specific date (YYYY-MM-DD) dono support honge
      query.date = { $regex: `^${date}` };
    }
    if (className && className !== 'undefined' && className !== 'all') {
      query.class = className;
    }
    
    console.log('Attendance query:', query);
    
    const attendance = await Attendance.find(query).lean(); // Remove populate for faster fetching
    
    res.json({ success: true, data: attendance });
  } catch (err) {
    console.error('Attendance GET error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get today stats
router.get('/today-stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = await Promise.all([
      Attendance.countDocuments({ date: today, status: 'P' }),
      Attendance.countDocuments({ date: today, status: 'A' }),
      Attendance.countDocuments({ date: today, status: 'L' }),
      Attendance.countDocuments({ date: today })
    ]);
    
    res.json({ 
      success: true,
      present: stats[0],
      absent: stats[1],
      leave: stats[2],
      total: stats[3]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark bulk attendance
router.post('/bulk', async (req, res) => {
  try {
    const { records } = req.body;
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'records array required' 
      });
    }
    
    // Validate each record
    for (const record of records) {
      if (!record.studentId || !record.date || !record.class) {
        return res.status(400).json({
          success: false,
          error: 'Each record needs studentId, date, class'
        });
      }
    }
    
    // ✅ FIXED: Use bulkWrite with Upsert logic
    // Isse purana data automatically update ho jayega aur duplicate error nahi aayega
    const operations = records.map(rec => ({
      updateOne: {
        filter: { 
          studentId: new mongoose.Types.ObjectId(rec.studentId), 
          date: rec.date 
        },
        update: { $set: rec },
        upsert: true
      }
    }));

    const result = await Attendance.bulkWrite(operations);
    
    res.json({ 
      success: true,
      message: 'Attendance saved', 
      count: (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0)
    });
  } catch (err) {
    console.error('Bulk attendance error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

module.exports = router;