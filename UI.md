# AgentCanvas UI — 브랜딩, 컴포넌트, 디자인 시스템

**작성일:** 2026-02-19
**목적:** AgentCanvas 제품의 브랜딩 가이드, UI 컴포넌트 아키텍처, CSS 디자인 시스템, 디자인 검증 결과를 통합 관리

---

## 1. 브랜딩 가이드

### 1.1 브랜딩 현황 및 변경 사항

코드 전체에서 혼용되고 있는 4가지 이름을 **"AgentCanvas"**로 통일합니다:

| 현재 사용명 | 위치 | 변경 대상 |
|-----------|------|----------|
| `agent-studio` | package.json `name`, VS Code command prefix, zipPack manifest, launch.json, tasks.json | `agent-canvas` |
| `Agent Studio` | package.json commands 타이틀, mvp.md, instruction 문서들 | `AgentCanvas` |
| `Open Canvas` | package.json `displayName`, LeftSidebar 브랜드, index.html title, extension.ts 패널/에러 메시지, fallback HTML | `AgentCanvas` |
| `Nano Banana` | 로고 이미지 (`nano_banana_logo.png`), alt 텍스트 | 교체 필요 |

#### 변경이 필요한 파일 전체 목록 (25개 지점)

| 파일 | 행 | 현재 값 | 변경 값 |
|-----|-----|--------|--------|
| `package.json` | 2 | `"name": "agent-studio"` | `"name": "agent-canvas"` |
| `package.json` | 3 | `"displayName": "Open Canvas"` | `"displayName": "AgentCanvas"` |
| `package.json` | 4 | description 내 "Agent Studio" | "AgentCanvas" |
| `package.json` | 14 | `"onCommand:agentStudio.open"` | `"onCommand:agentCanvas.open"` |
| `package.json` | 20 | `"command": "agentStudio.open"` | `"command": "agentCanvas.open"` |
| `package.json` | 21 | `"title": "Agent Studio: Open"` | `"title": "AgentCanvas: Open"` |
| `package.json` | 24 | `"command": "agentStudio.refresh"` | `"command": "agentCanvas.refresh"` |
| `package.json` | 25 | `"title": "Agent Studio: Refresh"` | `"title": "AgentCanvas: Refresh"` |
| `package.json` | 30~40 | `"agentStudio.*"` config keys | `"agentCanvas.*"` |
| `extension.ts` | 29 | `"agentStudio.open"` | `"agentCanvas.open"` |
| `extension.ts` | 35 | `"agentStudio.refresh"` | `"agentCanvas.refresh"` |
| `extension.ts` | 47 | `viewType = "agentStudio.panel"` | `"agentCanvas.panel"` |
| `extension.ts` | 76,81 | `"Open Canvas operation failed"` | `"AgentCanvas operation failed"` |
| `extension.ts` | 98 | `"Open Canvas"` (패널 타이틀) | `"AgentCanvas"` |
| `extension.ts` | 269,286 | `getConfiguration("agentStudio")` | `"agentCanvas"` |
| `extension.ts` | 338 | `<h2>Open Canvas</h2>` | `<h2>AgentCanvas</h2>` |
| `extension.ts` | 654 | `agentStudio.notes:` storage key | `agentCanvas.notes:` |
| `zipPack.ts` | 48 | `"agent-studio-pack"` | `"agent-canvas-pack"` |
| `index.html` | 6 | `<title>Open Canvas</title>` | `<title>AgentCanvas</title>` |
| `LeftSidebar.tsx` | 2 | `import logo from "../assets/nano_banana_logo.png"` | 새 로고 파일로 변경 |
| `LeftSidebar.tsx` | 23 | `alt="Open Canvas Logo"` | `alt="AgentCanvas Logo"` |
| `LeftSidebar.tsx` | 24 | `Open Canvas` | `AgentCanvas` |
| `.vscode/tasks.json` | 5 | `"agent-studio: build"` | `"agent-canvas: build"` |
| `.vscode/launch.json` | 5,15 | `"Run Agent Studio Extension"` 등 | `"AgentCanvas"` |
| `README.md` | 전체 | "Agent Studio" 언급 | "AgentCanvas" |

### 1.2 디자인 컨셉

**핵심 키워드:** "Agent + Canvas" — AI 에이전트의 스킬과 규칙을 시각적으로 배치하고 관리하는 캔버스 도구

**컨셉 방향:** n8n, Retool 같은 노드 기반 비주얼 에디터의 느낌. 핵심 은유는 "노드와 연결선이 있는 캔버스 위에서 AI 에이전트를 설계하는 것". 기술적이면서도 깔끔하고 모던한 톤.

### 1.3 컬러 팔레트

현재 UI의 다크 테마 기반을 유지하면서 통일합니다:

