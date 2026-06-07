const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: {  // ✅ YEH HONA CHAHIYE
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  date: { type: String, required: true },
  class: { type: String, required: true },
  section: { type: String, default: 'A' },
  status: { type: String, enum: ['P', 'A', 'L', 'Lt'], default: 'P' },
  remarks: { type: String, default: '' }
}, { timestamps: true });

// ✅ YEH INDEX HONA CHAHIYE
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);