# Quiz Platform

A full-featured quiz platform with support for multiple question types, media attachments, and real-time scoring.

## Features

- 🔐 User authentication (signup/login)
- 📝 Create quizzes with multiple question types (MCQ, MSQ, Text)
- 🎨 Media support (images, videos, audio)
- ⏱️ Timed quizzes
- 🔗 Shareable quiz links
- 📊 View quiz results and analytics
- 🔒 Lock/unlock quizzes

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: MongoDB
- **File Storage**: Cloudinary
- **Authentication**: JWT

## Local Development

1. Clone the repository:
```bash
git clone <your-repo-url>
cd quiz-platform
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/quiz-platform
JWT_SECRET=your_super_secret_key_change_this
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

4. Start MongoDB locally

5. Run the application:
```bash
npm start
```

6. Open browser at `http://localhost:5000`

## Deployment

### Deploy to Render

1. Push your code to GitHub
2. Create account on [Render](https://render.com)
3. Create new Web Service
4. Connect your GitHub repository
5. Add environment variables
6. Deploy!

### Deploy to Railway

1. Push your code to GitHub
2. Create account on [Railway](https://railway.app)
3. Create new project from GitHub repo
4. Add MongoDB service
5. Add environment variables
6. Deploy!

## Project Structure

```
quiz-platform/
├── src/
│   ├── config/
│   │   └── cloudinary.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── quizController.js
│   │   └── attemptController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Quiz.js
│   │   └── Attempt.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── quiz.js
│   │   └── attempt.js
│   └── server.js
├── public/
│   ├── index.html
│   ├── dashboard.html
│   ├── create-quiz.html
│   ├── take-quiz.html
│   ├── edit-quiz.html
│   ├── view-attempt.html
│   └── leaderboard.html
├── package.json
├── .gitignore
├── .env
└── README.md
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

## License

MIT
