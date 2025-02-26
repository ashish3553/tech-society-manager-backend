// models/Goal.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DailyReportSchema = new Schema({
    date: {
      type: Date,
      default: Date.now,
    },
    update: {
      type: String,
      trim: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    // New field: rating of the day
    rating: {
      type: String,
      enum: ['Satisfied', 'Less Satisfied', 'Overly Satisfied'],
      default: 'Satisfied',
    },
    // You might also want to include justification in the daily report if it doesn't already exist.
    justification: {
      type: String,
      trim: true,
      default: '',
    },
  });

const GoalSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // weekly target set by mentor/admin, stored as a string (e.g., JSON string of bullet points)
  weeklyTarget: {
    type: String,
    required: true,
    trim: true,
  },
  // New field: weeklyJustification provided by the user (optional)
  weeklyJustification: {
    type: String,
    default: '',
    trim: true,
  },
  // an array of daily reports for detailed updates
  dailyReports: [DailyReportSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-update the updatedAt field on save
GoalSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Goal', GoalSchema);
