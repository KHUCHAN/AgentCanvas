# Open Claw Workflow — 프롬프트 생성, 스케줄 실행, MVP 스펙

**Date**: 2026-02-19

**Open Claw는 VS Code 안에서 "멀티 런타임(Claude/Gemini/Codex/OpenClaw) 멀티에이전트"를 설계하고, 실행/디버깅/재현까지 하는 Agent IDE입니다.**

---

## 1. MVP 스펙 (Acceptance Criteria)

### 1.1 발견(Discovery) — 자동 탐지

1. **Agent Skills 탐지**
   - 프로젝트 스킬: `.github/skills/`, `.claude/skills/`, `.agents/skills/`
   - 개인 스킬: `~/.copilot/skills/`, `~/.claude/skills/`, `~/.agents/skills/`
   - 추가 위치: VS Code 설정 `chat.agentSkillsLocations`도 읽어서 포함

2. **Codex 규칙 문서(AGENTS.md) 체인 탐지**
   - Global: `CODEX_HOME`(기본 `~/.codex`)에서 `AGENTS.override.md` 우선, 없으면 `AGENTS.md`
   - Project: 프로젝트 루트부터 현재 경로까지 내려오면서 각 디렉터리마다 `AGENTS.override.md` > `AGENTS.md` 순으로 선택
   - 병합 순서: 루트 → 현재로 내려오는 순서로 concat, 뒤에 나오는 파일이 앞을 "override"

3. **Codex .rules 탐지** (옵션이지만 MVP에 포함 권장)
   - `~/.codex/rules/*.rules` 탐지
   - `codex execpolicy check`를 통해 룰 파일 테스트 가능(설치된 경우)

4. **OpenClaw 탐지** (옵션/로드맵)
   - `~/.openclaw/openclaw.json`에서 agent 목록/워크스페이스 경로 읽기
   - 각 워크스페이스의 `AGENTS.md/SOUL.md/USER.md` + `skills/` 표시

### 1.2 시각화/탐색(Visualization)

- 발견된 **Skill 노드**(각 `SKILL.md`)가 캔버스에 자동 배치
- 발견된 **Rule 노드**(AGENTS 체인)가 "스택/체인" 형태로 표시
- 노드 클릭 시 오른쪽 패널에서 상세(메타데이터/유효성/버튼) 표시
- 더블클릭하면 해당 파일을 VS Code 에디터로 오픈

### 1.3 편집/생성(Edit & Create)

- "New Skill"로 스킬 폴더 + `SKILL.md` 템플릿 생성
- `SKILL.md` frontmatter를 폼으로 편집(이름/설명/옵션 필드)
- "Validate"로 즉시 오류/경고 표시

### 1.4 공유(Share)

- 선택한 스킬들을 **Skill Pack(zip)** 으로 내보내기(export)
- zip을 가져와(import) 지정 위치(기본: `.github/skills/`)에 설치
- 설치 전 "미리보기 + 위험요소(스크립트 포함 여부 등) 경고" 표시

### 1.5 MVP 완료 기준

1. VS Code에서 명령 실행 → Agent Studio Webview가 열린다.
2. `.github/skills`에 2개 스킬이 있으면 캔버스에 **Skill 노드 2개**가 나타난다.
3. `SKILL.md` name이 폴더명과 다르면 **Validation Error**가 표시된다.
4. Tab 또는 `+` 버튼으로 Node Library가 열린다.
5. Ctrl+휠로 확대/축소, 0으로 리셋, 1로 fit이 된다.
6. Codex 환경(`~/.codex/AGENTS.md` 또는 override) 존재 시, Rule 체인이 감지되어 RuleDoc 노드로 표시된다.
7. Export Pack으로 zip을 만들고, Import Pack으로 다른 위치에 설치가 된다.

---

### 1.6 Skill과 Task의 실행 흐름 (2026-02-20 추가)

> 용어 정의는 FRAMEWORK.md §0 "핵심 용어 정의" 참조

Open Claw에서 사용자의 작업 요청이 실행되는 전체 흐름:

```
[STEP 1] 설계 단계 (정적)
──────────────────────────────────────
  Build Team Prompt → Agent[] 생성
  각 Agent에 Skill[] 할당 (assignedSkillIds)
  각 Agent에 MCP Server[] 연결 (assignedMcpServerIds)

[STEP 2] 작업 지시 단계
──────────────────────────────────────
  사용자 → Task 탭에서 Work Prompt 작성
  "이 PR을 리뷰하고 테스트도 작성해줘"
  [▶ Submit Work] 클릭

[STEP 3] 분해 단계 (Orchestrator)
──────────────────────────────────────
  Orchestrator가 Work Prompt를 분석
  → Task[] 자동 생성 (각 Task에 agentId, deps, priority 할당)

  예: Task-1: "PR 코드 리뷰" → Reviewer Agent
      Task-2: "단위 테스트 작성" → Tester Agent (deps: [Task-1])
      Task-3: "결과 종합 보고" → Orchestrator (deps: [Task-1, Task-2])

[STEP 4] 실행 단계 (Worker)
──────────────────────────────────────
  각 Worker Agent가 할당된 Task를 실행
  실행 시 자신이 보유한 Skill을 자동 활용:
    - Skill의 description이 Task 내용과 매칭되면
    - SKILL.md 본문(지침)을 로드하여 따름
    - 필요 시 scripts/ 실행, references/ 참조

  예: Reviewer Agent가 "PR 코드 리뷰" Task 실행 시
      → 보유 Skill "code-review"의 SKILL.md 지침을 따름
      → GitHub MCP로 PR diff 조회
      → 리뷰 결과 생성

[STEP 5] 추적 단계 (UI)
──────────────────────────────────────
  칸반 보드: Task 카드가 To Do → In Progress → Done 이동
  캔버스: Agent 노드에 실시간 상태 표시 (working/done/error)
  Schedule: 간트 차트 타임라인에 Task 진행 표시
```

**핵심 구분:**
- **Skill은 실행되지 않는다** — Skill은 Agent가 Task를 수행할 때 **참조하는 지침**
- **Task가 실행된다** — Task는 구체적 작업 지시이며, Agent가 Skill을 활용하여 수행
- **사용자는 Work Prompt를 제출한다** — "Run Task"가 아니라 **"Submit Work"**

---

## 2. Prompt-to-Agents System (자동 에이전트 구조 생성)

사용자가 자연어 Prompt를 입력하면 연결된 AI CLI(Claude Code, Gemini CLI, Codex)를 통해 Agent 팀 구조를 자동으로 생성합니다.

### 2.1 핵심 아이디어

```
┌─────────────────────────────────────────────────────────────┐
│  Prompt 입력                                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ "코드 품질 관리 팀을 만들어줘. 리뷰어 1명, 테스터 1명,  │ │
│  │  그리고 전체를 관리하는 리드 1명이 필요해.               │ │
│  │  GitHub MCP를 리뷰어에게, Jest MCP를 테스터에게 연결해." │ │
│  └─────────────────────────────────────────────────────────┘ │
│  [Claude Code ▼]  [Generate]                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    AI CLI 호출
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  생성된 Agent 구조 (JSON)                                    │
│                                                              │
│  Orchestrator: "QA Lead" ─delegates─→ "Reviewer"            │
│                           ─delegates─→ "Tester"              │
│  Reviewer: skills=[code-review], mcp=[GitHub]                │
│  Tester:   skills=[test-runner], mcp=[Jest]                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                     Preview & Apply
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Canvas에 Agent 노드들이 자동 배치                           │
│  .agentcanvas/agents/ 에 JSON 프로필 저장                    │
│  엣지(delegates) 자동 연결                                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 지원 AI CLI 백엔드

| CLI | 실행 명령어 | 특징 |
|-----|------------|------|
| Claude Code | `claude --print` 또는 `claude -p` | Anthropic Claude 기반, 대화형/비대화형 모드 |
| Gemini CLI | `gemini` | Google Gemini 기반 |
| Codex CLI (OpenAI) | `codex` | OpenAI Codex 기반 |
| Aider | `aider --message` | 코드 편집 특화 |
| 커스텀 | 사용자 정의 CLI | 설정에서 경로/인자 지정 |

### 2.3 CLI 감지 방식

```typescript
// services/cliDetector.ts
export interface CliBackend {
  id: string;                        // "claude-code" | "gemini-cli" | "codex" | "aider" | "custom"
  displayName: string;               // "Claude Code"
  command: string;                   // "claude"
  args: string[];                    // ["--print"]
  available: boolean;                // which 또는 where 명령으로 확인
  version?: string;                  // --version 출력 파싱
}

async function detectCli(command: string): Promise<boolean> {
  // child_process.exec로 `which claude` 또는 `where claude` 실행
  // exitCode === 0이면 available
}

