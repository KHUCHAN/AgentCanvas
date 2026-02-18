# Open Canvas 코드 리뷰

> 리뷰 일자: 2026-02-18
> 대상: extension/src (백엔드) + webview-ui/src (프론트엔드) 전체 소스

---

## 요약

| 카테고리 | 심각도 높음 | 중간 | 낮음 |
|---------|-----------|------|------|
| 보안 취약점 | 5 | 4 | 2 |
| 타입 안전성 | 3 | 5 | 3 |
| 에러 처리 | 4 | 6 | 3 |
| 성능 | 1 | 6 | 4 |
| 아키텍처/설계 | 2 | 5 | 3 |
| 코드 중복 | 0 | 8 | 4 |
| 접근성(a11y) | 3 | 5 | 2 |
| 빌드/설정 | 0 | 3 | 2 |

---

## 1. 보안 취약점 (긴급)

### 1-1. Zip 경로 탐색 공격 (zipPack.ts)

zip 파일 내 파일명이 `../../etc/passwd` 같은 경로를 포함할 경우, 의도하지 않은 위치에 파일이 풀릴 수 있습니다.

**위치:** `zipPack.ts` — `extractFolder()`, `installSkill()`

**문제 코드:**
```typescript
// originalName이 악성 zip에서 온 경우 "../../../" 포함 가능
const targetDir = join(input.installDir, originalName);
```

**권장 수정:**
```typescript
const safeName = path.basename(originalName); // 경로 구분자 제거
const resolved = path.resolve(input.installDir, safeName);
if (!resolved.startsWith(path.resolve(input.installDir))) {
  throw new Error("Path traversal detected");
}
```

### 1-2. XSS in 폴백 HTML (extension.ts)

`fallbackHtml()` 함수에서 메시지 파라미터를 이스케이프 없이 HTML에 삽입합니다.

**위치:** `extension.ts` 약 317행

**문제 코드:**
```typescript
function fallbackHtml(message: string) {
  return `<body><p>${message}</p></body>`; // message에 <script> 포함 가능
}
```

**권장 수정:** HTML 이스케이프 유틸 적용 (`<`, `>`, `&`, `"`, `'` 치환)

### 1-3. 약한 CSP Nonce 생성 (extension.ts)

`Date.now().toString(36)`는 예측 가능합니다. CSP nonce는 암호학적 랜덤이어야 합니다.

**위치:** `extension.ts` 약 287행, 738행

**권장 수정:**
```typescript
import { randomBytes } from "crypto";
const nonce = randomBytes(16).toString("base64");
```

### 1-4. 개발 모드 unsafe-eval (extension.ts)

dev 서버 모드에서 CSP에 `'unsafe-eval'`이 포함됩니다. 프로덕션에 포함되지 않도록 분기 확인 필요.

### 1-5. 스킬 생성 시 경로 탐색 (createSkill.ts)

`cleanName`에 `../../`가 포함되면 의도치 않은 디렉토리에 파일이 생성될 수 있습니다.

