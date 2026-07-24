const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
const PushSubscription = require('./models/PushSubscription');
require('dotenv').config();

const app = express();

// ============================================
// ✅ MIDDLEWARE
// ============================================
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// ✅ MONGODB
// ============================================
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB Atlas Connected'))
.catch(err => console.error('❌ MongoDB Error:', err.message));

// ============================================
// ✅ WEB PUSH VAPID SETUP
// ============================================
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@school.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ============================================
// ✅ API ROUTES
// ============================================

// Push Notification APIs
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

app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.get('/api/announcements/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// ============================================
// ✅ DYNAMIC ROUTE LOADING
// ============================================
const routesDir = path.join(__dirname, 'routes');

if (fs.existsSync(routesDir)) {
  fs.readdirSync(routesDir).forEach(file => {
    if (file.endsWith('.js')) {
      if (file === 'notificationRoutes.js' || file === 'Announcements.js') return;

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
        const routeModule = require(`./routes/${file}`);
        const router = routeModule.default || routeModule;

        if (typeof router === 'function') {
          app.use(routePath, router);
          console.log(`✅ Route loaded: ${routePath} → ${file}`);
        } else {
          throw new Error(`Module in "${file}" does not export a valid Express router function. Check "module.exports".`);
        }
      } catch (err) {
        console.error(`❌ Route failed: ${routePath} → ${file} - ${err.message}`);
      }
    }
  });
} else {
  console.error('❌ Routes directory not found:', routesDir);
}

// ============================================
// ✅ HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// ✅ SERVE REACT FRONTEND (STATIC FILES)
// ============================================
// Adjust path: use '../frontend/build' if server.js is in /backend/
// Use 'frontend/build' if server.js is at project root
const buildPath = path.join(__dirname, '..', 'frontend', 'build');

if (fs.existsSync(buildPath)) {
  // Serve static files (JS, CSS, images) with correct MIME types
  app.use(express.static(buildPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));

  // Serve index.html for all non-API routes (React Router support)
  app.get('*', (req, res, next) => {
    // Don't intercept API 404s - let them fall through
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(buildPath, 'index.html'));
  });

  console.log('✅ Serving React frontend from:', buildPath);
} else {
  console.warn('⚠️ Frontend build not found at:', buildPath);
}

// ============================================
// ✅ 404 HANDLER (API routes only)
// ============================================
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route not found: ${req.method} ${req.path}` 
  });
});

// ============================================
// ✅ GLOBAL ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// ============================================
// ✅ START SERVER
// ============================================
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});