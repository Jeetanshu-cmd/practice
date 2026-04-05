import { createOpenAIClient } from '../lib/openai.js';
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
  const client = createOpenAIClient();
  const systemPrompt = `You analyze medical reports and return strict JSON only. Return this shape: {"critical": string[], "moderate": string[], "elevated": string[], "metrics": [{"metric_name": string, "value": string, "unit": string, "severity": "critical"|"moderate"|"elevated", "summary": string, "tip": string}]}. Keep tips practical and concise. Do not claim diagnosis. If uncertain, say so plainly.`;

  const content = [
    { type: 'text', text: `File name: ${fileName}` },
    { type: 'text', text: extracted.text ? `Report text:\n${extracted.text.slice(0, 12000)}` : 'No extractable text was available.' }
  ];

  if (extracted.imageDataUrl) {
    content.push({ type: 'image_url', image_url: { url: extracted.imageDataUrl } });
  }

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input: [
      { role: 'system', content: [{ type: 'text', text: systemPrompt }] },
      { role: 'user', content }
    ],
    temperature: 0.2,
    text: {
      format: {
        type: 'json_schema',
        name: 'medical_report_analysis',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            critical: { type: 'array', items: { type: 'string' } },
            moderate: { type: 'array', items: { type: 'string' } },
            elevated: { type: 'array', items: { type: 'string' } },
            metrics: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  metric_name: { type: 'string' },
                  value: { type: 'string' },
                  unit: { type: 'string' },
                  severity: { type: 'string', enum: ['critical', 'moderate', 'elevated'] },
                  summary: { type: 'string' },
                  tip: { type: 'string' }
                },
                required: ['metric_name', 'value', 'unit', 'severity', 'summary', 'tip']
              }
            }
          },
          required: ['critical', 'moderate', 'elevated', 'metrics']
        }
      }
    }
  });

  return JSON.parse(response.output_text);
}
