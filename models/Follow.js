import mongoose from 'mongoose';

const followSchema = new mongoose.Schema({
  followerId: { type: String, ref: 'User', required: true },
  followingId: { type: String, ref: 'User', required: true },
}, {
  timestamps: { createdAt: 'createdAt' },
  collection: 'follows',
});

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

const Follow = mongoose.models.Follow || mongoose.model('Follow', followSchema);
export default Follow;
