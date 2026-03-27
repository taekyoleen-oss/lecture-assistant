# Lecture Annotation Tool — Claude Code 에이전트 가이드

## 프로젝트 개요

강의 중 PDF 슬라이드 위에 실시간으로 주석을 그릴 수 있는 브라우저 기반 어노테이션 도구.

- **설계서**: `../lecture-annotation-tool-design-v1.0.md` (모든 스펙의 원본)
- **출력 파일**: `lecture-annotation-tool/index.html` (단일 파일 완결)
- **기술 스택**: 순수 Vanilla JS + HTML5 Canvas + PDF.js (CDN)

---

## 구현 순서 (반드시 이 순서를 따를 것)

1. **HTML 뼈대 + CSS 레이아웃** — 다크 테마, 우측 툴바, 캔버스 영역, 하단 컨트롤 바
2. **PDF.js 연동** — 파일 로드, 전체 페이지 Eager 렌더링, 로딩 스피너 UI
3. **도구별 드로잉 로직** — 펜, 화살표, 동그라미, 네모, 텍스트, 형광펜
4. **지우개 + StrokeStore** — eraser stroke 저장 방식 포함
5. **슬라이드 이동 + 주석 보존/초기화** — StrokeStore 연동
6. **키보드 단축키 + 전체화면 API**
7. **파일 드래그&드롭 + IDLE 화면**
8. **PNG 저장 + localStorage 설정 복원**

---

## 핵심 기술 결정 사항

### 좌표 정규화 (필수)
모든 stroke 좌표는 `0~1` 정규화 값으로 저장. 렌더링 시 캔버스 크기에 스케일 적용.

```js
const normalizePoint  = (x, y, canvas) => ({ x: x / canvas.width, y: y / canvas.height })
const denormalizePoint = (nx, ny, canvas) => ({ x: nx * canvas.width, y: ny * canvas.height })
const normalizeWidth   = (px, canvas) => px / canvas.width
const denormalizeWidth = (nw, canvas) => nw * canvas.width
```

### StrokeStore 데이터 구조
```js
// Stroke 타입
{
  type: 'arrow' | 'pen' | 'circle' | 'rect' | 'text' | 'highlight' | 'eraser',
  color: string,
  points: [{x, y}],   // 정규화 좌표
  start: {x, y},      // 정규화 좌표
  end: {x, y},        // 정규화 좌표
  text: string,       // 텍스트 도구만
  lineWidth: number,  // 정규화 두께 (px / canvas.width)
}

// AppState
{
  pdf, totalPages, currentPage,
  activeTool,   // 기본값: 'pen'
  activeColor,  // 기본값: 'red'
  lineWidth,    // 기본값: 4 (px)
  isDrawing,
  strokes: { [pageNum]: Stroke[] }
}
```

### 지우개 전략
- `destination-out` compositeOperation으로 픽셀 제거
- 지우개 동작도 `type: 'eraser'` stroke로 저장
- 재렌더링 시 모든 stroke를 순서대로 적용 (eraser 포함)

### 실시간 미리보기 (화살표 / 동그라미 / 네모)
- `mousemove` 시마다: ① draw-layer 전체 클리어 → ② 기존 확정 strokes 재드로우 → ③ 현재 드래그 미리보기 추가

### 동그라미 구현
- 시작점~끝점으로 바운딩 박스 구성 → 내접 타원 (`ellipse()` 또는 `bezierCurveTo()`)
- PowerPoint와 동일한 방식

### 화살표 화살촉
- 실선 채운 삼각형 (filled triangle)

### 텍스트 도구
- `mousedown` 위치에 `<input>` 임시 생성
- 바깥 클릭(blur) 시 확정, 빈 입력 무시
- 폰트 크기: PDF 렌더링 높이 기준 비례 스케일 (예: `canvas.height * 0.03`)
- `input` 포커스 중 `←` `→` `Esc` 키 이벤트 전파 차단 (`stopPropagation`)

