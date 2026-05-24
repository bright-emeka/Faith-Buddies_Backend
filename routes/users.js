// Get or create user profile (using Upsert to prevent duplicate errors)

import User from '../models/User.js';
import express from 'express';
import { verifyToken } from '../middleware/auth.js';
const router = express.Router();




router.post('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { name, email, bio, avatar, religion } = req.body;

    console.log("DEBUG: Upserting user with UID:", userId);

    const defaultName = name || 'New Believer';
    const defaultAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=random`;

    // 🚀 Use findOneAndUpdate with upsert: true
    // This looks for the uid, updates it if found, or creates it if not.
    const user = await User.findOneAndUpdate(
      { uid: userId }, // Search criteria
      { 
        $setOnInsert: { 
          _id: userId, // Set _id only on creation
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
        new: true,   // Return the updated document
        upsert: true, // Create if doesn't exist
        runValidators: true 
      }
    );

    console.log(`✨ Success! Profile synced for UID: ${userId}`);
    res.json(user);

  } catch (error) {
    console.error('Error managing user profile:', error);
    res.status(500).json({ error: 'Failed to manage user profile', details: error.message });
  }
});

export default router;