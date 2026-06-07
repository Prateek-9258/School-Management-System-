const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  month: { type: String },
  status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
  paidDate: { type: Date },
  mode: { type: String, default: 'Cash' }
}, { timestamps: true });

module.exports = mongoose.model('Fee', feeSchema);
