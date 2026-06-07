const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  rollNumber:    { type: String, required: true, trim: true },   // unique constraint hataya
  class:         { type: String, required: true },
  section:       { type: String, default: 'A' },
  gender:        { type: String, enum: ['Male', 'Female', 'Other'] },
  dob:           { type: Date },
  parentName:    { type: String, trim: true },
  contact:       { type: String, trim: true },
  email:         { type: String, trim: true, lowercase: true },
  address:       { type: String, trim: true },
  admissionDate: { type: Date, default: Date.now },
  penNo:         { type: String, default: '' },
  status:        { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

// Class 1 Roll 1 aur Class 2 Roll 1 — dono allow honge
// Lekin same class mein same roll number nahi hoga
studentSchema.index({ class: 1, rollNumber: 1 }, { unique: true });

module.exports = mongoose.model('Student', studentSchema);
