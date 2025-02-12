const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  explanation: { type: String },          // Detailed blog-style content
  testCases: [{ type: String }],            // Array of test case descriptions
  solution: { type: String },               // Optional solution text
  files: [{ type: String }],                // URLs for attachments (images, PDFs)
  codingPlatformLink: { type: String },     // Optional link if the question is hosted externally
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
  tags: [String],                         // e.g., "array", "function", "loop", etc.
  // category distinguishes whether the assignment is public or personal
  category: { type: String, enum: ['public', 'personal'], default: 'public' },
  // assignmentTag indicates the question type: HW, CW, or practice
  assignmentTag: { type: String, enum: ['HW', 'CW', 'practice'], default: 'practice' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // New field: whether the solution is visible to everyone.
  solutionVisible: { type: Boolean, default: true },
  responses: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      responseStatus: {
        type: String,
        enum: ['not attempted', 'solved', 'partially solved', 'not understanding', 'having doubt'],
        default: 'not attempted'
      },
      submissionUrl: { type: String, default: '' },
      screenshots: [{ type: String }],
      learningNotes: { type: String, default: '' }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Assignment', AssignmentSchema);
