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
      const userData = existing.data();
      // Ensure uid field matches document ID
      if (userData.uid !== uid) {
        console.warn(`UID mismatch: document=${uid}, field=${userData.uid}. Fixing...`);
        await userDoc.update({ uid });
      }
      return res.status(200).json({ message: 'User already exists', user: { uid, ...userData } });
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
      const existing = userDoc.data();
      console.log(`Syncing existing user ${uid}`);
      
      // Ensure uid matches and all required fields exist
      const mergedData = {
        ...existing,
        ...updateData,
        uid, // Force uid to match document ID
        updatedAt: new Date(),
      };
      
      // Ensure required fields exist
      if (!mergedData.followersCount) mergedData.followersCount = 0;
      if (!mergedData.followingCount) mergedData.followingCount = 0;
      if (!mergedData.postsCount) mergedData.postsCount = 0;
      if (!mergedData.authProvider) mergedData.authProvider = 'firebase';
      
      await userRef.set(mergedData);
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
    const requestedUid = req.params.uid || req.user?.uid;
    
    if (!requestedUid) {
      return res.status(400).json({ error: 'UID is required' });
    }

    let userDoc = await db.collection('users').doc(requestedUid).get();
    
    // If user not found and this is an authenticated request for their own profile
    if (!userDoc.exists && req.user && req.user.uid === requestedUid) {
      console.log(`Profile missing for authenticated user ${requestedUid}. Auto-creating...`);
      
      // Import admin auth to get user details
      const { auth } = require('../config/firebase.js');
      
      try {
        const firebaseUser = await auth().getUser(requestedUid);
        
        const profileData = {
          uid: requestedUid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'New Believer',
          avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'New Believer')}&background=random`,
          bio: 'Faithful believer sharing wisdom and inspiration',
          religion: 'Christian',
          authProvider: 'firebase',
          emailVerified: firebaseUser.emailVerified || false,
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        await db.collection('users').doc(requestedUid).set(profileData);
        console.log(`✅ Auto-created profile for ${requestedUid}`);
        return res.status(201).json(profileData);
      } catch (authError) {
        console.error(`Failed to auto-create profile for ${requestedUid}:`, authError);
        return res.status(404).json({ error: 'User not found', uid: requestedUid });
      }
    }
    
    if (!userDoc.exists) {
      console.error(`User not found: ${requestedUid}`);
      return res.status(404).json({ error: 'User not found', uid: requestedUid });
    }

    const data = userDoc.data();
    const { passwordHash, emailVerificationToken, passwordResetToken, ...safeData } = data;
    
    // Ensure uid field matches document ID
    if (safeData.uid !== requestedUid) {
      console.warn(`UID mismatch: document=${requestedUid}, field=${safeData.uid}. Fixing...`);
      safeData.uid = requestedUid;
      await userDoc.ref.update({ uid: requestedUid });
    }

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
      // Ensure uid field matches document ID
    if (safeData.uid !== doc.id) {
      console.warn(`UID mismatch in response: document=${doc.id}, field=${safeData.uid}`);
    }
    return { uid: doc.id, ...safeData };
    });

    res.json({ users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users', details: error.message });
  }
};

export const repairUserUids = async (req, res) => {
  try {
    // Verify admin (optional - you can skip auth for this in development)
    const isAdmin = req.user?.email?.endsWith('@admin.com') || process.env.NODE_ENV === 'development';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Unauthorized: Admin only' });
    }

    console.log('🔧 Starting UID repair process...');
    
    const usersSnapshot = await db.collection('users').get();
    const repairs = [];
    let fixed = 0;
    let checked = 0;

    for (const doc of usersSnapshot.docs) {
      checked++;
      const data = doc.data();
      const docId = doc.id;

      // Check if uid field matches document ID
      if (data.uid !== docId) {
        console.warn(`🔴 UID mismatch found: docId=${docId}, uid=${data.uid}`);
        repairs.push({
          docId,
          oldUid: data.uid,
          newUid: docId,
          name: data.name || 'Unknown',
        });

        // Fix the UID
        await doc.ref.update({ uid: docId });
        fixed++;
      }
    }

    console.log(`✅ UID repair complete: checked=${checked}, fixed=${fixed}`);
    res.json({
      status: 'Repair complete',
      checked,
      fixed,
      repairs,
    });
  } catch (error) {
    console.error('Error repairing UIDs:', error);
    res.status(500).json({ error: 'Failed to repair UIDs', details: error.message });
  }
};

export const migrateFirebaseUsers = async (req, res) => {
  try {
    console.log('Starting Firebase Auth users migration...');
    
    const { auth } = require('../config/firebase.js');
    
    let created = 0;
    let skipped = 0;
    let failed = 0;
    const migrations = [];
    const errors = [];

    // Get all users from Firebase Auth (paginated)
    let nextPageToken = undefined;
    let totalProcessed = 0;

    do {
      const result = await auth().listUsers(100, nextPageToken);
      
      for (const user of result.users) {
        totalProcessed++;
        try {
          const userDoc = await db.collection('users').doc(user.uid).get();
          
          if (userDoc.exists) {
            // User already has a Firestore document, skip
            skipped++;
            continue;
          }

          // Create missing Firestore document
          const profileData = {
            uid: user.uid,
            email: user.email || '',
            name: user.displayName || 'New Believer',
            avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'New Believer')}&background=random`,
            bio: 'Faithful believer sharing wisdom and inspiration',
            religion: 'Christian',
            authProvider: user.providerData[0]?.providerId || 'firebase',
            emailVerified: user.emailVerified || false,
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await db.collection('users').doc(user.uid).set(profileData);
          created++;
          migrations.push({
            uid: user.uid,
            email: user.email,
            name: user.displayName,
            status: 'created',
          });
          console.log(`✅ Created profile for ${user.uid} (${user.email})`);
        } catch (error) {
          failed++;
          errors.push({
            uid: user.uid,
            email: user.email,
            error: error.message,
          });
          console.error(`❌ Failed to create profile for ${user.uid}:`, error);
        }
      }

      nextPageToken = result.pageToken;
    } while (nextPageToken);

    console.log(`✅ Migration complete: created=${created}, skipped=${skipped}, failed=${failed}, total=${totalProcessed}`);
    
    res.json({
      status: 'Migration complete',
      summary: {
        totalProcessed,
        created,
        skipped,
        failed,
      },
      migrations,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error migrating Firebase users:', error);
    res.status(500).json({ error: 'Failed to migrate Firebase users', details: error.message });
  }
};