export async function detectAllCliBackends(): Promise<CliBackend[]> {
  return [
    {
      id: "claude-code",
      displayName: "Claude Code",
      command: "claude",
      args: ["--print"],
      available: await detectCli("claude")
    },
    {
      id: "gemini-cli",
      displayName: "Gemini CLI",
      command: "gemini",
      args: [],
      available: await detectCli("gemini")
    },
    {
      id: "codex-cli",
      displayName: "Codex CLI",
      command: "codex",
      args: [],
      available: await detectCli("codex")
    },
    {
      id: "aider",
      displayName: "Aider",
      command: "aider",
      args: ["--message"],
      available: await detectCli("aider")
    }
  ];
}
```

### 2.4 VS Code 설정 통합

```jsonc
// package.json → contributes.configuration
{
  "agentCanvas.promptBackend": {
    "type": "string",
    "default": "auto",
    "enum": ["auto", "claude-code", "gemini-cli", "codex-cli", "aider", "custom"],
    "description": "Agent 구조 생성에 사용할 AI CLI"
  },
  "agentCanvas.customCliCommand": {
    "type": "string",
    "default": "",
    "description": "커스텀 CLI 명령어 (예: /usr/local/bin/my-ai --json)"
  },
  "agentCanvas.customCliArgs": {
    "type": "array",
    "default": [],
    "description": "커스텀 CLI 추가 인자"
  },
  "agentCanvas.cliBackendOverrides": {
    "type": "object",
    "default": {},
    "description": "CLI 백엔드별 설정 override (command/args/env)"
  }
}
```

### 2.5 Prompt → Agent 생성 파이프라인

#### 전체 흐름

```
Step 1: 사용자가 Prompt 입력
Step 2: 현재 워크스페이스 컨텍스트 수집 (기존 Agent, Skill, MCP 목록)
Step 3: System Prompt + User Prompt + Context를 조합한 최종 프롬프트 구성
Step 4: 선택된 CLI 백엔드로 실행
Step 5: CLI 출력(JSON)을 파싱
Step 6: Preview UI에서 사용자에게 확인
Step 7: 확인되면 .agentcanvas/agents/ 에 저장 + Canvas 반영
```

#### System Prompt (CLI에 전달할 지시문)

```typescript
// services/promptBuilder.ts
export function buildAgentGenerationPrompt(input: {
  userPrompt: string;
  existingAgents: AgentProfile[];
  existingSkills: Skill[];
  existingMcpServers: McpServer[];
}): string {
  return `
You are an agent architecture designer. Based on the user's request, generate a multi-agent team structure as a JSON object.

## Current workspace context

### Existing agents
${JSON.stringify(input.existingAgents.map(a => ({
  id: a.id, name: a.name, role: a.role, isOrchestrator: a.isOrchestrator
})), null, 2)}

### Available skills
${JSON.stringify(input.existingSkills.map(s => ({
  id: s.id, name: s.name, description: s.description
})), null, 2)}

### Available MCP servers
${JSON.stringify(input.existingMcpServers.map(m => ({
  id: m.id, name: m.name, kind: m.kind
})), null, 2)}

## Instructions
1. Create agents with clear roles based on the user's description
2. Exactly one agent should be the orchestrator (isOrchestrator: true)
3. Assign existing skills/MCP servers to agents where appropriate
4. If the user mentions skills/MCPs that don't exist yet, include them in "suggestedNewSkills" / "suggestedNewMcpServers"
5. Define delegation relationships (which agent delegates to which)

## Output format
Respond with ONLY a JSON object (no markdown, no explanation):
{
  "teamName": "string",
  "teamDescription": "string",
  "agents": [
    {
      "name": "string",
      "role": "orchestrator|coder|researcher|reviewer|planner|tester|writer|custom",
      "roleLabel": "string (한글 or English label)",
      "description": "string",
      "systemPrompt": "string",
      "isOrchestrator": boolean,
      "delegatesTo": ["agent-name-1", "agent-name-2"],
      "assignedSkillIds": ["existing-skill-id"],
      "assignedMcpServerIds": ["existing-mcp-id"],
      "color": "#hex",
      "avatar": "emoji"
    }
  ],
  "suggestedNewSkills": [
    { "name": "string", "description": "string", "forAgent": "agent-name" }
  ],
  "suggestedNewMcpServers": [
    { "name": "string", "kind": "stdio|http", "forAgent": "agent-name" }
  ]
}

## User request
${input.userPrompt}
`.trim();
}
```

#### CLI 실행 서비스

```typescript
// services/cliExecutor.ts
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface CliExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export async function executeCliPrompt(input: {
  backend: CliBackend;
  prompt: string;
  workspacePath: string;
  timeoutMs?: number;
}): Promise<CliExecutionResult> {
  const start = Date.now();
  const timeout = input.timeoutMs ?? 120_000;  // 기본 2분 타임아웃

  const command = buildCliCommand(input.backend, input.prompt);

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: input.workspacePath,
      timeout,
      maxBuffer: 1024 * 1024,  // 1MB
      env: { ...process.env, NO_COLOR: "1" }
    });

    return {
      success: true,
      output: stdout.trim(),
      error: stderr.trim() || undefined,
      durationMs: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start
    };
  }
}

function buildCliCommand(backend: CliBackend, prompt: string): string {
  // 프롬프트를 안전하게 이스케이프하여 CLI에 전달
  const escaped = prompt.replace(/'/g, "'\\''");

  switch (backend.id) {
    case "claude-code":
      // claude --print 'prompt here'
      return `${backend.command} --print '${escaped}'`;
    case "gemini-cli":
      // echo 'prompt' | gemini
      return `echo '${escaped}' | ${backend.command}`;
    case "codex-cli":
      // codex 'prompt'
      return `${backend.command} '${escaped}'`;
    case "aider":
      // aider --message 'prompt' --yes
      return `${backend.command} --message '${escaped}' --yes`;
    default:
      // 커스텀: command args... 'prompt'
      return `${backend.command} ${backend.args.join(" ")} '${escaped}'`;
  }
}
```

#### 응답 파싱

```typescript
// services/agentStructureParser.ts
export interface GeneratedAgentStructure {
  teamName: string;
  teamDescription: string;
  agents: GeneratedAgent[];
  suggestedNewSkills: SuggestedSkill[];
  suggestedNewMcpServers: SuggestedMcp[];
}

export interface GeneratedAgent {
  name: string;
  role: AgentRole;
  roleLabel?: string;
  description?: string;
  systemPrompt?: string;
  isOrchestrator: boolean;
  delegatesTo: string[];
  assignedSkillIds: string[];
  assignedMcpServerIds: string[];
  color?: string;
  avatar?: string;
}

export interface SuggestedSkill {
  name: string;
  description: string;
  forAgent: string;
}

export interface SuggestedMcp {
  name: string;
  kind: "stdio" | "http";
  forAgent: string;
}

export function parseAgentStructure(rawOutput: string): GeneratedAgentStructure {
  // CLI 출력에서 JSON 블록 추출
  // 1. 순수 JSON이면 바로 파싱
  // 2. ```json ... ``` 블록이 있으면 추출
  // 3. { 로 시작하는 첫 줄 ~ 마지막 } 사이 추출

  const jsonMatch =
    rawOutput.match(/```json\s*([\s\S]*?)```/) ??
    rawOutput.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) {
    throw new Error("CLI 출력에서 JSON을 찾을 수 없습니다");
  }

  const parsed = JSON.parse(jsonMatch[1]) as GeneratedAgentStructure;

  // 유효성 검증
  if (!parsed.agents || !Array.isArray(parsed.agents) || parsed.agents.length === 0) {
    throw new Error("생성된 구조에 agents가 없습니다");
  }

  const orchestrators = parsed.agents.filter(a => a.isOrchestrator);
  if (orchestrators.length === 0) {
    // 첫 번째를 orchestrator로 설정
    parsed.agents[0].isOrchestrator = true;
    parsed.agents[0].role = "orchestrator";
  }

  return parsed;
}
```

### 2.6 UI 컴포넌트

#### PromptPanel — 프롬프트 입력 영역

**위치**: 오른쪽 패널에 세 번째 탭으로 추가, 또는 독립 모달

**파일**: `webview-ui/src/panels/PromptPanel.tsx`

```
┌─────────────────────────────────────────┐
│  Right Panel                            │
│  [Library] [Inspector] [AI Prompt]      │  ← 3번째 탭 추가
├─────────────────────────────────────────┤
│                                         │
│  Backend: [Claude Code ▼]              │  ← CLI 선택 드롭다운
│  Status: ● Available                   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ 코드 품질 관리 팀을 만들어줘.       ││  ← 프롬프트 입력
│  │ 리뷰어 1명, 테스터 1명, 그리고     ││
│  │ 전체를 관리하는 리드 1명이 필요해.  ││
│  │ GitHub MCP를 리뷰어에게,           ││
│  │ Jest MCP를 테스터에게 연결해.      ││
│  └─────────────────────────────────────┘│
│                                         │
│  Context: [☑ Include existing agents]  │
│           [☑ Include existing skills]  │
│           [☑ Include existing MCPs]    │
│                                         │
│  [Generate Agent Team]                 │  ← 실행 버튼
│                                         │
│  ── History ──                         │
│  ▸ "코드 품질 관리 팀" — 3 agents      │  ← 이전 프롬프트 이력
│  ▸ "문서 작성 팀" — 2 agents           │
│                                         │
└─────────────────────────────────────────┘
```

#### AgentPreviewModal — 생성 결과 미리보기

**파일**: `webview-ui/src/panels/AgentPreviewModal.tsx`

CLI 응답을 파싱한 후 사용자에게 확인을 받는 모달입니다.

```
┌──────────────────────────────────────────────────────┐
│  🤖 Generated Agent Team: "코드 품질 관리 팀"        │
│  "코드 리뷰, 테스트, 품질 관리를 담당하는 팀"        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Agents (3)                                          │
│  ┌────────────────────────────────────────────────┐  │
│  │ 🎯 QA Lead (orchestrator)                      │  │
│  │ "전체 코드 품질 프로세스를 관리하고 조율"       │  │
│  │ delegates → Reviewer, Tester                   │  │
│  │ Skills: — · MCP: —                             │  │
│  │ [Edit] [Remove]                                │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │ 🔍 Reviewer (reviewer)                         │  │
│  │ "PR 코드 리뷰 및 품질 체크"                    │  │
│  │ Skills: code-review · MCP: GitHub              │  │
│  │ [Edit] [Remove]                                │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │ 🧪 Tester (tester)                             │  │
│  │ "단위/통합 테스트 작성 및 실행"                 │  │
│  │ Skills: test-runner · MCP: Jest                 │  │
│  │ [Edit] [Remove]                                │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ⚠️ Suggested new resources (not yet created)        │
│  • Skill "code-review" — for Reviewer               │
│  • Skill "test-runner" — for Tester                  │
│  • MCP "Jest" — for Tester                           │
│                                                      │
│  Options                                             │
│  [☑ Create suggested skills automatically]           │
│  [☐ Overwrite existing agents with same name]        │
│                                                      │
│  [Apply to Canvas]              [Cancel]             │
└──────────────────────────────────────────────────────┘
```

#### Prompt History

과거 프롬프트와 생성 결과를 저장하여 다시 활용할 수 있습니다.

**저장 위치**: `.agentcanvas/prompt-history.json`

```json
[
  {
    "id": "ph-1",
    "prompt": "코드 품질 관리 팀을 만들어줘...",
    "backend": "claude-code",
    "createdAt": "2026-02-18T10:30:00Z",
    "result": { "teamName": "코드 품질 관리 팀", "agents": [...] },
    "applied": true
  }
]
```

### 2.7 메시지 프로토콜

#### Webview → Extension (신규 메시지)

```typescript
// CLI 백엔드 목록 요청
| RequestMessage<"DETECT_CLI_BACKENDS">

