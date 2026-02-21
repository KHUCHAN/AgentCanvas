# Open Claw UX — Prompt-First 리디자인, 접근성, 사용자 경험

**Date:** 2026-02-19

---

## Part 1: UX Redesign — Prompt-First + Kanban

### 1. 패러다임 전환

#### 현재: 노드 캔버스 중심

```
사용자 → 18개 버튼 중 New Agent 찾기 → 수동 노드 배치 → 엣지 연결 → Run → 우측 패널에서 결과 확인
```

#### 목표: 프롬프트 → 팀 빌드 → 작업 지시 → 칸반

```
사용자 → 프롬프트 입력 → 팀 빌드 → 팀에 작업 지시 → 칸반 보드에 태스크 자동 생성
         ("코딩팀 만들어줘")  (자동)  ("이 코드 리팩터링해")  (To Do → In Progress → Done)
```

---

### 2. 3단계 워크플로우

```
┌──────────────┐      ┌───────────────┐      ┌───────────────┐
│   STEP 1     │      │   STEP 2      │      │   STEP 3      │
│  Build Team  │ ───→ │  Give Work    │ ───→ │  Kanban Board  │
│  (프롬프트)   │      │  (작업 지시)   │      │  (결과 추적)   │
└──────────────┘      └───────────────┘      └───────────────┘
  화면 가운데            오른쪽 패널            왼쪽 메인 영역
```

| 단계 | 사용자 행동 | 시스템 반응 |
|------|------------|-----------|
| **Step 1** | 가운데 프롬프트에 "코드 리뷰 팀 만들어줘" 입력 | Agent 팀 구조 생성 → 오른쪽에 팀 표시 |
| **Step 2** | 오른쪽 팀 패널에서 "이 PR 리뷰해줘" 작업 지시 | 태스크 분해 → 에이전트별 할당 |
| **Step 3** | 칸반 보드에서 진행 상황 실시간 확인 | To Do → In Progress → Done 자동 이동 |

---

### 3. 새로운 레이아웃

#### 3.1 초기 상태 (팀 미생성)

```
┌──────────────────────────────────────────────────────────────┐
│  🟢 Open Claw                           ⚙ Settings    ⌘K  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│                                                              │
│              ┌────────────────────────────┐                  │
│              │                            │                  │
│              │  🤖 Build Your Agent Team  │                  │
│              │  자연어로 원하는 팀을 설명하세요 │                  │
│              │                            │                  │
│              │  ┌──────────────────────┐  │                  │
│              │  │ "풀스택 개발팀 만들어줘  │  │                  │
│              │  │  프론트, 백엔드, QA 나눠서"│  │                  │
│              │  └──────────────────────┘  │                  │
│              │                            │                  │
│              │  [Code Review] [Full Stack] │                  │
│              │  [Docs Team]  [Custom...]   │                  │
│              │                            │                  │
│              │  Backend: [Auto ▾]         │                  │
│              │                            │                  │
│              │       [▶ Build Team]       │                  │
│              └────────────────────────────┘                  │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  No team yet · ⌘K for all commands                           │
└──────────────────────────────────────────────────────────────┘
```

깔끔한 첫 화면. 프롬프트 하나에 집중.

---

#### 3.2 팀 빌드 후 — 칸반 + Team Panel

팀이 생성되면 자동으로 2-column 레이아웃 전환:

