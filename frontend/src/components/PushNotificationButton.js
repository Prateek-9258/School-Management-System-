import React, { useState, useEffect } from 'react';
import PushNotificationManager from '../utils/PushNotification';

const PushNotificationButton = ({ userId }) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const status = await PushNotificationManager.checkSubscription();
    setIsSubscribed(status);
  };

  const handleSubscribe = async () => {
    setLoading(true);
    if (isSubscribed) {
      await PushNotificationManager.unsubscribe();
      setIsSubscribed(false);
    } else {
      await PushNotificationManager.subscribe(userId);
      setIsSubscribed(true);
    }
    setLoading(false);
  };

  if (!PushNotificationManager.isSupported()) {
    return <button disabled>Browser doesn't support push notifications</button>;
  }

  return (
    <button 
      onClick={handleSubscribe} 
      disabled={loading}
      style={{
        padding: '10px 20px',
        backgroundColor: isSubscribed ? '#e74c3c' : '#27ae60',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
      }}
    >
      {loading ? 'Loading...' : isSubscribed ? '🔕 Unsubscribe' : '🔔 Enable Notifications'}
    </button>
  );
};

export default PushNotificationButton;