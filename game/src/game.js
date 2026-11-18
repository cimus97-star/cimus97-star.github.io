/* ===== 엔진 ===== */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0');

const W = 1200, H = 640, GAP = 64, V = 10, BUF = 4, DAYS = 10, TARGET = 68, SAVE = 'first-day-ulsan-v5', NT = 6, WD = ['월', '화', '수', '목', '금'];
const WALK = 110, NWALK = 100, NSTROLL = 22;           // 게임 시간 1분에 걷는 거리(px)
const COLORS = ['#e6eaee', '#1c2b44', '#8d2323', '#59697a', '#2d5f8f', '#c2c8ce', '#263a31', '#b0892f'];
const STEEL = '#9aa6b1';
const SIDE = ['coil', 'rack', 'bench', 'lot'];
const STAT = { sk: '역량', tr: '신뢰', en: '컨디션', pf: '성과', q: '직행률', sf: '안전지수', up: '설비 상태', fr: '동기 친밀도' };
const EV = {}; EVENTS.forEach(e => EV[e.id] = e);
const INC = {}; INCS.forEach(e => INC[e.id] = e);
EVENTS.forEach(ev => { if (ev.bal) return; ev.c.forEach(c => {
  const fx = c[2] = { ...(c[2] || {}) }, ex = c[3] || {}, s = (fx.sk || 0) + (fx.tr || 0) + (fx.pf || 0) + (fx.q || 0) * 2 + (fx.sf || 0) + (fx.up || 0);
  let min = s >= 10 ? 40 : s >= 6 ? 30 : s >= 3 ? 20 : s >= 1 ? 10 : 0; if (ex.stop) min = Math.max(0, min - 10);
  if (s >= 6) for (const k of ['sk', 'tr', 'pf']) if (fx[k] > 2) fx[k] = Math.round(fx[k] * 0.7);
  if (s >= 3 && fx.en == null) fx.en = -Math.min(8, Math.round(s / 2) + 1);
  if (s <= 0) { for (const k in fx) if (fx[k] < -2 && k !== 'en') fx[k] = Math.round(fx[k] * 0.6); fx.en = Math.max(fx.en || 0, 0) + 3; if (!fx.pf) fx.pf = 1; }
  c[4] = min;
}); });
const STMAP = {}; Object.keys(ST).forEach(z => { STMAP[z] = {}; ST[z].forEach(s => STMAP[z][s.id] = s); });
const SEATS = [[-54, -42, 's'], [-18, -42, 's'], [18, -42, 's'], [54, -42, 's'], [-54, 44, 'n'], [-18, 44, 'n'], [18, 44, 'n'], [54, 44, 'n']];
const PEERS = NPCS.filter(n => n.peer), PNAME = {}; NPCS.forEach(n => PNAME[n.id] = n.n);
const INSIDE = { press: [600, 580], body: [600, 580], paint: [600, 580], assy: [600, 580], office: [400, 64], canteen: [600, 64] };

/* ---------- 컨베이어 경로: 양 끝이 벽에서 떨어져 있어 사람은 라인 끝을 돌아서 지나간다 ---------- */
const PATH = [[90, 150], [1100, 150], [1100, 320], [100, 320], [100, 490], [1060, 490]];
const SEG = []; let PLEN = 0;
for (let i = 0; i < PATH.length - 1; i++) {
  const [x1, y1] = PATH[i], [x2, y2] = PATH[i + 1], l = Math.hypot(x2 - x1, y2 - y1);
  SEG.push({ x1, y1, x2, y2, l, s: PLEN, a: Math.atan2(y2 - y1, x2 - x1) }); PLEN += l;
}
function ptAt(d) {
  d = clamp(d, 0, PLEN);
  for (const g of SEG) if (d <= g.s + g.l) { const t = (d - g.s) / g.l; return { x: g.x1 + (g.x2 - g.x1) * t, y: g.y1 + (g.y2 - g.y1) * t, a: g.a }; }
  const g = SEG[SEG.length - 1]; return { x: g.x2, y: g.y2, a: g.a };
}
const isSide = s => SIDE.includes(s.k);
function distOf(s) {
  const ry = isSide(s) ? s.y + 75 : s.y;
  for (const g of SEG) if (g.y1 === g.y2 && Math.abs(g.y1 - ry) < 12) return g.s + Math.abs(s.x - g.x1);
  return 0;
}
/* 직무마다 사무동 자리가 다르다: [방, 서는 곳 x, y] */
const HOMEJ = { pe: ['desk', 170, 201], me: ['desk', 250, 201], mt: ['desk', 312, 145], pu: ['desk', 108, 201], pc: ['mes', 776, 221], it: ['mes', 1040, 221], qc: ['lab', 1010, 465], hr: ['hrdesk', 150, 445], sf: ['hrdesk', 230, 501], fi: ['plan', 440, 465] };
let HOMEP = null;
function ipOf(s) {
  if (HOMEP && s === HOMEP.st) return { x: HOMEP.x, y: HOMEP.y };
  if (s.k === 'room') return { x: s.x, y: s.y + s.h / 2 - 18 };
  if (s.k === 'bldg') return { x: DOOR[s.id].out[0], y: DOOR[s.id].out[1] };
  if (s.k === 'port') return { x: s.x, y: s.y - s.h / 2 - 16 };
  if (s.k === 'table') return { x: s.x + 54, y: s.y + 44 };
  return { x: s.x, y: s.y + s.h / 2 + (isSide(s) ? 16 : 20) };
}
const DST = {}; SHOPS.forEach(z => { DST[z] = {}; ST[z].forEach(s => DST[z][s.id] = distOf(s)); });

/* ---------- 길 찾기: 10px 격자 위 A*. 컨베이어와 설비는 막힌 칸이다 ---------- */
const TREES = [[305, 95], [305, 235], [585, 95], [585, 235], [865, 95], [865, 235], [425, 455], [425, 565], [785, 455], [785, 565], [1172, 110], [1172, 240], [26, 110], [26, 240], [26, 455], [26, 580]];
const CS = 10, GW = W / CS, GH = H / CS, GRID = {};
function buildGrid(z) {
  const g = new Uint8Array(GW * GH);
  const blk = (x0, y0, x1, y1) => { for (let cy = Math.max(0, Math.floor(y0 / CS)); cy < Math.min(GH, Math.ceil(y1 / CS)); cy++) for (let c = Math.max(0, Math.floor(x0 / CS)); c < Math.min(GW, Math.ceil(x1 / CS)); c++) { const px = c * CS + 5, py = cy * CS + 5; if (px > x0 && px < x1 && py > y0 && py < y1) g[cy * GW + c] = 1; } };
  blk(-1, -1, W + 1, 12); blk(-1, H - 12, W + 1, H + 1); blk(-1, -1, 12, H + 1); blk(W - 12, -1, W + 1, H + 1);
  if (ZONES[z].line) for (const s of SEG) blk(Math.min(s.x1, s.x2) - 26, Math.min(s.y1, s.y2) - 26, Math.max(s.x1, s.x2) + 26, Math.max(s.y1, s.y2) + 26);
  if (z === 'yard') for (const [a, b] of TREES) blk(a - 12, b - 12, a + 12, b + 12);
  for (const s of ST[z]) { if (s.k === 'room') { const rp = roomParts(s); for (const f of rp.walls.concat(rp.furn)) blk(f[0] - 4, f[1] - 4, f[2] + 4, f[3] + 4); continue; } const eh = s.k === 'robots' ? 14 : 0; blk(s.x - s.w / 2 - 4, s.y - s.h / 2 - eh - 4, s.x + s.w / 2 + 4, s.y + s.h / 2 + eh + 4); }
  return g;
}
Object.keys(ST).forEach(z => GRID[z] = buildGrid(z));
const free = (z, x, y) => x >= 0 && y >= 0 && x < W && y < H && !GRID[z][Math.floor(y / CS) * GW + Math.floor(x / CS)];
function snap(z, x, y) {
  x = clamp(x, 1, W - 1); y = clamp(y, 1, H - 1); if (free(z, x, y)) return { x, y };
  const c0 = Math.floor(x / CS), r0 = Math.floor(y / CS); let best = null, bd = 1e9;
  for (let r = 1; r < 30 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const c = c0 + dx, r2 = r0 + dy; if (c < 0 || r2 < 0 || c >= GW || r2 >= GH || GRID[z][r2 * GW + c]) continue;
    const px = c * CS + 5, py = r2 * CS + 5, d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = { x: px, y: py }; } }
  return best || { x, y };
}
function los(z, a, b) { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 2); for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; if (!free(z, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; } return true; }
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
function findPath(z, x0, y0, x1, y1) {
  const g = GRID[z], a = snap(z, x0, y0), b = snap(z, x1, y1);
  if (los(z, a, b)) return [b];
  const sx = Math.floor(a.x / CS), sy = Math.floor(a.y / CS), tx = Math.floor(b.x / CS), ty = Math.floor(b.y / CS), s = sy * GW + sx, t = ty * GW + tx, N = GW * GH;
  const gs = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), hp = [];
  const push = (f, n) => { hp.push([f, n]); let i = hp.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hp[p][0] <= hp[i][0]) break; [hp[p], hp[i]] = [hp[i], hp[p]]; i = p; } };
  const pop = () => { const top = hp[0], last = hp.pop(); if (hp.length) { hp[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < hp.length && hp[l][0] < hp[m][0]) m = l; if (r < hp.length && hp[r][0] < hp[m][0]) m = r; if (m === i) break; [hp[m], hp[i]] = [hp[i], hp[m]]; i = m; } } return top; };
  gs[s] = 0; push(0, s);
  while (hp.length) {
    const c = pop()[1]; if (closed[c]) continue; closed[c] = 1; if (c === t) break; const c1 = c % GW, cy = Math.floor(c / GW);
    for (const [dx, dy, w] of DIRS) { const nx = c1 + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const n = ny * GW + nx; if (g[n] || closed[n]) continue; if (dx && dy && (g[cy * GW + nx] || g[ny * GW + c1])) continue; const ng = gs[c] + w; if (ng < gs[n]) { gs[n] = ng; from[n] = c; push(ng + Math.hypot(tx - nx, ty - ny), n); } }
  }
  if (from[t] < 0) return [b];
  const pts = []; for (let c = t; c !== s && c >= 0; c = from[c]) pts.push({ x: (c % GW) * CS + 5, y: Math.floor(c / GW) * CS + 5 });
  pts.reverse(); pts[pts.length - 1] = b;
  const out = []; let cur = a, i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !los(z, cur, pts[j])) j--; out.push(pts[j]); cur = pts[j]; i = j + 1; }
  return out;
}
function follow(o, dist) {
  while (dist > 0 && o.path && o.path.length) {
    const p = o.path[0], dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
    if (d > 0.5) { o.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : (dy > 0 ? 's' : 'n'); o.mv = true; }
    if (d <= dist) { o.x = p.x; o.y = p.y; o.path.shift(); dist -= d; } else { o.x += dx / d * dist; o.y += dy / d * dist; dist = 0; }
  }
  return !o.path || !o.path.length;
}
/* 여러 구역을 걸어서 건너간다: 지금 건물의 출입구 → 구내 도로 → 목적지 건물 출입구 → 목적지 */
function travel(o, dist) {
  const g = o.trip;
  if (!o.path) { const tg = o.z === g.z ? g : o.z === 'yard' ? { x: DOOR[g.z].out[0], y: DOOR[g.z].out[1] } : { x: DOOR[o.z].in[0], y: DOOR[o.z].in[1] }; o.path = findPath(o.z, o.x, o.y, tg.x, tg.y); }
  if (!follow(o, dist)) return false;
  o.path = null;
  if (o.z === g.z) { o.trip = null; return true; }
  if (o.z === 'yard') { const d = DOOR[g.z].in; o.z = g.z; o.x = d[0]; o.y = d[1]; } else { const d = DOOR[o.z].out; o.z = 'yard'; o.x = d[0]; o.y = d[1]; }
  return false;
}

/* ---------- 상태 ---------- */
let S = null;
let LN = [];
let NP = [];
const UI = { modal: null, keys: {}, auto: null, near: null, flash: null, started: false, t: 0, hudT: 0, fade: 0, cardAt: null, toastT: 0, pressBeat: 0, doorLock: false, lookArr: [1, 1, 0, 0, 0], after: 0, stepT: 0, sit: false, spark: null, autoT: 0 };
const ME = { path: null, trip: null, dir: 's', mv: false,
  get x() { return S.px; }, set x(v) { S.px = v; }, get y() { return S.py; }, set y(v) { S.py = v; },
  get z() { return S.zone; }, set z(v) { if (v !== S.zone) { S.zone = v; onZone(); } } };

function newState(name, job, look) {
  return { name, job, look: look || [1, 1, 0, 0, 0], day: 1, min: 480, speed: 1, paused: false, zone: 'office', px: 250, py: 250,
    stats: { sk: 10, tr: 30, en: 80, pf: 0 }, plant: { q: 92, sf: 85, up: 80 },
    used: {}, queue: [], tasks: [], sched: [], incS: [], incUsed: {}, inc: null, met: {}, talk: {}, seen: {}, log: [], hist: [], today: [],
    prod: { today: 0, total: 0, ftt: 0 }, down: 0, zoneMin: {}, gain: { sk: 0, tr: 0, pf: 0 }, work: null, jobEv: false, done: 0, lowWarn: false, dayStart: null,
    lunch: false, ate: false, tray: false, insight: 0, lunches: 0, incOk: 0, incMiss: 0,
    peers: { p1: 15, p2: 15, p3: 15 }, pscore: { p1: 13, p2: 14, p3: 12 }, peerTalk: {}, msgs: [], unread: {}, favorDay: 0, chatS: [], chatUsed: {}, lunchWith: 0, th: 'peers',
    auto: false, ach: {}, tables: {}, sparks: 0, perfect: 0, grades: [], fit: 0, dInc: [0, 0], pspeed: 0, eve: [0, 0, 0, 0],
    notes: {}, qz: {}, qstat: [0, 0], order: 0, orderDone: {}, newsUsed: {}, dfx: {}, target: TARGET, tourSkip: false, newNotes: 0, news: null };
}
function prefill() {
  LN = SHOPS.map(k => ({ k, u: [], buf: [], stop: 0, at: null, why: '', blocked: false }));
  LN.forEach(L => { for (let d = PLEN; d >= 0; d -= GAP) L.u.push({ d, c: pick(COLORS) }); });
  NP = NPCS.map(n => { const p = snap(n.z, n.x, n.y); return { ...n, x: p.x, y: p.y, hz: n.z, hx: p.x, hy: p.y, wait: rnd(0, 10), mode: 'idle', dir: 's', mv: false, path: null, trip: null, table: null, L: LOOKS[n.id] }; });
}
function homeNpcs() { for (const n of NP) { n.z = n.hz; n.x = n.hx; n.y = n.hy; n.mode = 'idle'; n.path = null; n.trip = null; n.dir = 's'; n.table = null; n.disp = null; } }

/* ---------- 소리 ---------- */
const AU = { ctx: null, master: null, muted: false, amb: null, nb: null };
function initAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; AU.ctx = new C();
    AU.master = AU.ctx.createGain(); AU.master.gain.value = AU.muted ? 0 : 0.5; AU.master.connect(AU.ctx.destination);
    const b = AU.ctx.createBuffer(1, AU.ctx.sampleRate * 2, AU.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AU.nb = b;
    const src = AU.ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const f = AU.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200;
    const g = AU.ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(AU.master); src.start(); AU.amb = { f, g };
  } catch (e) { AU.ctx = null; }
}
function tone(f, d, type = 'sine', v = 0.12, slide = 0, delay = 0) {
  if (!AU.ctx) return; const t = AU.ctx.currentTime + delay, o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + d + 0.03);
}
function noise(d, v, freq, type = 'bandpass', delay = 0) {
  if (!AU.ctx) return; const t = AU.ctx.currentTime + delay, s = AU.ctx.createBufferSource(), f = AU.ctx.createBiquadFilter(), g = AU.ctx.createGain();
  s.buffer = AU.nb; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, Math.random()); s.stop(t + d + 0.02);
}
const SFX = {
  click() { tone(720, 0.05, 'triangle', 0.07); },
  door() { noise(0.16, 0.05, 700, 'lowpass'); tone(180, 0.1, 'sine', 0.05, -60, 0.05); },
  step() { noise(0.03, 0.018, 500 + Math.random() * 300, 'lowpass'); },
  open() { tone(520, 0.08, 'sine', 0.08); tone(780, 0.1, 'sine', 0.07, 0, 0.07); },
  alarm() { for (let i = 0; i < 3; i++) { tone(880, 0.14, 'square', 0.06, 0, i * 0.3); tone(660, 0.14, 'square', 0.06, 0, i * 0.3 + 0.15); } },
  event() { tone(587, 0.16, 'triangle', 0.1); tone(784, 0.16, 'triangle', 0.1, 0, 0.16); tone(587, 0.22, 'triangle', 0.1, 0, 0.32); },
  urgent() { for (let i = 0; i < 2; i++) { tone(988, 0.09, 'square', 0.07, 0, i * 0.22); tone(988, 0.09, 'square', 0.07, 0, i * 0.22 + 0.1); } },
  good() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'sine', 0.1, 0, i * 0.08)); },
  bad() { tone(300, 0.25, 'sawtooth', 0.07, -140); tone(180, 0.35, 'sawtooth', 0.07, -80, 0.2); },
  neutral() { tone(440, 0.12, 'sine', 0.08); tone(494, 0.14, 'sine', 0.08, 0, 0.1); },
  done() { tone(660, 0.1, 'triangle', 0.1); tone(990, 0.2, 'triangle', 0.1, 0, 0.1); },
  car() { tone(1320, 0.12, 'sine', 0.04); },
  chime() { [392, 523, 659].forEach((f, i) => tone(f, 0.5, 'sine', 0.09, 0, i * 0.18)); },
  lunch() { [659, 523, 587, 392, 392, 587, 659, 523].forEach((f, i) => tone(f, 0.34, 'sine', 0.08, 0, i * 0.3)); },
  tray() { noise(0.05, 0.06, 3000, 'highpass'); tone(1500, 0.05, 'sine', 0.04, 0, 0.04); },
  bell() { [784, 659, 523, 392].forEach((f, i) => tone(f, 0.4, 'sine', 0.09, 0, i * 0.2)); },
  press() { tone(70, 0.22, 'sine', 0.22, -30); noise(0.08, 0.1, 300, 'lowpass'); },
  weld() { noise(0.06 + Math.random() * 0.08, 0.035, 4000 + Math.random() * 3000, 'highpass'); },
  tool() { noise(0.12, 0.03, 1800, 'bandpass'); },
  spark() { tone(1047, 0.06, 'triangle', 0.09); tone(1568, 0.1, 'triangle', 0.09, 0, 0.06); },
  msg() { tone(880, 0.07, 'sine', 0.08); tone(1175, 0.12, 'sine', 0.08, 0, 0.08); },
  talk() { tone(360 + Math.random() * 120, 0.06, 'triangle', 0.06); tone(420 + Math.random() * 120, 0.06, 'triangle', 0.06, 0, 0.07); }
};
const AMB = { press: [140, 0.07], body: [500, 0.05], paint: [1100, 0.035], assy: [380, 0.045], office: [160, 0.012], canteen: [700, 0.03], yard: [260, 0.03] };
function setAmb() {
  if (!AU.amb) return; const on = S && UI.started && !UI.modal && !S.paused; let [f, v] = AMB[S ? S.zone : 'office'];
  if (S && S.lunch && ZONES[S.zone].line) v *= 0.3; if (S && !S.lunch && S.zone === 'canteen') v *= 0.3;
  const t = AU.ctx.currentTime; AU.amb.f.frequency.setTargetAtTime(f, t, 0.2); AU.amb.g.gain.setTargetAtTime(on ? v : 0, t, 0.2);
}
function toggleMute() { AU.muted = !AU.muted; if (AU.master) AU.master.gain.value = AU.muted ? 0 : 0.5; $('#bMute').setAttribute('aria-pressed', AU.muted); $('#bMute').firstChild.textContent = AU.muted ? '소리 꺼짐 ' : '소리 켜짐 '; }

/* ---------- 로그·토스트 ---------- */
function log(m, k = '') { S.log.unshift({ t: hhmm(S.min), m, k }); if (S.log.length > 60) S.log.pop(); renderLog(); }
function toast(m, k = '') { const t = $('#toast'); t.textContent = m; t.className = 'toast show ' + k; UI.toastT = 3.6; }
/* 입자와 떠오르는 글자 */
const FXP = [], FXT = [];
function burst(x, y, z, n, col, sp = 1) { if (RM) return; for (let i = 0; i < n && FXP.length < 170; i++) { const a = Math.random() * 6.283, v = (14 + Math.random() * 30) * sp; FXP.push({ x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: (30 + Math.random() * 50) * sp, g: 150, life: 0.6 + Math.random() * 0.5, max: 1.1, col: css(col), sz: 1.6 + Math.random() * 1.8 }); } }
function puff(x, y, z, col, up = 14) { if (RM || FXP.length > 170) return; FXP.push({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), z, vx: rnd(-3, 3), vy: rnd(-3, 3), vz: up, g: -2, life: 1.6, max: 1.6, col: css(col, 0.5), sz: 4 + Math.random() * 3, soft: 1 }); }
function floatTxt(txt, good) { if (FXT.length < 8) FXT.push({ txt, good, life: 1.9, wait: FXT.length * 0.28 }); }
function fxTick(dt) {
  for (let i = FXP.length - 1; i >= 0; i--) { const p = FXP[i]; p.life -= dt; if (p.life <= 0) { FXP.splice(i, 1); continue; } p.vz -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.z < 0.5 && !p.soft) { p.z = 0.5; p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6; } }
  if (!UI.modal) for (let i = FXT.length - 1; i >= 0; i--) { const f = FXT[i]; if (f.wait > 0) { f.wait -= dt; continue; } f.life -= dt; if (f.life <= 0) FXT.splice(i, 1); }
}
function fxDraw() {
  for (const p of FXP) { const q = proj([p.x, p.y, p.z]); if (q[2] < 10) continue; const r = Math.max(0.8, p.sz * CM.foc / q[2] * 0.55); cx.globalAlpha = clamp(p.life / p.max * (p.soft ? 0.7 : 1.6), 0, 1); cx.fillStyle = p.col; if (p.soft) { cx.beginPath(); cx.arc(q[0], q[1], r, 0, 6.3); cx.fill(); } else cx.fillRect(q[0] - r, q[1] - r, r * 2, r * 2); }
  cx.globalAlpha = 1;
  const m = CAM.fp ? [VW / 2, VH * 0.72, 100] : proj([S.px, S.py, 62]); if (m[2] < 10) return;
  cx.font = '700 13px "IBM Plex Sans KR", system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  for (const f of FXT) { if (f.wait > 0) continue; const k = 1 - f.life / 1.9, y = m[1] - 26 - k * 46, w = cx.measureText(f.txt).width + 14; cx.globalAlpha = clamp(f.life * 2, 0, 1); rr(m[0] - w / 2, y - 10, w, 20, 10, f.good ? P.ok : P.bad); cx.fillStyle = '#fff'; cx.fillText(f.txt, m[0], y + 1); }
  cx.globalAlpha = 1;
}
function fxApply(fx, peer) {
  const chips = [];
  for (const k in fx) {
    const v = fx[k]; if (!v) continue; let name = STAT[k];
    if (k === 'fr') { const ids = peer && S.peers[peer] != null ? [peer] : Object.keys(S.peers); ids.forEach(id => S.peers[id] = clamp(S.peers[id] + v, 0, 100)); name = ids.length === 1 ? `${PNAME[ids[0]]} 친밀도` : '동기 친밀도'; }
    else if (k in S.stats) { S.stats[k] = clamp(S.stats[k] + v, 0, 100); if (v > 0 && k in S.gain) S.gain[k] += v; }
    else S.plant[k] = clamp(S.plant[k] + v, k === 'q' ? 60 : 0, k === 'q' ? 99 : 100);
    chips.push(`<span class="chip ${v > 0 ? 'up' : 'dn'}">${name} ${v > 0 ? '+' : '−'}${Math.abs(v)}</span>`); floatTxt(`${name} ${v > 0 ? '+' : '−'}${Math.abs(v)}`, v > 0);
  }
  return chips;
}
const chipText = chips => chips.map(c => c.replace(/<[^>]+>/g, '')).join(' · ');
const menuOf = () => MENUS[(S.day - 1) % MENUS.length];

/* ---------- 라인 시뮬레이션 ---------- */
function stopLine(k, min, at, why, quiet) {
  const L = LN[SHOPS.indexOf(k)]; L.stop += min; if (at && STMAP[k][at]) L.at = at; L.why = why || L.why;
  postMsg('ops', '생산 상황실', `${ZONES[k].full} 라인 정지 · ${why}`);
  if (!quiet) { log(`${ZONES[k].full} 라인 정지: ${why} (약 ${Math.round(min)}분)`, 'bad'); SFX.alarm(); if (S.zone === k) shake(2); }
}
function shipCar() {
  S.prod.today++; S.prod.total++; if (Math.random() * 100 < S.plant.q) S.prod.ftt++;
  if (S.zone === 'assy' && !UI.modal) SFX.car();
}
const MINOR = { press: ['금형 스크랩 걸림', '블랭크 이송 센서 오검지'], body: ['용접 팁 교환', '로봇 셀 안전문 열림 감지'], paint: ['도장 로봇 노즐 세척', '컨베이어 과부하 알람'], assy: ['부품 오삽입 확인', '체결 토크 이상 알람'] };
function simLines(dt) {
  if (S.lunch) return;
  for (let i = 3; i >= 0; i--) {
    const L = LN[i];
    if (L.stop > 0) { L.stop -= dt; S.down += dt; if (L.stop <= 0) { L.stop = 0; L.at = null; log(`${ZONES[L.k].full} 라인 재가동`, 'ok'); postMsg('ops', '생산 상황실', `${ZONES[L.k].full} 라인 재가동`); } continue; }
    L.blocked = false;
    while (L.u.length && L.u[0].d >= PLEN) {
      if (i === 3) { L.u.shift(); shipCar(); }
      else if (LN[i + 1].buf.length < BUF) LN[i + 1].buf.push(L.u.shift());
      else { L.blocked = true; break; }
    }
    for (let k = 0; k < L.u.length; k++) { const u = L.u[k], max = k === 0 ? PLEN : L.u[k - 1].d - GAP; if (u.d < max) u.d = Math.min(max, u.d + V * dt); }
    const last = L.u[L.u.length - 1];
    if (!last || last.d >= GAP) {
      const d0 = last ? Math.max(0, last.d - GAP) : 0;
      if (i === 0) L.u.push({ d: d0, c: pick(COLORS) });
      else if (L.buf.length) { const u = L.buf.shift(); u.d = d0; L.u.push(u); }
    }
    const risk = dt * 0.0005 * clamp(1 + (80 - S.plant.up) / 20, 0.3, 3) * ((S.dfx.r && S.dfx.r[L.k]) || 1);
    if (Math.random() < risk) { const on = ST[L.k].filter(s => !isSide(s)); stopLine(L.k, rnd(5, 11), pick(on).id, pick(MINOR[L.k])); }
  }
}
function lineState(i) {
  const L = LN[i]; if (S.lunch) return ['warn', '점심 휴식'];
  if (L.stop > 0) return ['bad', `정지 ${Math.ceil(L.stop)}분`];
  if (L.blocked) return ['warn', '뒤 공정 밀림'];
  const last = L.u[L.u.length - 1]; if (i > 0 && !L.buf.length && (!last || last.d > GAP * 1.6)) return ['warn', '앞 공정 대기'];
  return ['ok', '가동'];
}
function uptime() { const el = Math.max(1, S.min <= 720 ? S.min - 480 : S.min < 780 ? 240 : S.min - 540); return clamp(100 * (1 - S.down / (4 * el)), 0, 100); }

