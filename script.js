'use strict';
/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const btn = (label, fn, c = 'btn') => { const b = el('button', c, label); b.type = 'button'; b.addEventListener('click', fn); return b; };
const API = $('meta[name=api-base]').content.replace(/\/$/, '');
const MAX = 20000, TYPES = { summary: 'Summary', quiz: 'Quiz', cards: 'Flashcards' };
const EP = { summary: '/notes', quiz: '/quiz', cards: '/flashcards' };
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast('Could not save in this browser.', 'err'); } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
function toast(msg, kind = '') { const t = el('div', 'toast ' + kind, msg); t.setAttribute('role', 'status'); $('#toasts').append(t); setTimeout(() => t.remove(), 3500); }
async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied to clipboard.'); } catch { toast('Copy failed. Your browser blocked clipboard access.', 'err'); } }
function download(name, text) {
  try {
    const a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Download started.');
  } catch { toast('Download failed.', 'err'); }
}
const banner = () => el('p', 'demo', 'DEMO CONTENT: sample only, not AI-generated.');

/* ---------- theme & navigation ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t; store.set('np_theme', t);
  const b = $('#themeBtn'); b.textContent = t === 'dark' ? 'Light' : 'Dark';
  b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}
function show(v) {
  document.querySelectorAll('[data-view]').forEach(s => { s.hidden = s.dataset.view !== v; });
  document.querySelectorAll('#nav button').forEach(b => b.setAttribute('aria-current', b.dataset.go === v ? 'page' : 'false'));
  if (v === 'dash') renderDash(); if (v === 'library') renderLib(); scrollTo(0, 0);
}

/* ---------- API ---------- */
async function api(path, body) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 90000); let r;
  try { r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: c.signal }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? 'The request timed out.' : 'Cannot reach the backend. Check that it is running and the API URL is correct.'); }
  finally { clearTimeout(t); }
  let d = null; try { d = await r.json(); } catch { /* handled below */ }
  if (!r.ok) throw new Error((d && d.error) || `Request failed (HTTP ${r.status}).`);
  if (!d) throw new Error('The server returned invalid JSON.');
  return d;
}

/* ---------- demo mode ---------- */
let demo = false;
const DEMO = {
  notes: 'Photosynthesis converts light energy into chemical energy in chloroplasts. The light reactions make ATP and NADPH; the Calvin cycle uses them to fix CO2 into sugar.',
  summary: { summary: '## Photosynthesis (sample)\n- Converts light energy into chemical energy in **chloroplasts**\n- **Light reactions** produce ATP and NADPH\n- **Calvin cycle** fixes CO2 into sugar' },
  quiz: { questions: [
    { question: 'Where does photosynthesis occur?', options: ['Mitochondria', 'Chloroplasts', 'Nucleus', 'Ribosomes'], correctIndex: 1, explanation: 'Chloroplasts contain chlorophyll.' },
    { question: 'What do the light reactions produce?', options: ['ATP and NADPH', 'Glucose only', 'Oxygen only', 'DNA'], correctIndex: 0, explanation: 'They supply energy carriers for the Calvin cycle.' }] },
  cards: { cards: [{ front: 'Light reactions', back: 'Produce ATP and NADPH.' }, { front: 'Calvin cycle', back: 'Fixes CO2 into sugar.' }] }
};
function toggleDemo() {
  demo = !demo; $('#demoBtn').textContent = 'Demo: ' + (demo ? 'on' : 'off'); $('#demoBtn').setAttribute('aria-pressed', demo);
  $('#demoBar').hidden = !demo; toast(demo ? 'Demo mode on: sample content only.' : 'Demo off: real AI generation.');
}

