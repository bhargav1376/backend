// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');

const app = express();

// middlewares
app.use(cors({
  origin: process.env.CLIENT_URL, // e.g. http://localhost:3000 or your React URL
  credentials: true,
}));
app.use(express.json());

// routes
app.use('/api/auth', authRoutes);

// DB connect and start server
const PORT = process.env.PORT || 5000;

connectDB();

app.get('/', (req, res) => {
  res.send('Auth backend running ✅');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
