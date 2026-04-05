export default async function handler(_req, res) {
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    appName: 'MedInsight'
  });
}
