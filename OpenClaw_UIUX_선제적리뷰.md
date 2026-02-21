# Open Claw (AgentCanvas) 심층 UI/UX 분석 및 구체적 개선 방안 (코드 포함)

해당 문서는 프론트엔드 코드베이스(`App.tsx`, `RightPanel.tsx`, `LeftSidebar.tsx`, `TaskPanel.tsx`, `AgentDetailModal.tsx` 등)에서 발견된 심층적인 UI/UX 페인 포인트(Pain Point)와 이를 해결하기 위한 **구체적인 코드 구현 방향 및 예시**를 정리한 문서입니다.

---

## 1. Right Panel 컨텍스트 충돌 (채팅 vs 인스펙터)

### 🚨 문제점
`App.tsx`의 `onSelectNode` 로직이 발동할 때 무조건 `setPanelMode("library")`를 호출하여 현재 작업 중인 채팅(`ChatPanel`) 창을 덮어버리는 심각한 UX 끊김 현상이 발생합니다.

### 🛠️ 개선 방안 및 코드 예시
**인스펙터 뷰어의 독립적인 레이어화 (Floating Inspector)**

기존처럼 `panelMode`를 공유 메뉴 상태로 쓰지 말고, `selectedNode`가 있을 때는 Right Panel 위에 겹치는 오버레이 형태나 화면 최하단의 가로형 Bottom Panel로 분리해야 합니다.

**App.tsx 리팩토링 예시:**
```tsx
// AS-IS: 현재 강제 탭 전환 로직
onSelectNode={(node) => {
  setSelectedNode(node);
  setSelectedEdge(undefined);
  // 이 문장 때문에 채팅창이 날아감
  setPanelMode("library"); 
  setPanelOpen(true);
}}

// TO-BE: 탭 전환 없이 인스펙터 상태만 켬
onSelectNode={(node) => {
  setSelectedNode(node);
  setSelectedEdge(undefined);
  // 채팅창은 그대로 두고, 하단 인스펙터 뷰 창을 엽니다.
  setIsInspectorVisible(true); 
}}
```

**RightPanel.tsx 혹은 App.tsx 렌더링 예시:**
```tsx
{/* 기존 RightPanel 상단 탭 내비게이션은 Chat/Nodes 유지 */}
<RightPanel mode={panelMode} ... />

{/* 캔버스 하단이나 우측에 오버레이 형태로 띄우는 Inspector */}
{isInspectorVisible && selectedNode && (
  <div className="floating-inspector">
    <div className="inspector-header">
       <span>{selectedNode.data.label} 상세속성</span>
       <button onClick={() => setIsInspectorVisible(false)}>X</button>
    </div>
    {/* 선택된 노드의 종류에 맞는 컴포넌트 렌더링 */}
    <NodePropertyEditor node={selectedNode} />
  </div>
)}
```

---

## 2. 모달 폼(Modal Form)의 인지 과부하 (`AgentDetailModal.tsx`)

### 🚨 문제점 
에이전트 상세 모달(`AgentDetailModal.tsx`)의 'Overview' 탭 하나에 수십 개의 속성(이름, 역할, 시스템 프롬프트부터 시작해서 CLI 터미널 경로, 샌드박스 정책, 예산까지)이 나열되어 있어, 사용자가 핵심 정보를 찾기 매우 힘듭니다.

### 🛠️ 개선 방안 및 코드 예시
**아코디언(Collapse)을 통한 폼 섹션 분리**

가장 많이 쓰는 "General Info"와 개발자/어드민용 "Advanced Runtime Settings"를 시각적으로 분리합니다.

**AgentDetailModal.tsx 리팩토링 예시:**
```tsx
// 1. 상태 추가
const [showAdvanced, setShowAdvanced] = useState(false);

// 2. Overview 탭 렌더링 부 변경
<div id="agent-tabpanel-overview" role="tabpanel">
  {/* General Settings */}
  <div className="inspector-block">
    <div className="inspector-field">
      <label>이름 및 역할 (Name & Role)</label> ...
    </div>
    <div className="inspector-field">
      <label>시스템 프롬프트 (System Prompt)</label> ...
    </div>
  </div>

  {/* 아코디언 토글 라인 */}
  <div className="accordion-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
    <span>{showAdvanced ? "▼ 고급 런타임 설정 숨기기" : "▶ 고급 런타임 설정 열기 (CLI, 예산, 툴 접근 등)"}</span>
  </div>

  {/* Advanced Settings */}
  {showAdvanced && (
    <div className="inspector-block advanced-settings">
       <div className="inspector-field">
          <label>Runtime Mode</label> ...
       </div>
       <div className="inspector-field">
          <label>Codex Sandbox Policy</label> ...
       </div>
       {/* ... 수많은 런타임 설정들 ... */}
    </div>
  )}
</div>
```

