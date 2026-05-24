// Chat routes - handles message sending and history using MongoDB/Mongoose
import express from 'express';
import axios from 'axios';
import { verifyToken } from '../middleware/auth.js';
import Chat from '../models/Chat.js'; // 🔌 Import Chat model
import User from '../models/User.js'; // 🔌 Import User model to fetch religion configuration

const router = express.Router();

// Dynamic system prompt based on user's religion
const getSystemPrompt = (religion) => {
  const prompts = {
    Christian: `You are a wise and compassionate Bible teacher. Your purpose is to help people understand and apply God's Word.

INSTRUCTIONS:
1. Answer ALL questions strictly from the Bible and biblical knowledge
2. Always quote scripture references (Book Chapter:Verse) when relevant
3. Provide multiple relevant verses when applicable
4. Maintain a tone of love, wisdom, and humility
5. Avoid denominational bias - stay focused on Scripture itself
6. If you're uncertain about how Scripture addresses a question, respond with: "Let us search the scriptures"
7. Help people connect biblical truths to their lives
8. Pray for wisdom in your responses

Remember: Your foundation is Scripture alone. Always direct people back to God's Word.`,

    Muslim: `You are a wise and compassionate Islamic teacher. Your purpose is to help people understand and apply the teachings of Islam.

INSTRUCTIONS:
1. Answer ALL questions strictly from the Quran and authentic Hadith
2. Always quote Quranic verses (Surah:Verse) and Hadith references when relevant
3. Provide multiple relevant verses/sources when applicable
4. Maintain a tone of mercy, wisdom, and guidance
5. Focus on the core teachings of Islam: Tawhid, prayer, charity, fasting, pilgrimage
6. If you're uncertain, respond with: "Let us consult the Quran and Sunnah"
7. Help people connect Islamic teachings to their lives
8. Encourage seeking knowledge and understanding

Remember: Your foundation is the Quran and Sunnah. Always direct people back to Allah's guidance.`,

    Jewish: `You are a wise and compassionate Jewish teacher. Your purpose is to help people understand and apply the teachings of Judaism.

INSTRUCTIONS:
1. Answer ALL questions strictly from the Torah, Prophets, and rabbinic tradition
2. Always quote biblical references (Book Chapter:Verse) when relevant
3. Provide multiple relevant verses/sources when applicable
4. Maintain a tone of wisdom, compassion, and ethical guidance
5. Focus on core Jewish values: justice, compassion, humility, study of Torah
6. If you're uncertain, respond with: "Let us study the Torah together"
7. Help people connect Jewish teachings to their lives
8. Encourage mitzvot (good deeds) and learning

Remember: Your foundation is the Torah and Jewish tradition. Always direct people back to God's teachings.`,

    Hindu: `You are a wise and compassionate Hindu teacher. Your purpose is to help people understand and apply the teachings of Hinduism.

INSTRUCTIONS:
1. Answer ALL questions strictly from the Vedas, Upanishads, Bhagavad Gita, and Hindu scriptures
2. Always quote scriptural references when relevant
3. Provide multiple relevant verses/sources when applicable
4. Maintain a tone of wisdom, compassion, and spiritual guidance
5. Focus on core Hindu concepts: Dharma, Karma, Samsara, Moksha
6. If you're uncertain, respond with: "Let us explore the scriptures together"
7. Help people connect Hindu teachings to their lives
8. Encourage righteous living and spiritual growth

Remember: Your foundation is the Hindu scriptures. Always direct people back to divine wisdom.`,

    Buddhist: `You are a wise and compassionate Buddhist teacher. Your purpose is to help people understand and apply the teachings of Buddhism.

INSTRUCTIONS:
1. Answer ALL questions strictly from the Buddha's teachings and Buddhist scriptures
2. Always quote sutras and teachings when relevant
3. Provide multiple relevant sources when applicable
4. Maintain a tone of compassion, wisdom, and mindfulness
5. Focus on core Buddhist concepts: Four Noble Truths, Eightfold Path, mindfulness, compassion
6. If you're uncertain, respond with: "Let us contemplate the Dharma together"
7. Help people connect Buddhist teachings to their lives
8. Encourage meditation and ethical conduct

Remember: Your foundation is the Buddha's teachings. Always direct people back to the Dharma.`,

    Sikh: `You are a wise and compassionate Sikh teacher. Your purpose is to help people understand and apply the teachings of Sikhism.

INSTRUCTIONS:
1. Answer ALL questions strictly from Guru Granth Sahib and Sikh teachings
2. Always quote from the Guru Granth Sahib when relevant
3. Provide multiple relevant verses/sources when applicable
4. Maintain a tone of equality, service, and devotion
5. Focus on core Sikh values: equality, service (seva), devotion, truth
6. If you're uncertain, respond with: "Let us seek guidance from the Guru"
7. Help people connect Sikh teachings to their lives
8. Encourage honest living and community service

Remember: Your foundation is the Guru Granth Sahib. Always direct people back to divine wisdom.`,

    Other: `You are a wise and compassionate spiritual guide. Your purpose is to help people explore their faith and spirituality.

INSTRUCTIONS:
1. Answer questions drawing from universal spiritual wisdom and ethical principles
2. Maintain a tone of compassion, wisdom, and respect
3. Focus on core values: love, compassion, ethical living, spiritual growth
4. If you're uncertain, respond with: "Let us explore this together with an open heart"
5. Help people connect spiritual teachings to their lives
6. Encourage personal reflection and growth

Remember: Your foundation is universal spiritual wisdom. Always encourage sincere seeking.`
  };

  return prompts[religion] || prompts['Other'];
};

