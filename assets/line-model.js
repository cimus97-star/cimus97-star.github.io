/* 헤드리스 라인 모델 — 게임(game.js)의 simLines()를 화면 없이 그대로 옮긴 것.
   같은 상수(V, GAP, PLEN, BUF)와 같은 고장 규칙을 쓴다. 실험은 이 모델로 수천 일을 돌려 본다.
   mode 'game' : 게임과 똑같이 동작 (빈 자리가 생기면 다음 차를 바로 뒤에 붙인다)
   mode 'real' : 실제 컨베이어처럼 빈 행거(빈 자리)가 그대로 흘러간다 */
(function (root) {
  'use strict';
  const PATH = [[90, 150], [1100, 150], [1100, 320], [100, 320], [100, 490], [1060, 490]];
  let PLEN = 0; for (let i = 1; i < PATH.length; i++) PLEN += Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]);
  const GAME = { V: 10, GAP: 64, PLEN, BUF: 4, TARGET: 68, DAY_MIN: 480, BASE_RISK: 0.0005, STOP: [5, 11] };
  const SHOPS = ['press', 'body', 'paint', 'assy'];
  const SHOP_KO = { press: '프레스', body: '차체', paint: '도장', assy: '의장' };

  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* p: { buf, up, failMul:[4], speed:[4], q, days, warm, seed, mode, dt } */
  function run(p) {
    const o = Object.assign({ buf: GAME.BUF, up: 80, failMul: [1, 1, 1, 1], speed: [1, 1, 1, 1], q: 92, days: 20, warm: 0, seed: 1, mode: 'game', dt: 0.8, stopMin: GAME.STOP[0], stopMax: GAME.STOP[1] }, p);
    const R = rng(o.seed), RF = SHOPS.map((k, i) => rng(o.seed * 7919 + i * 104729)), { GAP, V } = GAME, dt = o.dt;   // 공정마다 고장 난수를 따로 써서 조건 비교를 공정하게
    const LN = SHOPS.map(() => ({ u: [], buf: [], stop: 0 }));
    LN.forEach(L => { for (let d = PLEN; d >= 0; d -= GAP) L.u.push({ d }); });
    const upMul = clamp(1 + (80 - o.up) / 20, 0.3, 3);
    const st = SHOPS.map(() => ({ down: 0, blocked: 0, starved: 0, stops: 0 }));
    const daily = []; let shipped = 0, good = 0, dayN = 0;
    const perDay = Math.round(GAME.DAY_MIN / dt), steps = (o.warm + o.days) * perDay;   // dt 0.8분 = 차 간격 64px를 정확히 8걸음에 이동
    for (let step = 1; step <= steps; step++) {
      for (let i = 3; i >= 0; i--) {
        const L = LN[i], S = st[i];
        if (L.stop > 0) { L.stop -= dt; S.down += dt; continue; }
        let blocked = false;
        while (L.u.length && L.u[0].d >= PLEN) {
          if (i === 3) { L.u.shift(); shipped++; if (R() * 100 < o.q) good++; }
          else if (LN[i + 1].buf.length < o.buf) LN[i + 1].buf.push(L.u.shift());
          else { blocked = true; break; }
        }
        if (blocked) S.blocked += dt;
        const v = V * o.speed[i];
        for (let k = 0; k < L.u.length; k++) { const u = L.u[k], max = k === 0 ? PLEN : L.u[k - 1].d - GAP; if (u.d < max) u.d = Math.min(max, u.d + v * dt); }
        const last = L.u[L.u.length - 1];
        if (!last || last.d >= GAP) {
          const d0 = o.mode === 'real' && i > 0 ? 0 : (last ? Math.max(0, last.d - GAP) : 0);   // real: 빈 자리를 당기지 않고 그대로 흘려보냄
          if (i === 0) L.u.push({ d: d0 });
          else if (L.buf.length) { L.buf.shift(); L.u.push({ d: d0 }); }
          else S.starved += dt;   // 들여올 차가 없음 = 앞 공정 대기
        }
        const risk = dt * (o.rate ? o.rate[i] : GAME.BASE_RISK * upMul * o.failMul[i]);
        if (RF[i]() < risk) { L.stop += o.stopMin + RF[i]() * (o.stopMax - o.stopMin); S.stops++; }
      }
      if (step % perDay === 0) {
        dayN++;
        if (dayN > o.warm) daily.push({ shipped, good });
        else st.forEach(s => { s.down = 0; s.blocked = 0; s.starved = 0; s.stops = 0; });
        shipped = 0; good = 0;
      }
    }
    const days = daily.length, plan = days * GAME.DAY_MIN, ideal = GAME.DAY_MIN / (GAP / V);
    const out = daily.reduce((a, d) => a + d.shipped, 0) / days, ok = daily.reduce((a, d) => a + d.good, 0) / days;
    const A = 1 - st.reduce((a, s) => a + s.down, 0) / (4 * plan);
    const Q = out ? ok / out : 0, oee = ok / ideal, P = A && Q ? oee / (A * Q) : 0;
    return {
      out, good: ok, ideal, A, P, Q, oee, hit: daily.filter(d => d.shipped >= GAME.TARGET).length / days,
      shops: st.map((s, i) => ({ k: SHOPS[i], down: s.down / days, blocked: s.blocked / plan, starved: s.starved / plan, stops: s.stops / days })),
      daily: daily.map(d => d.shipped)
    };
  }
  function avg(p, reps) {
    const rs = []; for (let r = 0; r < reps; r++) rs.push(run(Object.assign({}, p, { seed: (p.seed || 1) * 1000 + r + 1 })));
    const m = k => rs.reduce((a, x) => a + x[k], 0) / rs.length;
    const sd = Math.sqrt(rs.reduce((a, x) => a + (x.out - m('out')) ** 2, 0) / Math.max(1, rs.length - 1));
    return { out: m('out'), good: m('good'), ideal: rs[0].ideal, A: m('A'), P: m('P'), Q: m('Q'), oee: m('oee'), hit: m('hit'), sd,
      shops: SHOPS.map((k, i) => ({ k, down: rs.reduce((a, x) => a + x.shops[i].down, 0) / reps, blocked: rs.reduce((a, x) => a + x.shops[i].blocked, 0) / reps, starved: rs.reduce((a, x) => a + x.shops[i].starved, 0) / reps, stops: rs.reduce((a, x) => a + x.shops[i].stops, 0) / reps })) };
  }
  root.LineModel = { GAME, SHOPS, SHOP_KO, run, avg };
  if (typeof module !== 'undefined') module.exports = root.LineModel;
})(typeof window !== 'undefined' ? window : globalThis);
