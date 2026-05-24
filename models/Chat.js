import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  content: { type: String, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() }
}, { _id: false }); // Prevents Mongoose from creating sub-document IDs for every single message item

const chatSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // Stores the user's Firebase UID string
  messages: [messageSchema],
}, { timestamps: true });

const Chat = mongoose.model('Chat', chatSchema);
export default Chat;