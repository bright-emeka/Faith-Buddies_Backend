import User from '../models/User.js';
import express from 'express';
import { verifyToken } from '../middleware/auth.js';
const router = express.Router();

router.post('/sync', async (req, res) => {
  try {
    const { firebaseUid, email, name, avatar, religion } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ error: 'firebaseUid and email are required' });
    }

    console.log("DEBUG: Syncing user with Firebase UID:", firebaseUid);

    const defaultName = name || email.split('@')[0] || 'New Believer';
    const defaultAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=random`;

    let user = await User.findOne({ firebaseUid });

    if (!user) {
      user = await User.create({
        firebaseUid,
        uid: firebaseUid,
        name: defaultName,
        email,
        avatar: defaultAvatar,
        religion: religion || 'Christian',
      });
      console.log(`✨ Created new user profile for UID: ${firebaseUid}`);
    } else {
      console.log(`✅ Found existing user profile for UID: ${firebaseUid}`);
    }

    res.json(user);
  } catch (error) {
    console.error('Error syncing user profile:', error);
    res.status(500).json({ error: 'Failed to sync user profile', details: error.message });
  }
});

router.get('/profile', verifyToken, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;

    console.log("DEBUG: Fetching profile for UID:", firebaseUid);

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile', details: error.message });
  }
});

router.post('/profile', verifyToken, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const { name, email, bio, avatar, religion } = req.body;

    console.log("DEBUG: Upserting user with UID:", firebaseUid);

    const defaultName = name || 'New Believer';
    const defaultAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=random`;

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { 
        $setOnInsert: { 
          uid: firebaseUid,
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

    console.log(`✨ Success! Profile synced for UID: ${firebaseUid}`);
    res.json(user);

  } catch (error) {
    console.error('Error managing user profile:', error);
    res.status(500).json({ error: 'Failed to manage user profile', details: error.message });
  }
});

export default router;