# 강의 특화 기능 구현 설계 노트

강의 어노테이션 도구에 자주 요청되는 기능들의 구현 설계. 각 항목은 **왜 필요한지**,
**핵심 설계**, **주의점**을 담는다. 코드는 기존 `index.html` 컨벤션
(`$()`, 모듈 객체, `nPt/dPt`, `CanvasManager.redraw`)에 맞춰 작성한다.

## 목차
1. Undo / Redo (실행취소·다시실행)
2. 레이저 포인터
3. 스포트라이트 / 화면 어둡게
4. 줌 (확대/축소)
5. 검은 화면 / 흰 화면 (B/W blank)
6. 강의 타이머 / 스톱워치
7. 스탬프 / 도장

---

## 1. Undo / Redo
**왜:** 어노테이션 도구의 가장 기본적인 기대 기능인데 현재 없음. 강의 중 잘못 그린
선을 한 번에 되돌리는 것은 필수.

**핵심 설계 — 명령 스택이 아니라 스냅샷 방식 권장:**
- 이 앱은 `redraw()`가 stroke 배열 전체를 재적용하는 구조라, **페이지별 stroke 배열의
  스냅샷**을 쌓는 것이 가장 단순·견고하다.
- `UndoStack` 모듈:
  ```js
  const History = {
    undo: {},  // { [page]: Stroke[][] }
    redo: {},
    snapshot(page) {  // 변경 "직전"에 호출
      (this.undo[page] ||= []).push(JSON.stringify(StrokeStore.get(page)));
      this.redo[page] = [];
      if (this.undo[page].length > 50) this.undo[page].shift(); // 메모리 상한
    },
    restore(page, from, to) {
      const cur = JSON.stringify(StrokeStore.get(page));
      const snap = from.pop(); if (snap == null) return;
      to.push(cur);
      state.strokes[page] = JSON.parse(snap);
      CanvasManager.redraw();
    },
    undoOnce(p){ this.restore(p, this.undo[p]||=[], this.redo[p]||=[]); },
    redoOnce(p){ this.restore(p, this.redo[p]||=[], this.undo[p]||=[]); },
  };
  ```
- **`snapshot(page)` 호출 지점:** stroke가 추가/삭제/이동/크기변경되기 *직전*.
  구체적으로 mouseup에서 `StrokeStore.add` 직전, 지우개 시작 직전, SelectTool의
  이동/리사이즈/삭제/붙여넣기 직전, `clear`(Esc·초기화) 직전.
- **단축키:** `Ctrl+Z` = undo, `Ctrl+Shift+Z` 또는 `Ctrl+Y` = redo.
  `KeyboardHandler`의 `keydown`에서 `e.ctrlKey||e.metaKey` 분기로 처리하고
  `e.preventDefault()`.
- **툴바 버튼** ↶ ↷ 추가 권장(가시성).

**주의:** input 포커스 중에는 통과(텍스트 편집 우선). 페이지별로 스택 분리.

---

## 2. 레이저 포인터
**왜:** 강의 중 마크를 남기지 않고 특정 부분을 가리키는 것. 발표자 필수 도구.

**핵심 설계 — stroke로 저장하지 않는다:**
- 도구 `data-tool="laser"` 추가(§ SKILL §3, 단 stroke 저장 단계는 제외).
- 마우스를 누르거나(혹은 그냥 이동) 할 때 draw-layer 위에 빨간 발광 점을 그린다.
  잔상(트레일)을 주면 더 잘 보인다:
  ```js
  // 최근 N개 좌표를 보관, 매 프레임 redraw() 후 점+꼬리 그림
  laserTrail.push({x,y,t:performance.now()});
  // 오래된 점 제거 후, 반경 큰 반투명 빨강 + 중앙 진한 빨강(글로우)로 렌더
  ```
- 페이지 이동·도구 변경 시 트레일 비움. **저장물(PNG/StrokeStore)에 포함 안 됨.**
- `requestAnimationFrame` 루프로 잔상 페이드. 레이저 활성 중에만 루프 가동(성능).