```
┌──────────────────────────────────────────────────────────────┐
│  🟢 Open Claw   [Kanban│Graph│Schedule]    ⚙ Settings  ⌘K │
├───────────────────────────────┬──────────────────────────────┤
│                               │  MY TEAM                     │
│  KANBAN BOARD                 │  ────────────────────    │
│                               │                          │
│  ┌─ To Do ──┐ ┌ Progress ┐ ┌Done┐│  🎯 Lead (Orchestrator)  │
│  │          │ │          │ │    ││     codex-default        │
│  │ ┌──────┐ │ │ ┌──────┐ │ │    ││     Skills: 2 · MCP: 1   │
│  │ │ API  │ │ │ │ Auth │ │ │    ││                          │
│  │ │리팩터 │ │ │ │ 구현  │ │ │    ││  👨‍💻 Frontend Coder       │
│  │ │──────│ │ │ │──────│ │ │    ││     claude               │
│  │ │🧪 QA │ │ │ │👨‍💻 FE │ │ │    ││                          │
│  │ └──────┘ │ │ └──────┘ │ │    ││  👨‍💻 Backend Coder        │
│  │          │ │          │ │    ││     codex-default        │
│  │ ┌──────┐ │ │          │ │    ││                          │
│  │ │ DB   │ │ │          │ │    ││  🧪 QA Tester            │
│  │ │마이그 │ │ │          │ │    ││     gemini               │
│  │ │──────│ │ │          │ │    ││                          │
│  │ │👨‍💻 BE │ │ │          │ │    ││  [+ Agent] [Rebuild]     │
│  │ └──────┘ │ │          │ │    ││  ────────────────────    │
│  │          │ │          │ │    ││  WORK                    │
│  └──────────┘ └──────────┘ └────┘│  ┌────────────────────┐  │
│                                   │  │ "이 PR 리뷰해줘"    │  │
│                                   │  └────────────────────┘  │
│                                   │  [▶ Submit Work]            │
│                                   │  ────────────────────    │
│                                   │  HISTORY                 │
│                                   │  · PR #42 — 완료 (3m)   │
│                                   │  · 리팩터링 — 실행 중... │
├───────────────────────────────┴──────────────────────────────┤
│  Agents 4 · Tasks 5 · Done 0 · Errors 0    [▶ Build New]    │
└──────────────────────────────────────────────────────────────┘
```

---

#### 3.3 칸반 보드 상세

```
┌─── To Do ──────────┐  ┌── In Progress ─────┐  ┌──── Done ──────────┐
│                     │  │                    │  │                     │
│  ┌───────────────┐  │  │  ┌──────────────┐  │  │  ┌───────────────┐  │
│  │ API 리팩터링    │  │  │  │ Auth 모듈 구현 │  │  │  │ DB 스키마 설계  │  │
│  │ ─────────────  │  │  │  │ ────────────  │  │  │  │ ─────────────  │  │
│  │ 👨‍💻 Backend     │  │  │  │ 👨‍💻 Frontend   │  │  │  │ 👨‍💻 Backend     │  │
│  │ Priority: High │  │  │  │ ━━━━━━░░ 60%  │  │  │  │ ✓ 3분 전 완료   │  │
│  │ deps: DB 스키마 │  │  │  │ Started: 2m   │  │  │  │ Output: [보기]  │  │
│  └───────────────┘  │  │  └──────────────┘  │  │  └───────────────┘  │
│                     │  │                    │  │                     │
│  ┌───────────────┐  │  │                    │  │                     │
│  │ 테스트 작성     │  │  │                    │  │                     │
│  │ ─────────────  │  │  │                    │  │                     │
│  │ 🧪 QA Tester  │  │  │                    │  │                     │
│  │ Priority: Med  │  │  │                    │  │                     │
│  │ deps: API, Auth│  │  │                    │  │                     │
│  └───────────────┘  │  │                    │  │                     │
│                     │  │                    │  │                     │
└─────────────────────┘  └────────────────────┘  └─────────────────────┘
```

**칸반 카드 구성:**

| 요소 | 설명 |
|------|------|
| 태스크 이름 | 작업 제목 (프롬프트에서 자동 분해 또는 수동) |
| 담당 에이전트 | 아이콘 + 에이전트 이름 |
| 우선순위 | High / Medium / Low (색상 인디케이터) |
| 의존성 | deps: 선행 태스크 표시 |
| 진행률 | In Progress 상태에서 프로그레스 바 |
| 출력물 | Done 상태에서 [결과 보기] 링크 |

**칸반 컬럼 매핑 (기존 Task 상태 활용):**

| 칸반 컬럼 | 기존 Task status |
|-----------|-----------------|
| **To Do** | `planned`, `ready` |
| **In Progress** | `running` |
| **Blocked** | `blocked` (별도 표시 또는 To Do에 경고 뱃지) |
| **Done** | `done` |
| **Failed** | `failed` (Done 컬럼에 에러 뱃지) |