/* ---------- 하루 ---------- */
function startDay() {
  const J = JOBS[S.job]; S.min = 480; S.prod.today = 0; S.prod.ftt = 0; S.down = 0; S.today = []; S.jobEv = false; S.work = null; S.lowWarn = false; S.paused = false;
  S.lunch = false; S.ate = false; S.tray = false; S.inc = null;
  // 오늘의 뉴스: 산업과 회사 소식이 그날 공장에 실제로 영향을 준다
  S.dfx = {}; S.news = null; S.target = TARGET;
  if (S.day > 1) { let pool = NEWSD.map((n, i) => i).filter(i => !S.newsUsed[i]); if (!pool.length) { S.newsUsed = {}; pool = NEWSD.map((n, i) => i); } const ni = pick(pool), nw = NEWSD[ni]; S.newsUsed[ni] = 1; S.news = ni; S.dfx = nw[3]; S.target = TARGET + (nw[3].t || 0); learn(nw[4], true); postMsg('news', '사내 뉴스', `<b>${nw[0]}</b> · ${nw[1]} ${nw[2]}`); }
  buildTasks();
  { const od = S.tasks.find(t => t.kind === 'order'); if (od) { const o = ORDER[od.oi]; postMsg('order', PNAME[o[1]], o[5]); } }
  S.dInc = [0, 0]; UI.spark = null;
  const wins = [[S.day === 1 ? 560 : 515, 690], [805, 895], [915, 1000]], n = S.day % 2 ? 2 : 3;
  S.sched = wins.slice(0, n).map(w => ({ t: Math.floor(rnd(w[0], w[1])), f: false }));
  const iw = S.day === 1 ? [[840, 950]] : S.day % 3 === 0 ? [[530, 670]] : [[530, 670], [810, 960]];
  S.incS = iw.map(w => { let t = Math.floor(rnd(w[0], w[1])); if (S.sched.some(e => Math.abs(e.t - t) < 18)) t += 22; return { t, f: false }; });
  S.chatS = [[540, 650], [830, 960]].map(w => ({ t: Math.floor(rnd(w[0], w[1])), f: false })); S.lunchWith = 0;
  CAM.snap = true; S.zone = 'office'; S.px = HOMEP.x; S.py = HOMEP.y; ME.path = null; ME.trip = null; ME.dir = 'n'; ME.yaw = null; ME.vyaw = null; if (CAM.tdist < 860) CAM.yaw = Math.PI / 2; UI.auto = null; UI.near = null; UI.sit = false; hideCard();
  LN.forEach(L => { L.stop = Math.min(L.stop, 5); });
  homeNpcs();
  S.dayStart = { ...S.stats };
  try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {}
  postMsg('n15', PNAME.n15, TIPS[(S.day - 1) % TIPS.length]);
  renderAll(); briefing();
}
function buildTasks() {
  const J = JOBS[S.job], mk = (t, o) => ({ t: t[0], z: t[1], s: t[1] === 'office' && t[2] === 'desk' ? HOMEP.id : t[2], m: t[3], left: t[3], learn: t[4], done: false, sp: rnd(0.3, 0.65), ...o }), jt = [0, 1, 2].map(i => J.tasks[((S.day - 1) * 3 + i) % J.tasks.length]);
  const report = mk(['일일 업무 보고 작성', 'office', 'desk', 20, '오늘 한 일, 내일 할 일, 도움이 필요한 것. 세 줄이면 충분하다.'], { kind: 'report', from: 930 });
  if (S.day === 1 && !S.tourSkip) {
    // 첫날: 멘토와 공장을 한 바퀴 돈 뒤 오후에 첫 업무를 받는다
    S.tasks = TOUR.map((t, i) => mk([`공장 투어 ${i + 1}/${TOUR.length} · ${t[2].split(':')[0]}`, t[0], t[1], 6, t[3]], { kind: 'tour', ti: i, seq: i > 0 })).concat([mk(jt[0], { kind: 'job', from: 780 }), report]);
  } else {
    // 오전: 회의와 직무 업무 둘. 오후 13:00에 두 건이 더 내려오고, 15:30부터 일일 보고를 쓴다
    S.tasks = [mk(['아침 생산회의 참석', 'office', 'meet', 20, '전날 실적, 오늘 계획, 문제점을 짧게 나눈다. 여기서 들은 한마디가 하루 동선을 바꾼다.'], { kind: 'meet', to: 575 }),
      mk(jt[0], { kind: 'job' }), mk(jt[1], { kind: 'job' }), mk(jt[2], { kind: 'job', from: 780 }),
      mk(COMMON[(S.day * 3 + JOBKEYS.indexOf(S.job)) % COMMON.length], { kind: 'team', from: 780 }), report];
    const oi = ORDER.findIndex(o => o[0] === S.day); if (oi >= 0) { const o = ORDER[oi]; S.tasks.push(mk([o[4], o[2], o[3], 10, o[6]], { kind: 'order', opt: true, oi })); }
  }
}
function guideTo(i) { const n = NP.find(n => n.id === 'n15'); if (!n || S.lunch) return; if (i == null) { n.trip = { z: n.hz, x: n.hx, y: n.hy }; n.then = 'idle'; } else { const t = TOUR[i], p = ipOf(STMAP[t[0]][t[1]]), q = snap(t[0], p.x + 28, p.y + 6); n.trip = { z: t[0], x: q.x, y: q.y }; n.then = 'guide'; } n.mode = 'trip'; n.path = null; }
function briefing() {
  const due = S.queue.some(q => q.day <= S.day), tour = S.tasks.some(t => t.kind === 'tour'), nw = S.news != null ? NEWSD[S.news] : null, od = S.tasks.find(t => t.kind === 'order');
  const first = S.day === 1 ? `<p>${esc(S.name)} 님, 입사를 환영합니다. 오늘부터 ${DAYS}일 동안 <b>${CODEX[S.job].n}</b> 신입사원으로 일합니다. ${tour ? '오전에는 멘토 채은성 책임과 공장을 한 바퀴 돕니다. 차 한 대가 만들어지는 순서 그대로 걸어요.' : ''} 보고 들은 것은 노트(<kbd>N</kbd>)에 쌓이고, 퇴근할 때 짧은 퀴즈로 확인합니다.</p>` : '';
  openModal(`<p class="eyebrow">${S.day}일차 ${WD[(S.day - 1) % 5]}요일 · 08:00 아침 조회</p><h2>${S.day === 1 ? '첫 출근' : '오늘의 업무'}</h2>${first}
    ${nw ? `<div class="newsbox"><small>오늘의 뉴스</small><b>${nw[0]}</b><p>${nw[1]}</p><p class="imp">${nw[2]}</p></div>` : ''}
    <ol class="brief">${tour ? `<li><b>공장 투어 ${TOUR.length}곳</b><span>사무동 상황실 → 프레스 → 차체 → 도장 → 의장 → 검사. 노란 표시를 따라가면 됩니다</span></li><li><b>첫 업무 1건과 일일 보고</b><span>오후에 내려옵니다</span></li>` : S.tasks.filter(t => t.from !== 780 && !t.opt).map(t => `<li><b>${t.t}</b><span>${t.to ? hhmm(t.to) + '까지 · ' : ''}${t.from ? hhmm(t.from) + '부터 · ' : ''}${ZONES[t.z].full} · ${STMAP[t.z][t.s].n} · ${t.m}분</span></li>`).join('') + '<li><b>오후 업무 2건</b><span>13:00에 팀장님이 메신저로 내려보냅니다</span></li>'}</ol>
    ${od ? `<p class="hint"><b>선택 · ${od.t}</b> — 주문 한 대가 회사를 어떻게 지나가는지 따라가는 일입니다. 안 해도 평가에는 영향이 없습니다.</p>` : ''}
    <p class="hint">업무는 해당 설비 앞에서 <kbd>E</kbd>로 시작합니다. <kbd>T</kbd>를 누르면 다음 업무 장소까지 걸어가고, <kbd>F</kbd>를 켜면 업무를 알아서 이어 갑니다. 12시에는 구내식당(<kbd>6</kbd>)에서 점심을 먹습니다.${due ? ' <b>지난 선택의 결과가 오늘 돌아올 것 같습니다.</b>' : ''}</p>
    <div class="acts">${tour ? '<button class="btn" data-act="skip">투어 건너뛰기 (해 본 적 있어요)</button>' : ''}<button class="btn pri" data-act="go" data-primary>${tour ? '투어 시작' : '업무 시작'}</button></div>`, { on(a) {
      if (a === 'skip') { S.tourSkip = true; buildTasks(); learn(['flow4', 'vchain', 'org', 'takt', 'andon', 'ftt'], true); renderAll(); }
      closeModal(); SFX.chime(); log(`${S.day}일차 출근`, 'ok'); if (S.tasks.some(t => t.kind === 'tour')) guideTo(0);
    } });
}
function advance(dt) { while (dt > 0 && !UI.modal) { const s = Math.min(dt, 2); step(s); dt -= s; } }
function step(dt) {
  const before = S.min; S.min += dt; simLines(dt);
  S.zoneMin[S.zone] = (S.zoneMin[S.zone] || 0) + dt;
  S.stats.en = clamp(S.stats.en - dt * 0.04, 0, 100);
  if (S.stats.en < 20 && !S.lowWarn) { S.lowWarn = true; toast('컨디션이 바닥입니다. 업무 속도가 느려집니다. 휴게 카페에서 쉬어 가세요.', 'bad'); }
  if (S.work) {
    if (S.work.inc) { S.work.left -= dt; if (S.work.left <= 0) resolveInc(); }
    else { const t = S.tasks[S.work.i]; t.left -= dt * (S.stats.en < 20 ? 0.6 : 1); if (!t.sparked && t.left < t.m * t.sp && t.left > 4) { t.sparked = 1; UI.spark = { i: S.work.i, until: UI.t + 5 }; SFX.spark(); } if (t.left <= 0) finishTask(S.work.i); }
  }
  for (const t of S.tasks) if (t.to && !t.done && !t.miss && S.min > t.to && !(S.work && S.tasks[S.work.i] === t)) { t.miss = true; fxApply({ tr: -1 }); log(`업무 놓침: ${t.t}`, 'bad'); toast(`놓쳤습니다: ${t.t} · 신뢰 −1`, 'bad'); renderTasks(); }
  if (before < 930 && S.min >= 930) toast('15:30 · 일일 업무 보고를 쓸 수 있습니다');
  if (before < 705 && S.min >= 705) lunchInvite();
  if (before < 720 && S.min >= 720) lunchStart();
  if (before < 780 && S.min >= 780) lunchEnd();
  if (S.inc && S.min >= S.inc.until) missInc();
  if (!S.lunch) {
    for (const e of S.sched) if (!e.f && S.min >= e.t) { e.f = true; fireEvent(); break; }
    if (!UI.modal) for (const e of S.chatS) if (!e.f && S.min >= e.t) { e.f = true; postChat(); break; }
    if (!S.inc && !UI.modal) for (const e of S.incS) if (!e.f && S.min >= e.t) { e.f = true; spawnInc(); break; }
  }
  if (S.min >= 1020 && !UI.modal) endDay();
}
function finishTask(i) {
  const t = S.tasks[i]; t.done = true; t.left = 0; S.work = null; S.done++; UI.spark = null;
  const fx = { meet: { tr: 1, pf: 0.5 }, job: { pf: 1, sk: 1 }, team: { pf: 1, tr: 1 }, tour: { sk: 1 }, order: { sk: 1, tr: 1 }, report: { pf: 1 + 0.2 * S.tasks.filter(x => x.done && !x.opt).length } }[t.kind] || { pf: 1 };
  if (t.kind === 'tour' && t.ti === TOUR.length - 1) fx.tr = 2;
  const chips = fxApply(fx); S.stats.en = clamp(S.stats.en - (t.kind === 'tour' ? 0.5 : 2), 0, 100);
  log(`업무 완료: ${t.t}`, 'ok'); SFX.done(); renderTasks(); burst(S.px, S.py, 40, 14, K.accent);
  if (t.kind === 'tour') { const tr = TOUR[t.ti], last = t.ti === TOUR.length - 1; lesson(`채은성 책임 · 공장 투어 ${t.ti + 1}/${TOUR.length}`, tr[2], tr[3], tr[4].concat(t.ti === 4 ? ['agv'] : []), chips, () => { guideTo(last ? null : t.ti + 1); if (last) toast('투어 끝 · 오후에 첫 업무가 내려옵니다. 그동안 사람들을 만나 보세요.'); }); return; }
  if (t.kind === 'order') { const o = ORDER[t.oi]; S.order++; S.orderDone[o[8]] = 1; lesson(`${PNAME[o[1]]} · ${o[4]}`, STMAP[o[2]][o[3]].n + '에서', o[6], o[7], chips); return; }
  S.notes['tk:' + t.t] = S.notes['tk:' + t.t] || { c: SHOPS.includes(t.z) ? 'prod' : 'office', t: t.t, x: t.learn, d: S.day };
  if (t.kind === 'report') learn('report', true); if (t.kind === 'job' && S.job === 'mt') learn('tpm', true); if (t.kind === 'job' && S.job === 'fi') learn('invest', true);
  showCard('업무 완료 · ' + chipText(chips), t.t, t.learn);
}
function takeSpark() {
  const t = S.tasks[UI.spark.i]; UI.spark = null; t.left = Math.max(0.5, t.left - 8); fxApply({ sk: 1 }); S.sparks++; SFX.good();
  toast('눈썰미 · 한 가지를 더 찾아냈다 · 역량 +1 · 작업 8분 단축');
}

/* ---------- 점심 ---------- */
function lunchStart() {
  S.lunch = true; S.ate = false; S.tray = false; S.pspeed = S.speed; S.speed = 1; S.lunches++;
  const all = NP.map((n, i) => i), prs = all.filter(i => NP[i].peer), sv = STMAP.canteen.serve;
  all.filter(i => !NP[i].peer).sort(() => Math.random() - 0.5).concat(prs).forEach((ni, i) => {
    const n = NP[ni], pi = prs.indexOf(ni), ti = pi >= 0 ? 5 : i % 6, si = pi >= 0 ? 4 + pi : Math.floor(i / 6), tb = STMAP.canteen['t' + ti], st = SEATS[si];
    n.table = ti; n.seat = { x: tb.x + st[0], y: tb.y + st[1], d: st[2] }; n.q = { x: sv.x - sv.w / 2 + 24 + (i % 14) * 28, y: sv.y + sv.h / 2 + 20 + Math.floor(i / 14) * 20 };
    n.mode = 'wait'; n.t = S.min + rnd(0, 7); n.leave = 762 + rnd(0, 10); n.path = null; n.trip = null; n.disp = null;
  });
  SFX.lunch(); log('12:00 점심시간. 라인이 멈추고 모두 구내식당으로 간다.', 'ok'); toast('점심시간입니다. 구내식당으로 가서 배식을 받으세요.'); setAmb(); renderHud();
}
function lunchEnd() {
  S.lunch = false; UI.sit = false; S.tray = false; if (S.pspeed) S.speed = S.pspeed;
  { const a = S.tasks.filter(t => t.from === 780); postMsg('n16', PNAME.n16, `오후 업무 두 건 내려보냅니다. ${a.map(t => `「${t.t}」(${ZONES[t.z].full})`).join(', ')}. 일일 보고는 15:30 이후에 써 주세요.`); toast('오후 업무 2건이 내려왔습니다'); }
  if (S.lunchWith === 1) { fxApply({ fr: -2 }); postMsg('peers', PNAME.p2, '오늘 안 왔네? 기다렸는데. 다음엔 꼭 와.'); }
  if (!S.ate) { S.stats.en = clamp(S.stats.en - 6, 0, 100); log('점심을 걸렀다. 오후가 길 것 같다.', 'bad'); }
  log('13:00 오후 작업 시작. 라인 재가동.', 'ok'); SFX.chime(); setAmb();
}
function sitDown(ti) {
  if (!S.lunch) { toast('배식 시간은 12:00부터 13:00까지입니다.'); return; }
  if (S.ate) { toast('오늘 점심은 이미 먹었습니다.'); return; }
  if (!S.tray) { toast('먼저 배식대에서 식판을 받으세요.'); return; }
  UI.sit = true; ME.dir = 'n'; ME.vyaw = null; ME.path = null; ME.trip = null; lunchTalk(ti, 0, []);
}
function lunchTalk(ti, round, used) {
  const mates = NP.filter(n => n.table === ti && n.z === 'canteen' && n.mode === 'eat').sort((a, b) => (b.peer || 0) - (a.peer || 0));
  if (!round && S.lunchWith === 1 && mates.some(n => n.peer)) { S.lunchWith = 2; fxApply({ fr: 2 }); }
  const menu = menuOf();
  const finish = () => { S.ate = true; S.tray = false; S.stats.en = clamp(S.stats.en + 14, 0, 100); S.lowWarn = false; S.tables[ti] = 1; closeModal(); log(`점심 식사: ${menu}`, 'ok'); toast('잘 먹었습니다 · 컨디션 +14'); UI.sit = false; advance(Math.min(10, Math.max(0, 779 - S.min))); renderAll(); };
  if (!mates.length) {
    openModal(`<p class="eyebrow">점심 · ${menu}</p><h2>혼자 먹는 점심</h2><p class="desc">이 식탁에는 아직 아무도 없다. 창밖으로 멈춘 공장이 보인다. 조용히 먹는 밥도 나쁘지 않다.</p><p class="hint">사람이 앉은 식탁을 고르면 다른 부서 이야기를 들을 수 있습니다.</p>
      <div class="acts"><button class="btn pri" data-act="end" data-primary>식사 마치기</button></div>`, { on() { S.stats.en = clamp(S.stats.en + 3, 0, 100); finish(); } });
    return;
  }
  const av = mates.filter(n => !used.includes(n.id)), pool = av.length ? av : mates;
  const a = pool[0], b = pool[1 % pool.length], c = pool[2 % pool.length];
  mates.forEach(n => { noteJob(n.j); if (!S.met[n.id]) { S.met[n.id] = 1; log(`${n.n}(${n.r})와 점심을 같이 먹었다.`); } });
  openModal(`<p class="eyebrow">점심 · ${menu}</p><h2>${round ? '이야기가 이어진다' : '같은 식탁에 앉았다'}</h2>
    <ul class="mates">${mates.map(n => `<li><b>${n.n}</b><span>${n.r}</span></li>`).join('')}</ul>
    <div class="choices">
      <button class="choice" data-act="w" data-key="1"><kbd>1</kbd><span>${a.n}에게 요즘 하는 일을 묻는다</span></button>
      <button class="choice" data-act="p" data-key="2"><kbd>2</kbd><span>${b.n}와 일 말고 다른 얘기를 한다</span></button>
      <button class="choice" data-act="n" data-key="3"><kbd>3</kbd><span>${c.n}에게 요즘 공장 소식을 묻는다</span></button>
      <button class="choice" data-act="end" data-key="4"><kbd>4</kbd><span>조용히 밥을 먹는다</span></button>
    </div>`, { on(act) {
      if (act === 'end') { finish(); return; }
      let who, line, fx, extra = '';
      if (act === 'w') { who = a; line = LUNCH[a.id][0]; fx = { sk: 2, tr: 1 }; learn('kpi', true); if (a.j) noteJob(a.j); }
      else if (act === 'p') { who = b; line = LUNCH[b.id][1]; fx = { tr: 3, en: 3 }; }
      else {
        who = c; fx = { sk: 1, tr: 1 };
        const stopped = LN.find(L => L.stop > 0);
        if (S.queue.length && Math.random() < 0.6) { line = '참, 지난번 그 일 있잖아요. 그냥 넘어가진 않을 것 같던데요. 며칠 안에 다시 얘기가 나올 거예요.'; extra = '<p class="hint">미뤄 둔 선택이 곧 돌아옵니다.</p>'; }
        else if (stopped && Math.random() < 0.5) line = `${ZONES[stopped.k].full}이 오전에 섰다면서요. ${stopped.why} 때문이라던데, 오후에도 한동안 시끄럽겠어요.`;
        else { const nw = NEWS[(S.lunches * 3 + round * 5 + S.day) % NEWS.length]; line = nw[0]; learn('ojt', true); if (nw[1]) { S.insight = Math.min(2, S.insight + 1); extra = '<p class="hint">귀띔을 얻었습니다. 다음 사건에서 무난한 선택지에 표시가 붙습니다.</p>'; } }
      }
      if (who.peer) fx.fr = 3; const chips = fxApply(fx, who.id); SFX.talk(); S.talk[who.id] = (S.talk[who.id] || 0) + 1;
      openModal(`<p class="eyebrow">${who.n} · ${who.r}</p><p class="desc">“${line}”</p><div class="chips">${chips.join('')}</div>${extra}
        <div class="acts">${round < 1 ? '<button class="btn" data-act="more" data-key="1"><kbd>1</kbd> 이야기를 더 한다</button>' : ''}<button class="btn" data-act="cdx">${CODEX[who.j || S.job].n} 도감</button><button class="btn pri" data-act="end" data-primary>식사 마치기</button></div>`,
        { on(a2) { if (a2 === 'more') lunchTalk(ti, round + 1, used.concat(who.id)); else if (a2 === 'cdx') { const back = $('#dlg').innerHTML, opt = UI.modal; openCodex(who.j || S.job, () => openModal(back, opt)); } else finish(); } });
    } });
}

/* ---------- 메신저 ---------- */
const thName = th => th === 'ops' ? '생산 상황실' : th === 'peers' ? '동기방' : th === 'news' ? '사내 뉴스' : th === 'order' ? '주문 추적' : PNAME[th] || th;
function postMsg(th, from, text, o = {}) {
  const m = { th, from, text, t: hhmm(S.min), ...o }; S.msgs.push(m); if (S.msgs.length > 160) S.msgs.splice(0, 30);
  if (!o.me && !o.sys && !(UI.modal && UI.modal.msgr === th)) { S.unread[th] = (S.unread[th] || 0) + 1; if (th !== 'ops') SFX.msg(); }
  if (UI.started) renderMsgs(); return m;
}
function pendingOf(th) {
  for (let i = S.msgs.length - 1; i >= 0; i--) { const m = S.msgs[i]; if (m.th !== th || !m.opts || m.done) continue; if (m.kind === 'inc' && !(S.inc && S.inc.id === m.inc && !S.inc.mode)) { m.done = 1; continue; } return m; }
  return null;
}
const unreadAll = () => Object.keys(S.unread).reduce((a, k) => a + (k === 'ops' ? 0 : S.unread[k] || 0), 0);
function openMessenger(th) {
  if (!S || (UI.modal && !UI.modal.msgr)) return;
  const ths = []; for (let i = S.msgs.length - 1; i >= 0; i--) if (!ths.includes(S.msgs[i].th)) ths.push(S.msgs[i].th);
  if (!th) th = S.inc && !S.inc.mode ? INCX[S.inc.id].from : ths.find(t => t !== 'ops' && (S.unread[t] || pendingOf(t))) || (ths.includes(S.th) ? S.th : ths[0]) || 'peers';
  if (!ths.includes(th)) ths.unshift(th);
  S.th = th; S.unread[th] = 0;
  const list = S.msgs.filter(m => m.th === th).slice(-30), pend = pendingOf(th), lastOf = t => { for (let i = S.msgs.length - 1; i >= 0; i--) if (S.msgs[i].th === t) return S.msgs[i]; };
  const left = pend && pend.kind === 'inc' ? Math.max(0, Math.ceil(S.inc.until - S.min)) : 0;
  openModal(`<p class="eyebrow">사내 메신저 · ${hhmm(S.min)}</p>
    <div class="msgr"><nav class="ths" aria-label="대화방">${ths.map(t => { const l = lastOf(t), p = pendingOf(t); return `<button class="${t === th ? 'on' : ''}${p && p.kind === 'inc' ? ' urgent' : ''}" data-act="th:${t}"><b>${thName(t)}${S.unread[t] ? `<i>${S.unread[t]}</i>` : ''}</b><span>${p ? '답장 필요 · ' : ''}${l ? esc(l.text) : ''}</span></button>`; }).join('')}</nav>
    <section class="conv"><h3>${thName(th)}</h3><div class="bubs" id="bubs">${list.map(m => `<div class="bub${m.me ? ' me' : m.sys ? ' sys' : ''}${m.kind === 'inc' ? ' urgent' : ''}">${m.sys ? '' : `<small>${esc(m.from)} · ${m.t}</small>`}<p>${m.me ? esc(m.text) : m.text}</p></div>`).join('') || '<p class="hint">아직 대화가 없습니다.</p>'}</div>
    ${pend ? `<div class="choices">${left ? `<p class="stopnote">급한 연락 · ${left}분 안에 답해야 합니다</p>` : ''}${pend.opts.map((o, i) => `<button class="choice" data-act="r:${i}" data-key="${i + 1}"${i ? '' : ' data-primary'}><kbd>${i + 1}</kbd><span>${o[0]}${o[3] ? `<em class="cmeta">${o[3]}</em>` : ''}</span></button>`).join('')}</div>` : ''}</section></div>
    <div class="acts"><button class="btn${pend ? '' : ' pri'}" data-act="x"${pend ? '' : ' data-primary'}>닫기</button></div>`,
    { wide: true, esc: true, msgr: th, on(a) { if (a === 'x') { closeModal(); renderAll(); } else if (a.startsWith('th:')) openMessenger(a.slice(3)); else if (a.startsWith('r:') && pend) reply(pend, +a.slice(2)); } });
  const b = $('#bubs'); if (b) b.scrollTop = b.scrollHeight; renderMsgs();
}
function reply(m, i) {
  const o = m.opts[i], th = m.th; if (!o) return; m.done = 1;
  postMsg(th, S.name, o[0], { me: 1 });
  if (m.kind === 'inc') { incReply(m, i); return; }
  if (m.kind === 'chat') { const chips = fxApply(o[1], m.peer); postMsg(th, m.from, o[2]); if (chips.length) postMsg(th, '', chipText(chips), { sys: 1 }); }
  if (m.kind === 'lunch') { if (i === 0) { S.lunchWith = 1; postMsg(th, m.from, '좋아. 오른쪽 아래 식탁이야. 이따 봐!'); } else postMsg(th, m.from, '알겠어. 다음에 같이 먹자.'); }
  openMessenger(th);
}
function postChat() {
  let pool = CHATS.map((c, i) => i).filter(i => !S.chatUsed[i]); if (!pool.length) { S.chatUsed = {}; pool = CHATS.map((c, i) => i); }
  const i = pick(pool), c = CHATS[i]; S.chatUsed[i] = 1;
  postMsg('peers', PNAME[c[0]], c[1], { kind: 'chat', peer: c[0], opts: c[2] }); toast(`동기방 · ${PNAME[c[0]]}: 새 메시지 (Q)`);
}
function lunchInvite() {
  const p = pick(PEERS);
  postMsg('peers', p.n, '곧 점심이다. 오늘 동기끼리 같이 먹을래? 식당 오른쪽 아래 식탁에서 보자.', { kind: 'lunch', peer: p.id, opts: [['좋아, 거기서 봐'], ['오늘은 다른 부서 분들이랑 먹어 볼게']] });
}

