const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');

// GET /api/announcements - Sab announcements lao
router.get('/', async (req, res) => {
  try {
    const { priority, targetAudience, search, pinned, active } = req.query;
    let filter = {};
    
    if (priority) filter.priority = priority;
    if (targetAudience) filter.targetAudience = targetAudience;
    if (pinned !== undefined) filter.pinned = pinned === 'true';
    if (active !== undefined) filter.isActive = active === 'true';
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }
    
    const announcements = await Announcement.find(filter)
      .sort({ pinned: -1, createdAt: -1 });
    
    res.json({
      success: true,
      count: announcements.length,
      data: announcements
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching announcements',
      error: error.message
    });
  }
});

// GET /api/announcements/:id - Single announcement
router.get('/:id', async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// POST /api/announcements - Naya announcement banao
router.post('/', async (req, res) => {
  try {
    const { title, content, priority, targetAudience, targetClass, pinned, postedBy, expiresAt } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }
    
    const announcement = new Announcement({
      title,
      content,
      priority: priority || 'normal',
      targetAudience: targetAudience || 'all',
      targetClass: targetClass || '',
      pinned: pinned || false,
      postedBy: postedBy || 'Admin',
      expiresAt: expiresAt || null
    });
    
    await announcement.save();
    
    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating announcement',
      error: error.message
    });
  }
});

// PUT /api/announcements/:id - Update karo
router.put('/:id', async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    const { title, content, priority, targetAudience, targetClass, pinned, postedBy, expiresAt, isActive } = req.body;
    
    if (title !== undefined) announcement.title = title;
    if (content !== undefined) announcement.content = content;
    if (priority !== undefined) announcement.priority = priority;
    if (targetAudience !== undefined) announcement.targetAudience = targetAudience;
    if (targetClass !== undefined) announcement.targetClass = targetClass;
    if (pinned !== undefined) announcement.pinned = pinned;
    if (postedBy !== undefined) announcement.postedBy = postedBy;
    if (expiresAt !== undefined) announcement.expiresAt = expiresAt;
    if (isActive !== undefined) announcement.isActive = isActive;
    
    await announcement.save();
    
    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating announcement',
      error: error.message
    });
  }
});

// DELETE /api/announcements/:id - Delete karo
router.delete('/:id', async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    await Announcement.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting announcement',
      error: error.message
    });
  }
});

// PATCH /api/announcements/:id/pin - Pin/Unpin toggle
router.patch('/:id/pin', async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    announcement.pinned = !announcement.pinned;
    await announcement.save();
    
    res.json({
      success: true,
      message: `Announcement ${announcement.pinned ? 'pinned' : 'unpinned'}`,
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;