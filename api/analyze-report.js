import { createGeminiClient, reportAnalysisSchema } from '../lib/gemini.js';
import { buildFallbackAnalysis, extractReportContent } from '../lib/report-parser.js';
import { createServiceClient, requireUser } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const { user } = await requireUser(req);
    const { reportId } = req.body || {};
    if (!reportId) {
      return res.status(400).json({ error: 'Missing reportId.' });
    }

    const supabase = createServiceClient();
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, user_id, file_name, file_type, storage_path')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single();

    if (reportError || !report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const { data: fileData, error: downloadError } = await supabase.storage.from('reports').download(report.storage_path);
    if (downloadError || !fileData) {
      throw new Error('Failed to download report file from storage.');
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    const extracted = await extractReportContent(report.file_type, fileBuffer);
    let analysis;

    try {
      analysis = await generateAiAnalysis(report.file_name, extracted);
    } catch (error) {
      console.error('AI analysis failed, falling back to local parser.', error);
      analysis = buildFallbackAnalysis(extracted.text);
    }

    await supabase.from('report_metrics').delete().eq('report_id', report.id);
    await supabase.from('report_insights').delete().eq('report_id', report.id);

    if (analysis.metrics?.length) {
      const payload = analysis.metrics.map((metric) => ({
        report_id: report.id,
        metric_name: metric.metric_name,
        value: String(metric.value ?? ''),
        unit: metric.unit || '',
        severity: metric.severity || 'moderate',
        summary: metric.summary || '',
        tip: metric.tip || ''
      }));
      await supabase.from('report_metrics').insert(payload);
    }

    const insightRows = ['critical', 'moderate', 'elevated'].flatMap((category) =>
      (analysis[category] || []).map((content) => ({
        report_id: report.id,
        category,
        content
      }))
    );

    if (insightRows.length) {
      await supabase.from('report_insights').insert(insightRows);
    }

    await supabase
      .from('reports')
      .update({
        analysis_status: 'completed',
        summary_json: {
          critical: analysis.critical || [],
          moderate: analysis.moderate || [],
          elevated: analysis.elevated || []
        }
      })
      .eq('id', report.id);

    return res.status(200).json({ ok: true, analysis });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Analysis failed.' });
  }
}

async function generateAiAnalysis(fileName, extracted) {
  const client = createGeminiClient();
  const prompt = [
    'You analyze medical reports and return strict JSON only.',
    'Do not diagnose. Keep tips practical and concise. If uncertain, say so plainly.',
    `File name: ${fileName}`,
    extracted.text ? `Report text:\n${extracted.text.slice(0, 12000)}` : 'No extractable text was available.'
  ].join('\n\n');

  const parts = [{ text: prompt }];
  if (extracted.imageDataUrl) {
    const [, mimeType = 'image/jpeg', base64 = ''] = extracted.imageDataUrl.match(/^data:(.*?);base64,(.*)$/) || [];
    parts.push({ inlineData: { mimeType, data: base64 } });
  }

  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }],
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: reportAnalysisSchema
    }
  });

  return JSON.parse(response.text);
}
