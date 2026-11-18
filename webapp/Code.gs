/**
 * 설비 이상·비가동 기록 웹앱 (Google Apps Script) — 개선판
 *
 * 바뀐 점
 *  1. 가동률을 고정값(92.5%) 대신 비가동 시간으로 계산한다.
 *  2. [생산실적] 탭이 있으면 OEE = 가용률 × 성능 × 품질로 계산한다. 없으면 OEE는 비워 둔다(지어내지 않는다).
 *  3. ?api=dashboard 로 열면 JSON을 돌려준다 → GitHub Pages의 포트폴리오에서도 읽을 수 있다.
 *  4. doPost 로 게임(첫 출근 울산공장)의 비가동 이력을 받아 [게임로그] 탭에 쌓는다. 현장 이력과 섞지 않는다.
 *
 * 시트 구성
 *  [생산기술]  날짜 | 설비번호 | 정지사유 | 이상증상·에러코드 | 조치내용 | 비가동(분) | 처리상태
 *  [게임로그]  위와 같은 열 (doPost가 자동으로 만든다)
 *  [생산실적]  날짜 | 라인 | 생산수량 | 양품수량      (선택. 있으면 성능·품질·OEE를 계산)
 */

var CONFIG = {
  FIELD_SHEET: '[생산기술]',
  GAME_SHEET: '[게임로그]',
  PROD_SHEET: '[생산실적]',
  PLANNED_MIN_PER_DAY: 480,   // 라인당 하루 계획 가동시간(분). 08:00~17:00, 점심 1시간 제외
  IDEAL_CYCLE_MIN: 6.4,       // 이론 택트(분/대). 게임과 같은 값
  HEADER: ['날짜', '설비번호', '정지사유', '이상증상·에러코드', '조치내용', '비가동(분)', '처리상태']
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.api === 'dashboard') {
    var src = p.source === 'game' ? CONFIG.GAME_SHEET : CONFIG.FIELD_SHEET;
    return json_(getDashboardData(src));
  }
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('설비 이상 및 생산 현황 대시보드')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// 게임 → 시트. 포트폴리오의 '시트로 보내기' 버튼이 { source: 'game', rows: [[...7열], ...] } 를 보낸다.
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var rows = (body.rows || []).filter(function (r) { return r && r.length === 7; });
    if (!rows.length) return json_({ success: false, message: '보낼 이력이 없습니다.' });
    var sheet = sheet_(CONFIG.GAME_SHEET, true);
    // 같은 시각·설비 이력이 이미 있으면 건너뛴다(버튼을 두 번 눌러도 중복되지 않게)
    var have = {};
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (r) { have[r[0] + '|' + r[1]] = 1; });
    var fresh = rows.filter(function (r) { return !have[r[0] + '|' + r[1]]; });
    if (fresh.length) sheet.getRange(sheet.getLastRow() + 1, 1, fresh.length, 7).setValues(fresh);
    return json_({ success: true, added: fresh.length, skipped: rows.length - fresh.length });
  } catch (err) {
    return json_({ success: false, message: err.message });
  }
}

