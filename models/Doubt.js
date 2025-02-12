// server/models/Doubt.js
const mongoose = require('mongoose');

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
  doubtText: { 
    type: String, 
    required: true 
  },
  // Add a default value so that if no status is provided, it defaults to "not attempted"
  responseStatus: { 
    type: String, 
    required: true, 
    default: 'not attempted' 
  },
  reply: { 
    type: String, 
    default: '' 
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
