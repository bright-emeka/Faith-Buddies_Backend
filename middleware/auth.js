import { auth } from '../config/firebase.js';

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 1. Handle missing header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ DEV MODE: Bypassing auth with dev-user-demo');
        req.user = { uid: 'dev-user-demo', email: 'dev@example.com' }; 
        return next();
      }
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];

    // 2. Verify the token
    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = decodedToken;
      console.log('✅ Auth success, UID:', decodedToken.uid);
      next();
    } catch (verifyError) {
      // 3. Dev mode fallback for specific token
      if (process.env.NODE_ENV !== 'production' && token === 'dev-token') {
        console.warn('⚠️ DEV MODE: Using dev token fallback');
        req.user = { uid: 'dev-user-demo', email: 'dev@example.com' };
        return next();
      }
      
      // If we are here, the token is invalid or expired
      console.error('❌ Token verification failed:', verifyError.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
    
  } catch (error) {
    console.error('🔥 Critical middleware error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

export { verifyToken };