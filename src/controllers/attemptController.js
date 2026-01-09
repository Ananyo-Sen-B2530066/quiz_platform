const Quiz = require('../models/Quiz');
const Attempt = require('../models/Attempt');

// Get quiz for taking (public access via token)
exports.getQuizByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const quiz = await Quiz.findOne({ shareableToken: token })
      .select('title description timeLimit isLocked isStarted rules questions');

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
      isImportant: q.isImportant,
      points: q.points || { correct: 1, wrong: 0, unattempted: 0 },
      clues: q.clues || [],  // ADD THIS
      level: q.level || 1,   // ADD THIS
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
        isStarted: quiz.isStarted,  
        rules: quiz.rules || '', 
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

    // Calculate score with point system
    let totalScore = 0;
    let maxScore = 0;

    const detailedResponses = responses.map(response => {
      const question = quiz.questions.id(response.questionId);
      if (!question) return response;

      const points = question.points || { correct: 1, wrong: 0, unattempted: 0 };
      maxScore += points.correct;

      let isCorrect = false;
      let earnedPoints = 0;
      let correctAnswer = null;
      let userAnswer = null;
      let status = 'unattempted';

      if (question.questionType === 'text') {
  // Parse accepted answers if stored as JSON string
  let acceptedAnswers = [];
  try {
    acceptedAnswers = JSON.parse(question.correctAnswer);
  } catch (e) {
    acceptedAnswers = [question.correctAnswer];
  }

  // Convert user answer to uppercase for comparison
  const userTextAnswer = response.textAnswer?.trim().toUpperCase() || '';
  
  // Compare with uppercase accepted answers
  isCorrect = acceptedAnswers.some(ans => 
    ans.toUpperCase().trim() === userTextAnswer
  );

  correctAnswer = acceptedAnswers;
  userAnswer = response.textAnswer;
  
  if (response.textAnswer && response.textAnswer.trim()) {
    status = isCorrect ? 'correct' : 'wrong';
    earnedPoints = isCorrect ? points.correct : points.wrong;
  } else {
    earnedPoints = points.unattempted;
  }

} else if (question.questionType === 'mcq') {
        if (response.selectedOptions && response.selectedOptions.length > 0) {
          const selectedOption = question.options.id(response.selectedOptions[0]);
          isCorrect = selectedOption?.isCorrect || false;
          status = isCorrect ? 'correct' : 'wrong';
          earnedPoints = isCorrect ? points.correct : points.wrong;

          // Store what they selected vs what was correct
          userAnswer = selectedOption ? selectedOption.text : null;
          const correctOption = question.options.find(opt => opt.isCorrect);
          correctAnswer = correctOption ? correctOption.text : null;
        } else {
          earnedPoints = points.unattempted;
        }

      } else if (question.questionType === 'msq') {
        const correctOptionIds = question.options
          .filter(opt => opt.isCorrect)
          .map(opt => opt._id.toString());
        
        if (response.selectedOptions && response.selectedOptions.length > 0) {
          const selectedOptionIds = response.selectedOptions.map(id => id.toString());
          
          isCorrect = correctOptionIds.length === selectedOptionIds.length &&
                      correctOptionIds.every(id => selectedOptionIds.includes(id));
          
          status = isCorrect ? 'correct' : 'wrong';
          earnedPoints = isCorrect ? points.correct : points.wrong;

          // Store what they selected vs what was correct
          userAnswer = question.options
            .filter(opt => selectedOptionIds.includes(opt._id.toString()))
            .map(opt => opt.text);
          correctAnswer = question.options
            .filter(opt => opt.isCorrect)
            .map(opt => opt.text);
        } else {
          earnedPoints = points.unattempted;
        }
      }

      totalScore += earnedPoints;

      return {
        questionId: response.questionId,
        questionText: question.questionText,
        questionType: question.questionType,
        isImportant: question.isImportant,
        questionLevel: question.level || 1,
        selectedOptions: response.selectedOptions,
        textAnswer: response.textAnswer,
        isCorrect,
        status,
        earnedPoints,
        maxPoints: points.correct,
        userAnswer,
        correctAnswer
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
      score: totalScore,
      maxScore: maxScore,
      totalQuestions: quiz.questions.length,
      flaggedQuestions: req.body.flaggedQuestions || [] // array of question indices
    });

    await attempt.save();

    res.json({
      message: 'Quiz submitted successfully',
      score: totalScore,
      maxScore: maxScore,
      totalQuestions: quiz.questions.length,
      percentage: maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(2) : 0,
      responses: detailedResponses
    });
  } catch (error) {
    console.error('Submit attempt error:', error);
    res.status(500).json({ error: 'Server error while submitting quiz' });
  }
};

// Get all attempts for a quiz (creator only)
// Add this updated method to attemptController.js

exports.getQuizAttempts = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ _id: quizId, creatorId: req.userId });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const attempts = await Attempt.find({ quizId })
      .select('userIdentifier score maxScore totalQuestions submittedAt startedAt responses')
      .sort({ submittedAt: -1 });

    const summary = {
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        timeLimit: quiz.timeLimit,
        questionCount: quiz.questions.length,
        createdAt: quiz.createdAt
      },
      totalAttempts: attempts.length,
      averageScore: attempts.length > 0 
        ? (attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length).toFixed(2)
        : 0,
      averagePercentage: attempts.length > 0
        ? (attempts.reduce((sum, a) => sum + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0), 0) / attempts.length).toFixed(2)
        : 0,
      attempts: attempts.map(a => ({
        id: a._id,
        userIdentifier: a.userIdentifier,
        score: a.score,
        maxScore: a.maxScore,
        totalQuestions: a.totalQuestions,
        percentage: a.maxScore > 0 ? ((a.score / a.maxScore) * 100).toFixed(2) : 0,
        submittedAt: a.submittedAt,
        startedAt: a.startedAt,
        responses: a.responses // Include detailed responses for ranking
      }))
    };

    res.json(summary);
  } catch (error) {
    console.error('Get attempts error:', error);
    res.status(500).json({ error: 'Server error while fetching attempts' });
  }
};

// Get single attempt details (creator only)
exports.getAttemptDetails = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await Attempt.findById(attemptId).populate('quizId');
    
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Verify the quiz belongs to the requesting user
    const quiz = await Quiz.findOne({ _id: attempt.quizId, creatorId: req.userId });
    if (!quiz) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      attempt: {
        id: attempt._id,
        userIdentifier: attempt.userIdentifier,
        score: attempt.score,
        maxScore: attempt.maxScore,
        totalQuestions: attempt.totalQuestions,
        percentage: attempt.maxScore > 0 ? ((attempt.score / attempt.maxScore) * 100).toFixed(2) : 0,
        submittedAt: attempt.submittedAt,
        responses: attempt.responses
      },
      quiz: {
        title: quiz.title,
        description: quiz.description
      }
    });
  } catch (error) {
    console.error('Get attempt details error:', error);
    res.status(500).json({ error: 'Server error while fetching attempt details' });
  }
};

// Delete attempt (creator only)
exports.deleteAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await Attempt.findById(attemptId);
    
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Verify the quiz belongs to the requesting user
    const quiz = await Quiz.findOne({ _id: attempt.quizId, creatorId: req.userId });
    if (!quiz) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Attempt.findByIdAndDelete(attemptId);

    res.json({ message: 'Attempt deleted successfully' });
  } catch (error) {
    console.error('Delete attempt error:', error);
    res.status(500).json({ error: 'Server error while deleting attempt' });
  }
};
