import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import { apiLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import usersRoutes from './routes/users.js';
import postsRoutes from './routes/posts.js';
import interactionsRoutes from './routes/interactions.js';
import followsRoutes from './routes/follows.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Load environment variables
dotenv.config();

// 🔌 2. CONNECT TO MONGO_DB ATLAS
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully to Faith Buddies!');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

// Middleware
// CORS configuration
const allowedOrigins = [
  'http://localhost',
  'http://localhost:3000',
  'capacitor://localhost',
  'https://faith-buddies-frontend.vercel.app',
  'https://your-frontend-domain.com'
];

if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS Policy: Not allowed by server'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Rate limiting
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/user', usersRoutes); // alias for mobile frontend route expectation
app.use('/api/posts', postsRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/follows', followsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// --- SERVE FRONTEND FROM LOCAL STANDALONE REPO ---
const __dirname = path.resolve();
const frontendPath = path.join(__dirname, 'frontend');
const distPath = path.join(frontendPath, 'dist');
const buildPath = path.join(frontendPath, 'build');

// Check which production folder exists (Vite defaults to dist)
const staticPath = fs.existsSync(distPath) ? distPath : buildPath;

if (fs.existsSync(staticPath)) {
  console.log(`✅ Production Build Found: ${staticPath}`);
  app.use(express.static(staticPath));

  // Catch-all route: Essential for React Router to work on refresh
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  // Graceful logs based on environment
  if (process.env.NODE_ENV === 'production') {
    console.log('ℹ️ Standalone Mode: No local frontend folder found. Serving API endpoints exclusively.');
  } else {
    console.log('ℹ️ Local Dev Mode: API is live. Frontend is served by Vite on a separate process.');
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Faith Buddies API active on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
});