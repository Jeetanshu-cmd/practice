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
    critical: groups.critical.length ? groups.critical : ['No urgent markers were confidently extracted from the report text.'],
    moderate: groups.moderate.length ? groups.moderate : ['Moderate findings were not clearly identified in fallback parsing.'],
    elevated: groups.elevated.length ? groups.elevated : ['Elevated markers were not clearly identified in fallback parsing.'],
    metrics
  };
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
