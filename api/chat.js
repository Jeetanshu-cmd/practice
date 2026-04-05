import { createGeminiClient } from '../lib/gemini.js';
import { createServiceClient, requireUser } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const { user } = await requireUser(req);
    const { sessionId, message } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing sessionId or message.' });
    }

    const supabase = createServiceClient();
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Chat session not found.' });
    }

    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: message
    });

    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(12);

    const client = createGeminiClient();
    const prompt = [
      'You are Dr.AI for MedInsight.',
      'Explain medical information clearly, cautiously, and non-alarmingly.',
      'Do not diagnose. Encourage clinician follow-up for urgent symptoms or abnormal findings.',
      'Conversation history follows.',
      ...(recentMessages || []).map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
    ].join('\n\n');

    const answer = await client.models.generateContent({
      model: process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.35
      }
    });

    const assistantMessage = answer.text?.trim() || 'I was unable to generate a reply just now. Please try again.';

    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: assistantMessage
    });

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    return res.status(200).json({ ok: true, messages: messages || [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Chat failed.' });
  }
}
