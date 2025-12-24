const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// API Routes (must come BEFORE static files)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/attempt', require('./routes/attempt'));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// HTML Routes - serve HTML files for specific routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/create-quiz', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/create-quiz.html'));
});

app.get('/quiz/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/take-quiz.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Open your browser and go to: http://localhost:${PORT}`);
});
