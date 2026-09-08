const multer = require('multer');

const path = require('path');

// Configure memory storage to receive file buffers
const storage = multer.memoryStorage();

// Set up file filter for allowed formats
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  const fileExt = path.extname(file.originalname || '').toLowerCase();
  const fileMime = (file.mimetype || '').toLowerCase();

  if (allowedMimeTypes.includes(fileMime) || allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed.'), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB limits
  },
  fileFilter: fileFilter
});

module.exports = upload;
