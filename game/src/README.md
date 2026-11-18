# 첫 출근 울산공장 소스

- head.html : 화면 구조와 CSS
- data.js   : 게임 데이터 (공정, 설비, 직무, NPC, 사건, 지식 카드, 퀴즈, 뉴스)
- game.js   : 게임 로직과 WebGL 렌더링

합치는 방법: head.html 뒤에 <script>를 열고 data.js, game.js를 이어 붙인 뒤 </script>로 닫으면 index.html 한 파일이 됩니다.

  { cat head.html; echo "<script>"; cat data.js game.js; echo "</script>"; } > index.html