| 용도 | 색상 | Hex |
|------|------|-----|
| Primary (액센트) | 청록/틸 | `#2fa184` |
| Primary Light | 밝은 틸 | `#3dd9a8` |
| Secondary | 소프트 블루 | `#4a87e8` |
| Warning | 앰버 | `#d4a11e` |
| Danger | 코럴 레드 | `#d95c4f` |
| BG Dark | 다크 네이비 | `#181b20` |
| BG Elevated | 진한 그레이 | `#1f232a` |
| FG | 라이트 그레이 | `#d7dce5` |

**로고 주색상: `#2fa184` (틸 그린)** — UI 전체의 스킬 노드, 액센트와 통일

### 1.4 슬로건

| 현재 | 제안 |
|------|------|
| `Discover / Visualize / Share` | `Design · Connect · Deploy` |

"Design"은 스킬 생성, "Connect"는 노드 연결/시각화, "Deploy"는 팩 내보내기/공유를 나타냅니다.

### 1.5 로고 가이드

#### LOGO-1. 메인 로고 (Primary Logo)

**사용 위치:** 사이드바 브랜드 블록, README, 마켓플레이스 페이지
**파일명:** `agentcanvas_logo.png`
**크기:** 512x512px (원본), 다운사이즈하여 사용
**배경:** 투명 (PNG)

**AI 이미지 생성 프롬프트:**
```
A modern, minimalist logo for a developer tool called "AgentCanvas".

The logo combines two visual concepts:
1. A stylized canvas/artboard shape — a rounded rectangle with subtle grid dots inside, representing a node-based visual editor workspace
2. An abstract AI agent symbol — a small geometric brain or neural node icon placed at the center of the canvas, with 3-4 thin connection lines radiating outward to smaller circular nodes at the edges

Style: Clean vector flat design, geometric shapes only, no gradients. Single-weight line art with filled accent shapes.

Color: Teal green (#2fa184) as the primary color on a transparent background. The connection lines and outer nodes use a lighter teal (#3dd9a8). The central brain/agent symbol is solid teal.

Mood: Technical, precise, modern — like n8n or Figma's visual identity. Professional developer tool aesthetic, not playful or cartoonish.

No text in the image. Icon only. Perfectly centered. Clean edges suitable for scaling down to 28x28px.
```

#### LOGO-2. 사이드바 아이콘 (Sidebar Compact)

**사용 위치:** `LeftSidebar.tsx` — `.brand-logo` (28x28px 렌더링)
**파일명:** `agentcanvas_icon_28.png`
**크기:** 56x56px (@2x 레티나 대응)
**배경:** 투명

#### LOGO-3. VS Code 확장 마켓플레이스 아이콘

