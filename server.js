// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();

// ====== MIDDLEWARES ======
app.use(cors()); // for dev: allow all origins
app.use(express.json());

// ====== MONGODB CONNECTION ======
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected ✅'))
  .catch((err) => {
    console.error('MongoDB connection error ❌', err.message);
  });

// ====== USER MODEL ======
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpiresAt: Date,
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

// ====== EMAIL TRANSPORT (OTP) ======
const transporter = nodemailer.createTransport({
  service: 'gmail', // if not Gmail, use host/port/secure instead
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

async function sendOtpEmail(email, otp, subject) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject,
    text: `Your OTP is: ${otp}`,
  });
}

// ====== ROUTES ======

// Simple test route
app.get('/', (req, res) => {
  res.send('Auth backend is running ✅');
});

// --- SIGNUP: POST /api/auth/signup ---
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await User.create({
      name,
      email,
      password: hashed,
      isVerified: false,
      otp,
      otpExpiresAt,
    });

    await sendOtpEmail(email, otp, 'Signup OTP - Verify your email');

    res.json({ message: 'Signup successful. OTP sent to email.' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- VERIFY SIGNUP OTP: POST /api/auth/verify-signup-otp ---
app.post('/api/auth/verify-signup-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error('Verify signup OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- LOGIN (step 1): POST /api/auth/login ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.isVerified) {
      return res.status(400).json({ message: 'Email not verified' });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail(email, otp, 'Login OTP');

    res.json({ message: 'Login OTP sent to email' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- LOGIN OTP VERIFY (step 2): POST /api/auth/verify-login-otp ---
app.post('/api/auth/verify-login-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Verify login OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- FORGOT PASSWORD (send OTP): POST /api/auth/forgot-password ---
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail(email, otp, 'Password Reset OTP');

    res.json({ message: 'Password reset OTP sent to email' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- RESET PASSWORD (with OTP): POST /api/auth/reset-password ---
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ====== START SERVER ======
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
