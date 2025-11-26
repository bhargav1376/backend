// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },

  // For OTP
  otp: { type: String },
  otpExpiresAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
