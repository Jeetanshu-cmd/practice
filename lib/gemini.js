import './env.js';
import { GoogleGenAI, Type } from '@google/genai';

export function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY.');
  }

  return new GoogleGenAI({ apiKey });
}

export const reportAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    critical: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    moderate: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    elevated: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    metrics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          metric_name: { type: Type.STRING },
          value: { type: Type.STRING },
          unit: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ['critical', 'moderate', 'elevated'] },
          summary: { type: Type.STRING },
          tip: { type: Type.STRING }
        },
        required: ['metric_name', 'value', 'unit', 'severity', 'summary', 'tip']
      }
    }
  },
  required: ['critical', 'moderate', 'elevated', 'metrics']
};
