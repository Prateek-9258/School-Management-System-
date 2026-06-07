const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  class: { type: String, required: true },
  section: { type: String, default: 'A' },
  rollNumber: { type: String, required: true }, // Changed from rollNo to rollNumber
  penNo: { type: String, default: '' }, 
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
  dob: { type: Date },
  parentName: { type: String },
  contact: { type: String },
  email: { type: String },
  address: { type: String },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
