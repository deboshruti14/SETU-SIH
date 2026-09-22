/**
 * seed.js
 * ---------------------------------------------------------------------------
 * Creates the SETU schema (idempotent — CREATE TABLE IF NOT EXISTS) and,
 * only on a brand-new database, seeds sample institutions, CSR partners and
 * a handful of demo challenges so the app is immediately interactive for
 * judges on first `npm start` (no manual data entry required).
 * ---------------------------------------------------------------------------
 */

'use strict';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  name TEXT,
  role TEXT,           -- citizen, sahayak, university, csr, admin
  org TEXT,
  pwd TEXT
);

CREATE TABLE IF NOT EXISTS institutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  caps TEXT,           -- comma separated: water,agriculture,environment,education,livelihood,mobility
  district TEXT,
  state TEXT,
  load INTEGER DEFAULT 0,
  contact TEXT,
  mentor TEXT
);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  focus TEXT,
  pool REAL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  title TEXT,
  text TEXT,
  raw TEXT,
  lang TEXT,
  district TEXT,
  state TEXT,
  domain TEXT,
  domain_label TEXT,
  priority INTEGER DEFAULT 50,
  stage INTEGER DEFAULT 1,
  supporters INTEGER DEFAULT 1,
  csr_clause TEXT,
  csr_eligible INTEGER DEFAULT 0,
  funded REAL DEFAULT 0.0,
  submitted_by TEXT,
  created_at TEXT,
  status TEXT DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER,
  inst_id INTEGER,
  name TEXT,
  fit INTEGER,
  why TEXT,
  mentor TEXT,
  joined INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS funding (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER,
  partner TEXT,
  amount REAL,
  clause TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER,
  stage TEXT,
  decision TEXT,
  confidence REAL,
  actor TEXT,
  override INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER,
  author TEXT,
  body TEXT,
  created_at TEXT
);
`;

const SEED_INSTITUTIONS = [
  { name: 'Ranchi Institute of Technology', caps: 'water,environment,mobility', district: 'Ranchi', state: 'Jharkhand', load: 3, contact: 'outreach@rit.ac.in', mentor: 'Dr. A. Sinha' },
  { name: 'Jharkhand State Agricultural University', caps: 'agriculture,livelihood,environment', district: 'Ranchi', state: 'Jharkhand', load: 6, contact: 'csr@jsau.ac.in', mentor: 'Dr. R. Oraon' },
  { name: 'Kolkata School of Public Policy', caps: 'education,livelihood', district: 'Kolkata', state: 'West Bengal', load: 2, contact: 'dean@kspp.ac.in', mentor: 'Prof. S. Bose' },
  { name: 'Bengal Engineering & Smart Cities College', caps: 'mobility,water,environment', district: 'Howrah', state: 'West Bengal', load: 7, contact: 'projects@bescc.ac.in', mentor: 'Dr. P. Chatterjee' },
  { name: 'IIT-affiliated Rural Innovation Cell', caps: 'water,agriculture,environment,mobility', district: 'Dhanbad', state: 'Jharkhand', load: 4, contact: 'ric@iitism.ac.in', mentor: 'Dr. K. Mahato' },
  { name: 'National Institute of Vocational Education', caps: 'education,livelihood', district: 'Purulia', state: 'West Bengal', load: 1, contact: 'admin@nive.ac.in', mentor: 'Prof. M. Roy' },
  { name: 'State Digital Inclusion Lab', caps: 'education,livelihood,mobility', district: 'East Singhbhum', state: 'Jharkhand', load: 5, contact: 'lab@sdil.ac.in', mentor: 'Dr. T. Kujur' }
];

const SEED_PARTNERS = [
  { name: 'TataSteel Foundation', focus: 'water,environment,livelihood', pool: 5000000 },
  { name: 'BengalTex CSR Trust', focus: 'education,livelihood', pool: 2200000 },
  { name: 'GreenGrid Renewables CSR', focus: 'environment,mobility', pool: 1800000 },
  { name: 'AgroBharat Cooperative Fund', focus: 'agriculture', pool: 1200000 }
];

// Demo submissions run through the *real* pipeline at seed time, so the
// audit trail and matches judges see on first load are genuine, not fake data.
const SEED_CHALLENGES = [
  {
    raw: 'The hand pump near our school in the village has been broken for 3 weeks and the water is now contaminated. Entire community of about 400 families is affected. My phone is 9876543210.',
    lang: 'en', district: 'Simdega', state: 'Jharkhand', submitted_by: 'Citizen (Simdega)', supporters: 42
  },
  {
    raw: 'फसल की सिंचाई के लिए नहर सूखी पड़ी है, पूरे गाँव के किसान परेशान हैं।',
    lang: 'hi', district: 'Purulia', state: 'West Bengal', submitted_by: 'Sahayak (Purulia)', supporters: 18
  },
  {
    raw: 'রাস্তার লাইট তিন মাস ধরে নষ্ট, রাতে দুর্ঘটনার ভয়ে মহিলারা বের হতে পারেন না।',
    lang: 'bn', district: 'Howrah', state: 'West Bengal', submitted_by: 'ULB Officer (Howrah)', supporters: 9
  }
];

function ensureSchema(db) {
  db.exec(SCHEMA_SQL);
}

function isEmpty(db, table) {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get();
  return row.c === 0;
}

function nextCode(db) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM challenges').get();
  return `SETU-${String(row.c + 1).padStart(4, '0')}`;
}

/**
 * Runs a raw submission through the AI engine and persists challenge +
 * matches + audit rows. Shared by seed.js (demo data) and server.js
 * (live POST /api/challenges) so both paths use identical logic.
 */
function ingestChallenge(db, ai, input) {
  const existing = db.prepare("SELECT id, code, text FROM challenges WHERE status != 'closed'").all();
  const result = ai.runTriagePipeline(input, existing);

  const code = nextCode(db);
  const title = result.translatedText.slice(0, 70) + (result.translatedText.length > 70 ? '…' : '');
  const now = new Date().toISOString();

  const insertChallenge = db.prepare(`
    INSERT INTO challenges
      (code, title, text, raw, lang, district, state, domain, domain_label,
       priority, stage, supporters, csr_clause, csr_eligible, funded, submitted_by, created_at, status)
    VALUES (@code, @title, @text, @raw, @lang, @district, @state, @domain, @domain_label,
       @priority, 1, @supporters, @csr_clause, 1, 0, @submitted_by, @created_at, 'open')
  `);

  const info = insertChallenge.run({
    code,
    title,
    text: result.translatedText,
    raw: input.raw,
    lang: input.lang || 'en',
    district: input.district,
    state: input.state,
    domain: result.domain.key,
    domain_label: result.domain.label,
    priority: result.priority,
    supporters: input.supporters || 1,
    csr_clause: result.domain.csrClause,
    submitted_by: input.submitted_by || 'Anonymous citizen',
    created_at: now
  });

  const challengeId = info.lastInsertRowid;

  // audit trail for every pipeline stage
  const insertAudit = db.prepare(`
    INSERT INTO audit (challenge_id, stage, decision, confidence, actor, override, created_at)
    VALUES (?, ?, ?, ?, 'AI engine', 0, ?)
  `);
  result.steps.forEach((s) => insertAudit.run(challengeId, s.stage, s.decision, s.confidence, now));

  // capability-based routing
  const institutions = db.prepare('SELECT * FROM institutions').all();
  const matches = ai.routeToInstitutions(
    { domainKey: result.domain.key, district: input.district, state: input.state },
    institutions
  );
  const insertMatch = db.prepare(`
    INSERT INTO matches (challenge_id, inst_id, name, fit, why, mentor, joined)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);
  matches.forEach((m) => insertMatch.run(challengeId, m.institution.id, m.institution.name, m.fit, m.why, m.institution.mentor));

  insertAudit.run(
    challengeId,
    'Capability Routing',
    matches.length
      ? `Routed to ${matches.map((m) => `${m.institution.name} (${m.fit}%)`).join(', ')}`
      : 'No institution met the minimum fit threshold',
    matches.length ? matches[0].fit / 100 : 0.3,
    now
  );

  return challengeId;
}

