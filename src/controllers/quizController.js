const Quiz = require('../models/Quiz');
const cloudinary = require('../config/cloudinary');

// Upload media to Cloudinary
const uploadToCloudinary = (buffer, resourceType) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

// Helper function to generate shareable link
const getShareableLink = (req, token) => {
  // If BASE_URL is set in environment, use it
  if (process.env.BASE_URL) {
    return `${process.env.BASE_URL}/quiz/${token}`;
  }
  // Otherwise use the request host
  return `${req.protocol}://${req.get('host')}/quiz/${token}`;
};

// Create a new quiz
exports.createQuiz = async (req, res) => {
  try {
    const { title, description, timeLimit, rules } = req.body;

    if (!title || !timeLimit) {
      return res.status(400).json({ error: 'Title and time limit are required' });
    }

    const quiz = new Quiz({
      creatorId: req.userId,
      title,
      description,
      timeLimit: parseInt(timeLimit),
      rules: rules || '',
      questions: []
    });

    await quiz.save();

    res.status(201).json({
      message: 'Quiz created successfully',
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        timeLimit: quiz.timeLimit,
        rules: quiz.rules,
        shareableToken: quiz.shareableToken,
        shareableLink: getShareableLink(req, quiz.shareableToken)
      }
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Server error while creating quiz' });
  }
};

// Update quiz details (title, description, timeLimit, rules)
exports.updateQuizDetails = async (req, res) => {
  try {
    const { title, description, timeLimit, rules } = req.body;

    const quiz = await Quiz.findOne({
      _id: req.params.id,
      creatorId: req.userId
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (title) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (timeLimit) quiz.timeLimit = parseInt(timeLimit);
    if (rules !== undefined) quiz.rules = rules;

    await quiz.save();

    res.json({
      message: 'Quiz details updated successfully',
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        timeLimit: quiz.timeLimit,
        rules: quiz.rules
      }
    });
  } catch (error) {
    console.error('Update quiz details error:', error);
    res.status(500).json({ error: 'Server error while updating quiz details' });
  }
};

// Get all quizzes created by the user
exports.getMyQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ creatorId: req.userId })
      .select('title description timeLimit isLocked shareableToken createdAt questions')
      .sort({ createdAt: -1 });

    const quizzesWithLinks = quizzes.map(quiz => ({
      id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.timeLimit,
      isLocked: quiz.isLocked,
      questionCount: quiz.questions.length,
      shareableToken: quiz.shareableToken,
      shareableLink: getShareableLink(req, quiz.shareableToken),
      createdAt: quiz.createdAt
    }));

    res.json({ quizzes: quizzesWithLinks });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ error: 'Server error while fetching quizzes' });
  }
};

// Get quiz details (for creator)
exports.getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      creatorId: req.userId
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    res.json({ quiz });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Server error while fetching quiz' });
  }
};

// Add question to quiz
// INSTRUCTIONS: Replace the addQuestion function in your quizController.js with this updated version

exports.addQuestion = async (req, res) => {
  try {
    const { quizId } = req.params;
    let { questionText, questionType, options, correctAnswer, isImportant, points, level, clues } = req.body;

    // Find quiz
    const quiz = await Quiz.findOne({ _id: quizId, creatorId: req.userId });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Parse options if it's a string (from FormData)
    if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid options format' });
      }
    }

    // Parse correctAnswer if it's a string (from FormData)
    if (typeof correctAnswer === 'string') {
      try {
        correctAnswer = JSON.parse(correctAnswer);
      } catch (e) {
        // If it's already a plain string, keep it as is
      }
    }

    // Parse points if it's a string (from FormData)
    let parsedPoints = { correct: 1, wrong: 0, unattempted: 0 };
    if (typeof points === 'string') {
      try {
        parsedPoints = JSON.parse(points);
      } catch (e) {
        // Use default points if parsing fails
      }
    } else if (points && typeof points === 'object') {
      parsedPoints = points;
    }

    let parsedClues = [];
