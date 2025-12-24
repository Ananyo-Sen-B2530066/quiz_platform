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

// Create a new quiz
exports.createQuiz = async (req, res) => {
  try {
    const { title, description, timeLimit } = req.body;

    if (!title || !timeLimit) {
      return res.status(400).json({ error: 'Title and time limit are required' });
    }

    const quiz = new Quiz({
      creatorId: req.userId,
      title,
      description,
      timeLimit: parseInt(timeLimit),
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
        shareableToken: quiz.shareableToken,
        shareableLink: `${req.protocol}://${req.get('host')}/quiz/${quiz.shareableToken}`
      }
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Server error while creating quiz' });
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
      shareableLink: `${req.protocol}://${req.get('host')}/quiz/${quiz.shareableToken}`,
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
exports.addQuestion = async (req, res) => {
  try {
    const { quizId } = req.params;
    let { questionText, questionType, options, correctAnswer } = req.body;

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
        // This handles both JSON arrays and plain strings
      }
    }

    // Prepare question object
    const question = {
      questionText,
      questionType,
      order: quiz.questions.length + 1,
      mediaType: 'none'
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
      // Store as JSON string if it's an array
      question.correctAnswer = Array.isArray(correctAnswer) 
        ? JSON.stringify(correctAnswer) 
        : correctAnswer;
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

// Update question
exports.updateQuestion = async (req, res) => {
  try {
    const { quizId, questionId } = req.params;
    let { questionText, questionType, options, correctAnswer } = req.body;

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
      question.correctAnswer = Array.isArray(correctAnswer) 
        ? JSON.stringify(correctAnswer) 
        : correctAnswer;
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