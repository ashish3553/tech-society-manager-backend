const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  type: { 
    type: String, 
    enum: ['doubt', 'reply', 'follow-up', 'resolve'], 
    required: true 
  }
});

const DoubtSchema = new mongoose.Schema({
  assignment: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Assignment', 
    required: true 
  },
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  conversation: { 
    type: [ConversationSchema], 
    default: [] 
  },
  currentStatus: { 
    type: String, 
    enum: ['new', 'replied', 'unsatisfied', 'review', 'resolved'],
    default: 'new' 
  },
  resolved: { 
    type: Boolean, 
    default: false 
  },
  resolvedAt: { 
    type: Date 
  },
  resolvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Doubt', DoubtSchema);
