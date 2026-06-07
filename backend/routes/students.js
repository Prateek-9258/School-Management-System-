const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Get all students
router.get('/', async (req, res) => {
  try {
    const { class: classFilter, search } = req.query;
    let query = {};

    if (typeof classFilter === 'string' && classFilter !== 'all') {
      const parts = classFilter.split('-');
      query.class = parts[0];
    
      if (parts.length > 1 && parts[1]) {
        query.section = parts[1];
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { penNo: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Student.countDocuments(query);
    const students = await Student.find(query).sort({ class: 1, rollNumber: 1 });
    
    // Class-wise counts calculate karein
    const classCounts = await Student.aggregate([
      { $match: query }, // Apply the same filter as for students
      { $group: { _id: '$class', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const formattedClassCounts = classCounts.reduce((acc, item) => { acc[item._id] = item.count; return acc; }, {});

    // Frontend ki jarurat ke hisab se structure bhejein
    res.json({
      success: true,
      data: students,
      total: total,
      count: students.length,
      classCounts: formattedClassCounts
    });

  } catch (err) {
    console.error('❌ Students GET Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get student stats
router.get('/stats', async (req, res) => {
  try {
    const total = await Student.countDocuments();
    const active = await Student.countDocuments({ status: 'Active' });
    const byClass = await Student.aggregate([
      { $group: { _id: '$class', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ total, active, byClass });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add student
router.post('/', async (req, res) => {
  try {
    // ✅ Mobile number ko clean karke save karein
    const studentData = { ...req.body };
    if (studentData.contact) {
      studentData.contact = String(studentData.contact).replace(/\D/g, '');
    }
    const student = new Student(studentData);
    await student.save();

    // ✅ Automatically create login account if mobile exists
    if (student.contact) {
      const cleanMobile = String(student.contact).replace(/\D/g, '');
      if (cleanMobile.length >= 10) {
        const hashedPassword = await bcrypt.hash(cleanMobile, 10);
        await User.findOneAndUpdate(
          { username: cleanMobile },
          { 
            $set: { 
              name: student.name,
              email: `${cleanMobile}@student.com`,
              password: hashedPassword,
              role: 'student',
              mobile: cleanMobile
            } 
          },
          { upsert: true }
        );
      }
    }

    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update student
router.put('/:id', async (req, res) => {
  try {
    // ✅ Mobile number ko clean karke update karein
    const updateData = { ...req.body };
    if (updateData.contact) {
      updateData.contact = String(updateData.contact).replace(/\D/g, '');
    }

    const student = await Student.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    // ✅ Automatically update or create login account when student is updated
    if (student && student.contact) {
      const cleanMobile = String(student.contact).replace(/\D/g, '');
      if (cleanMobile.length >= 10) {
        const hashedPassword = await bcrypt.hash(cleanMobile, 10);
        await User.findOneAndUpdate(
          { username: cleanMobile },
          { 
            $set: { 
              name: student.name,
              email: `${cleanMobile}@student.com`,
              password: hashedPassword,
              role: 'student',
              mobile: cleanMobile
            } 
          },
          { upsert: true }
        );
      }
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all students
router.delete('/all', async (req, res) => {
  try {
    await Student.deleteMany({});
    res.json({ message: 'All students deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete student
router.delete('/:id', async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ OPTION 1: Sync All Students to User Accounts (UI Button Logic)
router.post('/sync-all-logins', async (req, res) => {
  try {
    const students = await Student.find({ contact: { $exists: true, $ne: '' } });
    let created = 0;
    let updated = 0;

    for (const s of students) {
      const cleanMobile = String(s.contact).replace(/\D/g, '');
      if (cleanMobile.length >= 10) {
        const hashedPassword = await bcrypt.hash(cleanMobile, 10);
        const result = await User.findOneAndUpdate(
          { username: cleanMobile },
          { 
            $set: { 
              name: s.name,
              email: `${cleanMobile}@student.com`,
              password: hashedPassword,
              role: 'student',
              mobile: cleanMobile
            } 
          },
          { upsert: true, new: true, rawResult: true }
        );
        if (result.lastErrorObject.updatedExisting) updated++;
        else created++;
      }
    }

    res.json({ 
      message: `✅ Sync Complete! ${created} naye accounts bane aur ${updated} update hue.`,
      total: created + updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;