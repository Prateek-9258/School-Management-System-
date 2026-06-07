const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'Title is required'], 
    trim: true, 
    maxlength: 200 
  },
  content: { 
    type: String, 
    required: [true, 'Content is required'], 
    trim: true 
  },
  priority: { 
    type: String, 
    enum: ['low', 'normal', 'high', 'urgent'], 
    default: 'normal' 
  },
  targetAudience: { 
    type: String, 
    enum: ['all', 'students', 'parents', 'teachers', 'class'], 
    default: 'all' 
  },
  targetClass: { 
    type: String, 
    trim: true, 
    default: '' 
  },
  pinned: { 
    type: Boolean, 
    default: false 
  },
  postedBy: { 
    type: String, 
    required: true, 
    default: 'Admin' 
  },
  expiresAt: { 
    type: Date, 
    default: null 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true  // createdAt & updatedAt automatic
});

// Indexes for faster queries
announcementSchema.index({ priority: 1, createdAt: -1 });
announcementSchema.index({ pinned: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);