import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { db } from './src/config/firebase.js';
import { authenticate } from './src/middleware/auth.js';
import { registerUser, syncUserProfile, getUserProfile, searchUsers, repairUserUids } from './src/controllers/userController.js';
import { createPost, getFeed, getUserPosts, getPost, deletePost } from './src/controllers/postController.js';
import { toggleLike, checkLike, addComment, getComments, deleteComment } from './src/controllers/interactionController.js';
import { followUser, unfollowUser, toggleFollow, getFollowStatus, getFollowers, getFollowing } from './src/controllers/followController.js';
import { sendChatMessage, getChatHistory } from './src/controllers/chatController.js';

// ============ CORS Helper ============

const cors = (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }
  next();
};

// ============ HTTP Route Dispatcher ============

const route = (req, res) => {
  const path = req.path || req.rawUrl || req.url || '';
  const method = req.method.toLowerCase();
  const segments = path.split('/').filter(Boolean);
  res.set('Content-Type', 'application/json');

  const send = (status, data) => {
    res.status(status).json(data);
  };

  if (segments[0] === 'auth') {
    if (segments[1] === 'register' && method === 'post') {
      return authenticate(req, res, () => registerUser(req, res));
    }
    if (segments[1] === 'login' && method === 'post') {
      return send(401, { error: 'Use Firebase authentication. Call register with Firebase UID.' });
    }
  }

  if (segments[0] === 'users') {
    if (segments[1] === 'search' && method === 'get') {
      return searchUsers(req, res);
    }
    if (segments[1] === 'sync' && method === 'post') {
      return authenticate(req, res, () => syncUserProfile(req, res));
    }
    if (segments[1] === 'profile' && method === 'get') {
      return authenticate(req, res, () => getUserProfile(req, res));
    }
    if (segments[1] === 'profile' && method === 'post') {
      return authenticate(req, res, () => syncUserProfile(req, res));
    }
    if (segments[1] === 'repair' && method === 'post') {
      return authenticate(req, res, () => repairUserUids(req, res));
    }
    if (segments[2] === 'profile' && method === 'get') {
      return getUserProfile(req, res);
    }
  }

  if (segments[0] === 'posts') {
    if (segments[1] === 'feed' && method === 'get') {
      return authenticate(req, res, () => getFeed(req, res));
    }
    if (segments[1] === 'user' && method === 'get') {
      return getUserPosts(req, res);
    }
    if (segments.length === 2 && method === 'post') {
      return authenticate(req, res, () => createPost(req, res));
    }
    if (segments.length === 2 && method === 'delete') {
      return authenticate(req, res, () => deletePost(req, res));
    }
    if (segments.length === 2 && method === 'get') {
      return getPost(req, res);
    }
  }

  if (segments[0] === 'interactions') {
    if (segments.length === 3 && segments[2] === 'like' && method === 'post') {
      return authenticate(req, res, () => toggleLike(req, res));
    }
    if (segments.length === 3 && segments[2] === 'liked' && method === 'get') {
      return authenticate(req, res, () => checkLike(req, res));
    }
    if (segments.length === 3 && segments[2] === 'comments' && method === 'post') {
      return authenticate(req, res, () => addComment(req, res));
    }
    if (segments.length === 3 && segments[2] === 'comments' && method === 'get') {
      return getComments(req, res);
    }
    if (segments.length === 4 && segments[2] === 'comments' && method === 'delete') {
      return authenticate(req, res, () => deleteComment(req, res));
    }
  }

  if (segments[0] === 'follows') {
    if (segments[1] === 'follow' && segments.length === 3 && method === 'post') {
      return authenticate(req, res, () => followUser(req, res));
    }
    if (segments.length === 3 && method === 'post') {
      return authenticate(req, res, () => toggleFollow(req, res));
    }
    if (segments[2] === 'following' && method === 'get') {
      return authenticate(req, res, () => getFollowStatus(req, res));
    }
    if (segments.length === 3 && segments[2] === 'followers' && method === 'get') {
      return getFollowers(req, res);
    }
    if (segments.length === 3 && segments[2] === 'following' && method === 'get') {
      return getFollowing(req, res);
    }
  }

  if (segments[0] === 'chat') {
    if (segments[1] === 'message' && method === 'post') {
      return authenticate(req, res, () => sendChatMessage(req, res));
    }
    if (segments[1] === 'history' && method === 'get') {
      return authenticate(req, res, () => getChatHistory(req, res));
    }
  }

  return send(404, { error: 'Route not found' });
};

export const api = onRequest((req, res) => {
  cors(req, res, () => route(req, res));
});

// ============ Firestore Triggers ============

export const onPostCreated = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data.data();
  const postId = event.params.postId;
  const userId = post.userId;

  const followersSnapshot = await db.collection('follows')
    .where('followingId', '==', userId)
    .get();

  const batch = db.batch();
  for (const doc of followersSnapshot.docs) {
    batch.set(db.collection('users').doc(doc.data().followerId).collection('feed').doc(postId), {
      postId,
      userId,
      content: post.content,
      image: post.image,
      likesCount: 0,
      commentsCount: 0,
      createdAt: post.createdAt,
    });
  }
  await batch.commit();
});

export const onPostDeleted = onDocumentDeleted('posts/{postId}', async (event) => {
  const post = event.data.data();
  const postId = event.params.postId;
  const userId = post.userId;

  const followersSnapshot = await db.collection('follows')
    .where('followingId', '==', userId)
    .get();

  const batch = db.batch();
  for (const doc of followersSnapshot.docs) {
    batch.delete(db.collection('users').doc(doc.data().followerId).collection('feed').doc(postId));
  }
  await batch.commit();
});

export const onFollowCreated = onDocumentCreated('follows/{followId}', async (event) => {
  const follow = event.data.data();
  const { followerId, followingId } = follow;

  const postsSnapshot = await db.collection('posts')
    .where('userId', '==', followingId)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  const batch = db.batch();
  for (const postDoc of postsSnapshot.docs) {
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
});

export const onFollowDeleted = onDocumentDeleted('follows/{followId}', async (event) => {
  const follow = event.data.data();
  const { followerId, followingId } = follow;

  const feedDoc = db.collection('users').doc(followerId).collection('feed').doc(followingId);
  await feedDoc.delete();
});