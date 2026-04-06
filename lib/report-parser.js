import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

const metricKeywords = [
  {
    name: 'Hemoglobin',
    keywords: ['hemoglobin', 'hb'],
    tip: 'Iron-rich nutrition, B12, folate, and clinician-guided supplementation may help improve hemoglobin when low.'
  },
  {
    name: 'Glucose',
    keywords: ['glucose', 'blood sugar', 'fasting sugar'],
    tip: 'Prioritize steady meal timing, lower refined sugar intake, and regular physical activity to support glucose balance.'
  },
  {
    name: 'Cholesterol',
    keywords: ['cholesterol', 'total cholesterol'],
    tip: 'Fiber-rich foods, reduced saturated fat intake, and regular activity often help support healthier cholesterol values.'
  },
  {
    name: 'LDL',
    keywords: ['ldl'],
    tip: 'Lowering trans fats, improving dietary fiber intake, and following clinician advice can help improve LDL levels.'
  },
  {
    name: 'HDL',
    keywords: ['hdl'],
    tip: 'Aerobic exercise, weight management, and healthy fats may help raise HDL where appropriate.'
  },
  {
    name: 'Vitamin D',
    keywords: ['vitamin d', '25-oh vitamin d'],
    tip: 'Safe sunlight exposure and doctor-guided vitamin D supplementation may support low vitamin D levels.'
  },
  {
    name: 'Creatinine',
    keywords: ['creatinine'],
    tip: 'Hydration and kidney-focused medical follow-up are important when creatinine is elevated.'
  },
  {
    name: 'TSH',
    keywords: ['tsh', 'thyroid stimulating hormone'],
    tip: 'Thyroid markers should be interpreted with your doctor, especially if symptoms are also present.'
  }
];

export async function extractReportContent(fileType, buffer) {
  const lower = String(fileType || '').toLowerCase();

  if (lower === 'pdf') {
    const result = await pdfParse(buffer);
    return { text: result.text || '', imageDataUrl: null, sourceType: 'pdf' };
  }

  if (['docx', 'doc'].includes(lower)) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value || '', imageDataUrl: null, sourceType: 'document' };
  }

  if (['png', 'jpg', 'jpeg', 'webp'].includes(lower)) {
    return {
      text: '',
      imageDataUrl: `data:${imageMimeType(lower)};base64,${buffer.toString('base64')}`,
      sourceType: 'image'
    };
  }

  return { text: buffer.toString('utf-8'), imageDataUrl: null, sourceType: 'text' };
}

export function buildFallbackAnalysis(text) {
  const normalizedText = String(text || '').toLowerCase();
  const metrics = metricKeywords
    .map((metric) => parseMetric(metric, normalizedText))
    .filter(Boolean);

  const groups = { critical: [], moderate: [], elevated: [] };
  metrics.forEach((metric) => {
    if (groups[metric.severity]) {
      groups[metric.severity].push(metric.summary);
    }
  });

  return {
    overview: buildOverview(metrics),
    critical: groups.critical.length ? groups.critical : ['No urgent markers were confidently extracted from the report text.'],
    moderate: groups.moderate.length ? groups.moderate : ['Moderate findings were not clearly identified in fallback parsing.'],
    elevated: groups.elevated.length ? groups.elevated : ['Elevated markers were not clearly identified in fallback parsing.'],
    metrics
  };
}

function buildOverview(metrics) {
  if (!metrics.length) {
    return 'The uploaded report could not be fully interpreted into structured findings, so no strong report-based clinical summary is available yet. A clinician should review the original document directly for accurate interpretation and symptom correlation.';
  }

  const severeMetrics = metrics.slice(0, 4).map((metric) => metric.metric_name).join(', ');
  return `This report shows abnormalities involving ${severeMetrics}, which may suggest an active clinical issue that needs medical review in context with the patient's history. Based on the extracted findings, the pattern may reflect problems such as metabolic imbalance, nutritional deficiency, thyroid disturbance, kidney strain, or lipid-related cardiovascular risk depending on the specific markers and their severity. Symptoms linked with these kinds of abnormalities can include fatigue, weakness, dizziness, increased thirst, changes in urination, shortness of breath, body aches, palpitations, or poor concentration. These symptoms are a report-based correlation rather than a confirmed diagnosis, so the findings should be reviewed with a qualified clinician.`;
}

function symptomHint(name, severity) {
  const label = String(name || '').toLowerCase();
  if (label.includes('hemoglobin')) return severity === 'critical' ? 'severe fatigue or shortness of breath' : 'fatigue or weakness';
  if (label.includes('glucose')) return 'increased thirst, frequent urination, or blurred vision';
  if (label.includes('vitamin d')) return 'body aches, low mood, or muscle weakness';
  if (label.includes('creatinine')) return 'swelling, fatigue, or reduced appetite';
  if (label.includes('tsh')) return 'weight change, tiredness, or temperature intolerance';
  if (label.includes('ldl') || label.includes('cholesterol')) return 'few direct symptoms but higher long-term cardiovascular risk';
  return '';
}

function parseMetric(metric, text) {
  const matchedKeyword = metric.keywords.find((keyword) => text.includes(keyword));
  if (!matchedKeyword) return null;

  const valueMatch = text.match(new RegExp(`${escapeRegex(matchedKeyword)}[^\\d]{0,12}(\\d+(?:\\.\\d+)?)`, 'i'));
  const value = valueMatch ? Number(valueMatch[1]) : null;
  const severity = inferSeverity(metric.name, value);

  return {
    metric_name: metric.name,
    value: value ?? 'Detected',
    unit: inferUnit(metric.name),
    severity,
    summary: summarizeMetric(metric.name, value, severity),
    tip: metric.tip
  };
}

function inferSeverity(name, value) {
  if (typeof value !== 'number') return 'moderate';

  const label = name.toLowerCase();
  if (label.includes('glucose')) {
    if (value >= 180) return 'critical';
    if (value >= 126) return 'elevated';
    if (value >= 100) return 'moderate';
    return 'moderate';
  }

  if (label.includes('hemoglobin')) {
    if (value < 8) return 'critical';
    if (value < 11) return 'elevated';
    if (value < 12) return 'moderate';
    return 'moderate';
  }

  if (label.includes('vitamin d')) {
    if (value < 12) return 'critical';
    if (value < 20) return 'elevated';
    if (value < 30) return 'moderate';
    return 'moderate';
  }

  if (label.includes('creatinine')) {
    if (value > 2) return 'critical';
    if (value > 1.3) return 'elevated';
    return 'moderate';
  }

  if (label.includes('ldl')) {
    if (value >= 190) return 'critical';
    if (value >= 160) return 'elevated';
    if (value >= 130) return 'moderate';
    return 'moderate';
  }

  return value > 0 ? 'moderate' : 'moderate';
}

function summarizeMetric(name, value, severity) {
  if (typeof value !== 'number') {
    return `${name} was mentioned in the report and needs clinician review.`;
  }

  return `${name} is ${severity} at ${value}${inferUnit(name)}.`;
}

function inferUnit(name) {
  const label = name.toLowerCase();
  if (label.includes('glucose') || label.includes('cholesterol') || label.includes('ldl') || label.includes('hdl')) {
    return 'mg/dL';
  }
  if (label.includes('hemoglobin')) return 'g/dL';
  if (label.includes('creatinine')) return 'mg/dL';
  if (label.includes('vitamin d')) return 'ng/mL';
  if (label.includes('tsh')) return 'uIU/mL';
  return '';
}

function imageMimeType(fileType) {
  switch (fileType) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
