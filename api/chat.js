import { createOpenAIClient } from '../lib/openai.js';
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

    const client = createOpenAIClient();
    const answer = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature: 0.35,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'You are Dr.AI for MedInsight. Explain medical information clearly, cautiously, and non-alarmingly. Do not diagnose. Encourage clinician follow-up for urgent symptoms or abnormal findings.'
            }
          ]
        },
        ...(recentMessages || []).map((entry) => ({
          role: entry.role,
          content: [{ type: 'text', text: entry.content }]
        }))
      ]
    });

    const assistantMessage = answer.output_text?.trim() || 'I was unable to generate a reply just now. Please try again.';

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
