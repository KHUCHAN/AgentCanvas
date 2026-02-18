# AgentCanvas — Prompt 기반 Agent 구조 자동 생성

> 사용자가 자연어 Prompt를 입력하면 연결된 AI CLI(Claude Code, Gemini CLI, Codex)를 통해 Agent 팀 구조를 자동으로 생성하는 기능

---

## 1. 핵심 아이디어

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

---

## 2. 지원 AI CLI 백엔드

### 2.1 대상 CLI 목록

| CLI | 실행 명령어 | 특징 |
|-----|------------|------|
| Claude Code | `claude --print` 또는 `claude -p` | Anthropic Claude 기반, 대화형/비대화형 모드 |
| Gemini CLI | `gemini` | Google Gemini 기반 |
| Codex CLI (OpenAI) | `codex` | OpenAI Codex 기반 |
| Aider | `aider --message` | 코드 편집 특화 |
| 커스텀 | 사용자 정의 CLI | 설정에서 경로/인자 지정 |

### 2.2 CLI 감지 방식

extension 활성화 시 또는 사용자 요청 시 각 CLI의 존재를 확인한다.

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

### 2.3 VS Code 설정 통합

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
  }
}
```

---

## 3. Prompt → Agent 생성 파이프라인

### 3.1 전체 흐름

```
Step 1: 사용자가 Prompt 입력
Step 2: 현재 워크스페이스 컨텍스트 수집 (기존 Agent, Skill, MCP 목록)
Step 3: System Prompt + User Prompt + Context를 조합한 최종 프롬프트 구성
Step 4: 선택된 CLI 백엔드로 실행
Step 5: CLI 출력(JSON)을 파싱
Step 6: Preview UI에서 사용자에게 확인
Step 7: 확인되면 .agentcanvas/agents/ 에 저장 + Canvas 반영
```

### 3.2 System Prompt (CLI에 전달할 지시문)

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

### 3.3 CLI 실행 서비스

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

### 3.4 응답 파싱

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

---

## 4. UI 컴포넌트

### 4.1 PromptPanel — 프롬프트 입력 영역

**위치**: 오른쪽 패널에 세 번째 탭으로 추가, 또는 독립 모달

**파일**: `webview-ui/src/panels/PromptPanel.tsx` (신규)

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

### 4.2 AgentPreviewModal — 생성 결과 미리보기

**파일**: `webview-ui/src/panels/AgentPreviewModal.tsx` (신규)

CLI 응답을 파싱한 후 사용자에게 확인을 받는 모달이다.

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

### 4.3 Prompt History

과거 프롬프트와 생성 결과를 저장하여 다시 활용할 수 있다.

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

---

## 5. 메시지 프로토콜 추가

### 5.1 Webview → Extension (신규 메시지)

**파일**: `extension/src/messages/protocol.ts`, `webview-ui/src/messaging/protocol.ts`

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

### 5.2 Extension → Webview (신규 메시지)

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

---

## 6. Extension 백엔드 구현

### 6.1 신규 서비스 파일

| 파일 | 역할 |
|------|------|
| `services/cliDetector.ts` | CLI 존재 감지 (which/where 명령) |
| `services/cliExecutor.ts` | CLI 프로세스 실행 + 타임아웃 관리 |
| `services/promptBuilder.ts` | System Prompt 조합 + 컨텍스트 주입 |
| `services/agentStructureParser.ts` | CLI 출력 JSON 파싱 + 유효성 검증 |
| `services/promptHistory.ts` | 프롬프트 이력 저장/조회/삭제 |

### 6.2 handleMessage 추가

**파일**: `extension/src/extension.ts`

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

### 6.3 구조 적용 로직

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

---

## 7. CLI별 호출 상세

### 7.1 Claude Code

```bash
# 비대화형 모드 (--print)
claude --print 'JSON으로 agent 구조를 생성해주세요: ...'

# 또는 stdin pipe
echo '프롬프트 내용' | claude --print

# system prompt 포함
claude --print --system-prompt 'You are an agent architect' '사용자 프롬프트'
```

**주의사항**:
- `--print` 플래그로 비대화형 모드 사용 (인터랙티브 프롬프트 방지)
- stdout으로 결과 출력, JSON 파싱 가능
- `--output-format json` 옵션 사용 가능 여부 확인

### 7.2 Gemini CLI

```bash
# 비대화형 모드
echo '프롬프트 내용' | gemini

# 또는 직접 인자
gemini -prompt '프롬프트 내용'
```

### 7.3 Codex CLI

```bash
# 비대화형 모드
codex --approval-mode full-auto '프롬프트 내용'

