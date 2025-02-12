const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const auth = require('../middleware/auth');
const permit = require('../middleware/permit');
const User = require('../models/User');

// POST /api/messages - Create a new message (for mentors/admins)
router.post('/', auth, permit('student','volunteer','mentor', 'admin'), async (req, res) => {
    console.log("Message reach 1");
    const { subject, body, isPublic, recipients, links } = req.body;
    console.log(req.body);
  
    if (!subject || !body) {
      return res.status(400).json({ msg: 'Subject and body are required.' });
    }
    console.log("Message reach 2");
  
    let recipientIds = [];
    if (!isPublic) {
      if (!recipients || recipients.length === 0) {
        return res.status(400).json({ msg: 'Personal messages must include recipients.' });
      }
      
      // Determine whether to query by email or by _id
      let query;
      // If the first recipient includes an '@', assume emails; otherwise, assume IDs.
      if (typeof recipients[0] === 'string' && recipients[0].includes('@')) {
        query = { email: { $in: recipients } };
      } else {
        query = { _id: { $in: recipients } };
      }
  
      const users = await User.find(query);
      if (!users || users.length === 0) {
        return res.status(400).json({ msg: 'No matching recipients found.' });
      }
      recipientIds = users.map(user => user._id);
    }
  
    console.log("Message reach 3");
  
    try {
      const newMessage = new Message({
        subject,
        body,
        links: links ? (Array.isArray(links) ? links : [links]) : [],
        sender: req.user.id,
        isPublic,
        recipients: isPublic ? [] : recipientIds
      });
      const savedMessage = await newMessage.save();
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
      const messages = await Message.find({
        $or: [
          { sender: req.user.id },
          { recipients: req.user.id }
        ]
      })
        .populate('sender', 'name email role')
        .populate('recipients', 'name email role') // Ensure recipients are populated
        .sort({ createdAt: -1 });
      res.json(messages);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });


  // GET /api/messages/allForStudent - Retrieve all messages for a student (both sent and received)
router.get('/allForStudent', auth, async (req, res) => {
    try {
      // Find messages where the current user is either the sender or is listed in recipients.
      const messages = await Message.find({
        $or: [
          { sender: req.user.id },
          { recipients: req.user.id }
        ]
      })
        .populate('sender', 'name email role')  // Populate sender details (adjust fields as needed)
        .sort({ createdAt: -1 });               // Sort by creation date, most recent first
  
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

module.exports = router;
