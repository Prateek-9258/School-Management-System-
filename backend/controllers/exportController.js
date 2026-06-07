const PDFDocument = require('pdfkit');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fee');

// Export Students PDF
exports.exportStudentsPDF = async (req, res) => {
  try {
    const { classFilter } = req.query;
    const query = classFilter ? { class: classFilter } : {};
    // ✅ Fix: Use rollNumber field for sorting
    const students = await Student.find(query).sort({ rollNumber: 1 });

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=students_${Date.now()}.pdf`);
    
    doc.pipe(res);

    // Header
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(24).text('Savita Bal Shiksha Niketan', 50, 45, { align: 'center' });
    doc.fontSize(12).fillColor('#6366f1').text('STUDENT INFORMATION SYSTEM', 50, 75, { align: 'center', characterSpacing: 1 });
    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(`Report Generated: ${new Date().toLocaleString()}`, 50, 95, { align: 'center' });
    
    if (classFilter) {
      doc.fontSize(11).fillColor('#1e293b').text(`Filtered by Class: ${classFilter}`, 50, 115);
    }

    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, 135).lineTo(550, 135).stroke();

    // Table Header
    let y = 155;
    doc.rect(50, y - 5, 510, 20).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    doc.text('Roll', 60, y);
    doc.text('Name', 90, y);
    doc.text('Class', 200, y);
    doc.text('PEN No', 260, y);
    doc.text('Gender', 370, y);
    doc.text('Parent', 430, y);
    doc.text('Status', 510, y);

    y += 25;
    doc.font('Helvetica');

    // Table Data
    students.forEach((student, index) => {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
      
      if (index % 2 === 0) doc.rect(50, y - 4, 510, 18).fill('#f8fafc');

      // ✅ Consistent color state
      doc.fillColor('#334155').text((student.rollNumber || student.rollNo || '').toString(), 60, y);
      doc.text(student.name, 90, y);
      doc.text(`${student.class}-${student.section}`, 200, y);
      doc.text(student.penNo || '-', 260, y);
      doc.text(student.gender, 370, y);
      doc.text(student.parentName || '-', 430, y);
      
      const statusColor = student.status === 'Active' ? '#059669' : '#dc2626';
      doc.fillColor(statusColor).text(student.status, 510, y).fillColor('#334155');
      
      y += 18;
    });

    // Footer
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text(`Total Students Enrolled: ${students.length}`, 50, y + 20);

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Export Attendance PDF
exports.exportAttendancePDF = async (req, res) => {
  try {
    const { month, year, className } = req.query;
    
    const doc = new PDFDocument({ layout: 'landscape', margin: 30 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${className}_${month}_${year}.pdf`);
    
    doc.pipe(res);

    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(22).text('Savita Bal Shiksha Niketan', 30, 25);
    doc.fontSize(14).fillColor('#6366f1').text(`Attendance Registry: ${month} ${year}`, 30, 55);
    doc.fontSize(10).fillColor('#64748b').font('Helvetica').text(`Class: ${className} | Export Date: ${new Date().toLocaleDateString()}`, 30, 75);
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(30, 90).lineTo(810, 90).stroke();

    // Get attendance data from DB
    const monthMap = { 'January':'01','February':'02','March':'03','April':'04','May':'05','June':'06','July':'07','August':'08','September':'09','October':'10','November':'11','December':'12' };
    const monthNum = monthMap[month];
    
    const query = { date: { $regex: `^${year}-${monthNum}` } };
    if (className && className !== 'all') query.class = className;

    const attendanceData = await Attendance.find(query);
    const attMap = {};
    attendanceData.forEach(a => {
      const sid = a.studentId ? a.studentId.toString() : '';
      attMap[`${sid}_${a.date}`] = a.status;
    });

    // Simple table (landscape allows more columns)
    let y = 100;
    doc.rect(30, y, 780, 22).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    y += 7;
    doc.text('STUDENT NAME', 35, y);
    doc.text('Roll', 145, y);
    
    const daysInMonth = new Date(year, Object.keys(monthMap).indexOf(month) + 1, 0).getDate();
    // Date headers
    for (let i = 1; i <= daysInMonth; i++) {
      doc.text(i.toString(), 170 + (i * 17), y);
    }
    doc.text('P/A Total', 170 + ((daysInMonth + 1) * 17), y);
    
    y += 18;
    doc.font('Helvetica').fillColor('#334155');

    const studentQuery = (className && className !== 'all') ? { class: className } : {};
    const students = await Student.find(studentQuery).sort({ class: 1, rollNumber: 1 });

    students.forEach((s, idx) => {
      if (y > 520) {
        doc.addPage();
        y = 30;
      }
      
      if (idx % 2 === 0) doc.rect(30, y - 4, 780, 16).fill('#f8fafc');

      doc.fillColor('#334155').text(s.name.substring(0, 22), 35, y);
      doc.text(s.rollNumber ? s.rollNumber.toString() : '-', 145, y);
      
      let pCount = 0;
      let aCount = 0;

      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${monthNum}-${String(i).padStart(2, '0')}`;
        const status = attMap[`${s._id.toString()}_${dateStr}`] || '-';
        
        if (status === 'A') doc.fillColor('#dc2626');
        else if (status === 'P') doc.fillColor('#059669');
        else doc.fillColor('#94a3b8');
        
        doc.text(status, 170 + (i * 17), y);
        if (status === 'P') pCount++;
        if (status === 'A') aCount++;
      }
      
      doc.fillColor('#4f46e5').font('Helvetica-Bold').text(`${pCount}P/${aCount}A`, 170 + ((daysInMonth + 1) * 17), y);
      doc.font('Helvetica');
      y += 16;
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Export Fees PDF
exports.exportFeesPDF = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const fees = await Fee.find({ studentId }).sort({ date: -1 });
    const student = await Student.findById(studentId);

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=fees_${student.name.replace(/\s+/g, '_')}.pdf`);
    
    doc.pipe(res);

    // Professional Header Bar
    doc.rect(0, 0, 612, 80).fill('#1e293b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('Savita Bal Shiksha Niketan', 50, 25, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('Official Fee Account Statement', 50, 52, { align: 'center', characterSpacing: 1 });

    // Document Metadata
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('FEE STATEMENT', 50, 100);
    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 450, 103);
    doc.strokeColor('#6366f1').lineWidth(2).moveTo(50, 118).lineTo(150, 118).stroke();

    // Student Info Block
    doc.rect(50, 130, 510, 45).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(10).text('STUDENT INFORMATION', 60, 138);
    doc.font('Helvetica').fontSize(10).fillColor('#475569');
    doc.text(`Name: ${student.name}`, 60, 155);
    doc.text(`Class: ${student.class}-${student.section}`, 240, 155);
    doc.text(`Roll No: ${student.rollNumber || student.rollNo}`, 420, 155);

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
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      if (idx % 2 === 0) doc.rect(40, y - 4, 532, 16).fill('#f8fafc');

      doc.fillColor('#334155').fontSize(9);
      const addedAt = fee.createdAt ? new Date(fee.createdAt).toLocaleDateString('en-IN') : (fee.date ? new Date(fee.date).toLocaleDateString('en-IN') : '-');
      doc.text(addedAt, 45, y);
      doc.text(fee.month || '-', 110, y);
      doc.text((fee.type || fee.feeType || '-').substring(0, 12), 170, y);
      doc.font('Helvetica-Bold').text(`Rs.${fee.amount || 0}`, 250, y).font('Helvetica');
      
      const statusColor = (fee.status === 'Pending' || fee.status === 'Unpaid' || fee.status === 'Partial') ? '#e11d48' : '#16a34a';
      doc.fillColor(statusColor).text(fee.status.toUpperCase(), 325, y).fillColor('#334155');
      
      // Robust Due Date fallback
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
    doc.font('Helvetica-Bold').fontSize(11);
    doc.fillColor('#e11d48').text(`TOTAL PENDING: Rs.${totalDue.toLocaleString()}`, 60, y + 15);
    doc.fillColor('#16a34a').text(`TOTAL PAID: Rs.${totalPaid.toLocaleString()}`, 350, y + 15);
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('Please keep this statement for your records.', 40, y + 55, { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};