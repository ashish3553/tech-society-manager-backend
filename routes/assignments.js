// server/routes/assignments.js
const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignments'); // Adjust file name if needed
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const Doubt = require('../models/Doubt');
const permit = require('../middleware/permit');

// Configure Cloudinary (assumes your .env has correct values)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

/*
  ============================
  ASSIGNMENT CREATION / EDITING
  ============================
*/

// POST /api/assignments
// Create an Assignment – Allowed for mentor and admin only.
router.post('/', auth, permit('mentor', 'admin'), upload.any(), async (req, res) => {
  console.log("Request body (should contain text fields):", req.body);
  const { title, explanation, testCases, solution, codingPlatformLink, difficulty, tags, type, assignmentTag, assignedTo } = req.body;
  
  if (!title) {
    return res.status(400).json({ msg: 'Title is required' });
  }
  
  let assignedToIds = [];
  if (type === 'personal') {
    if (!assignedTo) {
      return res.status(400).json({ msg: 'Personal assignments must include assignedTo field.' });
    }
    const identifiers = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    const students = await User.find({
      $or: [
        { email: { $in: identifiers } },
        { name: { $in: identifiers } }
      ]
    });
    if (!students || students.length === 0) {
      return res.status(400).json({ msg: 'No matching students found for the provided identifiers.' });
    }
    assignedToIds = students.map(student => student._id);
  }
  
  try {
    const newAssignment = new Assignment({
      title,
      explanation,
      testCases,
      solution,
      codingPlatformLink,
      difficulty,
      tags,
      // Map the "type" field to the schema's category field:
      category: type === 'personal' ? 'personal' : 'public',
      assignmentTag: assignmentTag || 'practice',
      assignedBy: req.user.id,
      assignedTo: type === 'personal' ? assignedToIds : []
    });
    const savedAssignment = await newAssignment.save();
    res.json(savedAssignment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/*
  ============================
  ASSIGNMENT FETCHING
  ============================
*/

// GET /api/assignments/general
// Get general (public) assignments – available for all authenticated users.
router.get('/general', auth, async (req, res) => {
  try {
    const assignments = await Assignment.find({ category: 'public' }).populate('assignedBy');
    res.json(assignments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/assignments/personal
// For students (or volunteers) – show assignments assigned to them;
// For mentors – show assignments created by them (optionally filtered by a student).
router.get('/personal', auth, async (req, res) => {
    try {
      let filter = { type: 'personal' }; // Ensure that your schema uses 'type' or update accordingly.
      if (req.user.role === 'student' || req.user.role === 'volunteer') {
        filter.assignedTo = req.user.id;
      } else if (req.user.role === 'mentor') {
        filter.assignedBy = req.user.id;
        if (req.query.studentId) {
          filter.assignedTo = req.query.studentId;
        }
      }
  
      // Populate the 'assignedBy' field so that it returns an object with _id, name, and role.
      const assignments = await Assignment.find(filter)
        .populate('assignedBy', '_id name role');
  
      console.log("Sending info is", assignments);
      res.json(assignments);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });
  

// GET /api/assignments/practice
// Fetch assignments for the "Practice" section.
// This route now accepts a query parameter "assignmentTag" that can be a comma-separated list.
// If none is provided, it defaults to "practice,HW,CW".
router.get('/practice', auth, async (req, res) => {
  try {
    let filter = { category: 'public' };
    // Determine assignmentTag filter:
    let tags = req.query.assignmentTag;
    if (!tags) {
      tags = 'practice'; // default to all three if not provided
    }
    const tagsArr = tags.split(',').map(tag => tag.trim());
    filter.assignmentTag = { $in: tagsArr };

    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }
    if (req.query.tags) {
      const tagsArr2 = req.query.tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagsArr2 };
    }
    if (req.query.responseStatus) {
      filter.responses = {
        $elemMatch: {
          student: req.user.id,
          responseStatus: req.query.responseStatus
        }
      };
    }
    const assignments = await Assignment.find(filter).populate('assignedBy');
    res.json(assignments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/assignments/pending
// Returns public assignments that have not been solved by the logged-in student or volunteer.
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student' && req.user.role !== 'volunteer') {
      return res.status(403).json({ msg: 'Only students or volunteers can view pending assignments.' });
    }
    const assignments = await Assignment.find({ category: 'public' }).sort({ createdAt: -1 });
    const pendingAssignments = assignments.filter((assignment) => {
      const response = assignment.responses.find(resp => String(resp.student) === String(req.user.id));
      return !response || response.responseStatus !== 'solved';
    });
    res.json(pendingAssignments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/assignments/:id
// Fetch a single assignment by its ID – allowed for all authenticated users.
// If the user is a student or volunteer, ensure that they have permission to view (if personal assignment).
router.get('/:id', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id).populate('assignedBy');
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found' });
    }
    // For personal assignments, if the user is a student or volunteer, check assignment membership.
    if ((req.user.role === 'student' || req.user.role === 'volunteer') && assignment.type === 'personal') {
      const isAssigned = assignment.assignedTo.map(String).includes(String(req.user.id));
      if (!isAssigned) {
        return res.status(403).json({ msg: 'Not authorized to view this assignment' });
      }
    }
    res.json(assignment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/*
  ============================
  ASSIGNMENT RESPONSE / DOUBT
  ============================
*/

// PUT /api/assignments/:id/status
// For updating a student's (or volunteer's) response to an assignment.
// Allowed for roles: student and volunteer.
router.put('/:id/status', auth, permit('student', 'volunteer'), async (req, res) => {
  const { responseStatus, submissionUrl, screenshots, learningNotes } = req.body;
  if (responseStatus === "solved") {
    if (!submissionUrl || submissionUrl.trim() === "") {
      return res.status(400).json({ msg: "For 'solved' status, a submissionUrl is required as proof." });
    }
  } else {
    if (!learningNotes || learningNotes.trim() === "") {
      return res.status(400).json({ msg: "For statuses other than 'solved', please provide a problem description in learningNotes." });
    }
  }
  try {
    let assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found' });
    }
    if (assignment.type === 'personal') {
      const isAssigned = assignment.assignedTo.map(String).includes(String(req.user.id));
      if (!isAssigned) {
        return res.status(403).json({ msg: 'Not authorized for this assignment' });
      }
    }
    const responseIndex = assignment.responses.findIndex(
      (resp) => String(resp.student) === String(req.user.id)
    );
    const updatedResponse = {
      student: req.user.id,
      responseStatus,
      submissionUrl: submissionUrl || "",
      screenshots: screenshots || [],
      learningNotes: learningNotes || ""
    };
    if (responseIndex === -1) {
      assignment.responses.push(updatedResponse);
    } else {
      assignment.responses[responseIndex] = updatedResponse;
    }
    assignment = await assignment.save();
    // If responseStatus is not "solved", create or update a Doubt.
    if (responseStatus !== 'solved') {
      const existingDoubt = await Doubt.findOne({
        assignment: req.params.id,
        student: req.user.id,
        resolved: false
      });
      if (existingDoubt) {
        existingDoubt.doubtText = learningNotes;
        existingDoubt.responseStatus = responseStatus;
        await existingDoubt.save();
      } else {
        const newDoubt = new Doubt({
          assignment: req.params.id,
          student: req.user.id,
          doubtText: learningNotes,
          responseStatus: responseStatus,
          resolved: false
        });
        await newDoubt.save();
      }
    }
    res.json(assignment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// PUT /api/assignments/:id/upload
// Allows a student/volunteer to upload screenshots and learning notes.
// Allowed for roles: student and volunteer.
router.put('/:id/upload', auth, permit('student', 'volunteer'), async (req, res) => {
  const { screenshots, learningNotes } = req.body;
  try {
    let assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found' });
    }
    const responseIndex = assignment.responses.findIndex(
      (resp) => String(resp.student) === String(req.user.id)
    );
    if (responseIndex === -1) {
      assignment.responses.push({
        student: req.user.id,
        responseStatus: 'solved', // Mark as solved upon uploading proof
        screenshots: screenshots,
        learningNotes: learningNotes
      });
    } else {
      assignment.responses[responseIndex].responseStatus = 'solved';
      assignment.responses[responseIndex].screenshots = screenshots;
      assignment.responses[responseIndex].learningNotes = learningNotes;
    }
    assignment = await assignment.save();
    res.json(assignment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/assignments/pending-hw
// Returns public assignments of category 'hw' that have not been solved by the student/volunteer.
router.get('/pending-hw', auth, permit('student', 'volunteer'), async (req, res) => {
  try {
    const assignments = await Assignment.find({ category: 'hw' });
    const pendingAssignments = assignments.filter((assignment) => {
      const response = assignment.responses.find(resp => String(resp.student) === String(req.user.id));
      return !response || response.responseStatus !== 'solved';
    });
    res.json(pendingAssignments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// POST /api/assignments/:id/doubt
// Allow a student/volunteer to post a doubt for an assignment.
router.post('/:id/doubt', auth, permit('student', 'volunteer'), async (req, res) => {
  const { doubtText } = req.body;
  try {
    let assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found' });
    }
    const newDoubt = new Doubt({
      assignment: assignment._id,
      student: req.user.id,
      doubtText,
    });
    const savedDoubt = await newDoubt.save();
    res.json(savedDoubt);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// POST /api/assignments/:id/upload-file
// Upload a screenshot file to Cloudinary and add the URL to the assignment's screenshots array.
// Allowed for roles: student, volunteer.
router.post('/:id/upload-file', auth, permit('student', 'volunteer'), upload.single('screenshot'), async (req, res) => {
  try {
    let assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found' });
    }
    // (Assuming a check on assignment.responseStatus is not needed here,
    // or modify as per your logic)
    if (assignment.type === 'personal' && String(assignment.assignedTo) !== String(req.user.id)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'assignments_screenshots' },
      async (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return res.status(500).json({ msg: 'Cloudinary upload failed', error });
        }
        assignment.screenshots.push(result.secure_url);
        assignment = await assignment.save();
        res.json(assignment);
      }
    );
    stream.end(req.file.buffer);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/*
  ============================
  SOLUTION & VISIBILITY (Mentor/Admin Only)
  ============================
*/

// PUT /api/assignments/:id/solution
// Allows mentor or admin to add/update a solution.
router.put('/:id/solution', auth, permit('mentor', 'admin'), async (req, res) => {
  if (!req.body.solution || req.body.solution.trim() === "") {
    return res.status(400).json({ msg: 'Solution content is required.' });
  }
  try {
    let assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found' });
    }
    assignment.solution = req.body.solution;
    assignment = await assignment.save();
    res.json(assignment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// PUT /api/assignments/:id/solution-visibility
// Allows mentor/admin to toggle solution visibility.
router.put('/:id/solution-visibility', auth, permit('mentor', 'admin'), async (req, res) => {
  console.log("Solution change hona hai");
  if (req.body.solutionVisible === undefined) {
    return res.status(400).json({ msg: 'solutionVisible is required.' });
  }
  try {
    let assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found' });
    }
    assignment.solutionVisible = req.body.solutionVisible;
    assignment = await assignment.save();
    res.json(assignment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/assignments/
// Returns public assignments filtered by query parameters.
router.get('/', auth, async (req, res) => {
  try {
    const filter = { category: 'public' };
    if (req.query.assignmentTag) {
      filter.assignmentTag = req.query.assignmentTag;
    }
    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }
    if (req.query.tags) {
      const tagsArr = req.query.tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagsArr };
    }
    if (req.query.responseStatus) {
      filter.responses = {
        $elemMatch: {
          student: req.user.id,
          responseStatus: req.query.responseStatus
        }
      };
    }
    const assignments = await Assignment.find(filter).populate('assignedBy');
    res.json(assignments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
 