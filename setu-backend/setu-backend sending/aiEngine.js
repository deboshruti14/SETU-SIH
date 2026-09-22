/**
 * aiEngine.js
 * ---------------------------------------------------------------------------
 * Project SETU (SIH26043) — simulated AI triage pipeline.
 *
 * IMPORTANT / HONEST NOTE: this hackathon prototype has no network access to
 * a real Bhashini endpoint or a trained ML model. Every function below is a
 * deterministic, explainable SIMULATION of the pipeline described in the
 * problem statement (keyword/heuristic based), clearly labelled as such in
 * its output. Swapping any function here for a real model/API call later
 * does not require changing server.js — that is the whole point of keeping
 * this pipeline isolated in one module.
 * ---------------------------------------------------------------------------
 */

'use strict';

/* ============================================================
 * 1. DOMAIN TAXONOMY + CSR SCHEDULE VII MAPPING
 * ============================================================ */
const DOMAINS = [
  {
    key: 'water',
    label: 'Water & Sanitation',
    keywords: ['water', 'drinking water', 'sewage', 'toilet', 'sanitation', 'drain', 'sewer',
      'borewell', 'hand pump', 'handpump', 'contaminat', 'open defecation', 'leak', 'pipeline', 'tap water'],
    csrClause: 'Schedule VII (i) - safe drinking water and sanitation'
  },
  {
    key: 'agriculture',
    label: 'Agriculture & Food',
    keywords: ['crop', 'farm', 'farmer', 'irrigation', 'seed', 'fertilizer', 'harvest', 'food',
      'ration', 'mandi', 'agriculture', 'soil', 'pesticide', 'granary', 'livestock', 'cattle'],
    csrClause: 'Schedule VII (i) - eradicating hunger, poverty and malnutrition'
  },
  {
    key: 'environment',
    label: 'Environment',
    keywords: ['pollution', 'waste', 'garbage', 'plastic', 'forest', 'tree', 'river', 'air quality',
      'deforestation', 'dump', 'environment', 'landfill', 'smoke', 'wetland', 'biodiversity'],
    csrClause: 'Schedule VII (iv) - environmental sustainability and natural resources'
  },
  {
    key: 'education',
    label: 'Education & Skills',
    keywords: ['school', 'teacher', 'classroom', 'dropout', 'literacy', 'vocational', 'skill',
      'college', 'education', 'student', 'scholarship', 'exam', 'curriculum', 'anganwadi'],
    csrClause: 'Schedule VII (ii) - promoting education and vocational skills'
  },
  {
    key: 'livelihood',
    label: 'Livelihood',
    keywords: ['employment', 'job', 'income', 'wage', 'livelihood', 'unemployment', 'self-help',
      'self help group', 'artisan', 'weaver', 'poverty', 'micro-enterprise', 'loan', 'credit'],
    csrClause: 'Schedule VII (iii) - livelihood enhancement projects'
  },
  {
    key: 'mobility',
    label: 'Urban Mobility',
    keywords: ['road', 'traffic', 'bus', 'transport', 'pothole', 'street light', 'streetlight',
      'footpath', 'congestion', 'parking', 'mobility', 'bridge', 'flyover', 'signal', 'commute'],
    csrClause: 'Schedule VII (x) - rural and urban development projects'
  }
];

const DEFAULT_DOMAIN_KEY = 'environment'; // catch-all when no keyword matches

function getDomainByKey(key) {
  return DOMAINS.find((d) => d.key === key) || DOMAINS.find((d) => d.key === DEFAULT_DOMAIN_KEY);
}

/* ============================================================
 * 2. PII DETECTION & REDACTION
 * ============================================================ */
