import React, { useEffect, useState } from 'react';
import {
  Mic, Send, Upload, MapPin, Users, GraduationCap, Wallet, ShieldCheck,
  CheckCircle2, AlertTriangle, Flame, Sparkles, Languages, Loader2,
  ChevronDown, ChevronRight, History, Coins, ClipboardList, Radio,
  TrendingUp, Building2, PlusCircle, RefreshCw
} from 'lucide-react';

/* ============================================================
   API HELPERS
   ============================================================ */
const API = '/api';

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
async function apiPut(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

/* ============================================================
   CONSTANTS
   ============================================================ */
const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी Hindi' },
  { code: 'bn', label: 'বাংলা Bengali' },
  { code: 'sat', label: 'Santali' }
];

// Simulated ASR output filled in when the "record" button finishes —
// chosen so the words appear in aiEngine.js's glossaries and light up
// the domain classifier nicely in the live demo.
const SAMPLE_VOICE_TEXT = {
  en: 'There is no streetlight on the main road and it is not safe for women to walk here at night.',
  hi: 'हमारे गाँव में पीने का पानी दूषित हो गया है और स्कूल के बच्चे बीमार पड़ रहे हैं।',
  bn: 'আমাদের গ্রামে রাস্তার লাইট নষ্ট, রাতে স্কুল থেকে ফেরার পথে বিপদ হয়।',
  sat: "Ale hoṛ re da'ak kami menaʼ, hoṛko sinaha akana."
};