**주의:** redraw()가 주석을 매 프레임 다시 그리므로, 레이저는 redraw 위에 오버레이로
그리거나 별도 최상위 캔버스를 쓴다. 빔프로젝터 가시성을 위해 점을 크게(반경 8~12px).

---

## 3. 스포트라이트 / 화면 어둡게
**왜:** 슬라이드의 한 영역에 청중 시선을 집중시킴.

**핵심 설계:**
- 전체를 덮는 반투명 검정 오버레이(`position:fixed; background:rgba(0,0,0,.6)`)를 두고,
  마우스 주변만 원형으로 투명하게 "구멍"을 낸다.
- 구현은 캔버스가 깔끔: 오버레이 캔버스를 검정으로 채운 뒤
  `ctx.globalCompositeOperation='destination-out'`으로 마우스 위치에 원을 그려 구멍.
  또는 CSS `radial-gradient` mask로도 가능.
- 토글 단축키(예: `L` 또는 전용 버튼). 휠로 스포트라이트 반경 조절.

**주의:** present(전체보기) 모드와 잘 어울려야 하고, 청중 화면에만 보이도록 z-index 관리.

---

## 4. 줌 (확대/축소)
**왜:** 작은 도표·코드·수식을 강의 중 크게 보여줌.

**핵심 설계 — 두 캔버스에 동일 transform:**
- `#canvas-wrapper`에 CSS `transform: scale(z) translate(...)`를 적용하면 PDF·주석
  레이어가 함께 확대되어 좌표 정규화가 그대로 유지된다(가장 간단).
- `Ctrl + 휠` 또는 `+/-` 키로 배율, 드래그(또는 space+드래그)로 패닝.
- 단, transform 사용 시 **입력 좌표 변환**에 주의: `getCanvasPos`가 `getBoundingClientRect`
  기반이면 scale 반영되어 대체로 정상. 검증 필수.

**주의:** 확대 상태에서 그린 주석도 정규화로 저장되어야 함. 줌 리셋 단축키(`0`) 제공.

---

## 5. 검은 화면 / 흰 화면 (Blank)
**왜:** PowerPoint 표준(`B`/`W`). 잠깐 화면을 비워 청중 주의를 발표자로 돌리거나,
흰 화면을 임시 화이트보드로 사용.

**핵심 설계:**
- 최상위 전체 덮개 요소(`#blank-overlay`) 하나. `B`=검정, `W`=흰색 토글.
- 같은 키 다시 누르거나 아무 키/클릭 시 해제.
- 흰 화면 위에는 펜으로 그릴 수 있게 하면 임시 화이트보드가 된다(별도 빈 페이지처럼 취급).

**주의:** 단축키가 기존 `1~9` 도구키와 겹치지 않게. `B`/`W`는 비어 있으므로 적합.

---

## 6. 강의 타이머 / 스톱워치
**왜:** 강의 시간 관리. 경과 시간·남은 시간 표시.

**핵심 설계:**
- 작은 플로팅 위젯(`position:fixed; top:...`). 시작/정지/리셋.
- 스톱워치(경과) + 카운트다운(설정 시간) 두 모드.
- `setInterval(…, 1000)`로 갱신, present 모드에서도 보이게(강사용)하되 위치·크기는
  청중 방해 최소화. 색상 테마 변수 사용.

**주의:** 탭 비활성 시 setInterval 드리프트 → `Date.now()` 기준으로 경과 계산.

---

## 7. 스탬프 / 도장
**왜:** ✓ ✗ ★ 같은 기호를 빠르게 찍어 채점·강조.

**핵심 설계:** `type:'stamp'` stroke(`{glyph, pos, size}` 정규화). 클릭 위치에 이모지/기호
렌더. redraw 케이스 추가. 색·크기는 현재 색/두께 연동.

**주의:** 텍스트 도구와 구분되는 단축 동작(클릭 한 번에 찍힘).
