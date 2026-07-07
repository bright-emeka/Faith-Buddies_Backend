import express from 'express';
import {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  me,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/jwtAuth.js';
import { authLimiter, registerLimiter, passwordResetLimiter, apiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', authLimiter, login);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);
router.post('/refresh', refreshToken);
router.get('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

export default router;
