import { db } from '../config/firebase.js';

export const createPost = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { content, image } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty' });
    }

    const postRef = db.collection('posts').doc();
    const postId = postRef.id;

    const postData = {
      postId,
      userId: uid,
      content: content.trim(),
      image: image || null,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await postRef.set(postData);

    const userDoc = await db.collection('users').doc(uid).get();
    await db.collection('users').doc(uid).update({
      postsCount: (userDoc.data()?.postsCount || 0) + 1,
    });

    res.status(201).json(postData);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
};

export const getFeed = async (req, res) => {
  try {
    const uid = req.user.uid;
    const limit = parseInt(req.query.limit, 10) || 20;
    const lastTimestamp = req.query.lastTimestamp ? new Date(req.query.lastTimestamp) : undefined;

    const followSnapshot = await db.collection('follows')
      .where('followerId', '==', uid)
      .get();

    const followingIds = [uid, ...followSnapshot.docs.map((doc) => doc.data().followingId)];

    let feedQuery = db.collection('users').doc(uid).collection('feed')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (lastTimestamp) {
      feedQuery = feedQuery.startAt(lastTimestamp);
    }

    const feedSnapshot = await feedQuery.get();

    const postIds = feedSnapshot.docs.map((doc) => doc.data().postId);
    const posts = [];

    for (const doc of feedSnapshot.docs) {
      const feedEntry = doc.data();
      const postDoc = await db.collection('posts').doc(feedEntry.postId).get();
      if (postDoc.exists) {
        posts.push({ id: postDoc.id, ...postDoc.data() });
      }
    }

    const userIds = [...new Set(posts.map((post) => post.userId))];
    const userDocs = await Promise.all(
      userIds.map((id) => db.collection('users').doc(id).get())
    );
    const usersMap = new Map(userDocs.map((doc) => [doc.id, doc.data()]));

    const enrichedPosts = posts.map((post) => ({
      ...post,
      author: usersMap.get(post.userId) || null,
    }));

    enrichedPosts.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

    res.json(enrichedPosts);
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const { uid: userId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 20;
    const lastTimestamp = req.query.lastTimestamp ? new Date(req.query.lastTimestamp) : undefined;

    let query = db.collection('posts')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (lastTimestamp) {
      query = query.startAt(lastTimestamp);
    }

    const snapshot = await query.get();
    const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json(posts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
};

export const getPost = async (req, res) => {
  try {
    const { postId } = req.params;

    const postDoc = await db.collection('posts').doc(postId).get();
    if (!postDoc.exists) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = { id: postDoc.id, ...postDoc.data() };

    const authorDoc = await db.collection('users').doc(post.userId).get();
    post.author = authorDoc.exists ? { uid: authorDoc.id, ...authorDoc.data() } : null;

    const commentsSnapshot = await db.collection('posts').doc(postId).collection('comments')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const comments = commentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const commentUserIds = [...new Set(comments.map((c) => c.userId))];

    const commentUserDocs = await Promise.all(
      commentUserIds.map((id) => db.collection('users').doc(id).get())
    );
    const commentUsersMap = new Map(commentUserDocs.map((doc) => [doc.id, doc.data()]));

    post.comments = comments.map((comment) => ({
      ...comment,
      author: commentUsersMap.get(comment.userId) || null,
    }));

    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const uid = req.user.uid;

    const postDoc = await db.collection('posts').doc(postId).get();
    if (!postDoc.exists) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postDoc.data();
    if (post.userId !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.collection('posts').doc(postId).delete();

    const followersSnapshot = await db.collection('follows')
      .where('followingId', '==', uid)
      .get();

    const batch = db.batch();
    for (const doc of followersSnapshot.docs) {
      batch.delete(db.collection('users').doc(doc.data().followerId).collection('feed').doc(postId));
    }
    await batch.commit();

    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
};