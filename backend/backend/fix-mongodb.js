// EMERGENCY FIX - MongoDB Collection Drop & Recreate
// Save this file as: backend/fix-mongodb.js
// Run: node fix-mongodb.js

require('dotenv').config();
const mongoose = require('mongoose');

async function fix() {
  try {
    // Connect to MongoDB using the URI from .env
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Drop the old collection (removes bad index)
    try {
      await mongoose.connection.dropCollection('attendances');
      console.log('✅ Old attendances collection dropped');
    } catch (e) {
      console.log('⚠️ Collection not found or already dropped');
    }

    // Create new schema with correct field name
    const attendanceSchema = new mongoose.Schema({
      studentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student',
        required: [true, 'studentId is required'] 
      },
      date: { 
        type: String, 
        required: [true, 'date is required'] 
      },
      class: { 
        type: String, 
        required: true 
      },
      section: { 
        type: String, 
        default: 'A' 
      },
      status: { 
        type: String, 
        enum: ['P', 'A', 'L', 'Lt', ''], 
        default: '' 
      },
      remarks: { 
        type: String, 
        default: '' 
      }
    }, { timestamps: true });

    // Create correct index (studentId + date, NOT student + date)
    attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });
    attendanceSchema.index({ date: 1, class: 1 });

    // Register model
    const Attendance = mongoose.model('Attendance', attendanceSchema);

    console.log('✅ New schema created with studentId field');
    console.log('✅ Index created: { studentId: 1, date: 1 }');
    console.log('✅ Fix complete! Restart your backend now.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fix();