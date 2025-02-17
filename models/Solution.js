// models/Solution.js
const mongoose = require('mongoose');


const FeedbackSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  feedback: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const SolutionSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  feedbacks: [FeedbackSchema],
  title: { type: String, required: false },
  content: { type: String, required: true }, // <-- This will store the TinyMCE HTML
  attachments: [{ type: String }],
  published: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Solution', SolutionSchema);
