# VS Code Extension MVP 스펙: “Agent Studio” (n8n 스타일 캔버스로 Rule/Skill 시각화·관리)

아래 내용을 **그대로 Codex(코딩 에이전트)** 에 붙여넣어 개발 지시서로 쓰면 됩니다.
목표는 “OpenClaw / Codex / Claude / Copilot 등 다양한 에이전트 런타임의 Rule·Skill을 한 곳에서 **발견(Discover) → 시각화(Visualize) → 편집(Edit) → 공유(Share)**” 하는 VS Code 확장(MVP)입니다.

---

## 0) MVP 목표 (한 문장)

**워크스페이스/홈 디렉터리에서 Agent Skills + AGENTS.md(규칙 체인) + (선택) Codex .rules 를 자동 탐지하여, n8n 같은 캔버스 UI에서 그래프로 보여주고, 클릭 한 번으로 열고/검증하고/패키징(공유)까지 가능하게 한다.**

---

## 1) MVP 범위(반드시 구현)

### 1.1 “발견(Discovery)”

1. **Agent Skills 탐지**

* 프로젝트 스킬: `.github/skills/`, `.claude/skills/`, `.agents/skills/`
* 개인 스킬: `~/.copilot/skills/`, `~/.claude/skills/`, `~/.agents/skills/`
* 추가 위치: VS Code 설정 `chat.agentSkillsLocations`도 읽어서 포함
  ([Visual Studio Code][1])

2. **Codex 규칙 문서(AGENTS.md) 체인 탐지**

* Global: `CODEX_HOME`(기본 `~/.codex`)에서 `AGENTS.override.md` 우선, 없으면 `AGENTS.md`
* Project: 프로젝트 루트(보통 git root)부터 현재 디렉터리까지 내려오면서 각 디렉터리마다 `AGENTS.override.md` > `AGENTS.md` > fallback(설정 값) 순으로 “1개만” 선택
* 병합 순서: 루트 → 현재로 내려오는 순서로 concat, 뒤에 나오는 파일이 앞을 “override”하는 효과
  ([OpenAI Developers][2])

3. **(옵션이지만 MVP에 넣으면 좋음) Codex .rules 탐지**

* `~/.codex/rules/*.rules` (팀 config 위치도 스캔한다고 하지만 MVP는 우선 사용자 레이어만)
* `codex execpolicy check`를 통해 룰 파일 테스트가 가능(설치된 경우)
  ([OpenAI Developers][3])

4. **(옵션/로드맵) OpenClaw 탐지**

* `~/.openclaw/openclaw.json`에서 agent 목록/워크스페이스 경로를 읽고
* 각 워크스페이스의 `AGENTS.md/SOUL.md/USER.md` + `skills/` (공유 스킬은 `~/.openclaw/skills`)을 표시
  ([OpenClaw][4])

---

## 2) 핵심 사용자 시나리오(User Stories)

### 2.1 시각화/탐색

* 사용자는 “Agent Studio”를 열면, 자동으로:

  * 발견된 **Skill 노드**(각 `SKILL.md`)가 캔버스에 나타나고
  * 발견된 **Rule 노드**(AGENTS 체인)가 “스택/체인” 형태로 나타난다.
* 노드를 클릭하면 오른쪽 패널에서 상세(메타데이터/유효성/버튼)가 보인다.
* 더블클릭하면 해당 파일을 VS Code 에디터로 연다.

### 2.2 편집/생성

* “New Skill”로 스킬 폴더 + `SKILL.md` 템플릿 생성
* `SKILL.md` frontmatter를 폼으로 편집(이름/설명/옵션 필드)
* “Validate”로 즉시 오류/경고 표시

### 2.3 공유(Share)

* 선택한 스킬들을 **Skill Pack(zip)** 으로 내보내기(export)
* zip을 가져와(import) 지정 위치(기본: `.github/skills/`)에 설치
* 설치 전 “미리보기 + 위험요소(스크립트 포함 여부 등) 경고” 표시

---

## 3) n8n UI 리서치 기반 메인 화면 지침 (필수)

> “n8n UI를 따라한다”는 것은 **레이아웃/상호작용/단축키/패널 구조를 유사하게** 구현한다는 뜻. (아이콘/브랜딩 에셋은 복제하지 말고, 구조만 참고)

### 3.1 레이아웃 구조 (n8n Editor UI 기준)

