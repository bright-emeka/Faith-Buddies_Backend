// Posts routes - handles creating, reading, and managing posts with corrected Firebase UIDs
import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { Post, User, Follow, Comment, Like } from '../models/index.js';

const router = express.Router();

// Create a new post
router.post('/profile', verifyToken, async (req, res) => {
  try {
    const { userId } = req; // Extracted from verifyToken middleware
    console.log('DEBUG: Incoming profile request for Firebase UID:', userId); // 👈 ADD THIS LOG
    const { name, email, bio, avatar, religion } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty' });
    }

    const post = await Post.create({
      userId, // Storing Firebase UID as the owner identifier
      content: content.trim(),
      image: image || null,
    });

    // ⚡ FIX: Use findOneAndUpdate matching 'uid', not findById
    await User.findOneAndUpdate({ uid: userId }, { $inc: { postsCount: 1 } });

    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get feed for current user (posts from followed users + own posts)
router.get('/feed', verifyToken, async (req, res) => {
  try {
    const { userId } = req;
    const lastTimestamp = req.query.lastTimestamp ? new Date(req.query.lastTimestamp) : undefined;

    const followDocs = await Follow.find({ followerId: userId }).select('followingId');
    const followingIds = [userId, ...followDocs.map((doc) => doc.followingId)];

    const query = { userId: { $in: followingIds } };
    if (lastTimestamp) {
      query.createdAt = { $lt: lastTimestamp };
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const userIds = [...new Set(posts.map((post) => post.userId))];
    
    // ⚡ FIX: Look up users by matching their 'uid' array, not native '_id'
    const users = await User.find({ uid: { $in: userIds } }).lean();
    const usersMap = new Map(users.map((user) => [user.uid, user]));

    res.json(posts.map((post) => ({
      ...post,
      author: usersMap.get(post.userId),
    })));
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// Get user's posts
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const lastTimestamp = req.query.lastTimestamp ? new Date(req.query.lastTimestamp) : undefined;

    const query = { userId };
    if (lastTimestamp) {
      query.createdAt = { $lt: lastTimestamp };
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json(posts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

// Get single post with comments
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId).lean();

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // ⚡ FIX: Find the author user doc matching 'uid'
    const author = await User.findOne({ uid: post.userId }).lean();
    
    const comments = await Comment.find({ postId: post._id })
      .sort({ createdAt: -1 })
      .lean();

    const commentUserIds = [...new Set(comments.map((comment) => comment.userId))];
    
    // ⚡ FIX: Find comment authors by 'uid'
    const commentUsers = await User.find({ uid: { $in: commentUserIds } }).lean();
    const commentUsersMap = new Map(commentUsers.map((user) => [user.uid, user]));

    res.json({
      ...post,
      author,
      comments: comments.map((comment) => ({
        ...comment,
        author: commentUsersMap.get(comment.userId),
      })),
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Delete post (only by author)
router.delete('/:postId', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Promise.all([
      Post.findByIdAndDelete(postId),
      Comment.deleteMany({ postId: post._id }),
      Like.deleteMany({ postId: post._id }),
    ]);

    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;