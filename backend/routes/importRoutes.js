const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Student = require('../models/Student');
const User = require('../models/User');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/students', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0)
      return res.status(400).json({ message: 'Excel file empty hai' });

    console.log('Excel columns found:', Object.keys(rows[0]));

    const students = [];
    const skipped  = [];

    rows.forEach((row, i) => {
      const get = (keys) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== '') return row[k];
          const found = Object.keys(row).find(
            rk => rk.trim().toLowerCase() === k.toLowerCase()
          );
          if (found && row[found] !== undefined && row[found] !== '')
            return row[found];
        }
        return undefined;
      };

      const name = get(['Name', 'name', 'Student Name', 'StudentName', 'NAME', 'Full Name', 'fullName']);
      const cls  = get(['Class', 'class', 'CLASS', 'Grade', 'grade']);
      const roll = get(['Roll Number', 'Roll No', 'RollNumber', 'rollNumber', 'roll', 'Roll', 'ROLL']);

      if (!name) { skipped.push(`Row ${i + 2}: Name missing`); return; }
      if (!cls)  { skipped.push(`Row ${i + 2}: Class missing (Name: ${name})`); return; }

      // Contact number se spaces aur dashes hatao taaki login clean ho
      const rawContact = get(['Contact', 'contact', 'Phone', 'phone', 'Mobile', 'mobile', 'CONTACT']) || '';
      const cleanContact = String(rawContact).replace(/\D/g, ''); // ✅ Sab kuch hatao digits ke alawa

      students.push({
        name:       String(name).trim(),
        rollNumber: roll ? String(roll).trim() : `IMP${Date.now()}${i}`,
        class:      String(cls).replace(/Class|class|Grade|grade/i, '').trim(),
        section:    get(['Section', 'section', 'SECTION']) || 'A',
        gender:     get(['Gender', 'gender', 'GENDER', 'Sex', 'sex']) || 'Male',
        parentName: get(['Parent Name', 'parentName', 'Parent', 'Father Name', 'FatherName', 'father']) || '',
        contact:    cleanContact,
        penNo:      String(get(['PEN No', 'PEN NO', 'Pen No', 'pen no', 'penNo', 'PenNo', 'PEN', 'Pen Number', 'PEN Number']) || ''),
        status:     'Active',
        createdAt:  new Date(),
        updatedAt:  new Date()
      });
    });

    if (students.length === 0) {
      return res.status(400).json({
        message: `❌ Koi valid student nahi mila. Excel mein "Name" aur "Class" columns hone chahiye.`,
        skipped,
        columnsFound: Object.keys(rows[0])
      });
    }

    // ordered: false — agar ek duplicate ho toh baaki insert hote rahein
    const inserted = await Student.insertMany(students, { ordered: false });

    // ✅ 2nd Option: Sabhi imported students ke liye login check karein
    // Not just inserted, but any student processed in this request
    for (const sData of students) {
      if (sData.contact && sData.contact.length >= 10) {
        // Check if user already exists
        const existingUser = await User.findOne({ username: sData.contact });
        if (!existingUser) {
          await User.create({
            name: sData.name,
            username: sData.contact, // Mobile as Username
            password: sData.contact, // model handles hashing automatically
            email: `${sData.contact}@student.com`, 
            role: 'student',
            mobile: sData.contact // Links user account to student record
          });
          console.log(`👤 Created user account for: ${sData.name} (${sData.contact})`);
        }
      }
    }

    res.json({
      message: `✅ ${inserted.length} students imported successfully${skipped.length > 0 ? `, ${skipped.length} rows skip hue` : ''}`,
      count:   inserted.length,
      skipped
    });

  } catch (err) {
    console.error('Import error:', err);

    // Kuch insert hue, kuch duplicate the
    if (err.code === 11000 || err.name === 'BulkWriteError') {
      const inserted = err.result?.nInserted || 0;
      const writeErrors = err.writeErrors || [];
      const dupCount = writeErrors.length;

      return res.status(207).json({
        message: `✅ ${inserted} students import hue${dupCount > 0 ? `, ${dupCount} skip hue (same class mein same roll number already exist karta hai)` : ''}`,
        count: inserted,
        skipped: writeErrors.map(e => `Row: ${e.err?.op?.name} — duplicate roll number in same class`)
      });
    }

    res.status(500).json({ message: 'Import failed', error: err.message });
  }
});

module.exports = router;
