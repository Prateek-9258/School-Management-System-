const XLSX    = require('xlsx');
const Student = require('../models/Student');

const parseRow = (row, index) => {
  const rowNum = index + 2;
  const errors = [];

  const name       = (row['Name*']        || row['Name']        || '').toString().trim();
  const rollNumber = (row['Roll Number*'] || row['Roll Number'] || row['Roll No'] || row['Roll No.'] || '').toString().trim();
  const cls        = (row['Class*']       || row['Class']       || '').toString().trim();
  const section    = (row['Section']      || 'A').toString().trim();
  const gender     = (row['Gender']       || '').toString().trim();
  const dob        = (row['Date of Birth\n(YYYY-MM-DD)'] || row['Date of Birth'] || row['DOB'] || '').toString().trim();
  const parentName = (row['Parent Name']  || '').toString().trim();
  const contact    = (row['Contact']      || '').toString().trim();
  const email      = (row['Email']        || '').toString().trim();
  const address    = (row['Address']      || '').toString().trim();

  if (!name)       errors.push(`Row ${rowNum}: Name required`);
  if (!rollNumber) errors.push(`Row ${rowNum}: Roll Number required`);
  if (!cls)        errors.push(`Row ${rowNum}: Class required`);

  if (errors.length > 0) return { errors };

  const student = {
    name,
    rollNumber: rollNumber.toString(),
    class:      cls.toString(),
    section:    section || 'A',
    status:     'Active'
  };

  if (gender && ['Male','Female','Other'].includes(gender)) student.gender = gender;
  if (dob) { const d = new Date(dob); if (!isNaN(d)) student.dob = d; }
  if (parentName) student.parentName = parentName;
  if (contact)    student.contact    = contact;
  if (email)      student.email      = email.toLowerCase();
  if (address)    student.address    = address;

  return { student, errors: [] };
};

exports.previewImport = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ error: 'Excel file is empty' });

    const preview = [];
    const errors  = [];
    const classCounts = {};

    rows.forEach((row, i) => {
      const { student, errors: e } = parseRow(row, i);
      if (e && e.length > 0) { errors.push(...e); return; }
      preview.push(student);
      const key = `Class ${student.class}`;
      classCounts[key] = (classCounts[key] || 0) + 1;
    });

    res.json({
      totalRows: rows.length,
      preview:   preview.slice(0, 20),
      classCounts,
      errors,
      message:   `Found ${rows.length} records across ${Object.keys(classCounts).length} classes`
    });
  } catch (err) {
    console.error('PREVIEW ERROR:', err.message);
    res.status(500).json({ error: 'Failed to read Excel: ' + err.message });
  }
};

exports.importStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ error: 'Excel file is empty' });

    const validStudents = [];
    const parseErrors   = [];

    rows.forEach((row, i) => {
      const { student, errors } = parseRow(row, i);
      if (errors && errors.length > 0) parseErrors.push(...errors);
      else validStudents.push(student);
    });

    if (validStudents.length === 0) {
      return res.status(400).json({ error: 'No valid records', errors: parseErrors });
    }

    const results      = { inserted: 0, updated: 0, failed: 0, errors: parseErrors };
    const classSummary = {};

    for (const s of validStudents) {
      try {
        // ✅ Match by BOTH rollNumber AND class
        const existing = await Student.findOne({
          rollNumber: s.rollNumber,
          class:      s.class
        });

        if (existing) {
          await Student.findByIdAndUpdate(existing._id, s, { runValidators: false });
          results.updated++;
        } else {
          await Student.create(s);
          results.inserted++;
        }

        const key = `Class ${s.class}`;
        classSummary[key] = (classSummary[key] || 0) + 1;

      } catch (err) {
        results.failed++;
        // Handle duplicate key error clearly
        if (err.code === 11000) {
          results.errors.push(`Roll ${s.rollNumber} Class ${s.class}: Duplicate entry`);
        } else {
          results.errors.push(`Roll ${s.rollNumber} Class ${s.class}: ${err.message}`);
        }
        console.error(`Import row error [Roll:${s.rollNumber} Class:${s.class}]:`, err.message);
      }
    }

    res.json({
      message:      `✅ Done! ${results.inserted} inserted, ${results.updated} updated, ${results.failed} failed`,
      inserted:     results.inserted,
      updated:      results.updated,
      failed:       results.failed,
      classSummary,
      errors:       results.errors.slice(0, 20) // max 20 errors shown
    });

  } catch (err) {
    console.error('IMPORT ERROR:', err.message, err.stack);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
};
