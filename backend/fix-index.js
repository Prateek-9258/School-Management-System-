require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const col = mongoose.connection.collection('students');

  // List existing indexes
  const indexes = await col.indexes();
  console.log('\n📋 Current indexes on students collection:');
  indexes.forEach(idx => console.log('  →', JSON.stringify(idx.key), '| unique:', idx.unique, '| name:', idx.name));

  // Drop ALL indexes except _id
  for (const idx of indexes) {
    if (idx.name !== '_id_') {
      try {
        await col.dropIndex(idx.name);
        console.log(`🗑️  Dropped index: ${idx.name}`);
      } catch (e) {
        console.log(`⚠️  Could not drop ${idx.name}:`, e.message);
      }
    }
  }

  // Create correct compound index
  await col.createIndex(
    { rollNumber: 1, class: 1 },
    { unique: true, name: 'rollNumber_class_unique' }
  );
  console.log('✅ Created compound index: rollNumber + class (unique)');

  // Verify final indexes
  const final = await col.indexes();
  console.log('\n📋 Final indexes:');
  final.forEach(idx => console.log('  →', JSON.stringify(idx.key), '| name:', idx.name));

  console.log('\n🎉 Done!');
  mongoose.disconnect();
};

run().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