**인터랙션:**
- 카드 드래그 → 수동 상태 변경 (To Do ↔ 재정렬)
- 카드 클릭 → 태스크 상세 (출력물, 로그, 시간)
- 카드 우클릭 → 재실행, 핀, 삭제

---

#### 3.4 뷰 모드 토글

헤더의 `[Kanban│Graph│Schedule]` 토글로 같은 데이터를 다른 시각으로:

| 뷰 | 용도 |
|----|------|
| **Kanban** (기본) | 태스크 진행 상황 추적, 일반 사용자 친화적 |
| **Graph** | 기존 ReactFlow 캔버스, 에이전트/스킬/규칙 구조 확인, 파워 유저용 |
| **Schedule** | 간트 차트 타임라인, 시간축 기반 실행 흐름 |

---

### 4. 컴포넌트별 상세 설계

#### 4.1 상단 헤더 (미니멀)

```
┌──────────────────────────────────────────────────────────────┐
│  🟢 Open Claw    [Kanban│Graph│Schedule]    ⚙ Settings  ⌘K │
└──────────────────────────────────────────────────────────────┘
```

| 요소 | 기능 |
|------|------|
| 🟢 Open Claw | 브랜드 + 홈 (초기 빌드 프롬프트 화면 복귀) |
| [Kanban \| Graph \| Schedule] | 메인 뷰 전환 (팀 빌드 후에만 노출) |
| ⚙ Settings | 통합 설정 모달 |
| ⌘K | Command Bar |

**기존 18개 버튼의 새 위치:**

| 기존 | 새 위치 | 접근 |
|------|---------|------|
| New Skill | ⌘K `"new skill"` | 2클릭 |
| New Agent | 가운데 Build Prompt (주요) / Team Panel [+ Agent] (수동) | 1클릭 |
| Save / Load Flow | `Ctrl+S` / `Ctrl+O` 또는 ⌘K | 키보드 |
| Refresh | `R` 키 | 키보드 |
| Run | Team Panel [▶ Submit Work] | 1클릭 |
| Graph / Schedule | 헤더 뷰 토글 | 1클릭 |
| Export / Import | ⚙ Settings → Packs | 2클릭 |
| Validate | 자동 + ⌘K | 0~2클릭 |
| Common Rule | ⌘K `"new rule"` | 2클릭 |
| Ops Docs / Shortcuts | ⚙ Settings | 2클릭 |
| AI Prompt | 가운데 Build Prompt로 승격 | 0클릭 (메인) |
| Command Bar | 헤더 ⌘K | 1클릭 |
| Hide Panel | 드래그 리사이즈 | 제스처 |

---

#### 4.2 가운데 Build Prompt

초기 화면의 유일한 주인공. 기존 `PromptPanel` 로직을 승격:

| 요소 | 설명 |
|------|------|
| 헤드라인 | "Build Your Agent Team" (28px, bold) |
| 서브텍스트 | "자연어로 원하는 팀을 설명하세요" (15px, soft) |
| 텍스트에어리어 | 560px 너비, 120px 높이, 플레이스홀더 힌트 |
| Quick Start 칩 | `[Code Review]` `[Full Stack]` `[Docs Team]` `[Data Pipeline]` |
| Backend 셀렉트 | Auto / GPT / Claude / Gemini |
| Build Team 버튼 | Primary CTA, accent 배경, pill 형태, 48px |

**기존 코드 연결:**
- Build Team 클릭 → `onGenerateAgentStructure()` 호출 (기존 PromptPanel 로직)
- 빌드 완료 → `AgentPreviewModal` 자동 적용 → Team Panel + Kanban 전환

---

#### 4.3 오른쪽 Team Panel

```
┌─ MY TEAM ──────────────────────┐
│                                 │
│  [Team 섹션]                    │
│  에이전트 카드 리스트             │
│  [+ Agent]  [Rebuild Team]     │
│                                 │
│  ────────────────────────────  │
│  [Work 섹션]                    │
│  작업 프롬프트 입력               │
│  [▶ Submit Work]                  │
│                                 │
│  ────────────────────────────  │
│  [History 섹션]                 │
│  실행 기록 리스트                │
│                                 │
└─────────────────────────────────┘
```

**3개 섹션:**

