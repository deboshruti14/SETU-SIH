/**
 * server.js — Project SETU (SIH26043) backend
 * ---------------------------------------------------------------------------
 * Express REST API over a local SQLite database (better-sqlite3). Auto
 * creates + seeds setu.db on first run. See aiEngine.js for the triage
 * pipeline and seed.js for schema/seed data.
 * ---------------------------------------------------------------------------
 */

'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const ai = require('./aiEngine');
const { seedIfEmpty, ingestChallenge } = require('./seed');

const DB_PATH = path.join(__dirname, 'setu.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

seedIfEmpty(db, ai);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function now() { return new Date().toISOString(); }

function getChallengeFull(id) {
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(id);
  if (!challenge) return null;
  const matches = db.prepare('SELECT * FROM matches WHERE challenge_id = ? ORDER BY fit DESC').all(id);
  const audit = db.prepare('SELECT * FROM audit WHERE challenge_id = ? ORDER BY id ASC').all(id);
  const updates = db.prepare('SELECT * FROM updates WHERE challenge_id = ? ORDER BY id DESC').all(id);
  const funding = db.prepare('SELECT * FROM funding WHERE challenge_id = ? ORDER BY id DESC').all(id);
  return { ...challenge, matches, audit, updates, funding };
}

/* ============================================================
   HEALTH
   ============================================================ */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'setu-backend', time: now() });
});

/* ============================================================
   CHALLENGES
   ============================================================ */

// Dry-run the AI pipeline without persisting anything — powers the
// "real-time Bhashini translation preview" in the Citizen/Sahayak view.
app.post('/api/challenges/preview', (req, res) => {
  const { raw, lang, district, state, supporters } = req.body || {};
  if (!raw || !String(raw).trim()) return res.status(400).json({ error: 'raw text is required' });

  const existing = db.prepare("SELECT id, code, text FROM challenges WHERE status != 'closed'").all();
  const result = ai.runTriagePipeline({ raw, lang, district, state, supporters }, existing);
  res.json({
    translatedText: result.translatedText,
    piiRemoved: result.piiRemoved,
    domain: result.domain,
    priority: result.priority,
    severity: result.severity,
    reach: result.reach,
    equity: result.equity,
    dupes: result.dupes,
    steps: result.steps
  });
});

