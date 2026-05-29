import express from 'express';

import Chat from '../models/Chat.js';
import User from '../models/User.js';

import { verifyToken } from '../middleware/auth.js';

import { generateGeminiResponse } from '../services/geminiService.js';
import { getSystemPrompt } from '../utils/prompts.js';

const router = express.Router();

const MAX_HISTORY = 20;
const MAX_MESSAGE_LENGTH = 4000;

router.post('/message', verifyToken, async (req, res) => {
  try {
    const { message, userId } = req.body;

    // Validation
    if (!message || !message.trim()) {
      return res.status(400).json({
        error: 'Message cannot be empty',
      });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: 'Message too long',
      });
    }

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId',
      });
    }

    if (userId !== req.userId) {
      return res.status(403).json({
        error: 'Unauthorized',
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Gemini API key missing',
      });
    }

    // Fetch user religion
    const userDoc = await User.findOne({ uid: userId }).lean();

    const religion = userDoc?.religion || 'Christian';

    // Fetch existing chat
    const chatDoc = await Chat.findOne({ userId }).lean();

    let messages = chatDoc?.messages || [];

    // Keep only recent messages
    messages = messages.slice(-MAX_HISTORY);

    // Convert history format for Gemini
    const history = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',

      parts: [
        {
          text: msg.content,
        },
      ],
    }));

    // Generate AI response
    const aiMessage = await generateGeminiResponse({
      message: message.trim(),
      history,
      systemPrompt: getSystemPrompt(religion),
    });

    const timestamp = new Date().toISOString();

    const userMessageDoc = {
      role: 'user',
      content: message.trim(),
      timestamp,
    };

    const aiMessageDoc = {
      role: 'assistant',
      content: aiMessage,
      timestamp,
    };

    // Save to MongoDB
    await Chat.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
        },

        $push: {
          messages: {
            $each: [userMessageDoc, aiMessageDoc],
            $slice: -40,
          },
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    return res.json({
      success: true,
      message: aiMessage,
      timestamp,
    });
  } catch (error) {
    console.error('Chat Route Error:', error);

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Gemini request timeout',
      });
    }

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Invalid Gemini API key',
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Gemini rate limit exceeded',
      });
    }

    return res.status(500).json({
      error: 'Failed to process message',
    });
  }
});

router.get('/history/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId !== req.userId) {
      return res.status(403).json({
        error: 'Unauthorized',
      });
    }

    const chatDoc = await Chat.findOne({ userId }).lean();

    if (!chatDoc) {
      return res.json({
        messages: [],
      });
    }

    return res.json({
      messages: chatDoc.messages || [],
    });
  } catch (error) {
    console.error('History Fetch Error:', error);

    return res.status(500).json({
      error: 'Failed to fetch history',
    });
  }
});

export default router;