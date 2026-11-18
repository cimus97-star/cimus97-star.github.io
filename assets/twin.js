/* 디지털 섀도우 브릿지 — 게임(iframe)의 window.TWIN을 읽어 대시보드에 흘려보낸다.
   게임 쪽은 읽기 전용 훅 한 블록만 있으면 되고, 게임 내부가 바뀌어도 이 파일은 그대로 동작한다.
   이벤트 로그 한 줄의 형식은 기존 웹앱(구글 시트 [생산기술] 탭)과 같다:
   날짜 · 설비번호 · 정지사유 · 이상증상 · 조치내용 · 비가동(분) · 처리상태 */
(function (root) {
  'use strict';
  const SHOP_NO = { press: 'LINE-01', body: 'LINE-02', paint: 'LINE-03', assy: 'LINE-04' };
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const runMin = m => Math.max(0, m <= 720 ? m - 480 : m < 780 ? 240 : m - 540);   // 08:00~17:00, 점심 1시간 제외
  const reasonOf = why => /결품|자재|부품 공급|서열/.test(why) ? '자재대기' : /품질|검사|수정|불량|오삽입/.test(why) ? '품질이상' : /금형|팁 교환|노즐|세척/.test(why) ? '금형·공구교체' : '설비고장';

  function create(frame, opt) {
    const on = Object.assign({ snap() {}, event() {}, status() {} }, opt);
    const seen = new WeakSet(), open = {}, events = [], stats = {};
    let state = '', lastMin = null, lastDay = null, dayDone = {}, primed = false, timer = null;
    const shopBy = {};   // '프레스 공장' → 'press'

    function setStatus(s, msg) { if (s !== state) { state = s; on.status(s, msg); } }
    function push(e) { events.unshift(e); if (events.length > 500) events.pop(); on.event(e, events); }

    function tick() {
      let T;
      try { T = frame.contentWindow && frame.contentWindow.TWIN; }
      catch (e) { setStatus('blocked', '게임이 다른 주소에서 열려 있어 읽을 수 없습니다. 같은 사이트(같은 GitHub Pages) 안에 두면 연결됩니다.'); return; }
      if (!T) { setStatus('waiting', '게임을 불러오는 중입니다. 게임에 연결 훅(window.TWIN)이 있어야 합니다.'); return; }
      const S = T.S;
      if (!S || !T.LN || !T.LN.length) { setStatus('title', '게임 첫 화면입니다. 직무를 고르고 출근하면 데이터가 흐르기 시작합니다.'); primed = false; return; }
      setStatus('live', '연결됨');
      if (!Object.keys(shopBy).length) T.SHOPS.forEach(k => { shopBy[T.ZONES[k].full] = k; });
      const K = T.consts;

      // 1) 이벤트: 생산 상황실 메신저(ops)에 올라오는 정지·재가동 알림을 그대로 받아 적는다
      for (const m of S.msgs) {
        if (seen.has(m)) continue; seen.add(m);
        if (!primed || m.th !== 'ops') continue;
        const hit = /^(.+?) 라인 (정지 · (.+)|재가동)$/.exec(m.text); if (!hit) continue;
        const k = shopBy[hit[1]]; if (!k) continue;
        const i = T.SHOPS.indexOf(k), L = T.LN[i];
        if (hit[3]) {
          const st = L.at && T.STMAP[k][L.at] ? L.at : 'line';
          if (open[k]) { open[k].why += ' / ' + hit[3]; continue; }
          open[k] = { day: S.day, t: m.t, shop: k, eq: `${SHOP_NO[k]}-${st.toUpperCase()}`, eqName: L.at && T.STMAP[k][L.at] ? T.STMAP[k][L.at].n : T.ZONES[k].full, why: hit[3] };
          push({ kind: 'stop', day: S.day, t: m.t, shop: k, eq: open[k].eq, eqName: open[k].eqName, why: hit[3], reason: reasonOf(hit[3]), status: '미해결', mins: null });
        } else if (open[k]) {
          const o = open[k]; delete open[k];
          const mins = o.day === S.day ? Math.max(1, toMin(m.t) - toMin(o.t) - (toMin(o.t) < 720 && toMin(m.t) >= 780 ? 60 : 0)) : null;
          const ev = events.find(e => e.kind === 'stop' && e.shop === k && e.status === '미해결');
          if (ev) { ev.status = '해결'; ev.mins = mins; ev.end = m.t; }
          const s = stats[k] || (stats[k] = { stops: 0, down: 0 }); s.stops++; s.down += mins || 0;
          on.event(ev || null, events);
        }
      }
      primed = true;

      // 2) 관측 시간 누적(보정용): 점심·일시정지는 빼고 라인이 돈 게임 시간만 센다
      if (lastDay === S.day && lastMin != null && S.min > lastMin && !S.lunch) stats._run = (stats._run || 0) + Math.min(S.min - lastMin, 30);
      lastDay = S.day; lastMin = S.min;

      // 3) 스냅샷: 지금 이 순간의 공장
      const el = runMin(S.min), ideal = el / (K.GAP / K.V) + 1;   // 첫 차는 08:00에 바로 나오므로 +1대
      const prod = S.prod.today, ftt = S.prod.ftt;
      const A = T.uptime() / 100, Q = prod ? ftt / prod : null, oee = ideal >= 1 ? Math.min(1, ftt / ideal) : null;
      const snap = {
        day: S.day, min: S.min, lunch: S.lunch, paused: S.paused, speed: S.speed, target: S.target,
        prod, ftt, down: S.down, A, Q, oee, P: oee != null && Q ? Math.min(1, oee / (A * Q)) : null, ideal,
        plant: { ...S.plant },
        lines: T.SHOPS.map((k, i) => { const L = T.LN[i], [cls, txt] = T.lineState(i); return { k, name: T.ZONES[k].n, cls, txt, stop: L.stop, why: L.why, buf: L.buf.length, wip: L.u.length, blocked: L.blocked }; }),
        bufMax: K.BUF, takt: K.GAP / K.V
      };
      on.snap(snap);

      // 4) 하루 결산: 17:00이 되면 한 줄 남긴다
      if (S.min >= 1020 && !dayDone[S.day]) { dayDone[S.day] = 1; push({ kind: 'day', day: S.day, t: '17:00', prod, ftt, target: S.target, A, oee }); }
    }

    function start() { if (!timer) timer = setInterval(tick, 150); tick(); }
    function stop() { clearInterval(timer); timer = null; }

    // 관측한 정지 기록으로 공정별 고장 간격(MTBF)과 평균 복구 시간(MTTR)을 추정
    function calibration() {
      const run = stats._run || 0, out = {};
      for (const k of Object.keys(SHOP_NO)) { const s = stats[k] || { stops: 0, down: 0 }; out[k] = { stops: s.stops, mttr: s.stops ? s.down / s.stops : null, mtbf: s.stops ? run / s.stops : null }; }
      return { run, shops: out, total: Object.keys(SHOP_NO).reduce((a, k) => a + ((stats[k] && stats[k].stops) || 0), 0) };
    }

    function rows() {
      return events.filter(e => e.kind === 'stop').slice().reverse().map(e => [`D${e.day} ${e.t}`, e.eq, e.reason, e.why, e.status === '해결' ? `자동 재가동 ${e.end}` : '', e.mins == null ? '' : e.mins, e.status]);
    }
    function csv() {
      const head = ['날짜', '설비번호', '정지사유', '이상증상', '조치내용', '비가동(분)', '처리상태'];
      return [head].concat(rows()).map(r => r.map(c => /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(',')).join('\n');
    }
    // 구글 시트로 보내기: Apps Script 웹앱 주소(doPost)를 넣으면 정지 이력을 시트에 쌓는다
    async function sendToSheet(url) {
      const body = JSON.stringify({ source: 'game', rows: rows() });
      await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
      return rows().length;
    }
    return { start, stop, events, calibration, csv, rows, sendToSheet };
  }
  root.Twin = { create, SHOP_NO };
})(window);