// Prompt로 Agent 구조 생성 요청
| RequestMessage<"GENERATE_AGENT_STRUCTURE", {
    prompt: string;
    backendId: string;           // "claude-code" | "gemini-cli" | ...
    includeExistingAgents: boolean;
    includeExistingSkills: boolean;
    includeExistingMcpServers: boolean;
  }>

// 생성된 구조를 Canvas에 적용
| RequestMessage<"APPLY_GENERATED_STRUCTURE", {
    structure: GeneratedAgentStructure;
    createSuggestedSkills: boolean;
    overwriteExisting: boolean;
  }>

// 프롬프트 히스토리 조회
| RequestMessage<"GET_PROMPT_HISTORY">

// 프롬프트 히스토리 항목 삭제
| RequestMessage<"DELETE_PROMPT_HISTORY", { historyId: string }>

// 프롬프트 히스토리에서 재적용
| RequestMessage<"REAPPLY_PROMPT_HISTORY", { historyId: string }>
```

#### Extension → Webview (신규 메시지)

```typescript
// CLI 백엔드 목록 응답
| { type: "CLI_BACKENDS"; payload: { backends: CliBackend[] } }

// 생성 진행 상태 (스트리밍 용)
| { type: "GENERATION_PROGRESS"; payload: {
    stage: "building_prompt" | "calling_cli" | "parsing_output" | "done" | "error";
    message: string;
    progress?: number;  // 0~100
  }}
```

### 2.8 Extension 백엔드 구현

#### 신규 서비스 파일

| 파일 | 역할 |
|------|------|
| `services/cliDetector.ts` | CLI 존재 감지 (which/where 명령) |
| `services/cliExecutor.ts` | CLI 프로세스 실행 + 타임아웃 관리 |
| `services/promptBuilder.ts` | System Prompt 조합 + 컨텍스트 주입 |
| `services/agentStructureParser.ts` | CLI 출력 JSON 파싱 + 유효성 검증 |
| `services/promptHistory.ts` | 프롬프트 이력 저장/조회/삭제 |

#### handleMessage 추가

```typescript
case "DETECT_CLI_BACKENDS": {
  const backends = await detectAllCliBackends();
  this.postMessage({ type: "CLI_BACKENDS", payload: { backends } });
  return { backends };
}

case "GENERATE_AGENT_STRUCTURE": {
  const { prompt, backendId, includeExistingAgents, includeExistingSkills, includeExistingMcpServers } = message.payload;

  // 1. 백엔드 찾기
  const backends = await detectAllCliBackends();
  const backend = backends.find(b => b.id === backendId);
  if (!backend?.available) {
    throw new Error(`CLI "${backendId}" is not available`);
  }

  // 2. 컨텍스트 수집
  const snapshot = this.snapshot;
  const fullPrompt = buildAgentGenerationPrompt({
    userPrompt: prompt,
    existingAgents: includeExistingAgents ? (snapshot?.agents ?? []) : [],
    existingSkills: includeExistingSkills ? (snapshot?.skills ?? []) : [],
    existingMcpServers: includeExistingMcpServers ? (snapshot?.mcpServers ?? []) : []
  });

  // 3. 진행 상태 전송
  this.postMessage({ type: "GENERATION_PROGRESS", payload: { stage: "calling_cli", message: `Calling ${backend.displayName}...` } });

  // 4. CLI 실행
  const result = await executeCliPrompt({
    backend,
    prompt: fullPrompt,
    workspacePath: ctx.workspacePath,
    timeoutMs: 120_000
  });

  if (!result.success) {
    throw new Error(`CLI failed: ${result.error}`);
  }

  // 5. 파싱
  const structure = parseAgentStructure(result.output);

  // 6. 히스토리 저장
  await savePromptHistory(ctx.workspacePath, { prompt, backendId, structure });

  return { structure };
}

case "APPLY_GENERATED_STRUCTURE": {
  const { structure, createSuggestedSkills, overwriteExisting } = message.payload;
  await this.applyGeneratedStructure(structure, createSuggestedSkills, overwriteExisting);
  await this.refreshState();
  return { ok: true, agentsCreated: structure.agents.length };
}
```

#### 구조 적용 로직

```typescript
// extension.ts 내 메서드
private async applyGeneratedStructure(
  structure: GeneratedAgentStructure,
  createSuggestedSkills: boolean,
  overwriteExisting: boolean
): Promise<void> {
  const ctx = await this.buildProviderContext();
  const workspaceRoot = ctx.workspacePath;

  // 1. Agent 프로필 생성
  const createdAgents = new Map<string, AgentProfile>();
  for (const agent of structure.agents) {
    const profile = await createCustomAgentProfile({
      name: agent.name,
      role: agent.role,
      roleLabel: agent.roleLabel,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      isOrchestrator: agent.isOrchestrator,
      workspaceRoot,
      homeDir: ctx.homeDir
    });
    createdAgents.set(agent.name, profile);
  }

  // 2. Delegation 관계 설정
  for (const agent of structure.agents) {
    if (agent.delegatesTo.length === 0) continue;
    const profile = createdAgents.get(agent.name);
    if (!profile) continue;

    const workerIds = agent.delegatesTo
      .map(name => createdAgents.get(name)?.id)
      .filter((id): id is string => !!id);

    await setAgentDelegation({ workspaceRoot, agent: profile, workerIds });
  }

  // 3. Skill/MCP 할당
  for (const agent of structure.agents) {
    const profile = createdAgents.get(agent.name);
    if (!profile) continue;

    for (const skillId of agent.assignedSkillIds) {
      await assignSkillToAgent({ workspaceRoot, agent: profile, skillId });
    }
    for (const mcpId of agent.assignedMcpServerIds) {
      await assignMcpToAgent({ workspaceRoot, agent: profile, mcpServerId: mcpId });
    }
  }

  // 4. 제안된 신규 Skill 생성 (옵션)
  if (createSuggestedSkills && structure.suggestedNewSkills.length > 0) {
    for (const suggested of structure.suggestedNewSkills) {
      // createSkillFromTemplate 호출
      // 생성 후 해당 Agent에 자동 할당
    }
  }
}
```

### 2.9 보안 고려사항

#### 프롬프트 인젝션 방지

- CLI에 전달하는 프롬프트에서 셸 특수문자를 이스케이프한다.
- `child_process.execFile` 사용을 권장 (셸 해석 없이 직접 실행).
- 사용자 입력을 `--` 이후 인자로 전달하여 플래그 인젝션 방지.

#### 출력 검증

- CLI 출력이 예상 JSON 스키마와 일치하는지 검증한다.
- Agent 이름에 파일 시스템 위험 문자(../, /, \)가 없는지 확인한다.
- `systemPrompt` 필드에 잠재적 위험 내용이 있는지 경고한다 (길이 제한 포함).

#### 파일 시스템 접근

- `.agentcanvas/agents/` 디렉토리 외부에 파일을 생성하지 않는다.
- 기존 Agent 프로필을 덮어쓰기 전 사용자 확인을 받는다.
- 백업: 덮어쓰기 시 기존 파일을 `.agentcanvas/agents/.backup/`에 보관.

### 2.10 에러 처리

| 상황 | 처리 |
|------|------|
| CLI 미설치 | 드롭다운에 비활성 표시, 설치 안내 링크 제공 |
| CLI 인증 실패 | "API 키 설정을 확인하세요" 메시지 + CLI 공식 문서 링크 |
| 타임아웃 (120초) | "응답 시간 초과. 프롬프트를 간단하게 하거나 타임아웃을 늘려주세요" |
| JSON 파싱 실패 | CLI 원본 출력을 보여주고, "JSON 형식이 아닌 응답입니다" + 재시도 버튼 |
| Agent 이름 충돌 | Preview에서 경고 표시 + "Overwrite" 체크박스로 사용자 선택 |
| Skill/MCP 미존재 참조 | suggestedNewSkills로 분류, 자동 생성 옵션 제공 |
| 빈 응답 | "AI가 빈 결과를 반환했습니다. 프롬프트를 더 구체적으로 작성해주세요" |

### 2.11 구현 순서 (로드맵)

```
Phase 1 — CLI 감지 + 기본 UI (1~2일)
├── cliDetector.ts: CLI 존재 감지
├── PromptPanel.tsx: 프롬프트 입력 UI + 백엔드 선택
├── RightPanel에 "AI Prompt" 탭 추가
├── DETECT_CLI_BACKENDS 메시지 핸들러
└── VS Code 설정 (agentCanvas.promptBackend 등)