| 섹션 | 내용 |
|------|------|
| **MY TEAM** | 빌드된 에이전트 카드. 역할 아이콘 + 이름 + 프로바이더 + Skills/MCP 수 + [Edit]. [+ Agent]로 수동 추가, [Rebuild]로 프롬프트 재빌드 |
| **WORK** | 작업 프롬프트 입력 + [▶ Submit Work]. 실행 시 태스크가 자동 분해되어 칸반 카드로 생성 |
| **HISTORY** | 실행 기록. 클릭하면 해당 Run의 칸반 상태 표시 |

**[Edit] 클릭 시:** 기존 `AgentDetailModal` (역할, 스킬, MCP, 시스템 프롬프트 수정)

**[▶ Submit Work] 동작:**
1. 작업 프롬프트를 Orchestrator에게 전달
2. Orchestrator가 태스크 분해 → Task[] 생성
3. 각 Task가 칸반 카드로 To Do 컬럼에 추가
4. `executeRunLoop`이 deps 기반으로 순서대로 실행
5. 실행 중 카드가 In Progress → Done으로 자동 이동

---

#### 4.4 칸반 보드 컴포넌트

**신규 파일:** `KanbanView.tsx`

기존 `ScheduleView.tsx`의 Task 데이터를 칸반 형태로 렌더링:

```typescript
// 개념적 구조
type KanbanColumn = {
  id: "todo" | "progress" | "done" | "blocked";
  title: string;
  tasks: Task[];
};

// 기존 Task status → 칸반 컬럼 매핑
function getColumn(status: Task["status"]): KanbanColumn["id"] {
  switch (status) {
    case "planned":
    case "ready":
      return "todo";
    case "running":
      return "progress";
    case "blocked":
      return "blocked";
    case "done":
    case "canceled":
      return "done";
    case "failed":
      return "done"; // 에러 뱃지 표시
  }
}
```

**칸반 카드 CSS:**

```css
.kanban-board {
  display: flex;
  gap: 16px;
  padding: 20px;
  height: 100%;
  overflow-x: auto;
}

.kanban-column {
  min-width: 280px;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-soft);
  border-radius: 12px;
  padding: 12px;
}

.kanban-column-header {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--fg-soft);
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kanban-column-count {
  background: var(--bg-elevated);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.kanban-card {
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius, 8px);
  padding: 12px 16px;
  margin-top: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.kanban-card:hover {
  border-color: var(--secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.kanban-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
  margin-bottom: 8px;
}

.kanban-card-agent {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fg-soft);
}

.kanban-card-priority {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.kanban-card-priority.high { background: var(--danger); }
.kanban-card-priority.medium { background: var(--warn); }
.kanban-card-priority.low { background: var(--fg-soft); }

.kanban-card-deps {
  font-size: 11px;
  color: var(--fg-soft);
  margin-top: 6px;
}

.kanban-card-progress {
  margin-top: 8px;
  height: 4px;
  background: var(--line);
  border-radius: 2px;
  overflow: hidden;
}

.kanban-card-progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s;
}

/* In Progress 컬럼 하이라이트 */
.kanban-column.progress {
  border-top: 3px solid var(--accent);
}

/* Done 컬럼 */
.kanban-column.done .kanban-card {
  opacity: 0.7;
}

/* Failed 카드 */
.kanban-card.failed {
  border-left: 3px solid var(--danger);
}

/* Blocked 카드 */
.kanban-card.blocked {
  border-left: 3px solid var(--warn);
  opacity: 0.8;
}
```

---

#### 4.5 하단 상태 바

```
┌────────────────────────────────────────────────────────────┐
│  Agents 4 · Tasks 5 · Done 2 · Errors 0    [▶ Build New]  │
└────────────────────────────────────────────────────────────┘
```

| 요소 | 설명 |
|------|------|
| 상태 카운터 | Agents, Tasks (총), Done (완료), Errors |
| [▶ Build New] | 초기 Build Prompt 화면으로 복귀 |

---

#### 4.6 ⚙ Settings 모달

기존 사이드바 + 툴바의 희소 기능 통합:

