// Main Express server
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose'; // 👈 1. IMPORT MONGOOSE

// ES Module path fixes
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Routes
import chatRoutes from './routes/chat.js';
import usersRoutes from './routes/users.js';
import postsRoutes from './routes/posts.js';
import interactionsRoutes from './routes/interactions.js';
import followsRoutes from './routes/follows.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 🔌 2. CONNECT TO MONGO_DB ATLAS
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully to Faith Buddies!');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/follows', followsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// --- SERVE FRONTEND (Optimized Monorepo Fix) ---
const currentDir = process.cwd();

// Robust root detection: 
// Ensures we find 'frontend' whether started from / or /backend
const rootDir = currentDir.endsWith('backend') 
  ? path.resolve(currentDir, '..') 
  : currentDir;

const frontendPath = path.join(rootDir, 'frontend');
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
    console.error('❌ ERROR: No frontend build folder found.');
    console.log('Targeted path:', staticPath);
  } else {
    console.log('ℹ️ Local Dev Mode: API is live. Frontend is served by Vite (Port 3000).');
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
  console.log(`🚀 Faith Buddies API active on port ${PORT}`); // Swapped log name to match your new branding! 😄
  console.log('Environment:', process.env.NODE_ENV || 'development');
});