// server/routes/upload.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const router = express.Router();

// Configure Cloudinary (ensure your .env has these variables)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer();

router.post('/', upload.single('file'), (req, res) => {
    console.log("waiting image 1");
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded.' });
  }
  
  console.log("waiting image 2");

  const uploadStream = cloudinary.uploader.upload_stream(
    { folder: 'solutions' },
    (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error); 
        return res.status(500).json({ msg: 'Image upload failed.' });
      }
      res.json({ url: result.secure_url }); 
    }
  );
  
  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
});

module.exports = router;
