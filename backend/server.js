const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
const PushSubscription = require('./models/PushSubscription');
require('dotenv').config();

const app = express();

// ✅ CORS
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB Atlas Connected'))
.catch(err => console.error('❌ MongoDB Error:', err.message));

// ✅ Web Push VAPID Setup
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@school.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ✅ Save Subscription API
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { subscription, userId } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      { 
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userId: userId || null
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Subscription saved' });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Send Push Notification API
app.post('/api/push/send', async (req, res) => {
  try {
    const { title, body, icon, url, userId } = req.body;
    
    const payload = JSON.stringify({
      title: title || 'School Management',
      body: body || 'New notification',
      icon: icon || '/icons/icon-192x192.png',
      url: url || '/',
      badge: '/badge.png',
      tag: 'school-notification',
      requireInteraction: true
    });

    let subscriptions;
    
    if (userId) {
      subscriptions = await PushSubscription.find({ userId });
    } else {
      subscriptions = await PushSubscription.find();
    }

    const results = await Promise.allSettled(
      subscriptions.map(sub => 
        webpush.sendNotification(sub, payload)
          .catch(async err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await PushSubscription.deleteOne({ endpoint: sub.endpoint });
              console.log('🗑️ Deleted invalid subscription');
            }
            throw err;
          })
      )
    );

    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({ 
      success: true, 
      sent: success, 
      failed: failed,
      total: subscriptions.length 
    });
  } catch (err) {
    console.error('Send push error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get VAPID Public Key - Multiple paths for compatibility
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.get('/api/announcements/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// ✅ Dynamic Route Loading
const routesDir = path.join(__dirname, 'routes');

if (fs.existsSync(routesDir)) {
  fs.readdirSync(routesDir).forEach(file => {
    if (file.endsWith('.js')) {
      const routeName = file.replace('.js', '');
      let routePath;
      
      if (routeName === 'auth') routePath = '/api/auth';
      else if (routeName === 'students') routePath = '/api/students';
      else if (routeName === 'attendance') routePath = '/api/attendance';
      else if (routeName === 'fees') routePath = '/api/fees';
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
} else {
  console.error('❌ Routes directory not found:', routesDir);
}

// ✅ FALLBACK: Also mount /announcements without /api prefix (for old frontend)
// REMOVE THIS once frontend is updated to use /api/announcements
app.use('/announcements', require('./routes/announcements'));

// ✅ Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// ✅ 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// ✅ Port
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});