/* ---------- 돌발 상황: 급한 연락은 메신저로 온다 ---------- */
const costText = (min, fx) => [min ? `시간 ${min}분` : '', fx && fx.en ? `컨디션 ${fx.en > 0 ? '+' : '−'}${Math.abs(fx.en)}` : ''].filter(Boolean).join(' · ');
function spawnInc() {
  let pool = INCS.filter(d => !S.incUsed[d.id]); if (!pool.length) { S.incUsed = {}; pool = INCS; }
  const d = pick(pool), X = INCX[d.id]; S.incUsed[d.id] = 1; S.inc = { id: d.id, until: Math.min(S.min + d.m, 1015), mode: null };
  if (d.stop) { const L = LN[SHOPS.indexOf(d.stop)]; L.stop = Math.max(L.stop, d.m + 8); L.at = d.s; L.why = d.t; }
  const opts = X.o.map(o => [o[0], o[1], 0, o[1] === 'go' ? `${ZONES[d.z].full}까지 걸어가야 함` : (costText(o[2], o[3]) || '시간 0분')]);
  const fav = S.favorDay !== S.day && Object.keys(S.peers).filter(k => S.peers[k] >= 30).sort((a, b) => S.peers[b] - S.peers[a])[0];
  if (fav) opts.push([`동기 ${PNAME[fav]}에게 대신 가 봐 달라고 부탁한다`, 'fav', fav, '하루 한 번 · 친밀도 −6']);
  postMsg(X.from, PNAME[X.from], X.m, { kind: 'inc', inc: d.id, opts });
  SFX.urgent(); log(`급한 연락: ${PNAME[X.from]} · ${d.t}`, 'bad'); toast(`메신저 · ${PNAME[X.from]}: 급한 연락입니다 (Q)`, 'bad'); renderAlerts(); renderZones();
}
function settleInc(d, th, text, chips, left) {
  if (d.stop) { const L = LN[SHOPS.indexOf(d.stop)]; L.stop = Math.min(L.stop, left == null ? 6 : left); }
  S.inc = null; S.incOk++; S.dInc[0]++; postMsg(th, '', text + (chips.length ? ` (${chipText(chips)})` : ''), { sys: 1 }); log(`급한 연락 처리: ${d.t}`, 'ok'); renderAlerts(); renderZones();
}
function incReply(m, i) {
  const d = INC[m.inc], X = INCX[m.inc], th = m.th, o = m.opts[i];
  if (o[1] === 'fav') { S.favorDay = S.day; const chips = fxApply({ fr: -6, tr: 1 }, o[2]); settleInc(d, th, `${PNAME[o[2]]}이 대신 다녀왔다. “이건 빚이다?” 일은 풀렸고, 다음엔 내가 갚아야 한다.`, chips, 10); SFX.neutral(); openMessenger(th); return; }
  const x = X.o[i];
  if (x[1] === 'go') { S.inc.mode = 'go'; S.inc.opt = i; postMsg(th, m.from, '네, 기다리고 있겠습니다.'); S.unread[th] = 0; closeModal(); renderAll(); goStation(d.z, d.s); return; }
  const chips = fxApply(x[3]); settleInc(d, th, x[4], chips, x[5]); UI.after = x[2]; SFX.neutral(); openMessenger(th);
}
function resolveInc() {
  const d = INC[S.inc.id], X = INCX[d.id], x = X.o[S.inc.opt || 0]; S.work = null;
  const chips = fxApply(x[3]); settleInc(d, X.from, x[4], chips, 0.5); S.unread[X.from] = 0; SFX.good();
  showCard('급한 연락 처리 완료' + (chips.length ? ' · ' + chipText(chips) : ''), d.t, x[4]);
}
function missInc() {
  const d = INC[S.inc.id], X = INCX[d.id], unread = !S.inc.mode; if (S.work && S.work.inc) S.work = null; S.inc = null; S.incMiss++; S.dInc[1]++;
  if (d.stop) { const L = LN[SHOPS.indexOf(d.stop)]; L.stop = Math.min(L.stop, 8); }
  const fx = { ...d.miss[1] }; if (unread) fx.tr = (fx.tr || 0) - 2;
  const chips = fxApply(fx); S.msgs.forEach(m => { if (m.kind === 'inc' && m.inc === d.id) m.done = 1; });
  postMsg(X.from, '', (unread ? '답장하지 못했다. ' : '제때 도착하지 못했다. ') + d.miss[0] + (chips.length ? ` (${chipText(chips)})` : ''), { sys: 1 });
  log(`급한 연락 놓침: ${d.t}`, 'bad'); toast(`놓쳤습니다: ${d.t}${chips.length ? ' · ' + chipText(chips) : ''}`, 'bad'); SFX.bad(); renderAlerts(); renderZones();
}

/* ---------- 선택 이벤트 ---------- */
function pickEvent() {
  const qi = S.queue.findIndex(q => q.day <= S.day);
  if (qi >= 0) return EV[S.queue.splice(qi, 1)[0].id];
  const jp = EVENTS.filter(e => e.job === S.job && !e.fu && !S.used[e.id]);
  const cp = EVENTS.filter(e => !e.job && !e.fu && !S.used[e.id]);
  if (jp.length && !S.jobEv && S.day % 2 === 0) { S.jobEv = true; return pick(jp); }
  if (S.day === 1) { const easy = cp.filter(e => ['c1', 'c2', 'c4', 'c16'].includes(e.id)); if (easy.length) return pick(easy); }
  return cp.length ? pick(cp) : (jp.length ? pick(jp) : null);
}
const scoreOf = c => { const fx = c[2] || {}, ex = c[3] || {}; return (fx.sk || 0) + (fx.tr || 0) + (fx.pf || 0) + (fx.q || 0) * 2 + (fx.sf || 0) + (fx.up || 0) + (fx.fr || 0) / 2 - (ex.stop ? ex.stop[1] / 10 : 0) - (ex.next ? 5 : 0); };
function fireEvent() {
  const ev = pickEvent(); if (!ev) return; S.used[ev.id] = 1;
  if (S.work && !S.work.inc) S.work = null;
  if (ev.pre) stopLine(ev.pre[0], ev.pre[1], ev.s, ev.t, true);
  UI.flash = { z: ev.z, s: ev.s, until: S.min + 25 };
  ev.pre ? SFX.alarm() : SFX.event();
  let tip = -1; if (S.insight > 0) { S.insight--; tip = ev.c.map(scoreOf).reduce((b, v, i, a) => v > a[b] ? i : b, 0); }
  const st = STMAP[ev.z][ev.s];
  openModal(`<p class="eyebrow">${ev.fu ? '<span class="tag fu">지난 선택의 결과</span>' : ev.job ? '<span class="tag job">직무 이벤트</span>' : ev.bal ? '<span class="tag ok">동기</span>' : '<span class="tag">이벤트</span>'} ${hhmm(S.min)} · ${ZONES[ev.z].full} · ${st.n}</p>
    <h2>${ev.t}</h2><p class="desc">${ev.d}</p>${ev.pre ? `<p class="stopnote">${ZONES[ev.pre[0]].full} 라인이 멈췄습니다.</p>` : ''}
    <div class="choices">${ev.c.map((c, i) => `<button class="choice" data-act="c${i}" data-key="${i + 1}"><kbd>${i + 1}</kbd><span>${c[0]}<em class="cmeta">${costText(c[4], c[2]) || '시간 0분'}</em>${i === tip ? '<em class="tip">점심 때 들은 얘기가 떠오른다</em>' : ''}</span></button>`).join('')}</div>
    <p class="hint">드는 시간과 컨디션만 미리 보입니다. 결과는 골라 봐야 압니다.</p>`,
    { on(a) { choose(ev, +a.slice(1)); } });
  renderZones();
}
function choose(ev, i) {
  const c = ev.c[i], fx = c[2] || {}, ex = c[3] || {};
  const chips = fxApply(fx, ev.peer); { const nt = learn(ev.note || EVNOTE[ev.id] || [], true); for (const g of nt) chips.push(`<span class="chip up">노트 · ${g}</span>`); }
  if (c[4]) chips.push(`<span class="chip">시간 ${c[4]}분</span>`);
  if (ex.stop) { stopLine(ex.stop[0], ex.stop[1], ev.s, ev.t, true); chips.push(`<span class="chip dn">${ZONES[ex.stop[0]].full} 정지 +${ex.stop[1]}분</span>`); }
  if (ex.next && Math.random() < 0.65) S.queue.push({ id: ex.next[0], day: S.day + ex.next[1] });   // 미뤄 둔 일이 늘 돌아오는 것은 아니다
  const score = scoreOf(c) + (ex.next ? 5 : 0);
  score > 3 ? SFX.good() : score < 0 ? SFX.bad() : SFX.neutral();
  S.today.push({ t: ev.t, c: c[0] }); S.hist.push({ d: S.day, t: ev.t, c: c[0], r: c[1], fu: !!ev.fu });
  log(`${ev.t}: ${c[0]}`, score > 3 ? 'ok' : score < 0 ? 'bad' : '');
  openModal(`<p class="eyebrow">${ev.t}</p><p class="picked">${c[0]}</p><p class="desc">${c[1]}</p>
    <div class="chips">${chips.join('') || '<span class="chip">변화 없음</span>'}</div>
    <div class="acts"><button class="btn pri" data-act="go" data-primary>계속</button></div>`, { on() { UI.after = c[4] || 0; closeModal(); renderAll(); } });
}
function endDay() {
  S.work = null; ME.trip = null; ME.path = null; UI.spark = null; SFX.bell();
  if (S.inc) missInc();
  const must = S.tasks.filter(t => !t.opt), NTd = must.length, undone = must.filter(t => !t.done).length, done = NTd - undone, hit = S.prod.today >= S.target;
  const sc = done / NTd * 72 + S.dInc[0] * 8 - S.dInc[1] * 8 + (S.ate ? 6 : 0) + (hit ? 4 : 0), g = sc >= 84 ? 'S' : sc >= 64 ? 'A' : sc >= 44 ? 'B' : 'C';
  S.grades.push(g); if (!undone) S.perfect = 1;
  const d = k => { const v = Math.round(S.stats[k] - S.dayStart[k]); return `<span class="chip ${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">${STAT[k]} ${v >= 0 ? '+' : '−'}${Math.abs(v)}</span>`; };
  const ot = must.find(t => !t.done && !t.miss);
  openModal(`<p class="eyebrow">${S.day}일차 ${WD[(S.day - 1) % 5]}요일 · 17:00 퇴근 시간</p>
    <div class="grade sm"><span class="g">${g}</span><div><h2>오늘의 결산</h2><p>채은성 책임: ${GCOM[g]}</p></div></div>
    <div class="tiles"><div><b>${done}/${NTd}</b><span>내 업무</span></div><div><b>${S.dInc[0]}<small> / ${S.dInc[0] + S.dInc[1]}</small></b><span>급한 연락 처리</span></div><div><b>${S.prod.today}</b><span>생산 / 목표 ${S.target}대</span></div><div><b>${Math.round(uptime())}%</b><span>가동률</span></div></div>
    <div class="chips">${['sk', 'tr', 'en', 'pf'].map(d).join('')}</div>
    ${S.today.length ? `<ul class="recap">${S.today.map(e => `<li><b>${e.t}</b><span>${e.c}</span></li>`).join('')}</ul>` : ''}
    <p class="hint">${hit ? '공장이 오늘 목표를 채웠습니다.' : '오늘은 공장이 목표를 채우지 못했습니다.'}${undone ? ` 끝내지 못한 업무가 ${undone}건 있습니다.` : ' 오늘 업무를 모두 끝냈습니다.'}</p>
    <div class="acts">${ot ? '<button class="btn" data-act="ot" data-key="1"><kbd>1</kbd> 잔업으로 한 건 마무리 (컨디션 −12)</button>' : ''}<button class="btn pri" data-act="home" data-primary>${ot ? '정시 퇴근' : '퇴근'}</button></div>`,
    { on(a) {
      if (a === 'ot' && ot) { ot.done = true; S.done++; fxApply({ pf: 1.2 }); S.stats.en = clamp(S.stats.en - 12, 0, 100); }
      const left = must.filter(t => !t.done).length; S.stats.pf = clamp(S.stats.pf - left, 0, 100);
      if (hit) S.stats.pf = clamp(S.stats.pf + 1, 0, 100);
      S.stats.en = clamp(S.stats.en + 18, 0, 100); for (const k in S.pscore) S.pscore[k] += rnd(3.6, 5.8); S.day++; closeModal();
      quiz(() => { if (S.day > DAYS) ending(); else evening(); });
    } });
}
const EVE = [['집에서 푹 쉰다', '아무것도 하지 않는 저녁. 내일을 위한 투자다.', { en: 12 }], ['사내 온라인 강의를 듣는다', '품질 관리 기초 2강. 졸음과 싸우며 끝까지 들었다.', { sk: 2, en: 2 }], ['동기들과 저녁을 먹는다', '국밥집에서 각자 하루를 털어놓았다. 다들 비슷하게 헤매고 있다.', { fr: 3, en: 5 }], ['운동한다', '회사 체육관에서 40분. 내일은 발걸음이 가볍다. (다음 날 걷는 속도 +20%)', { en: 6 }]];
function evening() {
  openModal(`<p class="eyebrow">퇴근 후</p><h2>오늘 저녁은 어떻게 보낼까</h2>
    <div class="choices">${EVE.map((e, i) => `<button class="choice" data-act="e${i}" data-key="${i + 1}"><kbd>${i + 1}</kbd><span>${e[0]}<em class="cmeta">${i === 3 ? '컨디션 +6 · 내일 걷는 속도 +20%' : chipText(Object.keys(e[2]).map(k => `<i>${STAT[k]} +${e[2][k]}</i>`))}</em></span></button>`).join('')}</div>`,
    { on(a) { const i = +a.slice(1), e = EVE[i]; fxApply(e[2]); S.eve[i]++; if (i === 3) S.fit = S.day; log(`어제 저녁: ${e[0]}`); SFX.neutral(); closeModal(); startDay(); } });
}
/* ---------- 업적 ---------- */
const ACH = [
  ['첫 퇴근', '첫날을 무사히 마쳤다', () => S.day >= 2], ['공장 한 바퀴', '네 공장을 모두 걸어서 다녀왔다', () => SHOPS.every(z => S.zoneMin[z] > 1)],
  ['마당발', '20명과 인사했다', () => Object.keys(S.met).length >= 20], ['모두의 이름', '공장의 모든 사람과 인사했다', () => Object.keys(S.met).length >= NPCS.length],
  ['공정 박사', '설비 20곳을 살펴봤다', () => Object.keys(S.seen).length >= 20], ['직무 수집가', '15개 직무의 현직자를 만났다', () => new Set(NPCS.filter(n => S.met[n.id] && n.j).map(n => n.j)).size >= 15],
  ['칼답', '급한 연락 5건을 처리했다', () => S.incOk >= 5], ['해결사', '급한 연락 12건을 처리했다', () => S.incOk >= 12],
  ['완벽한 하루', '하루 업무를 모두 끝냈다', () => S.perfect], ['공부벌레', '노트 40개를 모았다', () => Object.keys(S.notes).length >= 40], ['한 대의 여정', '주문 한 대를 끝까지 따라갔다', () => S.order >= ORDER.length], ['퀴즈왕', '퀴즈 15문제를 맞혔다', () => S.qstat[0] >= 15], ['눈썰미', '업무 중 이상한 점을 8번 찾아냈다', () => S.sparks >= 8],
  ['식탁 순례', '점심을 다섯 군데 식탁에서 먹었다', () => Object.keys(S.tables).length >= 5], ['절친', '동기 한 명과 친밀도 50을 넘겼다', () => Object.values(S.peers).some(v => v >= 50)],
  ['걷기왕', '구내 도로에서 200분을 보냈다', () => (S.zoneMin.yard || 0) >= 200], ['500대', '입사 후 완성차 500대가 출고됐다', () => S.prod.total >= 500]
];
function checkAch() { ACH.forEach((a, i) => { if (!S.ach[i] && a[2]()) { S.ach[i] = S.day; toast(`업적 달성 · ${a[0]}`); SFX.good(); for (const c of [K.accent, K.ok, K.pri]) burst(S.px, S.py, 44, 10, c, 1.3); log(`업적 달성: ${a[0]} (${a[1]})`, 'ok'); } }); }
function openAch() {
  if (UI.modal) return; const n = Object.keys(S.ach).length;
  openModal(`<p class="eyebrow">업적 · ${n} / ${ACH.length}</p><h2>지금까지 해낸 것</h2>
    <div class="cdx">${ACH.map((a, i) => `<article class="${S.ach[i] ? 'focus' : 'dim'}"><header><b>${a[0]}</b>${S.ach[i] ? `<span class="tag ok">${S.ach[i]}일차</span>` : ''}</header><p>${a[1]}</p></article>`).join('')}</div>
    <div class="acts"><button class="btn pri" data-act="x" data-primary>닫기</button></div>`, { wide: true, esc: true, on() { closeModal(); } });
}
/* ---------- 지식 노트, 퀴즈, 회사 지도 ---------- */
const EVNOTE = { mt1: 'tpm', mt2: 'tpm', me3: 'invest', fi2: 'invest', c13: 'bcp', c1: 'report', c17: 'report', pu3: 'tier', pc1: 'jit', qc1: 'ftt', c15: 'fair', pu1: 'fair', sf1: 'stopw', c8: 'launch', hr1: 'union', c2: 'ojt', pe1: 'takt', pc2: 'deliver', c5: 'lot', c20: 'color' };
const NPCNOTE = { n15: 'ojt', n23: 'sdv', n22: 'evshift', n19: 'cost', n17: 'cost', n3: 'tpm', n10: 'tpm', n21: 'launch', n24: 'color', n12: 'plan', n18: 'union', n27: 'order', n28: 'vchain' };
function noteInfo(id) {
  if (KB[id]) return { c: KB[id][0], t: KB[id][1], x: KB[id][2] };
  if (id.startsWith('st:')) { const [, z, k] = id.split(':'), st = STMAP[z] && STMAP[z][k]; return st ? { c: SHOPS.includes(z) || z === 'yard' || z === 'canteen' ? 'prod' : 'office', t: st.n, x: st.d } : null; }
  if (id.startsWith('job:')) { const c = CODEX[id.slice(4)]; return c ? { c: 'job', t: c.n, x: `${c.d} 하루: ${c.day}` } : null; }
  const n = S.notes[id]; return n && n.t ? n : null;
}
function learn(ids, quiet) { const got = []; for (const id of [].concat(ids)) if (KB[id] && !S.notes[id]) { S.notes[id] = S.day; S.newNotes = (S.newNotes || 0) + 1; got.push(KB[id][1]); } if (got.length && !quiet) { toast(`노트에 추가 · ${got.join(', ')}`); SFX.spark(); } return got; }
function noteJob(j) { if (j && CODEX[j] && !S.notes['job:' + j]) { S.notes['job:' + j] = S.day; S.newNotes = (S.newNotes || 0) + 1; } }
function understanding() { const o = {}; for (const c in NCAT) o[c] = 0; for (const id in S.notes) { const n = noteInfo(id); if (n && o[n.c] != null) o[n.c]++; } for (const id in S.qz) if (KB[id]) o[KB[id][0]]++; for (const c in NCAT) o[c] = Math.min(100, Math.round(100 * o[c] / NCAT[c][1])); return o; }
const undBars = un => `<div class="und">${Object.keys(NCAT).map(c => `<div><span>${NCAT[c][0]}</span><i><b style="width:${un[c]}%"></b></i><em>${un[c]}%</em></div>`).join('')}</div>`;
function lesson(eye, title, text, cards, chips, then) {
  const got = learn(cards, true);
  openModal(`<p class="eyebrow">${eye}</p><h2>${title}</h2><p class="desc">${text}</p>${got.length ? `<div class="chips">${got.map(g => `<span class="chip up">노트 · ${g}</span>`).join('')}</div>` : ''}${chips && chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
    <div class="acts"><button class="btn" data-act="notes">노트 보기</button><button class="btn pri" data-act="go" data-primary>계속</button></div>`, { on(a) { closeModal(); if (then) then(); if (a === 'notes') openNotes(cards[0] && KB[cards[0]] ? KB[cards[0]][0] : 'sum'); else renderAll(); } });
}
function openNotes(tab, node) {
  if (!S || (UI.modal && !UI.modal.notes)) return; tab = tab || 'sum'; S.newNotes = 0;
  const un = understanding(), tabs = [['sum', '이해도']].concat(Object.keys(NCAT).map(c => [c, NCAT[c][0]]), [['map', '회사 지도']]);
  let body;
  if (tab === 'sum') {
    const need = Object.keys(NCAT).sort((a, b) => un[a] - un[b])[0], tips = { prod: '공장 설비 앞에서 E로 살펴보고, 현장 업무를 하면 쌓입니다.', office: '사무동의 방을 살펴보고, 사무 업무와 회사 생활 사건을 겪으면 쌓입니다.', job: '여러 부서 사람에게 말을 걸거나 점심을 같이 먹으면 쌓입니다.', ind: '매일 아침 사내 뉴스를 읽고, 연구소 사람들과 이야기하면 쌓입니다.', corp: '선택 업무인 주문 추적을 따라가고, 회사 생활 사건을 겪으면 쌓입니다.' };
    body = `${undBars(un)}<div class="tiles"><div><b>${Object.keys(S.notes).length}</b><span>모은 노트</span></div><div><b>${S.qstat[0]}<small> / ${S.qstat[1]}</small></b><span>퀴즈 정답</span></div><div><b>${S.order}<small> / ${ORDER.length}</small></b><span>주문 추적</span></div><div><b>${Object.keys(S.met).length}<small> / ${NPCS.length}</small></b><span>만난 사람</span></div></div>
      <p class="hint"><b>${NCAT[need][0]}</b> 이해도가 가장 낮습니다. ${tips[need]}</p>`;
  } else if (tab === 'map') {
    const lit = k => S.orderDone[k] || NPCS.some(n => S.met[n.id] && VNODE[k][2].includes(n.j)), nb = k => `<button class="vn${lit(k) ? ' lit' : ''}${node === k ? ' on' : ''}" data-act="node:${k}">${VNODE[k][0]}${S.orderDone[k] ? '<i>✓</i>' : ''}</button>`;
    const d = node && VNODE[node];
    body = `<p class="hint">주문이 들어와 차가 고객에게 가기까지, 일이 넘어가는 순서입니다. 칸을 누르면 하는 일이 나옵니다. 색이 칠해진 칸은 그 부서 사람을 만났거나 주문 추적으로 들른 곳입니다.</p>
      <div class="vflow">${VFLOW.map(nb).join('<span>→</span>')}<span>→</span><em>고객</em></div><div class="vsup"><small>전 과정을 받치는 부서</small>${VSUP.map(nb).join('')}</div>
      ${d ? `<div class="vdet"><b>${d[0]}</b><p>${d[1]}</p><p class="hint">관련 직무: ${d[2].map(j => CODEX[j].n).join(', ')}</p><p class="hint">만난 사람: ${NPCS.filter(n => S.met[n.id] && d[2].includes(n.j)).map(n => `${n.n}(${n.r})`).join(', ') || '아직 없음'}</p></div>` : ''}`;
  } else {
    const mine = Object.keys(S.notes).map(id => [id, noteInfo(id)]).filter(x => x[1] && x[1].c === tab), locked = Object.keys(KB).filter(id => KB[id][0] === tab && !S.notes[id]);
    body = `<div class="cdx">${mine.map(([id, n]) => `<article class="${S.qz[id] ? 'focus' : ''}"><header><b>${n.t}</b>${S.qz[id] ? '<span class="tag ok">퀴즈 통과</span>' : ''}</header><p>${n.x}</p></article>`).join('')}${locked.map(id => `<article class="dim"><header><b>???</b></header><p>배우는 곳: ${KB[id][3]}</p></article>`).join('')}</div>${!mine.length && !locked.length ? '<p class="hint">아직 노트가 없습니다.</p>' : ''}`;
  }
  openModal(`<p class="eyebrow">지식 노트 · ${Object.keys(S.notes).length}개</p><h2>${tab === 'sum' ? '지금까지 알게 된 것' : tab === 'map' ? '회사는 이렇게 돌아간다' : NCAT[tab][0]}</h2>
    <nav class="tabs">${tabs.map(t => `<button class="${t[0] === tab ? 'on' : ''}" data-act="tab:${t[0]}">${t[1]}${un[t[0]] != null ? ` <small>${un[t[0]]}%</small>` : ''}</button>`).join('')}</nav>${body}
    <div class="acts"><button class="btn pri" data-act="x" data-primary>닫기</button></div>`, { wide: true, esc: true, notes: 1, on(a) { if (a === 'x') { const b = UI.nb; UI.nb = null; if (b) b(); else { closeModal(); renderAll(); } } else if (a.startsWith('tab:')) openNotes(a.slice(4)); else if (a.startsWith('node:')) openNotes('map', a.slice(5)); } });
}
function quiz(then) {
  const pool = QUIZ.filter(q => S.notes[q[0]] && !S.qz[q[0]]).sort(() => Math.random() - 0.5).slice(0, 3); let i = 0, right = 0;
  if (!pool.length) { then(); return; }
  const ask = () => {
    if (i >= pool.length) { then(); return; }
    const q = pool[i];
    openModal(`<p class="eyebrow">퇴근길 퀴즈 ${i + 1}/${pool.length} · ${NCAT[KB[q[0]][0]][0]}</p><h2>${q[1]}</h2>
      <div class="choices">${q[2].map((o, k) => `<button class="choice" data-act="q${k}" data-key="${k + 1}"><kbd>${k + 1}</kbd><span>${o}</span></button>`).join('')}</div><p class="hint">오늘까지 노트에 쌓인 내용에서 나옵니다. 맞히면 역량이 오르고 그 주제의 이해도가 올라갑니다.</p>`, { on(a) {
        const k = +a.slice(1), ok = k === q[3]; S.qstat[1]++; let chips = [];
        if (ok) { S.qstat[0]++; right++; S.qz[q[0]] = 1; chips = fxApply({ sk: 1 }); SFX.good(); } else SFX.bad();
        i++;
        openModal(`<p class="eyebrow">${ok ? '정답' : '오답'}</p><h2>${ok ? '맞았습니다' : `정답은 “${q[2][q[3]]}”`}</h2><p class="desc">${q[4]}</p>${chips.length ? `<div class="chips">${chips.join('')}</div>` : '<p class="hint">틀린 문제는 다음에 다시 나옵니다.</p>'}
          <div class="acts"><button class="btn pri" data-act="go" data-primary>${i < pool.length ? '다음 문제' : '퇴근'}</button></div>`, { on() { closeModal(); ask(); } });
      } });
  };
  ask();
}
function ending() {
  try { localStorage.removeItem(SAVE); } catch (e) {}
  const s = S.stats, total = s.sk * 0.3 + s.tr * 0.3 + s.pf * 0.4;
  const g = total >= 68 ? ['S', '팀이 먼저 찾는 신입', '수습 평가 최상위. 팀장님이 다음 신차 프로젝트에 이름을 올렸습니다.'] : total >= 54 ? ['A', '믿고 맡기는 신입', '수습을 무난히 통과했습니다. 맡은 일은 끝까지 한다는 평을 얻었습니다.'] : total >= 40 ? ['B', '자리를 잡아 가는 신입', '수습은 통과했습니다. 아직 배울 것이 많다는 것도 알게 됐습니다.'] : ['C', '쉽지 않았던 첫 2주', '수습 기간이 연장됐습니다. 어디서 꼬였는지는 아래 기록에 남아 있습니다.'];
  const zm = S.zoneMin, fm = SHOPS.reduce((a, z) => a + (zm[z] || 0), 0), om = zm.office || 0, field = Math.round(100 * fm / Math.max(1, fm + om));
  const top = Object.entries(S.gain).sort((a, b) => b[1] - a[1])[0][0];
  const style = { sk: '배우는 데 시간을 쓴 사람', tr: '사람을 먼저 얻은 사람', pf: '결과로 말한 사람' }[top];
  const fus = S.hist.filter(h => h.fu), C = CODEX[S.job], rank = 1 + Object.values(S.pscore).filter(v => v > total).length, best = Object.keys(S.peers).sort((a, b) => S.peers[b] - S.peers[a])[0];
  openModal(`<p class="eyebrow">${DAYS}일차 종료 · 수습 평가</p>
    <div class="grade"><span class="g">${g[0]}</span><div><h2>${g[1]}</h2><p>${g[2]}</p></div></div>
    <div class="tiles"><div><b>${Math.round(s.sk)}</b><span>역량</span></div><div><b>${Math.round(s.tr)}</b><span>신뢰</span></div><div><b>${Math.round(s.pf)}</b><span>성과</span></div><div><b>${S.prod.total}</b><span>함께 만든 차</span></div></div>
    <h3>${esc(S.name)} 님이 겪어 본 ${C.n}</h3>
    <ul class="recap plain"><li><b>근무 장소</b><span>현장 ${field}% · 사무실 ${100 - field}% (이 직무의 일반적인 비중: ${JOBS[S.job].where})</span></li>
    <li><b>걸어 다닌 시간</b><span>구내 도로에서 ${Math.round(zm.yard || 0)}분</span></li>
    <li><b>끝낸 업무</b><span>${S.done}건</span></li><li><b>하루 평가</b><span>${S.grades.join(' ')}</span></li><li><b>업적</b><span>${Object.keys(S.ach).length} / ${ACH.length}</span></li><li><b>급한 연락</b><span>처리 ${S.incOk}건 · 놓침 ${S.incMiss}건</span></li><li><b>동기 넷 중</b><span>수습 점수 ${rank}등 · 가장 가까워진 동기는 ${PNAME[best]} (친밀도 ${Math.round(S.peers[best])})</span></li><li><b>만난 현직자</b><span>${Object.keys(S.met).length}명 / ${NPCS.length}명</span></li>
    <li><b>일하는 방식</b><span>${style}</span></li><li><b>이런 사람에게 맞는 일</b><span>${C.fit}</span></li></ul>
    <h3>열흘 동안 쌓인 이해도</h3>${undBars(understanding())}<ul class="recap plain"><li><b>지식 노트</b><span>${Object.keys(S.notes).length}개 · 퀴즈 ${S.qstat[0]} / ${S.qstat[1]} 정답</span></li><li><b>주문 추적</b><span>${S.order} / ${ORDER.length}단계${S.order >= ORDER.length ? ' · 주문에서 선적까지 한 대를 끝까지 따라갔습니다' : ''}</span></li></ul>
    ${fus.length ? `<h3>선택이 되돌아온 순간</h3><ul class="recap">${fus.map(h => `<li><b>${h.d}일차 · ${h.t}</b><span>${h.r}</span></li>`).join('')}</ul>` : '<p class="hint">미뤄 둔 문제가 없어 되돌아온 사건도 없었습니다.</p>'}
    <div class="acts"><button class="btn" data-act="notes">노트 다시 보기</button><button class="btn" data-act="codex">직무 도감 보기</button><button class="btn pri" data-act="again" data-primary>다른 직무로 다시 입사</button></div>`,
    { wide: true, on(a) { if (a === 'notes') { const back = $('#dlg').innerHTML, opt = UI.modal; UI.nb = () => openModal(back, opt); UI.modal = null; openNotes('sum'); } else if (a === 'codex') { const back = $('#dlg').innerHTML, opt = UI.modal; openCodex(S.job, () => { openModal(back, opt); }); } else { closeModal(); showTitle(); } } });
  SFX.good();
}

