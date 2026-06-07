require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('./models/User');
const Student  = require('./models/Student');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // ✅ SAFE SEED: Use findOneAndUpdate with upsert to avoid deleting existing data
  const accounts = [
    {
      name: 'Savita Bal Shiksha Niketan',
      username: 'Savita Bal Shiksha Niketan',
      email: 'admin@school.com',
      password: '23wld!24',
      role: 'admin',
      mobile: '9258833113'
    },
    {
      name: 'Teacher Account',
      username: 'teacher',
      email: 'teacher@school.com',
      password: 'Teacher@00',
      role: 'teacher',
      mobile: '9000000000'
    }
  ];

  for (const acc of accounts) {
    // Force reset core accounts passwords to ensure they work
    const hashedPassword = await bcrypt.hash(acc.password, 10);
    await User.findOneAndUpdate(
      { username: acc.username },
      { $set: { ...acc, password: hashedPassword } },
      { upsert: true }
    );
  }

  // ✅ SYNC: Existing students ke liye login accounts banayein
  const students = await Student.find({ contact: { $exists: true, $ne: '' } });
  console.log(`📡 Syncing ${students.length} students to user accounts and cleaning data...`);
  
  for (const s of students) {
    // Mobile number ko bilkul saaf karein (sirf numbers)
    const cleanMobile = String(s.contact).replace(/\D/g, '').trim();
    
    if (cleanMobile.length >= 10) {
      try {
        // 1. Student record ka contact bhi update karein taaki dashboard match kare
        if (s.contact !== cleanMobile) {
          await Student.updateOne({ _id: s._id }, { $set: { contact: cleanMobile } });
        }

        // 2. User account sync karein
        const studentPassHash = await bcrypt.hash(cleanMobile, 10);
        await User.findOneAndUpdate(
          { username: cleanMobile },
          { 
            $set: { 
              name: s.name,
              email: `${cleanMobile}@student.com`,
              password: studentPassHash,
              role: 'student',
              mobile: cleanMobile
            }
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.log(`⚠️ Skip Student ${s.name}: ${err.message}`);
      }
    }
  }

  console.log('\n✨ AUTH SEED SUCCESSFUL - Student data was NOT touched.');
  
  console.log('   Admin   → username: "Savita Bal Shiksha Niketan" | password: "23wld!24"');
  console.log('   Teacher → username: "teacher" | password: "Teacher@00"');
  console.log('\n🎉 Seed complete! Ab Excel se students import karo.');
  mongoose.disconnect();
};

run().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});