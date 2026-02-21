# Open Claw (AgentCanvas) 스크린샷 기반 시각적(Visual) UI 심층 리뷰

첨부해주신 4장의 스크린샷을 바탕으로, 실제 렌더링 된 화면에서 발생하는 **레이아웃 충돌, 시각적 밀도(Density) 문제, 정렬 및 텅 빈 상태(Empty State)의 어색함** 등을 종합적으로 분석하고 개선 코드를 제안합니다. (앞서 등록한 `.agent/workflows/ui_ux_review.md` 컨벤션을 따릅니다.)

---

## 1. 노드(Node) 카드의 시각적 과부하 (Information Overload)

### 🚨 GraphView - 지나치게 세로로 길고 텍스트가 빽빽한 노드 디자인
- **코드 분석 및 문제점:** 스크린샷 1과 2를 보면 캔버스에 배치된 에이전트(Agent) 노드들이 세로로 굉장히 깁니다. 내부 설명표(Description), 사용된 스킬(Skills), 프로바이더(Provider), 상태 태그 등이 **동일한 위계의 텍스트 크기와 좁은 줄간격**으로 렌더링되어 있어 가독성이 심각하게 떨어집니다. 이는 다이어그램이라기보단 좁은 폭을 가진 텍스트 문서의 나열처럼 보입니다.
- **UX 영향:** 정보를 한눈에 파악하기 어렵고, 여러 노드가 겹치거나 줌 아웃했을 때 화면이 지저분해 보입니다.

### 🛠️ 노드 내부 정보의 시각적 계층(Hierarchy) 분리 및 요약 표시
- **해결 방안 및 코드 예시:** 
  기본 줌 레벨에서는 이름과 역할(Role), 핵심 태그만 렌더링하고, 상세 설명(Description)이나 보유 스킬 목록은 말줄임표(Truncate) 처리하거나 아예 숨겨야 합니다. 상세 내용은 노드를 클릭했을 때 인스펙터(Inspector)에서 보여주도록 분리합니다.

**TO-BE CSS (styles.css - Node 컴포넌트 수정):**
```css
/* 노드 설명 텍스트를 최대 2줄까지만 허용하고 말줄임 처리 (Line Clamp) */
.node-desc {
  color: var(--fg-soft);
  font-size: 11px;
  line-height: 1.4;
  margin: 6px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2; /* 최대 2줄 표시 */
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 스킬/규칙 목록 해시태그 디자인으로 변경 (현재는 일반 텍스트 나열) */
.node-meta-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
  margin-right: 4px;
}
```

---

## 2. 하단 툴바와 상태 표시줄(Status Bar)의 레이아웃 충돌

### 🚨 GraphView - 컨트롤러 툴바가 가이드 텍스트를 가림
- **코드 분석 및 문제점:** 스크린샷 1의 왼쪽 하단을 보면 "Space/Ctrl+drag pan, Ctrl+Wheel zoom..." 이라는 단축키 가이드 텍스트 위로 **검은색 프롬프트 입력창 "Describe changes and rebuild your team..." 과 버튼들(Smart, Expand, Rebuild)이 겹쳐서 렌더링**되고 있습니다.
- **UX 영향:** 텍스트가 겹쳐서 읽기 불가능하며, UI가 깨진(Broken) 인상을 강하게 줍니다. Z-index나 Flex 레이아웃 구조가 충돌한 결과입니다.

### 🛠️ 하단 툴바의 Position 및 Z-index 정리
- **해결 방안 및 코드 예시:** Status Bar(가이드 텍스트)를 화면 하단 바닥에 완전히 고정된 블록으로 빼고, 플로팅 툴바는 그보다 위쪽(`bottom: 40px` 등)으로 띄워야 합니다. 추가로 툴바 배경에 `backdrop-filter`를 넣어 뒤쪽 텍스트가 비쳐 지저분해지는 것을 막습니다.

**TO-BE CSS (styles.css):**
```css
/* 하단 단축키 가이드 텍스트 바 (완전 하단 고정) */
.status-bar-guide {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 28px;
  background: var(--bg-elevated); /* 단색으로 뒤쪽 보호 */
  color: var(--fg-soft);
  font-size: 11px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  z-index: 10;
}

/* 중앙 플로팅 툴바 및 프롬프트 입력창 */
.floating-toolbar {
  position: absolute;
  bottom: 40px; /* 상태창을 피해서 위로 띄움 */
  left: 50%;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
  backdrop-filter: blur(8px); /* 뒤쪽 노드 라인 흐제 처리 */
  border: 1px solid var(--line);
  padding: 8px 12px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  z-index: 20; /* 확실한 오버레이 */
}
```

---

## 3. 칸반(Kanban) & 스케줄(Schedule) 모드의 허전한 엠티 스테이트(Empty State)