/* ---------- 이동·상호작용 ---------- */
function onZone() { CAM.snap = true; CAM.intro = 1; CAM.talk = null; FXP.length = 0; if (CAM.tdist < 860 && S.zone !== 'yard') CAM.yaw = DOOR[S.zone].in[1] > 100 ? Math.PI / 2 : -Math.PI / 2; UI.near = null; UI.doorLock = true; UI.fade = 0.7; UI.sit = false; hideCard(); S.work = null; SFX.door(); renderZones(); renderTasks(); setAmb(); }
function startTrip(z, x, y, auto) {
  if (!S || UI.modal) return; if (x == null) { if (z === S.zone) return; [x, y] = INSIDE[z]; }
  const p = snap(z, x, y); ME.trip = { z, x: p.x, y: p.y }; ME.path = null; UI.auto = auto || null; UI.sit = false; S.paused = false;
  if (S.work) { S.work = null; renderTasks(); }
}
function goStation(z, id) { const p = ipOf(STMAP[z][id]); startTrip(z, p.x, p.y, { k: 'st', id, z }); }
const avail = t => !t.done && !t.miss && (!t.from || S.min >= t.from) && (!t.seq || S.tasks[S.tasks.indexOf(t) - 1].done);
function goTask(i) { const t = S.tasks[i]; if (!t || UI.modal) return; if (!avail(t)) { if (!t.done && !t.miss) toast(t.seq && !(t.from > S.min) ? '투어는 순서대로 돕니다.' : `${hhmm(t.from)}부터 할 수 있는 업무입니다.`); return; } goStation(t.z, t.s); }
function nextTask(quiet) {
  const av = S.tasks.map((t, i) => i).filter(i => avail(S.tasks[i]));
  if (!av.length) { const lk = S.tasks.find(t => !t.done && !t.miss && t.from > S.min); if (!quiet) toast(lk ? `다음 업무는 ${hhmm(lk.from)}에 열립니다. 그동안 공장을 둘러보거나 사람들을 만나 보세요.` : '오늘 업무는 모두 끝냈습니다.'); return false; }
  goTask(av.find(i => S.tasks[i].to) ?? av.find(i => S.tasks[i].z === S.zone) ?? av[0]); return true;   // 마감 있는 일, 같은 건물 일을 먼저
}
function autoStep() { if (S.lunch && !S.ate) goLunch(); else if (S.inc && S.inc.mode === 'go') goInc(); else nextTask(true); }
function taskAt(z, s) { return S.tasks.findIndex(t => avail(t) && t.z === z && t.s === s); }
const incAt = (z, s) => !!S.inc && S.inc.mode === 'go' && INC[S.inc.id].z === z && INC[S.inc.id].s === s;
function goInc() { if (!S.inc) { toast('지금은 급한 연락이 없습니다.'); return; } if (!S.inc.mode) { openMessenger(INCX[S.inc.id].from); return; } const d = INC[S.inc.id]; goStation(d.z, d.s); }
function goLunch() {
  if (S.tray && S.lunchWith) goStation('canteen', 't5');
  else if (S.tray) { const cnt = s => NP.filter(n => n.table === +s.id.slice(1) && n.z === 'canteen' && n.mode === 'eat').length; const tb = ST.canteen.filter(s => s.k === 'table').sort((a, b) => cnt(b) - cnt(a))[0]; goStation('canteen', tb.id); }
  else goStation('canteen', 'serve');
}
function interact(o) {
  if (!o) return;
  if (o.k === 'st') {
    const st = STMAP[S.zone][o.id]; if (!st) return; const ti = taskAt(S.zone, o.id);
    if (st.k === 'bldg') { startTrip(st.id); return; }
    if (incAt(S.zone, o.id)) { S.work = { inc: 1, left: 4 }; hideCard(); SFX.open(); return; }
    if (ti >= 0) { S.work = { i: ti }; hideCard(); SFX.open(); return; }
    if (st.id === 'cafe') { advance(15); S.stats.en = clamp(S.stats.en + 10, 0, 100); S.lowWarn = false; toast('15분 쉬었습니다 · 컨디션 +10'); SFX.neutral(); return; }
    if (st.k === 'serve') {
      if (S.lunch && !S.ate && !S.tray) { S.tray = true; SFX.tray(); toast(`식판을 받았습니다 · ${menuOf()} · 식탁에 앉으세요`); return; }
      showCard('구내식당' + (S.lunch ? '' : ' · 지금은 배식 시간이 아닙니다'), st.n, st.d + ' 오늘 메뉴는 ' + menuOf() + '.'); return;
    }
    if (st.k === 'table') { sitDown(+st.id.slice(1)); return; }
    const key = S.zone + st.id, first = !S.seen[key];
    if (first) { S.seen[key] = 1; S.stats.sk = clamp(S.stats.sk + 1, 0, 100); S.gain.sk += 1; if (st.d) { S.notes[`st:${S.zone}:${st.id}`] = S.day; S.newNotes++; } }
    showCard(ZONES[S.zone].full + (first ? ' · 공정 이해 +1 · 노트에 기록' : ''), st.n, st.d); SFX.open();
  } else {
    const n = NP.find(n => n.id === o.id); if (!n || n.z !== S.zone) return; const first = !S.met[n.id];
    if (first) { S.met[n.id] = 1; S.stats.tr = clamp(S.stats.tr + 1, 0, 100); S.gain.tr += 1; log(`${n.n}(${n.r})와 인사했다.`); noteJob(n.j); if (NPCNOTE[n.id]) learn(NPCNOTE[n.id], true); }
    CAM.talk = n;
    if (n.peer && S.peerTalk[n.id] !== S.day) { S.peerTalk[n.id] = S.day; S.peers[n.id] = clamp(S.peers[n.id] + 2, 0, 100); }
    const k = S.talk[n.id] || 0; let line;
    if (n.mode === 'eat') line = LUNCH[n.id][k % 2];
    else if (n.mode !== 'idle') line = S.lunch && n.then !== 'idle' ? '밥 먹으러 가는 길이에요. 식당에서 같이 얘기해요.' : '이제 자리로 돌아가는 길이에요. 오후도 힘냅시다.';
    else if (n.id === 'n15') { const u = S.tasks.filter(avail); line = u.length && !first ? `오늘 남은 일은 ${u.map(t => '“' + t.t + '”').join(', ')}예요. T 키를 누르면 그 자리까지 걸어가요.` : n.l[k % n.l.length]; }
    else line = n.l[k % n.l.length];
    S.talk[n.id] = k + 1;
    const j = n.j || S.job;
    showCard(n.r + (first ? ' · 신뢰 +1' + (n.j ? ' · 직무 노트 기록' : '') : ''), n.n, '“' + line + '”', `<button class="btn sm" data-codex="${j}">${CODEX[j].n} 도감 보기</button>`); SFX.talk();
  }
}
function showCard(eye, title, text, extra = '') {
  $('#card').innerHTML = `<button class="x" aria-label="닫기" data-close>닫기</button><p class="eyebrow">${eye}</p><h3>${title}</h3><p>${text}</p>${extra}`;
  $('#card').hidden = false; UI.cardAt = { x: S.px, y: S.py };
}
function hideCard() { $('#card').hidden = true; UI.cardAt = null; CAM.talk = null; }

/* ---------- 모달 ---------- */
function openModal(html, opt = {}) { $('#dlg').innerHTML = html; $('#dlg').className = 'dlg' + (opt.wide ? ' wide' : ''); $('#modal').hidden = false; UI.modal = opt; UI.keys = {}; const f = $('#dlg [data-primary]') || $('#dlg button'); if (f) f.focus(); $('#dlg').scrollTop = 0; setAmb(); }
function closeModal() { $('#modal').hidden = true; UI.modal = null; setAmb(); const m = UI.after; UI.after = 0; if (m && S) advance(m); }
function openCodex(focus, back) {
  if (UI.modal && !back) return;
  const html = `<p class="eyebrow">직무 도감 · 6개 부문 ${Object.keys(CODEX).length}개 직무</p><h2>현대자동차에서 하는 일</h2>
    <p class="hint">공개된 채용 공고와 직무 소개를 바탕으로 정리했습니다. 실제 조직과 업무는 시기와 사업장에 따라 다릅니다.</p>
    ${DIVS.map(dv => `<h3>${dv}</h3><div class="cdx">${Object.entries(CODEX).filter(([, c]) => c.div === dv).map(([k, c]) => {
      const met = S && NPCS.some(n => n.j === k && S.met[n.id]);
      return `<article id="cx-${k}" class="${k === focus ? 'focus' : ''}"><header><b>${c.n}</b>${JOBS[k] ? '<span class="tag job">플레이 가능</span>' : ''}${met ? '<span class="tag ok">현직자 만남</span>' : ''}</header><p>${c.d}</p><dl><dt>하루</dt><dd>${c.day}</dd><dt>맞는 사람</dt><dd>${c.fit}</dd></dl></article>`; }).join('')}</div>`).join('')}
    <div class="acts"><button class="btn pri" data-act="x" data-primary>닫기</button></div>`;
  openModal(html, { wide: true, esc: true, on() { back ? back() : closeModal(); } });
  const f = focus && $('#cx-' + focus); if (f && f.scrollIntoView) f.scrollIntoView({ block: 'center' });
}
function openHelp() {
  if (UI.modal) return;
  openModal(`<p class="eyebrow">도움말</p><h2>이렇게 일합니다</h2>
    <p class="desc">하루는 08:00에 시작해 17:00에 끝납니다. 업무는 하루 여섯 건입니다. 아침 회의(09:35까지), 오전 직무 업무 둘, 13:00에 내려오는 오후 업무 둘, 15:30부터 쓰는 일일 보고. 업무 중에는 시간이 빨리 가고, 느낌표가 뜰 때 <kbd>E</kbd>를 누르면 이상한 점을 찾아내 보너스를 얻습니다. 구내 도로에서는 자전거를 타 더 빨리 움직입니다. 하루 중 그 사이 터지는 사건에 결정을 내립니다. 공장 사이는 구내 도로를 걸어서 다니고, 컨베이어는 건너지 못해 라인 끝을 돌아갑니다. 12시에는 모두 구내식당으로 갑니다. 급한 연락은 메신저로 옵니다. 제한 시간 안에 열어서 어떻게 대처할지 답해야 하고, 직접 가겠다고 했으면 그 자리까지 걸어가야 합니다.</p>
    <div class="keys"><div><kbd>1</kbd>–<kbd>6</kbd><span>프레스 · 차체 · 도장 · 의장 · 사무동 · 식당으로 걸어가기</span></div><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>직접 걷기 (W는 화면 안쪽). 화면을 누르면 길을 찾아 걸어감</span></div><div><kbd>E</kbd><span>살펴보기 · 업무 시작 · 대화 · 돌발 대응</span></div><div><kbd>T</kbd><span>다음 업무 장소로 걸어가기</span></div><div><kbd>F</kbd><span>자동 진행 켜기/끄기</span></div><div><kbd>+</kbd><kbd>−</kbd><span>확대·축소 (휠도 됨). 확대하면 카메라가 나를 따라옴</span></div><div><kbd>[</kbd><kbd>]</kbd><span>시점 돌리기 (화면을 끌어도 됨)</span></div><div><kbd>P</kbd><span>1인칭 ↔ 3인칭 (내 눈높이로 보기)</span></div><div><kbd>Home</kbd><span>3인칭 ↔ 전체 보기</span></div><div><kbd>G</kbd><span>업적</span></div><div><kbd>Q</kbd><span>메신저 열기</span></div><div><kbd>R</kbd><span>급한 연락 확인 · 약속한 장소로 걸어가기</span></div><div><kbd>Space</kbd><span>일시정지</span></div><div><kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd><kbd>V</kbd><span>시간 속도 1 · 2 · 4 · 8배</span></div><div><kbd>N</kbd><span>지식 노트 · 이해도 · 회사 지도</span></div><div><kbd>J</kbd><span>직무 도감</span></div><div><kbd>M</kbd><span>소리 켜기/끄기</span></div><div><kbd>H</kbd><span>도움말</span></div></div>
    <h3>현장 용어</h3>
    <dl class="terms"><dt>UPH</dt><dd>시간당 생산 대수. 이 게임의 라인은 실제의 약 6분의 1로 줄인 모형입니다.</dd><dt>택트타임</dt><dd>차 한 대가 한 공정에 머무는 시간. 작업은 이 안에 끝나야 합니다.</dd><dt>직행률</dt><dd>수정 없이 한 번에 합격한 차의 비율.</dd><dt>안돈</dt><dd>이상이 생기면 작업자가 라인을 세우고 알리는 호출 장치.</dd><dt>BIW</dt><dd>도장 전의 용접된 차체 뼈대.</dd><dt>서열</dt><dd>라인에 들어오는 차 순서대로 부품을 맞춰 공급하는 방식.</dd></dl>
    <div class="acts"><button class="btn pri" data-act="x" data-primary>닫기</button></div>`, { wide: true, esc: true, on() { closeModal(); } });
}

/* ---------- 화면 갱신 ---------- */
function renderAll() { renderHud(); renderZones(); renderTasks(); renderLog(); renderAndon(); renderAlerts(); renderMsgs(); renderPeers(); renderUnd(); }
function renderUnd() { const h = undBars(understanding()), el = $('#undSide'); if (el.innerHTML !== h) el.innerHTML = h; const ub = $('#noteUb'); ub.hidden = !S.newNotes; ub.textContent = S.newNotes; }
function renderHud() {
  $('#hDay').textContent = `${S.day}일차 ${WD[(S.day - 1) % 5]}요일`; $('#bAuto').setAttribute('aria-pressed', !!S.auto); $('#achN').textContent = `${Object.keys(S.ach).length}/${ACH.length}`; $('#hTime').textContent = hhmm(S.min);
  for (const k of ['sk', 'tr', 'en', 'pf']) { const m = $('#m-' + k); m.querySelector('i').style.width = S.stats[k] + '%'; m.querySelector('b').textContent = Math.round(S.stats[k]); m.classList.toggle('low', k === 'en' && S.stats.en < 20); }
  document.querySelectorAll('.speed button').forEach(b => { const v = +b.dataset.sp; b.setAttribute('aria-pressed', v === 0 ? S.paused : (!S.paused && S.speed === v)); });
  $('#hJob').textContent = CODEX[S.job].n;
}
function renderZones() {
  document.querySelectorAll('.zones button').forEach(b => {
    const z = b.dataset.z, i = SHOPS.indexOf(z); b.classList.toggle('on', S.zone === z);
    const [cls, txt] = i >= 0 ? lineState(i) : z === 'canteen' ? (S.lunch ? ['ok', '배식 중'] : ['warn', '12:00 배식']) : ['ok', S.lunch ? '점심시간' : '근무 중'];
    b.querySelector('.zs').innerHTML = `<i class="lamp ${cls}"></i>${txt}`;
    const n = S.tasks.filter(t => avail(t) && t.z === z).length; const bd = b.querySelector('.bd'); bd.hidden = !n; bd.textContent = n;
    b.classList.toggle('alert', S.zone !== z && !!((UI.flash && UI.flash.z === z) || (S.inc && S.inc.mode === 'go' && INC[S.inc.id].z === z)));
    b.classList.toggle('call', z === 'canteen' && S.lunch && !S.ate && S.zone !== z);
  });
  $('#where').textContent = (S.zone === 'yard' ? '구내 도로' : ZONES[S.zone].full) + (ME.trip && ME.trip.z !== S.zone ? ` → ${ZONES[ME.trip.z].full}으로 걸어가는 중` : '');
}
function renderAlerts() {
  let h = '';
  if (S.inc) { const d = INC[S.inc.id], left = Math.max(0, Math.ceil(S.inc.until - S.min)); h += S.inc.mode ? `<button class="alertb bad" data-alert="inc"><b>가겠다고 답함 · ${d.t}</b><span>${ZONES[d.z].full} · ${STMAP[d.z][d.s].n} · ${left}분 남음 <kbd>R</kbd></span></button>` : `<button class="alertb bad" data-alert="inc"><b>메신저 · ${PNAME[INCX[d.id].from]}</b><span>급한 연락 · ${left}분 안에 답장 <kbd>Q</kbd></span></button>`; }
  if (S.lunch && !S.ate) h += `<button class="alertb" data-alert="lunch"><b>점심시간</b><span>${S.tray ? (S.lunchWith ? '동기들이 기다리는 식탁으로' : '식탁에 앉으세요') : '구내식당 배식대로'} · 13:00까지 <kbd>6</kbd></span></button>`;
  const a = $('#alerts'); if (a.innerHTML !== h) a.innerHTML = h;
}
function renderMsgs() {
  const u = unreadAll(), ub = $('#msgUb'); ub.hidden = !u; ub.textContent = u;
  const seen = [], rows = []; for (let i = S.msgs.length - 1; i >= 0 && rows.length < 3; i--) { const m = S.msgs[i]; if (m.me || m.sys || seen.includes(m.th)) continue; seen.push(m.th); const p = pendingOf(m.th); rows.push(`<li class="${p && p.kind === 'inc' ? 'urgent' : ''}"><button data-th="${m.th}"><b>${thName(m.th)}${S.unread[m.th] ? `<i>${S.unread[m.th]}</i>` : ''}</b><span>${p ? '답장 필요 · ' : ''}${esc(m.from)}: ${m.text}</span></button></li>`); }
  const h = rows.join('') || '<li class="hint">새 메시지가 없습니다.</li>', el = $('#msgPrev'); if (el.innerHTML !== h) el.innerHTML = h;
}
function renderPeers() {
  const me = Math.round(S.stats.sk * 0.3 + S.stats.tr * 0.3 + S.stats.pf * 0.4);
  const h = NP.filter(n => n.peer).map(n => `<li><button data-peer="${n.id}"><b>${n.n}</b><span>${n.r.replace('동기 · ', '')} · ${n.z === 'yard' ? '이동 중' : ZONES[n.z].n}</span><em>수습 ${Math.round(S.pscore[n.id])}</em><i style="width:${S.peers[n.id]}%"></i></button></li>`).join('') + `<li class="mine"><b>나</b><span>${CODEX[S.job].n}</span><em>수습 ${me}</em></li>`;
  const el = $('#peers'); if (el.innerHTML !== h) el.innerHTML = h;
}
function renderTasks() {
  const h = S.tasks.map((t, i) => {
    const pct = Math.round(100 * (1 - t.left / t.m)), w = S.work && S.work.i === i, lock = !t.done && !t.miss && t.from && S.min < t.from;
    const wait = !t.done && !lock && t.seq && !S.tasks[i - 1].done, st = t.done ? '완료' : t.miss ? '놓침' : lock ? `${hhmm(t.from)}부터` : wait ? '다음 차례' : t.opt && !w && pct <= 0 ? '선택 · ' + t.m + '분' : w ? '진행 중 ' + pct + '%' : pct > 0 ? pct + '% · 이어서' : t.to ? `${hhmm(t.to)}까지` : t.m + '분';
    return `<li class="${t.done ? 'done' : ''}${t.miss ? ' miss' : ''}${lock || wait ? ' lock' : ''}${t.opt ? ' opt' : ''}${w ? ' work' : ''}"><button data-task="${i}" ${t.done || t.miss ? 'disabled' : ''}><b>${lock && t.from === 780 ? '오후 업무' : t.t}</b><span>${lock && t.from === 780 ? '점심 뒤에 팀장님이 내려보냅니다' : ZONES[t.z].full + ' · ' + STMAP[t.z][t.s].n}</span><em>${st}</em><i style="width:${t.done ? 100 : pct}%"></i></button></li>`; }).join('');
  const el = $('#tasks'); if (el.innerHTML !== h) el.innerHTML = h;
}
function renderAndon() {
  const ft = S.prod.today ? Math.round(100 * S.prod.ftt / S.prod.today) : Math.round(S.plant.q);
  $('#andon').innerHTML = `<div><b>${S.prod.today}<small>/${S.target}</small></b><span>오늘 생산</span></div><div class="${ft < 85 ? 'warn' : ''}"><b>${ft}<small>%</small></b><span>직행률</span></div><div class="${uptime() < 85 ? 'warn' : ''}"><b>${Math.round(uptime())}<small>%</small></b><span>가동률</span></div><div class="${S.plant.sf < 70 ? 'warn' : ''}"><b>${Math.round(S.plant.sf)}</b><span>안전지수</span></div>`;
}
function renderLog() { $('#log').innerHTML = S.log.slice(0, 40).map(l => `<li class="${l.k}"><time>${l.t}</time>${esc(l.m)}</li>`).join(''); }

/* ---------- 그리기: 3D ----------
   세계 좌표(x, y)와 높이 z를 원근 카메라로 투영한다. 상자·기둥·팔은 면으로 쪼개 먼 면부터 칠한다.
   바닥과 바닥 표시는 먼저 깔고, 이름표와 말풍선은 맨 위에 얹는다. */
const cv = $('#cv'); let cx = cv.getContext('2d');
let P = {}, K = {}, RGBC = {}, DPR = 1, VW = 1000, VH = 600;
function hexRgb(c) { c = String(c).trim(); let m = /^#?([0-9a-f]{6})$/i.exec(c); if (m) { const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; } m = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? [+m[1], +m[2], +m[3]] : [128, 128, 128]; }
const rgbOf = c => RGBC[c] || (RGBC[c] = hexRgb(c));
const mix = (c, f) => c.map(v => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
function readPalette() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  P = { bg: g('--bg'), floor: g('--floor'), grid: g('--grid'), conv: g('--conv'), mark: g('--conv-mark'), mach: g('--mach'), hi: g('--mach-hi'), ink: g('--ink'), muted: g('--muted'), accent: g('--accent'), ok: g('--ok'), warn: g('--warn'), bad: g('--bad'), panel: g('--panel'), line: g('--line'), room: g('--room'), pri: g('--pri') };
  RGBC = {}; K = {}; for (const k in P) K[k] = hexRgb(P[k]);
}
const Q = { mode: 'auto', lv: 2, ms: 16, bad: 0 }, QN = ['낮음', '중간', '높음'], RM = !!(matchMedia('(prefers-reduced-motion: reduce)') || {}).matches;
try { const m = localStorage.getItem('fdu-q'); if (['auto', 'high', 'mid', 'low'].includes(m)) { Q.mode = m; Q.lv = m === 'low' ? 0 : m === 'mid' ? 1 : 2; } } catch (e) {}
function qLabel() { const b = $('#bQual'); if (b) b.textContent = Q.mode === 'auto' ? `화질 자동(${QN[Q.lv]})` : `화질 ${QN[Q.lv]}`; }
function qCycle() { const o = ['auto', 'high', 'mid', 'low'], m = o[(o.indexOf(Q.mode) + 1) % 4]; Q.mode = m; Q.lv = m === 'low' ? 0 : m === 'mid' ? 1 : 2; Q.bad = 0; Q.ms = 16; try { localStorage.setItem('fdu-q', m); } catch (e) {} resize(); qLabel(); toast(m === 'auto' ? '화질 자동 · 끊기면 알아서 낮춥니다' : `화질 ${QN[Q.lv]}`); }
function qTick(raw) { if (raw <= 0 || raw > 250) return; Q.ms += (raw - Q.ms) * 0.05; if (Q.mode !== 'auto' || Q.lv === 0) return; Q.bad = Q.ms > 27 ? Q.bad + raw : Math.max(0, Q.bad - raw * 2); if (Q.bad > 2500) { Q.lv--; Q.bad = 0; Q.ms = 16; resize(); qLabel(); toast(`화면이 끊겨 화질을 ${QN[Q.lv]}(으)로 낮췄습니다`); } }
function resize() { const r = cv.getBoundingClientRect(); DPR = Math.min([1, 1.5, 2][Q.lv], window.devicePixelRatio || 1); VW = Math.max(300, r.width || 1000); VH = Math.max(200, r.height || 600); cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR); if (typeof GLR !== 'undefined' && GLR.ok) { GLR.c.width = cv.width; GLR.c.height = cv.height; } }
function rr(x, y, w, h, r, fill, stroke, lw = 1) { cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, w, h, r) : cx.rect(x, y, w, h); if (fill) { cx.fillStyle = fill; cx.fill(); } if (stroke) { cx.strokeStyle = stroke; cx.lineWidth = lw; cx.stroke(); } }
function circ(x, y, r, fill, stroke) { cx.beginPath(); cx.arc(x, y, r, 0, 7); if (fill) { cx.fillStyle = fill; cx.fill(); } if (stroke) { cx.strokeStyle = stroke; cx.lineWidth = 1; cx.stroke(); } }
function car(o) {
  if (o.wheels) { cx.fillStyle = '#16191d'; for (const [x, y] of [[-16, -13], [-16, 9.5], [10, -13], [10, 9.5]]) cx.fillRect(x, y, 9, 3.5); }
  rr(-23, -11, 46, 22, 7, o.fill, 'rgba(0,0,0,.4)');
  if (o.glass) { rr(-12, -9, 24, 18, 4, '#1f2c39'); rr(-6, -7.5, 13, 15, 3, o.fill); }
  else rr(-11, -8.5, 22, 17, 4, 'rgba(0,0,0,.14)');
  if (o.seams) { cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 0.8; cx.beginPath(); for (const x of [-9, 2, 12]) { cx.moveTo(x, -11); cx.lineTo(x, -8.5); cx.moveTo(x, 11); cx.lineTo(x, 8.5); } cx.stroke(); }
  if (o.lamps) { cx.fillStyle = '#ffe7a0'; cx.fillRect(21, -9, 2.5, 4); cx.fillRect(21, 5, 2.5, 4); cx.fillStyle = '#d83a34'; cx.fillRect(-23.5, -9, 2.5, 4); cx.fillRect(-23.5, 5, 2.5, 4); }
  if (o.gloss) { cx.fillStyle = 'rgba(255,255,255,.22)'; cx.fillRect(12, -8, 6, 16); }
}

