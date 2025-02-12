// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Multer and Cloudinary configuration:
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary (ensure your .env has CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });



// Register a new user
// POST /api/auth/register
// This route will accept a multipart/form-data request.
// Fields expected: name, email, password, branch, year, and optionally a file field named "profileImage"
router.post('/register', upload.single('profileImage'), async (req, res) => {
    const { name, email, password, branch, year } = req.body;
    
    try {
      console.log("Registration request received");
      // Check if user already exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ msg: 'User already exists' });
      }
    
      let profileImageUrl = '';
      
      // Log file info for debugging
      if (req.file) {
        console.log("Received file:", req.file);

        // upload sream process is here 
        const uploadStream = () => {
          return new Promise((resolve, reject) => {
            let stream = cloudinary.uploader.upload_stream(
              { folder: 'profile_images' },
              (error, result) => {
                if (result) {
                  console.log("Cloudinary upload result:", result);
                  resolve(result.secure_url);
                } else {
                  console.error("Cloudinary upload error:", error);
                  reject(error);
                }
              }
            );
            streamifier.createReadStream(req.file.buffer).pipe(stream);
          });
        };
    
        try {
          profileImageUrl = await uploadStream();
        } catch (err) {
          console.error('Cloudinary upload failed:', err);
          profileImageUrl = process.env.DEFAULT_PROFILE_IMAGE || 'https://res.cloudinary.com/your_cloud_name/image/upload/v0000000000/default_profile.png';
        }
      } else {
        console.log("No file uploaded; using default profile image.");
        profileImageUrl = process.env.DEFAULT_PROFILE_IMAGE || 'https://res.cloudinary.com/your_cloud_name/image/upload/v0000000000/default_profile.png';
      }
    
      // Create new user with default role "student"
      user = new User({
        name,
        email,
        password,
        branch,
        year,
        profileImage: profileImageUrl,
        role: 'student'
      });
    
      // Hash password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    
      await user.save();
    
      // Sign JWT and return response
      const payload = { user: { id: user.id, role: user.role } };
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: 3600 },
        (err, token) => {
          if (err) throw err;
          res.json({
            token,
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              branch: user.branch,
              year: user.year,
              role: user.role,
              profileImage: user.profileImage
            }
          });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });


 


// Login an existing user
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });
  
      const payload = { user: { id: user.id, role: user.role } };
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: 36000 },
        (err, token) => {
          if (err) throw err;
          // Return token along with user details (excluding password)
          res.json({
            token,
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              branch: user.branch,
              year: user.year,
              role: user.role,
              profileImage: user.profileImage
            }
          });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });
  

module.exports = router;
