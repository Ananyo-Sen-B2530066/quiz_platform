const multer = require('multer');

// Store files in memory as Buffer
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'audio/mpeg', 'audio/wav'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, videos, and audio files are allowed.'), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;