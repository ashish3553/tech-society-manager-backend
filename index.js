const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://tech-society-manager.vercel.app', 'https://tech-society-manager-git-main-vivekkumar.vercel.app'] 
    : ['http://localhost:5173','http://localhost:5174', 'http://localhost:5001', 'http://127.0.0.1:5173'], // Common Vite development ports
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));


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

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
  });

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
const goalRoutes = require('./routes/goalRoutes');







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
app.use('/api/goals', goalRoutes);




const isDevelopment = process.env.NODE_ENV !== 'production';
if (isDevelopment) {
    // Connect to database before starting server
    connectDB().then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Access it at http://localhost:${PORT} or http://<your-ip-address>:${PORT}`);
        });
    }).catch(err => {
        console.error('Failed to connect to MongoDB:', err);
    });
} else { 
    connectDB().then(() => {
        console.log('Production mode: MongoDB connected');
    }).catch(err => {
        console.error('Production mode: Failed to connect to MongoDB:', err);
    });
}


// push krne se pahle production !== production and module.export krna hai

module.exports = app;
