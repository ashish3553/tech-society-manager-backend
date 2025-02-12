// server/routes/contact.js
const express = require('express');
const router = express.Router();
const ContactMessage = require('../models/ContactMessage');
const permit = require('../middleware/permit');
const auth = require('../middleware/auth');

// POST /api/contact - Create a new contact message (public route)
router.post('/', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ msg: 'Name, email, and message are required.' });
  }
  try {
    const newContact = new ContactMessage({ name, email, message });
    const savedContact = await newContact.save();
    res.json(savedContact);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// GET /api/contact - Retrieve all contact messages (public route)
router.get('/',auth,permit('admin'), async(req, res) => {
    try {
      const contactMessages = await ContactMessage.find();
      res.json(contactMessages);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });
  

module.exports = router;
