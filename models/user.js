// server/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['student', 'mentor', 'admin'], 
    default: 'student' 
  },
  branch: { 
    type: String 
  },
  year: { 
    type: Number 
  },
  profileImage: { 
    type: String, 
    default: '' 
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
