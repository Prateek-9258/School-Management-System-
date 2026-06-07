const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fee');

// Export Students PDF
router.get('/students', async (req, res) => {
  try {
    const { classFilter } = req.query;
    let query = {};
    if (classFilter && classFilter !== 'all') {
      const parts = classFilter.split('-');
      query.class = parts[0];
      if (parts.length > 1 && parts[1]) {
        query.section = parts[1];
      }
    }

    const students = await Student.find(query).sort({ rollNumber: 1 });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=students_${Date.now()}.pdf`);
    doc.pipe(res);

    // Header
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(24).text('Savita Bal Shiksha Niketan', 50, 45, { align: 'center' });
    doc.fontSize(12).fillColor('#6366f1').text('STUDENT INFORMATION SYSTEM', 50, 75, { align: 'center', characterSpacing: 1 });
    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(`Report Generated: ${new Date().toLocaleString()}`, 50, 95, { align: 'center' });
    if (classFilter) doc.text(`Class: ${classFilter}`, 50, 110);
    doc.strokeColor('#e2e8f0').moveTo(50, 135).lineTo(550, 135).stroke();

    // Table
    let y = 155;
    doc.rect(50, y - 5, 510, 20).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    doc.text('Roll', 50, y);
    doc.text('Name', 90, y);
    doc.text('Class', 200, y);
    doc.text('PEN No', 260, y);
    doc.text('Gender', 380, y);
    doc.text('Parent', 440, y);
    doc.text('Status', 520, y);

    y += 25;
    doc.font('Helvetica').fillColor('#334155');

    students.forEach((student, index) => {
      if (y > 720) { doc.addPage(); y = 50; }
      if (index % 2 === 0) doc.rect(50, y - 4, 510, 18).fill('#f8fafc');

      // ✅ Fix: Set color back to dark for text after filling background
      doc.fillColor('#334155').text(student.rollNumber || '-', 60, y);
      doc.text(student.name, 90, y);
      doc.text(`${student.class}-${student.section}`, 200, y);
      doc.text(student.penNo || '-', 260, y);
      doc.text(student.gender, 370, y);
      doc.text(student.parentName || '-', 430, y);
      doc.text(student.status, 510, y);
      y += 18;
    });

    doc.fontSize(10).text(`Total Students: ${students.length}`, 50, y + 20);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Attendance PDF
router.get('/attendance', async (req, res) => {
  try {
    const { month, year, className } = req.query; // month is name like "January"
    const monthMap = { 'January':'01','February':'02','March':'03','April':'04','May':'05','June':'06','July':'07','August':'08','September':'09','October':'10','November':'11','December':'12' };
    const monthNum = monthMap[month];

    // Fetch all students of this class
    let studentQuery = {};
    if (className && className !== 'all') {
      studentQuery.class = className;
    }
    const students = await Student.find(studentQuery).sort({ class: 1, rollNumber: 1 });
    
    // Fetch attendance for this month
    const attQuery = { date: { $regex: `^${year}-${monthNum}` } };
    if (className && className !== 'all') attQuery.class = className;
    
    const attendanceRecords = await Attendance.find(attQuery);

    // Efficient lookup map: "studentId_date" -> status
    const attMap = {};
    attendanceRecords.forEach(a => {
      const sid = a.studentId ? a.studentId.toString() : '';
      attMap[`${sid}_${a.date}`] = a.status;
    });

    const doc = new PDFDocument({ layout: 'landscape', margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${className}_${month}_${year}.pdf`);
    doc.pipe(res);

    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(22).text('Savita Bal Shiksha Niketan', 30, 25);
    doc.fontSize(14).fillColor('#6366f1').text(`Attendance Registry: ${month} ${year}`, 30, 55);
    doc.fontSize(10).fillColor('#64748b').font('Helvetica').text(`Class: ${className} | Date: ${new Date().toLocaleDateString()}`, 30, 75);
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(30, 90).lineTo(810, 90).stroke();

    let y = 100;
    doc.rect(30, y, 780, 22).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    y += 7;
    doc.text('Roll', 35, y);
    doc.text('Student Name', 65, y);
    
    // Days headers - Landscape space optimization
    const daysInMonth = new Date(year, Object.keys(monthMap).indexOf(month) + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      doc.text(i.toString(), 165 + (i * 17), y);
    }
    doc.text('P/A Total', 165 + ((daysInMonth + 1) * 17), y);

    y += 18;
    doc.font('Helvetica').fillColor('#334155');

    students.forEach((s, idx) => {
      if (y > 520) { doc.addPage(); y = 30; }
      if (idx % 2 === 0) doc.rect(30, y - 4, 780, 16).fill('#f8fafc');

      // ✅ Fix: Ensure text color is set for each row
      doc.fillColor('#334155').text(s.rollNumber || '-', 35, y);
      doc.text(s.name.substring(0, 20), 65, y);

      let pCount = 0;
      let aCount = 0;

      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${monthNum}-${String(i).padStart(2, '0')}`;
        const status = attMap[`${s._id.toString()}_${dateStr}`] || '-';
        
        if (status === 'A') doc.fillColor('#dc2626');
        else if (status === 'P') doc.fillColor('#059669');
        else doc.fillColor('#94a3b8');

        doc.text(status, 165 + (i * 17), y);
        if (status === 'P') pCount++;
        if (status === 'A') aCount++;
      }
      doc.fillColor('#4f46e5').font('Helvetica-Bold').text(`${pCount}P/${aCount}A`, 165 + ((daysInMonth + 1) * 17), y);
      doc.font('Helvetica');
      y += 16;
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NEW: Export Pending Fees PDF
router.get('/fees/pending-report', async (req, res) => {
  try {
    const pendingFees = await Fee.find({ status: 'Pending' }).populate('studentId');
    
    // Group by student to avoid duplicate names
    const pendingFeesMap = {};
    pendingFees.forEach(f => {
      if (!f.studentId) return;
      const sid = f.studentId._id.toString();
      if (!pendingFeesMap[sid]) {
        pendingFeesMap[sid] = {
          name: f.studentId.name,
          class: `${f.studentId.class}-${f.studentId.section}`,
          roll: f.studentId.rollNumber,
          totalAmount: 0,
          months: []
        };
      }
      pendingFeesMap[sid].totalAmount += f.amount;
      pendingFeesMap[sid].months.push(f.month);
    });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=pending_fees_${Date.now()}.pdf`);
    doc.pipe(res);

    // Professional Header Bar
    doc.rect(0, 0, 612, 80).fill('#1e293b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('Savita Bal Shiksha Niketan', 50, 25, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('Official Pending Fees Audit Report', 50, 52, { align: 'center', characterSpacing: 1 });

    // Document Title Section
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('PENDING FEES REPORT', 50, 100);
    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 450, 103);
    doc.strokeColor('#e11d48').lineWidth(2).moveTo(50, 118).lineTo(150, 118).stroke();

    let y = 140;
    // Table Header
    doc.rect(40, y, 532, 22).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    let headerY = y + 7;
    doc.text('ROLL', 45, headerY);
    doc.text('STUDENT NAME', 85, headerY);
    doc.text('CLASS', 210, headerY);
    doc.text('PENDING MONTHS', 280, headerY);
    doc.text('TOTAL DUE', 490, headerY);

    y += 28;
    doc.font('Helvetica').fillColor('#334155');
    let grandTotal = 0;

    Object.values(pendingFeesMap).forEach((d, idx) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      if (idx % 2 === 0) doc.rect(40, y - 4, 532, 16).fill('#f8fafc');

      doc.fillColor('#334155').fontSize(9);
      doc.text(d.roll || '-', 45, y);
      doc.text(d.name, 85, y);
      doc.text(d.class, 210, y);
      doc.text(d.months.join(', '), 280, y, { width: 190 });
      doc.font('Helvetica-Bold').fillColor('#e11d48').text(`Rs.${d.totalAmount.toLocaleString()}`, 490, y).fillColor('#334155').font('Helvetica');
      grandTotal += d.totalAmount;
      y += 20;
    });

    // Grand Total Box
    y += 10;
    doc.rect(40, y, 532, 35).fill('#fef2f2');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#991b1b');
    doc.text(`GRAND TOTAL OUTSTANDING: Rs.${grandTotal.toLocaleString()}`, 60, y + 12);
    
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Fees PDF
router.get('/fees/:studentId', async (req, res) => {
  try {
    const fees = await Fee.find({ studentId: req.params.studentId }).sort({ date: -1 });
    const student = await Student.findById(req.params.studentId);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=fees_${student.name.replace(/\s+/g, '_')}.pdf`);
    doc.pipe(res);

    // Professional Header Bar
    doc.rect(0, 0, 612, 80).fill('#1e293b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('Savita Bal Shiksha Niketan', 50, 25, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('OFFICIAL FEE ACCOUNT STATEMENT', 50, 52, { align: 'center', characterSpacing: 1 });

    // Metadata
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('FEE STATEMENT', 50, 100);
    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(`Statement Date: ${new Date().toLocaleDateString('en-IN')}`, 450, 103);
    doc.strokeColor('#6366f1').lineWidth(2).moveTo(50, 118).lineTo(150, 118).stroke();

    // Student Info Block
    doc.rect(50, 130, 510, 45).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(10).text('STUDENT INFORMATION', 60, 138);
    doc.font('Helvetica').fontSize(10).fillColor('#475569');
    doc.text(`Name: ${student.name}`, 60, 155);
    doc.text(`Class: ${student.class}-${student.section}`, 240, 155);
    doc.text(`Roll No: ${student.rollNumber}`, 420, 155);

    let y = 190;
    // Table Header
    doc.rect(40, y, 532, 22).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    let headerY = y + 7;
    doc.text('DATE ADDED', 45, headerY);
    doc.text('MONTH', 110, headerY);
    doc.text('FEE TYPE', 170, headerY);
    doc.text('AMOUNT', 250, headerY);
    doc.text('STATUS', 325, headerY);
    doc.text('DUE DATE', 400, headerY);
    doc.text('PAID DATE', 485, headerY);

    y += 28;
    doc.font('Helvetica').fillColor('#334155');
    let totalDue = 0;
    let totalPaid = 0;

    fees.forEach((fee, idx) => {
      if (y > 700) { doc.addPage(); y = 50; }
      if (idx % 2 === 0) doc.rect(40, y - 4, 532, 16).fill('#f8fafc');
      
      doc.fillColor('#334155').fontSize(9);
      const addedAt = fee.createdAt ? new Date(fee.createdAt).toLocaleDateString('en-IN') : (fee.date ? new Date(fee.date).toLocaleDateString('en-IN') : '-');
      doc.text(addedAt, 45, y);
      doc.text(fee.month || '-', 110, y);
      doc.text((fee.type || fee.feeType || '-').substring(0, 12), 170, y);
      doc.font('Helvetica-Bold').text(`Rs.${fee.amount || 0}`, 250, y).font('Helvetica');
      
      const statusColor = (fee.status === 'Pending' || fee.status === 'Unpaid' || fee.status === 'Partial') ? '#e11d48' : '#16a34a';
      doc.fillColor(statusColor).text(fee.status.toUpperCase(), 325, y).fillColor('#334155');
      
      const displayDueDate = fee.dueDate || fee.date;
      const formattedDueDate = (displayDueDate && !isNaN(new Date(displayDueDate))) ? new Date(displayDueDate).toLocaleDateString('en-IN') : '-';
      doc.text(formattedDueDate, 400, y);

      const formattedPaidDate = (fee.paidDate && !isNaN(new Date(fee.paidDate))) ? new Date(fee.paidDate).toLocaleDateString('en-IN') : '-';
      doc.text(formattedPaidDate, 485, y);

      if (fee.status !== 'Paid') totalDue += fee.amount;
      else totalPaid += fee.amount;
      y += 16;
    });

    // Summary Box
    y += 15;
    doc.rect(40, y, 532, 40).fill('#f1f5f9');
    doc.font('Helvetica-Bold');
    doc.fillColor('#e11d48').fontSize(11).text(`TOTAL PENDING: Rs.${totalDue.toLocaleString()}`, 60, y + 15);
    doc.fillColor('#16a34a').fontSize(11).text(`TOTAL PAID: Rs.${totalPaid.toLocaleString()}`, 350, y + 15);
    
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('This is a computer generated document and does not require a physical signature.', 40, y + 55, { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
