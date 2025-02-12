// server/models/DailyBriefing.js
const mongoose = require('mongoose');

const DailyBriefingSchema = new mongoose.Schema({
    classSummary: { type: String, required: true },
    classQuestions: { type: String, required: true },
    homeworkQuestions: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  }, { timestamps: true });
  
module.exports = mongoose.model('DailyBriefing', DailyBriefingSchema);