/* ---------- generator panels ---------- */
const G = {};
function setupGen(kind) {
  const sec = $(`[data-view=${kind}]`); sec.append($('#genT').content.cloneNode(true));
  const g = G[kind] = { ta: $('textarea', sec), cnt: $('.cnt', sec), go: $('.go', sec), err: $('.err', sec), out: $('.out', sec), busy: false, src: '' };
  g.go.textContent = { summary: 'Summarize', quiz: 'Generate quiz', cards: 'Generate flashcards' }[kind];
  g.ta.addEventListener('input', () => { g.cnt.textContent = `${g.ta.value.length} / ${MAX}`; g.err.textContent = ''; });
  $('.sample', sec).addEventListener('click', () => { g.ta.value = DEMO.notes; g.ta.dispatchEvent(new Event('input')); });
  g.go.addEventListener('click', () => generate(kind));
}
async function generate(kind) {
  const g = G[kind]; if (g.busy) return;
  const text = g.ta.value.trim(), idle = g.go.textContent;
  if (!demo) {
    if (!text) { g.err.textContent = 'Paste some notes first.'; return; }
    if (text.length > MAX) { g.err.textContent = `Too long: the limit is ${MAX} characters.`; return; }
  }
  g.busy = true; g.go.disabled = true; g.go.textContent = 'Generating...'; g.err.textContent = ''; g.out.setAttribute('aria-busy', 'true');
  let label = idle;
  try {
    const data = demo ? DEMO[kind] : await api(EP[kind], { text });
    g.src = demo ? 'Sample' : text; RENDER[kind](data, demo);
  } catch (e) { g.err.textContent = e.message + ' Your notes are kept. Press Retry.'; label = 'Retry'; }
  finally { g.busy = false; g.go.disabled = false; g.go.textContent = label; g.out.removeAttribute('aria-busy'); }
}

