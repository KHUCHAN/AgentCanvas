# AgentCanvas 키보드 UX 개선 가이드

> 사용자 관점에서 정리한 키보드 접근성 현황 및 개선 항목

---

## 1. 현재 작동하는 키보드 기능

캔버스 위에서 사용 가능한 단축키는 다음과 같다.

| 단축키 | 기능 | 위치 |
|--------|------|------|
| `Tab` | 노드 라이브러리 패널 열기/닫기 | GraphView |
| `Ctrl+K` / `Cmd+K` | 커맨드 바 열기 | GraphView |
| `Space` 또는 `Ctrl` | 캔버스 팬(이동) 모드 활성화 | GraphView |
| `+` / `=` | 확대 | GraphView |
| `-` | 축소 | GraphView |
| `0` | 뷰 리셋 (1:1 비율) | GraphView |
| `1` | 모든 노드가 보이도록 맞추기 | GraphView |
| `Shift+S` | 메모 노트 추가 | GraphView |
| `Escape` | 커맨드 바 닫기 | CommandBar |
| `Escape` | Agent 상세 모달 닫기 | AgentDetailModal |
| `Enter` | 커맨드 바에서 첫 번째 결과 실행 | CommandBar |
| `Ctrl+Enter` / `Cmd+Enter` | 메모 노트 저장 | NoteNode |

---

## 2. 문제 분석: 사용자가 겪는 상황들

### 시나리오 A — "마우스 없이 노드를 조작할 수 없다"

Skill/Rule/Folder/Note 노드에 마우스를 올려야만 **Open, Enable/Disable, Hide, Reveal** 등의 버튼이 나타난다. CSS가 `display: none` → `:hover` 시 `display: inline-flex`로 전환하기 때문에, 키보드 Tab 키로는 이 버튼들에 도달할 수 없다.

**영향받는 노드**: SkillNode, RuleDocNode, FolderNode, NoteNode (4개)

### 시나리오 B — "모달을 Esc로 닫을 수 없다"

5개 모달 중 2개(CommandBar, AgentDetailModal)만 `Escape` 키 핸들러가 있다. 나머지 3개 모달은 Esc를 눌러도 아무 반응이 없다.

**Esc 미지원 모달**: SkillWizardModal, CommonRuleModal, ImportPreviewModal

### 시나리오 C — "포커스가 어디 있는지 보이지 않는다"

CSS 전체에 `:focus-visible` 또는 `:focus` 스타일이 단 하나도 정의되어 있지 않다. 키보드로 Tab 키를 눌러 이동해도 현재 어떤 요소가 선택되어 있는지 시각적으로 알 수 없다.

### 시나리오 D — "커맨드 바에서 결과를 선택할 수 없다"

커맨드 바에서 검색 후 Enter를 누르면 무조건 첫 번째 결과만 실행된다. 화살표 위/아래 키로 결과 목록을 탐색하거나 원하는 항목을 선택하는 기능이 없다.

### 시나리오 E — "모달 안에서 포커스가 탈출한다"

모든 모달에 포커스 트랩(focus trap)이 없다. Tab 키를 계속 누르면 모달 뒤의 캔버스 요소로 포커스가 빠져나간다.

### 시나리오 F — "노드를 더블클릭으로만 열 수 있다"

선택된 노드에서 Enter를 눌러 파일을 열거나, Delete를 눌러 삭제하는 등의 키보드 단축키가 없다. 모든 노드 상호작용은 마우스 더블클릭에 의존한다.

### 시나리오 G — "Tab 키가 원래 목적으로 사용되지 않는다"

Tab 키가 라이브러리 패널 토글로 바인딩되어 있어서, 일반적인 폼 필드 이동 용도로 사용할 수 없다. 사용자가 예상하는 기본 브라우저 동작과 충돌한다.

---

## 3. 개선 항목 (우선순위별)

### CRITICAL — 반드시 수정

#### C-1. `:focus-visible` 스타일 전역 추가

