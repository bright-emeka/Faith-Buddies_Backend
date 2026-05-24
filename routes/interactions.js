// Interactions routes - handles likes and comments with corrected user lookups
import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { Like, Comment, Post, User } from '../models/index.js';

const router = express.Router();

// Like a post
router.post('/:postId/like', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req; // Firebase UID from middleware

    const existingLike = await Like.findOne({ postId, userId });

    if (existingLike) {
      await existingLike.deleteOne();
      await Post.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } });
      return res.json({ liked: false, message: 'Post unliked' });
    }

    await Like.create({ postId, userId });
    await Post.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } });

    res.json({ liked: true, message: 'Post liked' });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Check if user liked a post
router.get('/:postId/liked', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req;

    const liked = await Like.exists({ postId, userId });
    res.json({ liked: Boolean(liked) });
  } catch (error) {
    console.error('Error checking if liked:', error);
    res.status(500).json({ error: 'Failed to check like status' });
  }
});

// Add comment
router.post('/:postId/comments', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    const comment = await Comment.create({
      postId,
      userId,
      content: content.trim(),
    });

    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
    
    // ⚡ FIX: Query by 'uid' field, not findById
    const userDoc = await User.findOne({ uid: userId }).lean();

    res.status(201).json({
      ...comment.toObject(),
      author: userDoc,
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get comments for a post
router.get('/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const lastTimestamp = req.query.lastTimestamp ? new Date(req.query.lastTimestamp) : undefined;

    const query = { postId };
    if (lastTimestamp) {
      query.createdAt = { $lt: lastTimestamp };
    }

    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const commentUserIds = [...new Set(comments.map((comment) => comment.userId))];
    
    // ⚡ FIX: Use 'uid' matching array field, not native '_id'
    const commentUsers = await User.find({ uid: { $in: commentUserIds } }).lean();
    const commentUsersMap = new Map(commentUsers.map((user) => [user.uid, user]));

    res.json(comments.map((comment) => ({
      ...comment,
      author: commentUsersMap.get(comment.userId),
    })));
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Delete comment
router.delete('/:postId/comments/:commentId', verifyToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await comment.deleteOne();
    await Post.findByIdAndUpdate(comment.postId, { $inc: { commentsCount: -1 } });

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;