| 탭 | 내용 |
|----|------|
| **General** | Workspace Locations + Validation 설정 + Flow 관리 (Save/Load) |
| **Providers** | GPT/Codex, Claude, Gemini 관리 |
| **OPS** | Common Rules + MCP Servers + Ops Docs |
| **Packs** | Export/Import Skill Pack |
| **Shortcuts** | 키보드 단축키 목록 |

---

### 5. 화면 상태 전환 흐름

```
                    ┌──────────────┐
                    │   앱 시작     │
                    └──────┬───────┘
                           ▼
                  ┌──────────────────┐
              ┌── │ 저장된 팀 있음?   │ ──┐
              │   └──────────────────┘   │
             YES                         NO
              │                          │
              ▼                          ▼
   ┌────────────────┐       ┌────────────────────┐
   │ Kanban + Team   │       │ Build Prompt 모드   │
   │ (2-column)      │       │ (가운데 프롬프트)    │
   └───────┬────────┘       └─────────┬──────────┘
           │                          │
           │    프롬프트 입력 + Build    │
           │ ◄────────────────────────┘
           │
           ├── [Kanban] 탭 ──→ 칸반 보드 (기본)
           ├── [Graph] 탭 ──→ ReactFlow 캔버스 (파워 유저)
           ├── [Schedule] 탭 ──→ 간트 차트 타임라인
           │
           ├── 작업 프롬프트 [▶ Submit Work] ──→ 칸반 카드 자동 생성 + 실행
           │
           └── [▶ Build New] ──→ 초기 Build Prompt 화면
```

---

### 6. 기존 기능 매핑

#### 높은 빈도

| 기능 | 현재 | 새 위치 | 접근 |
|------|------|---------|------|
| Agent 팀 생성 | 툴바 New Agent | **가운데 Build Prompt** | 1클릭 |
| 작업 실행 | 툴바 Run → 우측 패널 | **Team Panel [▶ Submit Work]** | 1클릭 |
| 진행 추적 | Schedule 뷰 (복잡) | **칸반 보드 (직관적)** | 자동 |
| Agent 수정 | 노드 클릭 → Inspector | **Team Panel [Edit]** | 1클릭 |

#### 중간 빈도

| 기능 | 현재 | 새 위치 | 접근 |
|------|------|---------|------|
| Save Flow | 툴바 | `Ctrl+S` | 키보드 |
| Refresh | 툴바 | `R` | 키보드 |
| Graph 보기 | 기본 화면 | 헤더 [Graph] 탭 | 1클릭 |
| Schedule 보기 | 툴바 Schedule | 헤더 [Schedule] 탭 | 1클릭 |
| New Skill | 툴바 | ⌘K → "new skill" | 2클릭 |
| 수동 Agent 추가 | 툴바 | Team Panel [+ Agent] | 1클릭 |

#### 낮은 빈도

| 기능 | 현재 | 새 위치 | 접근 |
|------|------|---------|------|
| Export/Import Pack | 툴바 + 사이드바 | ⚙ → Packs | 2클릭 |
| Validate | 툴바 | 자동 + ⌘K | 0~2클릭 |
| Providers | 사이드바 | ⚙ → Providers | 2클릭 |
| Locations | 사이드바 | ⚙ → General | 2클릭 |
| Ops Docs | 툴바 | ⚙ → OPS | 2클릭 |

---

### 7. 구현 단계

#### Phase 1: Build Prompt 화면 (2일)

| # | 파일 | 작업 |
|---|------|------|
| 1-1 | `BuildPrompt.tsx` (신규) | 가운데 프롬프트 컴포넌트 (텍스트에어리어 + 퀵칩 + Build 버튼) |
| 1-2 | `App.tsx` | 앱 상태 머신: `idle` → `building` → `team-ready` |
| 1-3 | `App.tsx` | idle 상태 시 BuildPrompt 렌더링 |
| 1-4 | `styles.css` | `.build-prompt-*` 스타일 |
| 1-5 | `App.tsx` | Build Team → 기존 `onGenerateAgentStructure` 연결 |

#### Phase 2: KanbanView 구현 (2~3일)

