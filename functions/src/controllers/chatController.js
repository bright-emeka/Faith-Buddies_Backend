import { db } from '../config/firebase.js';
import { getSystemPrompt } from '../utils/prompts.js';
import { generateGeminiResponse } from '../utils/geminiService.js';

const MAX_HISTORY = 20;
const MAX_MESSAGE_LENGTH = 4000;

export const sendChatMessage = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { message, userId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'Message too long' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    if (userId !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key missing' });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const religion = userDoc.data()?.religion || 'Other';

    const chatRef = db.collection('chats').doc(userId);
    const chatDoc = await chatRef.get();

    const messagesRef = chatRef.collection('messages');

    let history = [];
    if (chatDoc.exists) {
      const messagesSnapshot = await messagesRef
        .orderBy('timestamp', 'asc')
        .limit(MAX_HISTORY)
        .get();

      const messages = messagesSnapshot.docs.map((doc) => ({
        role: doc.data().role,
        content: doc.data().content,
        timestamp: doc.data().timestamp,
      }));

      history = messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));
    }

    const aiMessage = await generateGeminiResponse({
      message: message.trim(),
      history,
      systemPrompt: getSystemPrompt(religion),
    });

    const timestamp = new Date().toISOString();

    const batch = db.batch();
    batch.set(messagesRef.doc(), {
      role: 'user',
      content: message.trim(),
      timestamp,
    });
    batch.set(messagesRef.doc(), {
      role: 'assistant',
      content: aiMessage,
      timestamp,
    });

    if (!chatDoc.exists) {
      batch.set(chatRef, { userId, createdAt: new Date() });
    }

    await batch.commit();

    res.json({
      success: true,
      message: aiMessage,
      timestamp,
    });
  } catch (error) {
    console.error('Chat Route Error:', error);

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Gemini request timeout' });
    }

    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid Gemini API key' });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({ error: 'Gemini rate limit exceeded' });
    }

    res.status(500).json({ error: 'Failed to process message' });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { userId } = req.params;

    if (userId !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const chatRef = db.collection('chats').doc(userId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      return res.json({ messages: [] });
    }

    const messagesSnapshot = await chatRef.collection('messages')
      .orderBy('timestamp', 'asc')
      .get();

    const messages = messagesSnapshot.docs.map((doc) => ({
      messageId: doc.id,
      ...doc.data(),
    }));

    res.json({ messages });
  } catch (error) {
    console.error('History Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};