Phase 2 — 프롬프트 실행 + 파싱 (2~3일)
├── promptBuilder.ts: 컨텍스트 주입 + System Prompt 조합
├── cliExecutor.ts: CLI 프로세스 실행
├── agentStructureParser.ts: JSON 파싱 + 유효성 검증
├── GENERATE_AGENT_STRUCTURE 메시지 핸들러
└── 에러 처리 + 타임아웃 관리

Phase 3 — Preview + Apply (2~3일)
├── AgentPreviewModal.tsx: 생성 결과 미리보기
├── Preview에서 Edit/Remove 기능
├── APPLY_GENERATED_STRUCTURE 메시지 핸들러
├── applyGeneratedStructure(): Agent 생성 + 관계 설정
└── Canvas 자동 배치 + delegates 엣지 생성

Phase 4 — 히스토리 + 사용성 (1~2일)
├── promptHistory.ts: 이력 저장/조회/삭제
├── PromptPanel에 히스토리 섹션
├── 히스토리에서 프롬프트 복원 + 재생성
└── 추천 프롬프트 템플릿 (시작점 제공)
```

### 2.12 추천 프롬프트 템플릿

```typescript
export const PROMPT_TEMPLATES = [
  {
    label: "코드 리뷰 팀",
    prompt: "코드 리뷰 팀을 구성해줘. 리드 1명, 리뷰어 2명. 리드는 PR을 분배하고, 리뷰어들은 각자 코드 품질과 보안을 담당해."
  },
  {
    label: "풀스택 개발 팀",
    prompt: "풀스택 웹 개발 팀. PM이 오케스트레이터, 프론트엔드 개발자, 백엔드 개발자, QA 테스터 각 1명씩."
  },
  {
    label: "문서/콘텐츠 팀",
    prompt: "기술 문서 작성 팀. 에디터가 전체를 관리하고, 테크니컬 라이터와 번역가가 실무."
  },
  {
    label: "데이터 파이프라인 팀",
    prompt: "데이터 엔지니어링 팀. 파이프라인 아키텍트가 리드, ETL 개발자와 데이터 품질 담당자."
  },
  {
    label: "커스텀...",
    prompt: ""
  }
];
```

---

## 3. Schedule Canvas (스케줄 실행 및 시각화)

### 3.1 개요

Graph Canvas는 에이전트 관계/위임/패턴(구조)을 보여주고, Schedule Canvas는 시간축에서 "누가 무엇을 언제까지"를 보여줍니다. 이 분리를 통해 실시간 업데이트에서도 화면이 안 망가지고, UX도 명확해집니다.

### 3.2 데이터 모델: Task를 "단일 소스 오브 트루스"로

#### Task 타입

핵심: Plan(예정)과 Actual(실제)을 분리해야 "슬립(예상 대비 지연)"이 보입니다.

```typescript
export type TaskStatus =
  | "planned"     // 계획만 있음
  | "ready"       // deps 충족, 시작 가능
  | "running"     // 실행 중
  | "blocked"     // 입력/승인/외부대기/에러로 멈춤
  | "done"
  | "failed"
  | "canceled";

export type TaskBlocker =
  | { kind: "approval"; message: string }
  | { kind: "input"; message: string }
  | { kind: "external"; message: string }
  | { kind: "error"; message: string; stack?: string };

export type Task = {
  id: string;               // "task:<uuid>"
  title: string;            // UI 표시용
  agentId: string;          // lane 결정 (Agent node id와 동일하게 맞추면 편함)
  deps: string[];           // 선행 task ids (DAG)

  // 계획(스케줄러가 채움)
  estimateMs?: number;      // 없으면 unknown(막대 길이 기본값/점선)
  plannedStartMs?: number;  // run 시작 기준 상대시간(ms)
  plannedEndMs?: number;

  // 실제(러너가 채움)
  actualStartMs?: number;
  actualEndMs?: number;
  progress?: number;        // 0~1 (없으면 UI에서 시간 기반 보간 가능)

  status: TaskStatus;
  blocker?: TaskBlocker;

  // 사용자 오버라이드(드래그로 일정 조정하는 단계에서 사용)
  overrides?: {
    pinned?: boolean;
    forceStartMs?: number;
    forceAgentId?: string;
    priority?: number;
  };

  meta?: Record<string, any>; // 로그 링크/툴콜/모델 등 확장 필드
  createdAtMs: number;
  updatedAtMs: number;
};
```

### 3.3 이벤트 스트림: "스냅샷 1번 + 패치 이벤트"로 실시간 구현

웹뷰에서 "실시간"을 부드럽게 보여주려면 폴링 금지, 이벤트 기반으로 갑니다.

#### TaskEvent (Extension → Webview)

```typescript
export type TaskEvent =
  | { type: "snapshot"; runId: string; tasks: Task[]; nowMs: number }
  | { type: "task_created"; runId: string; task: Task; nowMs: number }
  | { type: "task_updated"; runId: string; taskId: string; patch: Partial<Task>; nowMs: number }
  | { type: "task_deleted"; runId: string; taskId: string; nowMs: number }
  | { type: "schedule_recomputed"; runId: string; affectedTaskIds: string[]; nowMs: number };
```

#### Webview → Extension 요청 메시지

```typescript
SCHEDULE_SUBSCRIBE { runId }
SCHEDULE_UNSUBSCRIBE { runId }
SCHEDULE_GET_SNAPSHOT { runId }
TASK_PIN { runId, taskId, pinned: boolean }
TASK_MOVE { runId, taskId, forceStartMs?, forceAgentId? } ← 드래그 편집 단계에서
TASK_SET_PRIORITY { runId, taskId, priority }
```

### 3.4 스케줄러: MVP는 "DAG + agent별 단일 큐"로 충분

#### 기본 가정

- agent 1명당 기본 동시 실행 1개(필요하면 나중에 concurrency 추가)
- deps는 DAG(사이클 없음). 저장/생성 단계에서 validate.

#### 스케줄 계산

```typescript
type ComputeScheduleInput = {
  tasks: Map<string, Task>;
  defaultEstimateMs: number; // estimate 없는 task 기본 길이(예: 2분)
  agentConcurrency?: Record<string, number>; // 나중 확장
};

