import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true },
  content: { type: String, required: true },
  image: { type: String, default: null },
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  collection: 'posts',
});

const Post = mongoose.models.Post || mongoose.model('Post', postSchema);
export default Post;
