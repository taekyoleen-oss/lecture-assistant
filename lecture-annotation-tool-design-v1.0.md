# Lecture Annotation Tool — 웹 개발 설계서 v1.0

> **방법 2 (웹앱) 구현 계획서**
> 추후 방법 1 (Electron 오버레이)로 전환하는 경로 포함

---

## 1. 프로젝트 컨텍스트

- **목적**: 강의 중 PDF 슬라이드 위에 실시간으로 주석을 그리고, 슬라이드를 넘기며 발표를 진행할 수 있는 브라우저 기반 어노테이션 도구
- **대상 사용자**: 강사, 교육자 — PDF로 변환한 강의자료를 전체화면으로 띄우고, 강의 중 손으로 그리듯 화면에 주석을 남기는 사람
- **핵심 기능 요약**:
  - PDF 파일 로드 및 슬라이드 렌더링 (PDF.js)
  - 슬라이드 위 Canvas 오버레이 — 화살표, 자유 드로잉(펜), 동그라미, 네모, 텍스트 입력, 형광펜, 지우개
  - 슬라이드 이동: 키보드 방향키 + 화면 내 버튼
  - `Esc` 키 또는 버튼으로 현재 슬라이드 주석 초기화
  - 현재 슬라이드 PNG 저장 기능
- **기술 스택**: 순수 HTML5 + CSS3 + Vanilla JS (단일 파일 구조) — Next.js/Supabase 불필요
- **제약조건**:
  - 설치 없이 브라우저에서 즉시 실행
  - 단일 `index.html` 파일로 완결 (강사가 파일 하나만 관리)
  - 외부 라이브러리는 CDN 경유 (PDF.js만 사용)
  - 전체화면 모드 지원 (F11 또는 Fullscreen API)
  - 터치/마우스 공통 이벤트 대응

---

## 2. 페이지 구성 및 사용자 흐름

### 화면 상태 (단일 페이지, 모드 전환)

| 상태 | 설명 |
|------|------|
| `IDLE` | 시작 화면 — PDF 파일 드래그&드롭 또는 파일 선택 버튼 |
| `PRESENTING` | 슬라이드 전체화면 + 캔버스 오버레이 + 우측 툴바 |

### 사용자 흐름

```
[시작 화면]
    │
    ├── 파일 선택 / 드래그&드롭 (PDF)
    │     ├── 비PDF 파일 드롭 → 오류 토스트 메시지 표시
    │     └── 암호화된 PDF → 비밀번호 입력 프롬프트 표시
    │
    ▼
[로딩 중 — 스피너 + "PDF 로딩 중..." 표시]
    │
    ▼
[슬라이드 뷰 — PRESENTING 모드]
    │
    ├── 도구 선택 (우측 툴바) — PDF 로드 직후 펜 도구 자동 선택
    │     ├── 화살표 / 펜 / 동그라미 / 네모 / 텍스트 / 형광펜 / 지우개
    │     ├── 색상 선택 (레드 / 옐로우 / 라임그린 / 블루)
    │     └── 선 두께 슬라이더
    │
    ├── 슬라이드 위 그리기 (Canvas)
    │
    ├── 슬라이드 이동
    │     ├── ← → 방향키
    │     ├── 화면 하단 prev/next 버튼
    │     └── 페이지 카운터 클릭 → 직접 페이지 입력
    │
    ├── Esc → 현재 슬라이드 주석 초기화
    │
    ├── PNG 저장 → 현재 슬라이드 이미지 다운로드
    │
    └── 새 PDF 드롭 → 경고 없이 전체 주석 삭제 후 교체
```

### 인증/권한

없음 — 완전 로컬, 서버 통신 없음

---

## 3. 데이터 모델

Supabase 불필요. 모든 상태는 브라우저 메모리에서 관리.

### 앱 상태 (JS 메모리)

```
AppState {
  pdf: PDFDocumentProxy | null       // 로드된 PDF 객체
  totalPages: number                 // 전체 슬라이드 수
  currentPage: number                // 현재 페이지 (1-based)
  activeTool: ToolType               // 현재 선택 도구
  activeColor: ColorToken            // 현재 선택 색상
  lineWidth: number                  // 현재 선 두께 (px 단위, 렌더링 시 스케일 적용)
  isDrawing: boolean                 // 드로잉 중 여부
  strokes: StrokeMap                 // 페이지별 주석 데이터
    └── { [pageNum]: Stroke[] }      // 각 페이지의 스트로크 목록
}

Stroke {
  type: 'arrow' | 'pen' | 'circle' | 'rect' | 'text' | 'highlight' | 'eraser'
  color: string
  points: {x: 0~1, y: 0~1}[]        // 펜/형광펜/지우개 — 정규화 좌표
  start: {x: 0~1, y: 0~1}           // 도형 시작점 — 정규화 좌표
  end: {x: 0~1, y: 0~1}             // 도형 끝점 — 정규화 좌표
  text?: string                      // 텍스트 입력 시
  lineWidth: number                  // 정규화 선 두께 (캔버스 너비 대비 비율)
}
```