function seedIfEmpty(db, ai) {
  ensureSchema(db);
  if (!isEmpty(db, 'institutions')) return; // already seeded, nothing to do

  const insertInst = db.prepare(`
    INSERT INTO institutions (name, caps, district, state, load, contact, mentor)
    VALUES (@name, @caps, @district, @state, @load, @contact, @mentor)
  `);
  SEED_INSTITUTIONS.forEach((i) => insertInst.run(i));

  const insertPartner = db.prepare(`
    INSERT INTO partners (name, focus, pool) VALUES (@name, @focus, @pool)
  `);
  SEED_PARTNERS.forEach((p) => insertPartner.run(p));

  const insertUser = db.prepare(`INSERT INTO users (email, name, role, org, pwd) VALUES (?,?,?,?,?)`);
  insertUser.run('citizen@demo.setu', 'Demo Citizen', 'citizen', 'Self', 'demo');
  insertUser.run('sahayak@demo.setu', 'Demo Sahayak', 'sahayak', 'Gram Panchayat', 'demo');
  insertUser.run('university@demo.setu', 'Demo University Rep', 'university', 'Ranchi Institute of Technology', 'demo');
  insertUser.run('csr@demo.setu', 'Demo CSR Officer', 'csr', 'TataSteel Foundation', 'demo');
  insertUser.run('admin@demo.setu', 'Demo Audit Officer', 'admin', 'State Innovation Cell', 'demo');

  SEED_CHALLENGES.forEach((c) => ingestChallenge(db, ai, c));

  // seed one CSR pledge on the first demo challenge so the CSR dashboard has data
  const first = db.prepare('SELECT * FROM challenges ORDER BY id ASC LIMIT 1').get();
  if (first) {
    const partner = db.prepare('SELECT * FROM partners WHERE name = ?').get('TataSteel Foundation');
    const amount = 150000;
    db.prepare('INSERT INTO funding (challenge_id, partner, amount, clause, created_at) VALUES (?,?,?,?,?)')
      .run(first.id, partner.name, amount, first.csr_clause, new Date().toISOString());
    db.prepare('UPDATE challenges SET funded = funded + ? WHERE id = ?').run(amount, first.id);
    db.prepare('UPDATE partners SET pool = pool - ? WHERE id = ?').run(amount, partner.id);
    db.prepare(`INSERT INTO audit (challenge_id, stage, decision, confidence, actor, override, created_at)
                VALUES (?, 'CSR Pledge', ?, 1, 'CSR partner', 0, ?)`)
      .run(first.id, `${partner.name} pledged ₹${amount.toLocaleString('en-IN')} under ${first.csr_clause}`, new Date().toISOString());
  }

  console.log('[seed] Database initialised with sample institutions, CSR partners and demo challenges.');
}

module.exports = { ensureSchema, seedIfEmpty, ingestChallenge, nextCode };
