// server/models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  body: { type: String, required: true },
  // New field: an array of URL strings.
  links: [{ type: String }],
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // For personal messages, recipients are specified; for public messages, this can be empty.
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