> **좌표 정규화**: 모든 Stroke 좌표는 캔버스 크기 대비 `0~1` 상대값으로 저장. 렌더링 시 현재 캔버스 크기에 스케일 적용. 이를 통해 윈도우 리사이즈 또는 전체화면 전환 후에도 주석 위치가 슬라이드 대비 정확히 일치함.

> **지우개 StrokeStore 전략**: 지우개 동작도 `type: 'eraser'` stroke로 StrokeStore에 저장. 재렌더링(페이지 이동 복귀, 리사이즈) 시 모든 stroke를 저장 순서대로 적용하여 지우개 효과를 재현. `destination-out` compositeOperation 사용.

> **페이지 이동 시 캔버스 처리**: 이동 전 슬라이드의 주석은 `strokes` 맵에 보존, 돌아오면 재렌더링. `Esc`는 현재 페이지 `strokes[currentPage]`만 초기화.

---

## 4. UI/UX 방향

### 디자인 톤

**다크 유틸리티 (Dark Utility)** — 강의 환경에서 슬라이드에 시선이 집중되어야 하므로 UI 자체는 최대한 존재감을 낮춘다. 어두운 배경, 높은 대비의 미니멀 툴바.

- 배경: `#0f0f0f` (슬라이드 외 영역)
- 툴바: 반투명 다크 패널 (`rgba(20,20,20,0.85)` + `backdrop-filter: blur`)
- 강조: 선택된 도구는 흰색 테두리 + 연한 글로우
- 폰트: `'JetBrains Mono'` (툴 레이블, 페이지 카운터) — 기술적·단정한 느낌

### 레이아웃 구조

```
┌─────────────────────────────────────────┬──────┐
│                                         │      │
│          PDF 슬라이드 렌더링             │ 툴   │
│          (canvas#pdf-layer)             │ 바   │
│                                         │      │
│          주석 캔버스                    │ (우  │
│          (canvas#draw-layer)            │  측) │
│                                         │      │
└────────────────┬────────────────────────┴──────┘
                 │  하단: 페이지 컨트롤 바
```

### 툴바 컴포넌트 (우측 고정)

```
┌─────┐
│ 🖊  │  ← 펜 (자유 드로잉)
│ ➡  │  ← 화살표
│ ○  │  ← 동그라미
│ □  │  ← 네모
│ T  │  ← 텍스트
│ ▬  │  ← 형광펜 (반투명)
│ ◻  │  ← 지우개
├─────┤
│ 🔴  │  ← 색상: 레드
│ 🟡  │  ← 색상: 옐로우
│ 🟢  │  ← 색상: 라임그린
│ 🔵  │  ← 색상: 블루
├─────┤
│ ━━  │  ← 선 두께 슬라이더 (전체 도구 통일 적용, 지우개 반지름도 연동)
├─────┤
│ ✕  │  ← 현재 슬라이드 주석 초기화 (= Esc)
└─────┘
```

### 하단 페이지 컨트롤

```
[← PREV]  [3 / 24 (클릭 → 직접 입력)]  [NEXT →]  [💾 PNG 저장]
```

- 페이지 카운터 클릭 시 입력창 노출, Enter로 직접 페이지 이동
- PNG 저장 버튼: 현재 슬라이드(PDF + 주석 합성) 이미지를 다운로드

### 색상 팔레트

| 토큰 | 색상 | HEX |
|------|------|-----|
| `red` | 레드 | `#FF3333` |
| `yellow` | 옐로우 | `#FFE033` |
| `lime` | 라임그린 | `#84CC16` |
| `blue` | 블루 | `#3B82F6` |

### 커서 스타일

| 도구 | 커서 |
|------|------|
| 펜 / 화살표 / 동그라미 / 네모 / 형광펜 | `crosshair` |
| 텍스트 | `text` |
| 지우개 | 원형 커서 (SVG 커서 또는 `cursor: none` + JS로 원형 오버레이) |

### 시작(IDLE) 화면 푸터