/* 카메라 */
const CAM = { yaw: Math.PI / 4, pitch: 0.42, dist: 210, tdist: 210, tx: W / 2, ty: H / 2, tz: 0, snap: true, talk: null, shake: 0, intro: 0, fp: false };
try { CAM.fp = localStorage.getItem('fdu-fp') === '1'; if (CAM.fp) CAM.pitch = 0.06; } catch (e) {}
function setFp(v) { CAM.fp = v; CAM.pitch = v ? 0.06 : 0.42; CAM.tdist = 210; CAM.snap = true; try { localStorage.setItem('fdu-fp', v ? '1' : '0'); } catch (e) {} const b = $('#zFp'); if (b) b.setAttribute('aria-pressed', v); toast(v ? '1인칭 시점 · 화면을 끌어 둘러보세요 (P로 전환)' : '3인칭 시점'); }
let CM = { pos: [0, 0, 0], f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0], foc: 900, vw: 1000, vh: 600 };
function camUpdate(dt) {
  const snapN = CAM.snap, k = snapN ? 1 : Math.min(1, dt * 6), fol = CAM.tdist < 860, kf = snapN ? 1 : Math.min(1, dt * (fol ? 10 : 6));
  const tk = fol && CAM.talk && CAM.talk.z === S.zone ? CAM.talk : null;   // 대화 중에는 두 사람 사이로 다가간다
  CAM.dist += ((tk ? Math.min(CAM.tdist, 150) : CAM.tdist) - CAM.dist) * (snapN ? 1 : Math.min(1, dt * (tk ? 3 : 4)));
  if (snapN && CAM.intro && fol && !RM) CAM.dist = CAM.tdist * 2.2; CAM.intro = 0;   // 건물에 들어서면 넓게 보여 준 뒤 등 뒤로 다가온다
  const tx = tk ? (S.px + tk.x) / 2 : fol ? S.px : W / 2, ty = tk ? (S.py + tk.y) / 2 : fol ? S.py : H / 2 - 10, tz = fol ? 26 : 0;
  CAM.tx += (tx - CAM.tx) * kf; CAM.ty += (ty - CAM.ty) * kf; CAM.tz += (tz - CAM.tz) * k; CAM.snap = false;
  if (CAM.shake > 0) CAM.shake = Math.max(0, CAM.shake - dt * 5);
  // 길을 따라 걸을 때는 카메라가 천천히 등 뒤로 돈다. 업무 중에는 주위를 천천히 돈다
  const turn = (want, sp) => { let d = want - CAM.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; CAM.yaw += d * Math.min(1, dt * sp); };
  if (fol && ME.mv && ME.trip && !PD) turn((YAW[ME.dir] ?? 0) + Math.PI, CAM.fp ? 2.6 : 0.9);
  else if (CAM.fp && tk && !PD) turn(Math.atan2(tk.y - S.py, tk.x - S.px) + Math.PI, 3);   // 1인칭: 말하는 사람을 바라본다
  else if (fol && !CAM.fp && S.work && !PD && !UI.modal && !S.paused && !RM) CAM.yaw += dt * 0.09;
}
const shake = v => { if (!RM) CAM.shake = Math.max(CAM.shake, v); };
function makeCam(tx, ty, tz, yaw, pitch, dist, vw, vh) {
  const cp = Math.cos(pitch), pos = [tx + dist * cp * Math.cos(yaw), ty + dist * cp * Math.sin(yaw), tz + dist * Math.sin(pitch)];
  const f = [tx - pos[0], ty - pos[1], tz - pos[2]], fl = Math.hypot(...f); f.forEach((a, i) => f[i] = a / fl);
  const r = [-f[1], f[0], 0], rl = Math.hypot(r[0], r[1]) || 1; r[0] /= rl; r[1] /= rl;
  const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  return { pos, f, r, u, foc: Math.max(vw, vh * 1.4) * 0.92, vw, vh };
}
function proj(q) { const d0 = q[0] - CM.pos[0], d1 = q[1] - CM.pos[1], d2 = (q[2] || 0) - CM.pos[2], z = d0 * CM.f[0] + d1 * CM.f[1] + d2 * CM.f[2]; return [CM.vw / 2 + (d0 * CM.r[0] + d1 * CM.r[1] + d2 * CM.r[2]) / z * CM.foc, CM.vh / 2 - (d0 * CM.u[0] + d1 * CM.u[1] + d2 * CM.u[2]) / z * CM.foc, z]; }
function zoomBy(f) { if (CAM.fp) return; CAM.tdist = clamp(CAM.tdist / f, 90, 1500); }
function rotBy(a) { CAM.yaw += a; }
function camReset() { if (CAM.fp) { setFp(false); return; } if (CAM.tdist < 860) { CAM.yaw = Math.PI / 4; CAM.pitch = 0.78; CAM.tdist = 1100; toast('전체 보기 · 다시 누르면 내 캐릭터 뒤로'); } else { CAM.pitch = 0.42; CAM.tdist = 210; toast('3인칭 시점'); } }

/* 면 만들기 */
let F = [], GLOK = false;
const LIGHT = (() => { const v = [-0.35, -0.55, 0.76], l = Math.hypot(...v); return v.map(a => a / l); })();
function face(pts, n, col, a = 1, b = 0) { F.push({ pts, n, col, a, b }); }
function box(x0, y0, z0, x1, y1, z1, col, a = 1, ch = 40) {
  const nx = GLOK ? 1 : Math.max(1, Math.ceil((x1 - x0) / ch)), ny = GLOK ? 1 : Math.max(1, Math.ceil((y1 - y0) / ch)), dx = (x1 - x0) / nx, dy = (y1 - y0) / ny;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const a0 = x0 + i * dx, a1 = a0 + dx, b0 = y0 + j * dy, b1 = b0 + dy;
    face([[a0, b0, z1], [a1, b0, z1], [a1, b1, z1], [a0, b1, z1]], [0, 0, 1], col, a);
    if (j === ny - 1) face([[a0, b1, z0], [a1, b1, z0], [a1, b1, z1], [a0, b1, z1]], [0, 1, 0], col, a);
    if (j === 0) face([[a0, b0, z0], [a1, b0, z0], [a1, b0, z1], [a0, b0, z1]], [0, -1, 0], col, a);
    if (i === nx - 1) face([[a1, b0, z0], [a1, b1, z0], [a1, b1, z1], [a1, b0, z1]], [1, 0, 0], col, a);
    if (i === 0) face([[a0, b0, z0], [a0, b1, z0], [a0, b1, z1], [a0, b0, z1]], [-1, 0, 0], col, a);
  }
}
function obox(cx0, cy0, cz, hx, hy, hz, yaw, col) {
  const c = Math.cos(yaw), s = Math.sin(yaw), ax = [c, s, 0], ay = [-s, c, 0];
  const V = (u, v, w) => [cx0 + ax[0] * u + ay[0] * v, cy0 + ax[1] * u + ay[1] * v, cz + w];
  const v = [V(-hx, -hy, -hz), V(hx, -hy, -hz), V(hx, hy, -hz), V(-hx, hy, -hz), V(-hx, -hy, hz), V(hx, -hy, hz), V(hx, hy, hz), V(-hx, hy, hz)];
  face([v[4], v[5], v[6], v[7]], [0, 0, 1], col); face([v[1], v[2], v[6], v[5]], ax, col); face([v[0], v[3], v[7], v[4]], [-ax[0], -ax[1], 0], col);
  face([v[2], v[3], v[7], v[6]], ay, col); face([v[0], v[1], v[5], v[4]], [-ay[0], -ay[1], 0], col);
}
function beam(p, q, w, col) {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], L = Math.hypot(...d) || 1, f = d.map(a => a / L), up = Math.abs(f[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const r = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]], rl = Math.hypot(...r); r.forEach((a, i) => r[i] = a / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]], h = w / 2;
  const V = (o, a, b) => [o[0] + r[0] * a + u[0] * b, o[1] + r[1] * a + u[1] * b, o[2] + r[2] * a + u[2] * b];
  const A = [V(p, -h, -h), V(p, h, -h), V(p, h, h), V(p, -h, h)], B = [V(q, -h, -h), V(q, h, -h), V(q, h, h), V(q, -h, h)];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, n = [[0, -1], [1, 0], [0, 1], [-1, 0]][i]; face([A[i], A[j], B[j], B[i]], [r[0] * n[0] + u[0] * n[1], r[1] * n[0] + u[1] * n[1], r[2] * n[0] + u[2] * n[1]], col); }
  face([B[0], B[1], B[2], B[3]], f, col);
}
function prism(x, y, z0, z1, rad, col, sides = 8, top) {
  const pt = (i, z) => { const a = i / sides * Math.PI * 2 + Math.PI / sides; return [x + Math.cos(a) * rad, y + Math.sin(a) * rad, z]; };
  for (let i = 0; i < sides; i++) { const a = (i + 0.5) / sides * Math.PI * 2 + Math.PI / sides; face([pt(i, z0), pt(i + 1, z0), pt(i + 1, z1), pt(i, z1)], [Math.cos(a), Math.sin(a), 0], col); }
  face(Array.from({ length: sides }, (_, i) => pt(i, z1)), [0, 0, 1], top || col);
}
const plate = (x0, y0, x1, y1, z, col, b = 3) => face([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], col, 1, b);
const vqY = (x0, x1, y, z0, z1, col, ny, b = 4) => face([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, ny, 0], col, 1, b);
const vqX = (x, y0, y1, z0, z1, col, nx, b = 4) => face([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], [nx, 0, 0], col, 1, b);
function vqYc(x0, x1, y, z0, z1, col, ny, b = 4) { const n = GLOK ? 1 : Math.max(1, Math.ceil((x1 - x0) / 40)), d = (x1 - x0) / n; for (let i = 0; i < n; i++) vqY(x0 + i * d, x0 + (i + 1) * d, y, z0, z1, col, ny, b); }
function vqXc(x, y0, y1, z0, z1, col, nx, b = 4) { const n = GLOK ? 1 : Math.max(1, Math.ceil((y1 - y0) / 40)), d = (y1 - y0) / n; for (let i = 0; i < n; i++) vqX(x, y0 + i * d, y0 + (i + 1) * d, z0, z1, col, nx, b); }

/* 그리기: 먼 면부터 */
function polyS(pts, fill, stroke) { cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.closePath(); if (fill) { cx.fillStyle = fill; cx.fill(); } if (stroke) { cx.strokeStyle = stroke; cx.stroke(); } }
function ground(pts) { const s = pts.map(proj); return s.some(p => p[2] < 6) ? null : s; }
function gpoly(pts, fill, stroke, lw = 1) { const s = ground(pts); if (s) { cx.lineWidth = lw; polyS(s, fill, stroke); } }
function grect(x0, y0, x1, y1, fill, stroke, lw, z = 0.3) { gpoly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill, stroke, lw); }
function gcirc(x, y, r, fill, stroke, lw = 1, n = 16) { gpoly(Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [x + Math.cos(a) * r, y + Math.sin(a) * r, 0.4]; }), fill, stroke, lw); }
function gline(pts, col, lw = 1) { const s = pts.map(proj); if (s.some(p => p[2] < 6)) return; cx.strokeStyle = col; cx.lineWidth = lw; cx.beginPath(); s.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.stroke(); }
function paintFaces() {
  const cp = CM.pos, list = [];
  for (const fz of F) {
    const pts = fz.pts; let mx = 0, my = 0, mz = 0; for (const p of pts) { mx += p[0]; my += p[1]; mz += p[2]; } const n = pts.length; mx /= n; my /= n; mz /= n;
    if (fz.n[0] * (cp[0] - mx) + fz.n[1] * (cp[1] - my) + fz.n[2] * (cp[2] - mz) <= 0) continue;
    const s = pts.map(proj); if (s.some(p => p[2] < 6)) continue;
    list.push({ s, d: Math.sqrt((cp[0] - mx) ** 2 + (cp[1] - my) ** 2 + (cp[2] - mz) ** 2) - fz.b, fz });
  }
  list.sort((a, b) => b.d - a.d);
  cx.lineWidth = 0.6; cx.lineJoin = 'round';
  for (const it of list) { const c = it.fz.col, n = it.fz.n, l = 0.62 + 0.38 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]), st = `rgba(${Math.round(c[0] * l)},${Math.round(c[1] * l)},${Math.round(c[2] * l)},${it.fz.a})`; polyS(it.s, st, it.fz.a === 1 ? st : null); }
}

/* ---------- WebGL: 깊이 버퍼, 방향광, 그림자, 안개 ----------
   면 목록(F)을 삼각형으로 바꿔 한 번에 올린다. 해 쪽에서 한 번 그려 그림자 지도를 만들고, 카메라 쪽에서 다시 그린다. */
const SHS = 2048;
const GLR = (() => {
  const c = $('#gl'); let gl = null;
  try { gl = c && c.getContext && c.getContext('webgl2', { antialias: true, alpha: false }); } catch (e) { gl = null; }
  if (!gl || typeof gl.createShader !== 'function') return { ok: false };
  const VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec4 aC;
uniform mat4 uVP; uniform mat4 uLVP;
out vec3 vP; out vec3 vN; out vec4 vC; out vec4 vL;
void main() { vP = aP; vN = aN; vC = aC; vL = uLVP * vec4(aP, 1.0); gl_Position = uVP * vec4(aP, 1.0); }`;
  const FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec4 vC; in vec4 vL;
uniform vec3 uCam; uniform vec3 uLight; uniform vec3 uFog; uniform vec2 uFogR; uniform highp sampler2DShadow uSh;
uniform vec4 uSee; uniform vec3 uFwd; uniform vec3 uTint; uniform int uShQ;
out vec4 o;
void main() {
  if (uSee.w > 0.0 && vC.a >= 1.0 && vP.z > 7.0 && dot(vP - uCam, uFwd) < uSee.z - 22.0) {
    float r = distance(gl_FragCoord.xy, uSee.xy) / uSee.w;
    if (r < 1.0) { vec2 g = floor(gl_FragCoord.xy / 2.0); if (r < 0.72 ? mod(g.x + g.y, 2.0) < 1.0 || mod(g.x, 2.0) < 1.0 : mod(g.x + g.y, 2.0) < 1.0) discard; }
  }
  vec3 n = normalize(vN); if (dot(n, uCam - vP) < 0.0) n = -n;
  float d = max(dot(n, uLight), 0.0), sh = 1.0;
  vec3 lp = vL.xyz * 0.5 + 0.5;
  if (lp.x > 0.0 && lp.x < 1.0 && lp.y > 0.0 && lp.y < 1.0 && lp.z < 1.0) {
    float s = 0.0; vec2 ts = vec2(1.0 / ${SHS}.0); float zz = lp.z - 0.0012;
    if (uShQ > 1) { for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) s += texture(uSh, vec3(lp.xy + vec2(x, y) * ts * 1.3, zz)); sh = s / 9.0; }
    else if (uShQ > 0) { s = texture(uSh, vec3(lp.xy + ts * vec2(-0.8, -0.8), zz)) + texture(uSh, vec3(lp.xy + ts * vec2(0.8, -0.8), zz)) + texture(uSh, vec3(lp.xy + ts * vec2(-0.8, 0.8), zz)) + texture(uSh, vec3(lp.xy + ts * vec2(0.8, 0.8), zz)); sh = s / 4.0; }
    else sh = texture(uSh, vec3(lp.xy, zz));
  }
  float sky = 0.5 + 0.5 * n.z;
  vec3 col = vC.rgb * (0.40 + 0.16 * sky + 0.52 * d * (0.25 + 0.75 * sh)) * uTint;
  float f = smoothstep(uFogR.x, uFogR.y, length(uCam - vP));
  o = vec4(mix(col, uFog, f * 0.6), vC.a);
}`;
  const VSD = `#version 300 es
layout(location=0) in vec3 aP; uniform mat4 uLVP; void main() { gl_Position = uLVP * vec4(aP, 1.0); }`;
  const FSD = `#version 300 es
precision mediump float; void main() {}`;
  const shd = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, shd(gl.VERTEX_SHADER, v)); gl.attachShader(p, shd(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  try {
    const main = prog(VS, FS), dep = prog(VSD, FSD);
    const mkVao = () => { const vao = gl.createVertexArray(), vbo = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24); return [vao, vbo]; };
    const [vao, vbo] = mkVao(), [vaoS, vboS] = mkVao();
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHS, SHS, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    const okF = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!okF) throw new Error('shadow framebuffer incomplete');
    const U = n => gl.getUniformLocation(main, n);
    return { ok: true, gl, c, main, dep, vao, vbo, vaoS, vboS, sKey: '', sOp: 0, sAll: 0, tex, fbo, buf: new Float32Array(1 << 18),
      u: { vp: U('uVP'), lvp: U('uLVP'), cam: U('uCam'), light: U('uLight'), fog: U('uFog'), fogR: U('uFogR'), sh: U('uSh'), see: U('uSee'), fwd: U('uFwd'), tint: U('uTint'), shq: U('uShQ') }, ud: gl.getUniformLocation(dep, 'uLVP') };
  } catch (e) { console.warn('WebGL을 쓸 수 없어 기본 방식으로 그립니다.', e); return { ok: false }; }
})();
if (!GLR.ok && $('#gl')) $('#gl').hidden = true; GLOK = !!GLR.ok;
function camVP(cm, near = 4, far = 7000) {
  const { r, u, f, pos } = cm, fx = 2 * cm.foc / cm.vw, fy = 2 * cm.foc / cm.vh, A = -(far + near) / (far - near), B = -2 * far * near / (far - near);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const V0 = [r[0], r[1], r[2], -dot(r, pos)], V1 = [u[0], u[1], u[2], -dot(u, pos)], V2 = [-f[0], -f[1], -f[2], dot(f, pos)];
  const R = [V0.map(v => v * fx), V1.map(v => v * fy), V2.map((v, i) => v * A + (i === 3 ? B : 0)), V2.map(v => -v)];
  const m = new Float32Array(16); for (let c = 0; c < 4; c++) for (let rw = 0; rw < 4; rw++) m[c * 4 + rw] = R[rw][c]; return m;
}
function lightVP() {
  const c = [W / 2, H / 2, 0], L = LIGHT, lf = [-L[0], -L[1], -L[2]], eye = [c[0] + L[0] * 1500, c[1] + L[1] * 1500, c[2] + L[2] * 1500];
  let lr = [lf[1] * 1 - lf[2] * 0, lf[2] * 0 - lf[0] * 1, 0]; const rl = Math.hypot(...lr); lr = lr.map(v => v / rl);
  const lu = [lr[1] * lf[2] - lr[2] * lf[1], lr[2] * lf[0] - lr[0] * lf[2], lr[0] * lf[1] - lr[1] * lf[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], hw = 820, n = 600, fa = 2700;
  const R = [[...lr.map(v => v / hw), -dot(lr, c) / hw], [...lu.map(v => v / hw), -dot(lu, c) / hw], [...lf.map(v => 2 * v / (fa - n)), 2 * (-dot(lf, eye) - n) / (fa - n) - 1], [0, 0, 0, 1]];
  const m = new Float32Array(16); for (let cc = 0; cc < 4; cc++) for (let rw = 0; rw < 4; rw++) m[cc * 4 + rw] = R[rw][cc]; return m;
}
const LVP = lightVP();
function glPack() {
  const g = GLR; let nv = 0; for (const fz of F) nv += (fz.pts.length - 2) * 3;
  if (g.buf.length < nv * 10) g.buf = new Float32Array(Math.ceil(nv * 10 * 1.5));
  const b = g.buf; let o = 0;
  const put = fz => { const p = fz.pts, n = fz.n, c = fz.col, r = c[0] / 255, gg = c[1] / 255, bb = c[2] / 255, a = fz.a; for (let i = 1; i < p.length - 1; i++) for (let k = 0; k < 3; k++) { const q = k === 0 ? p[0] : k === 1 ? p[i] : p[i + 1]; b[o++] = q[0]; b[o++] = q[1]; b[o++] = q[2]; b[o++] = n[0]; b[o++] = n[1]; b[o++] = n[2]; b[o++] = r; b[o++] = gg; b[o++] = bb; b[o++] = a; } };
  for (const fz of F) if (fz.a >= 1) put(fz);
  const nOp = o / 10; for (const fz of F) if (fz.a < 1) put(fz);
  return [b.subarray(0, o), nOp, o / 10];
}
/* 움직이지 않는 것(바닥, 벽, 컨베이어, 나무)은 한 번만 올려 두고 다시 쓴다 */
function glStatic(key, build) {
  const g = GLR, gl = g.gl; if (g.sKey === key) return;
  const keep = F; F = []; build(); const [data, nOp, nAll] = glPack(); F = keep;
  gl.bindVertexArray(g.vaoS); gl.bindBuffer(gl.ARRAY_BUFFER, g.vboS); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); g.sKey = key; g.sOp = nOp; g.sAll = nAll;
}
function glRender(fogNear, fogFar) {
  const g = GLR, gl = g.gl, [data, nOp, nAll] = glPack();
  gl.bindVertexArray(g.vao); gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  // 그림자 지도
  gl.bindFramebuffer(gl.FRAMEBUFFER, g.fbo); gl.viewport(0, 0, SHS, SHS); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.useProgram(g.dep); gl.uniformMatrix4fv(g.ud, false, LVP);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
  gl.bindVertexArray(g.vaoS); gl.drawArrays(gl.TRIANGLES, 0, g.sOp); gl.bindVertexArray(g.vao); gl.drawArrays(gl.TRIANGLES, 0, nOp); gl.disable(gl.POLYGON_OFFSET_FILL);
  // 화면
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, g.c.width, g.c.height);
  const sky = mix(K.bg, 0.02); gl.clearColor(sky[0] / 255, sky[1] / 255, sky[2] / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(g.main);
  gl.uniformMatrix4fv(g.u.vp, false, camVP(CM)); gl.uniformMatrix4fv(g.u.lvp, false, LVP);
  gl.uniform3fv(g.u.cam, CM.pos); gl.uniform3fv(g.u.light, LIGHT); gl.uniform3f(g.u.fog, sky[0] / 255, sky[1] / 255, sky[2] / 255); gl.uniform2f(g.u.fogR, fogNear, fogFar);
  // 내 캐릭터를 가리는 것은 점점이 비워서 뒤가 보이게 한다
  const fol = CAM.tdist < 860, me = proj([S.px, S.py, 26]);
  gl.uniform4f(g.u.see, me[0] * DPR, (VH - me[1]) * DPR, me[2], fol && !CAM.fp && me[2] > 10 ? Math.min(VW, VH) * 0.15 * DPR * clamp(240 / me[2], 0.5, 1.5) : 0);
  gl.uniform3fv(g.u.fwd, CM.f); gl.uniform1i(g.u.shq, Q.lv);
  const m = S.min, warm = m < 600 ? (600 - m) / 120 : m > 900 ? (m - 900) / 120 : 0;   // 아침과 늦은 오후에는 빛이 따뜻해진다
  gl.uniform3f(g.u.tint, 1 + 0.05 * warm, 1 - 0.015 * warm, 1 - 0.1 * warm);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.tex); gl.uniform1i(g.u.sh, 0);
  gl.bindVertexArray(g.vaoS); gl.drawArrays(gl.TRIANGLES, 0, g.sOp); gl.bindVertexArray(g.vao); gl.drawArrays(gl.TRIANGLES, 0, nOp);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  if (g.sAll > g.sOp) { gl.bindVertexArray(g.vaoS); gl.drawArrays(gl.TRIANGLES, g.sOp, g.sAll - g.sOp); }
  if (nAll > nOp) { gl.bindVertexArray(g.vao); gl.drawArrays(gl.TRIANGLES, nOp, nAll - nOp); }
  gl.depthMask(true); gl.disable(gl.BLEND);
}

/* 바닥을 면으로: WebGL에서는 바닥 표시도 깊이 버퍼로 가린다 */
const gq = (x0, y0, x1, y1, z, col, a = 1) => face([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], col, a);
function gseg(p, q, w, z, col, a = 1) { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2; face([[p[0] + nx, p[1] + ny, z], [q[0] + nx, q[1] + ny, z], [q[0] - nx, q[1] - ny, z], [p[0] - nx, p[1] - ny, z]], [0, 0, 1], col, a); }
function gdash(pts, w, z, col, dash = 8, gap = 6, off = 0, a = 1) {
  let carry = -(off % (dash + gap));
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (!l) continue; const ux = (q[0] - p[0]) / l, uy = (q[1] - p[1]) / l;
    for (let s = carry; s < l; s += dash + gap) { const a0 = Math.max(0, s), a1 = Math.min(l, s + dash); if (a1 > a0) gseg([p[0] + ux * a0, p[1] + uy * a0], [p[0] + ux * a1, p[1] + uy * a1], w, z, col, a); carry = s + dash + gap - l; }
  }
}
function gring(x, y, r, w, z, col, n = 28, dashed = false, rot = 0, a = 1) { for (let i = 0; i < n; i++) { if (dashed && i % 2) continue; const a0 = i / n * Math.PI * 2 + rot, a1 = (i + 1) / n * Math.PI * 2 + rot; gseg([x + Math.cos(a0) * r, y + Math.sin(a0) * r], [x + Math.cos(a1) * r, y + Math.sin(a1) * r], w, z, col, a); } }
function floorGL(z, line, t, dyn) {
  const yard = z === 'yard', grid = rgbOf(P.grid);
  if (dyn) {
    if (yard) for (const s of ST.yard) if (s.k === 'port') { const x0 = s.x - s.w / 2, y1 = s.y + s.h / 2; for (let i = 0; i < 4; i++) { const a = x0 + 20 + ((t * 10 + i * 80) % (s.w - 40)); gseg([a, y1 - 30 + i * 6], [a + 20, y1 - 30 + i * 6], 1, -0.4, mix(C3.water, 0.5)); } }
    gring(S.px, S.py, 14 + Math.sin(t * 4) * 1.5, 2.2, 0.5, K.accent);
    if (UI.near && (UI.near.k === 'npc' || STMAP[z][UI.near.id])) { const o = UI.near, p = o.k === 'st' ? ipOf(STMAP[z][o.id]) : NP.find(n => n.id === o.id); if (p) gring(p.x, p.y, 22, 2, 0.45, K.accent, 32, true, t * 0.6); }
    if (ME.path && ME.path.length) { gdash([[S.px, S.py], ...ME.path.map(p => [p.x, p.y])], 2, 0.4, K.ink, 4, 8, t * 30, 0.5); const e = ME.path[ME.path.length - 1]; gring(e.x, e.y, 6 + Math.sin(t * 6), 1.6, 0.42, K.ink, 14); }
    return;
  }
  gq(-1800, -1800, W + 1800, H + 1800, -1.5, mix(K.bg, yard ? -0.16 : -0.08));
  gq(0, 0, W, H, 0, yard ? mix(K.floor, -0.04) : K.floor);
  if (!yard) { for (let x = 40; x < W; x += 40) gseg([x, 0], [x, H], 1.1, 0.08, grid); for (let y = 40; y < H; y += 40) gseg([0, y], [W, y], 1.1, 0.08, grid); }
  if (yard) {
    gq(0, 286, W, 374, 0.15, mix(K.conv, 0.08));
    for (let a = 0; a < W; a += 28) gq(a, 329, a + 14, 331, 0.25, K.mark);
    for (const k of DEST) { const dx = DOOR[k].out[0]; for (let i = 0; i < 6; i++) gq(dx - 16, 292 + i * 14, dx + 16, 299 + i * 14, 0.3, K.mark); }
    gq(0, 268, W, 286, 0.1, mix(K.room, 0.1)); gq(0, 374, W, 392, 0.1, mix(K.room, 0.1));
    for (const s of ST.yard) if (s.k === 'port') { const x0 = s.x - s.w / 2, y0 = s.y - s.h / 2, x1 = x0 + s.w, y1 = y0 + s.h; gq(x0, y0, x1, y1 - 46, 0.15, mix(K.conv, 0.25)); gq(x0, y1 - 46, x1 + 60, y1 + 60, -0.6, C3.water); }
  } else {
    const d = DOOR[z].in; if (d[1] < 100) gq(d[0] - 28, 0, d[0] + 28, 28, 0.2, K.accent); else gq(d[0] - 30, H - 34, d[0] + 30, H, 0.2, K.accent);
    if (line) { gq(20, 562, W - 20, 592, 0.15, mix(K.ok, 0.55), 0.55); gseg([20, 562], [W - 20, 562], 1.6, 0.25, K.accent); gseg([20, 592], [W - 20, 592], 1.6, 0.25, K.accent); }
  }
  for (const s of ST[z]) {
    const x0 = s.x - s.w / 2, y0 = s.y - s.h / 2, x1 = x0 + s.w, y1 = y0 + s.h;
    if (s.k === 'robots') { gq(x0 - 6, y0 - 18, x1 + 6, y1 + 18, 0.18, rgbOf('#e9c21a'), 0.18); gdash([[x0 - 6, y0 - 18], [x1 + 6, y0 - 18], [x1 + 6, y1 + 18], [x0 - 6, y1 + 18], [x0 - 6, y0 - 18]], 1.8, 0.3, rgbOf('#c9a00a')); }
    else if (s.k === 'tunnel') gq(x0, y0, x1, y1, 0.18, C3.light, 0.4);
    else if (s.k === 'deck') gq(x0 + 10, y0 + 10, x1 - 10, y1 - 10, 0.18, mix(K.accent, 0.5));
    else if (s.k === 'lot') for (let i = 0; i <= 5; i++) gseg([x0 + 4 + i * 32, y0 + 4], [x0 + 4 + i * 32, y1 - 4], 1.6, 0.25, K.mark);
    else if (s.k === 'room') { gq(x0, y0, x1, y1, 0.2, K.room); gdash([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], 1.2, 0.28, mix(K.line, -0.15), 1000, 0); }
  }
}