/* ---------- summary ---------- */
function mdToDom(text, root) {
  let list = null;
  const inline = (p, s) => s.split(/\*\*(.+?)\*\*/g).forEach((part, i) => p.append(i % 2 ? el('strong', null, part) : document.createTextNode(part)));
  for (const line of text.split('\n')) {
    let m;
    if ((m = line.match(/^#{1,6}\s+(.*)/))) { list = null; const h = el('h3'); inline(h, m[1]); root.append(h); }
    else if ((m = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/))) {
      if (!list) { list = el('ul'); root.append(list); } const li = el('li'); inline(li, m[1]); list.append(li);
    } else if (line.trim()) { list = null; const p = el('p'); inline(p, line); root.append(p); }
    else list = null;
  }
}
let SUM = null;
function renderSummary(d, isDemo) {
  const s = typeof d.summary === 'string' ? d.summary.trim() : '';
  if (!s) throw new Error('The server returned an empty summary.');
  SUM = s; const out = G.summary.out; out.replaceChildren(); if (isDemo) out.append(banner());
  const box = el('div', 'panel md'); mdToDom(s, box); out.append(box);
  const row = el('div', 'row');
  row.append(btn('Copy Summary', () => copy(s)), btn('Download .md', () => download('summary.md', s)), btn('Download .txt', () => download('summary.txt', s)));
  if (!isDemo) row.append(btn('Save to Library', () => saveItem('summary', { summary: s })));
  row.append(btn('Clear', () => { out.replaceChildren(); G.summary.ta.value = ''; G.summary.ta.dispatchEvent(new Event('input')); SUM = null; }));
  out.append(row);
}

/* ---------- quiz ---------- */
let Q = null;
const validQuiz = qs => Array.isArray(qs) && qs.length > 0 && qs.every(q => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2 && q.options.every(o => typeof o === 'string') && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length);
function renderQuiz(d, isDemo) {
  if (!validQuiz(d.questions)) throw new Error('The quiz data was incomplete. Please try again.');
  Q = { qs: d.questions, i: 0, ans: [], recorded: false, finished: false, demo: isDemo }; drawQuiz();
}
const quizScore = () => Q.qs.filter((q, k) => Q.ans[k] === q.correctIndex).length;
function drawQuiz() {
  const out = G.quiz.out; out.replaceChildren(); if (Q.demo) out.append(banner());
  if (Q.finished) return drawResults(out);
  const q = Q.qs[Q.i], a = Q.ans[Q.i], box = el('div', 'panel');
  box.append(el('p', 'muted', `Question ${Q.i + 1} of ${Q.qs.length}`), el('h3', null, q.question));
  const opts = el('div', 'opts');
  q.options.forEach((o, k) => {
    const b = el('button', 'opt', o); b.type = 'button'; b.disabled = a !== undefined;
    if (a !== undefined) { if (k === q.correctIndex) b.classList.add('right'); else if (k === a) b.classList.add('wrong'); }
    b.addEventListener('click', () => { if (Q.ans[Q.i] === undefined) { Q.ans[Q.i] = k; drawQuiz(); } });
    opts.append(b);
  });
  box.append(opts);
  if (a !== undefined) box.append(el('p', 'expl', (a === q.correctIndex ? 'Correct. ' : 'Incorrect. ') + (q.explanation || '')));
  const nav = el('div', 'row');
  const p = btn('Previous', () => { Q.i--; drawQuiz(); }), n = btn('Next', () => { Q.i++; drawQuiz(); }), f = btn('Finish Quiz', finishQuiz, 'btn primary');
  p.disabled = Q.i === 0; n.disabled = Q.i === Q.qs.length - 1; f.disabled = Q.qs.some((_, k) => Q.ans[k] === undefined);
  nav.append(p, n, f); box.append(nav); out.append(box);
}
function finishQuiz() {
  Q.finished = true;
  if (!Q.recorded && !Q.demo) { Q.recorded = true; const pct = Math.round(100 * quizScore() / Q.qs.length); const p = prog(); p.quizAttempts++; p.bestScore = p.bestScore == null ? pct : Math.max(p.bestScore, pct); store.set(PK, p); }
  drawQuiz();
}
function quizText(withAnswers) {
  const lines = [];
  if (withAnswers) lines.push(`NotePilot quiz results: ${quizScore()}/${Q.qs.length} (${Math.round(100 * quizScore() / Q.qs.length)}%)`, '');
  Q.qs.forEach((q, k) => {
    lines.push(`${k + 1}. ${q.question}`);
    if (withAnswers) lines.push(`   Your answer: ${q.options[Q.ans[k]]}${Q.ans[k] === q.correctIndex ? ' (correct)' : ' (incorrect)'}`);
    lines.push(`   Correct answer: ${q.options[q.correctIndex]}`, `   Explanation: ${q.explanation || 'n/a'}`, '');
  });
  return lines.join('\n');
}
function drawResults(out) {
  const total = Q.qs.length, ok = quizScore(), box = el('div', 'panel');
  box.append(el('h3', null, `Score: ${ok} / ${total} (${Math.round(100 * ok / total)}%)`), el('p', 'muted', `${ok} correct, ${total - ok} incorrect`));
  Q.qs.forEach((q, k) => {
    const r = el('p'); r.append(el('strong', null, `${k + 1}. ${q.question}`)); r.append(el('br'));
    r.append(document.createTextNode(`${Q.ans[k] === q.correctIndex ? 'Correct' : 'Incorrect'}. Answer: ${q.options[q.correctIndex]}. ${q.explanation || ''}`)); box.append(r);
  });
  const row = el('div', 'row');
  row.append(btn('Retry Quiz', () => { Q.ans = []; Q.i = 0; Q.finished = false; Q.recorded = true; drawQuiz(); }),
    btn('Copy Results', () => copy(quizText(true))), btn('Export Results', () => download('quiz-results.txt', quizText(true))));
  if (!Q.demo) row.append(btn('Save Quiz', () => saveItem('quiz', { questions: Q.qs })));
  box.append(row); out.append(box);
}

/* ---------- flashcards ---------- */
let C = null;
const validCards = cs => Array.isArray(cs) && cs.length > 0 && cs.every(c => c && typeof c.front === 'string' && typeof c.back === 'string' && c.front.trim() && c.back.trim());
function renderCards(d, isDemo) {
  if (!validCards(d.cards)) throw new Error('The flashcard data was incomplete. Please try again.');
  C = { all: d.cards, deck: [...d.cards], i: 0, mark: [], recorded: false, demo: isDemo }; drawCards();
}
function restartCards(shuffle) {
  if (shuffle) for (let k = C.deck.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [C.deck[k], C.deck[j]] = [C.deck[j], C.deck[k]]; }
  C.i = 0; C.mark = []; C.recorded = false; drawCards();
}
function markCard(v) {
  C.mark[C.i] = v;
  for (let s = 1; s <= C.deck.length; s++) { const k = (C.i + s) % C.deck.length; if (!C.mark[k]) { C.i = k; break; } }
  drawCards();
}
function drawCards() {
  const out = G.cards.out; out.replaceChildren(); if (C.demo) out.append(banner());
  const n = C.deck.length, known = C.mark.filter(m => m === 'known').length, rev = C.mark.filter(m => m === 'review').length, box = el('div', 'panel');
  if (known + rev === n) {
    if (!C.recorded && !C.demo) { C.recorded = true; const p = prog(); p.cardSessions++; p.known += known; p.review += rev; store.set(PK, p); }
    box.append(el('h3', null, 'Session complete'), el('p', null, `Known: ${known}. Review again: ${rev}.`));
    const row = el('div', 'row'); row.append(btn('Restart Session', () => restartCards(false), 'btn primary'));
    if (!C.demo) row.append(btn('Save Deck', () => saveItem('cards', { cards: C.all })));
    box.append(row); out.append(box); return;
  }
  const c = C.deck[C.i];
  box.append(el('p', 'muted', `${C.i + 1} of ${n} | Known ${known} | Review ${rev}`));
  const card = el('div', 'card'); card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-label', 'Flashcard. Press Enter or Space to flip.');
  card.append(el('div', 'face front', c.front), el('div', 'face back', c.back));
  const answerButton = btn('Show Answer', () => setFlipped(!card.classList.contains('flip')));
  const setFlipped = flipped => {
    card.classList.toggle('flip', flipped);
    answerButton.textContent = flipped ? 'Hide Answer' : 'Show Answer';
    answerButton.setAttribute('aria-pressed', String(flipped));
  };
  const flip = () => setFlipped(!card.classList.contains('flip'));
  card.addEventListener('click', flip); card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  box.append(card);
  const row = el('div', 'row');
  const p = btn('Previous', () => { C.i--; drawCards(); }), nx = btn('Next', () => { C.i++; drawCards(); });
  p.disabled = C.i === 0; nx.disabled = C.i === n - 1;
  row.append(p, nx, answerButton, btn('Know it', () => markCard('known'), 'btn primary'), btn('Review again', () => markCard('review')), btn('Shuffle', () => restartCards(true)), btn('Restart', () => restartCards(false)));
  box.append(row); out.append(box);
}
const RENDER = { summary: renderSummary, quiz: renderQuiz, cards: renderCards };

/* ---------- study library ---------- */
const LIB = 'np_library';
const getLib = () => { const l = store.get(LIB, []); return Array.isArray(l) ? l.filter(i => i && i.id && TYPES[i.type] && i.data && typeof i.title === 'string') : []; };
function saveItem(type, data) {
  const l = getLib(), src = G[type].src.replace(/\s+/g, ' ').slice(0, 50) || 'Untitled';
  l.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, title: `${TYPES[type]}: ${src}`, ts: new Date().toISOString(), data });
  store.set(LIB, l); toast('Saved to Study Library.');
}
function itemText(i) {
  if (i.type === 'summary') return i.data.summary;
  if (i.type === 'quiz') return i.data.questions.map((q, k) => `${k + 1}. ${q.question}\n${q.options.map((o, j) => `   ${j === q.correctIndex ? '*' : '-'} ${o}`).join('\n')}\n   ${q.explanation || ''}`).join('\n\n');
  return i.data.cards.map(c => `Q: ${c.front}\nA: ${c.back}`).join('\n\n');
}
function openItem(i) {
  show(i.type); G[i.type].src = i.title.replace(/^[^:]*: /, '');
  try { RENDER[i.type](i.data, false); } catch (e) { toast('This saved item is damaged: ' + e.message, 'err'); }
}
function renderLib() {
  const box = $('#libList'); box.replaceChildren();
  const q = $('#libSearch').value.trim().toLowerCase(), f = $('#libFilter').value, all = getLib();
  const items = all.filter(i => (f === 'all' || i.type === f) && (!q || (i.title + JSON.stringify(i.data)).toLowerCase().includes(q)));
  if (!all.length) { box.append(el('p', 'panel muted', 'Nothing saved yet. Generate a summary, quiz or deck and press Save.')); return; }
  if (!items.length) { box.append(el('p', 'panel muted', 'No saved items match your search.')); return; }
  items.forEach(i => {
    const row = el('div', 'panel item'), t = el('b', null, i.title);
    row.append(t, el('span', 'muted', `${TYPES[i.type]} | ${new Date(i.ts).toLocaleString()}`),
      btn('Open', () => openItem(i)), btn('Export', () => download(`${i.type}-${i.id}.txt`, itemText(i))),
      btn('Delete', () => { if (confirm('Delete this saved item?')) { store.set(LIB, getLib().filter(x => x.id !== i.id)); renderLib(); toast('Deleted.'); } }));
    box.append(row);
  });
}

