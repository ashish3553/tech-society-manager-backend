// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/mailer'); // Import the Mailjet mailer
// const crypto = require('crypto'); // for generating OTP    ---->   Random funstion has been used 
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();




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
// server/routes/auth.js

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
    if (req.file) {
      // ... (Cloudinary upload code remains unchanged) ...
    } else {
      console.log("No file uploaded; using default profile image.");
      profileImageUrl = process.env.DEFAULT_PROFILE_IMAGE || 'https://res.cloudinary.com/your_cloud_name/image/upload/v0000000000/default_profile.png';
    }
  
    // Create new user with default role "student" and isVerified false.
    user = new User({
      name,
      email,
      password,
      branch,
      year,
      profileImage: profileImageUrl,
      role: 'student',
      isVerified: false
    });
  
    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
  
    // Generate a 6-digit OTP (as string) and set expiry to 15 minutes later
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationOTP = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
  
    await user.save();

    // Send OTP email using your sendEmail function.
    const emailSubject = 'Your Email Verification Code';
    const emailText = `Your verification code is: ${otp}\nThis code will expire in 15 minutes.`;
    await sendEmail({
      to: user.email,
      subject: emailSubject,
      text: emailText,
    });
    console.log("OTP sent to:", user.email);
  
    // Instead of logging the user in immediately, respond with a message.
    // Optionally, you can also store the email in localStorage on the frontend.
    res.json({ msg: 'Registration successful! Please check your email for the verification code.' });
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


  // Verify email at the time of account creation
  // server/routes/auth.js
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Verification token is missing.');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Mark the user as verified
    await User.findByIdAndUpdate(decoded.userId, { isVerified: true });
    // Redirect or send a response indicating success
    res.send('Email verified successfully. You can now log in.');
  } catch (err) {
    console.error(err);
    res.status(400).send('Invalid or expired token.');
  }
});




  // This will accept email,generates link for reseting the password
  // server/routes/auth.js
  router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email is required.' });
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ msg: 'User with that email does not exist.' });
      }
      // Generate a 6-digit OTP and set expiry (15 minutes from now)
      const otp = generateOTP();
      user.passwordResetOTP = otp;
      user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
  
      // Send OTP email
      const emailSubject = 'Your Password Reset OTP';
      const emailText = `Your OTP for password reset is: ${otp}. It will expire in 15 minutes.`;
      await sendEmail({
        to: user.email,
        subject: emailSubject,
        text: emailText,
      });
      console.log("OTP sent to:", user.email);
      res.json({ msg: 'OTP sent to your email.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: 'Server error' });
    }
  });
  



// server/routes/auth.js
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ msg: 'Email, OTP, and new password are required.' });
  }
  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'User not found.' });
    
    // Check if the provided OTP matches and hasn't expired
    if (user.passwordResetOTP !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP.' });
    }
    if (user.passwordResetExpires < Date.now()) {
      return res.status(400).json({ msg: 'OTP has expired. Please request a new one.' });
    }
    
    // Hash the new password and update the user
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Clear the OTP fields
    user.passwordResetOTP = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    
    res.json({ msg: 'Password has been reset successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error.' });
  }
});


  // server/routes/auth.js
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ msg: 'Email and OTP are required.' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid email or OTP.' });
    }
    // Check if OTP matches and is not expired.
    if (user.verificationOTP !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP.' });
    }
    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ msg: 'OTP has expired. Please request a new one.' });
    }
    
    // Mark user as verified and clear OTP fields.
    user.isVerified = true;
    user.verificationOTP = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Optionally, sign a JWT here if you wish to log them in immediately.
    const payload = { user: { id: user._id, role: user.role } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 36000 },
      (err, token) => {
        if (err) throw err;
        res.json({
          msg: 'Email verified successfully!',
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
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});


  

module.exports = router;