n8n 편집 화면은 크게:

* **왼쪽 패널(사이드바)**: 워크플로/템플릿/설정 등 네비게이션
  ([n8n Docs][5])
* **상단 바(Top bar)**: 이름/태그/Save/History 등 액션
  ([n8n Docs][5])
* **가운데 캔버스(Canvas)**: 회색 점선(도트) 그리드 + 줌/정렬/실행/+패널/스티키노트/AI 도움 버튼
  ([n8n Docs][5])
* **오른쪽 노드 패널(Nodes panel)**: + 또는 Tab으로 열고, 검색 + 카테고리 + 드래그앤드롭으로 노드를 추가
  ([n8n Docs][5])

**Agent Studio 적용 지침**

* **Left sidebar**: Providers / Agents / Skills / Packs / Settings 섹션(접기/펼치기)
* **Top bar**: “현재 선택 Agent(프로필) 이름”, “Refresh”, “Export Pack”, “Import Pack”, “Save(편집내용 반영)”, “History(선택: 로드맵)”
* **Canvas**: 회색 도트 그리드, 우측 상단에 `+` 버튼(노드 라이브러리), 줌/정렬/리셋 버튼, “Validate(=Execute 역할)” 버튼을 둔다.
* **Right panel**은 2가지 모드:

  * “Node Library(노드 추가)”(n8n의 nodes panel 역할)
  * “Inspector(선택 노드 상세/편집)” (n8n은 노드 디테일을 열어 설정)

### 3.2 캔버스 버튼/요소 (n8n 참고)

n8n 캔버스에는:

* Zoom to fit / Zoom in/out / Reset zoom / Tidy up 노드 정렬 버튼이 있고
* 첫 노드 추가 전에는 “Add first step” 점선 박스가 있으며
* `+` 버튼은 nodes panel을 열고, hover 시 sticky note 아이콘도 나타남
  ([n8n Docs][5])

**Agent Studio 적용 지침**

* 좌하단(또는 우하단) floating controls:

  * Fit(1) / Zoom +/- / Reset(0) / Tidy(자동 레이아웃)
* 캔버스 중앙에는 초기 상태에서 “Add first agent / Add first skill” 점선 박스(placeholder)
* 우측 상단 `+` 버튼: Node Library 열기
* sticky note 기능: “Note 노드”를 캔버스에 추가(Shift+S 단축키도 지원)

### 3.3 노드 상호작용 (n8n 참고)

n8n은 노드 hover 시 상단에:

* 실행(Play), 활성/비활성(Power), 삭제(Trash) 아이콘
* 추가 옵션(ellipsis) 컨텍스트 메뉴
  ([n8n Docs][5])

**Agent Studio 적용 지침**

* Skill 노드 hover 버튼:

  * Open(파일 열기)
  * Enable/Disable(토글: 확장 내부 상태 or 특정 런타임 설정 반영)
  * Delete(실제 삭제는 확인 필요 / MVP는 “Remove from view”만 가능)
  * More(컨텍스트 메뉴: Export skill, Reveal in Explorer 등)
* Rule 노드 hover 버튼:

  * Open(AGENTS.md 열기)
  * Create override(해당 디렉터리에 `AGENTS.override.md` 생성)
  * More(컨텍스트 메뉴)

### 3.4 단축키/조작감 (n8n 참고)

n8n 단축키 핵심:

* 캔버스 이동: Ctrl+드래그 / Space+드래그 / Middle mouse drag
* 줌: `+`, `-`, `0` reset, `1` fit, Ctrl+휠
* Tab: Node panel 열기
* Ctrl/Cmd+K: Command bar(검색/명령)
  ([n8n Docs][6])

**Agent Studio 적용 지침**

* 위 단축키를 최대한 동일하게 구현.
* 단, VS Code Webview에서 충돌 가능 키(예: Ctrl+K)는:

  * 가능하면 webview focus일 때만 가로채고
  * 실패 시 UI에 “Command bar(🔍)” 버튼을 제공(마우스로도 접근).

---

## 4) Skill 표준/검증(Validation) 규칙 (MVP 필수)

### 4.1 SKILL.md 필수 구조

* 스킬은 최소 `skill-name/` 폴더 + `SKILL.md` 파일
* `SKILL.md`는 YAML frontmatter + Markdown body
  ([Agent Skills][7])

