import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: String, ref: 'User', required: true },
}, {
  timestamps: { createdAt: 'createdAt' },
  collection: 'likes',
});

likeSchema.index({ postId: 1, userId: 1 }, { unique: true });

const Like = mongoose.models.Like || mongoose.model('Like', likeSchema);
export default Like;
