const webpush = require('web-push');
const PushSubscription = require('./models/PushSubscription');

/**
 * Sends a push notification to all subscribers or a specific user.
 * @param {Object} payload - The notification data (title, body, icon, url, etc.)
 * @param {string} [userId] - Optional ID to target a specific user
 */
const sendPushNotification = async (payload, userId = null) => {
  try {
    let subscriptions;
    
    // If userId is provided, target that user; otherwise, send to everyone
    if (userId) {
      subscriptions = await PushSubscription.find({ userId });
    } else {
      subscriptions = await PushSubscription.find();
    }

    const results = await Promise.allSettled(
      subscriptions.map(sub => 
        webpush.sendNotification(sub, JSON.stringify(payload))
          .catch(async err => {
            // Clean up invalid/expired subscriptions
            if (err.statusCode === 410 || err.statusCode === 404) {
              await PushSubscription.deleteOne({ endpoint: sub.endpoint });
            }
            throw err;
          })
      )
    );

    return {
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      total: subscriptions.length
    };
  } catch (err) {
    console.error('sendPushNotification Error:', err);
    throw err;
  }
};

module.exports = { sendPushNotification };