// server/routes/dashboard.js
const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignments');
const Doubt = require('../models/Doubt');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');
const permit = require('../middleware/permit');

/**
 * GET /api/dashboard/mentor
 * 
 * Returns mentor-specific statistics:
 * - totalQuestionsCreated: Number of assignments created by the mentor.
 * - totalDoubtsReplied: Number of doubts the mentor has replied to (i.e. resolved where resolvedBy equals mentor).
 * - totalPersonalMessagesSent: Number of personal messages sent by the mentor.
 * 
 * Accessible to mentors and admins.
 */
router.get('/mentor', auth, permit('mentor', 'admin'), async (req, res) => {
  try {
    const mentorId = req.user.id;
    
    // Count total questions (assignments) created by the mentor
    const totalQuestionsCreated = await Assignment.countDocuments({ assignedBy: mentorId });
    
    // Count total doubts replied by the mentor.
    // We assume a doubt is "replied" if it is marked resolved and has a non-empty reply, and resolvedBy equals mentorId.
    const totalDoubtsReplied = await Doubt.countDocuments({
      resolved: true,
      resolvedBy: mentorId
    });
    
    // Count total personal messages sent by the mentor (i.e. messages that are not public)
    const totalPersonalMessagesSent = await Message.countDocuments({
      sender: mentorId,
      isPublic: false
    });
    
    res.json({
      totalQuestionsCreated,
      totalDoubtsReplied,
      totalPersonalMessagesSent
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * GET /api/dashboard/admin
 * 
 * Returns admin-specific aggregated statistics:
 * - totalStudents: Number of users with role "student".
 * - totalMentors: Number of users with role "mentor".
 * - totalVolunteers: Number of users with role "volunteer".
 * - totalQuestions: Total number of assignments (questions) in the system.
 * - totalMessages: Total number of messages.
 * - totalDoubts: Total number of doubts.
 * 
 * Accessible only to admins.
 */
router.get('/admin', auth, permit('admin'), async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalMentors = await User.countDocuments({ role: 'mentor' });
    const totalVolunteers = await User.countDocuments({ role: 'volunteer' });
    const totalQuestions = await Assignment.countDocuments();
    const totalMessages = await Message.countDocuments();
    const totalDoubts = await Doubt.countDocuments();
    
    res.json({
      totalStudents,
      totalMentors,
      totalVolunteers,
      totalQuestions,
      totalMessages,
      totalDoubts
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * GET /api/dashboard/student
 * 
 * (Optional) Returns student-specific statistics:
 * - solvedCount: Number of assignments (general or personal) that the student has marked as solved.
 * - totalDoubts: Total number of doubts raised by the student.
 * - resolvedDoubts: Number of doubts raised by the student that have been resolved.
 * 
 * Accessible only to students.
 */
router.get('/student', auth, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ msg: 'Not authorized' });
  }
  try {
    const solvedCount = await Assignment.countDocuments({
      $or: [
        { type: 'general' },
        { type: 'personal', assignedTo: req.user.id }
      ],
      responseStatus: 'solved'
    });
    const totalDoubts = await Doubt.countDocuments({ student: req.user.id });
    const resolvedDoubts = await Doubt.countDocuments({ student: req.user.id, resolved: true });
    res.json({
      solvedCount,
      totalDoubts,
      resolvedDoubts
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
