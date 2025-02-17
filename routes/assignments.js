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
const mongoose = require('mongoose');
const Solution = require('../models/Solution');
const sendEmail = require('../utils/mailer'); // Import the Mailjet mailer

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
==============================
   STATIC ROUTES (Non-Dynamic)
==============================
*/

// POST /api/assignments
// Create an Assignment – Allowed for mentor and admin only.
router.post('/', auth, permit('mentor', 'admin'), upload.any(), async (req, res) => {
  const { 
    title, 
    explanation, 
    testCases, 
    codingPlatformLink, 
    difficulty, 
    tags, 
    repoCategory,          // "question" or "project"
    questionType,          // "coding" or "conceptual" (if repoCategory === "question")
    similarQuestions,
    majorTopic,
    assignedToDetails  // For personal assignments (JSON string)
  } = req.body;
  
  // Check required fields
  if (!title || !repoCategory || !majorTopic) {
    return res.status(400).json({ msg: 'Title, repoCategory, and majorTopic are required.' });
  }
  
  // Parse testCases (expecting a JSON string)
  let parsedTestCases = [];
  if (testCases) {
    try {
      parsedTestCases = JSON.parse(testCases);
    } catch (e) {
      return res.status(400).json({ msg: 'Invalid JSON format for testCases.' });
    }
  }
  
  // Parse similarQuestions (expecting a JSON string)
  let parsedSimilarQuestions = [];
  if (similarQuestions) {
    try {
      parsedSimilarQuestions = JSON.parse(similarQuestions);
    } catch (e) {
      return res.status(400).json({ msg: 'Invalid JSON format for similarQuestions.' });
    }
  }
  
  // Parse assignedToDetails if provided (for personal assignments)
  let assignedToArray = [];
  if (assignedToDetails) {
    try {
      assignedToArray = JSON.parse(assignedToDetails);
      if (!Array.isArray(assignedToArray) || assignedToArray.length === 0) {
        return res.status(400).json({ msg: 'assignedToDetails must be a non-empty array.' });
      }
    } catch (e) {
      return res.status(400).json({ msg: 'Invalid JSON format for assignedToDetails.' });
    }
  }
  
  try {
    const newAssignment = new Assignment({
      title,
      explanation,
      testCases: parsedTestCases,
      codingPlatformLink,
      difficulty,
      tags,
      repoCategory,
      questionType: repoCategory === 'question' ? (questionType || 'coding') : undefined,
      majorTopic,
      similarQuestions: parsedSimilarQuestions,
      assignedTo: assignedToArray,
      // Distribution tag defaults to "central" on creation
      createdBy: new mongoose.Types.ObjectId(req.user.id),
      lastModifiedBy: new mongoose.Types.ObjectId(req.user.id)
    });
    const savedAssignment = await newAssignment.save();
    res.json(savedAssignment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/assignments/home
router.get('/home', async (req, res) => {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const assignments = await Assignment.find({
      distributionTag: { $in: ['hw', 'cw'] },
      updatedAt: { $gte: fortyEightHoursAgo }
    }).populate('createdBy', 'name role');
    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/assignments/all
// For mentors/admins: Get ALL assignments from central repo (all distribution tags)
router.get('/all', auth, async (req, res) => {
  try {
    // For mentors/admins, return assignments with distributionTag in the following array
    const tags = ['practice', 'hw', 'cw', 'central', 'personal'];
    const assignments = await Assignment.find({ distributionTag: { $in: tags } });
    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET /api/assignments/general
// For students/volunteers: Return global assignments plus personal assignments (only those assigned to the student).
router.get('/general', auth, async (req, res) => {
  try {
    // Global assignments (practice, hw, cw)
    const globalAssignments = await Assignment.find({
      distributionTag: { $in: ['practice', 'hw', 'cw'] }
    });

    // Personal assignments assigned to the logged-in student.
    const personalAssignments = await Assignment.find({
      distributionTag: 'personal',
      assignedTo: { $elemMatch: { email: req.user.email } }
    });

    // Merge arrays (or sort them by date as needed)
    res.json([...globalAssignments, ...personalAssignments]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// // GET /api/assignments/personalAssigned
// // For mentors/admins: Return assignments that were marked personal (and assigned to one or more students).
// router.get('/personalAssigned', auth, permit('mentor', 'admin'), async (req, res) => {
//   try {
//     // Optionally, if you want only the personal assignments created by the logged-in mentor:
//     const assignments = await Assignment.find({
//       distributionTag: 'personal',
//       createdBy: req.user.id  // Only show assignments created by this mentor.
//     });
//     res.json(assignments);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// Optional: Route to filter assignments by tag for student dashboard tabs
router.get('/filter', auth, permit('student', 'volunteer'), async (req, res) => {
  try {
    // Expecting a query param like ?tag=hw or ?tag=personal
    const { tag } = req.query;
    if (!tag) {
      return res.status(400).json({ message: 'Tag query parameter is required.' });
    }
    let assignments;
    if (tag === 'personal') {
      assignments = await Assignment.find({
        distributionTag: 'personal',
        assignedTo: { $elemMatch: { email: req.user.email } }
      });
    } else if (['hw', 'cw', 'practice'].includes(tag)) {
      assignments = await Assignment.find({ distributionTag: tag });
    } else {
      return res.status(400).json({ message: 'Invalid tag parameter.' });
    }
    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET /api/assignments/practice
// For a student, returns assignments that are not 'central'.
// If query.assignmentTag === 'all', it returns common assignments (practice, hw, cw)
// plus any personal assignments assigned to the student.
// If assignmentTag is provided and not 'all', then it filters by that specific tag.
router.get('/practice', auth, async (req, res) => {
  try {
    const { assignmentTag, difficulty, tags, responseStatus } = req.query;
    let query = {};

    // Build the query for difficulty and tags, if provided
    if (difficulty) {
      query.difficulty = difficulty;
    }
    if (tags) {
      const tagsArray = tags.split(',').map(t => t.trim());
      query.tags = { $in: tagsArray };
    }
    if (responseStatus) {
      query.responses = { $elemMatch: { student: req.user._id, responseStatus } };
    }

    // Determine which assignments to return based on assignmentTag query parameter.
    if (assignmentTag) {
      if (assignmentTag === 'personal') {
        query.distributionTag = 'personal';
        query.assignedTo = { $elemMatch: { email: req.user.email } };
      } else if (assignmentTag !== 'all') {
        query.distributionTag = assignmentTag;
      } else {
        // if assignmentTag === 'all'
        query = {
          $or: [
            { ...query, distributionTag: { $in: ['practice', 'hw', 'cw'] } },
            { ...query, distributionTag: 'personal', assignedTo: { $elemMatch: { email: req.user.email } } }
          ]
        };
      }
    } else {
      // If no assignmentTag is provided, return assignments that are either global or personal (if assigned)
      query = {
        $or: [
          { ...query, distributionTag: { $in: ['practice', 'hw', 'cw'] } },
          { ...query, distributionTag: 'personal', assignedTo: { $elemMatch: { email: req.user.email } } }
        ]
      };
    }

    // Populate createdBy with name and role.
    const assignments = await Assignment.find(query)
      .populate('createdBy', 'name role');

    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});



// GET /api/assignments/personal
router.get('/personal', auth, async (req, res) => {
  try {
    // Look up the user by id to get their email.
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    console.log("User for personal assignment fetch:", user);
    const assignments = await Assignment.find({
      distributionTag: 'personal',
      assignedTo: { $elemMatch: { email: user.email } }
    }).populate('createdBy', 'name role');  // Optionally populate creator info

    console.log("This is your personal assignment: ", assignments);
    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});



// GET /api/assignments/allResource
// For mentors/admins: Return all assignments with global distribution tags (central, practice, hw, cw).
router.get('/allResource', auth, permit('mentor', 'admin'), async (req, res) => {
  try {
    const globalTags = ['central', 'practice','personal', 'hw', 'cw'];
    // We ignore personal assignments in this query.
    const assignments = await Assignment.find({ distributionTag: { $in: globalTags } });
    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/personalAssigned', auth, permit('mentor', 'admin'), async (req, res) => {
  try {
    console.log("Here is the route for your personal assignments: ", req.user);
    const mentorId = new mongoose.Types.ObjectId(req.user.id);
    const assignments = await Assignment.aggregate([
      {
        $match: {
          distributionTag: 'personal',
          $or: [
            { createdBy: mentorId },
            { "assignedTo.assignedBy": mentorId }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',               // collection name (typically the lowercase plural of "User")
          localField: 'assignedTo.email',  // email in each personal assignment element
          foreignField: 'email',       // email field in the User collection
          as: 'candidateDetails'       // output field with matching user documents
        }
      }
    ]);

    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});




// GET /api/assignments/pending-hw
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

/*
=====================================
   DYNAMIC ROUTES (Routes with :id)
=====================================
*/

// PUT /api/assignments/:id
// ASSIGNMENT UPDATION – Allowed for mentor and admin only.
router.put('/:id', auth, permit('mentor', 'admin'), async (req, res) => {
  try {
    const {
      title,
      explanation,
      testCases,      // expecting JSON string
      tags,           // could be string or array
      repoCategory,
      questionType,
      majorTopic,
      similarQuestions, // expecting JSON string
      codingPlatformLink
    } = req.body;

    console.log("Updated here till");
    
    // Build update data object:
    let updateData = {
      title,
      explanation,
      repoCategory,
      codingPlatformLink,
      majorTopic,
      questionType: repoCategory === 'question' ? questionType : undefined,
    };
    console.log("Updated here till 2");

    // Process tags: if it's a string, split it; if already an array, use it directly.
    if (tags) {
      updateData.tags = Array.isArray(tags)
        ? tags
        : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : []);
    }
    
    console.log("Updated here till 3");

    if (testCases) {
      console.log("Test cases are: ", testCases);
      try {
        const parsedTestCases = JSON.parse(testCases);
        if (!Array.isArray(parsedTestCases)) {
          return res.status(400).json({ msg: 'Test cases should be an array.' });
        }
        console.log("Updated here till 4");

        // Validate each test case object and remove extra properties like _id.
        updateData.testCases = parsedTestCases.map((tc, index) => {
          // Remove _id if it exists.
          if (tc._id) {
            delete tc._id;
          }
          console.log("Updated here till 5");

          if (typeof tc !== 'object' || !tc.input || !tc.output) {
            throw new Error(`Test case at index ${index} is missing required fields.`);
          }
          console.log("Updated here till 6");

          return {
            input: String(tc.input),
            output: String(tc.output),
            explanation: tc.explanation ? String(tc.explanation) : ''
          };
        });
      } catch (e) {
        return res.status(400).json({ msg: 'Invalid JSON for testCases: ' + e.message });
      }
    }
    
    // Process similarQuestions JSON string
    if (similarQuestions) {
      try {
        updateData.similarQuestions = JSON.parse(similarQuestions);
      } catch (e) {
        return res.status(400).json({ msg: 'Invalid JSON for similarQuestions' });
      }
    }
    console.log("Updated here till 5");

    // Update lastModifiedBy field
    updateData.lastModifiedBy = new mongoose.Types.ObjectId(req.user.id);
    
    const assignment = await Assignment.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!assignment) return res.status(404).json({ msg: 'Assignment not found' });
    res.json(assignment);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// PUT solution (for students creating or updating their own solution)
// PUT /api/assignments/:assignmentId/solution
router.put('/:assignmentId/solution', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { title, content, userId } = req.body;

    console.log("AA gya:", content, title, userId);

    // Validate that content is not empty (since schema requires it)
    if (!content || !content.trim()) {
      return res.status(400).json({ msg: 'Solution content is required.' });
    }

    // Optional: validate title (if needed) or use a default value
    const solutionTitle = title && title.trim() ? title.trim() : 'Untitled Solution';

    // Ensure the assignment exists
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found.' });
    }

    // Check if a solution already exists for this assignment
    let solutionDoc = await Solution.findOne({ assignment: assignmentId });

    if (!solutionDoc) {
      // Create a new solution
      solutionDoc = new Solution({
        assignment: assignmentId,
        title: solutionTitle,
        content: content.trim(),
        createdBy: req.user._id,
        lastModifiedBy: req.user._id,
      });
    } else {
      // Update existing solution
      solutionDoc.title = solutionTitle;
      solutionDoc.content = content.trim();
      solutionDoc.lastModifiedBy = new mongoose.Types.ObjectId(req.user.id);
    }

    await solutionDoc.save();
    return res.json({ msg: 'Solution saved successfully!', solution: solutionDoc });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error while saving solution.' });
  }
});

// GET solution (for fetching the solution)
// GET /api/assignments/:id/solution
router.get('/:id/solution', auth, async (req, res) => {
  try {
    const assignmentId = req.params.id;

    console.log("searching 01");

    // 1) Check if assignment exists (optional)
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found' });
    }
    console.log("searching 02");

    // 2) (Optional visibility check commented out)
    // if (!assignment.solutionVisible && req.user.role !== 'mentor' && req.user.role !== 'admin') {
    //   return res.status(403).json({ msg: 'Solution is not visible yet.' });
    // }

    // 3) Find the actual solution doc
    const solutionDoc = await Solution.findOne({ assignment: assignmentId })
      .populate('createdBy', '_id name')
      .populate('lastModifiedBy', '_id name');
    if (!solutionDoc) {
      return res.status(404).json({ msg: 'No solution found for this assignment.' });
    }

    return res.json(solutionDoc);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error while fetching solution.' });
  }
});

// PUT solution (for mentor/admin to update and toggle solution visibility)
// PUT /api/assignments/:id/solution
router.put('/:id/solution', auth, permit('mentor', 'admin'), async (req, res) => {
  try {
    const { solution } = req.body; // This is the HTML content from TinyMCE
    const assignmentId = req.params.id;

    // Upsert the Solution document for this assignment.
    const solutionDoc = await Solution.findOneAndUpdate(
      { assignment: assignmentId },
      {
        solution,
        lastModifiedBy: req.user.id,
      },
      { new: true, upsert: true }
    );

    // Update the corresponding Assignment document:
    // Here, we update the solution field and mark that a solution has been posted.
    await Assignment.findByIdAndUpdate(
      assignmentId,
      { solution: solution, solutionVisible: true },
      { new: true }
    );

    res.json({ solution: solutionDoc });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error while updating solution.');
  }
});

// PUT /api/assignments/:id/status
router.put('/:id/status', auth, permit('student', 'volunteer'), async (req, res) => {
  const { responseStatus, submissionUrl, screenshots, learningNotes } = req.body;
  
  // Validate based on responseStatus
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
    // Find the assignment
    let assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found' });
    }
    
    // For personal assignments, ensure the student is assigned
    if (assignment.type === 'personal') {
      const isAssigned = assignment.assignedTo.map(String).includes(String(req.user.id));
      if (!isAssigned) {
        return res.status(403).json({ msg: 'Not authorized for this assignment' });
      }
    }
    
    // Update the assignment's responses array
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
    
    // Update the Doubt conversation if not solved.
    if (responseStatus !== 'solved') {
      let doubt = await Doubt.findOne({
        assignment: req.params.id,
        student: req.user.id,
        resolved: false
      });
      
      if (doubt) {
        doubt.conversation.push({
          sender: req.user.id,
          message: learningNotes,
          type: 'follow-up'
        });
        doubt.currentStatus = 'unsatisfied';
        await doubt.save();
      } else {
        doubt = new Doubt({
          assignment: req.params.id,
          student: req.user.id,
          conversation: [{
            sender: req.user.id,
            message: learningNotes,
            type: 'doubt'
          }],
          currentStatus: 'new',
          resolved: false
        });
        await doubt.save();
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
// Upload a file (e.g., screenshot) using Cloudinary.
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

// PUT /api/assignments/:id/distribution
router.put('/:id/distribution', auth, permit('mentor', 'admin'), async (req, res) => {
  try {
    const { distributionTag } = req.body;
    if (!distributionTag) {
      return res.status(400).json({ message: "Distribution tag is required." });
    }
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." });
    }
    
    // Update distribution tag and lastModifiedBy
    assignment.distributionTag = distributionTag;
    assignment.lastModifiedBy = req.user.id;
    await assignment.save();

    // If the new tag is HW or CW, send email notifications to all students
    if (['hw', 'cw'].includes(distributionTag.toLowerCase())) {
      // Fetch all students
      const students = await User.find({ role: { $in: ['student', 'volunteer'] } });

      // Filter and map students to an array of objects with Email and Name properties
      const recipientEmails = students
        .filter(student => typeof student.email === 'string' && student.email)
        .map(student => ({ Email: student.email, Name: student.name || "" }));
      
      if (recipientEmails.length > 0) {
        const emailSubject = `New ${distributionTag.toUpperCase()} Assignment Posted`;
        const emailText = `A new assignment has been marked as ${distributionTag.toUpperCase()}.
It will be visible on your Home page for the next 48 hours. Please check it out.`;
        
        // Use your sendEmail function – ensure it accepts an array of recipient objects.
        await sendEmail({
          to: recipientEmails,
          subject: emailSubject,
          text: emailText,
        });
        console.log("HW/CW email sent successfully to students.");
      }
    }

    res.json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});




// PUT /api/assignments/:id/assign-personal
// Only mentors/admins can assign an assignment personally to students.
// PUT /api/assignments/:id/assign-personal
router.put('/:id/assign-personal', auth, permit('mentor', 'admin'), async (req, res) => {
  try {
    const { assignedTo } = req.body; // Expect an array of objects: { name, email }
    if (!assignedTo || !Array.isArray(assignedTo) || assignedTo.length === 0) {
      return res.status(400).json({ msg: 'Personal assignments must include at least one assignee.' });
    }

    // Validate each entry and attach the mentor id from req.user
    const updatedAssignedTo = assignedTo.map(assignee => ({
      name: assignee.name,
      email: assignee.email,
      assignedBy: req.user.id  // The mentor/admin making the assignment
    }));

    let assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found' });
    }

    assignment.assignedTo = updatedAssignedTo;
    // Optionally update distribution tag to 'personal'
    assignment.distributionTag = 'personal';
    assignment.lastModifiedBy = req.user.id;
    assignment = await assignment.save();
    res.json(assignment);
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
    console.log("Here i am to get open this assignment"); 
    // Populate the 'createdBy' and 'lastModifiedBy' fields
    const assignment = await Assignment.findById(req.params.id)
      .populate('createdBy', '_id name role')
      .populate('lastModifiedBy', '_id name role');

      console.log("Found the sssingment",assignment);
    if (!assignment) {
      return res.status(404).json({ msg: 'Assignment not found' });
    }
    
    res.json(assignment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;


/*
------------------------- DO NOT CHANGE OR DELETE THE COMMENTED PART BELOW -------------------------

// GET /api/assignments/general
// Get general (public) assignments – available for all authenticated users.
// router.get('/general', auth, async (req, res) => {
//   try {
//     const assignments = await Assignment.find({ category: 'public' }).populate('assignedBy');
//     res.json(assignments);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// });

// GET /api/assignments/personal
// For students (or volunteers) – show assignments assigned to them;
// For mentors – show assignments created by them (optionally filtered by a student).
// router.get('/personal', auth, async (req, res) => {
//     try {
//       let filter = { type: 'personal' }; // Ensure that your schema uses 'type' or update accordingly.
//       if (req.user.role === 'student' || req.user.role === 'volunteer') {
//         filter.assignedTo = req.user.id;
//       } else if (req.user.role === 'mentor') {
//         filter.assignedBy = req.user.id;
//         if (req.query.studentId) {
//           filter.assignedTo = req.query.studentId;
//         }
//       }
  
//       // Populate the 'assignedBy' field so that it returns an object with _id, name, and role.
//       const assignments = await Assignment.find(filter)
//         .populate('assignedBy', '_id name role');
  
//       console.log("Sending info is", assignments);
//       res.json(assignments);
//     } catch (err) {
//       console.error(err.message);
//       res.status(500).send('Server error');
//     }
//   });

// GET /api/assignments/practice
// Fetch assignments for the "Practice" section.
// This route now accepts a query parameter "assignmentTag" that can be a comma-separated list.
// If none is provided, it defaults to "practice,HW,CW".
// router.get('/practice', auth, async (req, res) => {
//   try {
//     let filter = { type: 'public' };
//     // Determine assignmentTag filter:
//     let tags = req.query.assignmentTag;
//     if (!tags) {
//       tags = 'practice'; // default to all three if not provided
//     }
//     const tagsArr = tags.split(',').map(tag => tag.trim());
//     filter.assignmentTag = { $in: tagsArr };

//     if (req.query.difficulty) {
//       filter.difficulty = req.query.difficulty;
//     }
//     if (req.query.tags) {
//       const tagsArr2 = req.query.tags.split(',').map(tag => tag.trim());
//       filter.tags = { $in: tagsArr2 };
//     }
//     if (req.query.responseStatus) {
//       filter.responses = {
//         $elemMatch: {
//           student: req.user.id,
//           responseStatus: req.query.responseStatus
//         }
//       };
//     }
//     const assignments = await Assignment.find(filter).populate('assignedBy');
//     res.json(assignments);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// });

// GET /api/assignments/pending
// Returns public assignments that have not been solved by the logged-in student or volunteer.
// router.get('/pending', auth, async (req, res) => {
//   try {
//     if (req.user.role !== 'student' && req.user.role !== 'volunteer') {
//       return res.status(403).json({ msg: 'Only students or volunteers can view pending assignments.' });
//     }
//     const assignments = await Assignment.find({ category: 'public' }).sort({ createdAt: -1 });
//     const pendingAssignments = assignments.filter((assignment) => {
//       const response = assignment.responses.find(resp => String(resp.student) === String(req.user.id));
//       return !response || response.responseStatus !== 'solved';
//     });
//     res.json(pendingAssignments);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// });

// PUT /api/assignments/:id/solution-visibility
// Allows mentor/admin to toggle solution visibility.
// router.put('/:id/solution-visibility', auth, permit('mentor', 'admin'), async (req, res) => {
//   console.log("Solution change hona hai");
//   if (req.body.solutionVisible === undefined) {
//     return res.status(400).json({ msg: 'solutionVisible is required.' });
//   }
//   try {
//     let assignment = await Assignment.findById(req.params.id);
//     if (!assignment) {
//       return res.status(404).json({ msg: 'Assignment not found' });
//     }
//     assignment.solutionVisible = req.body.solutionVisible;
//     assignment = await assignment.save();
//     res.json(assignment);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// });

// GET /api/assignments/
// Returns public assignments filtered by query parameters.
// router.get('/', auth, async (req, res) => {
//   try {
//     const filter = { category: 'public' };
//     if (req.query.assignmentTag) {
//       filter.assignmentTag = req.query.assignmentTag;
//     }
//     if (req.query.difficulty) {
//       filter.difficulty = req.query.difficulty;
//     }
//     if (req.query.tags) {
//       const tagsArr = req.query.tags.split(',').map(tag => tag.trim());
//       filter.tags = { $in: tagsArr };
//     }
//     if (req.query.responseStatus) {
//       filter.responses = {
//         $elemMatch: {
//           student: req.user.id,
//           responseStatus: req.query.responseStatus
//         }
//       };
//     }
//     const assignments = await Assignment.find(filter).populate('assignedBy');
//     res.json(assignments);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// });
*/
