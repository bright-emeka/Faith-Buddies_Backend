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
  history = [],
  systemPrompt,
}) => {
  try {
    console.log('=========== GEMINI REQUEST ===========');

    console.log('API KEY EXISTS:', !!process.env.GEMINI_API_KEY);

    console.log('MESSAGE:', message);

    console.log('HISTORY LENGTH:', history.length);

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
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': process.env.GEMINI_API_KEY,
        },

        timeout: 30000,
      }
    );

    console.log(
      'FULL GEMINI RESPONSE:',
      JSON.stringify(response.data, null, 2)
    );

    const aiMessage =
      response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiMessage) {
      console.log('NO AI MESSAGE FOUND');

      console.log(
        'Candidates:',
        JSON.stringify(response?.data?.candidates, null, 2)
      );

      throw new Error('Empty response from Gemini');
    }

    console.log('=========== GEMINI SUCCESS ===========');

    return aiMessage;
  } catch (error) {
    console.error('=========== GEMINI ERROR ===========');

    console.error('MESSAGE:', error.message);

    console.error('CODE:', error.code);

    if (error.response) {
      console.error('STATUS:', error.response.status);

      console.error(
        'DATA:',
        JSON.stringify(error.response.data, null, 2)
      );
    }

    console.error('=====================================');

    throw error;
  }
};