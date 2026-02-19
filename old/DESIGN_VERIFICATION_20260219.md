# AgentCanvas 디자인 일관성 검증 리포트

**검증일:** 2026-02-19
**대상:** 전체 UI 컴포넌트, CSS 스타일시트, ScheduleView, 노드 카드 디자인
**기준 문서:** BRANDING_GUIDE.md

---

## 1. 검증 기준

BRANDING_GUIDE.md에 정의된 디자인 시스템 기준:

| 항목 | 기준값 |
|------|--------|
| 주요 색상 | `--accent: #2fa184`, `--secondary: #4a87e8`, `--warn: #d4a11e`, `--danger: #d95c4f` |
| border-radius | 기본 `var(--radius, 8px)`, 노드 카드 10~12px |
| 간격 체계 | 4px 배수 (4, 8, 12, 16, 20, 24...) |
| 폰트 크기 | 12~13px 기본, 14px 제목, VS Code 테마 상속 |
| 테마 통합 | `var(--vscode-*)` 참조로 에디터 테마 자동 반영 |

---

## 2. 전체 평가

### ✅ 양호 — CRITICAL 0건, MAJOR 0건, MINOR 4건, STYLE 2건

새로 추가된 ScheduleView와 Schedule 관련 컴포넌트가 기존 디자인 시스템을 잘 따르고 있으며, CSS 변수 기반 색상/간격 체계가 일관되게 적용되어 있습니다.

---

## 3. 발견된 이슈

### MINOR (4건)

#### D-1. modal-error 하드코딩 색상

**위치:** `webview-ui/src/styles.css` — `.modal-error`

**문제:** AgentCreationModal의 에러 표시에 `color: #e05252`가 직접 사용됨. 디자인 시스템의 `var(--danger)` (#d95c4f)와 미세하게 다른 색상값.

**해결 방안:** `color: var(--danger)`로 교체.

---

#### D-2. Schedule 태스크 상태 색상 하드코딩

**위치:** `webview-ui/src/styles.css` — `.schedule-task.status-*`

**문제:** 스케줄 태스크 노드의 상태별 색상이 CSS 변수 대신 직접 값으로 지정됨. 테마 변경 시 일괄 업데이트 불가.

**대상:** `.status-running`, `.status-done`, `.status-failed`, `.status-blocked` 클래스의 배경/테두리 색상.

**해결 방안:** 상태별 색상을 CSS 변수(예: `--schedule-running`, `--schedule-done` 등)로 추출하거나, 기존 `--accent`, `--warn`, `--danger` 변수 조합 활용.

---

#### D-3. Agent Handle / Edge 마커 색상 하드코딩

**위치:** `webview-ui/src/canvas/ScheduleView.tsx`

**문제:** 엣지 마커 색상 `#6aa7f5`가 ScheduleView.tsx에 직접 하드코딩됨. 디자인 시스템의 `--secondary` (#4a87e8)와 유사하지만 다른 값.

**해결 방안:** CSS 커스텀 프로퍼티를 JS에서 읽어 적용하는 패턴 도입. 예: `getComputedStyle(document.documentElement).getPropertyValue('--secondary')`

---

#### D-4. border-radius 이상치

**위치:** `webview-ui/src/styles.css` 전역

**문제:** 대부분 `var(--radius, 8px)`, `10px`, `12px`를 일관 사용하나 일부 이상치 존재:

| 값 | 위치 | 비고 |
|----|------|------|
| `6px` | `.prompt-canvas-container .results-header` | 기본 8px 대비 작음 |
| `7px` | `.skill-wizard-modal .step-card` | 8px도 6px도 아닌 중간값 |
| `15px` | `.skill-wizard-modal .step-card .step-number` | pill 형태 의도인지 불명확 |

**해결 방안:** `6px → var(--radius, 8px)`, `7px → var(--radius, 8px)`, `15px → 50%` (완전 원형) 또는 기존 값 유지 후 주석으로 의도 명시.

---

### STYLE (2건)

#### S-1. active-toggle !important 사용

**위치:** `webview-ui/src/styles.css` — `.active-toggle`

**문제:** `!important` 사용은 CSS 스타일 우선순위를 강제하는 안티패턴. specificity 충돌로 인한 임시 해결책이나, 장기적으로 유지보수 어려움 초래.

**해결 방안:** 선택자 specificity를 높이거나 (예: `.toolbar .active-toggle`), CSS 구조를 정리하여 `!important` 불필요하게 변경.

---

#### S-2. ScheduleView clamp/clampNumber 함수 중복

**위치:** `webview-ui/src/canvas/ScheduleView.tsx` (line 301~307)

**문제:** 동일 로직의 `clamp()`과 `clampNumber()` 두 함수가 존재. 하나로 통합 가능.

**해결 방안:** 하나의 함수로 통합 후 나머지 제거.

---

## 4. 잘 구현된 디자인 요소

| 항목 | 평가 |
|------|------|
| **CSS 변수 체계** | `:root` 레벨에서 색상, 간격, 반경 등을 일괄 관리 — 테마 일관성 확보 |
| **노드 카드 패턴** | agent, skill, ruleDoc, note, folder, commonRules 등 모든 노드가 `.node-card` 기반 클래스를 공유 — 시각적 통일성 |
| **ScheduleView 레인/태스크** | 간트 차트 스타일이 기존 캔버스 노드 UI와 조화롭게 디자인됨 |
| **반응형 타임라인** | 동적 `pxPerSec` 계산으로 데이터 양에 따라 적절한 너비 자동 조절 |
| **VS Code 테마 상속** | `var(--vscode-*)` 참조로 사용자 에디터 테마와 자연스럽게 통합 |
| **4px 그리드 체계** | 패딩/마진이 4px 배수로 일관 적용 (4, 8, 12, 16, 20, 24) |
| **폰트 크기 체계** | 12~13px 본문, 14px 제목으로 가독성 확보, VS Code 테마 폰트 상속 |

---

## 5. 권장 수정 우선순위

| 우선순위 | 이슈 | 난이도 |
|----------|------|--------|
| 1순위 | D-1 modal-error 색상 → `var(--danger)` | 1줄 수정 |
| 1순위 | D-2 Schedule 상태 색상 → CSS 변수화 | ~10줄 수정 |
| 2순위 | D-3 Edge 마커 색상 → `--secondary` 통일 | JS 1곳 수정 |
| 2순위 | D-4 border-radius 이상치 정리 | 3곳 수정 |
| 3순위 | S-1 !important 제거 | specificity 분석 필요 |
| 3순위 | S-2 clamp 함수 통합 | 단순 리팩터링 |

---

*이 리포트는 AgentCanvas 프로젝트의 BRANDING_GUIDE.md 기준 디자인 일관성 검증 결과입니다.*
