import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  _id: { type: String },
  firebaseUid: { type: String, unique: true, sparse: true },
  uid: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, default: '' },
  passwordHash: { type: String, required: false },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  authProvider: { type: String, enum: ['firebase', 'native'], default: 'firebase' },
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