IDLE 화면 하단에만 바이브코딩랩 푸터 표시:

```html
<footer>
  <p>더 많은 앱을 활용하거나 만들고 싶으면</p>
  <a href="https://www.vibecodinglab.ai.kr/" target="_blank">
    🚀 바이브코딩랩 방문하기
  </a>
  <p>vibecodinglab.ai.kr</p>
</footer>
```

PRESENTING 모드 전환 시 푸터 숨김.

### 키보드 단축키

| 키 | 동작 |
|----|------|
| `←` / `→` | 이전 / 다음 슬라이드 (텍스트 입력 중 비활성화) |
| `Esc` | 현재 슬라이드 주석 초기화 (텍스트 입력 중 비활성화) |
| `1`~`7` | 도구 선택 (펜/화살표/동그라미/네모/텍스트/형광펜/지우개) |
| `F` | 전체화면 토글 |

> **텍스트 입력 중 키보드 내비게이션 차단**: `<input>` 포커스 상태에서 `←` `→` `Esc` 키 이벤트가 내비게이션으로 전파되지 않도록 `event.stopPropagation()` 처리.

### 반응형

- 기본 타깃: **16:9 데스크톱 전체화면** (강의 환경)
- 슬라이드는 뷰포트에 맞게 비율 유지 (`object-fit: contain` 방식으로 캔버스 크기 계산)
- 모바일 대응은 v1.0 범위 외 (추후 터치 이벤트 확장 여지 확보)

---

## 5. 구현 스펙

### 파일 구조

```
lecture-annotation-tool/
├── index.html          ← 앱 전체 (HTML + CSS + JS 인라인 또는 분리)
├── pdf.worker.min.js   ← PDF.js 워커 파일 (CDN 다운로드 또는 로컬 복사)
└── README.md           ← 사용법 (PPT→PDF 변환 방법 포함)
```

> CDN 방식으로 개발 시 `pdf.worker.min.js` 별도 파일 불필요. 배포용으로 오프라인 지원이 필요하면 로컬 복사.

### 핵심 모듈 구조 (JS 내부)

| 모듈 | 역할 |
|------|------|
| `PDFRenderer` | PDF.js 래퍼 — 파일 로드, 페이지 렌더링, 뷰포트 계산 |
| `CanvasManager` | draw-layer 캔버스 관리 — 이벤트 바인딩, 스트로크 렌더링 |
| `ToolController` | 현재 도구/색상/두께 상태 관리, 툴바 UI 업데이트 |
| `StrokeStore` | 페이지별 스트로크 데이터 저장/불러오기/삭제 |
| `KeyboardHandler` | 전역 키보드 단축키 바인딩 |
| `FileHandler` | 드래그&드롭 + 파일 선택 이벤트 처리 |

### 에이전트 구조

**단일 에이전트** — 파일 하나짜리 웹앱이므로 서브에이전트 불필요.

Claude Code는 단일 컨텍스트에서 다음 순서로 구현:
1. HTML 뼈대 + CSS 레이아웃 (다크 테마, 툴바, 캔버스 영역)
2. PDF.js 연동 (파일 로드 → 캔버스 렌더링)
3. 도구별 드로잉 로직 (펜, 화살표, 도형, 텍스트, 형광펜)
4. 슬라이드 이동 + 주석 보존/초기화
5. 키보드 단축키 + 전체화면 API
6. 파일 드래그&드롭 + 시작 화면

### 도구별 구현 방식

| 도구 | 구현 방식 |
|------|---------|
| **펜** | `mousemove` 경로 추적 → `lineTo` 연속 드로잉 |
| **화살표** | `mousedown` 시작점 기록 → `mousemove` 중 임시 캔버스에 실시간 미리보기 렌더링 → `mouseup` 끝점 확정, 실선 채운 삼각형(filled triangle) 화살촉 |
| **동그라미** | `mousedown`~`mousemove` 중 실시간 미리보기 → `mouseup` 확정. 시작점~끝점으로 바운딩 박스를 구성하고 그 안에 내접하는 타원을 `ellipse()` 또는 `bezierCurveTo()`로 그림 (PowerPoint 방식) |
| **네모** | `mousedown`~`mousemove` 중 실시간 미리보기 → `mouseup` 확정. `strokeRect()` 사용 |
| **텍스트** | `mousedown` 위치에 `<input>` 임시 생성 → 바깥 클릭(blur) 시 캔버스에 `fillText()`로 확정. 빈 입력은 무시. 폰트 크기는 PDF 렌더링 크기에 비례 스케일 적용 |
| **형광펜** | 펜과 동일하되 `globalAlpha: 0.35` + 두꺼운 선폭 (두께 슬라이더 기준 × 배율) |
| **지우개** | `destination-out` compositeOperation으로 픽셀 제거 → 마우스 경로 따라 원형 클리어. 지우개 반지름은 선 두께 슬라이더에 연동. 지우개 동작은 `type: 'eraser'` stroke로 StrokeStore에 저장 |