/* 설비 높이, 이름표 자리, 클릭 판정 */
const SHK = { press: 92, tandem: 96, coil: 30, rack: 24, bench: 22, robots: 50, gate: 72, deck: 72, booth: 60, oven: 54, tunnel: 62, manual: 26, lot: 0, room: 0, serve: 26, table: 20, port: 0 };
const SH = s => s.k === 'bldg' ? (s.id === 'office' ? 130 : s.id === 'canteen' ? 80 : 110) : SHK[s.k] ?? 20;
function hull(pts) { pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = []; for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); }
function corners(s) { const h = SH(s), x0 = s.x - s.w / 2, y0 = s.y - s.h / 2, x1 = x0 + s.w, y1 = y0 + s.h, o = []; for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of h ? [0, h] : [0]) o.push([x, y, z]); return o; }
function hitPoly(s) { const p = corners(s).map(proj); return p.some(q => q[2] < 6) ? [] : hull(p); }
function inPoly(X, Y, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > Y) !== (yj > Y) && X < (xj - xi) * (Y - yi) / (yj - yi) + xi) c = !c; } return c; }
function labelPt(s) { const y0 = s.y - s.h / 2; if (s.k === 'room') return [s.x, y0, 46]; if (s.k === 'port') return [s.x, s.y, 34]; return [s.x, s.y, SH(s) + 16]; }

/* 색 묶음 */
const C3 = { pants: hexRgb('#3a4350'), dark: hexRgb('#22272e'), white: hexRgb('#eef1f3'), cap: hexRgb('#3d5f86'), work: hexRgb('#5b7fa6'), eng: hexRgb('#77838f'), vest: hexRgb('#e9c21a'), helmet: hexRgb('#f4f3ee'), red: hexRgb('#d6453c'), blue: hexRgb('#3f78b5'),
  blank: hexRgb('#b4bdc6'), panel2: hexRgb('#c6cdd4'), hole: hexRgb('#5c6670'), parts: hexRgb('#aab4bd'), steel: hexRgb(STEEL), tire: hexRgb('#1b1e22'), glass: hexRgb('#2b3b4c'), lampF: hexRgb('#ffe7a0'), lampR: hexRgb('#d83a34'), skid: hexRgb('#2a3340'),
  tool: hexRgb('#3b4552'), light: hexRgb('#fff6cf'), water: hexRgb('#3f7396'), trunk: hexRgb('#6b4f3a'), leaf: hexRgb('#5d8a5a'), screen: hexRgb('#1d2733'), monitor: hexRgb('#2a3340'), glassW: hexRgb('#dfe9f2') };
const SKIN3 = ['#f1cfae', '#e3b98f', '#c99772'].map(hexRgb), HAIR3 = ['#1f1a17', '#3c2a1f', '#8e8e8e', '#5b3c28', '#a8703a', '#d8c07a'].map(hexRgb);
const SHIRT3 = ['#e9edf0', '#cfe0f2', '#efe4cf', '#dbe8dc'].map(hexRgb), TIE3 = ['#a5342e', '#2c4a70', '#3d6b4f', '#7a4a86'].map(hexRgb), JACKET3 = JACKET.map(hexRgb);
const FOOD = ['#c9772f', '#8a5a2b', '#e9d9a8', '#6e9a4e', '#d8452f', '#efe6d2', '#b88a4a', '#7fae6a', '#f0f0ea'].map(hexRgb);

/* 사람: 블록 인형. 복장으로 하는 일을, 머리 모양·색·안경으로 누구인지 구분한다 */
const YAW = { e: 0, s: Math.PI / 2, w: Math.PI, n: -Math.PI / 2 };
function person3d(p, o = {}) {
  const L = p.L, yaw = p.ry ?? YAW[p.dir] ?? Math.PI / 2, ph = p.x * 0.1 + p.y * 0.07, mv = p.mv;
  const sw = mv ? Math.sin(UI.t * 12 + ph) * 3 : o.work ? Math.sin(UI.t * 5 + ph) * 1.5 : 0, bob = mv ? Math.abs(Math.sin(UI.t * 12 + ph)) * 1.2 : 0;
  const c = Math.cos(yaw), s = Math.sin(yaw), at = (f, l) => [p.x + c * f - s * l, p.y + s * f + c * l];
  const fr = (f, l, z, hx, hy, hz, col) => { const q = at(f, l); obox(q[0], q[1], z, hx, hy, hz, yaw, col); };
  const kind = p.me || p.peer ? 'me' : ['work', 'eng', 'office', 'safe'][p.c] || 'eng';
  const wear = kind === 'me' ? JACKET3[L[4] % JACKET3.length] : kind === 'work' ? C3.work : kind === 'office' ? SHIRT3[L[4] % 4] : C3.eng, sit = o.sit ? -5 : 0;
  if (o.lod) obox(p.x, p.y, 7, 2.5, 5, 7, yaw, C3.pants);
  else for (const [l, k] of [[-3, 1], [3, -1]]) fr(o.sit ? 4 : sw * k, l, o.sit ? 3 : 7, o.sit ? 4 : 2.5, 2.3, o.sit ? 3 : 7, C3.pants);
  const z0 = 22 + bob + sit;
  obox(p.x, p.y, z0, 4.5, 7, 8, yaw, wear);
  if (kind === 'safe') { fr(4.7, -4, z0, 0.35, 2.2, 7, C3.vest); fr(4.7, 4, z0, 0.35, 2.2, 7, C3.vest); fr(-4.7, 0, z0, 0.35, 6.5, 7, C3.vest); }
  else if (kind === 'office') { fr(4.7, 0, z0 + 6, 0.3, 2, 1.5, C3.white); if (L[4] % 2) fr(4.75, 0, z0 + 1, 0.3, 0.9, 5, TIE3[L[4] % 4]); }
  else if (kind === 'work') fr(4.7, -3, z0 + 3, 0.3, 1.5, 1, C3.white);
  else { fr(4.7, 0, z0 + 5, 0.3, 2, 2, C3.white); fr(4.75, 0, z0 - 1, 0.3, 1.2, 1.5, kind === 'me' ? K.accent : C3.blue); }
  if (!o.lod) for (const [l, k] of [[-8.5, -1], [8.5, 1]]) fr(-sw * k * 0.8 + (o.work || o.sit ? 3 : 0), l, z0 + (o.work ? 1 : 0), 2, 2, 7, wear);
  const hz = 36 + bob + sit; obox(p.x, p.y, hz, 5.5, 5.5, 5.5, yaw, SKIN3[L[0]]);
  if (!o.lod) { for (const l of [-2.3, 2.3]) fr(5.6, l, hz + 0.5, 0.3, 0.8, 0.9, C3.dark); if (L[3]) fr(5.8, 0, hz + 0.6, 0.25, 4.2, 1.4, C3.dark); }
  const hc = HAIR3[L[2] % HAIR3.length], hs = L[1];
  if (kind === 'work') { obox(p.x, p.y, hz + 6.4, 6, 6, 1.4, yaw, C3.cap); fr(6.5, 0, hz + 5.2, 2, 5, 0.5, C3.cap); }
  else if (kind === 'safe') { obox(p.x, p.y, hz + 6.8, 6.4, 6.4, 1.8, yaw, C3.helmet); fr(0, 0, hz + 8.8, 1, 1, 0.4, C3.red); }
  else {
    if (hs === 5) obox(p.x, p.y, hz + 5.8, 5.7, 5.7, 0.5, yaw, hc);
    else { const big = hs === 6; obox(p.x, p.y, hz + 6.2, big ? 7 : 6, big ? 7 : 6, big ? 2.2 : 1.3, yaw, hc); fr(-5.8, 0, hz - (hs === 3 ? 1 : 0), 0.6, 5.8, hs === 3 ? 7 : 5, hc); }
    if (hs === 1) fr(4.5, -3.5, hz + 4.2, 1.6, 2.5, 1.2, hc);
    if (hs === 2 || hs === 3) for (const l of [-5.9, 5.9]) fr(-0.5, l, hz - (hs === 3 ? 2 : 0.5), 4.5, 0.6, hs === 3 ? 7 : 4.5, hc);
    if (hs === 4) fr(-7.4, 0, hz + 2, 1.5, 2, 2.5, hc);
    if (hs === 7) obox(p.x, p.y, hz + 9, 2.2, 2.2, 2, yaw, hc);
  }
  if (o.tray) { fr(8, 0, z0 + 2, 4, 6.5, 0.6, C3.white); fr(8, -2.5, z0 + 3, 1.5, 1.5, 0.6, FOOD[0]); fr(8, 2.5, z0 + 3, 1.5, 1.5, 0.6, FOOD[8]); }
}

/* 차: 공정 단계마다 모양이 바뀐다 */
function car3d(x, y, hz, dir, o, s = 1, z = 8) {
  const B = (fw, lt, hl, hw, z0, h, col) => { const px = x + (hz ? fw * dir : lt) * s, py = y + (hz ? lt : fw * dir) * s, ax = (hz ? hl : hw) * s, ay = (hz ? hw : hl) * s; box(px - ax, py - ay, z0, px + ax, py + ay, z0 + h * s, col, 1, 60); };
  if (o.blank) { B(0, 0, 26, 13, z, 1.5, C3.blank); return; }
  if (o.panel) { B(0, 0, 20, 12, z, 2, C3.blank); if (o.panel > 1) B(0, 0, 13, 8, z + 2 * s, o.panel > 2 ? 5 : 3, C3.panel2); if (o.panel > 3) B(-6, 0, 3, 2, z + 2 * s, o.panel > 2 ? 5.3 : 3.3, C3.hole); return; }
  if (o.parts) { B(-11, 0, 9, 8, z, 2, C3.parts); B(11, 0, 9, 8, z, 2, C3.parts); return; }
  if (o.pan) { B(0, 0, 22, 10, z, 3, C3.steel); if (o.pan > 1) for (const l of [-9, 9]) B(0, l, 20, 1.2, z + 3 * s, 9, C3.steel); return; }
  const fill = typeof o.fill === 'string' ? rgbOf(o.fill) : o.fill;
  if (o.wheels) for (const a of [-13, 13]) for (const b of [-10, 10]) B(a, b, 4, 2.5, z - 2 * s, 7, C3.tire);
  B(0, 0, 22, 11, z + 2 * s, 8, fill);
  B(-2, 0, 12, 9, z + 10 * s, 7, o.glass ? C3.glass : fill);
  if (o.glass) B(-2, 0, 10, 7.5, z + 17 * s, 0.4, fill);
  if (o.gloss) B(15, 0, 4, 7, z + 10 * s, 0.4, mix(fill, 0.35));
  if (o.lamps) for (const l of [-6, 6]) B(21.5, l, 0.8, 2.4, z + 5 * s, 3, C3.lampF);
}
function unitLook(u, shop) {
  const D = DST[shop];
  if (shop === 'press') { if (u.d < D.blank) return { blank: 1 }; return { panel: clamp(1 + Math.floor((u.d - (D.tandem - 210)) / 105), 1, 5) }; }
  if (shop === 'body') { const n = ['floor', 'side', 'main', 'respot', 'hang'].filter(k => u.d > D[k]).length; return n === 0 ? { parts: 1 } : n < 3 ? { pan: n } : { fill: STEEL }; }
  if (shop === 'paint') return { fill: u.d > D.top ? u.c : u.d > D.prim ? '#c7cbce' : u.d > D.ed ? '#5c635d' : u.d > D.pre ? '#aab3bb' : STEEL, gloss: u.d > D.oven + 160 };
  return { fill: u.c, gloss: 1, glass: u.d > D.trim + 200, wheels: u.d > D.chas, lamps: u.d > D.final + 120 };
}
const unitFill = (u, shop) => unitLook(u, shop).fill || '#b4bdc6';
const OPQ = {};
function opq(z) {
  if (OPQ[z]) return OPQ[z]; const o = [[64, 126, 108, 174], [1040, 466, 1084, 514]];
  for (const s of ST[z]) { const x0 = s.x - s.w / 2, y0 = s.y - s.h / 2; if (s.k === 'booth' || s.k === 'oven') o.push([x0 + 8, y0, x0 + s.w - 8, y0 + s.h]); }
  return OPQ[z] = o;
}

/* 방 안 가구와 칸막이: 그리기와 길 찾기에 같이 쓴다 */
function roomParts(s) {
  if (s._rp) return s._rp;
  const x0 = s.x - s.w / 2, y0 = s.y - s.h / 2, x1 = x0 + s.w, y1 = y0 + s.h, walls = [], furn = [], T = 6;
  const seg = (a, b, f) => { if (b - a > 4) f(a, b); };
  seg(x0, s.x - 30, (a, b) => walls.push([a, y0, b, y0 + T])); seg(s.x + 30, x1, (a, b) => walls.push([a, y0, b, y0 + T]));
  seg(y0 + T, s.y - 26, (a, b) => walls.push([x0, a, x0 + T, b])); seg(s.y + 26, y1, (a, b) => walls.push([x0, a, x0 + T, b]));
  if (s.id === 'meet') furn.push([s.x - 60, s.y - 30, s.x + 60, s.y + 6, 'table']);
  else if (s.id === 'cafe') for (let i = 0; i < 3; i++) furn.push([x0 + 24 + i * 50, s.y - 22, x0 + 44 + i * 50, s.y - 6, 'round']);
  else if (s.id === 'mes') for (let i = 0; i < 5; i++) furn.push([x0 + 34 + i * 66, y1 - 56, x0 + 78 + i * 66, y1 - 38, 'desk']);
  else for (let ry = y0 + 48; ry <= y1 - 44; ry += 56) for (const sd of [-1, 1]) for (let c = s.x + sd * 40; c > x0 + 26 && c < x1 - 26; c += sd * 62) furn.push([c - 23, ry - 11, c + 23, ry + 11, s.id === 'lab' ? 'lab' : 'desk']);
  return s._rp = { walls, furn };
}

/* 설비마다 모양 */
function st3d(s, z, run, t, L, SPK) {
  const x0 = s.x - s.w / 2, y0 = s.y - s.h / 2, x1 = x0 + s.w, y1 = y0 + s.h, k = s.k, h = SH(s), M = K.mach, A = K.accent;
  if (k === 'press' || k === 'tandem') {
    const cols = k === 'press' ? [[x0, x1]] : [0, 1, 2, 3].map(i => [x0 + 52 + i * 105 - 34, x0 + 52 + i * 105 + 34]);
    cols.forEach(([a, b], i) => {
      for (const [px, py] of [[a, y0], [b - 12, y0], [a, y1 - 12], [b - 12, y1 - 12]]) box(px, py, 0, px + 12, py + 12, h - 22, M);
      box(a, y0, h - 22, b, y1, h, M); box(a, y1, h - 14, b, y1 + 1, h - 8, A); box(a, y0 - 1, h - 14, b, y0, h - 8, A);
      box(a + 2, y0 + 12, 0, b - 2, y0 + 16, 14, mix(M, -0.15)); box(a + 2, y1 - 16, 0, b - 2, y1 - 12, 14, mix(M, -0.15));
      const ph = run ? Math.abs(Math.sin(t * 2 + i * 0.8)) : 0.2, zz = 24 + 30 * (1 - ph);
      box(a + 12, y0 + 12, zz, b - 12, y1 - 12, zz + 12, mix(M, -0.25)); box(a + 26, y0 + 26, zz + 12, b - 26, y1 - 26, h - 22, mix(M, 0.2));
    });
  } else if (k === 'booth' || k === 'oven') {
    const col = k === 'oven' ? mix(K.warn, -0.25) : mix(K.panel, -0.03);
    box(x0, y0, 0, x1, y1, h, col, 1, 46);
    const zc = h / 2;
    for (const [yy, ny] of [[y1 + 0.5, 1], [y0 - 0.5, -1]]) {
      vqYc(x0 + 6, x1 - 6, yy, zc - 9, zc + 9, mix(K.mach, -0.45), ny, 4);
      if (L) for (const u of L.u) { const p = ptAt(u.d); if (p.x > x0 + 18 && p.x < x1 - 18 && Math.abs(p.y - s.y) < 20) vqY(p.x - 15, p.x + 15, yy + ny * 0.4, zc - 6, zc + 6, rgbOf(unitFill(u, z)), ny, 7); }
      for (let a = x0 + 24; a < x1 - 6; a += 24) vqY(a, a + 1.5, yy, zc + 10, h - 2, mix(col, -0.3), ny, 4);
    }
    for (const [xx, nx] of [[x1 + 0.5, 1], [x0 - 0.5, -1]]) vqX(xx, s.y - 17, s.y + 17, 8, 40, mix(K.mach, -0.55), nx, 4);
    for (let a = x0 + 12; a < x1 - 6; a += 16) plate(a, y0 + 6, a + 2, y1 - 6, h + 0.3, mix(col, -0.25), 3);
    if (k === 'oven') for (let i = 0; i < 3; i++) { const a = x0 + 40 + i * (s.w - 80) / 2; box(a - 6, s.y - 6, h, a + 6, s.y + 6, h + 16, mix(K.mach, -0.1)); }
  } else if (k === 'robots') {
    const n = Math.max(1, Math.round(s.w / 64));
    for (let i = 0; i < n; i++) { const rx = x0 + (i + 0.5) * s.w / n; for (const sd of [-1, 1]) {
      const by = s.y + sd * 46, w = run ? 1 : 0, tx = rx + Math.sin(t * 2.2 + i * 1.7 + sd) * 12 * w, ty = s.y + sd * (13 + 3 * Math.cos(t * 3 + i) * w);
      box(rx - 9, by - 9, 0, rx + 9, by + 9, 8, M);
      const p2 = [rx, by, 30], p3 = [(rx + tx) / 2 + sd * 4, (by + ty) / 2, 50], p4 = [tx, ty, 28];
      beam([rx, by, 8], p2, 9, A); beam(p2, p3, 7, A); beam(p3, p4, 6, A); beam(p4, [tx, ty, 19], 3, C3.tool);
      if (run && z === 'body' && L && L.u.some(u => { const p = ptAt(u.d); return Math.abs(p.x - rx) < 30 && Math.abs(p.y - s.y) < 10; })) SPK.push([tx, ty, 19]);
    } }
  } else if (k === 'gate' || k === 'deck') {
    const pc = k === 'deck' ? mix(A, -0.15) : M, o = run ? 6 * Math.abs(Math.sin(t * 2)) : 0;
    for (const [a, b] of [[x0, y0], [x1 - 12, y0], [x0, y1 - 12], [x1 - 12, y1 - 12]]) box(a, b, 0, a + 12, b + 12, h, pc);
    box(x0, y0, h, x1, y0 + 12, h + 8, pc); box(x0, y1 - 12, h, x1, y1, h + 8, pc); box(x0, y0 + 12, h, x0 + 12, y1 - 12, h + 8, pc); box(x1 - 12, y0 + 12, h, x1, y1 - 12, h + 8, pc);
    for (const a of [x0 + 22, x1 - 34]) { box(a, y0 + 12, h - 22, a + 12, y0 + 22 + o, h - 10, A); box(a, y1 - 22 - o, h - 22, a + 12, y1 - 12, h - 10, A); }
    if (k === 'deck') { const ph = run ? Math.abs(Math.sin(t * 1.5)) : 0; box(s.x - 24, s.y - 22, 0, s.x + 24, s.y - 17, 4 + 5 * ph, A); box(s.x - 24, s.y + 17, 0, s.x + 24, s.y + 22, 4 + 5 * ph, A); }
  } else if (k === 'tunnel') {
    for (const [a, b] of [[x0, y0], [x1 - 8, y0], [x0, y1 - 8], [x1 - 8, y1 - 8]]) box(a, b, 0, a + 8, b + 8, h, M);
    box(x0, y0, h, x1, y1, h + 4, C3.glassW, 0.5, 48);
    for (let a = x0 + 12; a < x1 - 4; a += 18) plate(a, y0 + 6, a + 3, y1 - 6, h + 4.3, C3.light, 2);
  } else if (k === 'manual') {
    const pc = [FOOD[0], C3.blue, FOOD[3], FOOD[1]];
    for (let i = 20, n = 0; i < s.w; i += 58, n++) { const a = x0 + i - 9; box(a, y0 - 16, 0, a + 18, y0 - 4, 16, K.hi); box(a + 2, y0 - 14, 16, a + 16, y0 - 6, 21, pc[n % 4]); }
    if (run && S.zone === 'assy' && Math.random() < 0.012 && !UI.modal) SFX.tool();
  } else if (k === 'bench') {
    box(x0, y0 + 10, 0, x1, y1 - 10, h, K.hi); box(x0 + 18, y0 + 16, h, x1 - 18, y1 - 16, h + 2, C3.blank);
    box(x0 + 8, y0 + 10, h, x0 + 12, y0 + 14, h + 26, M); box(x1 - 12, y0 + 10, h, x1 - 8, y0 + 14, h + 26, M); box(x0 + 8, y0 + 10, h + 26, x1 - 8, y0 + 14, h + 29, C3.light);
  } else if (k === 'rack') {
    box(x0, y0, 0, x1, y1, h, K.hi);
    if (s.id === 'die') for (let i = 0; i * 50 + 46 < s.w; i++) box(x0 + 10 + i * 50, y0 + 10, h, x0 + 46 + i * 50, y1 - 10, h + 22, mix(M, -0.1));
    else if (s.id === 'pstore') for (let i = 0; i * 46 + 44 < s.w; i++) box(x0 + 8 + i * 46, y0 + 8, h, x0 + 44 + i * 46, y1 - 8, h + 6 + (i % 3) * 6, C3.blank);
    else for (let i = 0; i * 26 + 30 < s.w; i++) box(x0 + 8 + i * 26, y0 + 10, h, x0 + 30 + i * 26, y1 - 10, h + 12, [C3.blue, FOOD[0], FOOD[3], C3.red][i % 4]);
  } else if (k === 'coil') {
    box(x0, y0, 0, x1, y1, 6, K.hi);
    for (const c of [x0 + 30, x0 + 78]) { prism(c, s.y, 6, 30, 20, rgbOf('#a9b2bb'), 10); prism(c, s.y, 30, 30.4, 7, mix(M, -0.4), 8); }
    box(x0 + 98, s.y - 12, 6, x0 + 130, s.y + 12, 9, C3.blank);
  } else if (k === 'lot') {
    for (let i = 0; i < 5; i++) if (i < 3 + S.prod.today % 3) car3d(x0 + 20 + i * 32, s.y, false, 1, { fill: COLORS[(i * 3 + 1) % COLORS.length], glass: 1, wheels: 1, lamps: 1, gloss: 1 }, 0.85, 2);
  } else if (k === 'serve') {
    box(x0, y0, 0, x1, y1, h, K.hi, 1, 46);
    for (let i = 0; i < 9; i++) { const a = x0 + 14 + i * 45; plate(a, y0 + 8, a + 34, y1 - 8, h + 0.4, rgbOf('#d9dde0'), 3); prism(a + 17, s.y, h, h + 3, 7, FOOD[i], 8); }
    box(x0 + 4, y1 - 4, h, x1 - 4, y1 - 2, h + 18, C3.glassW, 0.35, 60);
  } else if (k === 'table') {
    const ti = +s.id.slice(1);
    box(x0, y0, 0, x1, y1, h, mix(K.hi, 0.25), 1, 40);
    const tray = (px, py) => { plate(px - 9, py - 6, px + 9, py + 6, h + 0.5, C3.white, 4); plate(px - 6, py - 2.5, px - 1.5, py + 2.5, h + 0.9, FOOD[0], 6); plate(px + 1.5, py - 2.5, px + 6, py + 2.5, h + 0.9, FOOD[8], 6); };
    for (const n of NP) if (n.z === 'canteen' && n.mode === 'eat' && n.table === ti) tray(n.x, clamp(n.y + (n.dir === 's' ? 30 : -30), y0 + 8, y1 - 8));
    if (UI.sit && S.zone === 'canteen' && Math.abs(S.px - s.x) < s.w / 2 + 10 && Math.abs(S.py - s.y) < 60) tray(clamp(S.px, x0 + 10, x1 - 10), y1 - 10);
  } else if (k === 'room') {
    const rp = roomParts(s), tall = s.id === 'mes' ? 56 : 30;
    for (const w of rp.walls) {
      box(w[0], w[1], 0, w[2], w[3], tall, K.line);
      if (s.id === 'mes' && w[1] === y0 && w[0] > x0) for (let q = 0; q < 3; q++) { const a = w[0] + 6 + q * 40; if (a + 34 > w[2]) break; vqY(a, a + 34, w[3] + 0.5, 20, 46, C3.screen, 1, 4); const cc = [K.ok, K.accent, K.bad][(q + Math.floor(t / 3)) % 3], hh = 6 * Math.abs(Math.sin(t + q)); vqY(a + 4, a + 30, w[3] + 0.8, 26 + hh, 29 + hh, cc, 1, 6); }
    }
    for (const [a, b, c, d, kind] of rp.furn) {
      if (kind === 'round') prism((a + c) / 2, (b + d) / 2, 0, 18, 10, K.hi, 10);
      else if (kind === 'table') box(a, b, 0, c, d, 18, mix(K.hi, 0.25));
      else {
        box(a, b, 0, c, d, 18, mix(K.hi, kind === 'lab' ? 0.35 : 0.2), 1, 60);
        if (kind === 'lab') { box(a + 8, b + 6, 18, a + 20, d - 6, 26, rgbOf('#7a8794')); box(c - 18, b + 6, 18, c - 8, d - 6, 23, FOOD[0]); }
        else { box(a + 14, b + 1, 18, c - 14, b + 4, 30, C3.monitor); vqY(a + 16, c - 16, b + 4.4, 20, 28.5, rgbOf('#3f5a74'), 1, 3); plate(a + 6, d - 9, a + 18, d - 3, 18.4, C3.white, 3); }
      }
    }
  } else if (k === 'bldg') {
    const fac = SHOPS.includes(s.id), wc = fac ? mix(K.line, 0.12) : s.id === 'office' ? mix(K.room, 0.05) : mix(K.line, 0.3), top = s.y < 300, d = DOOR[s.id].out, roof = mix(K.mach, fac ? 0.25 : 0.35);
    box(x0, y0, 0, x1, y1, h - 0.1, wc, 1, 50); box(x0, y0, h - 0.1, x1, y1, h, roof, 1, 50);
    const win = (yy, ny) => {
      if (fac) { vqYc(x0 + 10, x1 - 10, yy, h - 34, h - 18, mix(K.room, 0.35), ny, 4); for (let a = x0 + 30; a < x1 - 10; a += 30) vqY(a, a + 1.5, yy + ny * 0.3, h - 34, h - 18, mix(K.mach, -0.2), ny, 6); }
      else for (let r = 0; r < (s.id === 'office' ? 3 : 2); r++) for (let a = x0 + 16; a + 26 < x1 - 8; a += 36) vqY(a, a + 26, yy, 24 + r * 32, 44 + r * 32, (a + r * 7 + Math.floor(t / 6)) % 5 < 1 ? A : mix(K.room, 0.35), ny, 4);
    };
    win(y1 + 0.5, 1); win(y0 - 0.5, -1);
    if (fac) { vqXc(x1 + 0.5, y0 + 10, y1 - 10, h - 34, h - 18, mix(K.room, 0.2), 1, 4); vqXc(x0 - 0.5, y0 + 10, y1 - 10, h - 34, h - 18, mix(K.room, 0.2), -1, 4); for (let a = y0 + 16; a < y1 - 4; a += 18) plate(x0 + 6, a, x1 - 6, a + 2, h + 0.3, mix(K.mach, -0.15), 3); }
    else for (const [a, b] of [[x0 + 30, y0 + 30], [x0 + 80, y0 + 30]]) box(a, b, h, a + 30, b + 24, h + 10, mix(K.mach, 0.1));
    const i = SHOPS.indexOf(s.id); if (i >= 0) { const cls = lineState(i)[0]; prism(x0 + 24, y0 + 24, h, h + 10, 7, cls === 'ok' ? K.ok : cls === 'bad' ? K.bad : K.warn, 8); }
    const dy = top ? y1 : y0, ny = top ? 1 : -1; vqY(d[0] - 18, d[0] + 18, dy + ny * 0.5, 0, 40, mix(K.mach, -0.45), ny, 4); box(d[0] - 24, top ? y1 : y0 - 10, 42, d[0] + 24, top ? y1 + 10 : y0, 45, A);
    if (fac && i < 3) { box(x1, s.y - 12, 58, x1 + 30, s.y + 12, 70, K.conv); if (lineState(i)[0] === 'ok') { const a = x1 + ((t * 18) % 24); box(a, s.y - 6, 70, a + 6, s.y + 6, 73, K.mark); } }
  } else if (k === 'port') {
    const n = Math.min(27, 9 + Math.floor(S.prod.today / 3));
    for (let i = 0; i < n; i++) car3d(x0 + 26 + (i % 9) * 36, y0 + 30 + Math.floor(i / 9) * 30, false, 1, { fill: COLORS[(i * 5 + 2) % COLORS.length], glass: 1, wheels: 1 }, 0.6, 2);
    box(x1 - 160, y1 - 40, -6, x1 - 20, y1 - 12, 10, mix(K.mach, -0.2), 1, 50); box(x1 - 70, y1 - 36, 10, x1 - 36, y1 - 16, 36, K.hi); box(x1 - 150, y1 - 36, 10, x1 - 80, y1 - 16, 18, A);
  }
}

