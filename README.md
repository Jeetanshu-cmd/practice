# MedInsight

Professional medical report dashboard with upload analysis, report history, user authentication, and Dr.AI chat.

## Stack

- Frontend: static HTML, CSS, JS
- Hosting/API: Vercel
- Auth/DB/Storage: Supabase
- AI: OpenAI

## Features

- Top taskbar with Dashboard, History, Dr.AI, and theme toggle
- Professional light/dark theme
- Email/password and Google auth via Supabase
- Report upload for PDF, images, TXT, DOC, and DOCX
- AI-powered report analysis with saved history
- Metrics cards with hover tips
- Dr.AI chat with starter prompts and persisted sessions

## Environment Variables

Add these to Vercel:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to `gpt-4.1-mini`)

## Supabase Setup

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Enable Email and Google auth providers.
3. Set the Google OAuth redirect URL to your Vercel app origin.

## Local Development

1. Install dependencies with `npm install`
2. Run `vercel dev`

## Notes

- Uploaded report files are stored privately in the `reports` bucket.
- Analysis falls back to simple parsing if the AI call fails.
- Dr.AI is informational only and should not be treated as a medical diagnosis tool.
