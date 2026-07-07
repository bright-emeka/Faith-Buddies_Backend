import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { auth } from '../config/firebase.js';

const getBearerToken = (header) => {
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^\s*Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = req.cookies?.accessToken || getBearerToken(authHeader);

    if (!accessToken) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    let decoded;
    let isNativeAuth = false;

    try {
      decoded = verifyAccessToken(accessToken);
      isNativeAuth = true;
    } catch (jwtError) {
      try {
        decoded = await auth.verifyIdToken(accessToken);
      } catch (firebaseError) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      }
    }

    const user = await User.findOne({ uid: decoded.uid || decoded.sub }).select('-passwordHash -emailVerificationToken -passwordResetToken');
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    req.user = {
      uid: user.uid,
      email: user.email,
      name: user.name,
      authProvider: user.authProvider,
      isNativeAuth,
    };

    if (!isNativeAuth && user.authProvider === 'firebase') {
      res.setHeader('X-Auth-Upgrade-Required', 'true');
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = req.cookies?.accessToken || getBearerToken(authHeader);

    if (!accessToken) {
      return next();
    }

    try {
      const decoded = verifyAccessToken(accessToken);
      const user = await User.findOne({ uid: decoded.sub }).select('-passwordHash -emailVerificationToken -passwordResetToken');
      if (user) {
        req.user = {
          uid: user.uid,
          email: user.email,
          name: user.name,
          authProvider: user.authProvider,
          isNativeAuth: true,
        };
      }
      return next();
    } catch (jwtError) {
      try {
        const decoded = await auth.verifyIdToken(accessToken);
        const user = await User.findOne({ uid: decoded.uid }).select('-passwordHash -emailVerificationToken -passwordResetToken');
        if (user) {
          req.user = {
            uid: user.uid,
            email: user.email,
            name: user.name,
            authProvider: user.authProvider,
            isNativeAuth: false,
          };
        }
        return next();
      } catch (firebaseError) {
        return next();
      }
    }
  } catch (error) {
    console.error('Optional authentication error:', error);
    next();
  }
};