if (typeof clues === 'string') {
    try {
        parsedClues = JSON.parse(clues);
    } catch (e) {}
}


    // Parse isImportant
    const questionIsImportant = isImportant === 'true' || isImportant === true;

    // Prepare question object
    const question = {
      questionText,
      questionType,
      order: quiz.questions.length + 1,
      mediaType: 'none',
      isImportant: questionIsImportant,
      points: parsedPoints,
      level: parseInt(level) || 1,  // ADD THIS
      clues: parsedClues 
    };

    // Handle media upload if present
    if (req.file) {
      let resourceType = 'auto';
      if (req.file.mimetype.startsWith('video/')) {
        resourceType = 'video';
        question.mediaType = 'video';
      } else if (req.file.mimetype.startsWith('audio/')) {
        resourceType = 'video'; // Cloudinary uses 'video' for audio too
        question.mediaType = 'audio';
      } else if (req.file.mimetype.startsWith('image/')) {
        resourceType = 'image';
        question.mediaType = 'image';
      }

      const result = await uploadToCloudinary(req.file.buffer, resourceType);
      question.mediaUrl = result.secure_url;
    }

    // Handle options for MCQ/MSQ
    if (questionType === 'mcq' || questionType === 'msq') {
      if (!options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ error: 'Options are required for MCQ/MSQ questions' });
      }
      question.options = options.map(opt => ({
        text: opt.text,
        isCorrect: opt.isCorrect || false
      }));
    }

    // Handle correct answer for text questions
    if (questionType === 'text') {
      if (!correctAnswer) {
        return res.status(400).json({ error: 'Correct answer is required for text questions' });
      }
      // Convert all accepted answers to uppercase before storing
  let answersArray = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
  answersArray = answersArray.map(ans => ans.trim().toUpperCase());  // CONVERT TO UPPERCASE
  
  question.correctAnswer = JSON.stringify(answersArray);
}

    // Add question to quiz
    quiz.questions.push(question);
    await quiz.save();

    res.status(201).json({
      message: 'Question added successfully',
      question: quiz.questions[quiz.questions.length - 1]
    });
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({ error: 'Server error while adding question' });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { quizId, questionId } = req.params;
    let { questionText, questionType, options, correctAnswer, isImportant, points, level, clues } = req.body;

    const quiz = await Quiz.findOne({ _id: quizId, creatorId: req.userId });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const question = quiz.questions.id(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Parse options if it's a string (from FormData)
    if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid options format' });
      }
    }

    // Parse correctAnswer if it's a string (from FormData)
    if (typeof correctAnswer === 'string') {
      try {
        correctAnswer = JSON.parse(correctAnswer);
      } catch (e) {
        // Keep as plain string if not valid JSON
      }
    }

    // Parse points if it's a string (from FormData)
    if (typeof points === 'string') {
      try {
        question.points = JSON.parse(points);
      } catch (e) {
        // Keep existing points if parsing fails
      }
    } else if (points && typeof points === 'object') {
      question.points = points;
    }
   
    let parsedClues = [];
if (typeof clues === 'string') {
    try {
        parsedClues = JSON.parse(clues);
    } catch (e) {}
}

if (level !== undefined) {
    question.level = parseInt(level) || 1;
}
if (cluesArray && cluesArray.length > 0) {
    question.clues = parsedClues;
}

    // Parse isImportant
    if (isImportant !== undefined) {
      question.isImportant = isImportant === 'true' || isImportant === true;
    }

    // Update fields
    if (questionText) question.questionText = questionText;
    if (questionType) question.questionType = questionType;

    // Handle media upload if present
    if (req.file) {
      let resourceType = 'auto';
      if (req.file.mimetype.startsWith('video/')) {
        resourceType = 'video';
        question.mediaType = 'video';
      } else if (req.file.mimetype.startsWith('audio/')) {
        resourceType = 'video';
        question.mediaType = 'audio';
      } else if (req.file.mimetype.startsWith('image/')) {
        resourceType = 'image';
        question.mediaType = 'image';
      }

      const result = await uploadToCloudinary(req.file.buffer, resourceType);
      question.mediaUrl = result.secure_url;
    }

    // Update options or correct answer
    if (questionType === 'mcq' || questionType === 'msq') {
      if (options && Array.isArray(options)) {
        question.options = options.map(opt => ({
          text: opt.text,
          isCorrect: opt.isCorrect || false
        }));
      }
    } else if (questionType === 'text' && correctAnswer) {
      // Convert all accepted answers to uppercase before storing
      let answersArray = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
      answersArray = answersArray.map(ans => ans.trim().toUpperCase());  // CONVERT TO UPPERCASE
  
      question.correctAnswer = JSON.stringify(answersArray);
    }

    await quiz.save();

    res.json({ message: 'Question updated successfully', question });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Server error while updating question' });
  }
};

// Delete question
exports.deleteQuestion = async (req, res) => {
  try {
    const { quizId, questionId } = req.params;

    const quiz = await Quiz.findOne({ _id: quizId, creatorId: req.userId });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    quiz.questions.pull(questionId);
    await quiz.save();

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Server error while deleting question' });
  }
};

// Lock/Unlock quiz
exports.toggleLock = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      creatorId: req.userId
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    quiz.isLocked = !quiz.isLocked;
    await quiz.save();

    res.json({
      message: `Quiz ${quiz.isLocked ? 'locked' : 'unlocked'} successfully`,
      isLocked: quiz.isLocked
    });
  } catch (error) {
    console.error('Toggle lock error:', error);
    res.status(500).json({ error: 'Server error while toggling lock' });
  }
};

// Toggle quiz start status
exports.toggleStart = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      creatorId: req.userId
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    quiz.isStarted = !quiz.isStarted;
    await quiz.save();

    res.json({
      message: `Quiz ${quiz.isStarted ? 'started' : 'stopped'} successfully`,
      isStarted: quiz.isStarted
    });
  } catch (error) {
    console.error('Toggle start error:', error);
    res.status(500).json({ error: 'Server error while toggling start status' });
  }
};

// Delete quiz
exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndDelete({
      _id: req.params.id,
      creatorId: req.userId
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: 'Server error while deleting quiz' });
  }
};
