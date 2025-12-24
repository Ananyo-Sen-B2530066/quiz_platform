const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require authentication
router.use(auth);

// Quiz CRUD
router.post('/', quizController.createQuiz);
router.get('/', quizController.getMyQuizzes);
router.get('/:id', quizController.getQuizById);
router.delete('/:id', quizController.deleteQuiz);
router.patch('/:id/lock', quizController.toggleLock);

// Question management
router.post('/:quizId/questions', upload.single('media'), quizController.addQuestion);
router.put('/:quizId/questions/:questionId', upload.single('media'), quizController.updateQuestion);
router.delete('/:quizId/questions/:questionId', quizController.deleteQuestion);

module.exports = router;