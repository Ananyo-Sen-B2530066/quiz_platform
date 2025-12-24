const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  selectedOptions: [{ type: mongoose.Schema.Types.ObjectId }],
  textAnswer: { type: String }
});

const attemptSchema = new mongoose.Schema({
  quizId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Quiz', 
    required: true 
  },
  userIdentifier: { type: String, required: true }, // email or unique identifier
  ipAddress: { type: String },
  userAgent: { type: String },
  responses: [responseSchema],
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date },
  score: { type: Number },
  totalQuestions: { type: Number }
});

// Compound index to prevent duplicate attempts
attemptSchema.index({ quizId: 1, userIdentifier: 1 }, { unique: true });

module.exports = mongoose.model('Attempt', attemptSchema);