export function computeSchedule(input: ComputeScheduleInput): { updatedIds: string[] } {
  const { tasks, defaultEstimateMs } = input;

  // 1) indegree + adjacency
  const indeg = new Map<string, number>();
  const next = new Map<string, string[]>();
  for (const [id, t] of tasks) {
    indeg.set(id, 0);
    next.set(id, []);
  }
  for (const [id, t] of tasks) {
    for (const dep of t.deps) {
      if (!tasks.has(dep)) continue; // missing dep은 validate에서 걸러도 됨
      indeg.set(id, (indeg.get(id) ?? 0) + 1);
      next.get(dep)!.push(id);
    }
  }

  // 2) topo queue
  const q: string[] = [];
  for (const [id, d] of indeg) if (d === 0) q.push(id);

  // 3) agent lane available time
  const agentAvail = new Map<string, number>(); // plannedEnd 누적

  const updated: string[] = [];

  // helper: deps end time max
  const depsEnd = (t: Task) => {
    let m = 0;
    for (const dep of t.deps) {
      const dt = tasks.get(dep);
      if (!dt) continue;
      m = Math.max(m, dt.plannedEndMs ?? 0);
    }
    return m;
  };

  // 4) topo processing
  while (q.length) {
    const id = q.shift()!;
    const t = tasks.get(id)!;

    const est = t.estimateMs ?? defaultEstimateMs;
    const earliest = Math.max(depsEnd(t), agentAvail.get(t.agentId) ?? 0);

    // overrides.forceStartMs가 있으면 그걸 우선(단, dep 위반이면 blocked 처리하거나 clamp)
    const plannedStart = t.overrides?.forceStartMs != null
      ? Math.max(t.overrides.forceStartMs, depsEnd(t))
      : earliest;

    const plannedEnd = plannedStart + est;

    // 변경 체크
    if (t.plannedStartMs !== plannedStart || t.plannedEndMs !== plannedEnd) {
      t.plannedStartMs = plannedStart;
      t.plannedEndMs = plannedEnd;
      t.updatedAtMs = Date.now();
      updated.push(id);
    }

    agentAvail.set(t.agentId, plannedEnd);

    // next
    for (const nid of next.get(id) ?? []) {
      indeg.set(nid, (indeg.get(nid) ?? 1) - 1);
      if (indeg.get(nid) === 0) q.push(nid);
    }
  }

  return { updatedIds: updated };
}
```

**dep 위반(사이클/누락)은 반드시 실행 전 "그래프 린트"로 막아야 실시간 스케줄이 안정적입니다.**

### 3.5 Extension 구현: TaskScheduleService

Open Claw는 extension이 backend 역할을 하고 webview에 UI를 띄웁니다. 따라서 **Extension이 스케줄 상태의 권위(authoritative state)**를 가져야 합니다.

#### 새 파일/모듈 구조(추천)

```
extension/src/schedule/types.ts
  → Task, TaskEvent, 메시지 타입 정의(웹뷰와 공유할 수 있으면 공유)

extension/src/schedule/taskStore.ts
  → runId → tasks map, 구독자 관리

extension/src/schedule/scheduler.ts
  → 위 computeSchedule

extension/src/schedule/scheduleService.ts
  → 외부(러너/메시지 핸들러)에서 호출하는 파사드
```

#### scheduleService 핵심 API

```typescript
class ScheduleService {
  private runs = new Map<string, Map<string, Task>>();
  private subscribers = new Map<string, Set<(ev: TaskEvent)=>void>>();

  createRun(runId: string, initialTasks: Task[]) { ... } // snapshot 생성
  upsertTask(runId: string, task: Task) { ... }
  patchTask(runId: string, taskId: string, patch: Partial<Task>) { ... }
  deleteTask(runId: string, taskId: string) { ... }

  recompute(runId: string) {
    const tasks = this.runs.get(runId);
    if (!tasks) return;
    const { updatedIds } = computeSchedule({ tasks, defaultEstimateMs: 120_000 });
    if (updatedIds.length) this.emit({ type:"schedule_recomputed", runId, affectedTaskIds: updatedIds, nowMs: Date.now() });
    // 그리고 updatedIds 각각에 대해 patch 이벤트를 보내도 되고(정밀),
    // UI에서 snapshot 후 recompute만으로도 위치를 다시 계산하게 해도 됨(단순)
  }

  subscribe(runId: string, cb: (ev: TaskEvent)=>void) { ... } // snapshot 먼저 push
  unsubscribe(runId: string, cb: (ev: TaskEvent)=>void) { ... }

  private emit(ev: TaskEvent) { ... } // throttle(예: 50ms) 권장
}
```

#### 실시간 "부드러움"을 위한 throttle 규칙

- task_progress 같은 이벤트는 1초에 2~4회 이하로 제한
- 나머지는 즉시 보내도 되지만, schedule_recomputed는 묶어서(예: 100ms 배치)

### 3.6 Webview UI 구현: React Flow로 "Swimlane Timeline" 만들기

Open Claw webview는 React + React Flow 기반입니다. Schedule Canvas도 React Flow를 그대로 씁니다.

#### 좌표계 (이게 핵심)

```typescript
y = laneIndex * LANE_HEIGHT

x = timeToX(plannedStartMs)

bar width = durationToW(plannedEndMs - plannedStartMs)

const PX_PER_SEC = 4; // 예: 1초=4px (줌은 ReactFlow zoom으로)
const timeToX = (ms: number) => (ms / 1000) * PX_PER_SEC;
const durationToW = (ms: number) => Math.max(40, (ms / 1000) * PX_PER_SEC);
```

시간 단위를 "상대 ms(run 기준)"로 잡으면 리플레이/저장/복원, 다른 컴퓨터에서 다시 열었을 때 모두 일관됩니다.

#### 노드 타입 2개만 만들면 됨

**(1) LaneNode (배경 + agent label)**
```
type: "lane"
draggable: false, selectable: false
style width는 "현재 뷰포트 + 여유" 정도로 크게
```

**(2) TaskBarNode (막대)**
```
type: "task"
draggable: false (편집 기능 넣을 때만 true)
style.width = durationToW(...)
status에 따라 클래스만 바꿈(색은 CSS로)
```

#### ReactFlow nodes/edges 생성(웹뷰에서)

```typescript
function buildScheduleGraph(tasks: Task[], laneOrder: string[]) {
  const laneIndex = new Map(laneOrder.map((id, i) => [id, i]));

  const laneNodes = laneOrder.map((agentId, i) => ({
    id: `lane:${agentId}`,
    type: "lane",
    position: { x: 0, y: i * 84 },
    data: { agentId },
    draggable: false,
    selectable: false,
    style: { width: 5000, height: 84 } // 넉넉히
  }));

  const taskNodes = tasks.map(t => {
    const y = (laneIndex.get(t.agentId) ?? 0) * 84 + 18;
    const x = timeToX(t.plannedStartMs ?? 0);
    const w = durationToW((t.plannedEndMs ?? 0) - (t.plannedStartMs ?? 0));

    return {
      id: t.id,
      type: "task",
      position: { x, y },
      data: { taskId: t.id },
      draggable: false,
      style: { width: w, height: 48 }
    };
  });

  // deps edges(기본은 cross-agent만 표시 추천)
  const edges = tasks.flatMap(t => {
    return t.deps.map(depId => ({
      id: `e:${depId}->${t.id}`,
      source: depId,
      target: t.id,
      type: "smoothstep",
      animated: t.status === "running",
    }));
  });

  return { nodes: [...laneNodes, ...taskNodes], edges };
}
```

#### Now Line (현재 시간선) 오버레이

React Flow 위에 absolute div로 그리면 가장 단순합니다.

nowMs는 extension이 이벤트에 계속 넣어주거나, webview에서 requestAnimationFrame/setInterval(250ms)로 증가시켜도 됨(실제 값은 1초에 한 번만 받아도 "실시간처럼" 보임)

```typescript
const NowLineOverlay = ({ nowMs }: { nowMs: number }) => {
  const { x: tx, y: ty, zoom } = useViewport(); // 버전에 따라 훅 이름 다를 수 있음
  const worldX = timeToX(nowMs);
  const screenX = worldX * zoom + tx;

  return (
    <div
      style={{
        position: "absolute",
        left: screenX,
        top: 0,
        bottom: 0,
        width: 2,
        pointerEvents: "none",
      }}
      className="nowLine"
    />
  );
};
```

### 3.7 실시간 업데이트 파이프라인

#### 웹뷰 상태 (추천)

```typescript
const tasksById = useRef(new Map<string, Task>())

이벤트 들어오면 Map을 갱신

nodes/edges는 useMemo로 매번 재생성하거나,
규모가 커지면 "변경된 task만 node patch"하는 방식으로 최적화

MVP는 useMemo 재생성으로도 충분합니다(수백 task까지).
```

#### 지터(막대가 자꾸 흔들림) 방지

스케줄이 재계산될 때 막대가 순간이동하면 UX가 최악이 되기 쉬워요.

- task node 스타일에 transition: transform 120ms linear 적용
- 혹은 "recompute는 200ms throttle"로 덜 흔들리게

### 3.8 태스크 생성 전략

실시간 스케줄이 "예쁘게" 보이려면 task가 "그럴듯하게" 생성돼야 합니다.

#### MVP: 시스템이 만드는 최소 태스크

orchestrator가 worker에게 위임하는 순간:
```
task_created(title="<agent> 작업", agentId=worker)
dep는 orchestrator task에 연결
```

각 agent가 실제 CLI 호출을 시작하면:
```
task_started
출력 받으면:
task_done or task_failed
```

이 방식은 모델 출력 파싱 없이도 안정적.

#### 확장: Plan 턴 (LLM이 태스크 JSON 생성)

오케스트레이터가 "실행 전에" 다음 JSON을 만들게 함:
```json
[{title, agentId, deps, estimateMs}]
```

extension이 JSON 스키마 검증 + DAG 검증 통과 시 schedule 생성
실패하면 MVP 방식으로 fallback

### 3.9 구현 체크리스트

#### Extension 단계

- [ ] ScheduleService 추가 (in-memory + 이벤트 emit)
- [ ] webview 메시지 핸들러에: subscribe/unsubscribe/snapshot/pin/move 구현
- [ ] "테스트용" 커맨드 하나 추가:
  - Open Claw: Demo Schedule Run
  - → 10개 task 만들어서 3개 agent lane에 배치 + 1초마다 progress 업데이트

#### Webview 단계

- [ ] 오른쪽 패널 탭에 Schedule 추가 (Open Claw는 패널/탭 구조가 이미 있음)
- [ ] ScheduleView.tsx:
  - ReactFlow instance
  - LaneNode / TaskNode 등록
  - NowLineOverlay 추가
- [ ] Inspector 연동:
  - task 클릭 → taskId로 상세 표시(상태/블로커/로그 링크)

### 3.10 다음 단계: "드래그로 재스케줄" 넣는 방법

TaskBarNode를 draggable: true로 바꾸고, 드래그 종료 시:

```typescript
worldX -> timeMs 역변환
TASK_MOVE(runId, taskId, forceStartMs)를 extension으로 전송