**현재**: 포커스 스타일 없음
**목표**: 모든 인터랙티브 요소에 포커스 표시

**적용 대상**: 버튼, 입력 필드, 탭, 노드 카드, 링크 등 모든 클릭 가능한 요소

```css
/* styles.css에 추가 */
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

/* 노드 카드 전용 */
.node-card:focus-visible {
  border-color: color-mix(in srgb, var(--accent) 70%, var(--line));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 50%, transparent);
}
```

---

#### C-2. 호버 전용 액션 버튼을 키보드에서도 접근 가능하게

**현재**: `.hover-actions`가 `display: none`이라 키보드로 도달 불가
**목표**: 노드에 포커스가 있을 때도 액션 버튼이 나타남

**대상 파일**: SkillNode, RuleDocNode, FolderNode, NoteNode, styles.css

```css
/* styles.css 수정 */
.node-card:hover .hover-actions,
.node-card:focus-within .hover-actions {
  display: inline-flex;
}
```

추가로 각 노드 컴포넌트의 `<div className="node-card ...">` 에 `tabIndex={0}` 속성 추가 필요.

---

#### C-3. 모든 모달에 Escape 핸들러 추가

**현재**: CommandBar, AgentDetailModal만 Escape 지원
**목표**: 모든 모달에서 Escape로 닫을 수 있음

**대상 파일 (3개)**:

| 모달 | 파일 |
|------|------|
| SkillWizardModal | `webview-ui/src/panels/SkillWizardModal.tsx` |
| CommonRuleModal | `webview-ui/src/panels/CommonRuleModal.tsx` |
| ImportPreviewModal | `webview-ui/src/panels/ImportPreviewModal.tsx` |

각 모달에 아래 패턴 추가:

```tsx
useEffect(() => {
  if (!open) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [open, onClose]);
```

---

#### C-4. 캔버스 노드 키보드 조작 지원

**현재**: 노드 선택 후 아무 키보드 동작도 불가
**목표**: 선택된 노드에 대해 키보드 액션 가능

| 키 | 동작 |
|----|------|
| `Enter` | 선택된 노드의 파일 열기 (더블클릭과 동일) |
| `Delete` 또는 `Backspace` | 선택된 노드 삭제 (노트인 경우) |
| `Arrow 키` | 인접 노드로 포커스 이동 |
| `Escape` | 노드 선택 해제 |

**대상 파일**: `GraphView.tsx` — `onKeyDown` 핸들러에 추가

---

### HIGH — 가능한 빨리 수정

#### H-1. 모달 포커스 트랩 구현

**현재**: Tab 키를 누르면 모달 밖으로 포커스 이탈
**목표**: 모달 내부에서만 포커스가 순환

**대상**: CommandBar, SkillWizardModal, CommonRuleModal, ImportPreviewModal, AgentDetailModal (전부)

포커스 트랩 유틸리티 함수를 만들거나 `useFocusTrap` 커스텀 훅 구현:

```tsx
function useFocusTrap(containerRef: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const container = containerRef.current;
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };

    first?.focus();
    container.addEventListener("keydown", trap);
    return () => container.removeEventListener("keydown", trap);
  }, [active, containerRef]);
}
```

---

#### H-2. 커맨드 바 화살표 키 네비게이션

**현재**: Enter 누르면 무조건 첫 번째 결과 실행
**목표**: ↑↓ 화살표로 결과 탐색, Enter로 선택 항목 실행

**대상 파일**: `CommandBar.tsx`

```tsx
const [selectedIndex, setSelectedIndex] = useState(0);

// onKeyDown에 추가
if (event.key === "ArrowDown") {
  event.preventDefault();
  setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
} else if (event.key === "ArrowUp") {
  event.preventDefault();
  setSelectedIndex(prev => Math.max(prev - 1, 0));
} else if (event.key === "Enter") {
  event.preventDefault();
  filteredCommands[selectedIndex]?.run();
  onClose();
}
```