| # | 파일 | 작업 |
|---|------|------|
| 2-1 | `KanbanView.tsx` (신규) | 3~4 컬럼 칸반 보드 (To Do / In Progress / Done + Blocked) |
| 2-2 | `KanbanCard.tsx` (신규) | 태스크 카드 컴포넌트 (에이전트, 우선순위, deps, 진행률) |
| 2-3 | `KanbanView.tsx` | 기존 Task[] 상태 → 칸반 컬럼 매핑 |
| 2-4 | `KanbanView.tsx` | 카드 클릭 → 태스크 상세 패널 |
| 2-5 | `KanbanView.tsx` | 실시간 상태 업데이트 (TaskEvent 구독) |
| 2-6 | `styles.css` | `.kanban-*` 스타일 전체 |

#### Phase 3: Team Panel (2일)

| # | 파일 | 작업 |
|---|------|------|
| 3-1 | `TeamPanel.tsx` (신규) | 에이전트 카드 리스트 + Work 프롬프트 + History |
| 3-2 | `App.tsx` | team-ready 상태에서 2-column (Kanban + TeamPanel) |
| 3-3 | `TeamPanel.tsx` | [Edit] → AgentDetailModal 연결 |
| 3-4 | `TeamPanel.tsx` | [▶ Submit Work] → `onRunFlow` 연결 + 칸반 업데이트 |
| 3-5 | `TeamPanel.tsx` | [+ Agent] → AgentCreationModal 연결 |
| 3-6 | `TeamPanel.tsx` | [Rebuild] → Build Prompt 복귀 |

#### Phase 4: 헤더 축소 + 사이드바 제거 (1~2일)

| # | 파일 | 작업 |
|---|------|------|
| 4-1 | `App.tsx` | 상단 18버튼 → 미니멀 헤더 (브랜드 + 뷰 토글 + Settings + ⌘K) |
| 4-2 | `App.tsx` | LeftSidebar 렌더링 제거 |
| 4-3 | `styles.css` | `.studio-shell` grid 1열로 변경 |
| 4-4 | `App.tsx` | 헤더 [Kanban│Graph│Schedule] 토글 구현 |

#### Phase 5: Settings 모달 + 정리 (2~3일)

| # | 파일 | 작업 |
|---|------|------|
| 5-1 | `SettingsModal.tsx` (신규) | 5탭 설정 모달 |
| 5-2 | `CommandBar.tsx` | 커맨드 목록 최신화 |
| 5-3 | 전체 | LeftSidebar.tsx 삭제, 미사용 CSS 정리 |
| 5-4 | 전체 | typecheck + 전체 기능 테스트 |

---

### 8. Before / After

#### Before

```
진입 → 18개 버튼 + 사이드바 6섹션 + 빈 ReactFlow 캔버스
     → "뭐부터 해야 하지?"
     → 45+ 요소 동시 노출
     → 진행 상황 = 노드 상태 변화 (직관적이지 않음)
```

#### After

```
진입 → 프롬프트 1개 + 템플릿 4개
     → "여기에 쓰면 되는구나"
     → 5개 요소 동시 노출
     → 진행 상황 = 칸반 카드 이동 (한눈에 파악)
```

| 지표 | Before | After | 개선 |
|------|--------|-------|------|
| 초기 화면 요소 수 | ~45개 | ~5개 | **-89%** |
| Agent 팀 생성 | 3클릭 | 1클릭 | **-67%** |
| 진행 상황 파악 | Schedule 뷰 학습 필요 | 칸반 (누구나 이해) | ★★★★★ |
| 첫 사용자 학습 곡선 | 매우 높음 | 매우 낮음 | ★★★★★ |
| 캔버스 영역 | ~55% | ~100% (초기) / ~65% (팀 후) | **+45%** |
| 작업 실행까지 | 5+ 클릭 | 2 클릭 | **-60%** |

---

### 9. 핵심 요약

```
프롬프트 입력 → 팀 빌드 → 작업 지시 → 칸반으로 추적
  (가운데)      (자동)     (오른쪽)     (왼쪽 메인)
```

1. **프롬프트가 진입점** — 앱 시작 시 화면 한가운데, "여기에 쓰세요"
2. **팀이 오른쪽에** — 빌드 결과 확인 + 바로 작업 지시
3. **칸반이 결과물** — To Do / In Progress / Done, 누구나 이해하는 진행 추적
4. **Graph/Schedule은 파워 유저 옵션** — 토글로 접근 가능, 기존 기능 100% 유지
5. **나머지는 Settings + ⌘K** — 2클릭 이내 모든 기능 접근

