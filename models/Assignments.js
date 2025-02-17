const mongoose = require('mongoose');

const TestCaseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  output: { type: String, required: true },
  explanation: { type: String }
});

const SimilarQuestionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true }
});

// Update the assignedTo array to include assignedBy.
const PersonalAssignmentSchema = new mongoose.Schema({
  name: { type: String, required: true },    // Recipient's name
  email: { type: String, required: true },   // Recipient's email
  assignedBy: {                              // Mentor who assigned this personally
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

const AssignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  explanation: { type: String }, // Rich content for the question/project
  testCases: [TestCaseSchema],
  codingPlatformLink: { type: String },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
  tags: [String],
  repoCategory: { type: String, enum: ['question', 'project'], required: true },
  questionType: { type: String, enum: ['coding', 'conceptual'], default: 'coding' },
  majorTopic: {
    type: String,
    enum: [
      "Basics & Syntax",
      "Data Types & Variables",
      "Operators",
      "Control Structures",
      "Functions",
      "Pointers & Memory Management",
      "Arrays",
      "String",
      "Object-Oriented Programming (OOP)",
      "Templates & Generic Programming",
      "STL",
      "Exception Handling",
      "File I/O",
      "Advanced Topics"
    ],
    required: true
  },
  similarQuestions: [SimilarQuestionSchema],
  distributionTag: { type: String, default: 'central' },
  // Instead of a simple array of objects, use PersonalAssignmentSchema for personal assignments.
  assignedTo: [PersonalAssignmentSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