app.get('/api/challenges', (req, res) => {
  const { domain, state, status } = req.query;
  let sql = 'SELECT * FROM challenges WHERE 1=1';
  const params = [];
  if (domain) { sql += ' AND domain = ?'; params.push(domain); }
  if (state) { sql += ' AND state = ?'; params.push(state); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY priority DESC, id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.get('/api/challenges/:id', (req, res) => {
  const full = getChallengeFull(req.params.id);
  if (!full) return res.status(404).json({ error: 'not found' });
  res.json(full);
});

app.post('/api/challenges', (req, res) => {
  const { raw, lang, district, state, submitted_by, supporters } = req.body || {};
  if (!raw || !String(raw).trim()) return res.status(400).json({ error: 'raw text is required' });
  if (!district || !state) return res.status(400).json({ error: 'district and state are required' });

  try {
    const id = ingestChallenge(db, ai, { raw, lang: lang || 'en', district, state, submitted_by, supporters });
    res.status(201).json(getChallengeFull(id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to process submission' });
  }
});

// Advance / set the lifecycle stage (1 Matched, 2 Team Formed, 3 In Progress, 4 Verified)
app.put('/api/challenges/:id/stage', (req, res) => {
  const { stage, actor } = req.body || {};
  const s = Number(stage);
  if (!s || s < 1 || s > 4) return res.status(400).json({ error: 'stage must be 1-4' });

  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'not found' });

  db.prepare('UPDATE challenges SET stage = ?, status = ? WHERE id = ?')
    .run(s, s === 4 ? 'resolved' : 'open', req.params.id);
  db.prepare(`INSERT INTO audit (challenge_id, stage, decision, confidence, actor, override, created_at)
              VALUES (?, 'Milestone Update', ?, 1, ?, 0, ?)`)
    .run(req.params.id, `Stage advanced to ${s}`, actor || 'University partner', now());

  res.json(getChallengeFull(req.params.id));
});

// Human override — Audit Officer edits priority and/or reassigns the top match
app.put('/api/challenges/:id/override', (req, res) => {
  const { priority, reassign_inst_id, actor } = req.body || {};
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'not found' });

  const notes = [];
  if (priority !== undefined && priority !== null && priority !== '') {
    const p = Math.min(99, Math.max(10, Math.round(Number(priority))));
    db.prepare('UPDATE challenges SET priority = ? WHERE id = ?').run(p, req.params.id);
    notes.push(`priority set to ${p}`);
  }
  if (reassign_inst_id) {
    const inst = db.prepare('SELECT * FROM institutions WHERE id = ?').get(reassign_inst_id);
    if (inst) {
      db.prepare('INSERT INTO matches (challenge_id, inst_id, name, fit, why, mentor, joined) VALUES (?,?,?,?,?,?,0)')
        .run(req.params.id, inst.id, inst.name, 100, 'Manually reassigned by human override', inst.mentor);
      notes.push(`reassigned to ${inst.name}`);
    }
  }
  db.prepare(`INSERT INTO audit (challenge_id, stage, decision, confidence, actor, override, created_at)
              VALUES (?, 'Human Override', ?, 1, ?, 1, ?)`)
    .run(req.params.id, notes.join('; ') || 'No change', actor || 'Audit Officer', now());

  res.json(getChallengeFull(req.params.id));
});

app.post('/api/challenges/:id/updates', (req, res) => {
  const { author, body } = req.body || {};
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'body is required' });
  db.prepare('INSERT INTO updates (challenge_id, author, body, created_at) VALUES (?,?,?,?)')
    .run(req.params.id, author || 'University partner', body, now());
  res.status(201).json(getChallengeFull(req.params.id));
});

/* ============================================================
   MATCHES (university acceptance)
   ============================================================ */
app.put('/api/matches/:id/join', (req, res) => {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'not found' });

  db.prepare('UPDATE matches SET joined = 1 WHERE id = ?').run(req.params.id);
  db.prepare('UPDATE challenges SET stage = MAX(stage, 2) WHERE id = ?').run(match.challenge_id);
  db.prepare(`INSERT INTO audit (challenge_id, stage, decision, confidence, actor, override, created_at)
              VALUES (?, 'Consortium Formation', ?, 1, ?, 0, ?)`)
    .run(match.challenge_id, `${match.name} accepted the project`, match.name, now());

  res.json(getChallengeFull(match.challenge_id));
});

/* ============================================================
   INSTITUTIONS
   ============================================================ */
app.get('/api/institutions', (req, res) => {
  res.json(db.prepare('SELECT * FROM institutions ORDER BY name ASC').all());
});

// Everything the University Portal needs for "my matches" in one call
app.get('/api/institutions/:id/matches', (req, res) => {
  const rows = db.prepare(`
    SELECT matches.*, challenges.code, challenges.title, challenges.text, challenges.domain_label,
           challenges.priority, challenges.district, challenges.state, challenges.stage,
           challenges.status, challenges.csr_clause, challenges.funded
    FROM matches JOIN challenges ON challenges.id = matches.challenge_id
    WHERE matches.inst_id = ?
    ORDER BY matches.fit DESC
  `).all(req.params.id);
  res.json(rows);
});

app.post('/api/institutions', (req, res) => {
  const { name, caps, district, state, load, contact, mentor } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const info = db.prepare(`INSERT INTO institutions (name, caps, district, state, load, contact, mentor)
              VALUES (?,?,?,?,?,?,?)`)
    .run(name, caps || '', district || '', state || '', load || 0, contact || '', mentor || '');
  res.status(201).json(db.prepare('SELECT * FROM institutions WHERE id = ?').get(info.lastInsertRowid));
});

/* ============================================================
   CSR PARTNERS + FUNDING
   ============================================================ */
