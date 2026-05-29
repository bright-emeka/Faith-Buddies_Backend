import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return (
      error.code === 'ECONNABORTED' ||
      error.response?.status >= 500
    );
  },
});

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export const generateGeminiResponse = async ({
  message,
  history,
  systemPrompt,
}) => {
  try {
    const response = await axios.post(
      GEMINI_URL,
      {
        systemInstruction: {
          parts: [
            {
              text: systemPrompt,
            },
          ],
        },

        contents: [
          ...history,
          {
            role: 'user',
            parts: [
              {
                text: message,
              },
            ],
          },
        ],

        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 1000,
        },

        safetySettings: [
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': process.env.GEMINI_API_KEY,
        },

        timeout: 30000,
      }
    );

    const aiMessage =
      response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiMessage) {
      throw new Error('Empty response from Gemini');
    }

    return aiMessage;
  } catch (error) {
    console.error('Gemini Service Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    throw error;
  }
};
