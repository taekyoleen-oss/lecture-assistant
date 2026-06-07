---
name: annotation-feature-dev
description: 강의 어노테이션 도구(lecture-annotation-tool/index.html)에 신규 도구·기능을 추가하거나 버그를 수정할 때 사용. 단일 HTML 파일의 모듈 구조, 좌표 0~1 정규화(nPt/dPt/nW), StrokeStore 스키마, 재렌더링 패턴, CSP 규약, "새 도구 추가 체크리스트"를 제공한다. index.html이나 server.js를 수정하거나, 펜·도형·레이저·줌·타이머 같은 어노테이션 기능을 만들 때 반드시 이 스킬을 사용할 것.
---

# annotation-feature-dev — 어노테이션 도구 구현 가이드

강의 어노테이션 도구는 **단일 파일** `lecture-annotation-tool/index.html`
(HTML + `<style>` + `<script>` 모두 인라인)로 완결된다. 서버
(`server.js`)는 PPT→PDF 변환과 정적 서빙·CSP만 담당한다.

이 가이드의 규약을 어기면 페이지 전환·리사이즈·저장·프로덕션 배포 중
하나가 조용히 깨진다. **왜** 그런지를 이해하고 따르라.

---

## 1. 아키텍처 한눈에 보기

**캔버스 2장 분리:**
- `#pdf-layer` — PDF 렌더링 전용 (`pdfCtx`)
- `#draw-layer` — 주석 전용 (`drawCtx`). 모든 입력 이벤트는 이 레이어에 바인딩.

**모듈 (모두 `index.html` 내 객체 리터럴):**
| 모듈 | 책임 |
|------|------|
| `state` | 전역 상태 (아래 스키마) |
| `StrokeStore` | 페이지별 stroke 배열 CRUD: `get/add/clear/clearAll` |
| `PDFRenderer` | PDF.js 로드, eager 렌더링, `showPage`, 비밀번호 콜백 |
| `CanvasManager` | `redraw()` — 한 페이지의 모든 stroke를 순서대로 재드로우 |
| `ToolController` | 도구/색/두께 선택, 커서, 활성 버튼 토글 |
| `SelectTool` | 개체 선택·이동·크기조절·삭제 |
| `KeyboardHandler` | 단축키 (숫자=도구, 화살표=페이지, Esc, F, Ctrl+C/V) |
| `FileHandler` | 드래그&드롭, 파일 입력, 이미지 붙여넣기 |
| `PageScrollRail` | 우측 페이지 스크롤 레일 |
| `PptHandler` | PPT/PPTX 자동(LibreOffice)·수동 변환 안내 |

`const $ = id => document.getElementById(id)` — DOM 접근은 항상 `$()`.

---

## 2. 절대 규약 (어기면 깨진다)

### 2-1. 좌표는 0~1 정규화로만 저장
화면 픽셀이 아니라 캔버스 비율로 저장해야 페이지 전환·창 리사이즈·전체보기에서
주석 위치가 유지된다. 헬퍼:
```js
const nPt = (x, y)   => ({ x: x / drawCanvas.width,  y: y / drawCanvas.height }); // 정규화
const dPt = (nx, ny) => ({ x: nx * drawCanvas.width, y: ny * drawCanvas.height }); // 역정규화
const nW  = w => w / drawCanvas.width;   // 두께 정규화
const dW  = nw => nw * drawCanvas.width;  // 두께 역정규화
```
**저장할 때 `nPt`, 그릴 때 `dPt`.** stroke의 `points/start/end/lineWidth`는 전부 정규화 값.

