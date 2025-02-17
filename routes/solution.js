// routes/solution.js
const express = require('express');
const router = express.Router();

// Import your Mongoose models
const Assignment = require('../models/Assignments');
const Solution = require('../models/Solution');
const auth = require('../middleware/auth');

/**
 * PUT /api/assignments/:assignmentId/solution
 * Create or update the solution for a given assignment
 */
router.put('/:assignmentId/solution', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { solution, title } = req.body; 
    // `solution` = the HTML from TinyMCE
    // `title` is optional if you want to store a separate title

    // Optional check to ensure assignment exists
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    console.log("Checking solution");
    console.log("Here is the solution: ", `${solution}`);

    // Check if a solution already exists for this assignment
    let existingSolution = await Solution.findOne({ assignment: assignmentId });

    if (!existingSolution) {
      // Create new solution
      existingSolution = new Solution({
        assignment: assignmentId,
        title: title || 'Untitled Solution',
        content: solution,       // HTML content from TinyMCE
        createdBy: req.user?._id // if you have auth and user attached
      });
    } else {
      // Update existing solution
      existingSolution.title = title || existingSolution.title;
      existingSolution.content = solution;
      existingSolution.lastModifiedBy = req.user?._id; // if you track user ID
    }

    await existingSolution.save();
    return res.json({ message: 'Solution saved/updated successfully!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error saving solution.' });
  }
});

/**
 * GET /api/assignments/:assignmentId/solution
 * Retrieve the solution for a given assignment
 */
router.get('/:assignmentId/solution', async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const solution = await Solution.findOne({ assignment: assignmentId });
    if (!solution) {
      return res.status(404).json({ message: 'No solution found for this assignment.' });
    }

    // Return the entire solution document (including .title and .content)
    return res.json(solution);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching solution.' });
  }
});


// PUT /api/solutions/:id/feedback
// Adds a feedback entry to a solution. Only authenticated students/volunteers can submit feedback.
router.put('/:id/feedback', auth, async (req, res) => {
  try {
    const { feedback } = req.body;
    if (!feedback) {
      return res.status(400).json({ message: "Feedback is required." });
    }
    const solution = await Solution.findById(req.params.id);
    if (!solution) {
      return res.status(404).json({ message: "Solution not found." });
    }
    // Add the feedback (the authenticated user is stored as student)
    solution.feedbacks.push({ student: req.user.id, feedback });
    await solution.save();
    res.json(solution);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
