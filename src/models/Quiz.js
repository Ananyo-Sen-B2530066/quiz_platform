const mongoose = require('mongoose');
const crypto = require('crypto');

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, default: false }
});

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  questionType: { 
    type: String, 
    enum: ['mcq', 'msq', 'text'], 
    required: true 
  },
  mediaUrl: { type: String },
  mediaType: { 
    type: String, 
    enum: ['image', 'video', 'audio', 'none'],
    default: 'none'
  },
  options: [optionSchema],
  correctAnswer: { type: String }, // For text type questions (JSON string of accepted answers)
  order: { type: Number, required: true },
  isImportant: { type: Boolean, default: false }, // NEW: Mark important questions
  points: { // NEW: Point system
    correct: { type: Number, default: 1 },
    wrong: { type: Number, default: 0 },
    unattempted: { type: Number, default: 0 }
  }
  clues: [{
    text: { type: String, required: true },
    order: { type: Number, required: true }
  }],
  level: { type: Number, default: 1, min: 1, max: 5 } // NEW: difficulty level
});

const quizSchema = new mongoose.Schema({
  creatorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { type: String, required: true },
  description: { type: String },
  timeLimit: { type: Number, required: true }, // in minutes
  isLocked: { type: Boolean, default: false },
  shareableToken: { 
    type: String, 
    unique: true, 
    default: () => crypto.randomBytes(16).toString('hex')
  },
  questions: [questionSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quiz', quizSchema);
