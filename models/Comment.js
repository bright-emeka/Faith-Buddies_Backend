import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: String, ref: 'User', required: true },
  content: { type: String, required: true },
  likesCount: { type: Number, default: 0 },
}, {
  timestamps: { createdAt: 'createdAt' },
  collection: 'comments',
});

const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
export default Comment;
