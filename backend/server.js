const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ✅ CORS - Sabko allow karo (Production ke liye baad me restrict kar lena)
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB Atlas Connected'))
.catch(err => console.error('❌ MongoDB Error:', err.message));

// ✅ Dynamic Route Loading - Sirf jo files exist karti hain
const routesDir = path.join(__dirname, 'routes');

fs.readdirSync(routesDir).forEach(file => {
  if (file.endsWith('.js')) {
    const routeName = file.replace('.js', '');
    let routePath;
    
    // Route path decide karo
    if (routeName === 'auth') routePath = '/api/auth';
    else if (routeName === 'students') routePath = '/api/students';
    else if (routeName === 'attendance') routePath = '/api/attendance';
    else if (routeName === 'fees') routePath = '/api/fees';
    else if (routeName === 'notifications') routePath = '/api/notifications';
    else if (routeName === 'announcements') routePath = '/api/announcements';
    else if (routeName === 'export') routePath = '/api/export';
    else if (routeName === 'importRoutes') routePath = '/api/import';
    else routePath = `/api/${routeName}`;
    
    try {
      app.use(routePath, require(`./routes/${file}`));
      console.log(`✅ Route loaded: ${routePath} → ${file}`);
    } catch (err) {
      console.error(`❌ Route failed: ${routePath} → ${file} - ${err.message}`);
    }
  }
});

// ✅ Port
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});