const STATE_DISTRICTS = {
  Jharkhand: ['Ranchi', 'Dhanbad', 'Simdega', 'East Singhbhum', 'Gumla', 'Pakur'],
  'West Bengal': ['Kolkata', 'Howrah', 'Purulia', 'Darjeeling', 'Malda'],
  Bihar: ['Patna', 'Gaya', 'Muzaffarpur'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Sundargarh']
};

const DOMAIN_STYLES = {
  water: 'bg-sky-50 text-sky-700 border-sky-200',
  agriculture: 'bg-lime-50 text-lime-700 border-lime-200',
  environment: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  education: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  livelihood: 'bg-amber-50 text-amber-700 border-amber-200',
  mobility: 'bg-slate-200 text-slate-700 border-slate-300'
};

const STAGE_LABELS = ['Matched', 'Team Formed', 'In Progress', 'Verified'];

const ROLES = [
  { key: 'citizen', label: 'Citizen / Sahayak', icon: Users },
  { key: 'university', label: 'University & Research', icon: GraduationCap },
  { key: 'csr', label: 'CSR & Industry', icon: Wallet },
  { key: 'audit', label: 'State Audit Officer', icon: ShieldCheck }
];

/* ============================================================
   SMALL PRESENTATIONAL COMPONENTS
   ============================================================ */
function DomainBadge({ label, domainKey }) {
  const cls = DOMAIN_STYLES[domainKey] || DOMAIN_STYLES.environment;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

function PriorityPill({ value }) {
  const cls = value >= 75
    ? 'bg-red-50 text-red-700 border-red-200'
    : value >= 50
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      <Flame size={12} /> {value}
    </span>
  );
}

function FitBar({ value }) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
        <span>Fit score</span><span>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function StageTracker({ stage }) {
  return (
    <div className="flex items-center gap-1.5">
      {STAGE_LABELS.map((label, i) => {
        const s = i + 1;
        const done = s <= stage;
        return (
          <React.Fragment key={label}>
            <div className={`w-2 h-2 rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} title={label} />
            {i < STAGE_LABELS.length - 1 && (
              <div className={`w-4 h-0.5 rounded ${s < stage ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
      <span className="ml-2 text-xs text-slate-500">{STAGE_LABELS[Math.max(0, Math.min(3, stage - 1))]}</span>
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={20} className="text-emerald-600" />}
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
      <AlertTriangle size={15} /> {message}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-10 text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
      {text}
    </div>
  );
}

/* ============================================================
   CITIZEN / SAHAYAK VIEW
   ============================================================ */
function CitizenView() {
  const [lang, setLang] = useState('en');
  const [stateVal, setStateVal] = useState('Jharkhand');
  const [district, setDistrict] = useState('Ranchi');
  const [raw, setRaw] = useState('');
  const [supporters, setSupporters] = useState(1);
  const [recording, setRecording] = useState(false);
  const [photoName, setPhotoName] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState('');

  const districts = STATE_DISTRICTS[stateVal] || [];

  useEffect(() => { loadFeed(); }, []);
  useEffect(() => { setDistrict((STATE_DISTRICTS[stateVal] || [])[0] || ''); }, [stateVal]);

  async function loadFeed() {
    try { setFeed(await apiGet('/challenges')); } catch (e) { /* ignore */ }
  }

  function handleRecord() {
    if (recording) return;
    setRecording(true);
    setTimeout(() => {
      setRecording(false);
      setRaw((prev) => prev.trim() ? prev : (SAMPLE_VOICE_TEXT[lang] || SAMPLE_VOICE_TEXT.en));
    }, 2400);
  }

  function handlePhoto(e) {
    const f = e.target.files && e.target.files[0];
    setPhotoName(f ? f.name : '');
  }

  async function handlePreview() {
    if (!raw.trim()) { setError('Type or record a problem description first.'); return; }
    setPreviewing(true); setError(''); setResult(null);
    try {
      const data = await apiPost('/challenges/preview', { raw, lang, district, state: stateVal, supporters });
      setPreview(data);
    } catch (e) { setError(e.message); }
    setPreviewing(false);
  }

  async function handleSubmit() {
    if (!raw.trim()) { setError('Type or record a problem description first.'); return; }
    setSubmitting(true); setError('');
    try {
      const data = await apiPost('/challenges', {
        raw, lang, district, state: stateVal, supporters, submitted_by: 'Citizen (demo submission)'
      });
      setResult(data);
      setPreview(null);
      setRaw('');
      setPhotoName('');
      loadFeed();
    } catch (e) { setError(e.message); }
    setSubmitting(false);
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Intake form */}
      <Card className="lg:col-span-3 p-6">
        <SectionTitle
          icon={Sparkles}
          title="Report a societal challenge"
          subtitle="Voice, text or photo — SETU normalises it into the AI triage pipeline."
        />

        <div className="flex flex-wrap gap-2 mb-4">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                lang === l.code ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
              }`}
            >
              <Languages size={12} className="inline mr-1 -mt-0.5" />{l.label}
            </button>
          ))}
        </div>

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={5}
          placeholder="Describe the problem in your own language…"
          className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400"
        />

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleRecord}
            disabled={recording}
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition ${
              recording ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
            title="Simulated voice record (Bhashini ASR)"
          >
            <Mic size={18} />
          </button>
          {recording ? (
            <div className="flex items-end gap-1 h-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="waveform-bar w-1.5 bg-emerald-500 rounded-full h-full"
                  style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
              <span className="text-xs text-slate-500 ml-2">Listening (simulated)…</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">Tap the mic to simulate a Bhashini voice recording</span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">State</label>
            <select value={stateVal} onChange={(e) => setStateVal(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-sm">
              {Object.keys(STATE_DISTRICTS).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">District</label>
            <select value={district} onChange={(e) => setDistrict(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-sm">
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">People affected / supporting this</label>
            <input type="number" min="1" value={supporters}
              onChange={(e) => setSupporters(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Photo evidence (optional)</label>
            <label className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 p-2 text-sm text-slate-500 cursor-pointer hover:border-emerald-400">
              <Upload size={14} /> {photoName || 'Attach a photo'}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <button onClick={handlePreview} disabled={previewing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-slate-200 text-slate-700 hover:border-emerald-300 disabled:opacity-50">
            {previewing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Preview AI analysis
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit problem
          </button>
        </div>
        <ErrorNote message={error} />
      </Card>

      {/* Preview / result panel */}
      <Card className="lg:col-span-2 p-6">
        <SectionTitle icon={ClipboardList} title="AI triage preview" subtitle="What SETU's pipeline will do with this submission" />
        {!preview && !result && <EmptyState text="Run a preview or submit to see the AI's reasoning here." />}

        {preview && !result && (
          <div className="space-y-3 fade-in-up">
            <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100">
              <span className="font-medium text-slate-700">Normalised (English): </span>{preview.translatedText}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DomainBadge label={preview.domain.label} domainKey={preview.domain.key} />
              <PriorityPill value={preview.priority} />
            </div>
            <p className="text-xs text-slate-500">{preview.domain.csrClause}</p>
            {preview.dupes?.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle size={13} /> Possible duplicate of {preview.dupes[0].code} ({Math.round(preview.dupes[0].similarity * 100)}% similar)
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-4 fade-in-up">
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm">
              <CheckCircle2 size={16} /> Submitted as <strong>{result.code}</strong>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DomainBadge label={result.domain_label} domainKey={result.domain} />
              <PriorityPill value={result.priority} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Matched partners</p>
              <div className="space-y-2">
                {result.matches.map((m) => (
                  <div key={m.id} className="border border-slate-100 rounded-lg p-2.5">
                    <p className="text-sm font-medium text-slate-700">{m.name}</p>
                    <FitBar value={m.fit} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Audit trail</p>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto thin-scroll pr-1">
                {result.audit.map((a) => (
                  <li key={a.id} className="text-xs text-slate-600 flex gap-2">
                    <span className="text-emerald-600 shrink-0">●</span>
                    <span><strong className="text-slate-700">{a.stage}:</strong> {a.decision}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      {/* Recent feed */}
      <div className="lg:col-span-5">
        <SectionTitle icon={Radio} title="Recent submissions" subtitle="Live feed across all citizens, Sahayaks and local bodies" />
        {feed.length === 0 ? <EmptyState text="No challenges submitted yet." /> : (
          <div className="grid md:grid-cols-3 gap-3">
            {feed.slice(0, 9).map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="text-xs font-mono text-slate-400">{c.code}</span>
                  <PriorityPill value={c.priority} />
                </div>
                <p className="text-sm text-slate-700 line-clamp-2 mb-2">{c.title}</p>
                <div className="flex items-center justify-between">
                  <DomainBadge label={c.domain_label} domainKey={c.domain} />
                  <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={11} />{c.district}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   UNIVERSITY & RESEARCH PORTAL
   ============================================================ */
function UniversityView() {
  const [institutions, setInstitutions] = useState([]);
  const [instId, setInstId] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [updateText, setUpdateText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/institutions').then((list) => {
      setInstitutions(list);
      if (list[0]) setInstId(String(list[0].id));
    });
  }, []);
  useEffect(() => { if (instId) loadMatches(instId); }, [instId]);

  async function loadMatches(id) {
    setLoading(true);
    try { setMatches(await apiGet(`/institutions/${id}/matches`)); } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function openDetail(challengeId) {
    if (expandedId === challengeId) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(challengeId);
    setDetail(await apiGet(`/challenges/${challengeId}`));
  }

  const currentInst = institutions.find((i) => String(i.id) === instId);

  async function join(matchId) {
    try { await apiPut(`/matches/${matchId}/join`, {}); loadMatches(instId); }
    catch (e) { setError(e.message); }
  }

  async function advanceStage(challengeId, stage) {
    try {
      await apiPut(`/challenges/${challengeId}/stage`, { stage, actor: currentInst?.name });
      loadMatches(instId);
      if (expandedId === challengeId) setDetail(await apiGet(`/challenges/${challengeId}`));
    } catch (e) { setError(e.message); }
  }

  async function postUpdate(challengeId) {
    if (!updateText.trim()) return;
    try {
      await apiPost(`/challenges/${challengeId}/updates`, { author: currentInst?.name, body: updateText });
      setUpdateText('');
      setDetail(await apiGet(`/challenges/${challengeId}`));
    } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <SectionTitle
        icon={GraduationCap}
        title="Consortium collaboration board"
        subtitle="Challenges routed to your institution by the capability-matching engine"
        action={
          <select value={instId} onChange={(e) => setInstId(e.target.value)}
            className="rounded-lg border border-slate-200 p-2 text-sm bg-white">
            {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        }
      />
      {currentInst && (
        <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
          <Building2 size={13} /> {currentInst.district}, {currentInst.state} · capabilities: {currentInst.caps} · mentor: {currentInst.mentor}
        </p>
      )}
      <ErrorNote message={error} />

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-emerald-600" /></div>
      ) : matches.length === 0 ? (
        <EmptyState text="No challenges have been routed to this institution yet." />
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <Card key={m.id} className="p-0 overflow-hidden">
              <button onClick={() => openDetail(m.challenge_id)}
                className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{m.code}</span>
                    <DomainBadge label={m.domain_label} domainKey={m.domain} />
                    <PriorityPill value={m.priority} />
                    {m.joined === 1 && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={12} />Accepted</span>}
                  </div>
                  <p className="text-sm text-slate-700 truncate">{m.title}</p>
                  <p className="text-xs text-slate-400 mt-1">{m.district}, {m.state} · {m.csr_clause}</p>
                </div>
                <div className="w-32 shrink-0 hidden sm:block"><FitBar value={m.fit} /></div>
                {expandedId === m.challenge_id ? <ChevronDown size={18} className="text-slate-400 shrink-0" /> : <ChevronRight size={18} className="text-slate-400 shrink-0" />}
              </button>

              {expandedId === m.challenge_id && detail && (
                <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-4 fade-in-up">
                  <p className="text-sm text-slate-600">{detail.text}</p>
                  <p className="text-xs text-slate-500 italic">Why this match: {m.why}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    {m.joined === 0 && (
                      <button onClick={() => join(m.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">
                        <CheckCircle2 size={13} /> Accept project
                      </button>
                    )}
                    <StageTracker stage={detail.stage} />
                    {STAGE_LABELS.map((label, i) => (
                      <button key={label} onClick={() => advanceStage(m.challenge_id, i + 1)}
                        disabled={detail.stage === i + 1}
                        className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-emerald-300 disabled:opacity-40">
                        Set: {label}
                      </button>
                    ))}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1"><History size={12} /> Team & milestone updates</p>
                    <div className="space-y-1.5 mb-2 max-h-28 overflow-y-auto thin-scroll">
                      {detail.updates.length === 0 && <p className="text-xs text-slate-400">No updates posted yet.</p>}
                      {detail.updates.map((u) => (
                        <div key={u.id} className="text-xs text-slate-600 bg-white rounded-lg p-2 border border-slate-100">
                          <strong className="text-slate-700">{u.author}:</strong> {u.body}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={updateText} onChange={(e) => setUpdateText(e.target.value)}
                        placeholder="e.g. Team of 4 students formed, site visit scheduled…"
                        className="flex-1 rounded-lg border border-slate-200 p-2 text-xs" />
                      <button onClick={() => postUpdate(m.challenge_id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs hover:bg-slate-900">Post</button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CSR & INDUSTRY DASHBOARD
   ============================================================ */
function CSRView() {
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState('');
  const [challenges, setChallenges] = useState([]);
  const [fundings, setFundings] = useState([]);
  const [pledgeChallenge, setPledgeChallenge] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiGet('/partners').then((list) => { setPartners(list); if (list[0]) setPartnerId(String(list[0].id)); });
    apiGet('/challenges').then(setChallenges);
  }, []);
  useEffect(() => { if (partnerId) apiGet(`/partners/${partnerId}/fundings`).then(setFundings); }, [partnerId]);

  const currentPartner = partners.find((p) => String(p.id) === partnerId);
  const eligible = challenges.filter((c) => c.csr_eligible === 1);

  async function refreshAll() {
    setChallenges(await apiGet('/challenges'));
    if (partnerId) setFundings(await apiGet(`/partners/${partnerId}/fundings`));
  }

  async function pledge() {
    setError(''); setMessage('');
    const amt = Number(amount);
    if (!pledgeChallenge) { setError('Choose a challenge to fund.'); return; }
    if (!amt || amt <= 0) { setError('Enter a valid pledge amount.'); return; }
    try {
      const data = await apiPost(`/partners/${partnerId}/pledge`, { challenge_id: pledgeChallenge, amount: amt });
      setMessage(`Pledged ₹${amt.toLocaleString('en-IN')} to ${data.challenge.code}.`);
      setAmount('');
      setPartners((prev) => prev.map((p) => (p.id === data.partner.id ? data.partner : p)));
      refreshAll();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1 p-6 h-fit">
        <SectionTitle icon={Wallet} title="CSR wallet" subtitle="Schedule VII grant balance" />
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 p-2 text-sm mb-4">
          {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {currentPartner && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4">
            <p className="text-xs text-emerald-700 mb-1">Remaining pool balance</p>
            <p className="text-2xl font-semibold text-emerald-800">₹{Number(currentPartner.pool).toLocaleString('en-IN')}</p>
            <p className="text-xs text-emerald-600 mt-1">Focus: {currentPartner.focus}</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500">Pledge to a challenge</label>
          <select value={pledgeChallenge} onChange={(e) => setPledgeChallenge(e.target.value)}
            className="w-full rounded-lg border border-slate-200 p-2 text-sm">
            <option value="">Select a CSR-eligible challenge…</option>
            {eligible.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.domain_label} ({c.district})</option>)}
          </select>
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount in ₹" className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
          <button onClick={pledge}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700">
            <Coins size={14} /> Pledge CSR funds
          </button>
          <ErrorNote message={error} />
          {message && <p className="text-xs text-emerald-700 mt-1">{message}</p>}
        </div>

        <div className="mt-6">
          <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1"><History size={12} /> Pledge history</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto thin-scroll">
            {fundings.length === 0 && <p className="text-xs text-slate-400">No pledges yet from this partner.</p>}
            {fundings.map((f) => (
              <div key={f.id} className="text-xs bg-slate-50 border border-slate-100 rounded-lg p-2">
                <strong>{f.code}</strong> · ₹{Number(f.amount).toLocaleString('en-IN')} · {f.domain_label}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="lg:col-span-2">
        <SectionTitle icon={ClipboardList} title="CSR-eligible challenges" subtitle="Filtered by Indian Companies Act Schedule VII clause" />
        {eligible.length === 0 ? <EmptyState text="No CSR-eligible challenges yet." /> : (
          <div className="space-y-3">
            {eligible.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{c.code}</span>
                    <DomainBadge label={c.domain_label} domainKey={c.domain} />
                    <PriorityPill value={c.priority} />
                  </div>
                  <StageTracker stage={c.stage} />
                </div>
                <p className="text-sm text-slate-700 mb-2 line-clamp-2">{c.title}</p>
                <p className="text-xs text-slate-500 mb-2">{c.csr_clause}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1"><MapPin size={11} />{c.district}, {c.state}</span>
                  <span className="font-medium text-emerald-700">₹{Number(c.funded).toLocaleString('en-IN')} funded</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   STATE INNOVATION & AUDIT OFFICER
   ============================================================ */
function AuditView() {
  const [audit, setAudit] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [overrideChallenge, setOverrideChallenge] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [reassignInst, setReassignInst] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    try {
      setAudit(await apiGet('/audit?limit=60'));
      setMetrics(await apiGet('/metrics'));
      setChallenges(await apiGet('/challenges'));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); apiGet('/institutions').then(setInstitutions); }, []);

  async function submitOverride() {
    setError(''); setMessage('');
    if (!overrideChallenge) { setError('Select a challenge to override.'); return; }
    if (!newPriority && !reassignInst) { setError('Set a new priority or choose a reassignment.'); return; }
    try {
      await apiPut(`/challenges/${overrideChallenge}/override`, {
        priority: newPriority || undefined,
        reassign_inst_id: reassignInst || undefined,
        actor: 'State Audit Officer (human override)'
      });
      setMessage('Override applied and logged to the immutable audit trail.');
      setNewPriority(''); setReassignInst('');
      refresh();
    } catch (e) { setError(e.message); }
  }

  const maxDistrictCount = metrics?.byDistrict?.length ? Math.max(...metrics.byDistrict.map((d) => d.c)) : 1;
  const maxDomainCount = metrics?.byDomain?.length ? Math.max(...metrics.byDomain.map((d) => d.c)) : 1;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total challenges', value: metrics?.total ?? '—' },
          { label: 'Avg. priority', value: metrics ? Math.round(metrics.avgPriority) : '—' },
          { label: 'CSR-eligible', value: metrics?.csrEligible ?? '—' },
          { label: 'CSR funded (₹)', value: metrics ? Number(metrics.totalFunded).toLocaleString('en-IN') : '—' },
          { label: 'Human overrides', value: metrics?.overrides ?? '—' }
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-2xl font-semibold text-slate-800 mt-1">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <SectionTitle icon={TrendingUp} title="Domain distribution" subtitle="Where AI classification is routing challenges" />
          <div className="space-y-2.5">
            {metrics?.byDomain?.map((d) => (
              <div key={d.domain_label}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{d.domain_label}</span><span>{d.c} · avg priority {Math.round(d.avgp)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(d.c / maxDomainCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={MapPin} title="District equity view" subtitle="Bias check — is volume concentrated in a few districts?" />
          <div className="space-y-2.5 max-h-64 overflow-y-auto thin-scroll pr-1">
            {metrics?.byDistrict?.map((d) => (
              <div key={d.district + d.state}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{d.district}, {d.state}</span><span>{d.c}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-slate-500 rounded-full" style={{ width: `${(d.c / maxDistrictCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <SectionTitle icon={ShieldCheck} title="Human override" subtitle="Edit AI priority or reassign a university — always logged, never silent" />
        <div className="grid sm:grid-cols-3 gap-3">
          <select value={overrideChallenge} onChange={(e) => setOverrideChallenge(e.target.value)}
            className="rounded-lg border border-slate-200 p-2 text-sm sm:col-span-1">
            <option value="">Select a challenge…</option>
            {challenges.map((c) => <option key={c.id} value={c.id}>{c.code} (priority {c.priority})</option>)}
          </select>
          <input type="number" min="10" max="99" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
            placeholder="New priority (10-99)" className="rounded-lg border border-slate-200 p-2 text-sm" />
          <select value={reassignInst} onChange={(e) => setReassignInst(e.target.value)}
            className="rounded-lg border border-slate-200 p-2 text-sm">
            <option value="">Reassign to institution (optional)…</option>
            {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <button onClick={submitOverride}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-slate-800 text-white hover:bg-slate-900">
          <ShieldCheck size={14} /> Apply override
        </button>
        <ErrorNote message={error} />
        {message && <p className="text-xs text-emerald-700 mt-2">{message}</p>}
      </Card>

      <Card className="p-6">
        <SectionTitle
          icon={History}
          title="Immutable audit feed"
          subtitle="Every AI decision and human override, newest first"
          action={<button onClick={refresh} className="text-slate-400 hover:text-emerald-600"><RefreshCw size={16} /></button>}
        />
        <div className="space-y-1.5 max-h-96 overflow-y-auto thin-scroll pr-1">
          {audit.map((a) => (
            <div key={a.id} className={`flex items-start gap-3 text-xs p-2.5 rounded-lg border ${
              a.override ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'
            }`}>
              <span className="font-mono text-slate-400 shrink-0">{a.challenge_code || '—'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-slate-700"><strong>{a.stage}</strong> — {a.decision}</p>
                <p className="text-slate-400 mt-0.5">
                  {a.actor} · confidence {Math.round((a.confidence || 0) * 100)}% · {new Date(a.created_at).toLocaleString('en-IN')}
                  {a.override === 1 && <span className="ml-2 text-amber-700 font-medium">HUMAN OVERRIDE</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   APP ROOT
   ============================================================ */
export default function App() {
  const [role, setRole] = useState('citizen');
  const [apiUp, setApiUp] = useState(null);

  useEffect(() => {
    apiGet('/health').then(() => setApiUp(true)).catch(() => setApiUp(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">S</div>
                <h1 className="text-lg font-semibold text-slate-800">SETU</h1>
                <span className="text-xs text-slate-400 hidden sm:inline">SIH26043 · Team 6ixTitans · Smart Education</span>
              </div>
            </div>
            {apiUp === false && (
              <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                Backend unreachable — start it with <code>npm start</code> in /backend (port 4000)
              </span>
            )}
          </div>
          <nav className="flex gap-1 mt-4 overflow-x-auto">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const active = role === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => setRole(r.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap border-b-2 transition ${
                    active ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon size={16} /> {r.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {role === 'citizen' && <CitizenView />}
        {role === 'university' && <UniversityView />}
        {role === 'csr' && <CSRView />}
        {role === 'audit' && <AuditView />}
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-6 text-xs text-slate-400">
        Prototype for Smart India Hackathon 2026 · Problem Statement SIH26043 · Team 6ixTitans.
        AI pipeline (translation, classification, priority, routing) is a transparent local simulation — see backend/aiEngine.js.
      </footer>
    </div>
  );
}
