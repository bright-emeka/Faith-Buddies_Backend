import { db } from '../config/firebase.js';

export const registerUser = async (req, res) => {
  try {
    // Use the verified UID from the Firebase token, not from request body
    const uid = req.user.uid;
    
    if (!uid) {
      return res.status(400).json({ error: 'Firebase UID is required (use authenticated request)' });
    }

    // Optional: Accept displayName and photoURL from request, but use verified email from token
    const { displayName, photoURL } = req.body;
    const email = req.user.email || '';

    const userDoc = db.collection('users').doc(uid);
    const existing = await userDoc.get();

    if (existing.exists) {
      return res.status(200).json({ message: 'User already exists', user: { uid: existing.id, ...existing.data() } });
    }

    const userData = {
      uid,
      email,
      name: displayName || 'New Believer',
      avatar: photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'New Believer')}&background=random`,
      bio: 'Faithful believer sharing wisdom and inspiration',
      religion: 'Christian',
      authProvider: 'firebase',
      emailVerified: req.user.email_verified || false,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await userDoc.set(userData);

    console.log(`✅ User registered: ${uid}`);
    res.status(201).json({ user: userData });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user', details: error.message });
  }
};

export const syncUserProfile = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { name, email, bio, avatar, religion } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'User UID is required' });
    }

    const defaultName = name || 'New Believer';
    const defaultAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=random`;

    // Build update data with only provided fields
    const updateData = {
      name: defaultName,
      email: email || req.user.email || '',
      avatar: defaultAvatar,
      bio: bio || 'Faithful believer sharing wisdom and inspiration',
      religion: religion || 'Christian',
      updatedAt: new Date(),
    };

    const userRef = db.collection('users').doc(uid);
    
    // Check if user exists
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      // Create document with initial data if it doesn't exist
      console.log(`Creating new user document for ${uid}`);
      const initialData = {
        uid,
        ...updateData,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        authProvider: 'firebase',
        emailVerified: req.user.email_verified || false,
        createdAt: new Date(),
      };
      await userRef.set(initialData);
    } else {
      // Update existing document
      console.log(`Syncing existing user ${uid}`);
      await userRef.update(updateData);
    }

    const synced = await userRef.get();
    console.log(`✅ User synced: ${uid}`);
    res.json({ uid, ...synced.data() });
  } catch (error) {
    console.error('Error syncing profile:', error);
    res.status(500).json({ error: 'Failed to sync profile', details: error.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const requestedUid = req.params.uid || req.user.uid;

    const userDoc = await db.collection('users').doc(requestedUid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const data = userDoc.data();
    const { passwordHash, emailVerificationToken, passwordResetToken, ...safeData } = data;

    res.json(safeData);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const query = (req.query.query || '').toString().trim();
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const snapshot = await db.collection('users')
      .orderBy('name')
      .startAt(query)
      .endAt(query + '\uf8ff')
      .limit(50)
      .get();

    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      const { passwordHash, emailVerificationToken, passwordResetToken, ...safeData } = data;
      return { uid: doc.id, ...safeData };
    });

    res.json({ users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users', details: error.message });
  }
};