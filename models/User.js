import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  uid: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, default: '' },
  bio: { type: String, default: 'Faithful believer sharing wisdom and inspiration' },
  avatar: { type: String },
  religion: { type: String, default: 'Christian' },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  postsCount: { type: Number, default: 0 },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  collection: 'users',
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
