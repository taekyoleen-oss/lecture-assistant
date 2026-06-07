---
name: lecture-harness
description: 강의 어노테이션 도구(lecture-annotation-tool)의 기능 추가·개선·버그수정 작업을 조율하는 오케스트레이터. 구현(annotation-dev) → 검증(canvas-qa) → UX검수(lecture-ux-reviewer)의 생성-검증 파이프라인을 운영한다. "어노테이션/강의 도구에 기능 추가", "도구 개선", "버그 수정", "다시 실행/재실행/업데이트/보완", "레이저·줌·실행취소·타이머 등 추가", "강의 도구 QA/UX 점검" 요청 시 반드시 이 스킬을 사용할 것. 단순 질문은 직접 응답 가능.
---

# lecture-harness — 강의 도구 개발 오케스트레이터

강의 어노테이션 도구의 개선 작업을 **생성-검증 파이프라인**으로 조율한다.
대상 앱은 단일 파일 `lecture-annotation-tool/index.html`(+`server.js`).

## 실행 모드: 하이브리드 (서브 에이전트 파이프라인 + 병렬 리뷰)

**왜 팀 동시편집이 아닌가:** 앱이 *단일 HTML 파일*이라 여러 에이전트가 동시에
같은 파일을 편집하면 충돌한다. 따라서 **구현은 순차(서브 에이전트)**로,
**검증·검수는 구현 후 병렬(읽기 중심)**로 운영한다.

```
[오케스트레이터 = 메인]
   Phase 0  컨텍스트 확인 (초기 / 후속 / 부분 재실행 판별)
   Phase 1  계획 — 기능 분해, 우선순위, 단축키 충돌 점검
   Phase 2  구현    → Agent(annotation-dev)              [순차]
   Phase 3  검증·검수 → Agent(canvas-qa) + Agent(lecture-ux-reviewer) [병렬]
   Phase 4  반려 수정 → annotation-dev 재호출 (FAIL/P0·P1 있으면)
   Phase 5  종합 보고 + 피드백 수집(Phase 7 진화)
```

모든 `Agent` 호출에 **`model: "opus"`** 를 명시한다.

## Phase 0: 컨텍스트 확인
1. `_workspace/` 존재 여부 확인.
   - 없음 → **초기 실행**
   - 있음 + 사용자가 부분 수정 요청 → **부분 재실행**(해당 에이전트만 재호출,
     이전 산출물 전달)
   - 있음 + 새 작업 → 기존 `_workspace/`를 `_workspace_prev/`로 이동 후 **새 실행**
2. 작업 디렉토리: `lecture-annotation-tool/_workspace/` 사용(중간 산출물 보존).

## Phase 1: 계획
- 요청을 개별 기능 단위로 분해(각각 SKILL §3 "새 도구 추가 체크리스트" 대상인지 판단).
- **단축키/도구 충돌**을 미리 점검(현재 사용 중: `1~9` 도구, 화살표 페이지,
  `Esc` 초기화/present종료, `F` 전체화면, `Ctrl+C/V` 개체). 신규 키는 빈 키 우선.
- 한 번에 너무 많이 넣지 말 것 — 기능을 작은 단위로 순차 구현·검증.
- 우선순위가 모호하면 사용자에게 1회 확인.

## Phase 2: 구현 (순차)
- `Agent(subagent_type: "annotation-dev", model: "opus")`로 한 기능씩 구현 요청.
- 전달 내용: 기능 명세(이름·동작·단축키·UI 위치), 참조할 스킬(`annotation-feature-dev`),
  이전 `_workspace/` 산출물 경로.
- 여러 기능이면 **순차로** 호출(같은 파일 편집 충돌 방지). 각 구현 후 즉시 Phase 3.

## Phase 3: 검증·검수 (병렬, 읽기 중심)
- `Agent(canvas-qa, model: "opus", run_in_background: true)` — 브라우저 실측.
- `Agent(lecture-ux-reviewer, model: "opus", run_in_background: true)` — UX 검수.
- 두 에이전트는 파일을 (거의) 수정하지 않으므로 병렬 안전. 결과는 `_workspace/`에 리포트.

## Phase 4: 반려 수정
- QA의 FAIL 또는 UX의 P0/P1이 있으면 `annotation-dev`를 재호출해 수정.
- 1회 수정 후 재검증. 재실패 시 근본 원인 재조사(`systematic-debugging` 관점).
- 2회 반복해도 안 되면 해당 항목을 "미해결"로 보고서에 명시하고 진행(차단 금지).

## Phase 5: 종합 보고 + 진화
- 변경 요약, QA 결과, UX 결과, 미해결 항목을 사용자에게 보고.
- 사용자에게 피드백 1회 요청("바꾸고 싶은 점이 있나요?").
- 변경된 에이전트/스킬이 있으면 **CLAUDE.md 변경 이력** 갱신(아래 7-3).

## 데이터 전달 프로토콜
- **파일 기반**(주): `lecture-annotation-tool/_workspace/NN_{agent}_{artifact}.md`
- **반환값 기반**: 서브 에이전트 결과 요약을 메인이 수집·종합
- 최종 코드 변경만 `index.html`/`server.js`에 반영, 중간 리포트는 `_workspace/` 보존

## 에러 핸들링
- 에이전트 실패 → 1회 재시도 → 재실패 시 해당 결과 없이 진행하고 보고서에 누락 명시.
- 상충하는 QA/UX 의견 → 삭제하지 말고 양쪽 출처를 병기해 사용자 판단에 맡김.
- 앱이 구동 안 되면(CSP/CDN/서버) 기능 테스트보다 구동 복구를 최우선.

## 팀 구성
| 에이전트 | 타입 | 역할 | 스킬 |
|----------|------|------|------|
| annotation-dev | general-purpose | 기능 구현·버그 수정 | annotation-feature-dev |
| canvas-qa | general-purpose | 브라우저 실측 QA | canvas-qa |
| lecture-ux-reviewer | general-purpose | 강의 UX 검수 | lecture-ux-review |

## 테스트 시나리오
- **정상 흐름:** "레이저 포인터 추가" → 계획(단축키 확인) → annotation-dev 구현 →
  canvas-qa(저장 안 됨·페이지이동 시 사라짐 확인) + ux-reviewer(가시성) 병렬 →
  통과 → 보고.
- **에러 흐름:** QA가 "페이지 넘기면 도형 사라짐" FAIL → 원인=redraw 케이스 누락 →
  annotation-dev 재호출 수정 → 재검증 PASS → 보고.

## 후속 작업 (재실행)
- "방금 추가한 줌 좀 더 부드럽게", "레이저 색 바꿔줘" 등 → Phase 0에서 부분 재실행으로
  판별 → annotation-dev만 이전 산출물 기반으로 재호출.