# 또는
echo '프롬프트 내용' | codex --quiet
```

### 7.4 공통 주의사항

- **타임아웃**: CLI 응답은 수십 초 ~ 2분 이상 걸릴 수 있다. 기본 120초, 사용자 설정 가능.
- **토큰/API 키**: 각 CLI는 자체 인증을 사용한다. extension이 별도 키를 관리하지 않는다.
- **에러 처리**: CLI가 없거나 인증 실패 시 친절한 에러 메시지 + 설치 안내 링크 제공.
- **출력 인코딩**: UTF-8 강제. `NO_COLOR=1` 환경변수로 ANSI escape 코드 제거.

---

## 8. UX 시나리오

### 시나리오 1: 처음 사용

```
1. 사용자가 Right Panel에서 "AI Prompt" 탭 클릭
2. Backend 드롭다운에 "Claude Code ●" "Gemini CLI ○" 표시 (● = 설치됨)
3. 프롬프트 입력: "웹 개발 팀 만들어줘. 프론트엔드, 백엔드, 디자이너 각 1명씩"
4. [Generate] 클릭
5. 로딩 스피너 + "Calling Claude Code..." 메시지
6. 30초 후 결과 → AgentPreviewModal 팝업
7. 3개 Agent 카드 표시: 🎯 Tech Lead, 💻 Frontend Dev, ⚙️ Backend Dev
8. 사용자가 "디자이너가 없네?" → [Edit]으로 직접 추가 가능
9. [Apply to Canvas] 클릭
10. Canvas에 3+1개 Agent 노드 자동 배치 + delegates 엣지 연결
```

### 시나리오 2: 기존 리소스 활용

```
1. 워크스페이스에 이미 Skills 5개, MCP 3개 존재
2. 프롬프트: "기존 스킬들을 활용해서 CI/CD 파이프라인 관리 팀 구성해줘"
3. Context 옵션에 "Include existing skills ☑" "Include existing MCPs ☑"
4. CLI가 기존 Skill/MCP를 참조하여 적절히 배분한 구조 생성
5. Preview에서 "code-lint skill → Code Checker agent" 할당 확인
6. Apply → 기존 Skill 노드와 신규 Agent 노드 사이에 엣지 자동 생성
```

### 시나리오 3: 히스토리에서 재생성

```
1. 이전에 "코드 품질 팀" 구조를 생성한 적 있음
2. AI Prompt 탭 하단 History 섹션에서 해당 항목 클릭
3. 이전 프롬프트가 입력란에 복원
4. 수정 후 다시 Generate → 기존 Agent 유지/업데이트
```

### 시나리오 4: CLI가 없을 때

```
1. AI Prompt 탭 클릭
2. Backend 드롭다운에 모든 CLI가 ○ (미설치)
3. "AI CLI가 설치되어 있지 않습니다" 안내 메시지
4. [Claude Code 설치하기] [Gemini CLI 설치하기] 링크 제공
5. 수동 Agent 생성 버튼으로 폴백
```

---

## 9. 보안 고려사항

### 9.1 프롬프트 인젝션 방지

- CLI에 전달하는 프롬프트에서 셸 특수문자를 이스케이프한다.
- `child_process.execFile` 사용을 권장 (셸 해석 없이 직접 실행).
- 사용자 입력을 `--` 이후 인자로 전달하여 플래그 인젝션 방지.

### 9.2 출력 검증

- CLI 출력이 예상 JSON 스키마와 일치하는지 검증한다.
- Agent 이름에 파일 시스템 위험 문자(../,  /, \)가 없는지 확인한다.
- `systemPrompt` 필드에 잠재적 위험 내용이 있는지 경고한다 (길이 제한 포함).

### 9.3 파일 시스템 접근

- `.agentcanvas/agents/` 디렉토리 외부에 파일을 생성하지 않는다.
- 기존 Agent 프로필을 덮어쓰기 전 사용자 확인을 받는다.
- 백업: 덮어쓰기 시 기존 파일을 `.agentcanvas/agents/.backup/`에 보관.

---

## 10. 에러 처리

| 상황 | 처리 |
|------|------|
| CLI 미설치 | 드롭다운에 비활성 표시, 설치 안내 링크 제공 |
| CLI 인증 실패 | "API 키 설정을 확인하세요" 메시지 + CLI 공식 문서 링크 |
| 타임아웃 (120초) | "응답 시간 초과. 프롬프트를 간단하게 하거나 타임아웃을 늘려주세요" |
| JSON 파싱 실패 | CLI 원본 출력을 보여주고, "JSON 형식이 아닌 응답입니다" + 재시도 버튼 |
| Agent 이름 충돌 | Preview에서 경고 표시 + "Overwrite" 체크박스로 사용자 선택 |
| Skill/MCP 미존재 참조 | suggestedNewSkills로 분류, 자동 생성 옵션 제공 |
| 빈 응답 | "AI가 빈 결과를 반환했습니다. 프롬프트를 더 구체적으로 작성해주세요" |

---

## 11. 구현 순서 (로드맵)

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

---

## 12. 파일별 수정 범위

| 파일 | 수정 내용 | Phase |
|------|----------|-------|
| **신규**: `extension/src/services/cliDetector.ts` | CLI 존재 감지 | 1 |
| **신규**: `extension/src/services/cliExecutor.ts` | CLI 프로세스 실행 | 2 |
| **신규**: `extension/src/services/promptBuilder.ts` | System Prompt 조합 | 2 |
| **신규**: `extension/src/services/agentStructureParser.ts` | JSON 파싱 + 검증 | 2 |
| **신규**: `extension/src/services/promptHistory.ts` | 이력 CRUD | 4 |
| **신규**: `webview-ui/src/panels/PromptPanel.tsx` | 프롬프트 입력 UI | 1 |
| **신규**: `webview-ui/src/panels/AgentPreviewModal.tsx` | 생성 결과 미리보기 | 3 |
| `extension/src/messages/protocol.ts` | 신규 메시지 6종 추가 | 1, 2, 3, 4 |
| `webview-ui/src/messaging/protocol.ts` | 동기화 | 1, 2, 3, 4 |
| `extension/src/extension.ts` | handleMessage 케이스 6개 + applyGeneratedStructure | 1, 2, 3 |
| `webview-ui/src/panels/RightPanel.tsx` | "AI Prompt" 탭 추가 또는 분리 | 1 |
| `webview-ui/src/App.tsx` | PromptPanel/AgentPreviewModal 통합 | 1, 3 |
| `webview-ui/src/styles.css` | PromptPanel + AgentPreviewModal 스타일 | 1, 3 |
| `package.json` | contributes.configuration 설정 추가 | 1 |

---

## 13. 추천 프롬프트 템플릿

첫 사용자를 위해 예시 프롬프트 템플릿을 제공한다.

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