선택된 항목에 `.command-item.active` 스타일 추가:

```css
.command-item.active {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}
```

---

#### H-3. 폼 Enter 키 제출 지원

**현재**: 모달 내 폼에서 Enter 키로 제출 불가 (버튼 클릭만 가능)
**목표**: Enter로 폼 제출

**대상 파일**: SkillWizardModal, CommonRuleModal, ImportPreviewModal

방법: 폼 요소를 `<form onSubmit={handleSubmit}>` 으로 감싸고, 제출 버튼에 `type="submit"` 속성 추가.

---

#### H-4. 모달 닫힌 후 포커스 복원

**현재**: 모달이 닫혀도 포커스가 원래 위치로 돌아가지 않음
**목표**: 모달을 열기 전 포커스되어 있던 요소로 복원

```tsx
useEffect(() => {
  if (!open) return;
  const previouslyFocused = document.activeElement as HTMLElement;
  return () => { previouslyFocused?.focus(); };
}, [open]);
```

---

#### H-5. Tab 키 동작 충돌 해결

**현재**: Tab 키가 라이브러리 패널 토글로 사용됨 → 브라우저 기본 Tab 네비게이션 불가
**목표**: Tab 키 충돌 제거

**해결 방안**:
- 라이브러리 패널 토글을 다른 단축키로 변경 (예: `Ctrl+L` 또는 `` ` `` 백틱)
- 또는 캔버스에 포커스가 있을 때만 Tab 키를 가로채도록 조건 추가:

```tsx
if (event.key === "Tab" && document.activeElement === canvasRef.current) {
  event.preventDefault();
  // 패널 토글
}
```

---

#### H-6. 노드 메뉴 ("...") 키보드 접근

**현재**: SkillNode, RuleDocNode의 "..." 메뉴 버튼은 호버 시에만 나타나고, 메뉴 열린 후에도 키보드 네비게이션 없음
**목표**: 메뉴 열기/닫기 및 항목 탐색 가능

**대상 파일**: SkillNode.tsx, RuleDocNode.tsx

```tsx
// 메뉴 버튼에 키보드 핸들러 추가
<button
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleMenu();
    }
  }}
  aria-expanded={menuOpen}
  aria-haspopup="true"
>...</button>

// 메뉴 내부에 Escape로 닫기
{menuOpen && (
  <div role="menu" onKeyDown={(e) => {
    if (e.key === "Escape") { setMenuOpen(false); }
  }}>
    ...
  </div>
)}
```

---

### MEDIUM — 경험 향상

#### M-1. 단축키 도움말 표시

**현재**: 사용자가 단축키를 알 방법 없음
**목표**: `?` 키 또는 도움말 버튼으로 단축키 목록 모달 표시

예시 구현: `Shift+?` 입력 시 단축키 치트시트 모달 오픈.

---

#### M-2. Agent Detail 모달 탭 키보드 전환

**현재**: Skills/Rules/MCP 탭을 클릭으로만 전환 가능
**목표**: 좌우 화살표 키로 탭 전환 (WAI-ARIA Tab 패턴)

```tsx
<div role="tablist" onKeyDown={(e) => {
  const tabs: AgentDetailTab[] = ["skills", "rules", "mcp"];
  const idx = tabs.indexOf(activeTab);
  if (e.key === "ArrowRight") {
    setActiveTab(tabs[(idx + 1) % tabs.length]);
  } else if (e.key === "ArrowLeft") {
    setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length]);
  }
}}>
```

---

#### M-3. 툴팁/힌트에 단축키 표시

**현재**: 버튼 툴팁에 단축키 정보 없음
**목표**: 버튼에 마우스를 올리면 단축키도 함께 표시

예:
- "Zoom In" → "Zoom In (+)"
- "Fit View" → "Fit View (1)"
- "Command Bar" → "Command Bar (Ctrl+K)"

---

#### M-4. `prefers-reduced-motion` 미디어 쿼리 시 애니메이션 제거

**현재**: 일부 애니메이션에만 적용됨
**목표**: 노드 호버, 연결선 애니메이션 등도 포함

```css
@media (prefers-reduced-motion: reduce) {
  .react-flow__edge.animated path { animation: none; }
  .node-card { transition: none; }
}
```

---

#### M-5. ARIA 역할 및 라벨 보강

**현재**: 일부 모달에만 `role="dialog"`, `aria-modal`, `aria-label` 있음
**목표**: 모든 인터랙티브 영역에 적절한 ARIA 속성 추가

| 컴포넌트 | 추가할 ARIA |
|----------|-------------|
| 노드 카드 | `role="button"`, `aria-label="Skill: {name}"` |
| 좌측 사이드바 | `role="navigation"`, `aria-label="Canvas navigation"` |
| 캔버스 컨트롤 | `aria-label` 이미 있음 (유지) |
| 라이브러리 패널 | `role="search"` (검색 영역), `role="tablist"` (탭) |
| 노드 메뉴 | `role="menu"` 이미 있음, `role="menuitem"` 각 항목에 추가 |

---

## 4. 구현 우선순위 로드맵

```
Phase 1 — CRITICAL (1~2일)
├── C-1  :focus-visible 전역 스타일
├── C-2  호버 전용 버튼 → focus-within 대응
├── C-3  모든 모달 Escape 핸들러
└── C-4  선택 노드 Enter/Delete 지원

