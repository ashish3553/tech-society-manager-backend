const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
// server/server.js (snippet)






const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
// Optionally add URL-encoded middleware if you expect form data besides files:
app.use(express.urlencoded({ extended: false }));

console.log("hii");
// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Define a test route
app.get('/', (req, res) => {
    console.log("hii");
  res.send('Welcome to the Coding Journey Platform API');
});

// Routes
const contactRoutes = require('./routes/contact');
const authRoutes = require('./routes/auth');         // For login/register endpoints
const AssignmentRoutes = require('./routes/assignments'); // Contains Cloudinary file upload integration
const doubtRoutes = require('./routes/doubts');         // Endpoints for handling doubts
const dashboardRoutes = require('./routes/dashboard');   // Dashboard endpoints for students and mentors
const userRoutes = require('./routes/users');           // Admin functions (add/remove student, etc.)
const dailyBriefingRoutes = require('./routes/dailyBriefing');
const messageRoutes = require('./routes/message');






// Use the routes with appropriate base paths
app.use('/api/auth', authRoutes);
app.use('/api/assignments', AssignmentRoutes);
app.use('/api/doubts', doubtRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dailyBriefing', dailyBriefingRoutes); 
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/contact', contactRoutes);


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 
