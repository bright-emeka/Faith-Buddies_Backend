import { db } from '../config/firebase.js';

export const followUser = async (req, res) => {
  try {
    const followerId = req.user.uid;
    const { uid: followingId } = req.params;

    if (followingId === followerId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const followerDoc = await db.collection('users').doc(followerId).get();
    const followingDoc = await db.collection('users').doc(followingId).get();

    if (!followerDoc.exists || !followingDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const followDoc = db.collection('follows').doc(`${followerId}_${followingId}`);
    const existing = await followDoc.get();

    if (existing.exists) {
      return res.json({ following: true, message: 'User already followed' });
    }

    await followDoc.set({
      followerId,
      followingId,
      createdAt: new Date(),
    });

    await db.collection('users').doc(followerId).update({
      followingCount: (followerDoc.data()?.followingCount || 0) + 1,
    });

    await db.collection('users').doc(followingId).update({
      followersCount: (followingDoc.data()?.followersCount || 0) + 1,
    });

    const postSnapshot = await db.collection('posts')
      .where('userId', '==', followingId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const batch = db.batch();
    for (const postDoc of postSnapshot.docs) {
      batch.set(db.collection('users').doc(followerId).collection('feed').doc(postDoc.id), {
        postId: postDoc.id,
        userId: followingId,
        content: postDoc.data().content,
        image: postDoc.data().image,
        likesCount: postDoc.data().likesCount,
        commentsCount: postDoc.data().commentsCount,
        createdAt: postDoc.data().createdAt,
      });
    }
    await batch.commit();

    res.json({ following: true, message: 'User followed' });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
};

export const unfollowUser = async (req, res) => {
  try {
    const followerId = req.user.uid;
    const { uid: followingId } = req.params;

    if (followingId === followerId) {
      return res.status(400).json({ error: 'Cannot unfollow yourself' });
    }

    const followDoc = db.collection('follows').doc(`${followerId}_${followingId}`);
    const existing = await followDoc.get();

    if (!existing.exists) {
      return res.json({ following: false, message: 'User not followed' });
    }

    await followDoc.delete();

    const followerDoc = await db.collection('users').doc(followerId).get();
    const followingDoc = await db.collection('users').doc(followingId).get();

    await db.collection('users').doc(followerId).update({
      followingCount: Math.max((followerDoc.data()?.followingCount || 0) - 1, 0),
    });

    await db.collection('users').doc(followingId).update({
      followersCount: Math.max((followingDoc.data()?.followersCount || 0) - 1, 0),
    });

    const feedDoc = db.collection('users').doc(followerId).collection('feed').doc(followingId);
    await feedDoc.delete();

    res.json({ following: false, message: 'User unfollowed' });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
};

export const toggleFollow = async (req, res) => {
  try {
    const followerId = req.user.uid;
    const { targetUserId } = req.params;

    if (targetUserId === followerId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const followDoc = db.collection('follows').doc(`${followerId}_${targetUserId}`);
    const existing = await followDoc.get();

    if (existing.exists) {
      await followDoc.delete();
      const followerDoc = await db.collection('users').doc(followerId).get();
      const followingDoc = await db.collection('users').doc(targetUserId).get();
      await db.collection('users').doc(followerId).update({
        followingCount: Math.max((followerDoc.data()?.followingCount || 0) - 1, 0),
      });
      await db.collection('users').doc(targetUserId).update({
        followersCount: Math.max((followingDoc.data()?.followersCount || 0) - 1, 0),
      });
      const feedDoc = db.collection('users').doc(followerId).collection('feed').doc(targetUserId);
      await feedDoc.delete();
      return res.json({ following: false, message: 'User unfollowed' });
    }

    const targetDoc = await db.collection('users').doc(targetUserId).get();
    if (!targetDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    await followDoc.set({
      followerId,
      followingId: targetUserId,
      createdAt: new Date(),
    });

    await db.collection('users').doc(followerId).update({
      followingCount: (followerDoc.data()?.followingCount || 0) + 1,
    });
    await db.collection('users').doc(targetUserId).update({
      followersCount: (targetDoc.data()?.followersCount || 0) + 1,
    });

    const postSnapshot = await db.collection('posts')
      .where('userId', '==', targetUserId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const batch = db.batch();
    for (const postDoc of postSnapshot.docs) {
      batch.set(db.collection('users').doc(followerId).collection('feed').doc(postDoc.id), {
        postId: postDoc.id,
        userId: targetUserId,
        content: postDoc.data().content,
        image: postDoc.data().image,
        likesCount: postDoc.data().likesCount,
        commentsCount: postDoc.data().commentsCount,
        createdAt: postDoc.data().createdAt,
      });
    }
    await batch.commit();

    res.json({ following: true, message: 'User followed' });
  } catch (error) {
    console.error('Error toggling follow:', error);
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
};

export const getFollowStatus = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { targetUserId } = req.params;

    const followDoc = await db.collection('follows').doc(`${uid}_${targetUserId}`).get();

    res.json({ following: followDoc.exists });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({ error: 'Failed to check follow status' });
  }
};

export const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 50;

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const followSnapshot = await db.collection('follows')
      .where('followingId', '==', userId)
      .limit(Math.min(limit, 100))
      .get();

    const followerIds = followSnapshot.docs.map((doc) => doc.data().followerId);

    const followerDocs = await Promise.all(
      followerIds.map((id) => db.collection('users').doc(id).get())
    );

    const followers = followerDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({ uid: doc.id, ...doc.data() }));

    res.json(followers);
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
};

export const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 50;

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const followSnapshot = await db.collection('follows')
      .where('followerId', '==', userId)
      .limit(Math.min(limit, 100))
      .get();

    const followingIds = followSnapshot.docs.map((doc) => doc.data().followingId);

    const followingDocs = await Promise.all(
      followingIds.map((id) => db.collection('users').doc(id).get())
    );

    const following = followingDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({ uid: doc.id, ...doc.data() }));

    res.json(following);
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
};