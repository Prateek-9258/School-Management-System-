const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();

// ✅ CORS - Production + Local
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://your-frontend.onrender.com'  // Baad me update karna
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Development me sabko allow
    }
  },
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

// ✅ Routes - Check karo ye files exist karte hain
const routes = [
  { path: '/api/auth', module: './routes/auth' },
  { path: '/api/students', module: './routes/students' },
  { path: '/api/attendance', module: './routes/attendance' },
  { path: '/api/fees', module: './routes/fees' },
  { path: '/api/notifications', module: './routes/notifications' },
  { path: '/api/announcements', module: './routes/announcements' },
  { path: '/api/export', module: './routes/export' },
  { path: '/api/import', module: './routes/importRoutes' },
];

routes.forEach(route => {
  try {
    app.use(route.path, require(route.module));
    console.log(`✅ Route loaded: ${route.path}`);
  } catch (err) {
    console.error(`❌ Route failed: ${route.path} - ${err.message}`);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});