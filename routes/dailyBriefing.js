const express = require('express');
const router = express.Router();
const DailyBriefing = require('../models/DailyBriefing');
const auth = require('../middleware/auth');
const permit = require('../middleware/permit');

// POST /api/dailyBriefing - Create a new daily briefing (volunteer, mentor, admin)
router.post('/', auth, permit('volunteer', 'mentor', 'admin'), async (req, res) => {
  const { classSummary, classQuestions, homeworkQuestions } = req.body;
  try {
    console.log("Authenticated user:", req.user);
    const briefing = new DailyBriefing({
      classSummary,
      classQuestions,
      homeworkQuestions,
      createdBy: req.user.id
    });
    const savedBriefing = await briefing.save();
    res.json(savedBriefing);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/dailyBriefing/current - Get the current daily briefing (within last 24 hours)
router.get('/current', auth, async (req, res) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Populate createdBy to get the poster's name and role
    const briefing = await DailyBriefing.findOne({ createdAt: { $gte: twentyFourHoursAgo } })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name role');
    if (!briefing) {
      return res.status(404).json({ msg: 'No current briefing found' });
    }
    res.json(briefing);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/dailyBriefing/archive - Get previous briefings (older than 24 hours)
router.get('/archive', auth, async (req, res) => {
  try {
    console.log("Here for briefing");
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let filter = { createdAt: { $lt: twentyFourHoursAgo } };

    if (req.query.month) {
      // Parse the month (format: YYYY-MM) to a start and end date.
      const start = new Date(req.query.month + '-01T00:00:00.000Z');
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }

    const briefings = await DailyBriefing.find(filter)
      .populate('createdBy', 'name role')  // Populate createdBy with name and role.
      .sort({ createdAt: -1 });
      
    res.json(briefings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// PUT /api/dailyBriefing/:id - Update an existing daily briefing
// Allowed for volunteer, mentor, and admin
router.put('/:id', auth, permit('volunteer', 'mentor', 'admin'), async (req, res) => {
  const { classSummary, classQuestions, homeworkQuestions } = req.body;
  try {
    const briefing = await DailyBriefing.findById(req.params.id);
    if (!briefing) {
      return res.status(404).json({ msg: 'Briefing not found' });
    }
    // Update only the provided fields
    briefing.classSummary = classSummary || briefing.classSummary;
    briefing.classQuestions = classQuestions || briefing.classQuestions;
    briefing.homeworkQuestions = homeworkQuestions || briefing.homeworkQuestions;

    const updatedBriefing = await briefing.save();
    res.json(updatedBriefing);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');  
  }
});

// Assuming you have imported your User model:
const User = require('../models/User');

router.get('/recent', async (req, res) => {
  try {
    // Fetch two most recent briefings
    const briefings = await DailyBriefing.find()
      .sort({ createdAt: -1 });

    // For each briefing, fetch the user details using the createdBy field (which stores the userId)
    const briefingsWithUser = await Promise.all(
      briefings.map(async (briefing) => {
        // Find the user by the ID stored in briefing.createdBy
        const user = await User.findById(briefing.createdBy, 'name role');
        // Convert briefing to a plain object and add the user details under createdBy
        return {
          ...briefing.toObject(),
          createdBy: user // now includes username and role
        };
      })
    );
    // console.log(briefingsWithUser);

    res.json(briefingsWithUser);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


  

// DELETE /api/dailyBriefing/:id - Delete an existing daily briefing
// Allowed for admin only
router.delete('/:id', auth, permit('admin','mentor'), async (req, res) => {
  try {
    const briefing = await DailyBriefing.findById(req.params.id);
    if (!briefing) {
      return res.status(404).json({ msg: 'Briefing not found' });
    }
    await briefing.deleteOne(); // Instead of briefing.remove()
    res.json({ msg: 'Briefing deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


module.exports = router;