### 4.2 Frontmatter 필수 필드 + 제약

* `name`:

  * 1–64 chars
  * lowercase + 숫자 + 하이픈만
  * 하이픈으로 시작/끝 금지, `--` 연속 금지
  * **폴더명과 일치해야 함**
* `description`:

  * 1–1024 chars
  * “무엇을 + 언제 쓰는지”를 키워드 포함해 구체적으로
    ([Agent Skills][7])

### 4.3 파일 참조 규칙(경고 수준)

* 스킬 내 다른 파일 참조는 “스킬 루트 기준 상대경로”
* 너무 깊은 참조 체인은 피하라고 권장(“one level deep” 권장)
  ([Agent Skills][7])

### 4.4 VS Code/Copilot 확장 필드도 보존

VS Code는 추가 frontmatter를 지원(예: slash command 노출/자동 호출 제어 등). MVP는 **이 필드들을 삭제하지 않고 보존**하고, 폼에서 편집 가능하면 좋다.
([Visual Studio Code][1])

---

## 5) 공유(Share) 설계 — Skill Pack (MVP 필수)

### 5.1 MVP 공유 UX

* Export: 스킬 여러 개 선택 → zip 생성 → 저장 위치 선택
* Import: zip 선택 → 스킬 목록/메타 미리보기 → 설치 위치 선택(기본 `.github/skills/`) → 설치
* 보안: Import 시

  * `scripts/` 디렉터리가 있으면 “실행 가능 코드 포함” 경고
  * `allowed-tools`가 있으면 표시(있다면)
    (MVP는 실행하지 않고 “표시+경고”만)

VS Code 문서도 “공유 스킬은 복사해서 `.github/skills/`에 넣어 사용”하는 방식을 안내하며, 공유 스킬은 검토를 권장한다.
([Visual Studio Code][1])

### 5.2 Skill Pack 포맷(제안, MVP에서 그대로 사용)

zip 루트에 `skillpack.json` 포함:

```json
{
  "format": "agent-skill-pack/v1",
  "name": "my-pack",
  "version": "0.1.0",
  "createdAt": "2026-02-18T00:00:00Z",
  "skills": [
    {
      "name": "webapp-testing",
      "relativePath": "webapp-testing/",
      "description": "…",
      "source": { "type": "exported-from-vscode", "workspace": "…" }
    }
  ]
}
```

* zip에는 각 스킬 폴더를 그대로 포함(폴더명 = skill `name`)
* Import 시 충돌 정책:

  * 기본: `-1`, `-2` suffix 붙여 설치(덮어쓰기 방지)
  * 옵션: overwrite(확인 필요)

---

## 6) 데이터 모델 (그래프/노드)

### 6.1 엔티티

* `AgentProfile`

  * id, name, providerId, workspaceRoot, homeDir, metadata
* `Skill`

  * id, name, description, path, scope(project/personal/shared), providerId
  * validation: errors[], warnings[]
  * extraFrontmatter: key-value(raw)
* `RuleDoc`

  * id, type(`codex-agents`, `openclaw-agents`, `openclaw-soul`, …), path, scope(global/project/agent-workspace)
  * orderIndex (체인 순서)
* `ExecRuleFile` (optional)

  * id, path, providerId

### 6.2 그래프 노드 타입(React Flow nodeTypes)

* `agent` (선택 프로필)
* `skill`
* `ruleDoc`
* `note`
* `folder`(선택: 루트/스킬 위치 표시)

### 6.3 엣지 타입

* `contains` (agent → skill / agent → ruleDoc)
* `overrides` (ruleDoc A → ruleDoc B)  // 체인 순서 표현
* `locatedIn` (skill → folder)

---

## 7) Provider 아키텍처 (확장 가능 구조)

MVP에서 **Provider 인터페이스**를 만들고, 최소 1개 이상 구현.

```ts
interface Provider {
  id: string;
  displayName: string;
  detect(ctx): Promise<boolean>;       // 환경/파일 존재로 provider 활성 여부
  listAgents(ctx): Promise<AgentProfile[]>;
  listSkills(ctx, agentId): Promise<Skill[]>;
  listRuleDocs(ctx, agentId): Promise<RuleDoc[]>;
  // (optional) listExecRules(ctx, agentId): Promise<ExecRuleFile[]>;
}
```

### 7.1 MVP 필수 Provider

