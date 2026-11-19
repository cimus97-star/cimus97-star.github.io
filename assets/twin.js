/* 디지털 섀도우 브릿지 — 게임이 보내는 데이터를 대시보드로 흘려보낸다.
   ① v2: 게임이 직접 보내는 메시지(BroadcastChannel 'ulsan-factory-twin', iframe이면 postMessage도). 새 창에서 연 게임도 연결된다.
   ② v1(예비): 메시지가 안 오면 iframe 안의 window.TWIN을 0.15초마다 읽는다.
   이벤트 로그 한 줄의 형식은 기존 웹앱(구글 시트 [생산기술] 탭)과 같다:
   날짜 · 설비번호 · 정지사유 · 이상증상 · 조치내용 · 비가동(분) · 처리상태 */
(function (root) {
  'use strict';
  const SHOP_NO = { press: 'LINE-01', body: 'LINE-02', paint: 'LINE-03', assy: 'LINE-04' };
  const SHOPS = ['press', 'body', 'paint', 'assy'];
  const SHOP_FULL = { press: '프레스 공장', body: '차체 공장', paint: '도장 공장', assy: '의장 공장' };
  const CHANNEL = 'ulsan-factory-twin', SAVE_KEY = 'first-day-ulsan-v5';
  const HOLD_TXT = { 결산: '결산 중', 퀴즈: '퇴근길 퀴즈 중', 저녁: '저녁 시간', 이벤트: '이벤트 처리 중', 점심: '점심 휴식 · 라인 정지', 일시정지: '일시정지' };
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0');
  const runMin = m => Math.max(0, m <= 720 ? m - 480 : m < 780 ? 240 : m - 540);   // 08:00~17:00, 점심 1시간 제외
  const absRun = (day, min) => (day - 1) * 480 + runMin(min);
  const reasonOf = why => /결품|자재|부품 공급|서열|지연|입고/.test(why) ? '자재대기' : /품질|검사|수정|불량|오삽입/.test(why) ? '품질이상' : /금형|팁 교환|노즐|세척/.test(why) ? '금형·공구교체' : '설비고장';
  const downMins = (d0, t0, d1, t1) => d0 === d1 ? Math.max(1, Math.round(t1 - t0 - (t0 < 720 && t1 >= 780 ? 60 : 0))) : null;

  function create(frame, opt) {
    const on = Object.assign({ snap() {}, event() {}, status() {}, history() {} }, opt);
    const seen = new WeakSet(), open = {}, events = [], stats = {}, samples = [], recent = new Map();
    let state = '', lastMin = null, lastDay = null, dayDone = {}, primed = false, timer = null, mode = 'none', lastV2 = 0, lastPost = 0, hist = [], ctInfo = null;
    const shopBy = {};
    for (const k of SHOPS) shopBy[SHOP_FULL[k]] = k;

    let stMsg = '';
    function setStatus(s, msg) { if (s !== state || msg !== stMsg) { state = s; stMsg = msg; on.status(s, msg); } }
    function push(e) { events.unshift(e); if (events.length > 500) events.pop(); on.event(e, events); }
    function TW() { try { return frame.contentWindow && frame.contentWindow.TWIN; } catch (e) { return undefined; } }
    function stName(k, id) { const T = TW(); try { return id && T && T.STMAP[k][id] ? T.STMAP[k][id].n : SHOP_FULL[k]; } catch (e) { return SHOP_FULL[k]; } }
    function plen() { const T = TW(); try { return T && T.consts.PLEN; } catch (e) { return null; } }

    /* ---------- 기록 (정지 · 재가동 · 결산) ---------- */
    function onStop(k, day, min, station, why) {
      if (open[k]) { open[k].why += ' / ' + why; const ev = events.find(e => e.kind === 'stop' && e.shop === k && e.status === '미해결'); if (ev) { ev.why = open[k].why; on.event(ev, events); } return; }
      const st = station || 'line';
      open[k] = { day, t: min, shop: k, why };
      push({ kind: 'stop', day, t: hhmm(min), shop: k, eq: `${SHOP_NO[k]}-${String(st).toUpperCase()}`, eqName: stName(k, station), why, reason: reasonOf(why), status: '미해결', mins: null });
    }
    function onRestart(k, day, min) {
      const o = open[k]; if (!o) return; delete open[k];
      const mins = downMins(o.day, o.t, day, min);
      const ev = events.find(e => e.kind === 'stop' && e.shop === k && e.status === '미해결');
      if (ev) { ev.status = '해결'; ev.mins = mins; ev.end = hhmm(min); }
      const s = stats[k] || (stats[k] = { stops: 0, down: 0 }); s.stops++; s.down += mins || 0;
      on.event(ev || null, events);
    }
    function onDayEnd(row) {
      if (!row || row.day == null) return;
      hist = hist.filter(r => r.day !== row.day).concat(row).sort((a, b) => a.day - b.day); on.history(hist);
      if (!dayDone[row.day]) { dayDone[row.day] = 1; push({ kind: 'day', day: row.day, t: '17:00', prod: row.prod, ftt: row.ftt, target: row.target, A: (row.uptime ?? 100) / 100, oee: dayOee(row) }); }
    }
    function seedHistory() {
      let h = null; const T = TW();
      try { if (T && T.history && T.history.length) h = T.history.slice(); } catch (e) {}
      if (!h) try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && Array.isArray(s.prodHist)) h = s.prodHist; } catch (e) {}
      if (h && h.length) { hist = h.slice().sort((a, b) => a.day - b.day); h.forEach(r => { dayDone[r.day] = 1; }); on.history(hist); }
    }

    /* ---------- 처리량 표본: Little's Law용 ---------- */
    function sample(day, min, total) {
      const r = absRun(day, min), last = samples[samples.length - 1];
      if (last && (r < last.r || total < last.total)) samples.length = 0;   // 새 게임이거나 날짜가 뒤로 감
      if (!last || r > last.r) samples.push({ r, total });
      while (samples.length > 2 && samples[1].r <= r - 60) samples.shift();
      const a = samples[0], span = r - a.r;
      return span >= 15 ? { th: (total - a.total) / span, span } : { th: null, span };
    }

    /* ---------- 스냅샷 → 화면용 ---------- */
    function build(s) {
      const el = runMin(s.min), ideal = el / s.takt + 1;   // 첫 차는 08:00에 바로 나오므로 +1대
      const prod = s.prod.today, ftt = s.prod.ftt, A = s.uptime / 100, Q = prod ? ftt / prod : null, oee = ideal >= 1 ? Math.min(1, ftt / ideal) : null;
      const wip = s.lines.reduce((a, L) => a + L.wip + L.buf, 0), thr = sample(s.day, s.min, s.prod.total);
      const P = plen() || (root.LineModel && root.LineModel.PLEN) || 3310, GAP = 64;
      const travel = s.lines.reduce((a, L) => a + P * (L.ct || s.takt) / GAP, 0), bufWait = s.lines.reduce((a, L, i) => a + (i ? L.buf * (L.ct || s.takt) : 0), 0);
      return {
        day: s.day, min: s.min, lunch: s.lunch, paused: s.paused, speed: s.speed, target: s.target, hold: s.hold || null, holdTxt: s.hold ? HOLD_TXT[s.hold] || s.hold : null,
        prod, ftt, down: s.down, A, Q, oee, P: oee != null && Q ? Math.min(1, oee / (A * Q)) : null, ideal, plant: { ...s.plant },
        lines: s.lines.map(L => ({ k: L.k, name: SHOP_FULL[L.k].replace(' 공장', ''), cls: L.state, txt: L.label, stop: L.stop, why: L.why, buf: L.buf, wip: L.wip, ct: L.ct })),
        bufMax: s.bufMax, takt: s.takt, ct: s.ct, shopDay: s.shopDay,
        little: { wip, th: thr.th, span: thr.span, lt: thr.th ? wip / thr.th : null, ltTheory: travel + bufWait, travel, bufWait }
      };
    }

    /* ---------- ① v2 메시지 ---------- */
    function onMsg(m, via) {
      if (!m || typeof m !== 'object' || m.v !== 2 || !m.type) return;
      const now = Date.now();
      if (via === 'post') lastPost = now;
      else if (now - lastPost < 1500) return;   // iframe 게임은 두 길로 같은 메시지를 보낸다. postMessage 쪽만 쓴다
      if (m.type !== 'snapshot') {   // 두 길 중 먼저 온 것만 받는다 (순서가 바뀌어 와도 기록이 두 번 남지 않게)
        const key = [m.type, m.day, m.min, m.shop || '', m.why || ''].join('|');
        for (const [k, t] of recent) if (now - t > 3000) recent.delete(k);
        if (recent.has(key)) return; recent.set(key, now);
      }
      lastV2 = now;
      if (mode !== 'v2') { mode = 'v2'; seedHistory(); }
      setStatus('live', via === 'post' || now - lastPost < 1500 ? '연결됨 · 아래 게임이 보내는 데이터를 받는 중' : '연결됨 · 다른 창의 게임이 보내는 데이터를 받는 중');
      if (m.type === 'snapshot') {
        if (lastDay === m.day && lastMin != null && m.min > lastMin && !m.lunch) stats._run = (stats._run || 0) + Math.min(m.min - lastMin, 30);
        lastDay = m.day; lastMin = m.min;
        on.snap(build(m));
      } else if (m.type === 'stop') onStop(m.shop, m.day, m.min, m.station, m.why || '사유 미상');
      else if (m.type === 'restart') onRestart(m.shop, m.day, m.min);
      else if (m.type === 'dayEnd') onDayEnd(m);
      else if (m.type === 'dayStart') { if (m.day === 1) { hist = []; dayDone = {}; samples.length = 0; on.history(hist); } ctInfo = { day: m.day, ct: m.ct, why: m.ctWhy, bottleneck: m.bottleneck, target: m.target, news: m.news }; }
    }
    let bc = null;
    try { if (typeof BroadcastChannel === 'function') { bc = new BroadcastChannel(CHANNEL); bc.onmessage = e => onMsg(e.data, 'bc'); } } catch (e) { bc = null; }
    root.addEventListener('message', e => { if (e.origin !== location.origin) return; if (frame && e.source !== frame.contentWindow) return; onMsg(e.data, 'post'); });

    /* ---------- ② v1 예비: window.TWIN 직접 읽기 ---------- */
    function poll() {
      if (Date.now() - lastV2 < 2500) return;   // 메시지가 오는 동안은 쓰지 않는다
      let T;
      try { T = frame.contentWindow && frame.contentWindow.TWIN; }
      catch (e) { setStatus('blocked', '게임이 다른 주소에서 열려 있어 읽을 수 없습니다. 같은 사이트 안에 두면 연결됩니다.'); return; }
      if (!T) { setStatus('waiting', '게임을 불러오는 중입니다.'); return; }
      const S = T.S;
      if (!S || !T.LN || !T.LN.length) { setStatus(mode === 'v2' ? 'idle' : 'title', mode === 'v2' ? '게임 신호가 멈췄습니다. 게임 창이 닫혔거나 첫 화면입니다.' : '게임 첫 화면입니다. 직무를 고르고 출근하면 데이터가 흐르기 시작합니다.'); primed = false; return; }
      if (mode !== 'v1') { mode = 'v1'; seedHistory(); }
      setStatus('live', '연결됨 · 게임 공장을 직접 읽는 중');
      for (const m of S.msgs) {
        if (seen.has(m)) continue; seen.add(m);
        if (!primed || m.th !== 'ops') continue;
        const hit = /^(.+?) 라인 (정지 · (.+)|재가동)$/.exec(m.text); if (!hit) continue;
        const k = shopBy[hit[1]]; if (!k) continue;
        if (hit[3]) onStop(k, S.day, toMin(m.t), T.LN[T.SHOPS.indexOf(k)].at, hit[3]); else onRestart(k, S.day, toMin(m.t));
      }
      primed = true;
      if (lastDay === S.day && lastMin != null && S.min > lastMin && !S.lunch) stats._run = (stats._run || 0) + Math.min(S.min - lastMin, 30);
      lastDay = S.day; lastMin = S.min;
      const K = T.consts, ct = K.ct || null, takt = ct ? Math.max(...Object.values(ct)) : K.GAP / K.V;
      on.snap(build({ day: S.day, min: S.min, lunch: S.lunch, paused: S.paused, speed: S.speed, target: S.target, hold: S.paused ? '일시정지' : null, uptime: T.uptime(), plant: S.plant, down: S.down,
        prod: { today: S.prod.today, ftt: S.prod.ftt, total: S.prod.total }, takt, ct, bufMax: K.BUF, shopDay: S.shopDay,
        lines: T.SHOPS.map((k, i) => { const L = T.LN[i], [cls, txt] = T.lineState(i); return { k, state: cls, label: txt, stop: L.stop, why: L.why, buf: L.buf.length, wip: L.u.length, ct: ct ? ct[k] : takt }; }) }));
      if (T.history) { const h = T.history; if (h.length !== hist.length) { h.forEach(r => onDayEnd(r)); } }
    }

    function start() { if (!timer) timer = setInterval(poll, 150); poll(); }
    function stop() { clearInterval(timer); timer = null; }
    function calibration() {
      const run = stats._run || 0, out = {};
      for (const k of SHOPS) { const s = stats[k] || { stops: 0, down: 0 }; out[k] = { stops: s.stops, mttr: s.stops ? s.down / s.stops : null, mtbf: s.stops ? run / s.stops : null }; }
      return { run, shops: out, total: SHOPS.reduce((a, k) => a + ((stats[k] && stats[k].stops) || 0), 0) };
    }
    function rows() { return events.filter(e => e.kind === 'stop').slice().reverse().map(e => [`D${e.day} ${e.t}`, e.eq, e.reason, e.why, e.status === '해결' ? `자동 재가동 ${e.end}` : '', e.mins == null ? '' : e.mins, e.status]); }
    function csv() {
      const head = ['날짜', '설비번호', '정지사유', '이상증상', '조치내용', '비가동(분)', '처리상태'];
      return [head].concat(rows()).map(r => r.map(c => /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(',')).join('\n');
    }
    async function sendToSheet(url) { const body = JSON.stringify({ source: 'game', rows: rows() }); await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }); return rows().length; }
    return { start, stop, events, calibration, csv, rows, sendToSheet, get history() { return hist; }, get mode() { return mode; }, get ctInfo() { return ctInfo; } };
  }
  /* 하루 OEE = 직행 대수 ÷ 그날 이론 대수(480 ÷ 병목 CT + 1) */
  function dayOee(r) { const ct = r.ct ? Math.max(...Object.values(r.ct)) : 6.8; return Math.min(1, (r.ftt ?? r.prod) / (480 / ct + 1)); }
  root.Twin = { create, SHOP_NO, dayOee, CHANNEL };
})(window);
