const express = require('express');
const router = express.Router();

// Mock data
let notifications = [
  {
    _id: '1',
    title: 'Welcome',
    message: 'School Management System is ready',
    type: 'general',
    priority: 'normal',
    userId: 'admin',
    read: false,
    createdAt: new Date().toISOString()
  }
];

router.get('/:userId', (req, res) => {
  res.json(notifications.filter(n => n.userId === req.params.userId));
});

router.get('/:userId/unread-count', (req, res) => {
  const count = notifications.filter(n => n.userId === req.params.userId && !n.read).length;
  res.json({ count });
});

router.post('/', (req, res) => {
  const notification = { _id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  notifications.unshift(notification);
  res.status(201).json(notification);
});

router.put('/:id/read', (req, res) => {
  const n = notifications.find(n => n._id === req.params.id);
  if (n) n.read = true;
  res.json(n);
});

router.put('/:userId/read-all', (req, res) => {
  notifications.filter(n => n.userId === req.params.userId).forEach(n => n.read = true);
  res.json({ message: 'All read' });
});

router.delete('/:id', (req, res) => {
  notifications = notifications.filter(n => n._id !== req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;