---

## 3. 스케줄/태스크 관제 실시간 시각화 부재 (`TaskPanel.tsx` & Graph)

### 🚨 문제점
백그라운드에서 복잡한 Agent Task가 실행될 때(`status-running`), 시각적인 피드백(진행률 바, 로딩 스피너)이 정적인 텍스트(`Running`)나 단순 아이콘으로만 처리됩니다.

### 🛠️ 개선 방안 및 코드 예시
**애니메이션된 Progress Bar 및 GraphView 연동 반영**

**TaskPanel.tsx 리팩토링 예시:**
```tsx
// AS-IS: 진행률을 단순 텍스트 백분율로만 표시
<div className="item-subtitle">
  {agentNameById.get(task.agentId) ?? task.agentId} · {task.status}
  {typeof task.progress === "number" ? ` · ${Math.round(task.progress * 100)}%` : ""}
</div>

// TO-BE: ProgressBar 추가 및 status에 따른 애니메이션 클래스 부여
<div className="item-subtitle">
  {agentNameById.get(task.agentId) ?? task.agentId} · 
  <span className={`status-badge status-${task.status}`}>{task.status.toUpperCase()}</span>
</div>

{typeof task.progress === "number" && (
  <div className="task-progress-track">
     <div 
       className={`task-progress-fill ${task.status === 'running' ? 'animated-stripes' : ''}`} 
       style={{ width: `${task.progress * 100}%` }}
     />
  </div>
)}
```

**GraphView 연동 개선 아이디어:**
`Task` 데이터 배열을 `GraphView` 컴포넌트로 prop으로 넘겨서, `AgentNode` 내부 렌더러가 자신의 `agentId`에 해당하는 "running" Task가 존재할 경우, 노드 다이어그램 주위에 Glowing(맥동) 이펙트를 주도록 구현.

---

## 4. 모델 / 백엔드 설정 피드백 부재 (`BackendSettingsModal.tsx`)

### 🚨 문제점
사용자가 CLI `command`나 `Args`를 타이핑할 때 에러가 있는지 여부를 "Save" 후 에러로그를 보기 전까지 알 수 없습니다.

### 🛠️ 개선 방안 및 코드 예시
**실시간 응답성(Test Ping) 도입**

Debounce 훅을 사용하여 입력이 끝난 뒤에 가벼운 ping(예: `--help` 나 `version` 호출)을 백그라운드로 실행하고 인풋 옆에 초록/빨강 상태 등을 띄워줍니다.

```tsx
// 입력된 커맨드에 대한 실시간 유효성 체크 훅 (가상)
const { isValid, isChecking } = useBackendValidation(draft.command, draft.argsText);

<div className="inspector-field">
  <label>
    Command 
    {isChecking && <span className="spinner" />}
    {!isChecking && isValid === true && <span className="valid-tick">✔ 사용 가능</span>}
    {!isChecking && isValid === false && <span className="error-tick">✘ 경로 확인 필요</span>}
  </label>
  <input
    value={draft.command}
    onChange={(e) => updateDraft('command', e.target.value)}
  />
</div>
```

---

## 5. 온보딩 Empty State의 소극성 (GraphView.tsx)

### 🚨 문제점
새 워크스페이스를 열었을 때 중앙 캔버스가 텅 비어있고, 우측클릭이나 조그만 `Build Team` 버튼만 있습니다.

### 🛠️ 개선 방안 및 코드 예시
**화면 한가운데를 가득 채우는 메인 CTA 배치 (`GraphView.tsx`)**

```tsx
// 빈 캔버스 상태일 때 오버레이를 그림
{Object.keys(nodes).length === 0 && (
  <div className="empty-canvas-hero">
    <h1>Welcome to AgentCanvas</h1>
    <p>오케스트레이터 AI에게 목표를 제시하여, 맞춤형 에이전트 팀을 단숨에 구축해 보세요.</p>
    <button 
      className="hero-cta-button" 
      onClick={() => {
        // App.tsx에서 받아온 콜백. 우측 패널을 Chat으로 열고 포커스
        onOpenBuildPrompt(); 
      }}
    >
      ✨ AI 오케스트레이터와 함께 팀 설계하기
    </button>
    <div className="hero-secondary-actions">
       <button onClick={onAddAgent}>수동으로 에이전트 추가</button>
       <button onClick={onImportPack}>팀 팩(Zip) 불러오기</button>
    </div>
  </div>
)}
```
