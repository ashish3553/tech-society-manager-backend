const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();







const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
// Optionally add URL-encoded middleware if you expect form data besides files:
app.use(express.urlencoded({ extended: false }));

console.log("hii");
// Connect to MongoDB
const connectDB = async()=>{
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log('MongoDB database is connected') 
    } catch (err) {
        console. log('MongoDB database is connection failed', err)
    }
}

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
const uploadRoute = require('./routes/upload');
const solutionRoutes = require('./routes/solution');







console.log("Post yha aa gyi");

// Use the routes with appropriate base paths
app.use('/api/auth', authRoutes);
app.use('/api/solutions', solutionRoutes);
app.use('/api/assignments', AssignmentRoutes);

app.use('/api/doubts', doubtRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dailyBriefing', dailyBriefingRoutes); 
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/upload', uploadRoute);



const isDevelopment = 'production' !== 'production';
if (isDevelopment) {
    app.listen(PORT, () => {
        connectDB();
        console.log(`Server is running on port ${PORT}`);
    }); 
} else { 
    connectDB();
}


module.exports = app;