extension은
  task.overrides.forceStartMs 갱신
  computeSchedule() 재실행
  schedule_recomputed + patch 전송
```

---

## 4. Canvas Functions (캔버스 기본 기능)

### 4.1 메인 화면 UI 와이어프레임

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR (44px)                                                                            │
│ [Agent Studio]  [Active: Codex / default]  (🔄 Refresh) (⬆ Export Pack) (⬇ Import Pack)   │
│ (✅ Validate)   (⚙ Settings)   [Search ⌘K]                                                  │
├───────────────┬───────────────────────────────────────────────────────┬───────────────────┤
│ LEFT SIDEBAR  │ CANVAS (dot-grid background)                           │ RIGHT PANEL       │
│ (260px)       │                                                       │ (360px, resizable)│
│               │   ┌─────────┐        ┌──────────┐                     │  Tabs:            │
│ Providers     │   │ AGENT    │──contains──▶│ SKILL     │               │  [Inspector] [ + ]│
│  • AgentSkills│   │ Codex    │              │ web-test  │               │                   │
│  • Codex      │   └─────────┘              └──────────┘               │  Inspector         │
│  • OpenClaw(?)│        │ overrides                                      │  ─────────         │
│               │        ▼                                                │  Type: SKILL       │
│ Agents        │   ┌───────────┐                                        │  Name: web-test    │
│  • default    │   │ RULEDOC    │                                        │  Desc: ...         │
│  • work       │   │ AGENTS.md  │                                        │  Scope: project    │
│               │   └───────────┘                                        │  Path: ...         │
│ Skills        │        │ overrides                                      │                   │
│  • (project)  │        ▼                                                │  Actions           │
│  • (personal) │   ┌────────────────┐                                   │  [Open] [Reveal]   │
│               │   │ RULEDOC         │                                   │  [Validate]        │
│ Packs         │   │ AGENTS.override │                                   │  [Export Skill]    │
│  • recent     │   └────────────────┘                                   │                   │
│               │                                                       │  Validation         │
│               │                                                       │  Errors: 0          │
│               │                                                       │  Warnings: 1        │
│               │                                                       │    - ...            │
│               │                                                       │                   │
├───────────────┴───────────────────────────────────────────────────────┴───────────────────┤
│ STATUS BAR (24px): Skills=12  Rules=4  Errors=1  Warnings=3   (Focus: Canvas)             │
└──────────────────────────────────────────────────────────────────────────────────────────┘

Canvas floating controls (bottom-right, overlay):
  [Fit(1)] [Zoom+ (+)] [Zoom- (-)] [Reset(0)] [Tidy]    [ + ] Node Library toggle
```

### 4.2 빈 상태 (초기 화면)

```
CANVAS (dot grid)
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Add first step                                        │  │
│  │                                                       │  │
│  │  [Scan workspace]   [Create new Skill]   [Import Pack] │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Tips:                                                      │
│   - Put skills in .github/skills/<name>/SKILL.md            │
│   - Add AGENTS.md for Codex guidance                        │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Node Library 모드

```
RIGHT PANEL (Node Library)
┌───────────────────────────────────────────────┐
│ Tabs: [Inspector] [ + Node Library ]          │
├───────────────────────────────────────────────┤
│ Search: [ web...                          ]   │
│                                               │
│ Categories                                    │
│  ▸ Skills                                      │
│     • New Skill (wizard)                       │
│     • Import Skill Pack                        │
│  ▸ Rules                                       │
│     • Create AGENTS.override.md (here)         │
│  ▸ Notes                                       │
│     • Sticky Note                              │
│  ▸ Utilities                                   │
│     • Folder Marker (skills root)              │
│                                               │
│ (Drag items onto canvas where possible)        │
└───────────────────────────────────────────────┘
```

### 4.4 Command Bar Overlay (⌘K / Ctrl+K)

```
(overlay centered)
┌──────────────────────────────────────────────────────────────┐
│ Command: [ export pack ...                                ]  │
├──────────────────────────────────────────────────────────────┤
│ • Refresh discovery                                          │
│ • Validate all skills                                        │
│ • Export selected skills as pack                             │
│ • Import skill pack                                          │
│ • Create new skill                                           │
│ • Create AGENTS.override.md in current dir                   │
│ • Toggle Node Library                                        │
│ • Tidy layout                                                │
└──────────────────────────────────────────────────────────────┘
```

### 4.5 노드 타입 설계 (공통 인터페이스)

모든 노드 data는 직렬화 가능(JSON)해야 하므로 함수/클래스/Date 객체 지양(ISO string 사용).

```typescript
// webview-ui/src/canvas/types.ts
export type NodeKind = 'agent' | 'skill' | 'ruleDoc' | 'note' | 'folder';
export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: Severity;
  code: string;          // e.g. "SKILL_NAME_MISMATCH"
  message: string;
  file?: string;         // "SKILL.md"
  line?: number;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  lastValidatedAt?: string; // ISO
}

export interface BaseNodeData {
  kind: NodeKind;
  title: string;             // primary label
  subtitle?: string;         // secondary label
  badgeText?: string;        // e.g. "project", "personal", "global"
  status?: 'ok' | 'warn' | 'error' | 'unknown';
  providerId?: string;       // "codex" | "agentSkills" | "openclaw" ...
  path?: string;             // uri string (vscode.Uri.toString())
  selectable?: boolean;
}
```

### 4.6 SkillNode

#### 데이터

```typescript
export type SkillScope = 'project' | 'personal' | 'shared' | 'unknown';

export interface SkillNodeData extends BaseNodeData {
  kind: 'skill';
  skillId: string;               // stable id (e.g. hash of path) or uuid
  name: string;                  // frontmatter name
  description: string;           // frontmatter description
  scope: SkillScope;
  rootDirUri: string;            // skill folder uri
  skillMdUri: string;            // SKILL.md uri
  enabled?: boolean;             // best-effort; may be undefined if runtime doesn't support toggle
  validation?: ValidationResult;
  extraFrontmatter?: Record<string, unknown>; // preserve unknown fields
}
```

#### UI 규칙

- 상단: title = `name`
- subtitle = `description`(1~2줄 ellipsis)
- badge: scope(project/personal/shared)
- 상태 아이콘:
  - validation ok → ✅
  - warnings only → ⚠️
  - errors → ⛔
- hover action bar(우상단):
  - Open
  - Enable/Disable(가능할 때만)
  - More(⋯)

### 4.7 RuleDocNode

#### 데이터

```typescript
export type RuleDocType =
  | 'codex-agents'
  | 'codex-agents-override'
  | 'openclaw-agents'
  | 'openclaw-soul'
  | 'openclaw-user'
  | 'openclaw-tools'
  | 'unknown';

export type RuleScope = 'global' | 'project' | 'agent-workspace' | 'unknown';

export interface RuleDocNodeData extends BaseNodeData {
  kind: 'ruleDoc';
  ruleDocId: string;
  docType: RuleDocType;
  scope: RuleScope;
  orderIndex: number;          // chain order for overrides visualization
  uri: string;                 // file uri
  exists: boolean;             // false면 "Create" CTA 표시 가능
}
```

#### UI 규칙

- title = AGENTS.md / SOUL.md 등 파일명
- subtitle = scope + (override 여부)
- hover actions:
  - Open(존재 시)
  - Create override(존재하지 않거나 생성 가능한 위치면)
  - More(⋯)

### 4.8 AgentNode

#### 데이터

```typescript
export interface AgentNodeData extends BaseNodeData {
  kind: 'agent';
  agentId: string;               // provider-specific id
  displayName: string;           // "Codex / default"
  providerId: string;            // "codex", "openclaw", ...
  workspaceRootUri?: string;
  homeDirUri?: string;
}
```

#### UI 규칙

- title = provider + profile
- subtitle = workspace root(있으면)
- hover actions:
  - Set active
  - Refresh only this agent
  - More

### 4.9 NoteNode (Sticky note)

```typescript
export interface NoteNodeData extends BaseNodeData {
  kind: 'note';
  noteId: string;
  text: string;
  // optional: width/height persisted by reactflow node size state
}
```

UI 규칙:
- 클릭 시 인라인 편집(간단 textarea)
- hover actions: delete note, duplicate note

### 4.10 FolderNode (스킬 루트/마커)

```typescript
export interface FolderNodeData extends BaseNodeData {
  kind: 'folder';
  folderId: string;
  folderUri: string;
  label: string;
}
```

### 4.11 Edge 설계

```typescript
export type EdgeKind = 'contains' | 'overrides' | 'locatedIn';

