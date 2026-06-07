const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  student:   { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  feeType:   { type: String, enum: ['Tuition', 'Exam', 'Transport', 'Library', 'Other'], required: true },
  amount:    { type: Number, required: true },
  dueDate:   { type: Date, required: true },
  paidDate:  { type: Date },
  status:    { type: String, enum: ['Paid', 'Unpaid', 'Partial'], default: 'Unpaid' },
  month:     { type: String },
  receiptNo: { type: String },
  remarks:   { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Fee', feeSchema);