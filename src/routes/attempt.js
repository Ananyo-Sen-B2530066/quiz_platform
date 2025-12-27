const express = require('express');
const router = express.Router();
const attemptController = require('../controllers/attemptController');
const auth = require('../middleware/auth');

// Public routes (for quiz takers)
router.get('/quiz/:token', attemptController.getQuizByToken);
router.post('/quiz/:token/check', attemptController.checkAttempt);
router.post('/quiz/:token/submit', attemptController.submitAttempt);

// Protected routes (for quiz creators)
router.get('/results/:quizId', auth, attemptController.getQuizAttempts);
router.get('/attempt/:attemptId', auth, attemptController.getAttemptDetails);
router.delete('/:attemptId', auth, attemptController.deleteAttempt);  

module.exports = router;