/* 바닥, 벽 */
function walls3d(z, line) {
  const WH = 64, wc = K.line, d = DOOR[z].in, cp = CM.pos, back = d[1] < 100, win = mix(K.room, 0.3);
  const seg = (x0, x1, y0, y1, gx) => { if (gx == null) box(x0, y0, 0, x1, y1, WH, wc, 1, 80); else { box(x0, y0, 0, gx - 30, y1, WH, wc, 1, 80); box(gx + 30, y0, 0, x1, y1, WH, wc, 1, 80); box(gx - 30, y0, 46, gx + 30, y1, WH, wc); } };
  if (cp[1] > 0) { seg(0, W, -8, 0, back ? d[0] : null); for (let a = 40; a + 90 < W; a += 130) if (!back || Math.abs(a + 45 - d[0]) > 80) vqY(a, a + 90, 0.5, 40, 56, win, 1, 4); }
  if (cp[1] < H) seg(0, W, H, H + 8, back ? null : d[0]);
  if (cp[0] > 0) { box(-8, 0, 0, 0, H, WH, wc, 1, 80); for (let a = 40; a + 80 < H; a += 120) vqX(0.5, a, a + 80, 40, 56, win, 1, 4); }
  if (cp[0] < W) box(W, 0, 0, W + 8, H, WH, wc, 1, 80);
  if (!back && cp[1] < H) { box(d[0] - 36, H - 10, 0, d[0] - 30, H, 56, K.mach); box(d[0] + 30, H - 10, 0, d[0] + 36, H, 56, K.mach); box(d[0] - 36, H - 10, 56, d[0] + 36, H, 62, K.accent); }
  if (z === 'canteen' && cp[1] > 0) vqY(760, 1090, 0.6, 6, 50, K.panel, 1, 4);
}
function floor3d(z, line, t) {
  const yard = z === 'yard', fc = yard ? css(mix(K.floor, -0.04)) : P.floor, tile = 40;
  cx.lineWidth = 1;
  for (let x = 0; x < W; x += tile) for (let y = 0; y < H; y += tile) { const s = ground([[x, y, 0], [x + tile, y, 0], [x + tile, y + tile, 0], [x, y + tile, 0]]); if (s) polyS(s, fc, yard ? null : P.grid); }
  if (yard) {
    grect(0, 286, W, 374, css(mix(K.conv, 0.08)));
    for (let a = 0; a < W; a += 28) grect(a, 329, a + 14, 331, P.mark, null, 1, 0.5);
    for (const k of DEST) { const dx = DOOR[k].out[0]; for (let i = 0; i < 6; i++) grect(dx - 16, 292 + i * 14, dx + 16, 299 + i * 14, P.mark, null, 1, 0.6); }
    for (const s of ST.yard) if (s.k === 'port') { const x0 = s.x - s.w / 2, y0 = s.y - s.h / 2, x1 = x0 + s.w, y1 = y0 + s.h; grect(x0, y0, x1, y1 - 46, css(mix(K.conv, 0.25))); grect(x0, y1 - 46, x1, y1, css(C3.water)); for (let i = 0; i < 4; i++) { const a = x0 + 20 + ((t * 10 + i * 80) % (s.w - 40)); gline([[a, y1 - 30 + i * 6, 0.5], [a + 20, y1 - 30 + i * 6, 0.5]], 'rgba(207,224,242,.4)'); } }
  } else {
    const d = DOOR[z].in; if (d[1] < 100) grect(d[0] - 28, 0, d[0] + 28, 28, P.accent); else grect(d[0] - 30, H - 34, d[0] + 30, H, P.accent);
    if (line) { grect(20, 562, W - 20, 592, css(mix(K.ok, 0.6), 0.6)); gline([[20, 562, 0.4], [W - 20, 562, 0.4]], P.accent, 1.5); gline([[20, 592, 0.4], [W - 20, 592, 0.4]], P.accent, 1.5); }
  }
  for (const s of ST[z]) {
    const x0 = s.x - s.w / 2, y0 = s.y - s.h / 2, x1 = x0 + s.w, y1 = y0 + s.h;
    if (s.k === 'robots') { grect(x0 - 6, y0 - 18, x1 + 6, y1 + 18, 'rgba(233,194,26,.16)'); cx.setLineDash([8, 6]); grect(x0 - 6, y0 - 18, x1 + 6, y1 + 18, null, 'rgba(201,160,10,.9)', 1.6, 0.4); cx.setLineDash([]); }
    else if (s.k === 'tunnel') grect(x0, y0, x1, y1, 'rgba(255,246,207,.35)');
    else if (s.k === 'deck') grect(x0 + 10, y0 + 10, x1 - 10, y1 - 10, css(mix(K.accent, 0.5)));
    else if (s.k === 'lot') for (let i = 0; i <= 5; i++) gline([[x0 + 4 + i * 32, y0 + 4, 0.4], [x0 + 4 + i * 32, y1 - 4, 0.4]], P.mark, 1.5);
    else if (s.k === 'room') grect(x0, y0, x1, y1, P.room, css(mix(K.line, -0.15)), 1.2, 0.4);
  }
  // 그림자, 가까운 대상, 걸어갈 길
  for (const n of NP) if (n.z === z) gcirc(n.x, n.y, 9, 'rgba(0,0,0,.16)', null, 1, 10);
  gcirc(S.px, S.py, 9, 'rgba(0,0,0,.18)', null, 1, 10);
  gcirc(S.px, S.py, 14 + Math.sin(t * 4) * 1.5, null, P.accent, 2);
  if (UI.near && (UI.near.k === 'npc' || STMAP[z][UI.near.id])) { const o = UI.near, p = o.k === 'st' ? ipOf(STMAP[z][o.id]) : NP.find(n => n.id === o.id); if (p) { cx.setLineDash([5, 5]); cx.lineDashOffset = -t * 20; gcirc(p.x, p.y, 22, null, P.accent, 2, 24); cx.setLineDash([]); } }
  if (ME.path && ME.path.length) { cx.setLineDash([3, 7]); gline([[S.px, S.py, 0.6], ...ME.path.map(p => [p.x, p.y, 0.6])], css(K.ink, 0.5), 2); cx.setLineDash([]); const e = ME.path[ME.path.length - 1]; gcirc(e.x, e.y, 6 + Math.sin(t * 6), null, P.ink, 1.5, 12); }
}

function label(txt, q, strong, small) {
  const p = proj(q); if (p[2] < 10) return null;
  cx.font = `${strong ? 700 : 600} ${small ? 11 : 12.5}px "IBM Plex Sans KR", system-ui, sans-serif`; const w = cx.measureText(txt).width + 12, x = clamp(p[0], w / 2 + 4, VW - w / 2 - 4), y = p[1];
  if (y < -20 || y > VH + 20) return null;
  cx.globalAlpha = 0.92; rr(x - w / 2, y - 10, w, 20, 5, P.panel, strong ? P.accent : P.line, strong ? 1.5 : 1); cx.globalAlpha = 1;
  cx.fillStyle = P.ink; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, x, y + 1); return [x, y];
}
function diamond(x, y, col) { cx.fillStyle = col; cx.beginPath(); cx.moveTo(x, y + 9); cx.lineTo(x - 7, y); cx.lineTo(x, y - 9); cx.lineTo(x + 7, y); cx.closePath(); cx.fill(); cx.strokeStyle = P.ink; cx.lineWidth = 1; cx.stroke(); }
function banner(txt, bg, fg) { cx.font = '700 15px "IBM Plex Sans KR", sans-serif'; const w = cx.measureText(txt).width + 36; rr(VW / 2 - w / 2, 12, w, 32, 6, bg); cx.fillStyle = fg; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, VW / 2, 29); }

/* 다음에 갈 곳: 급한 연락 > 점심 > 할 수 있는 업무 */
function navTarget() {
  let z, sid;
  if (S.inc && S.inc.mode === 'go') { z = INC[S.inc.id].z; sid = INC[S.inc.id].s; }
  else if (S.lunch && !S.ate) { z = 'canteen'; sid = S.tray ? 't5' : 'serve'; }
  else { const t = S.tasks.find(t => avail(t) && t.to) || S.tasks.find(t => avail(t) && !t.opt) || S.tasks.find(avail); if (!t) return null; z = t.z; sid = t.s; }
  if (S.work || UI.sit) return null;
  if (z === S.zone) { const p = ipOf(STMAP[z][sid]); return { x: p.x, y: p.y, here: true, bad: !!(S.inc && S.inc.mode === 'go') }; }
  const d = S.zone === 'yard' ? DOOR[z].out : DOOR[S.zone].in; return { x: d[0], y: d[1], here: false, name: ZONES[z].n, bad: !!(S.inc && S.inc.mode === 'go') };
}
const AGV = {};
function scenery(z, line, L, run, t) {
  const nt = navTarget(); UI.nav = nt;
  if (z === 'office' && HOMEP) { const x = HOMEP.dx, y = HOMEP.dy; box(x - 9, y - 3, 21, x + 9, y + 1, CAM.fp ? 23 : 28, K.accent); if (!CAM.fp) { box(x - 1, y - 2, 28, x + 1, y, 40, C3.dark); box(x - 1, y - 2.5, 34, x + 9, y + 0.5, 40, K.accent); } }
  if (nt && Math.hypot(nt.x - S.px, nt.y - S.py) > 46 && Math.hypot(nt.x - CM.pos[0], nt.y - CM.pos[1]) > 150) { const c = nt.bad ? K.bad : K.accent, a = 0.2 + 0.1 * Math.sin(t * 4), h = 120; face([[nt.x - 5, nt.y, 0], [nt.x + 5, nt.y, 0], [nt.x + 5, nt.y, h], [nt.x - 5, nt.y, h]], [0, 0, 1], c, a); face([[nt.x, nt.y - 5, 0], [nt.x, nt.y + 5, 0], [nt.x, nt.y + 5, h], [nt.x, nt.y - 5, h]], [0, 0, 1], c, a); gring(nt.x, nt.y, 16 + 3 * Math.sin(t * 4), 2.4, 0.5, c, 20); }
  if (line) {
    // 안돈 등: 초록은 정상, 빨강은 이 공정에서 정지, 노랑은 대기
    for (const s of ST[z]) { if (!SHK[s.k] || ['coil', 'rack', 'bench'].includes(s.k)) continue; const x = s.x - s.w / 2 + 5, y = s.y + s.h / 2 + 5, h = SH(s) + 16, stop = L.stop > 0, col = stop && L.at === s.id ? (Math.sin(t * 9) > 0 ? K.bad : mix(K.bad, -0.4)) : stop || S.lunch ? rgbOf('#e9c21a') : K.ok; beam([x, y, 0], [x, y, h], 1.6, C3.dark); box(x - 2.5, y - 2.5, h, x + 2.5, y + 2.5, h + 6, col); }
    // 부품을 나르는 무인 운반차
    if (AGV[z] == null) { AGV[z] = 1; for (let x = 70; x < W - 60; x += 10) if (!free(z, x, 36) || !free(z, x, 44)) { AGV[z] = 0; break; } }
    if (AGV[z]) { const span = W - 180, u = ((run ? t : UI.agvT || 0) * 26 + SHOPS.indexOf(z) * 300) % (span * 2), x = 90 + (u < span ? u : span * 2 - u), dir = u < span ? 1 : -1; if (run) UI.agvT = t;
      box(x - 11, 33, 2, x + 11, 47, 8, C3.dark); box(x - 9, 35, 8, x + 9, 45, 16, rgbOf('#e9c21a')); box(x + dir * 7 - 1.5, 38.5, 16, x + dir * 7 + 1.5, 41.5, 20, Math.sin(t * 8) > 0 ? K.accent : C3.dark);
      for (let i = 1; i <= 2; i++) { const cx0 = x - dir * (i * 22 + 4); box(cx0 - 9, 34, 2, cx0 + 9, 46, 5, C3.dark); box(cx0 - 8, 35, 5, cx0 + 8, 45, 14, i % 2 ? mix(K.pri, 0.3) : mix(K.mach, 0.2)); } }
    if (z === 'paint' && run && !UI.modal && !S.paused) for (const s of ST[z]) if (s.k === 'oven' && Math.random() < 0.12) puff(s.x + rnd(-s.w / 3, s.w / 3), s.y, SH(s) + 4, mix(K.floor, 0.6));
  }
  if (z === 'yard') {
    // 부품 트럭과 완성차 운반 트럭: 사람이 앞에 있으면 선다
    if (!UI.trk) UI.trk = [{ x: -200, y: 308, d: 1, k: 0 }, { x: 700, y: 308, d: 1, k: 1 }, { x: 1400, y: 352, d: -1, k: 2 }];
    for (const k of UI.trk) {
      const ahead = (S.px - k.x) * k.d, blocked = Math.abs(S.py - k.y) < 22 && ahead > 0 && ahead < 110;
      if (!blocked && !UI.modal && !S.paused) k.x += k.d * (UI.dtReal || 0) * 46; if (k.x > W + 260) k.x = -260; if (k.x < -260) k.x = W + 260;
      if (k.x < -70 || k.x > W + 70) continue;
      const fx = k.x + k.d * 30, bx = k.x - k.d * 18;
      box(Math.min(fx - 10, fx + 10), k.y - 11, 4, Math.max(fx - 10, fx + 10), k.y + 11, 28, k.k === 2 ? C3.blue : C3.white); box(fx + k.d * 6 - 2, k.y - 10, 16, fx + k.d * 6 + 6 * k.d + 2, k.y + 10, 26, C3.dark);
      box(bx - 34, k.y - 11, 6, bx + 34, k.y + 11, k.k === 1 ? 9 : 32, k.k === 1 ? C3.dark : k.k ? mix(K.mach, 0.1) : mix(K.pri, 0.2));
      if (k.k === 1) for (const o of [-17, 17]) car3d(bx + o, k.y, true, k.d, { fill: o < 0 ? '#c9ced6' : '#2b4a7a', gloss: 1, glass: 1, wheels: 1, lamps: 1 }, 0.72, 13);
      for (const o of [-26, 0, 30]) for (const sd of [-10, 10]) prism(k.x + o * k.d, k.y + sd, 0, 5, 4, C3.dark, 6);
    }
  }
  if (S.work && !S.work.inc && !UI.modal && !S.paused && Math.random() < 0.2) burst(S.px + rnd(-8, 8), S.py + rnd(-8, 8), 30, 1, K.accent, 0.4);
}
/* 화면 밖 목적지 화살표와 미니맵 */
function guide(z, t) {
  const nt = UI.nav;
  if (nt && CAM.tdist < 860) {
    const p = proj([nt.x, nt.y, 30]), mg = 46, on = p[2] > 10 && p[0] > mg && p[0] < VW - mg && p[1] > mg && p[1] < VH - mg, dist = Math.hypot(nt.x - S.px, nt.y - S.py);
    if (!on && dist > 60) {
      let dx = p[0] - VW / 2, dy = p[1] - VH / 2; if (p[2] <= 10) { dx = -dx; dy = Math.abs(dy) + VH; }
      const k = Math.min((VW / 2 - mg) / Math.abs(dx || 1), (VH / 2 - mg) / Math.abs(dy || 1)), ax = VW / 2 + dx * k, ay = VH / 2 + dy * k, an = Math.atan2(dy, dx), col = nt.bad ? P.bad : P.accent;
      cx.save(); cx.translate(ax, ay); cx.rotate(an); cx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 5); cx.fillStyle = col; cx.strokeStyle = P.ink; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(16, 0); cx.lineTo(-8, -11); cx.lineTo(-3, 0); cx.lineTo(-8, 11); cx.closePath(); cx.fill(); cx.stroke(); cx.restore(); cx.globalAlpha = 1;
      const txt = (nt.here ? '' : nt.name + ' · ') + Math.round(dist / 10) + 'm'; cx.font = '600 11px "IBM Plex Sans KR", system-ui, sans-serif'; const w = cx.measureText(txt).width + 10, lx = clamp(ax - Math.cos(an) * 30, w / 2 + 4, VW - w / 2 - 4), ly = clamp(ay - Math.sin(an) * 26, 14, VH - 14);
      rr(lx - w / 2, ly - 9, w, 18, 5, P.panel, P.line); cx.fillStyle = P.ink; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, lx, ly + 1);
    }
  }
  // 미니맵
  const mw = VW < 560 ? 112 : 168, k = mw / W, mh = H * k, x0 = 12, y0 = 28, X = x => x0 + x * k, Y = y => y0 + y * k;
  cx.globalAlpha = 0.9; rr(x0 - 3, y0 - 17, mw + 6, mh + 20, 6, P.panel, P.line); cx.globalAlpha = 1;
  cx.fillStyle = P.muted || P.ink; cx.font = '600 10px "IBM Plex Sans KR", system-ui, sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'middle'; cx.fillText(ZONES[z].full, x0 + 2, y0 - 8);
  cx.fillStyle = P.floor; cx.fillRect(x0, y0, mw, mh);
  if (z === 'yard') { cx.fillStyle = P.conv; cx.fillRect(X(0), Y(286), mw, 88 * k); }
  if (ZONES[z].line) { cx.strokeStyle = P.conv; cx.lineWidth = 3; cx.beginPath(); PATH.forEach((p, i) => i ? cx.lineTo(X(p[0]), Y(p[1])) : cx.moveTo(X(p[0]), Y(p[1]))); cx.stroke(); }
  for (const s of ST[z]) { if (s.k === 'table' || s.k === 'lot') continue; cx.fillStyle = s.k === 'room' ? P.room : s.k === 'bldg' ? P.pri : P.mach; cx.globalAlpha = s.k === 'room' ? 0.9 : 0.75; cx.fillRect(X(s.x - s.w / 2), Y(s.y - s.h / 2), Math.max(2, s.w * k), Math.max(2, s.h * k)); }
  cx.globalAlpha = 1; cx.fillStyle = P.ink; for (const n of NP) if (n.z === z) cx.fillRect(X(n.x) - 1, Y(n.y) - 1, 2, 2);
  const dr = z !== 'yard' ? [DOOR[z].in] : DEST.map(d => DOOR[d].out); cx.fillStyle = P.accent; for (const d of dr) cx.fillRect(X(d[0]) - 3, Y(clamp(d[1], 2, H - 2)) - 1.5, 6, 3);
  if (nt) { const px = X(nt.x), py = Y(clamp(nt.y, 4, H - 4)), r = 4 + Math.abs(Math.sin(t * 4)) * 2; cx.fillStyle = nt.bad ? P.bad : P.accent; cx.strokeStyle = P.ink; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(px, py - r); cx.lineTo(px + r, py); cx.lineTo(px, py + r); cx.lineTo(px - r, py); cx.closePath(); cx.fill(); cx.stroke(); }
  const vy = CAM.yaw + Math.PI, mx = X(S.px), my = Y(S.py); cx.fillStyle = P.pri; cx.globalAlpha = 0.25; cx.beginPath(); cx.moveTo(mx, my); cx.arc(mx, my, 20, vy - 0.5, vy + 0.5); cx.closePath(); cx.fill(); cx.globalAlpha = 1;
  circ(mx, my, 3.5, P.pri, P.panel);
}
function draw() {
  const z = S.zone, line = ZONES[z].line, L = line ? LN[SHOPS.indexOf(z)] : null, run = L ? L.stop <= 0 && !S.paused && !UI.modal && !S.lunch : true, t = UI.t;
  const shk = CAM.shake > 0 ? Math.sin(t * 90) * CAM.shake : 0, fp = CAM.fp && CAM.tdist < 860;
  if (fp) { const cp = Math.cos(CAM.pitch), ez = (UI.sit ? 33 : 39) + shk + (ME.mv ? Math.abs(Math.sin(t * 12)) * 0.8 : 0);   // 눈높이에서 본다
    CM = makeCam(S.px - 8 * cp * Math.cos(CAM.yaw), S.py - 8 * cp * Math.sin(CAM.yaw), ez - 8 * Math.sin(CAM.pitch), CAM.yaw, CAM.pitch, 8, VW, VH); CM.foc *= 0.6; }
  else CM = makeCam(CAM.tx, CAM.ty, CAM.tz + shk, CAM.yaw, CAM.pitch, CAM.dist, VW, VH);
  const useGL = GLR.ok; cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (useGL) cx.clearRect(0, 0, VW, VH); else { cx.fillStyle = P.bg; cx.fillRect(0, 0, VW, VH); floor3d(z, line, t); }
  F = []; const SPK = [];
  const fixed = () => {
    if (useGL) floorGL(z, line, t, false);
    if (z !== 'yard') walls3d(z, line); else for (const [a, b] of TREES) { prism(a, b, 0, 14, 3, C3.trunk, 6); prism(a, b, 14, 34, 12, C3.leaf, 8, mix(C3.leaf, 0.15)); prism(a, b, 34, 42, 7, mix(C3.leaf, 0.1), 8); }
    if (line) { for (const g of SEG) box(Math.min(g.x1, g.x2) - 18, Math.min(g.y1, g.y2) - 18, 0, Math.max(g.x1, g.x2) + 18, Math.max(g.y1, g.y2) + 18, 6, K.conv, 1, 40);
      box(64, 126, 0, 108, 174, 34, K.mach); box(1040, 466, 0, 1084, 514, 34, K.mach); vqY(68, 104, 174.5, 24, 30, K.accent, 1); vqY(1044, 1080, 514.5, 24, 30, K.accent, 1); }
  };
  if (useGL) { const cp = CM.pos; glStatic(`${z}|${P.bg}|${P.floor}|${P.accent}|${(cp[1] > 0) + (cp[1] < H) * 2 + (cp[0] > 0) * 4 + (cp[0] < W) * 8}`, fixed); floorGL(z, line, t, true); } else fixed();
  scenery(z, line, L, run, t);
  if (line) {
    const ob = opq(z); for (const u of L.u) { const p = ptAt(u.d); if (ob.some(b => p.x > b[0] && p.x < b[2] && p.y > b[1] && p.y < b[3])) continue; const hz = Math.abs(Math.cos(p.a)) > 0.5; car3d(p.x, p.y, hz, hz ? Math.sign(Math.cos(p.a)) : Math.sign(Math.sin(p.a)), unitLook(u, z)); }
  }
  for (const s of ST[z]) st3d(s, z, run, t, L, SPK);
  if (line && !S.lunch) for (const s of ST[z]) {
    if (s.k === 'manual') for (let i = 20, k = 0; i < s.w; i += 58, k++) { const x0 = s.x - s.w / 2; person3d({ x: x0 + i + 24, y: s.y - 30, L: [k % 3, (k * 3) % 7, k % 2, 0, 0], c: 0, ry: Math.PI / 2 }, { lod: 1, work: run }); person3d({ x: x0 + i, y: s.y + 30, L: [(k + 1) % 3, (k * 5 + 1) % 7, (k + 1) % 3, 0, 0], c: 0, ry: -Math.PI / 2 }, { lod: 1, work: run }); }
    else if (s.k === 'bench') person3d({ x: s.x + 30, y: s.y + 40, L: [1, 0, 0, 0, 0], c: 0, ry: -Math.PI / 2 }, { work: run });
  }
  for (const n of NP) if (n.z === z) { if (n.mv || n.ry == null || n.mode === 'eat') n.ry = YAW[n.dir] ?? Math.PI / 2; person3d(n, { sit: n.mode === 'eat', lod: Q.lv < 2 && Math.hypot(n.x - CM.pos[0], n.y - CM.pos[1]) > (Q.lv ? 620 : 420) }); }
  const tyaw = YAW[ME.dir] ?? Math.PI / 2; if (ME.yaw == null) ME.yaw = tyaw; if (ME.mv || UI.sit) { let dd = tyaw - ME.yaw; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI; ME.yaw += dd * 0.35; }
  if (!fp) person3d({ x: S.px, y: S.py, L: S.look, c: 1, ry: ME.vyaw ?? ME.yaw, mv: ME.mv, me: true }, { tray: S.tray && !UI.sit && z === 'canteen', sit: UI.sit });
  if (z === 'yard' && !fp) { const a = ME.vyaw ?? ME.yaw, c = Math.cos(a), s = Math.sin(a); for (const f of [-13, 13]) prism(S.px + c * f, S.py + s * f, 0, 1, 6, C3.dark, 8); beam([S.px - c * 13, S.py - s * 13, 4], [S.px + c * 13, S.py + s * 13, 4], 1.6, C3.dark); }
  if (useGL) { const fol = CAM.dist < 860; glRender(fol ? 320 : 1300, fol ? 1400 : 2900); } else paintFaces();
  for (const q of SPK) if (Math.random() < 0.6) { const p = proj(q); if (p[2] < 10) continue; const k = CM.foc / p[2]; cx.strokeStyle = Math.random() < 0.5 ? '#fff3b0' : P.warn; cx.lineWidth = 1.3; cx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.random() * 7, l = (4 + Math.random() * 10) * k; cx.moveTo(p[0], p[1]); cx.lineTo(p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l * 0.8); } cx.stroke(); if (Math.random() < 0.04 && !UI.modal) SFX.weld(); }
  overlay(z, L, t); fxDraw(); guide(z, t);
  if (line && S.lunch) banner('점심시간 · 라인 휴식 · 13:00 재가동', P.ink, P.floor);
  else if (L && L.stop > 0) { cx.strokeStyle = P.bad; cx.lineWidth = 8; cx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4); cx.strokeRect(4, 4, VW - 8, VH - 8); cx.globalAlpha = 1; banner(`라인 정지 · ${L.why} · 재가동까지 약 ${Math.ceil(L.stop)}분`, P.bad, '#fff'); }
  if (S.paused && !UI.modal) { cx.font = '400 28px "Do Hyeon", sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'top'; cx.fillStyle = P.ink; cx.globalAlpha = 0.7; cx.fillText('일시정지', (VW < 560 ? 112 : 168) + 28, 12); cx.globalAlpha = 1; }
  if (UI.fade > 0) { cx.globalAlpha = UI.fade; cx.fillStyle = P.bg; cx.fillRect(0, 0, VW, VH); cx.globalAlpha = 1; }
}
function overlay(z, L, t) {
  const fl = [];
  if (L && L.stop > 0 && L.at) fl.push(L.at); if (UI.flash && UI.flash.z === z) fl.push(UI.flash.s); if (S.inc && S.inc.mode === 'go' && INC[S.inc.id].z === z) fl.push(INC[S.inc.id].s);
  for (const id of fl) { const s = STMAP[z][id]; if (!s) continue; const hp = hitPoly(s); if (!hp.length) continue; cx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 5)); polyS(hp, null, null); cx.strokeStyle = P.bad; cx.lineWidth = 3.5; cx.stroke(); cx.globalAlpha = 1; }
  const far = CAM.dist < 860 ? 620 : 1e9;
  for (const s of ST[z]) { if (s.k === 'table') continue; const ti = taskAt(z, s.id), inc = incAt(z, s.id); if (!(ti >= 0 || inc) && proj(labelPt(s))[2] > far) continue; const at = label(HOMEP && s === HOMEP.st ? '내 자리 · ' + s.n : s.n, labelPt(s), ti >= 0 || inc); if (at && (ti >= 0 || inc)) diamond(at[0], at[1] - 24 - 4 * Math.abs(Math.sin(t * 3)), inc ? P.bad : P.accent); }
  if (ZONES[z].line) { const i = SHOPS.indexOf(z); label(i ? `${ZONES[SHOPS[i - 1]].n}에서 넘어옴` : '코일 입고', [86, 150, 48], false, true); label(i < 3 ? `${ZONES[SHOPS[i + 1]].n}으로 넘어감` : '출고장으로', [1062, 490, 48], false, true); }
  if (DOOR[z] && Math.hypot(S.px - DOOR[z].in[0], S.py - DOOR[z].in[1]) > 120) { const d = DOOR[z].in; label('출입구', [d[0], d[1], d[1] < 100 ? 54 : 70], false, true); }
  if (z === 'canteen') { label(`오늘의 메뉴 · ${menuOf()}`, [925, 0, 40], false, true); }
  if (z === 'yard') for (const s of ST.yard) { if (s.k !== 'bldg') continue; const inc = S.inc && S.inc.mode === 'go' && INC[S.inc.id].z === s.id; if (inc || S.tasks.some(tk => avail(tk) && tk.z === s.id)) { const d = DOOR[s.id].out, p = proj([d[0], d[1], 62]); if (p[2] > 10) diamond(p[0], p[1] + 3 * Math.sin(t * 3), inc ? P.bad : P.accent); } }
  for (const n of NP) if (n.z === z && ((z !== 'canteen' && Math.hypot(n.x - S.px, n.y - S.py) < 90) || (UI.near && UI.near.k === 'npc' && UI.near.id === n.id))) label(n.n + ' · ' + n.r, [n.x, n.y, 60]);
  cx.font = '500 12px "IBM Plex Sans KR", system-ui, sans-serif';
  for (const n of NP) if (n.z === z && n.sayT > 0 && !(UI.near && UI.near.id === n.id)) { const p = proj([n.x, n.y, 54]); if (p[2] < 10) continue; const w = cx.measureText(n.say).width + 14, bx = clamp(p[0], w / 2 + 4, VW - w / 2 - 4); cx.globalAlpha = Math.min(1, n.sayT * 2); rr(bx - w / 2, p[1] - 22, w, 20, 9, P.panel, P.line); cx.fillStyle = P.panel; cx.beginPath(); cx.moveTo(p[0] - 4, p[1] - 3); cx.lineTo(p[0], p[1] + 3); cx.lineTo(p[0] + 4, p[1] - 3); cx.fill(); cx.fillStyle = P.ink; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(n.say, bx, p[1] - 11); cx.globalAlpha = 1; }
  const m = CAM.fp ? [VW / 2, VH * 0.78, 100] : proj([S.px, S.py, 56]);
  if (m[2] > 10) {
    if (UI.spark) { const by = m[1] - 16 - 4 * Math.abs(Math.sin(t * 8)); circ(m[0], by, 11, P.accent, P.ink); cx.fillStyle = '#1b1400'; cx.font = '700 16px "IBM Plex Sans KR", sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('!', m[0], by + 1); }
    if (S.work) { const pc = S.work.inc ? 1 - S.work.left / 4 : 1 - S.tasks[S.work.i].left / S.tasks[S.work.i].m; rr(m[0] - 30, m[1] - 6, 60, 8, 4, P.panel, P.ink); rr(m[0] - 29, m[1] - 5, 58 * clamp(pc, 0, 1), 6, 3, S.work.inc ? P.bad : P.accent); }
  }
}
/* 화면 좌표 → 바닥 좌표 */
function toFloor(sx, sy) { const a = (sx - CM.vw / 2) / CM.foc, b = -(sy - CM.vh / 2) / CM.foc, d = [CM.f[0] + CM.r[0] * a + CM.u[0] * b, CM.f[1] + CM.r[1] * a + CM.u[1] * b, CM.f[2] + CM.r[2] * a + CM.u[2] * b]; if (d[2] >= -1e-4) return null; const k = -CM.pos[2] / d[2]; return [CM.pos[0] + d[0] * k, CM.pos[1] + d[1] * k]; }
/* 캐릭터 꾸미기 미리보기: 같은 3D 인형을 돌려 보여 준다 */
function previewPerson(ctx, look, t) {
  const real = cx, rc = CM, w = ctx.canvas.width, h = ctx.canvas.height; cx = ctx;
  CM = makeCam(0, 0, 25, Math.PI / 2 + 0.5, 0.3, 100, w, h); CM.foc = h * 1.9;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
  F = []; person3d({ x: 0, y: 0, L: look, c: 1, ry: Math.PI / 2 + Math.sin(t * 0.8) * 1.1, mv: false, me: true }); paintFaces();
  cx = real; CM = rc;
}