---

### 10. UI 리뷰 지적사항 (2026-02-20 반영) - ✅ 완료

> 실제 빌드된 UI 스크린샷 기반 리뷰 결과, 아래 7가지 개선 사항이 도출되었습니다.

#### REV-1. 스크롤 미구현 ✅
- **변경:** 오른쪽 패널 전체를 `display: flex; flex-direction: column; height: 100%` 구조로 리팩터, 각 콘텐츠 영역에 `flex: 1; overflow-y: auto; min-height: 0` 적용

#### REV-2. AI Prompt 탭 제거 → 캔버스 하단 Build Prompt 상시 배치 ✅
- **변경:** 오른쪽 패널에서 "AI Prompt" 탭 **완전 삭제**. 대신 캔버스 영역 하단 가운데에 Build Team 프롬프트 입력 UI를 **항상** 표시.

#### REV-3. 태스크 지시 탭 신규 추가 ✅
- **변경:** 오른쪽 패널에 **"Task"** 탭 신규 추가. 구성: 작업 프롬프트 입력 + 실행 히스토리.

#### REV-4. Memory 탭 제거 → Orchestrator 자동 관리 ✅
- **변경:** 오른쪽 패널에서 "Memory" 탭 **완전 삭제**. Memory는 Orchestrator가 자동 관리.

#### REV-5. "+ Agent" 버튼 추가 ✅
- **변경:** `[+ Rule]` 좌측에 **`[+ Agent]`** 버튼 추가.

#### REV-6. Agent 더블클릭 → 관리 팝업 ✅
- **변경:** Agent 노드 **더블클릭** 시 `AgentDetailModal` 즉시 열림.

#### REV-7. 캔버스 = 실시간 모니터링 화면 ✅
- **변경:** 캔버스를 **실시간 모니터링 대시보드**로 전환 (상태 표시, 프로그레스 바, 이펙트 SVG 적용).

---

## Part 2: 최신 UX 업데이트 내역 (2026-02-20)

### 2.1 StatusBar 최적화
- 기존의 복잡한 레이아웃을 섹션별(Agents, Tasks, Cost, Context, Backends)로 정리하여 가독성 향상.

### 2.2 RightPanel 워크플로우 고정
- **Node Library / Task / Run History** 3탭 체제로 고정하여 "지시-실행-확인" 흐름을 강화.

---

**예상 총 작업일: 9~12일 (Phase 1-3 완료)**

| Phase | 기간 | 우선순위 | 상태 |
|-------|------|----------|------|
| Phase 1: Build Prompt | 2일 | 🔴 즉시 | ✅ 완료 |
| Phase 2: KanbanView | 2~3일 | 🔴 즉시 | ✅ 완료 |
| Phase 3: Team Panel | 2일 | 🔴 즉시 | ✅ 완료 |
| Phase 4: 헤더 + 사이드바 정리 | 1~2일 | 🟡 다음 | 진행 중 |
| Phase 5: Settings + 마무리 | 2~3일 | 🟡 다음 | 진행 중 |


---

## Part 2: Keyboard Accessibility UX

### 1. 현재 작동하는 키보드 기능

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

### 2. 문제 분석: 사용자가 겪는 상황들

#### 시나리오 A — "마우스 없이 노드를 조작할 수 없다"

Skill/Rule/Folder/Note 노드에 마우스를 올려야만 **Open, Enable/Disable, Hide, Reveal** 등의 버튼이 나타난다. CSS가 `display: none` → `:hover` 시 `display: inline-flex`로 전환하기 때문에, 키보드 Tab 키로는 이 버튼들에 도달할 수 없다.

**영향받는 노드**: SkillNode, RuleDocNode, FolderNode, NoteNode (4개)

#### 시나리오 B — "모달을 Esc로 닫을 수 없다"

5개 모달 중 2개(CommandBar, AgentDetailModal)만 `Escape` 키 핸들러가 있다. 나머지 3개 모달은 Esc를 눌러도 아무 반응이 없다.

**Esc 미지원 모달**: SkillWizardModal, CommonRuleModal, ImportPreviewModal