### 2-2. StrokeStore 스키마
```js
state.strokes = { [pageNum]: Stroke[] }
// Stroke:
{
  type: 'pen'|'arrow'|'circle'|'rect'|'text'|'highlight'|'eraser'|'image',
  color: 'red'|'yellow'|'lime'|'blue' (키) 또는 hex,  // COLOR_MAP으로 변환
  points: [{x,y}],   // pen/highlight/eraser — 정규화
  start: {x,y}, end: {x,y},  // arrow/circle/rect — 정규화
  text: string, lineWidth: number(정규화),  // text/도형
  src: dataURL, ...                          // image
}
```
새 stroke 타입을 추가하면 **`CanvasManager.redraw()`의 분기에 렌더링 케이스를 반드시 추가**한다.

### 2-3. 재렌더링은 항상 전체 재적용
`CanvasManager.redraw()`는 draw-layer를 클리어한 뒤 해당 페이지 stroke를
**처음부터 순서대로** 다시 그린다(eraser의 `destination-out` 포함). 그래서
지우개·실행취소가 일관되게 동작한다. 부분 갱신으로 "꼼수" 그리기 금지.

### 2-4. 실시간 미리보기 패턴 (도형/화살표)
`mousemove` 때마다: ① `redraw()`로 확정 stroke 복원 → ② 현재 드래그 미리보기 추가.
`redraw(previewStroke)`처럼 인자로 미리보기를 넘기는 기존 패턴을 따른다.

### 2-5. CDN 추가 시 CSP 갱신 (프로덕션 필수)
새 외부 스크립트/폰트/이미지 출처를 쓰면 `server.js`의 `CSP_HTML` 배열에 도메인을
추가한다. 로컬에선 통과해도 **Vercel 프로덕션에서 차단**된다.

### 2-6. localStorage 영속
도구/색/두께는 `STORAGE_KEYS`(`lat_tool/lat_color/lat_width`)로 저장·복원.
새 영속 설정을 추가하면 같은 패턴으로 키를 추가한다.

---

## 3. 새 "도구" 추가 체크리스트

펜·도형류 같은 새 도구를 추가할 때 **모든 항목**을 처리한다(하나라도 빠지면
도구가 반쪽만 동작):

1. **툴바 버튼** — `#toolbar`에 `<button class="tool-btn" data-tool="NAME" title="... (키)">아이콘</button>`
2. **커서** — `ToolController.applyTool`의 커서 분기에 추가
3. **단축키** — `KeyboardHandler`의 숫자키 `switch`에 `ToolController.applyTool('NAME')`
4. **입력 처리** — `drawCanvas`의 `mousedown/mousemove/mouseup`에 도구 분기 추가
5. **stroke 저장** — 확정 시 `StrokeStore.add(state.currentPage, {...})` (정규화 좌표)
6. **렌더링** — `CanvasManager.redraw()`에 `type === 'NAME'` 케이스 추가
7. **PNG 저장 포함 확인** — 저장은 draw-layer를 합성하므로 redraw에 들어가면 자동 포함

> 라이브 전용 도구(레이저·스포트라이트)는 stroke로 **저장하지 않는다** — 화면에만
> 일시 표시하고, 별도 오버레이 캔버스/요소로 그린 뒤 페이지 이동·마우스업 시 지운다.

---

## 4. 자주 추가하는 강의 기능별 포인트

도메인별 구현 노트는 필요할 때만 읽는다:
- **Undo/Redo, 레이저, 스포트라이트, 줌, 검은화면, 타이머** 등 강의 특화 기능의
  구현 설계 → `references/lecture-features.md`

---

## 5. 검증 전 자가 점검
- [ ] 좌표 정규화로 저장했는가 (페이지 넘겼다 와도 유지되나)
- [ ] `redraw()`에 렌더 케이스를 넣었는가
- [ ] 도구라면 §3 체크리스트 7항목 전부 처리했는가
- [ ] CDN 추가 시 CSP 갱신했는가
- [ ] 라이브 도구는 stroke로 저장 안 했는가
- [ ] 기존 단축키/도구와 충돌 없는가
- [ ] 로컬에서 실제로 띄워 동작 확인했는가 (canvas-qa에 넘기기 전 1차)