1. `AgentSkillsProvider`

* VS Code 규칙대로 스킬 위치 탐지 + SKILL.md 파싱/검증 + 그래프에 표시
  ([Visual Studio Code][1])

2. `CodexGuidanceProvider`

* Codex AGENTS 체인 탐지/표시(최소 읽기/열기)
  ([OpenAI Developers][2])

### 7.2 MVP 옵션 Provider

* `CodexRulesProvider` (읽기/열기 + 설치된 경우 execpolicy check 버튼)
  ([OpenAI Developers][3])
* `OpenClawProvider` (config 읽고 워크스페이스/규칙/스킬 경로만 표시)
  ([OpenClaw][4])

---

## 8) 기술 스택(권장)

### 8.1 Extension (backend)

* TypeScript, VS Code Extension API
* 파일 스캔/읽기/쓰기: Node `fs/promises` (+ `vscode.workspace.fs`는 추후)
* Git root 찾기: `.git` 상위 탐색 또는 `git rev-parse --show-toplevel` (가능하면)

### 8.2 Webview (frontend)

* React + TypeScript
* 그래프/캔버스: `reactflow`
* 자동 레이아웃(Tidy): `dagre` 또는 `@dagrejs/dagre`
* YAML frontmatter 파싱: `gray-matter`
* 검증 스키마: `zod`
* UI 컨트롤: VS Code Webview UI Toolkit(선택) + 커스텀 CSS(도트 그리드)

---

## 9) 리포 구조(권장)

```
agent-studio/
  extension/                # VS Code extension host (ts)
    src/
      extension.ts
      providers/
        agentSkillsProvider.ts
        codexGuidanceProvider.ts
        openclawProvider.ts (optional)
      services/
        discovery.ts
        skillParser.ts
        skillValidator.ts
        zipPack.ts
      messages/
        protocol.ts
  webview-ui/               # React app (vite)
    src/
      App.tsx
      canvas/
        GraphView.tsx
        nodes/
          SkillNode.tsx
          RuleDocNode.tsx
          AgentNode.tsx
          NoteNode.tsx
      panels/
        LeftSidebar.tsx
        RightPanel.tsx      # Inspector / Node Library 탭
        CommandBar.tsx
      state/
        store.ts
      messaging/
        vscodeBridge.ts
  package.json              # contributes: commands, views, icon
  README.md
```

---

## 10) 메시지 프로토콜(Extension ↔ Webview)

### 10.1 Webview → Extension

* `READY`
* `REFRESH`
* `OPEN_FILE { uri }`
* `CREATE_SKILL { baseDirUri, name, description }`
* `EXPORT_PACK { skillIds, outputUri }`
* `IMPORT_PACK { zipUri, installDirUri }`
* `RUN_VALIDATION { skillId }`

### 10.2 Extension → Webview

* `INIT_STATE { state }`
* `STATE_PATCH { patch }`
* `TOAST { level, message }`
* `ERROR { message, detail? }`

---

## 11) 구현 단계(체크리스트) — Codex에게 “순서대로” 지시

### Phase A — 스캐폴딩/빌드

* [ ] VS Code extension 스캐폴딩 생성(TypeScript)
* [ ] webview-ui(Vite React TS) 생성
* [ ] extension에서 webview 번들 로드 (dev: localhost, prod: dist 번들)
* [ ] `Agent Studio: Open` command로 WebviewPanel 열기

### Phase B — Discovery/Provider

* [ ] AgentSkillsProvider 구현:

  * [ ] skill locations 수집(프로젝트/개인/설정 `chat.agentSkillsLocations`) ([Visual Studio Code][1])
  * [ ] 각 스킬 폴더에서 `SKILL.md` 읽고 gray-matter로 frontmatter 파싱
  * [ ] Agent Skills spec 기반 검증(name/description/폴더명 일치 등) ([Agent Skills][7])
* [ ] CodexGuidanceProvider 구현:

  * [ ] `CODEX_HOME || ~/.codex` global 파일 탐지(`AGENTS.override.md` 우선) ([OpenAI Developers][2])
  * [ ] 프로젝트 루트부터 현재 경로까지 AGENTS 체인 탐지(override 우선) ([OpenAI Developers][2])

### Phase C — n8n 스타일 캔버스 UI