/* ---------- 프레임 ---------- */
function arrive() { if (UI.auto) { const a = UI.auto; UI.auto = null; if (a.k === 'st' && a.z && a.z !== S.zone) return; interact(a); } }
function updatePlayer(dtg) {
  ME.mv = false; let dist = dtg * WALK * (S.zone === 'yard' ? 1.7 : 1) * (S.fit === S.day ? 1.2 : 1);
  const kx = (UI.keys.d ? 1 : 0) - (UI.keys.a ? 1 : 0), ky = (UI.keys.w ? 1 : 0) - (UI.keys.s ? 1 : 0);
  let vx = 0, vy = 0;
  if (kx || ky) { const fl = Math.hypot(CM.f[0], CM.f[1]) || 1; vx = CM.f[0] / fl * ky + CM.r[0] * kx; vy = CM.f[1] / fl * ky + CM.r[1] * kx; }   // 화면 기준: W는 화면 안쪽
  if (vx || vy) {
    ME.trip = null; ME.path = null; UI.auto = null; UI.sit = false; if (S.work) { S.work = null; renderTasks(); }
    const l = Math.hypot(vx, vy); vx /= l; vy /= l; ME.vyaw = Math.atan2(vy, vx); ME.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'e' : 'w') : (vy > 0 ? 's' : 'n'); ME.mv = true;
    let d2 = dist; while (d2 > 0) { const s = Math.min(4, d2); d2 -= s; if (free(S.zone, S.px + vx * s, S.py)) S.px += vx * s; if (free(S.zone, S.px, S.py + vy * s)) S.py += vy * s; }
    // 출입구에 닿으면 건물을 드나든다
    const doors = S.zone === 'yard' ? DEST.map(k => [k, DOOR[k].out]) : [[S.zone, DOOR[S.zone].in]]; let nearDoor = false;
    for (const [k, d] of doors) { const dd = Math.hypot(d[0] - S.px, d[1] - S.py); if (dd < 30) nearDoor = true; if (dd < 14 && !UI.doorLock) { if (S.zone === 'yard') { ME.z = k; S.px = DOOR[k].in[0]; S.py = DOOR[k].in[1]; } else { ME.z = 'yard'; S.px = DOOR[k].out[0]; S.py = DOOR[k].out[1]; } nearDoor = true; break; } }
    if (!nearDoor) UI.doorLock = false;
  } else if (ME.trip) {
    ME.vyaw = null;
    if (UI.auto && UI.auto.k === 'npc') {
      const n = NP.find(n => n.id === UI.auto.id);
      if (!n || (n.z !== S.zone && n.z !== ME.trip.z && n.z !== 'yard')) UI.auto = null;
      else if (n.z !== S.zone) { if (n.z !== ME.trip.z && n.z !== 'yard') { ME.trip = { z: n.z, x: n.x, y: n.y + 20 }; ME.path = null; } }
      else if (Math.hypot(n.x - S.px, n.y - S.py) < 34) { ME.trip = null; ME.path = null; arrive(); return; }
      else if (ME.trip.z === S.zone && Math.hypot(n.x - ME.trip.x, n.y + 20 - ME.trip.y) > 44) { const p = snap(S.zone, n.x, n.y + 20); ME.trip = { z: S.zone, x: p.x, y: p.y }; ME.path = null; }
    }
    if (ME.trip && travel(ME, dist)) arrive();
  }
  if (ME.mv) { UI.stepT -= dist; if (UI.stepT <= 0) { UI.stepT = 30; SFX.step(); } }
}
function updateNpcs(dtg) {
  for (const n of NP) {
    n.mv = false;
    if (n.mode === 'trip') { if (travel(n, dtg * NWALK)) { n.mode = n.then; n.t = S.min; if (n.mode === 'eat') n.dir = n.seat.d; if (n.mode === 'idle') { n.dir = 's'; n.wait = rnd(4, 14); } } }
    else if (n.mode === 'wait') { if (S.min >= n.t) { n.trip = { z: 'canteen', x: n.q.x, y: n.q.y }; n.then = 'queue'; n.mode = 'trip'; n.path = null; } }
    else if (n.mode === 'queue') { n.dir = 'n'; if (S.min >= n.t + 3) { n.trip = { z: 'canteen', x: n.seat.x, y: n.seat.y }; n.then = 'eat'; n.mode = 'trip'; n.path = null; } }
    else if (n.mode === 'eat') { if (S.min >= n.leave) { n.trip = { z: n.hz, x: n.hx, y: n.hy }; n.then = 'idle'; n.mode = 'trip'; n.path = null; n.table = null; } }
    else if (n.mode === 'guide') { n.dir = 's'; }
    else {
      const L = ZONES[n.z].line ? LN[SHOPS.indexOf(n.z)] : null; n.wait -= dtg;
      if (n.j === 'mt' && L && L.stop > 0 && L.at) { if (n.disp !== L.at) { n.disp = L.at; const p = ipOf(STMAP[n.z][L.at]); n.path = findPath(n.z, n.x, n.y, p.x + 28, p.y); } follow(n, dtg * NWALK * 0.7); }
      else {
        if (n.disp) { n.disp = null; n.path = findPath(n.z, n.x, n.y, n.hx, n.hy); }
        if (n.wait <= 0) { n.wait = rnd(8, 26); const p = snap(n.z, n.hx + rnd(-55, 55), n.hy + rnd(-26, 26)); if (los(n.z, n, p)) n.path = [p]; }
        if (n.path) follow(n, dtg * NSTROLL);
      }
    }
  }
}
function update(dt) {
  camUpdate(dt); fxTick(dt); UI.dtReal = dt;
  UI.t += dt; if (UI.fade > 0) UI.fade = Math.max(0, UI.fade - dt * 3);
  if (UI.toastT > 0) { UI.toastT -= dt; if (UI.toastT <= 0) $('#toast').className = 'toast'; }
  const live = !UI.modal && !S.paused;
  if (live) {
    if (UI.spark && (UI.t > UI.spark.until || !S.work || S.work.i !== UI.spark.i)) UI.spark = null;
    const ff = S.work && !S.work.inc && !UI.spark ? 3 : 1, dtg = dt * (S.lunch ? 1.25 : 2.5) * S.speed * ff;   // 업무 중에는 시간이 빨리 간다
    let barks = 0; for (const n of NP) { if (n.sayT > 0) { n.sayT -= dt; if (n.z === S.zone) barks++; } }
    if (barks < 2 && Math.random() < dt * 0.5) { const c = NP.filter(n => n.z === S.zone && !(n.sayT > 0)); if (c.length) { const n = pick(c); n.say = pick(n.mode === 'eat' ? BARKS.eat : n.mode !== 'idle' && S.lunch ? BARKS.go : n.peer ? BARKS.peer : BARKS[n.c]); n.sayT = 2.8; } }
    for (let left = dtg; left > 0 && !UI.modal; left -= 1) { const s = Math.min(1, left); updatePlayer(s); updateNpcs(s); }
    if (UI.keys.w || UI.keys.a || UI.keys.s || UI.keys.d) UI.autoT = 2.5;
    else if (S.auto && !UI.modal && !ME.trip && !S.work && !UI.sit) { UI.autoT -= dt; if (UI.autoT <= 0) { UI.autoT = 0.7; autoStep(); } }
    let best = null, bd = 56;
    for (const s of ST[S.zone]) { const p = ipOf(s), d = Math.hypot(p.x - S.px, p.y - S.py); if (d < bd) { bd = d; best = { k: 'st', id: s.id }; } }
    for (const n of NP) if (n.z === S.zone) { const d = Math.hypot(n.x - S.px, n.y - S.py) - 10; if (d < bd) { bd = d; best = { k: 'npc', id: n.id }; } }
    UI.near = best;
    if (UI.cardAt && Math.hypot(UI.cardAt.x - S.px, UI.cardAt.y - S.py) > 110) hideCard();
    if (S.zone === 'press' && LN[0].stop <= 0 && !S.lunch) { const b = Math.floor(UI.t * 2 / Math.PI); if (b !== UI.pressBeat) { UI.pressBeat = b; SFX.press(); const tn = STMAP.press.tandem; if (tn) { const dd = Math.hypot(tn.x - S.px, tn.y - S.py); if (dd < 360) shake(1.4 * (1 - dd / 360)); for (let i = 0; i < 4; i++) burst(tn.x - tn.w / 2 + 40 + i * (tn.w - 80) / 3, tn.y + tn.h / 2 + 4, 4, 3, mix(K.floor, -0.25), 0.5); } } }
    if (!UI.modal) advance(dtg);
    if (UI.flash && S.min > UI.flash.until) UI.flash = null;
  }
  const pr = $('#prompt');
  if (S.work && UI.spark) { pr.hidden = false; pr.innerHTML = '<kbd>E</kbd> 지금! 뭔가 눈에 띈다'; }
  else if (S.work) { pr.hidden = false; pr.innerHTML = S.work.inc && S.inc ? `급한 연락 처리 중: ${INC[S.inc.id].t}` : S.work.inc ? '' : `업무 중: ${S.tasks[S.work.i].t} · 남은 시간 ${Math.ceil(S.tasks[S.work.i].left)}분 <span>빨리 감는 중 · 움직이면 중단</span>`; }
  else if (UI.near && !UI.modal && !ME.mv && (UI.near.k === 'npc' || STMAP[S.zone][UI.near.id])) {
    const o = UI.near; let txt;
    if (o.k === 'st') { const s = STMAP[S.zone][o.id], ti = taskAt(S.zone, o.id); txt = s.k === 'bldg' ? `${s.n}으로 들어가기` : incAt(S.zone, o.id) ? `급한 연락 처리: ${INC[S.inc.id].t}` : ti >= 0 ? `업무 시작: ${S.tasks[ti].t}` : s.id === 'cafe' ? '15분 쉬기' : s.k === 'serve' && S.lunch && !S.ate && !S.tray ? '식판 받기' : s.k === 'table' ? '이 식탁에 앉기' : `${s.n} 살펴보기`; }
    else { const n = NP.find(n => n.id === o.id); txt = n ? `${n.n}와 대화` : ''; }
    pr.hidden = false; pr.innerHTML = `<kbd>E</kbd> ${txt}`;
  } else pr.hidden = true;
  UI.hudT -= dt; if (UI.hudT <= 0) { UI.hudT = 0.2; renderHud(); renderZones(); renderAndon(); renderAlerts(); renderPeers(); renderTasks(); renderUnd(); checkAch(); }
}
let last = 0;
function frame(ts) {
  const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
  if (UI.started && S) { qTick(ts - (frame.p || ts)); update(dt); draw(); } else drawTitle(dt);
  frame.p = ts;
  requestAnimationFrame(frame);
}

/* ---------- 타이틀 ---------- */
const tcv = $('#strip'), tcx = tcv.getContext('2d'), lcv = $('#lookCv'), lcx = lcv.getContext('2d');
let tT = 0;
function drawTitle(dt) {
  if ($('#title').hidden) return; tT += dt; UI.t += dt;
  const r = tcv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); if (tcv.width !== Math.round(r.width * dpr)) { tcv.width = Math.round(r.width * dpr); tcv.height = Math.round(72 * dpr); }
  const w = r.width; tcx.setTransform(dpr, 0, 0, dpr, 0, 0); tcx.clearRect(0, 0, w, 72);
  tcx.fillStyle = P.conv; tcx.fillRect(0, 22, w, 34); tcx.strokeStyle = P.mark; tcx.globalAlpha = 0.5; tcx.setLineDash([8, 14]); tcx.lineDashOffset = -tT * 40; tcx.beginPath(); tcx.moveTo(0, 39); tcx.lineTo(w, 39); tcx.stroke(); tcx.setLineDash([]); tcx.globalAlpha = 1;
  const names = ['프레스', '차체', '도장', '의장'];
  tcx.font = '600 12px "IBM Plex Sans KR", sans-serif'; tcx.fillStyle = P.muted; tcx.textAlign = 'center'; names.forEach((n, i) => tcx.fillText(n, w * (i + 0.5) / 4, 14));
  const real = cx; cx = tcx; // car(), rr(), pawn()은 cx에 그리므로 잠시 바꾼다
  const n = Math.ceil(w / 80) + 1;
  for (let i = 0; i < n; i++) { const x = ((i * 80 + tT * 40) % (n * 80)) - 40, f = x / w; tcx.save(); tcx.translate(x, 39);
    if (f < 0.25) rr(-20, -11, 40, 22, f > 0.12 ? 5 : 1, '#b4bdc6', 'rgba(0,0,0,.3)');
    else if (f < 0.5) car({ fill: STEEL, seams: f > 0.4 });
    else if (f < 0.75) car({ fill: f > 0.62 ? COLORS[i % COLORS.length] : '#5c635d', seams: true, gloss: f > 0.7 });
    else car({ fill: COLORS[i % COLORS.length], seams: true, gloss: true, glass: f > 0.8, wheels: f > 0.87, lamps: f > 0.93 });
    tcx.restore(); }
  cx = real;
  if (lcv.width !== 192) { lcv.width = 192; lcv.height = 192; }
  previewPerson(lcx, UI.lookArr, tT);
}
function showTitle() {
  UI.started = false; $('#title').hidden = false; $('#app').setAttribute('aria-hidden', 'true'); setAmb();
  let has = false; try { has = !!localStorage.getItem(SAVE); } catch (e) {}
  $('#bCont').hidden = !has; selectJob(UI.selJob || 'pe'); renderCz();
}
function selectJob(k) {
  UI.selJob = k; document.querySelectorAll('.job').forEach(b => b.setAttribute('aria-pressed', b.dataset.job === k));
  const c = CODEX[k], j = JOBS[k];
  $('#jobDetail').innerHTML = `<p class="eyebrow">${c.div}</p><h3>${c.n}</h3><p>${c.d}</p><dl><dt>하루</dt><dd>${c.day}</dd><dt>근무 장소</dt><dd>${j.where}</dd><dt>이런 일을 합니다</dt><dd>${j.tasks.slice(0, 4).map(t => t[0]).join(' · ')}</dd><dt>맞는 사람</dt><dd>${c.fit}</dd></dl>`;
}
function renderCz() {
  $('#cz').innerHTML = CZ.map((r, i) => `<div><span>${r[0]}</span><button type="button" data-cz="${i}:-1" aria-label="${r[0]} 이전">◀</button><b>${r[1][UI.lookArr[i]]}</b><button type="button" data-cz="${i}:1" aria-label="${r[0]} 다음">▶</button></div>`).join('');
}
function begin(state) {
  initAudio(); S = state; { const h = HOMEJ[S.job] || HOMEJ.pe, p = snap('office', h[1], h[2]); HOMEP = { st: STMAP.office[h[0]], id: h[0], x: p.x, y: p.y, dx: h[1], dy: h[2] - 22 }; } prefill(); UI.started = true; $('#title').hidden = true; $('#app').removeAttribute('aria-hidden'); UI.flash = null; ME.path = null; ME.trip = null; resize();
  if (state._mid) { delete state._mid; if (S.lunch) { S.lunch = false; S.ate = true; S.min = Math.max(S.min, 780); } S.inc = null; if (!GRID[S.zone]) S.zone = 'office'; renderAll(); } else startDay();
  setAmb();
}

/* ---------- 입력 ---------- */
const KEYMAP = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'w', ArrowLeft: 'a', ArrowDown: 's', ArrowRight: 'd' };
function toggleAuto() { if (!S || UI.modal) return; S.auto = !S.auto; UI.autoT = 0; SFX.click(); toast(S.auto ? '자동 진행 켬 · 다음 업무와 점심을 알아서 이어 갑니다. 급한 연락과 눈썰미는 직접 챙겨야 합니다.' : '자동 진행 끔'); renderHud(); }
function setSpeed(v) { if (!S || UI.modal) return; if (v === 0) S.paused = !S.paused; else { S.speed = v; S.paused = false; } SFX.click(); renderHud(); setAmb(); }
const zoneCmd = z => { if (z === 'canteen' && S.lunch && !S.ate) goLunch(); else startTrip(z); };
addEventListener('keydown', e => {
  if (e.target.matches && e.target.matches('input, textarea')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (UI.modal) {
    if (/^Digit[1-9]$/.test(e.code)) { const b = $(`#dlg [data-key="${e.code.slice(5)}"]`); if (b) { e.preventDefault(); b.click(); } }
    else if (e.code === 'Escape' && UI.modal.esc) { e.preventDefault(); UI.modal.on('x'); }
    else if (e.code === 'Enter' && !(document.activeElement && document.activeElement.closest('#dlg') && document.activeElement.tagName === 'BUTTON')) { const b = $('#dlg [data-primary]'); if (b) b.click(); }
    return;
  }
  if (!UI.started) return;
  if (KEYMAP[e.code]) { UI.keys[KEYMAP[e.code]] = true; e.preventDefault(); return; }
  const zi = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(e.code);
  if (zi >= 0) { zoneCmd(DEST[zi]); return; }
  switch (e.code) {
    case 'KeyE': case 'Enter': if (UI.spark) takeSpark(); else if (!$('#card').hidden && !UI.near) hideCard(); else if (UI.near && !S.paused) interact(UI.near); e.preventDefault(); break;
    case 'Space': setSpeed(0); e.preventDefault(); break;
    case 'KeyZ': setSpeed(1); break; case 'KeyX': setSpeed(2); break; case 'KeyC': setSpeed(4); break; case 'KeyV': setSpeed(8); break;
    case 'KeyQ': openMessenger(); break; case 'KeyN': openNotes(); break; case 'Equal': case 'NumpadAdd': zoomBy(1.25); break; case 'BracketLeft': case 'Comma': rotBy(-Math.PI / 8); break; case 'BracketRight': case 'Period': rotBy(Math.PI / 8); break; case 'Home': camReset(); break; case 'KeyP': setFp(!CAM.fp); break; case 'Minus': case 'NumpadSubtract': zoomBy(0.8); break; case 'KeyF': toggleAuto(); break; case 'KeyG': openAch(); break; case 'KeyT': nextTask(); break; case 'KeyR': goInc(); break; case 'KeyJ': openCodex(S.job); break; case 'KeyH': openHelp(); break; case 'KeyM': toggleMute(); break;
    case 'Escape': hideCard(); break;
  }
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) UI.keys[KEYMAP[e.code]] = false; });
addEventListener('blur', () => { UI.keys = {}; });
document.addEventListener('visibilitychange', () => { if (document.hidden && S && UI.started && !S.paused) { S.paused = true; renderHud(); setAmb(); } });
let PD = null;
cv.addEventListener('pointerdown', e => { if (!S || UI.modal) return; PD = { x: e.clientX, y: e.clientY, yaw: CAM.yaw, pitch: CAM.pitch, drag: false }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
cv.addEventListener('pointermove', e => { if (!PD) return; const dx = e.clientX - PD.x, dy = e.clientY - PD.y; if (!PD.drag && Math.hypot(dx, dy) > 6) { PD.drag = true; cv.classList.add('drag'); } if (PD.drag) { CAM.yaw = PD.yaw - dx * 0.008; CAM.pitch = clamp(PD.pitch + dy * 0.006, CAM.fp ? -0.55 : 0.12, CAM.fp ? 1.0 : 1.4); } });
const pEnd = () => { PD = null; cv.classList.remove('drag'); };
cv.addEventListener('pointercancel', pEnd);
cv.addEventListener('pointerup', e => {
  const pd = PD; pEnd(); if (!pd || pd.drag || !S || UI.modal) return;
  initAudio(); if (S.paused) { S.paused = false; renderHud(); }
  if (UI.spark) { takeSpark(); return; }
  const r = cv.getBoundingClientRect(), X = e.clientX - r.left, Y = e.clientY - r.top, z = S.zone;
  let best = null, bd = 1e9;
  for (const n of NP) if (n.z === z) { const a = proj([n.x, n.y, 0]), b = proj([n.x, n.y, 48]); if (a[2] < 10) continue; const hw = Math.max(8, 9 * CM.foc / a[2]); if (Math.abs(X - a[0]) < hw && Y < a[1] + 4 && Y > b[1] - 4 && a[2] < bd) { bd = a[2]; best = n; } }
  if (best) { startTrip(z, best.x, best.y + 20, { k: 'npc', id: best.id }); return; }
  let bs = null; bd = 1e9;
  for (const s of ST[z]) { const hp = hitPoly(s); if (!hp.length || !inPoly(X, Y, hp)) continue; const c = proj([s.x, s.y, SH(s) / 2]), dd = c[2] + (s.k === 'room' ? 2000 : 0); if (dd < bd) { bd = dd; bs = s; } }
  if (bs) { if (bs.k === 'bldg') startTrip(bs.id); else goStation(z, bs.id); return; }
  const f = toFloor(X, Y); if (!f || f[0] < 0 || f[1] < 0 || f[0] > W || f[1] > H) return;
  startTrip(z, f[0], f[1]);
});
cv.addEventListener('wheel', e => { if (!S || !UI.started) return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.closest('#dlg')) { if (t.dataset.act && UI.modal) { SFX.click(); UI.modal.on(t.dataset.act); } return; }
  if (t.dataset.z) zoneCmd(t.dataset.z);
  else if (t.dataset.sp != null) setSpeed(+t.dataset.sp);
  else if (t.dataset.task != null) goTask(+t.dataset.task);
  else if (t.dataset.alert) { t.dataset.alert === 'inc' ? goInc() : goLunch(); }
  else if (t.dataset.codex) openCodex(t.dataset.codex);
  else if (t.dataset.close != null) hideCard();
  else if (t.dataset.job) { SFX.click(); selectJob(t.dataset.job); }
  else if (t.dataset.cz) { const [i, d] = t.dataset.cz.split(':').map(Number), n = CZ[i][1].length; UI.lookArr[i] = (UI.lookArr[i] + d + n) % n; SFX.click(); renderCz(); }
  else if (t.id === 'bRand') { UI.lookArr = CZ.map(r => Math.floor(Math.random() * r[1].length)); renderCz(); }
  else if (t.dataset.th) openMessenger(t.dataset.th);
  else if (t.id === 'bMsg' || t.id === 'bMsg2') openMessenger();
  else if (t.dataset.peer) { const n = NP.find(n => n.id === t.dataset.peer); if (n && !UI.modal) startTrip(n.z === 'yard' ? n.hz : n.z, n.x, n.y + 20, { k: 'npc', id: n.id }); }
  else if (t.id === 'zRotL') rotBy(-Math.PI / 8);
  else if (t.id === 'zRotR') rotBy(Math.PI / 8);
  else if (t.id === 'zHome') camReset();
  else if (t.id === 'zFp') setFp(!CAM.fp);
  else if (t.id === 'zIn') zoomBy(1.25);
  else if (t.id === 'zOut') zoomBy(0.8);
  else if (t.id === 'bNotes' || t.id === 'bNotes2') openNotes();
  else if (t.id === 'bQual') qCycle();
  else if (t.id === 'bAuto') toggleAuto();
  else if (t.id === 'bAch') openAch();
  else if (t.id === 'bCodex') openCodex(S && S.job);
  else if (t.id === 'bHelp') openHelp();
  else if (t.id === 'bMute') { initAudio(); toggleMute(); }
  else if (t.id === 'bNext') nextTask();
  else if (t.id === 'bStart') { const name = ($('#fName').value || '').trim().slice(0, 12) || '신입'; begin(newState(name, UI.selJob, UI.lookArr.slice())); }
  else if (t.id === 'bCont') { try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && JOBS[s.job] && s.peers && s.ach && s.notes) begin(s); } catch (err) { toast('저장된 기록을 읽지 못했습니다.'); } }
});
$('#startForm').addEventListener('submit', e => e.preventDefault());

/* ---------- 시작 ---------- */
$('#jobs').innerHTML = JOBKEYS.map(k => `<button type="button" class="job" data-job="${k}" aria-pressed="false"><small>${CODEX[k].div}</small><b>${CODEX[k].n}</b></button>`).join('');
readPalette(); resize(); qLabel(); if ($('#zFp')) $('#zFp').setAttribute('aria-pressed', CAM.fp);
new ResizeObserver(resize).observe(cv);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readPalette);
new MutationObserver(readPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(readPalette);
const hot = window.claude && window.claude.hot;
try { if (hot && hot.snapshot) hot.snapshot(() => (UI.started && S ? { S: { ...S, _mid: 1, work: null } } : {})); } catch (e) {}
const boot = d => { if (d && d.S && JOBS[d.S.job] && d.S.peers && d.S.ach && d.S.notes && Array.isArray(d.S.look)) { try { begin(d.S); return; } catch (e) {} } showTitle(); };
/* ---------- 디지털 트윈 연결 훅 ----------
   포트폴리오의 실시간 대시보드가 이 객체로 공장 상태(라인·버퍼·생산·비가동)를 읽는다.
   읽기 전용이다. 게임을 업데이트할 때 이 블록은 지우지 말 것. */
window.TWIN = { v: 1, get S() { return S; }, get LN() { return LN; }, lineState, uptime, SHOPS, ZONES, STMAP,
  consts: { V, GAP, BUF, TARGET, DAYS, get PLEN() { return PLEN; } } };
if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
requestAnimationFrame(frame);
})();
