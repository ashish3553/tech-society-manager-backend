const express = require('express');
const router = express.Router();
const Doubt = require('../models/Doubt');
const Assignment = require('../models/Assignments');
const auth = require('../middleware/auth');
const permit = require('../middleware/permit');
const User = require('../models/User');
const sendEmail = require('../utils/mailer');

// POST /api/doubts - Create a new doubt (for students/volunteers)
router.post('/', auth, permit('student', 'volunteer'), async (req, res) => {
  const { assignmentId, doubtText } = req.body;
  if (!assignmentId || !doubtText) {
    return res.status(400).json({ msg: 'Assignment ID and doubt text are required.' });
  }
  try {
    // Create a new doubt with an initial conversation entry
    const newDoubt = new Doubt({
      assignment: assignmentId,
      student: req.user.id,
      conversation: [{
        sender: req.user.id,
        message: doubtText,
        type: 'doubt'
      }],
      currentStatus: 'new',
      resolved: false
    });
    const savedDoubt = await newDoubt.save();
    res.json(savedDoubt);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/doubts - Get doubts (students/volunteers see only their own; mentors/admins see all)
router.get('/', auth, permit('student', 'volunteer', 'mentor', 'admin'), async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'student' || req.user.role === 'volunteer') {
      filter.student = req.user.id;
    }
    if (req.query.assignmentId) {
      filter.assignment = req.query.assignmentId;
    }
    if (req.query.resolved) {
      filter.resolved = req.query.resolved === 'true';
    }
    const doubts = await Doubt.find(filter)
      .populate('student', 'name email branch')
      .populate('resolvedBy', 'name email role')
      .populate('assignment', 'title difficulty assignmentTag tags explanation')
      .populate('conversation.sender', 'name role')
      .sort({ createdAt: -1 });
    res.json(doubts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/doubts/filter-doubts - Filter doubts by assignment details
// GET /api/doubts/filter-doubts - Filter doubts by assignment details
router.get('/filter-doubts', auth, permit('student', 'volunteer', 'mentor', 'admin'), async (req, res) => {
  try {
    // Build assignment-related filter if any assignment filter parameters are provided.
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
    let doubtFilter = {};
    // Only add assignment condition if any assignment filters were provided.
    if (Object.keys(assignmentFilter).length > 0) {
      const assignments = await Assignment.find(assignmentFilter, '_id');
      const assignmentIds = assignments.map(a => a._id);
      if (assignmentIds.length === 0) {
        return res.json({ total: 0, page: 1, limit: 10, doubts: [] });
      }
      doubtFilter.assignment = { $in: assignmentIds };
    }
    
    // Filter by resolved flag (if provided)
    if (req.query.resolved) {
      doubtFilter.resolved = req.query.resolved === 'true';
    }
    // Filter by current status (new, replied, unsatisfied, review, resolved)
    if (req.query.status) {
      // Use case-insensitive regex match for currentStatus
      doubtFilter.currentStatus = { $regex: new RegExp(`^${req.query.status}$`, "i") };
    }
    // Timeframe filtering (today or yesterday)
    if (req.query.timeframe) {
      const now = new Date();
      let start, end;
      if (req.query.timeframe === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      } else if (req.query.timeframe === 'yesterday') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
      doubtFilter.createdAt = { $gte: start, $lt: end };
    }
    
    // For students/volunteers, restrict doubts to those they raised.
    if (req.user.role === 'student' || req.user.role === 'volunteer') {
      doubtFilter.student = req.user.id;
    }
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const doubts = await Doubt.find(doubtFilter)
      .populate('student', 'name email branch')
      .populate('resolvedBy', 'name email role')
      .populate('assignment', 'title difficulty assignmentTag tags explanation')
      .populate('conversation.sender', 'name role')
      .sort({ updatedAt: -1 })  // Changed to sort by recent update
      .skip(skip)
      .limit(limit);
    
    const totalCount = await Doubt.countDocuments(doubtFilter);
    
    res.json({
      total: totalCount,
      page,
      limit,
      doubts
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// GET /api/doubts/:id - Get details for a single doubt (with conversation sorted ascending)
router.get('/:id', auth, permit('student', 'volunteer', 'mentor', 'admin'), async (req, res) => {
  try {
    let doubt = await Doubt.findById(req.params.id)
      .populate('student', 'name email branch')
      .populate('resolvedBy', 'name email role')
      .populate('assignment', 'title difficulty assignmentTag tags explanation')
      .populate('conversation.sender', 'name role');
    if (!doubt) {
      return res.status(404).json({ msg: 'Doubt not found' });
    }
    if (req.user.role === 'student' || req.user.role === 'volunteer') {
      const studentId = (typeof doubt.student === 'object' && doubt.student !== null && doubt.student._id)
        ? String(doubt.student._id)
        : String(doubt.student);
      if (studentId !== String(req.user.id)) {
        return res.status(403).json({ msg: 'Unauthorized to view this doubt' });
      }
    }
    // Sort conversation in ascending order so that the initial doubt appears first.
    doubt.conversation.sort((a, b) => a.timestamp - b.timestamp);
    res.json(doubt);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// PUT /api/doubts/:id/reply - Mentor/Admin replies to a doubt (updates status to "replied")
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
    // Save the original doubt text from the first conversation entry
    const originalDoubtText = doubt.conversation.length > 0 ? doubt.conversation[0].message : '';

    // Append mentor's reply to the conversation thread
    doubt.conversation.push({
      sender: req.user.id,
      message: reply,
      type: 'reply'
    });
    // Update currentStatus to "replied"
    doubt.currentStatus = 'replied';
    doubt = await doubt.save();

    // Send email notification to the student
    const studentUser = await User.findById(doubt.student);
    if (studentUser && studentUser.email) {
      const emailSubject = `Your doubt has been replied by ${req.user.name}`;
      const emailHtml = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #4CAF50;">Hello ${studentUser.name},</h2>
            <p>Your doubt regarding the assignment <strong>${doubt.assignment.title}</strong> has received a reply from <strong>${req.user.name}</strong>.</p>
            <h3 style="border-bottom: 1px solid #eee; padding-bottom: 5px;">Your Doubt</h3>
            <p style="margin-left: 10px;">${originalDoubtText}</p>
            <h3 style="border-bottom: 1px solid #eee; padding-bottom: 5px;">Mentor's Reply</h3>
            <p style="margin-left: 10px;">${reply}</p>
            <p>Regards,<br/><strong>Coding Journey Team</strong></p>
          </body>
        </html>
      `;
      const emailText = `
Hello ${studentUser.name},

Your doubt regarding the assignment ${doubt.assignment.title} has received a reply from ${req.user.name}.

Your Doubt:
${originalDoubtText}

Mentor's Reply:
${reply}

Regards,
Coding Journey Team
      `;
      await sendEmail({
        to: studentUser.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      });
    }
    res.json(doubt);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// PUT /api/doubts/:id/followup - Student asks a follow-up ("Ask Again")
router.put('/:id/followup', auth, permit('student', 'volunteer'), async (req, res) => {
  const { followup } = req.body;
  if (!followup || followup.trim() === '') {
    return res.status(400).json({ msg: 'Follow-up message is required.' });
  }
  try {
    let doubt = await Doubt.findById(req.params.id);
    if (!doubt) {
      return res.status(404).json({ msg: 'Doubt not found' });
    }
    if (String(doubt.student) !== String(req.user.id)) {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    // Append follow-up message to the conversation thread
    doubt.conversation.push({
      sender: req.user.id,
      message: followup,
      type: 'follow-up'
    });
    // Update currentStatus to "unsatisfied" (indicating need for review)
    doubt.currentStatus = 'unsatisfied';
    doubt = await doubt.save();
    res.json(doubt);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// PUT /api/doubts/:id/resolve - Student marks the doubt as resolved
router.put('/:id/resolve', auth, permit('student'), async (req, res) => {
  try {
    let doubt = await Doubt.findById(req.params.id);
    if (!doubt) {
      return res.status(404).json({ msg: 'Doubt not found' });
    }
    if (String(doubt.student) !== String(req.user.id)) {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    // Append a "resolve" entry
    doubt.conversation.push({
      sender: req.user.id,
      message: 'Resolved',
      type: 'resolve'
    });
    // Update currentStatus to "resolved" and mark as resolved
    doubt.currentStatus = 'resolved';
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
