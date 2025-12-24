const Quiz = require('../models/Quiz');
const Attempt = require('../models/Attempt');

// Get quiz for taking (public access via token)
exports.getQuizByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const quiz = await Quiz.findOne({ shareableToken: token })
      .select('title description timeLimit isLocked questions');

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.isLocked) {
      return res.status(403).json({ error: 'This quiz is currently locked' });
    }

    // Return questions without correct answers
    const questionsWithoutAnswers = quiz.questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      questionType: q.questionType,
      mediaUrl: q.mediaUrl,
      mediaType: q.mediaType,
      options: q.questionType !== 'text' ? q.options.map(opt => ({
        _id: opt._id,
        text: opt.text
      })) : undefined,
      order: q.order
    }));

    res.json({
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        timeLimit: quiz.timeLimit,
        questionCount: quiz.questions.length,
        questions: questionsWithoutAnswers
      }
    });
  } catch (error) {
    console.error('Get quiz by token error:', error);
    res.status(500).json({ error: 'Server error while fetching quiz' });
  }
};

// Check if user has already attempted
exports.checkAttempt = async (req, res) => {
  try {
    const { token } = req.params;
    const { userIdentifier } = req.body;

    const quiz = await Quiz.findOne({ shareableToken: token });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const existingAttempt = await Attempt.findOne({
      quizId: quiz._id,
      userIdentifier
    });

    res.json({ hasAttempted: !!existingAttempt });
  } catch (error) {
    console.error('Check attempt error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Submit quiz attempt
exports.submitAttempt = async (req, res) => {
  try {
    const { token } = req.params;
    const { userIdentifier, responses, startedAt } = req.body;

    // Get quiz with correct answers
    const quiz = await Quiz.findOne({ shareableToken: token });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.isLocked) {
      return res.status(403).json({ error: 'This quiz is currently locked' });
    }

    // Check if already attempted
    const existingAttempt = await Attempt.findOne({
      quizId: quiz._id,
      userIdentifier
    });

    if (existingAttempt) {
      return res.status(400).json({ error: 'You have already attempted this quiz' });
    }

    // Validate time limit
    const timeTaken = (Date.now() - new Date(startedAt).getTime()) / 1000 / 60; // minutes
    if (timeTaken > quiz.timeLimit + 1) { // +1 minute grace period
      return res.status(400).json({ error: 'Time limit exceeded' });
    }

    // Calculate score
    let score = 0;
    const detailedResponses = responses.map(response => {
      const question = quiz.questions.id(response.questionId);
      if (!question) return response;

      let isCorrect = false;

      if (question.questionType === 'text') {
        isCorrect = response.textAnswer?.toLowerCase().trim() === 
                    question.correctAnswer?.toLowerCase().trim();
      } else if (question.questionType === 'mcq') {
        const selectedOption = question.options.id(response.selectedOptions[0]);
        isCorrect = selectedOption?.isCorrect || false;
      } else if (question.questionType === 'msq') {
        const correctOptionIds = question.options
          .filter(opt => opt.isCorrect)
          .map(opt => opt._id.toString());
        const selectedOptionIds = response.selectedOptions.map(id => id.toString());
        
        isCorrect = correctOptionIds.length === selectedOptionIds.length &&
                    correctOptionIds.every(id => selectedOptionIds.includes(id));
      }

      if (isCorrect) score++;

      return {
        ...response,
        isCorrect
      };
    });

    // Create attempt
    const attempt = new Attempt({
      quizId: quiz._id,
      userIdentifier,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      responses: detailedResponses,
      startedAt: new Date(startedAt),
      submittedAt: new Date(),
      score,
      totalQuestions: quiz.questions.length
    });

    await attempt.save();

    res.json({
      message: 'Quiz submitted successfully',
      score,
      totalQuestions: quiz.questions.length,
      percentage: ((score / quiz.questions.length) * 100).toFixed(2),
      responses: detailedResponses
    });
  } catch (error) {
    console.error('Submit attempt error:', error);
    res.status(500).json({ error: 'Server error while submitting quiz' });
  }
};

// Get all attempts for a quiz (creator only)
exports.getQuizAttempts = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ _id: quizId, creatorId: req.userId });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const attempts = await Attempt.find({ quizId })
      .select('userIdentifier score totalQuestions submittedAt')
      .sort({ submittedAt: -1 });

    const summary = {
      totalAttempts: attempts.length,
      averageScore: attempts.length > 0 
        ? (attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length).toFixed(2)
        : 0,
      attempts: attempts.map(a => ({
        userIdentifier: a.userIdentifier,
        score: a.score,
        totalQuestions: a.totalQuestions,
        percentage: ((a.score / a.totalQuestions) * 100).toFixed(2),
        submittedAt: a.submittedAt
      }))
    };

    res.json(summary);
  } catch (error) {
    console.error('Get attempts error:', error);
    res.status(500).json({ error: 'Server error while fetching attempts' });
  }
};