export interface GraphEdgeData {
  kind: EdgeKind;
  label?: string;           // e.g. "overrides"
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type?: 'smoothstep' | 'step' | 'default';
  data: GraphEdgeData;
}
```

UI 규칙:
- `overrides` 엣지는 점선(dashed) 스타일 추천
- `contains`는 일반 실선
- `locatedIn`는 옅게(투명도) 표시
- 색상 고정하지 말고 **VS Code theme variable** 기반으로 CSS 작성

### 4.12 Inspector 패널 스펙

#### Skill Inspector

```
[Skill Inspector]
- Header: name + scope badge + enabled toggle(가능 시)
- Path: rootDirUri (copy button)
- Files: SKILL.md (open)
- Validation summary:
   ok? / errors count / warnings count / lastValidatedAt
   issue list (severity icon + message)
- Actions:
   [Open SKILL.md] [Reveal folder] [Validate]
   [Export skill]  [Copy as pack snippet] (optional)
- Frontmatter editor (MVP-lite):
   name (readonly if mismatch? editable 가능)
   description
   (advanced) raw yaml editor toggle
```

#### RuleDoc Inspector

```
[RuleDoc Inspector]
- Header: filename + scope badge + orderIndex
- Path: uri
- Chain:
   show previous/next docs in chain
- Actions:
   [Open] [Create override here] [Reveal]
```

#### Agent Inspector

```
[Agent Inspector]
- Header: provider/profile + "Active" badge
- Workspace root
- Home dir
- Counts: skills/rules
- Actions: [Set active] [Refresh agent]
```

### 4.13 캔버스 조작/단축키 스펙

#### 기본

- 팬:
  - Space + drag
  - Middle mouse drag
  - (가능하면) Ctrl + drag
- 줌:
  - Ctrl+Wheel
  - `+` / `-`
  - `0` Reset
  - `1` Fit
- 탭:
  - `Tab` → Node Library 토글
- 노트:
  - `Shift+S` → Sticky note 생성(캔버스 중앙에 생성)

> VS Code webview에서 충돌나는 키는 "webview focus"일 때만 처리. 실패하면 상단의 🔍 버튼으로도 Command Bar 열기.

---

## 5. Feature Roadmap (기능 로드맵)

### Phase 1 — 핵심 발견 & 시각화
- [x] Agent Skills 자동 탐지 및 SKILL.md 검증
- [x] Codex AGENTS 체인 탐지
- [x] n8n 스타일 캔버스(도트 그리드, 노드, 엣지)
- [x] 기본 Inspector(선택된 노드 상세)
- [ ] Node Library(새 Skill 생성, Import Pack)

### Phase 2 — 스킬 관리 & 공유
- [ ] Skill 생성 마법사(폼 + SKILL.md 템플릿)
- [ ] 검증 규칙 완전 구현(name/description/파일 참조 등)
- [ ] Skill Pack 내보내기(zip + skillpack.json)
- [ ] Skill Pack 가져오기(미리보기 + 충돌 처리)
- [ ] Skill 편집(frontmatter 폼, raw YAML)

### Phase 3 — Prompt-to-Agents 자동 생성
- [ ] CLI 백엔드 감지 (Claude Code, Gemini, Codex, Aider)
- [ ] Prompt 입력 UI (PromptPanel)
- [ ] AI CLI 호출 + JSON 파싱
- [ ] Agent 생성 Preview Modal
- [ ] Canvas에 자동 배치 + delegation 엣지
- [ ] Prompt History 저장/재사용

### Phase 4 — 실행 & 디버깅 기반
- [ ] Run/RunHistory 저장(JSONL + index)
- [ ] "이 노드만 실행"(Single node testing)
- [ ] Last Run + Variable Inspect
- [ ] 핀 데이터(pinned output) + 부분 재실행
- [ ] Run 패널에 스트리밍 로그/edge 이벤트 표시

### Phase 5 — Schedule Canvas
- [ ] Task 데이터 모델(Plan + Actual, DAG deps)
- [ ] TaskScheduleService (Extension)
- [ ] Swimlane Timeline UI (React Flow)
- [ ] Now Line 오버레이
- [ ] 드래그로 재스케줄

### Phase 6 — OpenClaw 연동
- [ ] OpenClaw Workspace Provider (읽기)
- [ ] Open Claw as "OpenClaw Workspace Editor"
- [ ] OpenClaw CLI Runtime (실행)
- [ ] OpenClaw Gateway (ws://) 연결 (고급)

### Phase 7 — 고급 기능
- [ ] Skill Registry(외부 레지스트리 검색)
- [ ] Skill 신뢰 모델(서명/해시/위험 스코어)
- [ ] "Prompt Preview" (최종 프롬프트 컨텍스트 합성)
- [ ] Replay / Time-travel 디버깅

---

## 6. 기술 스택

### Extension (Backend)
- TypeScript, VS Code Extension API
- 파일 스캔/읽기/쓰기: Node `fs/promises` (+ `vscode.workspace.fs` 추후)
- Git root 찾기: `.git` 상위 탐색 또는 `git rev-parse --show-toplevel`

### Webview (Frontend)
- React + TypeScript
- 그래프/캔버스: `reactflow`
- 자동 레이아웃(Tidy): `dagre` 또는 `@dagrejs/dagre`
- YAML frontmatter 파싱: `gray-matter`
- 검증 스키마: `zod`
- UI 컨트롤: VS Code Webview UI Toolkit(선택) + 커스텀 CSS(도트 그리드)

---

## 7. 메시지 프로토콜 (protocol.ts)

### 7.1 기본 구조

```typescript
export type IsoDateString = string;
export type UriString = string;
export type RequestId = string;
export type ProviderId = 'agentSkills' | 'codex' | 'openclaw' | 'unknown';
export type NodeKind = 'agent' | 'skill' | 'ruleDoc' | 'note' | 'folder';
export type EdgeKind = 'contains' | 'overrides' | 'locatedIn';
export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  file?: string;
  line?: number;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  lastValidatedAt?: IsoDateString;
}
```

### 7.2 엔티티

```typescript
export type SkillScope = 'project' | 'personal' | 'shared' | 'unknown';

export interface SkillEntity {
  skillId: string;
  name: string;
  description: string;
  scope: SkillScope;
  providerId: ProviderId;
  rootDirUri: UriString;
  skillMdUri: UriString;
  enabled?: boolean;
  validation?: ValidationResult;
  extraFrontmatter?: Record<string, unknown>;
}

export type RuleDocType =
  | 'codex-agents'
  | 'codex-agents-override'
  | 'openclaw-agents'
  | 'openclaw-soul'
  | 'openclaw-user'
  | 'openclaw-tools'
  | 'unknown';

export type RuleScope = 'global' | 'project' | 'agent-workspace' | 'unknown';

export interface RuleDocEntity {
  ruleDocId: string;
  docType: RuleDocType;
  scope: RuleScope;
  orderIndex: number;
  uri: UriString;
  exists: boolean;
  providerId: ProviderId;
}

export interface AgentProfileEntity {
  agentId: string;
  displayName: string;          // "Codex / default"
  providerId: ProviderId;
  workspaceRootUri?: UriString;
  homeDirUri?: UriString;
}
```

### 7.3 그래프 스냅샷

```typescript
export interface XYPosition {
  x: number;
  y: number;
}

export interface BaseNodeData {
  kind: NodeKind;
  title: string;
  subtitle?: string;
  badgeText?: string;
  status?: 'ok' | 'warn' | 'error' | 'unknown';
  providerId?: ProviderId;
  path?: UriString;
}

export interface AgentNodeData extends BaseNodeData {
  kind: 'agent';
  agentId: string;
  displayName: string;
  workspaceRootUri?: UriString;
  homeDirUri?: UriString;
}

export interface SkillNodeData extends BaseNodeData {
  kind: 'skill';
  skillId: string;
  name: string;
  description: string;
  scope: SkillScope;
  rootDirUri: UriString;
  skillMdUri: UriString;
  enabled?: boolean;
  validation?: ValidationResult;
  extraFrontmatter?: Record<string, unknown>;
}

export interface RuleDocNodeData extends BaseNodeData {
  kind: 'ruleDoc';
  ruleDocId: string;
  docType: RuleDocType;
  scope: RuleScope;
  orderIndex: number;
  uri: UriString;
  exists: boolean;
}

export interface NoteNodeData extends BaseNodeData {
  kind: 'note';
  noteId: string;
  text: string;
}

export interface FolderNodeData extends BaseNodeData {
  kind: 'folder';
  folderId: string;
  folderUri: UriString;
  label: string;
}

export type NodeData =
  | AgentNodeData
  | SkillNodeData
  | RuleDocNodeData
  | NoteNodeData
  | FolderNodeData;

