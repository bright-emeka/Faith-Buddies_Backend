import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import admin from 'firebase-admin';
import { apiLimiter } from './middleware/rateLimiter.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ----------------------------------------------------
// 🔌 1. INITIALIZE FIREBASE ADMIN SDK
// ----------------------------------------------------
// Option A: Using environment variable for service account key (Recommended for Render)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  // Option B: Fallback to local serviceAccountKey.json or application default
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();
console.log('✅ Firebase Admin SDK initialized successfully!');

// ----------------------------------------------------
// 🛡️ 2. MIDDLEWARE & CORS CONFIGURATION
// ----------------------------------------------------
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

// ----------------------------------------------------
// 🚀 3. API ROUTES
// Note: Import & update your route handlers to use Firestore/Firebase Auth
// ----------------------------------------------------
// import authRoutes from './routes/auth.js';
// import chatRoutes from './routes/chat.js';
// import usersRoutes from './routes/users.js';
// import postsRoutes from './routes/posts.js';

// app.use('/api/auth', authRoutes);
// app.use('/api/chat', chatRoutes);
// app.use('/api/users', usersRoutes);
// app.use('/api/posts', postsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    database: 'Firebase Firestore',
    timestamp: new Date().toISOString() 
  });
});

// ----------------------------------------------------
// 🌐 4. SERVE FRONTEND (IF APPLICABLE)
// ----------------------------------------------------
const __dirname = path.resolve();
const frontendPath = path.join(__dirname, 'frontend');
const distPath = path.join(frontendPath, 'dist');
const buildPath = path.join(frontendPath, 'build');

const staticPath = fs.existsSync(distPath) ? distPath : buildPath;

if (fs.existsSync(staticPath)) {
  console.log(`✅ Production Build Found: ${staticPath}`);
  app.use(express.static(staticPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  if (process.env.NODE_ENV === 'production') {
    console.log('ℹ️ Standalone Mode: Serving API endpoints exclusively.');
  } else {
    console.log('ℹ️ Local Dev Mode: API is live.');
  }
}

// ----------------------------------------------------
// ⚠️ 5. ERROR HANDLING & START SERVER
// ----------------------------------------------------
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Faith Buddies API active on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
});