/* ---------- progress & dashboard ---------- */
const PK = 'np_progress', P0 = { quizAttempts: 0, bestScore: null, cardSessions: 0, known: 0, review: 0 };
function prog() {
  const s = store.get(PK, {}), p = { ...P0 };
  for (const k of Object.keys(P0)) if (s && Number.isFinite(s[k])) p[k] = s[k];
  return p;
}
function renderDash() {
  const p = prog(), lib = getLib(), st = $('#dashStats'), rc = $('#dashRecent'); st.replaceChildren(); rc.replaceChildren();
  if (!p.quizAttempts && !p.cardSessions) st.append(el('p', 'panel muted', 'No activity yet. Finish a quiz or a flashcard session and your real progress will appear here.'));
  else {
    const g = el('div', 'grid');
    [['Quiz attempts', p.quizAttempts], ['Best quiz score', p.bestScore == null ? 'n/a' : p.bestScore + '%'], ['Flashcard sessions', p.cardSessions], ['Cards known / to review', `${p.known} / ${p.review}`]]
      .forEach(([a, b]) => { const c = el('div', 'panel'); c.append(el('p', 'muted', a), el('h3', null, String(b))); g.append(c); });
    st.append(g, btn('Reset progress', () => { if (confirm('Reset all local progress?')) { store.del(PK); renderDash(); toast('Progress reset.'); } }));
  }
  if (!lib.length) rc.append(el('p', 'panel muted', 'Saved items will show up here.'));
  lib.slice(0, 3).forEach(i => { const r = el('div', 'panel item'); r.append(el('b', null, i.title), btn('Open', () => openItem(i))); rc.append(r); });
}