---

## UI 스펙

### 색상 팔레트
| 토큰 | HEX |
|------|-----|
| `red` | `#FF3333` |
| `yellow` | `#FFE033` |
| `lime` | `#84CC16` |
| `blue` | `#3B82F6` |

### 툴바 레이아웃 (우측 고정, 위→아래)
```
[도구 7개: 펜 / 화살표 / 동그라미 / 네모 / 텍스트 / 형광펜 / 지우개]
[색상 4개: 레드 / 옐로우 / 라임그린 / 블루]
[두께 슬라이더]
[초기화 버튼]
```

### 하단 컨트롤 바
```
[← PREV]  [3 / 24 (클릭 → 직접 입력)]  [NEXT →]  [💾 PNG 저장]
```

### 커서 스타일
| 도구 | 커서 |
|------|------|
| 펜 / 화살표 / 동그라미 / 네모 / 형광펜 | `crosshair` |
| 텍스트 | `text` |
| 지우개 | 원형 커서 (SVG 또는 JS 오버레이) |

### 키보드 단축키
| 키 | 동작 |
|----|------|
| `←` / `→` | 이전 / 다음 슬라이드 |
| `Esc` | 현재 슬라이드 주석 초기화 |
| `1`~`7` | 도구 선택 순서대로 |
| `F` | 전체화면 토글 |

---

## 기타 구현 요건

### PDF 처리
- **Eager 렌더링**: 로드 시 전체 페이지 미리 렌더링
- **암호화 PDF**: `onPassword` 콜백 → 브라우저 `prompt()`로 비밀번호 입력
- **로딩 UI**: 스피너 + "PDF 로딩 중..." → 완료 시 자동 해제

### 파일 드롭
- 비PDF 파일: 오류 토스트 메시지 표시
- 새 PDF 드롭: 경고 없이 전체 주석 삭제 후 교체

### PNG 저장
```js
// 오프스크린 캔버스에 PDF + 주석 합성 → toDataURL → <a> 클릭 다운로드
const off = document.createElement('canvas')
off.width = pdfCanvas.width; off.height = pdfCanvas.height
off.getContext('2d').drawImage(pdfCanvas, 0, 0)
off.getContext('2d').drawImage(drawCanvas, 0, 0)
const a = document.createElement('a')
a.download = `slide-${currentPage}.png`
a.href = off.toDataURL('image/png')
a.click()
```

### localStorage
```js
const KEYS = { tool: 'lat_tool', color: 'lat_color', width: 'lat_width' }
// 초기값: tool='pen', color='red', width=4
```

### 슬라이드 외부 영역 차단
- canvas bounding rect 기준 범위 밖 `mousedown` 무시

### IDLE 화면 푸터
IDLE 화면 하단에만 바이브코딩랩 푸터 표시. PRESENTING 모드 시 숨김.

```html
<footer id="vibe-footer" style="...">
  <p>더 많은 앱을 활용하거나 만들고 싶으면</p>
  <a href="https://www.vibecodinglab.ai.kr/" target="_blank">🚀 바이브코딩랩 방문하기</a>
  <p>vibecodinglab.ai.kr</p>
</footer>
```

---

## 코딩 규칙

- 파일: `lecture-annotation-tool/index.html` 단일 파일 (HTML + CSS + JS 인라인)
- JS: `async/await` 사용, 콜백 패턴 지양
- 모듈 구조: `PDFRenderer`, `CanvasManager`, `ToolController`, `StrokeStore`, `KeyboardHandler`, `FileHandler`
- 캔버스 2개 분리: `canvas#pdf-layer` (PDF 렌더링) / `canvas#draw-layer` (주석)
- 폰트: `'JetBrains Mono'` (Google Fonts CDN)
- 배경: `#0f0f0f`, 툴바: `rgba(20,20,20,0.85)` + `backdrop-filter: blur`
