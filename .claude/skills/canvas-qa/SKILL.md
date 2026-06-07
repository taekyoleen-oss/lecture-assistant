---
name: canvas-qa
description: 강의 어노테이션 도구를 실제 브라우저(Playwright)에서 구동·검증할 때 사용. 앱 구동법, 캔버스에 마우스 드래그를 시뮬레이션해 드로잉을 테스트하는 법, 핵심 QA 시나리오(드로잉·페이지보존·저장·단축키·테마·전체보기), 경계면(state↔canvas↔저장) 교차 비교 패턴을 제공한다. 어노테이션 기능을 검증·QA·테스트하거나 캔버스 드로잉 버그를 재현할 때 반드시 이 스킬을 사용할 것.
---

# canvas-qa — 캔버스 인터랙션 QA 가이드

이 도구의 핵심 가치는 "그렸을 때 의도대로 나타나고 보존되는가"다. 코드 존재 확인이
아니라 **실제 브라우저에서 사용자 동작을 재현**해 검증한다. Playwright MCP 도구를 쓴다.

## 1. 앱 구동

**방법 A — Express 서버 (PPT 변환·CSP까지 검증):**
```
npm start          # http://localhost:3000
```
**방법 B — 정적 파일만 (빠른 드로잉 검증):**
`lecture-annotation-tool/index.html`을 직접 `browser_navigate`로 `file://` 열기.
PPT 변환·CSP는 검증 불가하지만 드로잉/도구/단축키는 모두 검증 가능.

Playwright 도구가 deferred면 `ToolSearch`로
`select:browser_navigate,browser_evaluate,browser_click,browser_take_screenshot,browser_press_key`
등을 먼저 로드한다.

## 2. PDF 없이 테스트하기
대부분의 드로잉 로직은 PDF 로드 후 캔버스가 활성화돼야 동작한다. 테스트용으로
`browser_evaluate`로 가짜 페이지 상태를 세팅하거나, 작은 테스트 PDF를
`browser_file_upload`로 드롭한다. 가장 확실한 건 실제 PDF 1장을 업로드해
`#app`이 보이고 `#draw-layer`가 화면을 채운 상태를 만드는 것.

## 3. 캔버스 드래그 시뮬레이션
캔버스 드로잉은 클릭이 아니라 mousedown→mousemove→mouseup 시퀀스다.
`browser_evaluate`로 직접 이벤트를 디스패치하는 것이 가장 안정적:
```js
const c = document.getElementById('draw-layer');
const r = c.getBoundingClientRect();
const fire = (type,x,y) => c.dispatchEvent(new MouseEvent(type,{
  clientX:r.left+x, clientY:r.top+y, bubbles:true, button:0 }));
fire('mousedown',100,100); fire('mousemove',200,180); fire('mouseup',200,180);
```
드로잉 후 `state.strokes[state.currentPage]`를 읽어 stroke가 쌓였는지 확인.

## 4. 핵심 QA 시나리오 (경계면 교차 비교)

| # | 시나리오 | 검증 포인트 (경계면) |
|---|----------|---------------------|
| 1 | 펜으로 드래그 | `state.strokes[page]`에 `type:'pen'`, points가 **0~1 정규화**로 저장 |
| 2 | 도형/화살표 드래그 | `start/end` 정규화, 미리보기 후 확정 1개만 추가 |
| 3 | 페이지 이동 후 복귀 | 주석이 그대로 복원 (정규화 좌표 유효성 핵심 테스트) |
| 4 | 창 리사이즈/전체보기 | 주석 위치·비율 유지 |
| 5 | 지우개 | eraser stroke 저장 + redraw 후 해당 영역 지워짐 |
| 6 | 도구 단축키 1~9 | 각 키가 올바른 도구 활성 (`state.activeTool`) |
| 7 | Undo/Redo (있으면) | 직전 동작 1회 되돌림/복원, 페이지별 독립 |
| 8 | PNG 저장 | 합성 캔버스에 PDF+주석 둘 다 포함 (다운로드 트리거/dataURL 확인) |
| 9 | 테마 토글 | `data-theme` 전환, localStorage 반영 |
| 10 | 라이브 도구(레이저 등) | stroke로 **저장 안 됨**, 페이지 이동 시 사라짐 |

## 5. 경계면 버그가 잘 숨는 곳
- **저장 좌표가 정규화 아님** → 같은 페이지선 멀쩡, 페이지 넘기면 어긋남(시나리오 3이 잡음)
- **redraw 케이스 누락** → 그릴 땐 보이는데(미리보기) 페이지 갔다 오면 사라짐
- **CSP 누락** → 로컬 file:// 정상, 서버/프로덕션에서 CDN 차단(방법 A로 확인)
- **단축키 충돌** → 새 키가 기존 동작을 가로챔
- **input 포커스 중 단축키 통과** → 텍스트 입력 중 페이지가 넘어감

## 6. 리포트 형식
`_workspace/NN_canvas-qa_report.md`에:
- 항목별 **PASS/FAIL**
- FAIL: **재현 절차**(번호순 동작) · 기대값 · 실제값 · 콘솔 에러(`browser_console_messages`)
- 가능하면 `browser_take_screenshot`로 증거 첨부
- 환경(방법 A/B, 사용 PDF) 명시

## 7. 콘솔 에러는 항상 확인
`browser_console_messages`로 JS 에러·CSP 위반·404를 매 시나리오 후 점검한다.
화면이 멀쩡해 보여도 콘솔에 에러가 있으면 FAIL로 본다.