/* ---------- pomodoro ---------- */
const clamp = (v, lo, hi, d) => Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : d;
const tp = () => { const s = store.get('np_timer', {}); return { focus: clamp(s.focus, 1, 180, 25), short: clamp(s.short, 1, 60, 5), long: clamp(s.long, 1, 120, 15) }; };
const T = { mode: 'focus', running: false, end: 0, left: tp().focus * 60, cycle: 0, id: null };
const LABEL = { focus: 'Focus session', short: 'Short break', long: 'Long break' };
const secs = () => tp()[T.mode] * 60;
const tLeft = () => T.running ? Math.max(0, Math.round((T.end - Date.now()) / 1000)) : T.left;
function tDraw() {
  const s = tLeft(), t = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('#tClock').textContent = t; $('#tMode').textContent = LABEL[T.mode];
  $('#tGo').textContent = T.running ? 'Pause' : (T.left < secs() ? 'Resume' : 'Start');
  document.title = T.running ? `${t} - NotePilot AI` : 'NotePilot AI';
}
function tStop() { if (T.running) T.left = tLeft(); T.running = false; clearInterval(T.id); }
function tToggle() {
  if (T.running) tStop(); else { T.end = Date.now() + T.left * 1000; T.running = true; T.id = setInterval(tTick, 500); }
  tDraw();
}
function tNext(done) {
  tStop(); if (T.mode === 'focus') { T.cycle++; T.mode = T.cycle % 4 === 0 ? 'long' : 'short'; } else T.mode = 'focus';
  T.left = secs(); $('#tMsg').textContent = done ? `${done} Up next: ${LABEL[T.mode]}. Press Start.` : ''; tDraw();
}
function tTick() { if (T.running && tLeft() <= 0) { toast('Time is up!'); tNext('Session complete.'); } else tDraw(); }
function setupTimer() {
  const p = tp(); $('#tFocus').value = p.focus; $('#tShort').value = p.short; $('#tLong').value = p.long;
  ['Focus', 'Short', 'Long'].forEach(n => $('#t' + n).addEventListener('change', () => {
    store.set('np_timer', { focus: $('#tFocus').value, short: $('#tShort').value, long: $('#tLong').value });
    const q = tp(); $('#tFocus').value = q.focus; $('#tShort').value = q.short; $('#tLong').value = q.long;
    if (!T.running) { T.left = secs(); tDraw(); }
  }));
  $('#tGo').addEventListener('click', tToggle);
  $('#tReset').addEventListener('click', () => { tStop(); T.left = secs(); $('#tMsg').textContent = ''; tDraw(); });
  $('#tSkip').addEventListener('click', () => tNext(''));
  document.addEventListener('visibilitychange', tTick); tDraw();
}

/* ---------- init ---------- */
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) show(g.dataset.go); });
$('#themeBtn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('#demoBtn').addEventListener('click', toggleDemo);
$('#libSearch').addEventListener('input', renderLib); $('#libFilter').addEventListener('change', renderLib);
$('#libClear').addEventListener('click', () => { if (getLib().length && confirm('Delete ALL saved items?')) { store.del(LIB); renderLib(); toast('Library cleared.'); } });
['summary', 'quiz', 'cards'].forEach(setupGen);
setupTimer(); setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'); show('dash');
