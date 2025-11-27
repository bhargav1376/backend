// routes/authRoutes.js
const express = require("express");
const router = express.Router();

const {
  signup,
  verifySignupOtp,
  login,
  forgotPassword,
  resetPassword
} = require("../controllers/authController");

router.post("/signup", signup);
router.post("/verify-otp", verifySignupOtp);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
