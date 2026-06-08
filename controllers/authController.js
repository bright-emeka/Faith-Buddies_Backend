import User from '../models/User.js';
import { hashPassword, comparePassword, generateToken } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

export const register = async (req, res, next) => {
  try {
    const { email, password, name, religion } = req.body;

   if (!email || !password || !name || !religion) {
      return res.status(400).json({ message: 'Email, password, name, and religion are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists with this email' });
    }

    const passwordHash = await hashPassword(password);
    const emailVerificationToken = generateToken(32);
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const uid = `user_${generateToken(16)}`;

    const user = new User({
      uid,
      email,
      name,
      passwordHash,
      religion,
      emailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
      authProvider: 'native',
    });

    await user.save();

    const accessToken = generateAccessToken(user.uid);
    const refreshToken = generateRefreshToken(user.uid);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(201).json({
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
        authProvider: user.authProvider,
        emailVerified: user.emailVerified,
      },
      accessToken,
      emailVerificationToken,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.authProvider === 'firebase') {
      return res.status(401).json({ message: 'Please use Firebase authentication or set a native password' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ message: 'No password set. Please use Firebase authentication or reset your password.' });
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user.uid);
    const refreshToken = generateRefreshToken(user.uid);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
        authProvider: user.authProvider,
        emailVerified: user.emailVerified,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await User.findOne({ emailVerificationToken: token });
    if (!user) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }

    if (user.emailVerificationExpires < new Date()) {
      return res.status(400).json({ message: 'Verification token has expired' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordResetToken = generateToken(32);
    const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);

    user.passwordResetToken = passwordResetToken;
    user.passwordResetExpires = passwordResetExpires;
    await user.save();

    res.json({
      message: 'Password reset token generated',
      passwordResetToken,
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const user = await User.findOne({ passwordResetToken: token });
    if (!user) {
      return res.status(400).json({ message: 'Invalid reset token' });
    }

    if (user.passwordResetExpires < new Date()) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }

    user.passwordHash = await hashPassword(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (jwtError) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findOne({ uid: decoded.sub });
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const newAccessToken = generateAccessToken(user.uid);
    const newRefreshToken = generateRefreshToken(user.uid);

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    next(error);
  }
};

export const logout = (req, res) => {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.json({ message: 'Logged out successfully' });
};

export const me = async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.user.uid }).select('-passwordHash -emailVerificationToken -passwordResetToken');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      authProvider: user.authProvider,
      emailVerified: user.emailVerified,
    });
  } catch (error) {
    next(error);
  }
};
