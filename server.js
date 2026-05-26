import express from 'express';
import cors from 'cors';
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

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
const allowedOrigins = [];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
// Allow localhost:3000 in development (non-production)
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000');
}

const corsOptions = {
  origin: allowedOrigins,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Import Routes
const chatRoutes = require('./routes/chat');
const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');
const interactionsRoutes = require('./routes/interactions');
const followsRoutes = require('./routes/follows');

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
    console.error('❌ ERROR: No frontend build folder found in standalone backend repo.');
    console.log('Targeted path:', staticPath);
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
  console.log(`🚀 Faith Buddies API active on port ${PORT}`); // Swapped log name to match your new branding! 😄
  console.log('Environment:', process.env.NODE_ENV || 'development');
});