export interface GraphNode<TData extends NodeData = NodeData> {
  id: string;
  type: NodeKind;       // reactflow nodeTypes key
  position: XYPosition;
  data: TData;
  selected?: boolean;
}

export interface GraphEdgeData {
  kind: EdgeKind;
  label?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type?: 'smoothstep' | 'step' | 'default';
  data: GraphEdgeData;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

### 7.4 UI State & Studio State

```typescript
export type RightPanelTab = 'inspector' | 'library';

export interface UiState {
  rightPanelTab: RightPanelTab;
  selectedNodeId?: string;
  commandBarOpen: boolean;
  lastRefreshedAt?: IsoDateString;
  zoom?: number;
  pan?: XYPosition;
}

export interface StudioState {
  agents: AgentProfileEntity[];
  selectedAgentId?: string;
  skills: SkillEntity[];
  ruleDocs: RuleDocEntity[];
  graph: GraphSnapshot;
  ui: UiState;
  summary: {
    skills: number;
    ruleDocs: number;
    errors: number;
    warnings: number;
  };
}
```

### 7.5 메시지 유형

#### Webview → Extension

```typescript
export interface ReadyMsg extends BaseMessage {
  type: 'READY';
}

export interface RefreshMsg extends BaseMessage {
  type: 'REFRESH';
  agentId?: string;
}

export interface SetActiveAgentMsg extends BaseMessage {
  type: 'SET_ACTIVE_AGENT';
  agentId: string;
}

export interface OpenFileMsg extends BaseMessage {
  type: 'OPEN_FILE';
  uri: UriString;
}

export interface RevealInExplorerMsg extends BaseMessage {
  type: 'REVEAL_IN_EXPLORER';
  uri: UriString;
}

export interface CreateSkillMsg extends BaseMessage {
  type: 'CREATE_SKILL';
  baseDirUri: UriString;
  name: string;
  description: string;
  extraFrontmatter?: Record<string, unknown>;
}

export interface UpdateSkillFrontmatterMsg extends BaseMessage {
  type: 'UPDATE_SKILL_FRONTMATTER';
  skillId: string;
  patch: {
    name?: string;
    description?: string;
    extraFrontmatter?: Record<string, unknown>;
  };
}

export interface ValidateSkillMsg extends BaseMessage {
  type: 'VALIDATE_SKILL';
  skillId: string;
}

export interface ValidateAllSkillsMsg extends BaseMessage {
  type: 'VALIDATE_ALL_SKILLS';
}

export interface SetSkillEnabledMsg extends BaseMessage {
  type: 'SET_SKILL_ENABLED';
  skillId: string;
  enabled: boolean;
}

export interface CreateAgentsOverrideMsg extends BaseMessage {
  type: 'CREATE_AGENTS_OVERRIDE';
  dirUri: UriString;
  template?: 'empty' | 'copy-current' | 'starter';
}

export interface ExportPackMsg extends BaseMessage {
  type: 'EXPORT_PACK';
  skillIds: string[];
  outputUri: UriString;
  packMeta?: {
    name?: string;
    version?: string;
  };
}

export interface ImportPackMsg extends BaseMessage {
  type: 'IMPORT_PACK';
  zipUri: UriString;
  installDirUri: UriString;
  conflictPolicy?: 'suffix' | 'overwrite' | 'cancel';
}

export interface SaveNoteMsg extends BaseMessage {
  type: 'SAVE_NOTE';
  noteId: string;
  text: string;
}

export interface DeleteNoteMsg extends BaseMessage {
  type: 'DELETE_NOTE';
  noteId: string;
}
```

#### Extension → Webview

```typescript
export interface InitStateMsg extends BaseMessage {
  type: 'INIT_STATE';
  state: StudioState;
}

export interface StatePatchMsg extends BaseMessage {
  type: 'STATE_PATCH';
  patch: Partial<StudioState>;
  mode?: 'merge' | 'replaceGraph';
}

export interface ToastMsg extends BaseMessage {
  type: 'TOAST';
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface ErrorMsg extends BaseMessage {
  type: 'ERROR';
  message: string;
  detail?: string;
}

export interface ResponseOkMsg extends BaseMessage {
  type: 'RESPONSE_OK';
  inReplyTo: RequestId;
  result?: unknown;
}

export interface ResponseErrorMsg extends BaseMessage {
  type: 'RESPONSE_ERROR';
  inReplyTo: RequestId;
  error: { message: string; detail?: string };
}
```

---

## 8. VsCode 브리지 초안

```typescript
// webview-ui/src/messaging/vscodeBridge.ts
import type {
  MessageFromExtension,
  MessageFromWebview,
  RequestId,
  ResponseOkMsg,
  ResponseErrorMsg,
} from './protocol';

declare const acquireVsCodeApi: any;

type Pending = {
  resolve: (value: any) => void;
  reject: (err: Error) => void;
  timeoutHandle: number;
};

export class VsCodeBridge {
  private vscode = acquireVsCodeApi();
  private pending = new Map<RequestId, Pending>();

  constructor() {
    window.addEventListener('message', (event) => {
      const msg = event.data as MessageFromExtension;
      this.onMessage(msg);
    });
  }

  post(msg: MessageFromWebview) {
    this.vscode.postMessage(msg);
  }

  request<T = any>(msg: MessageFromWebview, timeoutMs = 15000): Promise<T> {
    const requestId = this.newRequestId();
    const withId = { ...msg, requestId } as MessageFromWebview;

    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Request timeout: ${msg.type}`));
      }, timeoutMs);

      this.pending.set(requestId, { resolve, reject, timeoutHandle });
      this.vscode.postMessage(withId);
    });
  }

  private onMessage(msg: MessageFromExtension) {
    if (msg.type === 'RESPONSE_OK') {
      const m = msg as ResponseOkMsg;
      const p = this.pending.get(m.inReplyTo);
      if (!p) return;
      window.clearTimeout(p.timeoutHandle);
      this.pending.delete(m.inReplyTo);
      p.resolve(m.result);
      return;
    }

    if (msg.type === 'RESPONSE_ERROR') {
      const m = msg as ResponseErrorMsg;
      const p = this.pending.get(m.inReplyTo);
      if (!p) return;
      window.clearTimeout(p.timeoutHandle);
      this.pending.delete(m.inReplyTo);
      p.reject(new Error(m.error.detail ? `${m.error.message}\n${m.error.detail}` : m.error.message));
      return;
    }

    // Non-response messages should be handled by app-level store reducer
    // e.g. INIT_STATE / STATE_PATCH / TOAST / ERROR
  }

  private newRequestId(): RequestId {
    return `req_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}
```

---

## 9. 캔버스 CSS: VS Code 테마 친화

```css
/* webview-ui/src/styles/canvas.css */
.canvasRoot {
  height: 100%;
  width: 100%;
  background-color: var(--vscode-editor-background);
  background-image:
    radial-gradient(
      rgba(127, 127, 127, 0.22) 1px,
      transparent 1px
    );
  background-size: 18px 18px;
}

/* hover action bar: use theme foreground but low alpha */
.nodeActionBar {
  background: color-mix(in srgb, var(--vscode-editor-background) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 18%, transparent);
  border-radius: 6px;
}
```

---

## 10. 리포 구조 (권장)

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
        cliDetector.ts
        cliExecutor.ts
        promptBuilder.ts
        agentStructureParser.ts
        promptHistory.ts
      schedule/
        types.ts
        taskStore.ts
        scheduler.ts
        scheduleService.ts
      messages/
        protocol.ts
  webview-ui/               # React app (vite)
    src/
      App.tsx
      canvas/
        GraphView.tsx
        ScheduleView.tsx
        nodes/
          SkillNode.tsx
          RuleDocNode.tsx
          AgentNode.tsx
          NoteNode.tsx
          LaneNode.tsx
          TaskBarNode.tsx
      panels/
        LeftSidebar.tsx
        RightPanel.tsx      # Inspector / Node Library 탭
        PromptPanel.tsx
        RunPanel.tsx
        CommandBar.tsx
      state/
        store.ts
      messaging/
        vscodeBridge.ts
        protocol.ts
  package.json              # contributes: commands, views, icon
  README.md
```

---

## 11. 다음 버전 (로드맵 아이디어)

- "Skill Registry": GitHub repo/ClawHub 같은 외부 레지스트리 검색/설치
- Skill 신뢰(Trust) 모델: 서명/해시, 퍼블리셔 정보, 위험 스코어(스크립트/권한/allowed-tools 등)
- OpenClaw 완전 지원(agents/workspaces, SOUL.md/USER.md 편집, per-agent skills)
- "Prompt Preview": 선택된 Rule+Skill 조합이 실제로 어떤 "최종 프롬프트 컨텍스트"가 되는지 합성 미리보기
- Multi-backend execution & debug (simultaneous runs on Claude/Gemini/Codex)
- Advanced Skill trust & security verification
- Cloud-based Skill Pack registry & sharing
- Team collaboration & skill approval workflows

---

**This consolidated WORKFLOW.md serves as the comprehensive specification for Open Claw development, integrating all aspects of prompt-to-agent generation, schedule canvas visualization, MVP feature set, and technical architecture.**