#### 시나리오 C — "포커스가 어디 있는지 보이지 않는다"

CSS 전체에 `:focus-visible` 또는 `:focus` 스타일이 단 하나도 정의되어 있지 않다. 키보드로 Tab 키를 눌러 이동해도 현재 어떤 요소가 선택되어 있는지 시각적으로 알 수 없다.

#### 시나리오 D — "커맨드 바에서 결과를 선택할 수 없다"

커맨드 바에서 검색 후 Enter를 누르면 무조건 첫 번째 결과만 실행된다. 화살표 위/아래 키로 결과 목록을 탐색하거나 원하는 항목을 선택하는 기능이 없다.

#### 시나리오 E — "모달 안에서 포커스가 탈출한다"

모든 모달에 포커스 트랩(focus trap)이 없다. Tab 키를 계속 누르면 모달 뒤의 캔버스 요소로 포커스가 빠져나간다.

#### 시나리오 F — "노드를 더블클릭으로만 열 수 있다"

선택된 노드에서 Enter를 눌러 파일을 열거나, Delete를 눌러 삭제하는 등의 키보드 단축키가 없다. 모든 노드 상호작용은 마우스 더블클릭에 의존한다.

#### 시나리오 G — "Tab 키가 원래 목적으로 사용되지 않는다"

Tab 키가 라이브러리 패널 토글로 바인딩되어 있어서, 일반적인 폼 필드 이동 용도로 사용할 수 없다. 사용자가 예상하는 기본 브라우저 동작과 충돌한다.

---

### 3. 개선 항목 (우선순위별)

#### CRITICAL — 반드시 수정

##### C-1. `:focus-visible` 스타일 전역 추가

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

##### C-2. 호버 전용 액션 버튼을 키보드에서도 접근 가능하게

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

##### C-3. 모든 모달에 Escape 핸들러 추가

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

##### C-4. 캔버스 노드 키보드 조작 지원

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

#### HIGH — 가능한 빨리 수정

##### H-1. 모달 포커스 트랩 구현

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

##### H-2. 커맨드 바 화살표 키 네비게이션

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

##### H-3. 폼 Enter 키 제출 지원

**현재**: 모달 내 폼에서 Enter 키로 제출 불가 (버튼 클릭만 가능)
**목표**: Enter로 폼 제출

**대상 파일**: SkillWizardModal, CommonRuleModal, ImportPreviewModal

방법: 폼 요소를 `<form onSubmit={handleSubmit}>` 으로 감싸고, 제출 버튼에 `type="submit"` 속성 추가.

---

##### H-4. 모달 닫힌 후 포커스 복원

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

##### H-5. Tab 키 동작 충돌 해결

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

##### H-6. 노드 메뉴 ("...") 키보드 접근

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

#### MEDIUM — 경험 향상

##### M-1. 단축키 도움말 표시

**현재**: 사용자가 단축키를 알 방법 없음
**목표**: `?` 키 또는 도움말 버튼으로 단축키 목록 모달 표시

예시 구현: `Shift+?` 입력 시 단축키 치트시트 모달 오픈.

---

##### M-2. Agent Detail 모달 탭 키보드 전환

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

##### M-3. 툴팁/힌트에 단축키 표시

**현재**: 버튼 툴팁에 단축키 정보 없음
**목표**: 버튼에 마우스를 올리면 단축키도 함께 표시

예:
- "Zoom In" → "Zoom In (+)"
- "Fit View" → "Fit View (1)"
- "Command Bar" → "Command Bar (Ctrl+K)"

---

##### M-4. `prefers-reduced-motion` 미디어 쿼리 시 애니메이션 제거

**현재**: 일부 애니메이션에만 적용됨
**목표**: 노드 호버, 연결선 애니메이션 등도 포함

```css
@media (prefers-reduced-motion: reduce) {
  .react-flow__edge.animated path { animation: none; }
  .node-card { transition: none; }
}
```

---

##### M-5. ARIA 역할 및 라벨 보강

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

### 4. 구현 우선순위 로드맵

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

### 5. 파일별 수정 범위

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

### 6. 검증 체크리스트

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

---

*이 문서는 Open Claw의 UX 리디자인 및 키보드 접근성 개선 계획서입니다.*