> **실시간 미리보기 구현**: 화살표/동그라미/네모 드래그 중 미리보기는 별도 임시 캔버스(또는 draw-layer 전체 재렌더링) 방식으로 구현. `mousemove` 시마다 ① 기존 확정 strokes 전체 재드로우 ② 현재 드래그 중인 도형 미리보기 추가.

> **지우개 구현 주의사항**: `globalCompositeOperation = 'destination-out'`으로 캔버스 픽셀을 직접 지우는 방식. 단, 이 경우 캔버스가 투명해져 PDF 레이어가 비치므로 draw-layer는 반드시 PDF 레이어와 분리된 별도 캔버스여야 함 (이미 설계에 반영됨).

### 좌표 정규화 전략

```
// 입력 좌표 → 저장
normalizePoint(x, y, canvas) {
  return { x: x / canvas.width, y: y / canvas.height }
}

// 저장 좌표 → 렌더링
denormalizePoint(nx, ny, canvas) {
  return { x: nx * canvas.width, y: ny * canvas.height }
}

// 선 두께 정규화 (캔버스 너비 대비)
normalizeWidth(px, canvas) { return px / canvas.width }
denormalizeWidth(nw, canvas) { return nw * canvas.width }
```

- 모든 Stroke 저장 시 `normalizePoint` / `normalizeWidth` 적용
- 렌더링 시 `denormalizePoint` / `denormalizeWidth` 적용
- 리사이즈 / 전체화면 전환 후에도 주석이 슬라이드 기준 좌표를 유지

### 스트로크 재렌더링 전략

페이지 이동 시:
1. 현재 draw-layer 클리어
2. PDF 레이어에 새 페이지 렌더
3. `StrokeStore.get(newPage)` 로 이전 주석 불러와 **저장 순서대로 전체 재드로우** (eraser stroke 포함)

> 성능: 슬라이드당 스트로크 수가 통상 수십 개 이하이므로 전체 재드로우 방식으로 충분.

### PDF 렌더링 전략

- **Eager 렌더링**: PDF 로드 시 전체 페이지를 미리 렌더링 (lazy 아닌 eager). 슬라이드 이동 시 지연 없이 즉각 표시.
- **암호화 PDF 처리**: PDF.js의 비밀번호 지원을 활용. `onPassword` 콜백으로 비밀번호 입력 프롬프트 표시 후 재시도.
- **로딩 UI**: PDF 로드 시작 시 스피너 + "PDF 로딩 중..." 표시. 렌더링 완료 시 자동 해제 후 PRESENTING 모드 전환.

### PNG 저장 구현

```js
function saveCurrentSlideAsPNG() {
  // 1. 오프스크린 캔버스 생성 (PDF 레이어와 동일 크기)
  const offscreen = document.createElement('canvas')
  offscreen.width = pdfCanvas.width
  offscreen.height = pdfCanvas.height
  const ctx = offscreen.getContext('2d')

  // 2. PDF 레이어 합성
  ctx.drawImage(pdfCanvas, 0, 0)

  // 3. 주석 레이어 합성
  ctx.drawImage(drawCanvas, 0, 0)

  // 4. 다운로드
  const link = document.createElement('a')
  link.download = `slide-${currentPage}.png`
  link.href = offscreen.toDataURL('image/png')
  link.click()
}
```

### localStorage 설정 저장

앱 종료/재실행 시 마지막 도구/색상/두께 설정 복원:

```js
// 저장 키
const STORAGE_KEYS = {
  tool:  'lat_activeTool',
  color: 'lat_activeColor',
  width: 'lat_lineWidth',
}

// 저장: 설정 변경 시 즉시
localStorage.setItem(STORAGE_KEYS.tool, activeTool)

// 복원: 앱 초기화 시
activeTool  = localStorage.getItem(STORAGE_KEYS.tool)  ?? 'pen'
activeColor = localStorage.getItem(STORAGE_KEYS.color) ?? 'red'
lineWidth   = Number(localStorage.getItem(STORAGE_KEYS.width) ?? 4)
```

### 슬라이드 외부 영역 이벤트 차단

