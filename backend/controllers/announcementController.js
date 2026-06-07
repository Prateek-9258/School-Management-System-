const Announcement = require('../models/Announcement');

// Get all announcements
exports.getAnnouncements = async (req, res) => {
  try {
    const now = new Date();
    const announcements = await Announcement.find({
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: now } }
      ],
      status: 'active'
    }).sort({ pinned: -1, createdAt: -1 });
    
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create announcement
exports.createAnnouncement = async (req, res) => {
  try {
    const announcement = new Announcement(req.body);
    await announcement.save();
    res.status(201).json(announcement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update announcement
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByIdAndUpdate(id, req.body, { new: true });
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete announcement
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    await Announcement.findByIdAndDelete(id);
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};