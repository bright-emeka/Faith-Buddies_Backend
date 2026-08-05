import { db } from '../config/firebase.js';

export const toggleLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const uid = req.user.uid;

    const likeDoc = db.collection('posts').doc(postId).collection('likes').doc(uid);
    const existing = await likeDoc.get();

    if (existing.exists) {
      await likeDoc.delete();
      await db.collection('posts').doc(postId).update({
        likesCount: (await db.collection('posts').doc(postId).get()).data()?.likesCount - 1 || 0,
      });
      return res.json({ liked: false, message: 'Post unliked' });
    }

    await likeDoc.set({
      userId: uid,
      createdAt: new Date(),
    });

    await db.collection('posts').doc(postId).update({
      likesCount: (await db.collection('posts').doc(postId).get()).data()?.likesCount + 1 || 0,
    });

    res.json({ liked: true, message: 'Post liked' });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
};

export const checkLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const uid = req.user.uid;

    const likeDoc = await db.collection('posts').doc(postId).collection('likes').doc(uid).get();

    res.json({ liked: likeDoc.exists });
  } catch (error) {
    console.error('Error checking like status:', error);
    res.status(500).json({ error: 'Failed to check like status' });
  }
};

export const addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const uid = req.user.uid;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    const commentRef = db.collection('posts').doc(postId).collection('comments').doc();
    const commentId = commentRef.id;

    const userDoc = await db.collection('users').doc(uid).get();
    const commentData = {
      commentId,
      userId: uid,
      content: content.trim(),
      likesCount: 0,
      createdAt: new Date(),
    };

    await commentRef.set(commentData);

    await db.collection('posts').doc(postId).update({
      commentsCount: (await db.collection('posts').doc(postId).get()).data()?.commentsCount + 1 || 0,
    });

    const authorData = userDoc.exists ? userDoc.data() : null;
    const author = authorData ? { uid: userDoc.id, ...authorData } : null;
    res.status(201).json({ ...commentData, author });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

export const getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 20;
    const lastTimestamp = req.query.lastTimestamp ? new Date(req.query.lastTimestamp) : undefined;

    let query = db.collection('posts').doc(postId).collection('comments')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (lastTimestamp) {
      query = query.startAt(lastTimestamp);
    }

    const snapshot = await query.get();
    const comments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const commentUserIds = [...new Set(comments.map((c) => c.userId))];
    const userDocs = await Promise.all(
      commentUserIds.map((id) => db.collection('users').doc(id).get())
    );
    const commentUsersMap = new Map(userDocs.map((doc) => [doc.id, doc.data()]));

    const enrichedComments = comments.map((comment) => ({
      ...comment,
      author: commentUsersMap.get(comment.userId) || null,
    }));

    enrichedComments.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

    res.json(enrichedComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const uid = req.user.uid;

    const commentDoc = await db.collection('posts').doc(postId).collection('comments').doc(commentId).get();
    if (!commentDoc.exists) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentDoc.data();
    if (comment.userId !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await commentDoc.ref.delete();

    await db.collection('posts').doc(postId).update({
      commentsCount: Math.max((await db.collection('posts').doc(postId).get()).data()?.commentsCount - 1 || 0, 0),
    });

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};