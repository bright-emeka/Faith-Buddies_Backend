import User from '../models/User.js';
import express from 'express';
import { authenticate } from '../middleware/jwtAuth.js';
const router = express.Router();

router.post('/sync', authenticate, async (req, res) => {
  try {
    const { uid: firebaseUid, email: tokenEmail } = req.user;
    const { name, email, bio, avatar, religion } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ error: 'Firebase UID not found in token' });
    }

    const userEmail = email || tokenEmail || '';
    const finalName = name || userEmail.split('@')[0] || 'New Believer';
    const finalAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(finalName)}&background=random`;

    const updateData = {
      firebaseUid,
      uid: firebaseUid,
      name: finalName,
      email: userEmail,
      avatar: finalAvatar,
      religion: religion || 'Christian',
      bio: bio || 'Faithful believer sharing wisdom and inspiration',
    };

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    console.log(`✨ Profile synced for Firebase UID: ${firebaseUid}`);
    res.json(user);
  } catch (error) {
    console.error('Error syncing user profile:', error);
    res.status(500).json({ error: 'Failed to sync user profile', details: error.message });
  }
});

router.get('/profile', authenticate, async (req, res) => {
  try {
    const { uid: userId } = req.user;

    const user = await User.findOne({ uid: userId });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile', details: error.message });
  }
});

router.post('/profile', authenticate, async (req, res) => {
  try {
    const { uid: userId } = req.user;
    const { name, email, bio, avatar, religion } = req.body;

    const defaultName = name || 'New Believer';
    const defaultAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=random`;

    const user = await User.findOneAndUpdate(
      { uid: userId },
      { 
        $setOnInsert: { 
          uid: userId,
          name: defaultName,
          email: email || '',
          avatar: defaultAvatar,
          religion: religion || 'Christian'
        },
        $set: {
          bio: bio || 'Faithful believer sharing wisdom and inspiration'
        }
      },
      { 
        new: true,
        upsert: true,
        runValidators: true 
      }
    );

    res.json(user);

  } catch (error) {
    console.error('Error managing user profile:', error);
    res.status(500).json({ error: 'Failed to manage user profile', details: error.message });
  }
});

export default router;