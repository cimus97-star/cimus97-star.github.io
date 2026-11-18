# 울산공장 디지털 섀도우 — 생산관리 포트폴리오

직접 만든 자동차 공장 시뮬레이션 게임 「첫 출근 울산공장」을 실시간 대시보드로 읽고,
게임과 같은 규칙의 모델로 버퍼·보전 정책을 실험한 포트폴리오입니다.

```
index.html            포트폴리오 본문 (맨 아래 PROFILE 블록에 이름·연락처를 넣으세요)
assets/line-model.js  게임 라인 로직(simLines)을 화면 없이 옮긴 실험 모델
assets/twin.js        게임 → 대시보드 연결 (읽기 전용)
game/index.html       게임 (연결 훅 window.TWIN 포함)
game/src/             게임 소스 3분할 (head.html, data.js, game.js)
webapp/Code.gs        현장 비가동 웹앱 서버 코드 (Apps Script, 개선판)
webapp/index.html     웹앱 화면 (Apps Script 밖에서 열면 데모 모드)
```

## 1. GitHub 가입부터 사이트 공개까지 (약 15분, 명령어 없이)

1. https://github.com 에서 **Sign up** → 이메일 인증까지 마칩니다. 아이디가 사이트 주소가 되니 짧고 영문으로 정하세요. (예: `gildong-kim`)
2. 오른쪽 위 **+ → New repository**
   - Repository name: **`아이디.github.io`** (예: `gildong-kim.github.io`) — 이렇게 지으면 주소가 `https://아이디.github.io` 가 됩니다.
   - Public 선택 → **Create repository**
3. 새 저장소 화면의 **uploading an existing file** 링크 클릭
4. 이 zip을 푼 폴더 안의 **내용물 전체**(index.html, assets, game, webapp, README.md)를 드래그해서 올립니다. 폴더째 끌어다 놓으면 하위 폴더 구조가 유지됩니다.
5. 아래 **Commit changes** 클릭
6. 저장소의 **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main` / `(root)` → **Save**
7. 1~2분 뒤 `https://아이디.github.io` 접속. 이력서·자기소개서에는 이 주소를 넣으면 됩니다.

> 올리기 전에 `index.html` 맨 아래 `PROFILE` 블록에서 이름, 이메일, GitHub 주소를 바꾸세요.
> GitHub 웹에서 파일을 열고 연필 아이콘(Edit)을 눌러 바로 고쳐도 됩니다.

## 2. 게임을 업데이트할 때

`game/index.html` 파일만 새 버전으로 바꿔 올리면(같은 이름으로 업로드하면 덮어쓰기) 포트폴리오에 바로 반영됩니다.

**단, 새 게임 코드에도 아래 블록이 있어야 대시보드가 연결됩니다.** game.js 맨 끝 `requestAnimationFrame(frame);` 바로 위에 있습니다.
Claude로 게임을 고칠 때 "window.TWIN 연결 훅은 그대로 유지해 줘"라고 같이 말해 주세요.

```js
window.TWIN = { v: 1, get S() { return S; }, get LN() { return LN; }, lineState, uptime, SHOPS, ZONES, STMAP,
  consts: { V, GAP, BUF, TARGET, DAYS, get PLEN() { return PLEN; } } };
```

대시보드는 `S.msgs`의 생산 상황실(ops) 메시지 문구(“○○ 공장 라인 정지 · 사유”, “○○ 공장 라인 재가동”)로 정지·재가동을 기록합니다.
이 문구나 `S.prod`, `S.down`, `LN[i].buf` 같은 이름을 바꾸면 `assets/twin.js`도 같이 맞춰야 합니다.

## 3. 컴퓨터에서 미리 보기

게임과 대시보드가 같은 주소(출처)에 있어야 연결되므로, `index.html`을 더블클릭해서 열면 게임 연결이 안 됩니다.
VS Code의 **Live Server** 확장으로 열거나, 그냥 GitHub에 올려서 확인하세요.

## 4. 웹앱을 시트와 연결하기 (선택)

1. 기존 Apps Script 프로젝트의 Code.gs를 `webapp/Code.gs`로, index.html을 `webapp/index.html`로 교체
2. **배포 → 새 배포 → 웹 앱**, 액세스 권한 “모든 사용자” → 나온 `…/exec` 주소 복사
3. 포트폴리오 `index.html`의 `PROFILE.sheetUrl`에 붙여 넣으면 대시보드에 **시트로 보내기** 버튼이 생기고, 게임 비가동 이력이 `[게임로그]` 탭에 쌓입니다.
4. `[생산실적]` 탭(날짜 | 라인 | 생산수량 | 양품수량)을 만들면 웹앱이 성능·품질·OEE까지 계산합니다.

## 5. 게임에 제안하는 수정 2가지 (포트폴리오 ‘모델 검증’ 절)

```js
// simLines(): 빈 자리를 당기지 않고 실제 컨베이어처럼 흘려보내기
- const d0 = last ? Math.max(0, last.d - GAP) : 0;
+ const d0 = (i === 0 && last) ? Math.max(0, last.d - GAP) : 0;

// advance(): 배속과 상관없이 택트 6.4분 유지
- const s = Math.min(dt, 2);
+ const s = Math.min(dt, 0.2);
```
고치면 게임 난이도가 올라갑니다(앞 공장 정지가 생산량에 반영됨). TARGET(68대)도 같이 다시 정하세요.
