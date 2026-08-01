import { auth } from 'firebase-admin';

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
    try {
      decoded = await auth().verifyIdToken(accessToken);
    } catch (jwtError) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    if (!decoded || !decoded.uid) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    req.user = decoded;
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
      const decoded = await auth().verifyIdToken(accessToken);
      if (decoded && decoded.uid) {
        req.user = decoded;
      }
    } catch (jwtError) {
      next();
      return;
    }

    next();
  } catch (error) {
    next();
  }
};