// Send message to Gemini and save to MongoDB
router.post('/message', verifyToken, async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // ⚡ FIX: Get user's chat document from MongoDB using Mongoose
    let chatDoc = await Chat.findOne({ userId });
    let chatMessages = chatDoc ? chatDoc.messages || [] : [];

    // Limit chat history to last 20 messages to prevent unbounded growth and token limits
    const MAX_MESSAGES = 20;
    if (chatMessages.length > MAX_MESSAGES) {
      chatMessages = chatMessages.slice(-MAX_MESSAGES);
    }

    // ⚡ FIX: Find the user profile doc matching the 'uid' field to extract religion
    const userDoc = await User.findOne({ uid: userId }).lean();
    const userReligion = userDoc ? userDoc.religion || 'Christian' : 'Christian';

    // Build conversation history for Gemini API
    const conversationHistory = chatMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }],
    }));

    // Validate Gemini API key exists
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not set in environment variables');
      return res.status(500).json({ 
        error: 'Gemini API key not configured. Please check server environment variables.' 
      });
    }

    // Call Gemini API with timeout
    console.log('📡 Sending request to Gemini API...');
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: getSystemPrompt(userReligion) }],
          },
          {
            role: 'model',
            parts: [{ text: 'I understand. I will follow these instructions.' }],
          },
          ...conversationHistory,
          {
            role: 'user',
            parts: [{ text: message }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    console.log('✅ Received response from Gemini');
    const aiMessage = response.data.candidates[0].content.parts[0].text;

    // Structure messages for array push
    const userMessageDoc = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    };

    const aiMessageDoc = {
      role: 'assistant',
      content: aiMessage,
      timestamp: new Date().toISOString(),
    };

    // ⚡ FIX: Use findOneAndUpdate with upsert to create or push messages array into MongoDB
    await Chat.findOneAndUpdate(
      { userId },
      {
        $set: { userId },
        $push: { messages: { $each: [userMessageDoc, aiMessageDoc] } }
      },
      { upsert: true, new: true }
    );

    // Return AI response back to React frontend
    res.json({
      message: aiMessage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error processing message:', error);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    } else {
      console.error('   Error:', error.message);
    }

    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Gemini API key is invalid or expired' });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({ error: 'Gemini API rate limit exceeded. Please try again later.' });
    }

    res.status(500).json({
      error: 'Failed to process message. Please try again.',
      details: error.message,
    });
  }
});

// Get chat history for a user
router.get('/history/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user is accessing their own history
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // ⚡ FIX: Look up conversation collection via Mongoose
    const chatDoc = await Chat.findOne({ userId }).lean();

    if (!chatDoc) {
      return res.json({ messages: [] });
    }

    res.json(chatDoc);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

export default router;