슬라이드 렌더링 영역(`canvas#draw-layer`) 밖에서 발생한 클릭/드래그 이벤트는 드로잉으로 처리하지 않음. `mousedown` 이벤트 핸들러에서 canvas bounding rect 기준 좌표 검증 후 범위 밖이면 무시.

### 환경 변수

없음 — 완전 로컬 실행, 서버/API 키 불필요

---

## 6. 검증 기준

| 단계 | 성공 기준 | 검증 방법 | 실패 시 처리 |
|------|---------|---------|-----------|
| PDF 렌더링 | 슬라이드가 뷰포트에 맞게 비율 유지되며 표시됨 | 브라우저 직접 확인 | PDF.js 버전 호환성 확인 후 재시도 |
| 드로잉 도구 | 각 도구가 마우스 경로대로 정확히 그려짐 | 브라우저 직접 확인 | 좌표계 오프셋 교정 |
| 실시간 미리보기 | 화살표/동그라미/네모 드래그 중 도형 미리보기가 표시됨 | 브라우저 직접 확인 | 임시 캔버스 레이어 렌더링 순서 확인 |
| 페이지 이동 | 이동 후 이전 슬라이드 주석이 보존되고 복귀 시 재표시됨 | 기능 테스트 | StrokeStore 키 매핑 확인 |
| 리사이즈 주석 정렬 | 창 크기 변경 / 전체화면 전환 후 주석이 슬라이드 기준 위치에 정확히 유지됨 | 브라우저 직접 확인 | 정규화 좌표 변환 로직 확인 |
| 지우개 복원 | 페이지 이동 후 복귀 시 지우개로 지운 영역이 올바르게 재현됨 | 기능 테스트 | eraser stroke 저장 및 재렌더링 순서 확인 |
| 초기화 | Esc 및 버튼이 현재 페이지 주석만 지움 | 기능 테스트 | 에스컬레이션 (범위 정의 재확인) |
| 전체화면 | F키로 전체화면 진입/해제, 캔버스 크기 재계산됨 | 브라우저 직접 확인 | Fullscreen API 폴백 (F11 안내) |
| 페이지 직접 입력 | 페이지 카운터 클릭 → 숫자 입력 → Enter로 해당 슬라이드 이동 | 기능 테스트 | 입력값 유효성 검증 (1 ~ totalPages 범위) |
| PNG 저장 | 저장 버튼 클릭 시 현재 슬라이드 PDF + 주석이 합성된 PNG 파일 다운로드됨 | 브라우저 직접 확인 | 오프스크린 캔버스 합성 로직 확인 |
| localStorage 복원 | 앱 재실행 시 마지막 도구/색상/두께 설정이 자동 복원됨 | 브라우저 직접 확인 | STORAGE_KEYS 매핑 및 초기화 순서 확인 |

---

## 7. 추후 방법 1 (Electron) 전환 경로

현재 `index.html` 코드는 **변경 없이** Electron에서 그대로 사용 가능.

전환 시 추가 작업:

```
lecture-overlay-app/
├── main.js          ← Electron 메인 프로세스 (투명창 생성)
│                       win.setIgnoreMouseEvents() 토글 로직
├── index.html       ← ✅ 방법 2에서 그대로 재사용
├── pdf.worker.min.js
└── package.json
```

추가 구현 포인트:
- 그리기 모드 ON/OFF 토글 버튼 → `ipcRenderer`로 메인 프로세스에 전달
- 메인 프로세스에서 `win.setIgnoreMouseEvents(true/false)` 전환
- 투명 전체화면 창 (`transparent: true`, `alwaysOnTop: true`) 생성

> **마이그레이션 비용**: 낮음. 방법 2를 완성하면 Electron 전환은 `main.js` 100줄 내외 추가 작업.

---

## 8. 참고 자료

- [PDF.js 공식 문서](https://mozilla.github.io/pdf.js/)
- [PDF.js CDN (cdnjs)](https://cdnjs.com/libraries/pdf.js)
- [Fullscreen API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API)
- [Canvas API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [HTML5 Canvas 화살촉 그리기 — Stack Overflow](https://stackoverflow.com/questions/808826/draw-arrow-on-canvas-tag)

---

## v2.0 이월 기능

- 터치 이벤트 지원 (태블릿 강의 환경)
- 레이저 포인터 모드 (커서 강조 효과)
- 주석 Undo/Redo (`Ctrl+Z`)
- 썸네일 슬라이드 네비게이터 패널
- Electron 오버레이 전환 (방법 1)
