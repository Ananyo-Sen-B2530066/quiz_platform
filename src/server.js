const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const os = require('os');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for correct IP addresses in production
app.set('trust proxy', 1);

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

app.get('/view-attempt/:attemptId', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/view-attempt.html'));
});

app.get('/edit-quiz/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'edit-quiz.html'));
});


// Health check endpoint for deployment platforms
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;

// Function to get local IP address (for development)
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log(`🚀 Server running on port ${PORT}`);
  
  if (isProduction) {
    console.log(`🌍 Production mode - accessible via your deployment URL`);
  } else {
    const localIP = getLocalIPAddress();
    console.log(`\n📱 Development Access URLs:`);
    console.log(`   Local:            http://localhost:${PORT}`);
    console.log(`   Network (LAN):    http://${localIP}:${PORT}`);
    console.log(`\n💡 Share the Network URL with other devices on the same WiFi\n`);
  }
});
