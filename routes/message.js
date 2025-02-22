const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const auth = require('../middleware/auth');
const permit = require('../middleware/permit');
const User = require('../models/User');
const sendEmail = require('../utils/mailer'); // Import the Mailjet mailer






// POST /messages/announcement
router.post('/announcement',auth,permit('admin','mentor'), async (req, res) => {
  try {
    const { subject, body, links } = req.body;
    const announcement = new Message({
      subject,
      body,
      links,
      sender: req.user.id,
      isPublic: true,
      isAnnouncement: true
    });
    await announcement.save();
    res.status(201).json(announcement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create announcement.' });
  }
});

// GET /messages/announcement
// Returns at most the 2 most recent announcements
router.get('/announcement', async (req, res) => {
  try {
    const announcements = await Message.find({ isAnnouncement: true })
      .sort({ createdAt: -1 })
      .limit(3);
    res.json(announcements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load announcements.' });
  }
});

// POST /api/messages - Create a new message
router.post('/', auth, permit('student', 'volunteer', 'mentor', 'admin'), async (req, res) => {
  const { subject, body, isPublic, recipients, links } = req.body;

  if (!subject || !body) {
    return res.status(400).json({ msg: 'Subject and body are required.' });
  }

  let recipientIds = [];
  if (!isPublic) {
    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ msg: 'Personal messages must include recipients.' });
    }
    // Now assuming recipients is an array of ObjectIds.
    const users = await User.find({ _id: { $in: recipients } });
    if (!users || users.length === 0) {
      return res.status(400).json({ msg: 'No matching recipients found.' });
    }
    recipientIds = users.map(user => user._id);
  }

  try {
    const newMessage = new Message({
      subject,
      body,
      links: links ? (Array.isArray(links) ? links : [links]) : [],
      sender: req.user.id,
      isPublic,
      // For public messages, leave recipients empty (they’ll be rendered as “Global”)
      recipients: isPublic ? [] : recipientIds
    });
    const savedMessage = await newMessage.save();

    // If a mentor or admin sends a personal message, send email notifications.
    if (!isPublic && recipientIds.length > 0 && (req.user.role === 'mentor' || req.user.role === 'admin')) {
      const recipientUsers = await User.find({ _id: { $in: recipientIds } });
      const recipientEmails = recipientUsers.map(user => user.email).join(', ');
      const emailSubject = `New Personal Message from ${req.user.name}`;
      const emailText = `You have received a new personal message.\n\nSubject: ${savedMessage.subject}\n\nPlease log in to view the message.`;

      await sendEmail({
        to: recipientEmails,
        subject: emailSubject,
        text: emailText,
      });
      console.log("Personal message email sent successfully.");
    }

    res.json(savedMessage);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});
  

// GET /api/messages/public - Get all public messages
router.get('/public', async (req, res) => {
  try {
    const messages = await Message.find({ isPublic: true })
      .populate('sender', 'name email role')
      .sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/messages/personal - Get personal messages for the logged-in student
router.get('/personal', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      isPublic: false,
      recipients: req.user.id
    })
      .populate('sender', 'name email role')
      .sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/messages/all - Get all messages with filtering (for mentors/admins)
router.get('/all', auth, permit('mentor', 'admin'), async (req, res) => {
  try {
    let filter = {};
    // Optional: Filter by sender if query parameter provided (e.g., ?sender=someUserId)
    if (req.query.sender) {
      filter.sender = req.query.sender;
    }
    // Optional: Filter by isPublic (e.g., ?isPublic=true or ?isPublic=false)
    if (req.query.isPublic) {
      filter.isPublic = req.query.isPublic === 'true';
    }
    const messages = await Message.find(filter)
      .populate('sender', 'name email role')
      .sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Update an announcement
router.put('/announcement/:id', auth,permit('admin','mentor'), async (req, res) => {
  try {
    console.log("Ann me aaya hau",req.body);
    const announcement = await Message.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found.' });
    }

    // Optionally: check if req.user.role is 'mentor' or 'admin'
    if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    // Update fields (you may also allow updating links if needed)
    announcement.subject = req.body.subject || announcement.subject;
    announcement.body = req.body.body || announcement.body;
    if (req.body.links) announcement.links = req.body.links;
    
    await announcement.save();
    res.json(announcement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update announcement.' });
  }
});

// Delete an announcement
router.delete('/announcement/:id',auth,permit('admin','mentor'), async (req, res) => {
  try {
    console.log("Came here ");
    const announcement = await Message.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found.' });
    }

    // Optionally: check if req.user.role is 'mentor' or 'admin'
    if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    await announcement.deleteOne();
    res.json({ message: 'Announcement deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete announcement.' });
  }
});

// PUT /api/messages/:id - Update an existing message (allowed for mentor and admin)
router.put('/:id', auth, permit('mentor', 'admin'), async (req, res) => {
  const { subject, body, isPublic, recipients, links } = req.body;
  try {
    let message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    // Update fields if provided; you can decide if you want to allow partial updates
    message.subject = subject || message.subject;
    message.body = body || message.body;
    if (typeof isPublic !== 'undefined') {
      message.isPublic = isPublic;
    }
    // For personal messages, update recipients if provided.
    if (!isPublic && recipients) {
      // Assume recipients is an array of emails.
      const users = await User.find({ email: { $in: recipients } });
      message.recipients = users.map(user => user._id);
    } else if (isPublic) {
      message.recipients = [];
    }
    // Update links: split string to array if provided.
    if (links) {
      message.links = Array.isArray(links) ? links : links.split(',').map(link => link.trim()).filter(link => link);
    }

    const updatedMessage = await message.save();
    res.json(updatedMessage);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/messages/recent-mentor - Get three recent public messages sent by mentors (public route)
router.get('/recent-mentor', async (req, res) => {
    try {
      // Find public messages and populate sender details
      const messages = await Message.find({ isPublic: true })
        .populate('sender', 'name email role')
        .sort({ createdAt: -1 })
        .limit(10); // Fetch more messages and then filter in code
      // Filter messages whose sender has role 'mentor'
      const mentorMessages = messages.filter(
        msg => msg.sender && msg.sender.role.toLowerCase() === 'mentor'
      ).slice(0, 3);
      res.json(mentorMessages);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });


  router.get('/allForStudent', auth, async (req, res) => {
    try {
      console.log("allForStudent is being fetched");
      const messages = await Message.find({
        $or: [
          { sender: req.user.id },
          { recipients: req.user.id }
        ]
      })
        .populate('sender', 'name email role')
        .populate('recipients', 'name email role') // Ensure recipients are populated
        .sort({ createdAt: -1 });
        console.log("Here is all:",messages);
      res.json(messages);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });

  
// GET /api/messages/allForMentor - For mentors/admins: Retrieve all personal messages sent or received by them.
router.get('/allForMentor', auth, permit('mentor', 'admin'), async (req, res) => {
  try {
    const messages = await Message.find({
      isPublic: false, // Only personal messages
      $or: [
        { sender: req.user.id },
        { recipients: req.user.id }
      ]
    })
      .populate('sender', 'name email role')
      .populate('recipients', 'name email role')
      .sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});
  

// DELETE /api/messages/:id - Delete an existing message (allowed for admin only)
router.delete('/:id', auth, permit('admin'), async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }
    await message.remove();
    res.json({ msg: 'Message deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/messages/:id - Get message details by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate('sender', 'name email role')
      .populate('recipients', 'name email role');
    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }
    res.json(message);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
