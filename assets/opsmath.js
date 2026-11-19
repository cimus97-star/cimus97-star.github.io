/* 계획 · 근사 계산 — 선형계획(LP) 병목 증설, Kingman(VUT) 대기시간 근사, Little's Law.
   수업에서 배운 기법만 가져와 이 가상 공장의 숫자(공장별 CT, 가용률, 라인 길이)로 직접 구현했다. */
(function (root) {
  'use strict';
  const SHOPS = ['press', 'body', 'paint', 'assy'];
  const STEP = 0.3;   // 개선 1단위 = 사이클타임 0.3분 단축

  /* 공장별 선택지: j단위 개선 → CT_j = CT − 0.3j (최소 CT 이상), 하루 능력 cap_j = A × 480 ÷ CT_j */
  function levels(inp) {
    return SHOPS.map(k => {
      const ct = inp.ct[k], n = Math.max(0, Math.floor((ct - inp.ctMin[k]) / STEP + 1e-9)), L = [];
      for (let j = 0; j <= n; j++) { const c = Math.round((ct - STEP * j) * 1000) / 1000; L.push({ j, ct: c, cap: inp.A[k] * inp.day / c, cost: inp.cost[k] * j }); }
      return { k, L };
    });
  }

  /* 0-1 펼침 선형화: y[k][j] ∈ {0,1}, Σ_j y[k][j] = 1 이면 "공장 k를 j단위 개선"을 고른 것.
     비선형인 TH ≤ A/(CT − 0.3·add)를 j마다 미리 계산한 상수 cap_j로 바꿔 X ≤ Σ_j cap_j·y[k][j] 라는 선형식이 된다. */
  function buildModel(inp) {
    const lv = levels(inp), m = { optimize: 'obj', opType: 'min', constraints: { short: { min: inp.target }, budget: { max: inp.budget } }, variables: {}, ints: {} };
    m.variables.X = { obj: 0, short: 1 };
    m.variables.s = { obj: inp.penalty, short: 1 };
    for (const { k, L } of lv) {
      m.constraints['one_' + k] = { equal: 1 };
      m.constraints['cap_' + k] = { max: 0 };
      m.variables.X['cap_' + k] = 1;
      for (const v of L) { const name = `y_${k}_${v.j}`; m.variables[name] = { obj: v.cost, budget: v.cost, ['one_' + k]: 1, ['cap_' + k]: -v.cap }; m.ints[name] = 1; }
    }
    return { model: m, lv };
  }
  function decode(lv, pickJ, inp) {
    const shops = lv.map(({ k, L }, i) => ({ k, ...L[pickJ[i]] }));
    const cap = Math.min(...shops.map(s => s.cap)), cost = shops.reduce((a, s) => a + s.cost, 0), X = cap, short = Math.max(0, inp.target - cap);
    return { shops, cap, X, cost, short, obj: cost + inp.penalty * short, bottleneck: shops.reduce((a, s) => s.cap < a.cap ? s : a).k };
  }
  /* LP 풀이: javascript-lp-solver(전역 solver)를 쓰고, 같은 문제를 전수 탐색으로 다시 풀어 검산한다 */
  function solve(inp) {
    const { model, lv } = buildModel(inp), brute = enumerate(lv, inp);
    let lp = null, err = null;
    if (root.solver && root.solver.Solve) {
      try {
        const r = root.solver.Solve(model);
        if (r && r.feasible) {
          const pick = lv.map(({ k, L }) => { let best = 0, bv = -1; L.forEach(v => { const y = r[`y_${k}_${v.j}`] || 0; if (y > bv) { bv = y; best = v.j; } }); return best; });
          lp = decode(lv, pick, inp); lp.raw = r;
        } else err = '해가 없습니다(예산 안에서 가능한 조합 없음)';
      } catch (e) { err = String(e && e.message || e); }
    } else err = 'LP 라이브러리를 불러오지 못했습니다';
    const best = lp || brute;
    return { best, lp, brute, err, model, lv, agree: lp ? Math.abs(lp.obj - brute.obj) < 1e-6 : null, nVars: Object.keys(model.variables).length, nCons: Object.keys(model.constraints).length };
  }
  function enumerate(lv, inp) {
    let best = null; const idx = lv.map(() => 0);
    const rec = d => {
      if (d === lv.length) { const r = decode(lv, idx, inp); if (r.cost <= inp.budget + 1e-9 && (!best || r.obj < best.obj - 1e-9 || (Math.abs(r.obj - best.obj) < 1e-9 && r.cap > best.cap))) best = r; return; }
      for (let j = 0; j < lv[d].L.length; j++) { idx[d] = j; rec(d + 1); }
    };
    rec(0); return best;
  }

  /* Kingman(VUT) 근사: 공장마다 대기 ≈ ((ca² + ce²)/2) · (u/(1−u)) · te, 출발 변동 cd² = u²·ce² + (1−u²)·ca² 를 다음 공장 도착 변동으로 넘긴다.
     te = CT/A (고장을 반영한 실효 처리시간), ce² = c0² + 2·A·(1−A)·MTTR/CT, 이동 시간 = 라인 길이 ÷ 속도 = PLEN·CT/GAP 를 A로 나눈 값.
     컨베이어 칸 맞춤 대기(투입 칸이 올 때까지 평균 CT/2)는 VUT 식에 없는 항이라 따로 더한다. */
  function kingman(inp) {
    const ra = inp.th, c0 = inp.c0sq ?? 0.05; let ca = inp.ca0 ?? 0, lt = 0;
    const rows = SHOPS.map(k => {
      const A = inp.A[k], ct = inp.ct[k], te = ct / A, ce = c0 + 2 * A * (1 - A) * inp.mttr / ct, u = ra * te;
      const wait = u < 1 ? ((ca + ce) / 2) * (u / (1 - u)) * te : Infinity;
      const travel = inp.plen * ct / inp.gap / A, sync = ct / 2;
      const cd = u < 1 ? u * u * ce + (1 - u * u) * ca : ce;
      const row = { k, A, ct, te, ce, ca, u, wait, travel, sync, cd, cap: (inp.buf || 0) * te };
      lt += wait + travel + sync; ca = cd; return row;
    });
    return { rows, lt, wip: ra * lt, th: ra };
  }
  root.OpsMath = { SHOPS, STEP, levels, buildModel, solve, enumerate, kingman };
})(window);
