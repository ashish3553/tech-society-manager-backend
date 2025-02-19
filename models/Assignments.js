// In your Assignment model file (e.g. models/Assignment.js)
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

const PersonalAssignmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

// New mentorReview subdocument schema
const MentorReviewSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['approved', 'not approved', 'pending'],
    default: 'pending'
  },
  comment: { type: String, default: '' },
  reviewedAt: { type: Date }
});

const AssignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  explanation: { type: String },
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
      learningNotes: { type: String, default: '' },
      studentSolution: { type: String, default: '' },
      mentorReview: MentorReviewSchema // New field for mentor review
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Assignment', AssignmentSchema);
