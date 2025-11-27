import { genkit } from 'genkit';
// 1. Use the new unified package
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  // 2. Use the newest stable model reference
  model: 'googleai/gemini-2.5-flash', 
});
