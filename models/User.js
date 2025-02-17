// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  branch: String,
  year: String,
  profileImage: String,
  role: { type: String, default: 'student' },
  isVerified: { type: Boolean, default: false },
  verificationOTP: String,  
  passwordResetOTP: { type: String },
  passwordResetExpires: { type: Date },     // new field to store OTP
  otpExpires: Date                  // new field to store OTP expiry time
});

module.exports = mongoose.model('User', UserSchema);