const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const RE_AADHAAR = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const RE_PHONE = /(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;

function redactPII(rawText) {
  let text = String(rawText || '');
  let count = 0;

  text = text.replace(RE_EMAIL, () => { count += 1; return '[REDACTED-EMAIL]'; });
  text = text.replace(RE_AADHAAR, () => { count += 1; return '[REDACTED-AADHAAR]'; });
  text = text.replace(RE_PHONE, () => { count += 1; return '[REDACTED-PHONE]'; });

  return { text, count };
}

/* ============================================================
 * 3. SIMULATED BHASHINI ASR / TRANSLATION
 *    Small hand-built glossaries for common civic-complaint terms.
 *    Anything not in the glossary passes through unchanged — this
 *    is a transparent simulation, not a real translation model.
 * ============================================================ */
const GLOSSARIES = {
  hi: {
    'पानी': 'water', 'सड़क': 'road', 'स्कूल': 'school', 'बिजली': 'electricity', 'नाली': 'drain',
    'गंदा': 'dirty', 'कचरा': 'garbage', 'खेत': 'farm', 'फसल': 'crop', 'बेरोजगारी': 'unemployment',
    'शौचालय': 'toilet', 'अस्पताल': 'hospital', 'गाँव': 'village', 'सड़': 'rotten',
    'शिकायत': 'complaint', 'समस्या': 'problem', 'नहीं': 'not', 'है': 'is', 'हैं': 'are'
  },
  bn: {
    'জল': 'water', 'পানি': 'water', 'রাস্তা': 'road', 'বিদ্যালয়': 'school', 'স্কুল': 'school',
    'বিদ্যুৎ': 'electricity', 'নর্দমা': 'drain', 'নোংরা': 'dirty', 'আবর্জনা': 'garbage',
    'জমি': 'farm land', 'ফসল': 'crop', 'বেকারত্ব': 'unemployment', 'শৌচাগার': 'toilet',
    'হাসপাতাল': 'hospital', 'গ্রাম': 'village', 'অভিযোগ': 'complaint', 'সমস্যা': 'problem'
  },
  sat: {
    'da\'ak': 'water', 'gada': 'road', 'iskul': 'school', 'hoṛ': 'village', 'kami': 'problem',
    'sinaha': 'complaint', 'baha': 'flower', 'ote': 'farm'
  }
};

function simulateTranslate(text, lang) {
  const code = (lang || 'en').toLowerCase();
  if (code === 'en' || !GLOSSARIES[code]) {
    return { translated: text, method: 'passthrough (already English)', confidence: 1 };
  }
  let translated = text;
  const dict = GLOSSARIES[code];
  Object.keys(dict).forEach((word) => {
    const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    translated = translated.replace(re, dict[word]);
  });
  return {
    translated,
    method: `simulated Bhashini ASR + glossary translation (${code} → en)`,
    confidence: 0.78
  };
}

/* ============================================================
 * 4. DEDUPLICATION / CLUSTERING (Jaccard token similarity)
 * ============================================================ */
function tokenize(str) {
  return new Set(
    String(str || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a, b) {
  const sa = tokenize(a);
  const sb = tokenize(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersection = 0;
  sa.forEach((tok) => { if (sb.has(tok)) intersection += 1; });
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function findDuplicates(text, existingChallenges, threshold = 0.32) {
  return existingChallenges
    .map((c) => ({ id: c.id, code: c.code, title: c.title, similarity: jaccardSimilarity(text, c.text) }))
    .filter((c) => c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

/* ============================================================
 * 5. DOMAIN CLASSIFICATION
 * ============================================================ */
function classifyDomain(text) {
  const lower = String(text || '').toLowerCase();
  const scored = DOMAINS.map((d) => ({
    ...d,
    score: d.keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0)
  })).sort((a, b) => b.score - a.score);

  const top = scored[0].score > 0 ? scored[0] : getDomainByKey(DEFAULT_DOMAIN_KEY);
  const confidence = top.score > 0 ? Math.min(0.97, 0.55 + top.score * 0.09) : 0.4;
  return { domain: top, confidence };
}

/* ============================================================
 * 6. PRIORITY SCORING
 *    Priority = min(99, max(10, round(severity*0.4 + reach*0.35 + equity*0.25)))
 * ============================================================ */
const URGENCY_WORDS = ['urgent', 'danger', 'dangerous', 'death', 'died', 'disease', 'outbreak',
  'collapse', 'flood', 'fire', 'contaminated', 'unsafe', 'accident', 'injur'];
const REACH_WORDS = ['village', 'entire', 'whole', 'district', 'thousand', 'families', 'community',
  'all residents', 'every household', 'block', 'panchayat'];
// Illustrative list only — a production system would pull the real NITI Aayog
// aspirational-district list and Census/SECC equity indicators via API.
const ASPIRATIONAL_DISTRICTS = ['Simdega', 'Pakur', 'Gumla', 'Purulia', 'Chatra', 'Godda', 'Garhwa'];

function estimateSeverity(text) {
  const lower = String(text || '').toLowerCase();
  const hits = URGENCY_WORDS.reduce((a, w) => a + (lower.includes(w) ? 1 : 0), 0);
  return Math.min(100, 35 + hits * 14);
}

function estimateReach(text, supporters) {
  const lower = String(text || '').toLowerCase();
  const hits = REACH_WORDS.reduce((a, w) => a + (lower.includes(w) ? 1 : 0), 0);
  const supporterBoost = Math.min(30, (Number(supporters) || 1) * 3);
  return Math.min(100, 25 + hits * 12 + supporterBoost);
}

function estimateEquity(district) {
  return ASPIRATIONAL_DISTRICTS.includes(district) ? 88 : 52;
}

function computePriority({ severity, reach, equity }) {
  const raw = severity * 0.4 + reach * 0.35 + equity * 0.25;
  return Math.min(99, Math.max(10, Math.round(raw)));
}

/* ============================================================
 * 7. CAPABILITY-BASED UNIVERSITY ROUTING ENGINE
 *    Domain overlap (+50) | intra-state/district (+25) |
 *    faculty availability (+15) | multidisciplinary synergy (+10)
 * ============================================================ */
function routeToInstitutions(challenge, institutions, topN = 3) {
  const domainKey = challenge.domainKey;
  const scored = institutions.map((inst) => {
    const caps = String(inst.caps || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    let fit = 0;
    const reasons = [];

    if (caps.includes(domainKey)) { fit += 50; reasons.push('Domain capability match (+50)'); }

    if (inst.district && challenge.district && inst.district === challenge.district) {
      fit += 25; reasons.push('Same district — keep-it-local priority (+25)');
    } else if (inst.state && challenge.state && inst.state === challenge.state) {
      fit += 15; reasons.push('Same state (+15)');
    }

    const load = Number(inst.load) || 0;
    if (load < 5) { fit += 15; reasons.push('High faculty availability (+15)'); }
    else if (load < 8) { fit += 8; reasons.push('Moderate faculty availability (+8)'); }

    if (caps.length >= 3) { fit += 10; reasons.push('Multidisciplinary synergy (+10)'); }

    return { institution: inst, fit: Math.min(100, fit), why: reasons.join('; ') || 'No strong signal' };
  });

  return scored.filter((r) => r.fit > 0).sort((a, b) => b.fit - a.fit).slice(0, topN);
}

/* ============================================================
 * 8. FULL PIPELINE ORCHESTRATION
 *    Runs stages 1-6 above and returns a structured result plus
 *    a step-by-step audit trail ready to be persisted by the caller.
 * ============================================================ */
function runTriagePipeline({ raw, lang, district, state, supporters }, existingChallenges) {
  const steps = [];

  const redacted = redactPII(raw);
  steps.push({
    stage: 'PII Redaction',
    decision: redacted.count > 0 ? `Removed ${redacted.count} sensitive item(s) (phone/Aadhaar/email)` : 'No sensitive identifiers found',
    confidence: 0.99
  });

  const { translated, method, confidence: transConf } = simulateTranslate(redacted.text, lang);
  steps.push({
    stage: 'Language Normalization',
    decision: `${(lang || 'en').toUpperCase()} → English via ${method}`,
    confidence: transConf
  });

  const dupes = findDuplicates(translated, existingChallenges || []);
  steps.push({
    stage: 'Deduplication & Clustering',
    decision: dupes.length
      ? `Possible duplicate of ${dupes[0].code} (token similarity ${(dupes[0].similarity * 100).toFixed(0)}%)`
      : 'No similar open challenge found',
    confidence: dupes.length ? dupes[0].similarity : 0.9
  });

  const { domain, confidence: domainConf } = classifyDomain(translated);
  steps.push({
    stage: 'Domain Classification',
    decision: `Classified as "${domain.label}"`,
    confidence: domainConf
  });

  const severity = estimateSeverity(translated);
  const reach = estimateReach(translated, supporters);
  const equity = estimateEquity(district);
  const priority = computePriority({ severity, reach, equity });
  steps.push({
    stage: 'Priority Scoring',
    decision: `Priority ${priority}/99  (severity ${severity}, reach ${reach}, equity ${equity})`,
    confidence: 0.85
  });

  steps.push({
    stage: 'CSR Schedule VII Tagging',
    decision: domain.csrClause,
    confidence: 0.92
  });

  return {
    redactedText: redacted.text,
    translatedText: translated,
    piiRemoved: redacted.count,
    dupes,
    domain,
    severity,
    reach,
    equity,
    priority,
    steps
  };
}

module.exports = {
  DOMAINS,
  getDomainByKey,
  redactPII,
  simulateTranslate,
  jaccardSimilarity,
  findDuplicates,
  classifyDomain,
  estimateSeverity,
  estimateReach,
  estimateEquity,
  computePriority,
  routeToInstitutions,
  runTriagePipeline
};
