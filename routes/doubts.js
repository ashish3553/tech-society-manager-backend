// server/routes/doubts.js
const express = require('express');
const router = express.Router();
const Doubt = require('../models/Doubt');
const Assignment = require('../models/Assignments'); // Adjust file name if needed
const auth = require('../middleware/auth');
const permit = require('../middleware/permit');

// POST /api/doubts
// Create a new doubt (for students/volunteers)
router.post('/', auth, permit('student', 'volunteer'), async (req, res) => {
  const { assignmentId, doubtText } = req.body;
  if (!assignmentId || !doubtText) {
    return res.status(400).json({ msg: 'Assignment ID and doubt text are required.' });
  }
  try {
    const newDoubt = new Doubt({
      assignment: assignmentId,
      student: req.user.id,
      doubtText,
      resolved: false
    });
    const savedDoubt = await newDoubt.save();
    res.json(savedDoubt);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/doubts
// For students/volunteers: returns only doubts they have raised.
// For mentors/admins: returns all doubts (optionally filtered via query parameters).
router.get('/', auth, permit('student', 'volunteer', 'mentor', 'admin'), async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'student' || req.user.role === 'volunteer') {
      filter.student = req.user.id;
    }
    // Optional filtering by assignmentId or resolved status if provided.
    if (req.query.assignmentId) {
      filter.assignment = req.query.assignmentId;
    }
    if (req.query.resolved) {
      filter.resolved = req.query.resolved === 'true';
    }
    const doubts = await Doubt.find(filter)
      .populate('student', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('assignment', 'title difficulty assignmentTag');
    res.json(doubts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/doubts/filter-doubts
// Filter doubts by assignment details. For students/volunteers, restrict to their own doubts.
router.get('/filter-doubts', auth, permit('student', 'volunteer', 'mentor', 'admin'), async (req, res) => {
  try {
    let assignmentFilter = {};
    if (req.query.assignmentTag) {
      assignmentFilter.assignmentTag = req.query.assignmentTag;
    }
    if (req.query.difficulty) {
      assignmentFilter.difficulty = req.query.difficulty;
    }
    if (req.query.assignmentTitle) {
      assignmentFilter.title = { $regex: req.query.assignmentTitle, $options: "i" };
    }
    // Query assignments matching these filters.
    const assignments = await Assignment.find(assignmentFilter, '_id');
    const assignmentIds = assignments.map(a => a._id);
    let doubtFilter = { assignment: { $in: assignmentIds } };
    if (req.query.resolved) {
      doubtFilter.resolved = req.query.resolved === 'true';
    }
    if (req.user.role === 'student' || req.user.role === 'volunteer') {
      doubtFilter.student = req.user.id;
    }
    const doubts = await Doubt.find(doubtFilter)
      .populate('student', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('assignment', 'title difficulty assignmentTag tags')
      .sort({ createdAt: -1 });
    res.json(doubts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/doubts/:id
// Get details for a single doubt. For students/volunteers, ensure they are the one who raised it.
router.get('/:id', auth, permit('student', 'volunteer', 'mentor', 'admin'), async (req, res) => {
  try {
    const doubt = await Doubt.findById(req.params.id)
      .populate('student', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('assignment', 'title difficulty assignmentTag');
    if (!doubt) {
      return res.status(404).json({ msg: 'Doubt not found' });
    }
    if (req.user.role === 'student' || req.user.role === 'volunteer') {
      let studentId = "";
      if (typeof doubt.student === 'object' && doubt.student !== null && doubt.student._id) {
        studentId = doubt.student._id.toString();
      } else {
        studentId = String(doubt.student);
      }
      if (studentId !== String(req.user.id)) {
        return res.status(403).json({ msg: 'Unauthorized to view this doubt' });
      }
    }
    res.json(doubt);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// PUT /api/doubts/:id/reply
// Mentor/Admin replies to a doubt and marks it as resolved.
router.put('/:id/reply', auth, permit('mentor', 'admin'), async (req, res) => {
  const { reply } = req.body;
  if (!reply || reply.trim() === '') {
    return res.status(400).json({ msg: 'Reply message is required.' });
  }
  try {
    let doubt = await Doubt.findById(req.params.id);
    if (!doubt) {
      return res.status(404).json({ msg: 'Doubt not found' });
    }
    doubt.reply = reply;
    doubt.resolved = true;
    doubt.resolvedAt = new Date();
    doubt.resolvedBy = req.user.id;
    doubt = await doubt.save();
    res.json(doubt);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