**권장 수정:** `cleanName`에서 경로 구분자(`/`, `\`)를 제거하고, `resolve` 결과가 `baseDirPath` 내부인지 검증

---

## 2. 타입 안전성

### 2-1. Record<string, unknown> 남용 (types.ts, protocol.ts)

`StudioNode.data`가 `Record<string, unknown>`으로 선언되어, 노드 타입별 데이터 구조가 타입 시스템에서 보장되지 않습니다. 프론트엔드 전반에서 `as Record<string, unknown>` 캐스팅이 반복됩니다.

**영향 범위:**
- `GraphView.tsx` — `node.data as Record<string, unknown>`
- `RightPanel.tsx` — `(node?.data ?? {}) as Record<string, unknown>`
- `tidyLayout.ts` — `skill.data as Record<string, unknown>`

**권장 수정:** 노드 타입별 discriminated union 정의
```typescript
type SkillNodeData = { type: "skill"; name: string; path: string; validation: ValidationItem[]; ... };
type RuleDocNodeData = { type: "ruleDoc"; title: string; chain: number; ... };
type StudioNodeData = SkillNodeData | RuleDocNodeData | ProviderNodeData | ...;
```

### 2-2. Zip 매니페스트 검증 부재 (zipPack.ts)

`JSON.parse()` 결과를 `as SkillPackManifest`로 캐스팅하지만, 실제 구조 검증이 없습니다. 이미 프로젝트에 Zod가 있으므로 활용하면 됩니다.

### 2-3. 메시지 페이로드 검증 부재 (vscodeBridge.ts)

확장에서 오는 메시지의 `type`만 체크하고 페이로드 구조는 검증하지 않습니다.

---

## 3. 에러 처리

### 3-1. 파일 I/O 에러 무시

여러 서비스에서 `readFile`, `writeFile`, `mkdir` 호출에 try-catch가 없습니다.

**영향 파일:**
- `skillParser.ts` — `readFile()` 에러 미처리
- `skillEditor.ts` — 파일 읽기/쓰기 에러 미처리
- `createSkill.ts` — `mkdir()` 에러 미처리
- `zipPack.ts` — `readFile()`, `readdir()`, `JSZip.loadAsync()` 에러 미처리

### 3-2. 무한 루프 가능성 (pathUtils.ts, codexAgentsDiscovery.ts)

디렉토리 상위 탐색 로직에 최대 반복 횟수 제한이 없습니다. 권한 문제로 `.git` 확인이 실패하면 무한 루프에 빠질 수 있습니다.

**권장 수정:** `MAX_DEPTH = 50` 같은 상한선 추가

### 3-3. 에러 정보 삼킴 (codexAgentsDiscovery.ts)

`readCodexConfig()` 등에서 모든 에러를 조용히 삼켜서 디버깅이 어렵습니다.

**권장 수정:** 최소한 `console.warn()` 또는 구조화된 로깅 추가

### 3-4. 프론트엔드 에러 바운더리 부재

React `<ErrorBoundary>` 컴포넌트가 없어서 하위 컴포넌트 에러가 전체 UI를 깨뜨립니다.

---

## 4. 성능

### 4-1. 핸들러 리렌더링 문제 (App.tsx → GraphView.tsx)

`App.tsx`에서 20개 이상의 콜백을 props로 전달하는데, `useCallback`으로 감싸지 않아 App이 리렌더될 때마다 모든 하위 컴포넌트의 `useMemo`가 무효화됩니다.

**권장 수정:** 핵심 핸들러를 `useCallback`으로 메모이제이션

### 4-2. 유효성 검증 카운트 반복 계산

`SkillNode.tsx`, `RightPanel.tsx (LibrarySkillItem)`에서 `validation.filter()` 로 에러/경고 카운트를 매 렌더마다 재계산합니다.

**권장 수정:** `useMemo` 적용

### 4-3. 레이아웃 캐싱 부재

`applyDagreLayout()`이 호출마다 새 Graph 객체를 생성합니다. 동일한 그래프 구조에 대해 캐싱하면 좋습니다.

### 4-4. 검색 필터 디바운싱 부재

`CommandBar.tsx`, `RightPanel.tsx`의 검색 필터가 키 입력마다 즉시 실행됩니다. 스킬이 많아지면 버벅일 수 있습니다.

---

## 5. 아키텍처/설계

### 5-1. App.tsx 거대 컴포넌트 (551행)

상태 11개 + 핸들러 20개 이상이 하나의 컴포넌트에 집중되어 있습니다.

**권장 수정:**
- Context API 또는 상태 관리 라이브러리(zustand 등) 도입
- `useSkillActions()`, `useCanvasState()` 같은 커스텀 훅으로 분리

### 5-2. Prop Drilling 심각

`GraphView`에 15개, `RightPanel`에 11개의 props가 전달됩니다.

**권장 수정:** 공유 상태는 Context로, 액션은 커스텀 훅으로 분리

### 5-3. 메시지 프로토콜 추상화 부족

확장-웹뷰 통신이 직접 `postMessage`/`onMessage`로 처리됩니다. 프로토콜 변경 시 양쪽 모두 수정해야 합니다.

**권장 수정:** `useExtensionApi()` 같은 고수준 API 훅 도입
```typescript
const api = useExtensionApi();
await api.openFile(path);
await api.createSkill({ name, description, scope });
```

### 5-4. RightPanel.tsx 분리 필요 (356행)

Library 모드와 Inspector 모드를 하나의 파일에서 처리합니다. `LibraryPanel.tsx`와 `InspectorPanel.tsx`로 분리하면 가독성과 유지보수성이 향상됩니다.

### 5-5. 하드코딩된 좌표값

`discovery.ts`에서 노드 위치를 하드코딩 (`x: 360, y: 80`)하고, `tidyLayout.ts`에서도 매직넘버가 다수 사용됩니다.

**권장 수정:** `LAYOUT_CONSTANTS` 객체로 추출

---

## 6. 코드 중복

### 6-1. 핸들러 팩토리 패턴으로 통합 가능 (App.tsx)

```typescript
// 현재: 동일 패턴이 반복됨
const openFile = (path: string) => { if (!path) return; postToExtension({...}); };
const revealPath = (path: string) => { if (!path) return; postToExtension({...}); };
const validateSkill = (id: string) => { if (!id) return; postToExtension({...}); };
```

**권장 수정:**
```typescript
function makeAction<T>(type: string) {
  return (payload: T) => { if (!payload) return; postToExtension({ type, payload }); };
}
```

### 6-2. 노드 메뉴 컴포넌트 추출

`SkillNode.tsx`와 `RuleDocNode.tsx`에서 메뉴 토글 로직이 동일하게 반복됩니다. `<NodeMenu>` 공통 컴포넌트로 추출 가능합니다.

### 6-3. 유효성 검증 에러 카운트 헬퍼

```typescript
// 3곳에서 반복됨
const errorCount = validation.filter(v => v.level === "error").length;
const warningCount = validation.filter(v => v.level === "warning").length;
```

`getValidationCounts(validation)` 유틸 함수로 통합 가능합니다.

### 6-4. 모달 초기화 패턴

`CommonRuleModal`, `SkillWizardModal`, `ImportPreviewModal` 모두 `useEffect`로 `open` 변경 시 상태를 리셋합니다. `useModalReset()` 커스텀 훅으로 통합 가능합니다.

### 6-5. CSP 구성 로직 중복 (extension.ts)

`buildWebviewHtml()`과 `buildDevServerHtml()`에서 CSP 문자열 구성이 중복됩니다. 공통 함수로 추출 가능합니다.

---

## 7. 접근성(a11y)

### 7-1. 모달에 role="dialog" 누락

모든 모달(`SkillWizardModal`, `ImportPreviewModal`, `CommonRuleModal`)에 `role="dialog"`, `aria-modal="true"`, 포커스 트랩이 없습니다.

### 7-2. 버튼 레이블 부재

캔버스 컨트롤 버튼들 (`+`, `-`, `0`, `1`)에 `aria-label`이 없습니다. 스크린 리더 사용자가 기능을 알 수 없습니다.

### 7-3. 색상만으로 구분되는 노드 타입

노드 타입이 좌측 border 색상으로만 구분됩니다. 색각 이상 사용자를 위해 아이콘 등 추가적인 시각 단서가 필요합니다.

### 7-4. prefers-reduced-motion 미지원

Toast 애니메이션에 `prefers-reduced-motion` 미디어 쿼리가 없습니다.

### 7-5. 키보드 네비게이션 불완전

많은 인터랙티브 요소가 클릭만 지원하고 키보드 이벤트를 처리하지 않습니다.

---

## 8. 빌드/설정

### 8-1. 테스트 인프라 부재

`package.json`에 테스트 스크립트(`test`, `lint`)가 없고, 테스트 프레임워크가 설치되지 않았습니다.

**권장:** vitest + @testing-library/react 도입

### 8-2. ESLint/Prettier 미설정

코드 스타일 일관성을 위한 린터가 없습니다. 특히 React hooks 의존성 배열 관련 실수를 잡기 위해 `eslint-plugin-react-hooks`가 필요합니다.

### 8-3. 의존성 버전 관리

`package.json`에서 `^` 범위로 의존성을 지정하고 있어 재현 불가능한 빌드가 발생할 수 있습니다. 중요 의존성은 정확한 버전을 고정하는 것이 좋습니다.

---

## 우선순위별 권장 조치

### 즉시 조치 (보안)

1. `zipPack.ts` — 경로 탐색 방어 코드 추가
2. `extension.ts` — fallback HTML XSS 방어, CSP nonce를 crypto.randomBytes로 변경
3. `createSkill.ts` — 스킬 이름에서 경로 구분자 제거 및 결과 경로 검증

### 단기 조치 (안정성)

4. 파일 I/O 전체에 try-catch 추가 (skillParser, skillEditor, createSkill, zipPack)
5. 무한 루프 방지를 위한 반복 상한 추가
6. React ErrorBoundary 추가
7. Zod 스키마로 zip 매니페스트 및 메시지 페이로드 검증

### 중기 조치 (코드 품질)

8. 노드 데이터 타입을 discriminated union으로 리팩토링
9. App.tsx에서 상태 관리를 Context/커스텀 훅으로 분리
10. 공통 컴포넌트/유틸 추출 (NodeMenu, validation counts, 핸들러 팩토리)
11. ESLint + Prettier 설정
12. 기본 테스트 인프라 구축

### 장기 조치 (품질 향상)

13. 접근성 개선 (ARIA 속성, 포커스 관리, 키보드 네비게이션)
14. 성능 최적화 (useCallback, 디바운싱, 레이아웃 캐싱)
15. 메시지 프로토콜 추상화 레이어 도입
16. 레이아웃 상수 중앙 관리

---
---

# UI / UX / 디자인 개선사항

> 분석 범위: 전체 레이아웃, 노드 디자인, 패널 인터랙션, 모달 플로우, CSS 시스템

---

## 요약

| 카테고리 | 심각도 높음 | 중간 | 낮음 |
|---------|-----------|------|------|
| 레이아웃/구조 | 2 | 4 | 2 |
| 노드 카드 디자인 | 1 | 5 | 3 |
| 인터랙션/피드백 | 3 | 5 | 2 |
| 모달/폼 UX | 2 | 4 | 2 |
| 비주얼 디자인 시스템 | 1 | 4 | 3 |
| 반응형/적응형 | 2 | 3 | 1 |

---

## 9. 전체 레이아웃

### 9-1. 좌측 사이드바가 정적 텍스트로만 구성됨

`LeftSidebar.tsx`의 섹션들(Providers, Agents, Skills, Packs, Settings)이 클릭 불가능한 단순 텍스트 목록입니다. n8n이나 Retool 같은 캔버스 도구에서 좌측 사이드바는 드래그 가능한 노드 팔레트이거나 네비게이션 역할을 하는데, 현재는 어떤 인터랙션도 없어서 공간 낭비입니다.

**권장 수정:**
- 각 항목을 클릭하면 해당 노드로 캔버스 포커스 이동
- 또는 드래그 앤 드롭으로 노드 추가 가능하게 변경
- 최소한 각 섹션에 접기/펼치기(collapse) 기능 추가

### 9-2. 상단 액션 바 버튼 과밀 (10개 버튼)

`top-actions` 영역에 New Skill, Refresh, Export Pack, Import Pack, Validate, Common Rule, Save, History, Command Bar, Hide/Show Panel까지 10개 버튼이 한 줄에 나열됩니다. 화면 너비가 좁으면 `flex-wrap`으로 2줄로 넘어가지만, 시각적 계층 구조가 없어서 어떤 버튼이 중요한지 구분하기 어렵습니다.

**권장 수정:**
- 주요 액션(New Skill, Refresh)만 노출하고 나머지는 `...` 메뉴로 그룹화
- 또는 아이콘 + 툴팁 패턴으로 공간 절약
- History 버튼은 "roadmap item" 토스트만 띄우므로 아예 제거하거나 비활성 상태로 표시

### 9-3. 상태 바(Status Bar) 정보 부족

`status-bar`에 "Skills 3 Rules 2 Errors 0 Warnings 1 Focus Canvas"가 텍스트로만 나열됩니다. 각 항목이 무엇을 의미하는지 라벨이 불명확하고, "Focus Canvas"는 문맥이 불분명합니다.

**권장 수정:**
- 아이콘 + 숫자 조합으로 변경 (에러는 빨간 원, 경고는 노란 원)
- 클릭하면 해당 필터가 적용된 목록으로 이동
- "Focus Canvas" 제거 또는 기능 구현 (클릭 시 캔버스에 포커스)

### 9-4. 오른쪽 패널과 캔버스 비율 제어 불가

`right-panel`이 `width: min(380px, 42vw)`로 고정되어 있고 리사이즈가 불가능합니다.

**권장 수정:** 리사이즈 핸들(드래그 바) 추가하여 사용자가 패널 너비 조절 가능하게

---

## 10. 노드 카드 디자인

### 10-1. 노드 정보 밀도 불균형

각 노드 타입별 정보량 차이가 큽니다:
- **AgentNode**: 이름 + provider ID만 표시 (너무 적음)
- **SkillNode**: 이름, 설명, scope, enabled 상태, validation 카운트까지 (적절)
- **RuleDocNode**: 순서 번호 + 전체 파일 경로 (경로가 너무 길어 카드 깨짐)
- **FolderNode**: 제목 + 전체 경로

**RuleDocNode 문제:** `node-path` 클래스에 `word-break: break-all`이 적용되어 있지만, 긴 경로(`/Users/gimchan-yeong/Desktop/Open Claw/.github/skills/...`)가 카드 영역을 과도하게 차지합니다.

**권장 수정:**
- 경로를 말줄임(`text-overflow: ellipsis`)으로 처리하고 hover 시 전체 경로 표시
- AgentNode에 더 많은 정보 표시 (연결된 스킬 수, 상태 등)
- 모든 노드에 아이콘 추가하여 시각적 구분 강화

### 10-2. 호버 액션 접근성 문제

`hover-actions`가 CSS `:hover` 상태에서만 표시됩니다. 터치 디바이스에서는 호버가 없어서 액션 버튼에 접근할 수 없습니다. 또한 탭 포커스로도 표시되지 않습니다.

**권장 수정:**
- `:focus-within` 상태에서도 표시
- 터치 디바이스에서는 탭으로 표시 또는 항상 노출

### 10-3. 노드 메뉴 위치 문제

SkillNode, RuleDocNode의 `node-menu`가 노드 카드 내부에 렌더링됩니다. 노드가 캔버스 하단에 있으면 메뉴가 캔버스 바깥으로 잘릴 수 있습니다.

**권장 수정:** Portal이나 position: fixed로 메뉴를 캔버스 위에 렌더링하여 잘림 방지

### 10-4. 노드 선택 상태 피드백 미약

선택된 노드는 `border-color`와 `box-shadow`만 약간 변합니다. n8n에서는 선택된 노드에 진한 하이라이트와 리사이즈 핸들이 표시됩니다.

**권장 수정:** 선택 시 border 두께 증가, 배경색 변경, 또는 글로우 효과 강화

### 10-5. 노드 너비 고정 (230px)

모든 노드가 `width: 230px`로 고정되어 있습니다. 긴 이름이나 설명이 잘립니다.

**권장 수정:** `min-width: 230px; max-width: 360px`로 변경하고 내용에 따라 자동 확장

---

## 11. 인터랙션 / 피드백

### 11-1. 토스트 메시지 단일 채널

토스트가 하나만 표시 가능합니다. 빠르게 연속 동작을 수행하면 이전 토스트가 사라지고 새 토스트로 교체됩니다.

**권장 수정:** 토스트 큐(스택) 구현 — 여러 토스트를 순차적으로 표시하거나 쌓아서 표시

### 11-2. 로딩 상태 피드백 부족

`busy` 상태일 때 `<button disabled>Working...</button>`만 표시됩니다. 어떤 작업이 진행 중인지, 얼마나 걸리는지 알 수 없습니다.

**권장 수정:**
- 스피너 또는 프로그레스 바 추가
- 구체적인 상태 메시지 표시 ("Validating 12 skills...", "Exporting pack...")
- 캔버스 오버레이로 블로킹 UI 표시 (긴 작업 시)

### 11-3. 빈 캔버스 온보딩 빈약

`empty-placeholder`에 "Add first step" + "Discover skills and rules in one click"만 표시됩니다. 처음 사용하는 사용자가 이 도구가 무엇이고 어떻게 시작하는지 이해하기 어렵습니다.

**권장 수정:**
- 가이드 일러스트레이션 추가
- 단계별 온보딩 ("1. Scan workspace → 2. Review discovered skills → 3. Edit & export")
- 또는 샘플 데이터로 미리 채운 데모 모드 제공

### 11-4. Undo/Redo 미지원

노드 숨기기, 노트 삭제, 스킬 생성 등의 작업을 실행취소할 수 없습니다.

**권장 수정:** 최소한 노드 숨기기에 대한 "되돌리기" 토스트 액션 추가

### 11-5. 드래그 앤 드롭 피드백 부재

노트 노드를 드래그할 때 시각적 피드백(그림자 강화, 투명도 변경)이 없습니다.

**권장 수정:** 드래그 중인 노드에 `opacity: 0.8; transform: scale(1.02)` 등 시각 효과

### 11-6. 더블클릭 동작의 발견 가능성 부족

노드 더블클릭으로 파일 열기가 가능하지만, 이 기능을 사용자가 발견할 방법이 없습니다.

**권장 수정:** 첫 노드 클릭 시 "Double-click to open file" 힌트 표시

### 11-7. 캔버스 줌 레벨 표시 없음

현재 줌 레벨이 어디에도 표시되지 않습니다.

**권장 수정:** canvas-controls 영역에 현재 줌 퍼센트 표시 (예: "100%")

---

## 12. 모달 / 폼 UX

### 12-1. 모달 닫기 방식 불일치

- CommandBar: `Escape` 키 + 백드롭 클릭으로 닫힘
- SkillWizardModal: `busy` 중에는 백드롭 클릭으로 닫히지 않음 (좋음)
- CommonRuleModal: 항상 백드롭 클릭으로 닫힘 — 내용 작성 중 실수로 닫힐 수 있음

**권장 수정:**
- 모든 모달에 `Escape` 키 핸들링 통일
- 내용이 수정된 상태에서 닫으려 하면 확인 다이얼로그 표시 ("작성 중인 내용이 있습니다. 닫으시겠습니까?")

### 12-2. 폼 유효성 검증 타이밍

SkillWizardModal에서 Name 필드에 아직 타이핑도 시작하기 전에 "name is required" 에러가 이미 표시됩니다. 사용자가 입력을 시작하기도 전에 에러를 보여주는 것은 부정적 경험입니다.

**권장 수정:**
- `touched` 상태 추적: 필드에 포커스 후 blur 되었을 때만 에러 표시
- 또는 Submit 클릭 시에만 에러 표시
- 에러 → 성공 시 인라인 체크마크 등 긍정적 피드백 추가

### 12-3. CommandBar에 화살표 키 네비게이션 없음

CommandBar에서 목록 탐색이 마우스 클릭 또는 Enter(첫 번째 항목 실행)만 가능합니다. VS Code의 Command Palette처럼 위/아래 화살표 키로 항목을 탐색할 수 없습니다.

**권장 수정:**
- `activeIndex` 상태 추가
- 위/아래 화살표 키로 항목 하이라이트 이동
- Enter로 하이라이트된 항목 실행

### 12-4. SkillWizard 생성 성공 후 피드백 부족

스킬 생성 성공 시 모달이 닫히고 라이브러리 패널이 열리지만, 새로 생성된 스킬이 하이라이트되거나 스크롤되지 않습니다.

**권장 수정:** 생성 직후 해당 스킬 노드로 캔버스 포커스 이동 + 라이브러리에서 해당 항목 하이라이트

### 12-5. Import Preview에 스킬 선택적 설치 불가

ImportPreviewModal에서 발견된 모든 스킬이 한꺼번에 설치됩니다. 특정 스킬만 선택하여 설치할 수 없습니다.

**권장 수정:** 각 스킬 항목에 체크박스 추가하여 선택적 설치 지원

---

## 13. 비주얼 디자인 시스템

### 13-1. 아이콘 전무

전체 UI에 아이콘이 하나도 없습니다 (로고 이미지 제외). 모든 버튼과 액션이 텍스트로만 표현됩니다. n8n, Retool 등 비교 제품은 아이콘을 적극 활용하여 빠른 시각적 스캔을 지원합니다.

**권장 수정:**
- Lucide React 또는 VS Code Codicons 아이콘 라이브러리 도입
- 노드 타입별 아이콘: Skill(번개), Rule(문서), Agent(로봇), Provider(클라우드), Folder(폴더), Note(메모)
- 버튼에 아이콘 추가: Open(외부링크), Reveal(폴더), Export(다운로드), Delete(휴지통)

### 13-2. 색상 체계 비일관

노드 border 색상과 엣지 색상이 별도로 하드코딩되어 있습니다:

| 요소 | CSS 색상 | JS 색상 | 일치 여부 |
|------|---------|---------|----------|
| Skill 노드 border | `#2fa184` | - | - |
| Skill 엣지 (contains) | - | `#3f9183` | 불일치 |
| Rule 노드 border | `#de9f30` | - | - |
| Rule 엣지 (overrides) | - | `#e2781a` | 불일치 |

**권장 수정:** CSS 변수로 통합 관리
```css
:root {
  --color-skill: #2fa184;
  --color-rule: #de9f30;
  --color-agent: #4a87e8;
  --color-provider: #5875a4;
}
```

### 13-3. 타이포그래피 불일치

폰트 사이즈가 10px ~ 18px까지 세분화되어 있지만 체계가 없습니다:
- `10px`: node-header, tag, pill, path
- `11px`: sidebar-title, node-meta, status-bar, command-shortcut, canvas-note-shortcut
- `12px`: sidebar-item, node-desc, item-subtitle, inspector-field label, validation-item
- `13px`: checkbox-row만
- `14px`: item-title, command-item-title
- `15px`: node-title, top-title
- `16px`: brand-title, inspector-heading
- `18px`: import-title, empty-title, canvas-plus

**권장 수정:** 4~5단계의 타이포 스케일로 정리
```css
:root {
  --text-xs: 10px;   /* meta, badge */
  --text-sm: 12px;   /* body small */
  --text-md: 14px;   /* body */
  --text-lg: 16px;   /* heading */
  --text-xl: 20px;   /* title */
}
```

### 13-4. 간격(spacing) 체계 부재

padding/margin 값이 4px, 5px, 6px, 7px, 8px, 9px, 10px, 12px, 14px, 22px 등 임의로 사용됩니다.

**권장 수정:** 4px 기반 스페이싱 스케일 도입 (`4, 8, 12, 16, 24, 32, 48`)

---

## 14. 반응형 / 적응형

### 14-1. 1120px 이하 대응 불완전

`@media (max-width: 1120px)`에서 사이드바가 72px로 줄어들지만, 브랜드 로고와 타이틀은 그대로 남아 잘립니다. 사이드바 아이템과 섹션 타이틀은 `display: none`으로 숨기면서 브랜드 블록은 그대로 남아 비어 보입니다.

**권장 수정:**
- 72px 모드에서는 아이콘만 표시
- 사이드바 접기/펼치기 토글 버튼 추가
- 또는 브레이크포인트에서 사이드바 완전히 숨기기

### 14-2. 모바일 대응 없음

768px 이하 브레이크포인트가 없습니다. VS Code 확장이라 모바일 지원이 필수는 아니지만, 좁은 VS Code 사이드패널에서 열릴 가능성이 있습니다.

**권장 수정:** 최소 600px까지는 사용 가능하도록 레이아웃 조정

### 14-3. color-mix() 브라우저 호환성

CSS 전역에서 `color-mix()` 함수를 사용하고 있는데, VS Code Webview의 Chromium 버전이 오래된 경우 지원되지 않을 수 있습니다.

**권장 수정:** 폴백 색상 제공 또는 VS Code 최소 버전 요구사항 명시

---

## 15. 인스펙터 (Right Panel) UX

### 15-1. Agent / Provider / Note 인스펙터 빈약

- **Agent 인스펙터**: `JSON.stringify`로 raw data를 `<pre>`에 덤프 — 디버깅용이지 사용자 UI가 아님
- **Provider 인스펙터**: 스킬/룰 카운트만 표시
- **Note 인스펙터**: "Sticky note node. Drag to reposition on canvas."라는 고정 텍스트만 표시

**권장 수정:**
- Agent: 연결된 provider, 보유 스킬 목록, 활성 상태 등 구조화된 정보 표시
- Provider: 해당 provider에 속한 스킬 목록을 인라인으로 표시
- Note: 노트 편집기를 인스펙터에도 제공, 색상/크기 변경 옵션

### 15-2. Library 검색이 스킬만 필터링

라이브러리 패널의 검색이 스킬만 대상으로 하고, Rule Docs는 검색에 포함되지 않습니다.

**권장 수정:** 통합 검색으로 스킬 + 룰 모두 필터링

### 15-3. Library에서 New Skill 폼이 항상 노출

`new-skill-form`이 라이브러리 하단에 항상 펼쳐져 있습니다. 라이브러리를 스크롤할 때 항상 보이므로 공간을 차지합니다.

**권장 수정:** 접기/펼치기 또는 모달로 분리 (이미 SkillWizardModal이 있으므로 중복 제거 후 위자드 모달로 통합)

---

## UI/UX 우선순위별 권장 조치

### 즉시 (UX 핵심)

1. 상단 버튼 과밀 해소 — 주요 액션 2~3개만 노출, 나머지 드롭다운 메뉴
2. CommandBar 화살표 키 네비게이션 추가
3. 폼 유효성 검증을 touched/submit 기반으로 변경

### 단기 (시각 품질)

4. 아이콘 라이브러리 도입 (Lucide React 또는 Codicons)
5. 색상 체계를 CSS 변수로 통합
6. 노드 경로 말줄임 처리
7. 토스트 스택/큐 지원

### 중기 (인터랙션)

8. 좌측 사이드바를 인터랙티브 네비게이션으로 개선
9. 오른쪽 패널 리사이즈 핸들 추가
10. Agent/Provider 인스펙터 정보 보강
11. New Skill 폼 중복 제거 (SkillWizardModal로 통합)
12. Import Preview에 선택적 스킬 설치 기능

### 장기 (완성도)

13. 빈 캔버스 온보딩 가이드
14. Undo/Redo 지원
15. 줌 레벨 표시
16. 타이포/스페이싱 디자인 토큰 체계 구축
17. 반응형 브레이크포인트 보완