app.get('/api/partners', (req, res) => {
  res.json(db.prepare('SELECT * FROM partners ORDER BY name ASC').all());
});

app.post('/api/partners/:id/pledge', (req, res) => {
  const { challenge_id, amount } = req.body || {};
  const amt = Number(amount);
  if (!challenge_id || !amt || amt <= 0) return res.status(400).json({ error: 'challenge_id and a positive amount are required' });

  const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id);
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challenge_id);
  if (!partner) return res.status(404).json({ error: 'partner not found' });
  if (!challenge) return res.status(404).json({ error: 'challenge not found' });
  if (partner.pool < amt) return res.status(400).json({ error: 'pledge exceeds remaining CSR pool balance' });

  db.prepare('INSERT INTO funding (challenge_id, partner, amount, clause, created_at) VALUES (?,?,?,?,?)')
    .run(challenge_id, partner.name, amt, challenge.csr_clause, now());
  db.prepare('UPDATE challenges SET funded = funded + ? WHERE id = ?').run(amt, challenge_id);
  db.prepare('UPDATE partners SET pool = pool - ? WHERE id = ?').run(amt, partner.id);
  db.prepare(`INSERT INTO audit (challenge_id, stage, decision, confidence, actor, override, created_at)
              VALUES (?, 'CSR Pledge', ?, 1, ?, 0, ?)`)
    .run(challenge_id, `${partner.name} pledged ₹${amt.toLocaleString('en-IN')} under ${challenge.csr_clause}`, partner.name, now());

  res.json({
    partner: db.prepare('SELECT * FROM partners WHERE id = ?').get(partner.id),
    challenge: getChallengeFull(challenge_id)
  });
});

// Pledge history for one CSR partner — powers the CSR dashboard's ledger
app.get('/api/partners/:id/fundings', (req, res) => {
  const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id);
  if (!partner) return res.status(404).json({ error: 'not found' });
  const rows = db.prepare(`
    SELECT funding.*, challenges.code, challenges.title, challenges.domain_label
    FROM funding JOIN challenges ON challenges.id = funding.challenge_id
    WHERE funding.partner = ?
    ORDER BY funding.id DESC
  `).all(partner.name);
  res.json(rows);
});

/* ============================================================
   AUDIT FEED (State Innovation & Audit Officer view)
   ============================================================ */
app.get('/api/audit', (req, res) => {
  const limit = Math.min(500, Number(req.query.limit) || 100);
  const rows = db.prepare(`
    SELECT audit.*, challenges.code AS challenge_code, challenges.title AS challenge_title
    FROM audit LEFT JOIN challenges ON challenges.id = audit.challenge_id
    ORDER BY audit.id DESC LIMIT ?
  `).all(limit);
  res.json(rows);
});

/* ============================================================
   METRICS (equity / bias dashboard)
   ============================================================ */
app.get('/api/metrics', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) c FROM challenges').get().c;
  const byDomain = db.prepare('SELECT domain_label, COUNT(*) c, AVG(priority) avgp FROM challenges GROUP BY domain_label ORDER BY c DESC').all();
  const byDistrict = db.prepare('SELECT district, state, COUNT(*) c, AVG(priority) avgp FROM challenges GROUP BY district, state ORDER BY c DESC').all();
  const avgPriority = db.prepare('SELECT AVG(priority) a FROM challenges').get().a || 0;
  const totalFunded = db.prepare('SELECT SUM(funded) s FROM challenges').get().s || 0;
  const csrEligible = db.prepare('SELECT COUNT(*) c FROM challenges WHERE csr_eligible = 1').get().c;
  const overrides = db.prepare('SELECT COUNT(*) c FROM audit WHERE override = 1').get().c;
  const stageCounts = db.prepare('SELECT stage, COUNT(*) c FROM challenges GROUP BY stage').all();
  res.json({ total, byDomain, byDistrict, avgPriority, totalFunded, csrEligible, overrides, stageCounts });
});

/* ============================================================ */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n  SETU backend ready → http://localhost:${PORT}`);
  console.log(`  SQLite database   → ${DB_PATH}\n`);
});
