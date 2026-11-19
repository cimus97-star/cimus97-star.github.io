/* 헤드리스 라인 모델 — 게임(game.js)의 simLines()를 화면 없이 옮긴 것.
   같은 상수(GAP, PLEN, BUF), 같은 공장별 사이클타임(CT), 같은 고장 규칙을 쓴다. 실험은 이 모델로 수백 일을 돌려 본다.
   mode 'real' : 실제 컨베이어 (기본값, 게임 1단계 수정과 같음). 투입 칸이 CT마다 한 번 열리고, 실을 차가 없으면 빈 칸으로 흐른다.
   mode 'game' : 수정 전 게임 규칙. 빈 자리가 생기면 다음 차를 바로 뒤에 당겨 붙인다 (모델 검증 비교용). */
(function (root) {
  'use strict';
  const PATH = [[90, 150], [1100, 150], [1100, 320], [100, 320], [100, 490], [1060, 490]];
  let PLEN = 0; for (let i = 1; i < PATH.length; i++) PLEN += Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]);
  const SHOPS = ['press', 'body', 'paint', 'assy'];
  const SHOP_KO = { press: '프레스', body: '차체', paint: '도장', assy: '의장' };
  const CT = { press: 5.8, body: 6.2, paint: 6.8, assy: 6.4 };   // 게임과 같은 기준 사이클타임(분/대)
  const GAME = { GAP: 64, PLEN, BUF: 4, TARGET: 66, DAY_MIN: 480, BASE_RISK: 0.0005, STOP: [5, 11], CT, V: 10 };
  GAME.ctArr = SHOPS.map(k => CT[k]);
  GAME.ideal = ct => GAME.DAY_MIN / Math.max(...(ct || GAME.ctArr));   // 하루 이론 생산 = 480분 ÷ 병목 CT

  /* 게임의 하루 변동 표(game.js CTV)와 같은 값. 공장마다 절반은 평소 수준(±1%), 나머지는 사정 하나가 생긴다 */
  const VARY = {
    all: [[0.04, 0.08], [-0.05, -0.03], [0.03, 0.06], [-0.04, -0.02], [-0.05, -0.03], [0.05, 0.09], [-0.04, -0.02]],
    press: [[0.04, 0.07], [0.03, 0.05]], body: [[0.02, 0.05], [-0.04, -0.02]],
    paint: [[0.04, 0.08], [-0.05, -0.03], [0.03, 0.06]], assy: [[0.03, 0.06], [-0.04, -0.02], [0.02, 0.05]]
  };
  function varyFactor(k, R) {
    if (R() < 0.5) return 1 + (R() * 0.02 - 0.01);
    const list = VARY.all.concat(VARY[k]), v = list[Math.floor(R() * list.length)];
    return 1 + v[0] + R() * (v[1] - v[0]);
  }
  /* 변동 계수의 기댓값 (공장별): 평균 사이클타임이 기준보다 몇 % 늘어나는지 */
  const varyMean = k => { const list = VARY.all.concat(VARY[k]); return 1 + 0.5 * list.reduce((a, v) => a + (v[0] + v[1]) / 2, 0) / list.length; };

  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* p: { ct:[4] 분/대, buf, up, failMul:[4], rate:[4] 분당 고장 확률, stopMin, stopMax, q, days, warm, seed, mode, dt, vary, release(대/분 | null) }
     release가 있으면 프레스 투입을 그 속도로 제한한다(계획 투입). 없으면 게임처럼 막힐 때까지 밀어 넣는다(push). */
  function run(p) {
    const o = Object.assign({ buf: GAME.BUF, up: 80, failMul: [1, 1, 1, 1], q: 92, days: 20, warm: 0, seed: 1, mode: 'real', dt: 0.4, stopMin: GAME.STOP[0], stopMax: GAME.STOP[1], vary: false, release: null }, p);
    const base = o.ct ? o.ct.slice() : o.speed ? o.speed.map(s => 6.4 / s) : GAME.ctArr.slice();   // 예전 speed 배열도 받는다
    const R = rng(o.seed), RF = SHOPS.map((k, i) => rng(o.seed * 7919 + i * 104729)), RV = rng(o.seed * 31 + 17), { GAP } = GAME, dt = o.dt;
    const LN = SHOPS.map(() => ({ u: [], buf: [], stop: 0, ph: 0 }));
    LN.forEach(L => { for (let d = PLEN; d >= 0; d -= GAP) L.u.push({ d }); L.ph = L.u[L.u.length - 1].d; });
    const upMul = clamp(1 + (80 - o.up) / 20, 0.3, 3);
    const st = SHOPS.map(() => ({ down: 0, blocked: 0, starved: 0, stops: 0, slots: 0, empty: 0 }));
    const bw = [0, 0, 0, 0], bn = [0, 0, 0, 0];   // 버퍼 대기 시간 합과 대수 (i = 들어갈 공장)
    const daily = []; let shipped = 0, good = 0, dayN = 0, t = 0, ltSum = 0, ltN = 0, wipInt = 0, measT = 0, rel = 0;
    const relQ = [];   // 계획 투입: 투입 지시가 나온 시각 (프레스 칸이 열릴 때까지 기다린다)
    const perDay = Math.round(GAME.DAY_MIN / dt), steps = (o.warm + o.days) * perDay;
    let ct = base.slice(); const ctLog = [];
    const newDay = () => { ct = o.vary ? base.map((c, i) => clamp(c * varyFactor(SHOPS[i], RV), 3, 12)) : base.slice(); ctLog.push(ct.slice()); };
    newDay();
    for (let step = 1; step <= steps; step++) {
      t += dt; const meas = dayN >= o.warm;
      if (o.release) { rel += o.release * dt; while (rel >= 1) { rel -= 1; relQ.push(t); } }
      for (let i = 3; i >= 0; i--) {
        const L = LN[i], S = st[i];
        if (L.stop > 0) { L.stop -= dt; S.down += dt; continue; }
        let blocked = false;
        while (L.u.length && L.u[0].d >= PLEN) {
          if (i === 3) { const u = L.u.shift(); shipped++; if (R() * 100 < o.q) good++; if (meas && u.t0 != null) { ltSum += t - u.t0; ltN++; } }
          else if (LN[i + 1].buf.length < o.buf) { const u = L.u.shift(); u.tb = t; LN[i + 1].buf.push(u); }
          else { blocked = true; break; }
        }
        if (blocked) S.blocked += dt;
        const v = GAP / ct[i];
        for (let k = 0; k < L.u.length; k++) { const u = L.u[k], max = k === 0 ? PLEN : L.u[k - 1].d - GAP; if (u.d < max) u.d = Math.min(max, u.d + v * dt); }
        if (o.mode === 'real') {
          L.ph += v * dt;
          while (L.ph >= GAP) {
            L.ph -= GAP; S.slots++;
            const last = L.u[L.u.length - 1], d0 = L.ph;
            if (last && last.d - d0 < GAP - 0.5) { S.empty++; continue; }   // 앞차가 막혀 이번 칸을 못 씀
            if (i === 0) {
              if (!o.release) L.u.push({ d: d0, t0: t });
              else if (relQ.length) L.u.push({ d: d0, t0: relQ.shift() });
              else { S.empty++; S.starved += ct[i]; }
            } else if (L.buf.length) { const u = L.buf.shift(); u.d = d0; if (meas && u.tb != null) { bw[i] += t - u.tb; bn[i]++; } L.u.push(u); }
            else { S.empty++; S.starved += ct[i]; }   // 들여올 차가 없음 = 앞 공정 대기
          }
        } else {
          const last = L.u[L.u.length - 1];
          if (!last || last.d >= GAP) {
            const d0 = last ? Math.max(0, last.d - GAP) : 0;
            if (i === 0) L.u.push({ d: d0, t0: t });
            else if (L.buf.length) { const u = L.buf.shift(); u.d = d0; if (meas && u.tb != null) { bw[i] += t - u.tb; bn[i]++; } L.u.push(u); }
            else S.starved += dt;
          }
        }
        const risk = dt * (o.rate ? o.rate[i] : GAME.BASE_RISK * upMul * o.failMul[i]);
        if (RF[i]() < risk) { L.stop += o.stopMin + RF[i]() * (o.stopMax - o.stopMin); S.stops++; }
      }
      if (meas) { let w = relQ.length; for (const L of LN) w += L.u.length + L.buf.length; wipInt += w * dt; measT += dt; }
      if (step % perDay === 0) {
        dayN++;
        if (dayN > o.warm) daily.push({ shipped, good, ideal: GAME.ideal(ct) });
        else st.forEach(s => { s.down = 0; s.blocked = 0; s.starved = 0; s.stops = 0; s.slots = 0; s.empty = 0; });
        shipped = 0; good = 0; newDay();
      }
    }
    const days = daily.length, plan = days * GAME.DAY_MIN, ideal = GAME.ideal(base);
    const out = daily.reduce((a, d) => a + d.shipped, 0) / days, ok = daily.reduce((a, d) => a + d.good, 0) / days;
    const A = 1 - st.reduce((a, s) => a + s.down, 0) / (4 * plan);
    const Q = out ? ok / out : 0, oee = ok / ideal, P = A && Q ? oee / (A * Q) : 0;
    const target = o.target || GAME.TARGET;
    return {
      out, good: ok, ideal, A, P, Q, oee, hit: daily.filter(d => d.shipped >= target).length / days,
      lt: ltN ? ltSum / ltN : null, wip: measT ? wipInt / measT : null, th: out / GAME.DAY_MIN,
      bufWait: bw.map((s, i) => i && bn[i] ? s / bn[i] : 0),
      shops: st.map((s, i) => ({ k: SHOPS[i], down: s.down / days, blocked: s.blocked / plan, starved: s.starved / plan, stops: s.stops / days })),
      daily: daily.map(d => d.shipped), idealDay: daily.reduce((a, d) => a + d.ideal, 0) / days, ctMean: SHOPS.map((k, i) => ctLog.reduce((a, c) => a + c[i], 0) / ctLog.length)
    };
  }
  const meanSd = xs => { const n = xs.length, m = xs.reduce((a, v) => a + v, 0) / n; return { m, sd: n > 1 ? Math.sqrt(xs.reduce((a, v) => a + (v - m) ** 2, 0) / (n - 1)) : 0 }; };
  function avg(p, reps) {
    const rs = []; for (let r = 0; r < reps; r++) rs.push(run(Object.assign({}, p, { seed: (p.seed || 1) * 1000 + r + 1 })));
    return summarize(rs);
  }
  function summarize(rs) {
    const m = k => rs.reduce((a, x) => a + x[k], 0) / rs.length, reps = rs.length;
    const day = meanSd(rs.flatMap(x => x.daily)), lt = meanSd(rs.map(x => x.lt).filter(v => v != null)), wip = meanSd(rs.map(x => x.wip).filter(v => v != null));
    return { out: m('out'), good: m('good'), ideal: rs[0].ideal, A: m('A'), P: m('P'), Q: m('Q'), oee: m('oee'), hit: m('hit'), sd: meanSd(rs.map(x => x.out)).sd,
      daySd: day.sd, lt: lt.m, ltSd: lt.sd, wip: wip.m, wipSd: wip.sd, th: m('th'), days: rs.reduce((a, x) => a + x.daily.length, 0),
      bufWait: [0, 1, 2, 3].map(i => rs.reduce((a, x) => a + x.bufWait[i], 0) / reps), idealDay: m('idealDay'),
      ctMean: [0, 1, 2, 3].map(i => rs.reduce((a, x) => a + x.ctMean[i], 0) / reps),
      shops: SHOPS.map((k, i) => ({ k, down: rs.reduce((a, x) => a + x.shops[i].down, 0) / reps, blocked: rs.reduce((a, x) => a + x.shops[i].blocked, 0) / reps, starved: rs.reduce((a, x) => a + x.shops[i].starved, 0) / reps, stops: rs.reduce((a, x) => a + x.shops[i].stops, 0) / reps })) };
  }
  root.LineModel = { GAME, SHOPS, SHOP_KO, CT, run, avg, summarize, varyMean, PLEN };
  if (typeof module !== 'undefined') module.exports = root.LineModel;
})(typeof window !== 'undefined' ? window : globalThis);