* [ ] 회색 도트 그리드 배경 + React Flow 캔버스
* [ ] floating controls: Fit/Zoom+/Zoom-/Reset/Tidy ([n8n Docs][5])
* [ ] “Add first …” 점선 placeholder 구현(빈 상태) ([n8n Docs][5])
* [ ] Right Node Library 패널:

  * [ ] `+` 버튼과 `Tab`으로 열기 ([n8n Docs][5])
  * [ ] 검색창 포함 ([n8n Docs][5])
* [ ] Node hover 액션(아이콘 3개 + … 메뉴) ([n8n Docs][5])

### Phase D — Inspector(오른쪽 상세 패널)

* [ ] Skill 선택 시:

  * [ ] name/description 표시
  * [ ] validation errors/warnings 표시
  * [ ] 버튼: Open SKILL.md / Reveal folder / Export(단일) / Validate
* [ ] RuleDoc 선택 시:

  * [ ] 파일 경로 + 체인 순서 표시
  * [ ] 버튼: Open / Create override(가능한 경우)

### Phase E — 단축키(조작감)

* [ ] 캔버스 이동: Ctrl+drag / Space+drag / Middle drag ([n8n Docs][6])
* [ ] 줌: +, -, 0 reset, 1 fit, Ctrl+Wheel ([n8n Docs][6])
* [ ] Tab: Node Library 열기 ([n8n Docs][6])
* [ ] Shift+S: Sticky note 추가(노드) ([n8n Docs][6])
* [ ] (가능하면) Ctrl/Cmd+K: Command bar ([n8n Docs][6])

### Phase F — Skill Pack 공유

* [ ] Export zip:

  * [ ] 선택 skills → zip 생성 + `skillpack.json` 포함
* [ ] Import zip:

  * [ ] 목록 미리보기 + 설치 위치 선택 + 충돌 처리
  * [ ] scripts/ 있으면 경고 표시(실행은 안 함)

---

## 12) MVP 완료(수용 기준 / Acceptance Criteria)

1. VS Code에서 명령 실행 → Agent Studio Webview가 열린다.
2. `.github/skills`에 2개 스킬이 있으면 캔버스에 **Skill 노드 2개**가 나타난다.
3. `SKILL.md` name이 폴더명과 다르면 **Validation Error**가 표시된다. ([Agent Skills][7])
4. Tab 또는 `+` 버튼으로 Node Library가 열린다. ([n8n Docs][5])
5. Ctrl+휠로 확대/축소, 0으로 리셋, 1로 fit이 된다. ([n8n Docs][6])
6. Codex 환경(`~/.codex/AGENTS.md` 또는 override) 존재 시, Rule 체인이 감지되어 RuleDoc 노드로 표시된다. ([OpenAI Developers][2])
7. Export Pack으로 zip을 만들고, Import Pack으로 다른 위치에 설치가 된다.

---

## 13) 다음 버전(로드맵 아이디어)

* “Skill Registry”: GitHub repo/ClawHub 같은 외부 레지스트리 검색/설치
* Skill 신뢰(Trust) 모델:

  * 서명/해시, 퍼블리셔 정보, 위험 스코어(스크립트/권한/allowed-tools 등)
* OpenClaw 완전 지원(agents/workspaces, SOUL.md/USER.md 편집, per-agent skills)
* “Prompt Preview”: 선택된 Rule+Skill 조합이 실제로 어떤 “최종 프롬프트 컨텍스트”가 되는지 합성 미리보기

---

원하면, 위 스펙을 기반으로 **“실제 화면 와이어프레임(ASCII) + 노드 타입 디자인(컴포넌트별 props) + 메시지 프로토콜 타입 정의(protocol.ts) 초안”**까지 바로 써줄게요.

[1]: https://code.visualstudio.com/docs/copilot/customization/agent-skills "Use Agent Skills in VS Code"
[2]: https://developers.openai.com/codex/guides/agents-md/ "Custom instructions with AGENTS.md"
[3]: https://developers.openai.com/codex/rules/ "Rules"
[4]: https://docs.openclaw.ai/concepts/multi-agent "Multi-Agent Routing - OpenClaw"
[5]: https://docs.n8n.io/courses/level-one/chapter-1/ "Navigating the editor UI | n8n Docs  "
[6]: https://docs.n8n.io/keyboard-shortcuts/ "Keyboard shortcuts | n8n Docs  "
[7]: https://agentskills.io/specification "Specification - Agent Skills"
