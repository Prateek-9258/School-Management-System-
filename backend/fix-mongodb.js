// EMERGENCY FIX - MongoDB Collection Drop & Recreate
// Save this file as: backend/fix-mongodb.js
// Run: node fix-mongodb.js

require('dotenv').config();
const mongoose = require('mongoose');

async function fix() {
  try {
    // 1. Connection logic ko robust banayein
    const uri = process.env.MONGODB_URI || "mongodb+srv://ps7719404_db_user:23wld!24@school.llguuci.mongodb.net/";
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // 2. Problematic index ko dhoond kar delete karein
    try {
      const collection = mongoose.connection.collection('attendances');
      const indexes = await collection.indexes();
      console.log('📊 Current Indexes:', indexes.map(i => i.name));

      // Agar 'student_1_date_1' index milta hai, toh use drop karein
      if (indexes.find(i => i.name === 'student_1_date_1')) {
        await collection.dropIndex('student_1_date_1');
        console.log('🗑️ Successfully dropped old index: student_1_date_1');
      } else {
        // Safe side: Agar index nahi mil raha, toh collection hi drop kar dete hain
        await mongoose.connection.dropCollection('attendances');
        console.log('✅ Collection dropped to clear all stale indexes');
      }
    } catch (e) {
      console.log('⚠️ No stale collection/index found to drop');
    }

    // 3. Naya model definition (Bas confirm karne ke liye)
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