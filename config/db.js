// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // options can be empty for latest mongoose
    });
    console.log('MongoDB connected ✅');
  } catch (err) {
    console.error('MongoDB connection error ❌', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