Phase 2 — HIGH (2~3일)
├── H-1  모달 포커스 트랩
├── H-2  커맨드 바 ↑↓ 네비게이션
├── H-3  폼 Enter 제출
├── H-4  포커스 복원
├── H-5  Tab 키 충돌 해결
└── H-6  노드 메뉴 키보드 접근

Phase 3 — MEDIUM (3~5일)
├── M-1  단축키 도움말 모달
├── M-2  모달 탭 화살표 전환
├── M-3  툴팁에 단축키 표시
├── M-4  prefers-reduced-motion 확대
└── M-5  ARIA 역할/라벨 보강
```

---

## 5. 파일별 수정 범위

| 파일 | 수정 항목 |
|------|----------|
| `styles.css` | C-1, C-2, M-4 |
| `GraphView.tsx` | C-4, H-5 |
| `CommandBar.tsx` | H-2 |
| `SkillWizardModal.tsx` | C-3, H-1, H-3 |
| `CommonRuleModal.tsx` | C-3, H-1, H-3 |
| `ImportPreviewModal.tsx` | C-3, H-1, H-3 |
| `AgentDetailModal.tsx` | H-1, M-2 |
| `SkillNode.tsx` | C-2, H-6 |
| `RuleDocNode.tsx` | C-2, H-6 |
| `FolderNode.tsx` | C-2 |
| `NoteNode.tsx` | C-2 |
| `App.tsx` | H-4, M-1 |
| 신규: `useFocusTrap.ts` | H-1 (공용 훅) |
| 신규: `KeyboardHelpModal.tsx` | M-1 |

---

## 6. 검증 체크리스트

구현 후 아래 항목을 키보드만으로 테스트:

- [ ] Tab 키로 모든 버튼/입력에 순서대로 이동 가능
- [ ] 현재 포커스된 요소가 시각적으로 구분됨
- [ ] 모든 모달에서 Escape로 닫기 가능
- [ ] 모달 내부에서 Tab이 모달 밖으로 빠져나가지 않음
- [ ] 모달 닫힌 후 이전 포커스 위치로 복원
- [ ] 커맨드 바에서 ↑↓로 항목 탐색 후 Enter로 실행
- [ ] 노드 선택 후 Enter로 파일 열기
- [ ] 노드 호버 없이도 액션 버튼 접근 가능
- [ ] 노드 메뉴("...") 키보드로 열고 닫기 가능
- [ ] 폼에서 Enter로 제출 가능