### 🚨 Kanban / Schedule - 화면의 70%가 아무것도 없는 어두운 여백
- **코드 분석 및 문제점:** 스크린샷 3과 4를 보면, 우측 패널(Right Panel)을 제외한 좌측 광활한 메인 뷰포트에 단지 "No tasks yet" 혹은 "No schedule run selected" 라는 조그만 텍스트 두 줄만 덩그러니 놓여있습니다.
- **UX 영향:** 시각적으로 매우 빈약하며, 유저가 이 화면에서 "다음에 무얼 해야 이 빈 공간을 채울 수 있는지" 헤매게 만듭니다.

### 🛠️ 플레이스홀더 일러스트 및 뚜렷한 가이드/버튼 제공
- **해결 방안 및 코드 예시:** 텍스트만 놓지 말고, 연하게 블렌딩된 백그라운드 아이콘(예: 캘린더나 칸반 보드 실루엣)을 추가하여 시각적 중심을 잡아줍니다. 또한 "Submit Work from the Task panel" 처럼 작은 텍스트가 아니라, 즉각 행동을 유도할 수 있는 CTA 버튼이나 하이라이트 지시 화살표를 제공하면 좋습니다.

**TO-BE 컴포넌트 마크업 (EmptyState.tsx / Kanban.tsx 예시):**
```tsx
// AS-IS
<div className="empty-state">
  <div className="title">No tasks yet</div>
  <div className="subtitle">Submit Work from the Task panel to populate this board.</div>
</div>

// TO-BE: 아이콘과 직관적인 Action을 포함
<div className="empty-state-enhanced">
  <div className="empty-icon-wrapper">
    <KanbanBoardIcon className="empty-icon" />
  </div>
  <h2 className="empty-title">진행 중인 태스크가 없습니다</h2>
  <p className="empty-desc">우측 패널의 AI Prompt를 통해 오케스트레이터에게 작업을 지시하거나, Task Panel에서 새 태스크를 생성하세요.</p>
  <button className="primary outline" onClick={openAiPrompt}>
    오케스트레이터 호출하기
  </button>
</div>
```
```css
/* TO-BE CSS */
.empty-state-enhanced {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  opacity: 0.8;
}
.empty-icon {
  width: 64px;
  height: 64px;
  color: var(--line-strong);
  margin-bottom: 16px;
}
```

---

## 4. Right Panel의 탭과 헤더(Toolbar) 시각적 대비 부족

### 🚨 우측 패널 헤더 - 버튼과 인풋, 칩(Chip)들이 전부 둥근 테두리 선으로만 그려짐
- **코드 분석 및 문제점:** 스크린샷들을 보면, 상단의 [Kanban] [Graph] [Schedule] 버튼과 우측 패널의 [Node Library] [AI Prompt], 그리고 내부의 뱃지들(All, Skills, Rules 등)이 모두 투명한 바탕에 1px 얇은 선(border)으로만 되어 있습니다.
- **UX 영향:** 어두운 배경에서 활성(Active) 상태와 비활성 상태의 차이가 뚜렷하지 않아 위계가 떨어집니다. 무엇을 클릭할 수 있고 무엇이 선택되어 있는지 눈에 바로 띄지 않습니다.

### 🛠️ 대비감이 높은 Segmented Control UI 도입
- **해결 방안 및 코드 예시:** 탭 형태의 버튼 그룹은 최근 Mac이나 iOS 디자인 트렌드인 "Segmented Control" (배경이 깔린 알약 형태 안에 선택된 버튼만 흰색 배경을 갖는 형태) 구조로 변경하면 시인성이 폭발적으로 증가합니다.

**TO-BE CSS (styles.css - Right Panel & Main Toolbar 탭 대응):**
```css
/* 버튼 그룹(탭)을 감싸는 컨테이너 */
.view-toggle, .right-panel-tabs {
  background: color-mix(in srgb, var(--bg-elevated) 50%, #000 50%);
  border-radius: 8px;
  padding: 4px;
  display: flex;
  gap: 4px;
}

/* 개별 탭 버튼 */
.view-toggle button, .right-panel-tabs button {
  background: transparent;
  border: none;
  color: var(--fg-soft);
  padding: 6px 16px;
  border-radius: 6px;
  font-weight: 600;
  transition: all 0.2s ease;
}

/* 🟢 호버 및 활성(Active) 상태에 명확한 채우기 색상 부여 */
.view-toggle button:hover, .right-panel-tabs button:hover {
  background: color-mix(in srgb, var(--bg-soft) 20%, transparent);
  color: var(--fg);
}

.view-toggle button.active, .right-panel-tabs button.active {
  background: var(--accent); /* 포인트 컬러로 꽉 채움 */
  color: #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
```

### 요약
보내주신 스크린샷은 **"기능은 구동하되, 정리가 부족해 시각적으로 매우 복잡하거나 반대로 너무 텅 비어있는 문제"**를 전형적으로 보여줍니다. 노드 정보의 다이어트(말줄임표 및 해시태그화), 겹치는 Z축 레이아웃 정리, 그리고 버튼 탭의 뚜렷한 대비감 형성만으로도 상용 프로덕트 수준의 극적인 UI 향상을 이끌어낼 수 있습니다.