**사용 위치:** `package.json`의 `"icon"` 필드
**파일명:** `agentcanvas_marketplace.png`
**크기:** 128x128px (VS Code 요구사항)
**배경:** 어두운 네이비 (#181b20) 라운드 사각형

#### LOGO-4. 빈 캔버스 일러스트레이션 (Empty State)

**사용 위치:** `GraphView.tsx` — `.empty-placeholder` 영역
**파일명:** `agentcanvas_empty_state.png`
**크기:** 320x200px
**배경:** 투명

#### LOGO-5. 로딩/폴백 페이지 로고

**사용 위치:** `extension.ts` — `fallbackHtml()` 함수 내 에러/로딩 화면
**파일명:** `agentcanvas_loading.svg`
**크기:** SVG (벡터, 가변 크기)
**배경:** 투명

#### LOGO-6. 파비콘 (Webview Tab)

**사용 위치:** VS Code 탭 아이콘으로 표시
**파일명:** `agentcanvas_favicon.png`
**크기:** 32x32px
**배경:** 투명

#### LOGO-7. 노드 타입 아이콘 세트

**사용 위치:** 각 노드 카드 헤더 (SkillNode, RuleDocNode, AgentNode, ProviderNode, FolderNode, NoteNode)
**파일명:** `icon_skill.svg`, `icon_rule.svg`, `icon_agent.svg`, `icon_provider.svg`, `icon_folder.svg`, `icon_note.svg`
**크기:** 각 16x16px (SVG)
**배경:** 투명

Lucide React 아이콘 라이브러리 사용을 권장합니다:
- SKILL: Lightning bolt inside rounded square (teal #2fa184)
- RULE: Document/scroll with checkmark (amber #de9f30)
- AGENT: Simplified robot head (blue #4a87e8)
- PROVIDER: Cloud shape with connection dot (soft blue #5875a4)
- FOLDER: Classic folder shape (indigo #6d7fd8)
- NOTE: Sticky note / memo pad (gold #b98516)

---

## 2. 컴포넌트 설계

### 2.1 캔버스 노드 타입

#### AgentNode (기본)

발견된 각 provider/profile마다 1개 생성:
- 예: "VS Code / Workspace"
- 예: "Codex / default" (CODEX_HOME)
- (옵션) "OpenClaw / main"

**특성:**
- 캔버스의 기본 노드 (항상 표시)
- Agent 클릭 시 Right Panel이 "Agent Manage" 탭으로 자동 전환
- 색상: Primary teal (#2fa184)

#### CommonRulesNode (공통 규칙)

공통 Rule들을 묶어서 리스트 형태로 보여주는 컨테이너 노드:
- **위치:** 캔버스 오른쪽 위 고정 (pinned = true)
- **이동:** 사용자가 드래그로 이동 가능 (옵션)
- **내부 섹션:**
  - Global rules (예: Codex global AGENTS.md/override)
  - Repo common rules (예: project root AGENTS.md)
  - Extension-managed common rules (`.agentcanvas/rules/common/*.md`)

**MVP 포함 항목:**
1. Codex Global AGENTS: `~/.codex/AGENTS.override.md` (있으면) or `~/.codex/AGENTS.md`
2. Codex Repo Root AGENTS: `<repoRoot>/AGENTS.override.md` (있으면) or `<repoRoot>/AGENTS.md`
3. Extension-managed rules: `<workspace>/.agentcanvas/rules/common/*.md`

#### 확장 모드 노드 (Expand 모드에서만)

- **SkillNode:** 선택 Agent 소속 스킬만 표시
- **RuleDocNode:** 선택 Agent의 rule chain만 표시
- **(옵션) McpServerNode:** 원하면 시각화

### 2.2 Expand 모드 아키텍처

**Overview 모드:**
- Nodes: AgentNodes + CommonRulesNode만 (깔끔)
- Edges: CommonRulesNode → AgentNodes (appliesTo)

**Expand 모드:**
- baseGraph + SkillNodes(ownerAgentId=selected) + RuleDocNodes(ownerAgentId=selected)
- Edges:
  - agent → skill (contains)
  - agent → ruledoc (contains)
  - ruledoc chain (overrides, dashed)

**Tidy 레이아웃 규칙:**
- pinned nodes (CommonRulesNode)는 위치 유지
- Agent nodes는 좌측 컬럼 정렬 (x ≈ 80)
- Rule chain은 중앙 근처 (x ≈ 420)
- Skills는 우측 컬럼 (x ≈ 820)

### 2.3 Right Panel UI 구조 (REV-2026-02-20 개정)

> ⚠️ REV 적용: AI Prompt 탭, Memory 탭 삭제. Task 탭 신규. 스크롤 필수.

#### 탭 구성 (개정 후)

| 탭 | 기능 | 비고 |
|---|---|---|
| **Node Library** | 스킬, 패턴, MCP 서버, 규칙 문서 브라우징 | 유지 |
| **Inspector** | 선택 노드/엣지 상세 정보 + 편집 | 유지, 스크롤 수정 |
| **Task** ★신규 | 작업 지시 프롬프트 + 실행 + 히스토리 | AI Prompt/Run 대체 |
| **Run** | 실행 로그 스트리밍 + 이벤트 모니터링 | 유지 |
| ~~AI Prompt~~ | ~~삭제~~ | → 캔버스 하단 BuildPromptBar |
| ~~Memory~~ | ~~삭제~~ | → Orchestrator 자동 / Settings |

#### Inspector 탭
- 선택 노드의 상세 정보 표시
- 노드별 편집 액션 제공
- **스크롤:** `flex: 1; overflow-y: auto; min-height: 0` 필수

#### Library 탭 (+)
- New Skill, Import Pack, Create Override, Sticky Note

#### Task 탭 ★신규 (기존 AI Prompt + Run 기능 흡수)
- **Work 섹션:** textarea + `[▶ Submit Work]` 버튼. Orchestrator에게 작업 전달
- **History 섹션:** 실행 기록 리스트, 클릭 시 해당 Run 상세 표시
- 실행 시 Task[] 자동 분해 → 칸반 카드 생성

#### Agent 관리 (더블클릭 모달)

> ★ 변경: Agent 노드 **더블클릭** 시 `AgentDetailModal` 팝업으로 관리

**서브탭: Overview / Skills / Rules / MCP**

**Skills 서브탭:**
- ownerAgentId == selectedAgentId 스킬만 테이블로 표시
- Actions: Open / Reveal / Validate / Export
- "New Skill" → Wizard 열기

**Rules 서브탭:**
- Common Rules 섹션 (CommonRulesNode와 동일 목록)
- Agent-specific chain 섹션

**MCP 서브탭:**
- Codex MCP 목록: config.toml의 [mcp_servers.*] read
- VS Code MCP 목록: .vscode/mcp.json read
- Add server wizard + diff preview + apply

### 2.4 화면 구성 (개정 후)

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🟢 AgentCanvas    [Kanban│Graph│Schedule]              ⚙ Settings  ⌘K │
├────────────────────────────┬───────────────────────────┬────────────────┤
│                            │                           │                │
│  [+] [+ Agent] [+ Rule]   │                           │  Right Panel   │
│                            │                           │  Node Library  │
│                            │  Canvas (모니터링 대시보드) │  Inspector     │
│                            │  - Agent 노드 + 실시간 상태 │  Task ★신규    │
│                            │  - 데이터 흐름 애니메이션    │  Run           │
│                            │  - 프로그레스/에러 표시      │                │
│                            │                           │                │
│                            │  ┌──────────────────────┐ │                │
│                            │  │ Build Prompt (하단)   │ │                │
│                            │  └──────────────────────┘ │                │
├────────────────────────────┴───────────────────────────┴────────────────┤
│  Agents 4 · Tasks 5 · Done 2 · Errors 0                [▶ Build New]   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. CSS 디자인 시스템

### 3.1 CSS 변수 정의

#### 색상 변수 (`:root` 레벨)

```css
:root {
  /* Primary Colors */
  --accent: #2fa184;           /* 청록/틸 (Primary) */
  --accent-light: #3dd9a8;     /* 밝은 틸 (Primary Light) */

  /* Secondary Colors */
  --secondary: #4a87e8;        /* 소프트 블루 */

  /* Semantic Colors */
  --warn: #d4a11e;             /* 앰버 (Warning) */
  --danger: #d95c4f;           /* 코럴 레드 (Danger) */

  /* Background Colors */
  --bg-dark: #181b20;          /* 다크 네이비 (BG Dark) */
  --bg-elevated: #1f232a;      /* 진한 그레이 (BG Elevated) */

  /* Foreground Colors */
  --fg: #d7dce5;               /* 라이트 그레이 (FG) */

  /* Spacing & Sizing */
  --radius: 8px;               /* 기본 border-radius */
  --node-radius: 12px;         /* 노드 카드 border-radius */
}
```

#### 노드별 색상 변수 (확장 권장)

```css
:root {
  /* Node Type Colors */
  --color-skill: #2fa184;      /* Skill Node (틸) */
  --color-rule: #de9f30;       /* Rule Node (앰버) */
  --color-agent: #4a87e8;      /* Agent Node (블루) */
  --color-provider: #5875a4;   /* Provider Node (소프트 블루) */
  --color-folder: #6d7fd8;     /* Folder Node (인디고) */
  --color-note: #b98516;       /* Note Node (골드) */

  /* Schedule Status Colors */
  --schedule-running: #4a87e8; /* Running (파랑) */
  --schedule-done: #2fa184;    /* Done (틸) */
  --schedule-failed: #d95c4f;  /* Failed (빨강) */
  --schedule-blocked: #d4a11e; /* Blocked (황색) */
}
```

### 3.2 컴포넌트 스타일 규칙

#### 노드 카드 기본 스타일

모든 노드는 `.node-card` 기본 클래스를 공유:

```css
.node-card {
  background-color: var(--bg-elevated);
  border: 1px solid var(--accent);
  border-radius: var(--node-radius, 12px);
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease-in-out;
}

.node-card:hover {
  border-color: var(--accent-light);
  box-shadow: 0 4px 16px rgba(47, 161, 132, 0.2);
}

.node-card.selected {
  background-color: rgba(47, 161, 132, 0.1);
  border-color: var(--accent-light);
  box-shadow: 0 4px 16px rgba(47, 161, 132, 0.3);
}
```

#### 간격 체계 (4px 배수)

```css
/* Padding */
.p-4 { padding: 4px; }
.p-8 { padding: 8px; }
.p-12 { padding: 12px; }
.p-16 { padding: 16px; }
.p-20 { padding: 20px; }
.p-24 { padding: 24px; }

/* Margin */
.m-4 { margin: 4px; }
.m-8 { margin: 8px; }
.m-12 { margin: 12px; }
.m-16 { margin: 16px; }
.m-20 { margin: 20px; }
.m-24 { margin: 24px; }

/* Gap (flexbox) */
.gap-4 { gap: 4px; }
.gap-8 { gap: 8px; }
.gap-12 { gap: 12px; }
.gap-16 { gap: 16px; }
```

#### 폰트 크기 (VS Code 테마 상속)

```css
/* Font Sizes */
.text-xs { font-size: 11px; }
.text-sm { font-size: 12px; }          /* 기본 본문 */
.text-base { font-size: 13px; }        /* 기본 본문 */
.text-lg { font-size: 14px; }          /* 제목 */
.text-xl { font-size: 16px; }          /* 큰 제목 */

/* Font Weights */
.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
```

#### border-radius 규칙

| 용도 | 값 | 예 |
|------|-----|-----|
| 기본 (버튼, 입력창) | `var(--radius, 8px)` | 8px |
| 노드 카드 | `var(--node-radius, 12px)` | 10~12px |
| 완전 원형 | `50%` | 원형 배지 |

**이상치 정리:**
- `6px` → `var(--radius, 8px)` (기본값으로 통일)
- `7px` → `var(--radius, 8px)` (중간값 제거)
- `15px` → `50%` (완전 원형 의도 시) 또는 주석 추가

#### VS Code 테마 통합

```css
/* VS Code 에디터 테마 색상 상속 */
.editor-fg { color: var(--vscode-editor-foreground); }
.editor-bg { background-color: var(--vscode-editor-background); }
.panel-bg { background-color: var(--vscode-panel-background); }
.input-bg { background-color: var(--vscode-input-background); }
.input-border { border-color: var(--vscode-input-border); }
```

### 3.3 상태 표시 패턴

#### 에러 상태

**문제점:** `color: #e05252` 하드코딩
**해결:** `color: var(--danger)` (#d95c4f)로 교체

```css
.modal-error {
  color: var(--danger);
  background-color: rgba(217, 92, 79, 0.1);
  border: 1px solid var(--danger);
  border-radius: var(--radius);
  padding: 12px;
}
```

#### 스케줄 태스크 상태

**문제점:** 상태별 색상이 하드코딩되어 있음
**해결:** CSS 변수로 추출

```css
.schedule-task {
  border-radius: var(--node-radius);
  padding: 8px 12px;
  transition: all 0.2s ease-in-out;
}

.schedule-task.status-running {
  background-color: rgba(74, 135, 232, 0.1);
  border: 1px solid var(--schedule-running);
  color: var(--schedule-running);
}

.schedule-task.status-done {
  background-color: rgba(47, 161, 132, 0.1);
  border: 1px solid var(--schedule-done);
  color: var(--schedule-done);
}

.schedule-task.status-failed {
  background-color: rgba(217, 92, 79, 0.1);
  border: 1px solid var(--schedule-failed);
  color: var(--schedule-failed);
}

.schedule-task.status-blocked {
  background-color: rgba(212, 161, 30, 0.1);
  border: 1px solid var(--schedule-blocked);
  color: var(--schedule-blocked);
}
```

### 3.4 CSS 안티패턴 제거

#### !important 제거

**위치:** `.active-toggle`

**문제:** CSS 스타일 우선순위를 강제하는 안티패턴
**해결:** specificity 개선

```css
/* Before */
.active-toggle {
  color: var(--accent) !important;
}

/* After */
.toolbar .active-toggle {
  color: var(--accent);
}
```

#### 함수 중복 제거

**위치:** `webview-ui/src/canvas/ScheduleView.tsx`

**문제:** `clamp()`과 `clampNumber()` 두 함수가 존재
**해결:** 하나로 통합

```typescript
// Unified clamp function
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

---

## 4. 디자인 검증 결과

**검증일:** 2026-02-19
**대상:** 전체 UI 컴포넌트, CSS 스타일시트, ScheduleView, 노드 카드 디자인
**기준 문서:** BRANDING_GUIDE.md

### 4.1 검증 기준

BRANDING_GUIDE.md에 정의된 디자인 시스템 기준:

| 항목 | 기준값 |
|------|--------|
| 주요 색상 | `--accent: #2fa184`, `--secondary: #4a87e8`, `--warn: #d4a11e`, `--danger: #d95c4f` |
| border-radius | 기본 `var(--radius, 8px)`, 노드 카드 10~12px |
| 간격 체계 | 4px 배수 (4, 8, 12, 16, 20, 24...) |
| 폰트 크기 | 12~13px 기본, 14px 제목, VS Code 테마 상속 |
| 테마 통합 | `var(--vscode-*)` 참조로 에디터 테마 자동 반영 |

### 4.2 전체 평가

✅ **양호** — CRITICAL 0건, MAJOR 0건, MINOR 4건, STYLE 2건

새로 추가된 ScheduleView와 Schedule 관련 컴포넌트가 기존 디자인 시스템을 잘 따르고 있으며, CSS 변수 기반 색상/간격 체계가 일관되게 적용되어 있습니다.

### 4.3 발견된 이슈

#### MINOR (4건)

**D-1. modal-error 하드코딩 색상**

위치: `webview-ui/src/styles.css` — `.modal-error`

문제: AgentCreationModal의 에러 표시에 `color: #e05252`가 직접 사용됨. 디자인 시스템의 `var(--danger)` (#d95c4f)와 미세하게 다른 색상값.

해결 방안: `color: var(--danger)`로 교체. (1줄 수정)

---

**D-2. Schedule 태스크 상태 색상 하드코딩**

위치: `webview-ui/src/styles.css` — `.schedule-task.status-*`

문제: 스케줄 태스크 노드의 상태별 색상이 CSS 변수 대신 직접 값으로 지정됨. 테마 변경 시 일괄 업데이트 불가.

대상: `.status-running`, `.status-done`, `.status-failed`, `.status-blocked` 클래스의 배경/테두리 색상.

해결 방안: 상태별 색상을 CSS 변수(예: `--schedule-running`, `--schedule-done` 등)로 추출하거나, 기존 `--accent`, `--warn`, `--danger` 변수 조합 활용. (~10줄 수정)

---

**D-3. Agent Handle / Edge 마커 색상 하드코딩**

위치: `webview-ui/src/canvas/ScheduleView.tsx`

문제: 엣지 마커 색상 `#6aa7f5`가 ScheduleView.tsx에 직접 하드코딩됨. 디자인 시스템의 `--secondary` (#4a87e8)와 유사하지만 다른 값.

해결 방안: CSS 커스텀 프로퍼티를 JS에서 읽어 적용하는 패턴 도입. 예: `getComputedStyle(document.documentElement).getPropertyValue('--secondary')`

---

**D-4. border-radius 이상치**

위치: `webview-ui/src/styles.css` 전역

문제: 대부분 `var(--radius, 8px)`, `10px`, `12px`를 일관 사용하나 일부 이상치 존재:

| 값 | 위치 | 비고 |
|----|------|------|
| `6px` | `.prompt-canvas-container .results-header` | 기본 8px 대비 작음 |
| `7px` | `.skill-wizard-modal .step-card` | 8px도 6px도 아닌 중간값 |
| `15px` | `.skill-wizard-modal .step-card .step-number` | pill 형태 의도인지 불명확 |

해결 방안: `6px → var(--radius, 8px)`, `7px → var(--radius, 8px)`, `15px → 50%` (완전 원형) 또는 기존 값 유지 후 주석으로 의도 명시.

#### STYLE (2건)

**S-1. active-toggle !important 사용**

위치: `webview-ui/src/styles.css` — `.active-toggle`

문제: `!important` 사용은 CSS 스타일 우선순위를 강제하는 안티패턴. specificity 충돌로 인한 임시 해결책이나, 장기적으로 유지보수 어려움 초래.

해결 방안: 선택자 specificity를 높이거나 (예: `.toolbar .active-toggle`), CSS 구조를 정리하여 `!important` 불필요하게 변경. (specificity 분석 필요)

---

**S-2. ScheduleView clamp/clampNumber 함수 중복**

위치: `webview-ui/src/canvas/ScheduleView.tsx` (line 301~307)

문제: 동일 로직의 `clamp()`과 `clampNumber()` 두 함수가 존재. 하나로 통합 가능.

해결 방안: 하나의 함수로 통합 후 나머지 제거. (단순 리팩터링)

### 4.4 잘 구현된 디자인 요소

| 항목 | 평가 |
|------|------|
| **CSS 변수 체계** | `:root` 레벨에서 색상, 간격, 반경 등을 일괄 관리 — 테마 일관성 확보 |
| **노드 카드 패턴** | agent, skill, ruleDoc, note, folder, commonRules 등 모든 노드가 `.node-card` 기반 클래스를 공유 — 시각적 통일성 |
| **ScheduleView 레인/태스크** | 간트 차트 스타일이 기존 캔버스 노드 UI와 조화롭게 디자인됨 |
| **반응형 타임라인** | 동적 `pxPerSec` 계산으로 데이터 양에 따라 적절한 너비 자동 조절 |
| **VS Code 테마 상속** | `var(--vscode-*)` 참조로 사용자 에디터 테마와 자연스럽게 통합 |
| **4px 그리드 체계** | 패딩/마진이 4px 배수로 일관 적용 (4, 8, 12, 16, 20, 24) |
| **폰트 크기 체계** | 12~13px 본문, 14px 제목으로 가독성 확보, VS Code 테마 폰트 상속 |

### 4.5 권장 수정 우선순위

| 우선순위 | 이슈 | 난이도 |
|----------|------|--------|
| 1순위 | D-1 modal-error 색상 → `var(--danger)` | 1줄 수정 |
| 1순위 | D-2 Schedule 상태 색상 → CSS 변수화 | ~10줄 수정 |
| 2순위 | D-3 Edge 마커 색상 → `--secondary` 통일 | JS 1곳 수정 |
| 2순위 | D-4 border-radius 이상치 정리 | 3곳 수정 |
| 3순위 | S-1 !important 제거 | specificity 분석 필요 |
| 3순위 | S-2 clamp 함수 통합 | 단순 리팩터링 |

---

## 5. 적용 체크리스트

### 5.1 로고 파일 교체

- [ ] `webview-ui/src/assets/nano_banana_logo.png` → `agentcanvas_icon_28.png`
- [ ] `package.json`에 `"icon": "media/agentcanvas_marketplace.png"` 추가
- [ ] `media/` 폴더 생성 후 마켓플레이스 아이콘 배치
- [ ] empty-placeholder에 일러스트 삽입
- [ ] fallback HTML에 SVG 로고 인라인 삽입

### 5.2 코드 네이밍 변경 (총 25개 지점)

- [ ] `package.json` — name, displayName, description, commands, config keys
- [ ] `extension.ts` — command IDs, viewType, panel title, error messages, config keys, storage key
- [ ] `zipPack.ts` — manifest name
- [ ] `LeftSidebar.tsx` — import 경로, alt 텍스트, 브랜드 타이틀, 슬로건
- [ ] `index.html` — title
- [ ] `.vscode/launch.json` — launch config name, preLaunchTask
- [ ] `.vscode/tasks.json` — task label
- [ ] `README.md` — 전체 문서

### 5.3 디자인 토큰 통합

- [ ] CSS 변수에 노드 색상 추가 (`--color-skill`, `--color-rule` 등)
- [ ] GraphView.tsx 엣지 색상을 CSS 변수로 교체
- [ ] 노드 카드 헤더에 아이콘 컴포넌트 추가

### 5.4 Design Verification 이슈 수정

- [ ] D-1: modal-error 하드코딩 색상 → `var(--danger)` 교체
- [ ] D-2: Schedule 태스크 상태 색상 → CSS 변수화
- [ ] D-3: Edge 마커 색상 → `--secondary` 통일
- [ ] D-4: border-radius 이상치 정리 (6px, 7px, 15px)
- [ ] S-1: active-toggle `!important` 제거
- [ ] S-2: clamp 함수 중복 제거

---

**이 문서는 AgentCanvas 프로젝트의 브랜딩, UI 컴포넌트 아키텍처, CSS 디자인 시스템, 디자인 검증 결과를 통합 관리하는 마스터 가이드입니다.**

---

## 6. 2차 개정 — 컴포넌트 추가 & 레이아웃 수정 (2026-02-20)

> 코드 검증 결과를 반영한 UI 컴포넌트 추가 스펙

### 6.1 TeamPanel 컴포넌트 수정

**파일:** `webview-ui/src/panels/TeamPanel.tsx`

#### 현재 상태 (검증 완료)
- `+ Agent` 버튼: ✅ 구현됨 (line 74)
- `+ Skill` 버튼: ❌ 미구현
- `Rebuild` 버튼: ✅ 구현됨 (line 75)

#### 수정 스펙

```tsx
// 버튼 레이아웃: [+ Agent] [+ Skill] [Rebuild]
<div className="team-panel-inline-actions">
  <button type="button" onClick={props.onCreateAgent}>+ Agent</button>
  <button type="button" onClick={props.onCreateSkill}>+ Skill</button>
  <button type="button" onClick={props.onRebuildTeam}>Rebuild</button>
</div>
```

```css
/* team-panel-inline-actions — 세 버튼 균일 배치 */
.team-panel-inline-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.team-panel-inline-actions button {
  flex: 1;
  min-width: 60px;
  font-size: 12px;
  padding: 4px 8px;
}
```

---

### 6.2 RightPanel — New Skill 섹션 제거

**파일:** `webview-ui/src/panels/RightPanel.tsx`

#### 현재 상태 (검증 완료)
- `newSkill` LibrarySectionKey: ❌ 여전히 존재 (line 131)
- "New Skill" 섹션 UI: ❌ 여전히 존재

#### 제거 대상

```tsx
// 삭제할 type 멤버
type LibrarySectionKey = "skills" | "agents" | "patterns" | "mcp" | "rules";
// "newSkill" 제거

// 삭제할 state
// newSkill: false (collapsedSections 초기값에서 제거)

// 삭제할 UI 블록 (line 625~631 및 하위 form 전체)
// <button onClick={() => toggleLibrarySection("newSkill")}>
//   <span>New Skill</span>
// </button>
// {!collapsedSections.newSkill && ( ... form ... )}

// 삭제할 state
// const [skillName, setSkillName] = useState("");
// const [skillDescription, setSkillDescription] = useState("");
```

---

### 6.3 AgentCreationModal — Backend & Model 필드 추가

**파일:** `webview-ui/src/panels/AgentCreationModal.tsx`

#### 현재 상태 (검증 완료)
- Backend 선택 필드: ❌ 없음
- Model 선택 필드: ❌ 없음

#### 추가 UI 레이아웃

```
[Name        ] [Role ▾    ]
[Backend ▾   ] [Model ▾   ]
[Role label  ]
[Description ]
[ ] Is Orchestrator
[System Prompt              ]
[Cancel] [Create Agent]
```

Backend 선택 시 Model 드롭다운이 해당 Backend의 모델 목록으로 동적 변경.
`MODEL_OPTIONS`는 `webview-ui/src/utils/modelOptions.ts`에서 임포트.

---

### 6.4 ChatInput — Backend 동기화 & Model Dropdown

**파일:** `webview-ui/src/panels/ChatInput.tsx`

#### 현재 상태 (검증 완료)
- Backend select: ✅ 구현됨
- Model: ❌ `<input>` 자유 입력 (line 68) — `<select>` 전환 필요
- Orchestrator lock 상태 표시: ❌ 없음

#### 수정 스펙

```tsx
// Backend select에 orchestrator lock 표시
<select
  value={props.backendId}
  onChange={...}
  disabled={props.disabled || props.orchestratorLocked}
>
  {/* orchestratorLocked일 때 title에 안내 */}
</select>
{props.orchestratorLocked && (
  <span className="chat-backend-locked-hint">
    Orchestrator 고정
  </span>
)}

// Model: input → select
{(MODEL_OPTIONS[props.backendId] ?? []).length > 0 ? (
  <select value={props.modelId ?? ""} onChange={...}>
    <option value="">기본 모델</option>
    {MODEL_OPTIONS[props.backendId].map((m) => (
      <option key={m.id} value={m.id}>{m.label}</option>
    ))}
  </select>
) : (
  <input value={props.modelId ?? ""} placeholder="model (optional)" ... />
)}
```

---

### 6.5 Build Prompt Bar & Canvas Controls 레이아웃

**파일:** `webview-ui/src/styles.css`

#### 현재 상태 (검증 완료)
```css
/* 현재 — 겹침 발생 */
.build-prompt-bar { bottom: 32px; z-index: 12; }
.canvas-controls  { bottom: 14px; z-index: 5;  }  /* ← bar에 가려짐 */
```

#### 수정 스펙

```css
/* canvas-controls를 build-prompt-bar 위로 올림 */
.canvas-controls {
  position: absolute;
  right: 14px;
  bottom: 90px;    /* build-prompt-bar 높이(~50px) + 여유 40px */
  z-index: 15;     /* bar(12)보다 높게 */
}

/* build-prompt-bar는 더 아래로 */
.build-prompt-bar {
  bottom: 16px;    /* 32px → 16px */
  z-index: 12;
}
```

**또는 canvas-controls를 우측 수직 배치 (대안):**
```css
.canvas-controls {
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  flex-direction: column;
  bottom: auto;
}
```

---

### 6.6 팀 생성 후 자동 레이아웃

**관련 파일:**
- `webview-ui/src/canvas/GraphView.tsx` — `autoLayoutSignal` prop 수신
- `webview-ui/src/App.tsx` — 팀 Apply 후 signal 발신
- `webview-ui/src/canvas/layout/tidyLayout.ts` — 기존 tidy 로직 재활용

#### 현재 상태 (검증 완료)
- `applyTidyLayout` 함수: ✅ 존재 (`tidyLayout.ts`)
- 자동 실행 트리거: ❌ 없음 (사용자가 "Tidy" 버튼 클릭 시만 실행)

#### 자동 레이아웃 배치 규칙 (기존 tidyLayout.ts 기준)

| 노드 타입 | X 좌표 | 배치 |
|----------|--------|------|
| Agent | 90 | 좌측 열 |
| Provider | 360 | 중앙 열 |
| Skill | 680 | 우측 열 |
| 수직 간격 | 46px | Agent 간 |

팀 Apply 성공 → 500ms 지연 → `autoLayoutSignal` 증가 → `applyTidyLayout` 자동 실행 → 노드 위치 저장

---

### 6.7 2차 개정 체크리스트

#### 컴포넌트 변경
- [ ] `TeamPanel.tsx` — `+ Skill` 버튼 추가 (onCreateSkill prop 포함)
- [ ] `RightPanel.tsx` — `newSkill` 섹션 전체 제거
- [ ] `AgentCreationModal.tsx` — Backend, Model 선택 필드 추가
- [ ] `ChatInput.tsx` — model input → select 전환, orchestratorLocked prop

#### 레이아웃 변경
- [ ] `styles.css` — `canvas-controls` bottom 값 조정 (90px 이상)
- [ ] `styles.css` — `build-prompt-bar` bottom 값 조정 (16px)
- [ ] `GraphView.tsx` — `autoLayoutSignal` prop 처리 useEffect 추가

#### 신규 파일
- [ ] `webview-ui/src/utils/modelOptions.ts` — backend별 모델 목록 상수
