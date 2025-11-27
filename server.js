const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

// ------------------ FIXED CORS ------------------
const corsOptions = {
  origin: "*", 
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // IMPORTANT for preflight

app.use(express.json());

// ------------------ MONGODB CONNECT ------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✔"))
  .catch((err) => console.log("Mongo Error ❌", err));

// ------------------ USER MODEL ------------------
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  otp: String,
  otpExpire: Date,
  isVerified: { type: Boolean, default: false }
});

const User = mongoose.model("User", UserSchema);

// ------------------ EMAIL SETUP ------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// OTP generator
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// ---------------------------- SIGNUP ----------------------------
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let user = await User.findOne({ email });

    if (user && user.isVerified) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const otp = generateOtp();

    if (user) {
      user.name = name;
      user.password = password;
      user.otp = otp;
      user.otpExpire = Date.now() + 10 * 60 * 1000;
      await user.save();
    } else {
      await User.create({
        name,
        email,
        password,
        otp,
        otpExpire: Date.now() + 10 * 60 * 1000,
        isVerified: false
      });
    }

    await transporter.sendMail({
      to: email,
      subject: "Your Signup OTP",
      html: `<h2>Your OTP is: <b>${otp}</b></h2>`
    });

    res.json({ message: "OTP sent to email" });

  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------------------- VERIFY OTP ----------------------------
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found" });
    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
    if (user.otpExpire < Date.now()) return res.status(400).json({ message: "OTP expired" });

    user.isVerified = true;
    user.otp = null;
    user.otpExpire = null;
    await user.save();

    res.json({ message: "Email verified successfully ✔" });

  } catch (err) {
    console.error("OTP Verify Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------------------- LOGIN ----------------------------
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user)
      return res.status(400).json({ message: "User not found" });

    if (!user.isVerified)
      return res.status(400).json({ message: "Please verify your email first" });

    if (user.password !== password)
      return res.status(400).json({ message: "Incorrect password" });

    res.json({
      message: "Login Successful",
      user: {
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------------------- FORGOT PASSWORD ----------------------------
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    await transporter.sendMail({
      to: email,
      subject: "Password Reset OTP",
      html: `<h2>Your Password Reset OTP: <b>${otp}</b></h2>`
    });

    res.json({ message: "OTP sent to your email" });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------------------- RESET PASSWORD ----------------------------
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    if (user.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.otpExpire < Date.now())
      return res.status(400).json({ message: "OTP expired" });

    user.password = newPassword;
    user.otp = null;
    user.otpExpire = null;
    await user.save();

    res.json({ message: "Password reset successful" });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------------------- LOGOUT ----------------------------
app.post("/api/auth/logout", (req, res) => {
  return res.json({ message: "Logout successful" });
});

// ---------------------------- TEST ROUTE ----------------------------
app.get("/", (req, res) => {
  res.send("Auth Backend Running");
});

// Request Logger
app.use((req, res, next) => {
  console.log("➡ Incoming request:", req.method, req.url);
  next();
});

// ---------------------------- SERVER ----------------------------
const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Server running on port", port));
