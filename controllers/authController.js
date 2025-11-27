// controllers/authController.js
const User = require("../models/User");
const transporter = require("../config/mailer");
const { generateOtp } = require("../config/otp");

// Send email
async function sendOtpEmail(email, otp, subject) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject,
    html: `<h2>Your OTP is: <b>${otp}</b></h2>`
  });
}

// -------------------- SIGNUP --------------------
exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let user = await User.findOne({ email });

    if (user && user.isVerified)
      return res.status(400).json({ message: "Email already exists" });

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

    await sendOtpEmail(email, otp, "Signup OTP");

    res.json({ message: "OTP sent to email" });

  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// -------------------- VERIFY SIGNUP OTP --------------------
exports.verifySignupOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    if (otp !== user.otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.otpExpire < Date.now())
      return res.status(400).json({ message: "OTP expired" });

    user.otp = null;
    user.otpExpire = null;
    user.isVerified = true;

    await user.save();

    res.json({ message: "Email verified successfully" });

  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// -------------------- LOGIN --------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user)
      return res.status(400).json({ message: "User not found" });

    if (!user.isVerified)
      return res.status(400).json({ message: "Please verify your email first" });

    if (user.password !== password)
      return res.status(400).json({ message: "Incorrect password" });

    res.json({ message: "Login successful" });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// -------------------- FORGOT PASSWORD --------------------
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendOtpEmail(email, otp, "Reset Password OTP");

    res.json({ message: "OTP sent to email" });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// -------------------- RESET PASSWORD --------------------
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    if (otp !== user.otp)
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
};