// 현장 이력 저장 (기존 기능 유지 + 입력 검증)
function saveData(formData) {
  try {
    if (!formData.date || !formData.equipmentNo || !formData.stopReason || !formData.status) {
      throw new Error('필수 항목(날짜, 설비번호, 정지사유, 처리상태)을 확인해 주세요.');
    }
    var sheet = sheet_(CONFIG.FIELD_SHEET, false);
    sheet.appendRow([
      formData.date,
      String(formData.equipmentNo).toUpperCase(),
      formData.stopReason,
      formData.errorCode,
      formData.actionContent,
      Number(formData.downtime) || 0,
      formData.status
    ]);
    sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('yyyy-mm-dd');
    return { success: true, message: formData.date + ' (' + formData.equipmentNo + ') 이력이 저장되었습니다.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// 대시보드 데이터: 이력 + 지표
function getDashboardData(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName || CONFIG.FIELD_SHEET);
  var items = [];
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getDataRange().getValues().slice(1).forEach(function (r) {
      if (!r[0] || !r[1]) return;
      items.push({
        date: r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(r[0]),
        equipmentNo: String(r[1]).toUpperCase(),
        stopReason: r[2], errorCode: r[3], actionContent: r[4],
        downtime: Number(r[5]) || 0,
        status: r[6]
      });
    });
  }
  return { stats: computeStats(items, readProduction_()), items: items.reverse() };
}

/**
 * 지표 계산. 웹앱 화면(데모 모드)도 똑같은 식을 쓴다.
 *  가용률 A = 1 − 비가동 합계 / (라인 수 × 기록 일수 × 하루 계획 가동시간)
 *  성능 P  = (생산수량 × 이론 택트) / 실제 가동시간
 *  품질 Q  = 양품수량 / 생산수량
 *  OEE     = A × P × Q
 */
function computeStats(items, prod) {
  var lineOf = function (eq) { var m = /^(LINE-\d+)/.exec(eq); return m ? m[1] : eq; };
  var days = {}, lines = {}, byLine = {}, byReason = {}, total = 0, unresolved = 0;
  items.forEach(function (it) {
    days[it.date] = 1; var L = lineOf(it.equipmentNo); lines[L] = 1;
    byLine[L] = (byLine[L] || 0) + it.downtime; byReason[it.stopReason] = (byReason[it.stopReason] || 0) + it.downtime;
    total += it.downtime; if (it.status === '미해결') unresolved++;
  });
  var nDays = Object.keys(days).length, nLines = Object.keys(lines).length;
  var planned = nDays * nLines * CONFIG.PLANNED_MIN_PER_DAY;
  var A = planned ? Math.max(0, 1 - total / planned) : null;
  var P = null, Q = null, oee = null, prodCount = null, goodCount = null;
  if (prod && prod.count) {
    prodCount = prod.count; goodCount = prod.good;
    var run = prod.planned * (A == null ? 1 : A);   // 생산실적이 있는 날·라인의 실제 가동시간(계획 × 가용률)
    P = run > 0 ? Math.min(1, prodCount * CONFIG.IDEAL_CYCLE_MIN / run) : null;
    Q = prodCount ? goodCount / prodCount : null;
    oee = A != null && P != null && Q != null ? A * P * Q : null;
  }
  var r1 = function (v) { return v == null ? null : Math.round(v * 1000) / 10; };   // 0.923 → 92.3
  return {
    totalCount: items.length, unresolvedCount: unresolved, totalDowntime: total,
    days: nDays, lines: Object.keys(lines).sort(), plannedMin: planned,
    availability: r1(A), performance: r1(P), quality: r1(Q), oee: r1(oee),
    operatingRate: r1(A), prodCount: prodCount, goodCount: goodCount,
    reworkCount: prodCount == null ? null : prodCount - goodCount,
    qualityRate: r1(Q), defectRate: Q == null ? null : Math.round((1 - Q) * 1000) / 10,
    downtimeByLine: byLine, downtimeByReason: byReason
  };
}

// [생산실적] 탭: 날짜 | 라인 | 생산수량 | 양품수량
function readProduction_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.PROD_SHEET);
  if (!sh || sh.getLastRow() <= 1) return null;
  var count = 0, good = 0, keys = {};
  sh.getDataRange().getValues().slice(1).forEach(function (r) {
    if (!r[0] || !r[1]) return; count += Number(r[2]) || 0; good += Number(r[3]) || 0; keys[String(r[0]) + '|' + r[1]] = 1;
  });
  var n = Object.keys(keys).length;
  return { count: count, good: good, planned: n * CONFIG.PLANNED_MIN_PER_DAY };
}

function sheet_(name, create) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh && create) { sh = ss.insertSheet(name); sh.appendRow(CONFIG.HEADER); }
  if (!sh) throw new Error("'" + name + "' 탭을 찾을 수 없습니다. 시트 하단의 탭 이름을 확인해 주세요.");
  return sh;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
