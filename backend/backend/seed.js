require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('./models/User');

const run = async () => {
  // Consistency ke liye MONGODB_URI use karein
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  await User.deleteMany();

  await User.create({ name: 'Admin',       email: 'admin@school.com',   password: '23wld!24', role: 'admin' });
  await User.create({ name: 'Mrs. Sharma', email: 'teacher@school.com', password: 'Teacher@00', role: 'teacher' });

  console.log('✅ Seed complete! Admin and Teacher accounts updated.');
  console.log('ℹ️  Imported students were not touched.');
  mongoose.disconnect();
};

run().catch(console.error);