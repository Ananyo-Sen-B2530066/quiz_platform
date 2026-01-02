const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  questionText: { type: String },
  questionType: { type: String },
  isImportant: { type: Boolean, default: false },
  selectedOptions: [{ type: mongoose.Schema.Types.ObjectId }],
  textAnswer: { type: String },
  isCorrect: { type: Boolean },
  status: { type: String, enum: ['correct', 'wrong', 'unattempted'], default: 'unattempted' },
  earnedPoints: { type: Number, default: 0 },
  maxPoints: { type: Number, default: 1 },
  userAnswer: { type: mongoose.Schema.Types.Mixed }, // What user selected
  correctAnswer: { type: mongoose.Schema.Types.Mixed }, // What was correct
  questionLevel: { type: Number, default: 1 }
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
  maxScore: { type: Number }, // Maximum possible score
  totalQuestions: { type: Number }
});

// Compound index to prevent duplicate attempts
attemptSchema.index({ quizId: 1, userIdentifier: 1 }, { unique: true });

module.exports = mongoose.model('Attempt', attemptSchema);
