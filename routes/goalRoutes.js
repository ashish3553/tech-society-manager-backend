// routes/goalRoutes.js
const express = require('express');
const router = express.Router();
const Goal = require('../models/Goal');
const auth = require('../middleware/auth');
const permit = require('../middleware/permit');

// Create a new goal (weekly target)
router.post('/', auth, permit('admin', 'mentor'), async (req, res) => {
    console.log("Received goal payload:", req.body);
    try {
      const { user, weeklyTarget, weeklyJustification } = req.body;
      if (!weeklyTarget) {
        return res.status(400).json({ error: "weeklyTarget is required" });
      }
      const goal = new Goal({ user, weeklyTarget, weeklyJustification });
      await goal.save();
      res.status(201).json(goal);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }  
  }); 

// Update goal: Add/modify a daily report and update weekly target/justification
// Update goal: Update weekly target/justification or add/modify daily reports (including rating)
router.put('/:goalId', auth, permit('admin', 'mentor'), async (req, res) => {
    try {
      console.log("Here is put goal:", req.body);
      const { goalId } = req.params;
      const { weeklyTarget, weeklyJustification, dailyReports, newReport } = req.body;
      const goal = await Goal.findById(goalId);
      if (!goal) return res.status(404).json({ error: 'Goal not found' });
  
      if (weeklyTarget) {
        goal.weeklyTarget = weeklyTarget;
      }
      if (typeof weeklyJustification !== 'undefined') {
        goal.weeklyJustification = weeklyJustification;
      }
      if (newReport) {
        // newReport is expected to include rating (and justification) along with update, date, and isCompleted.
        goal.dailyReports.push(newReport);
      } else if (dailyReports) {
        goal.dailyReports = dailyReports;
      }
  
      await goal.save();
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });



// Other routes (GET routes remain the same)
router.get('/', auth, permit('admin', 'mentor'), async (req, res) => {
  try {
    const goals = await Goal.find().populate('user', 'name email role');
    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.params.userId });
    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get goals for a specific user (mentor view)
router.get('/user/:userId', async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.params.userId });
    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
