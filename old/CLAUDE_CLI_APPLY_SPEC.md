# AgentCanvas — Claude Code CLI 기능 적용 명세

> 원본: `coder resource/cluade_summary.md` (Claude Code CLI 기능 요약)
> 작성일: 2026-02-20
> 목적: Claude Code CLI의 기능 중 AgentCanvas 시스템에 실제로 적용 가능한 항목을 추출하여 구체적인 구현 방향으로 정리

---

## 적용 우선순위 요약

| 순위 | 기능 | 적용 영역 | 상태 |
|------|------|-----------|------|
| 🔴 P0 | Headless 모드 (`-p` + `--output-format stream-json`) | `cliExecutor.ts` 스트리밍 + 토큰 파싱 | 미적용 |
| 🔴 P0 | 예산/턴 제한 (`--max-turns`, `--max-budget-usd`) | Agent 실행 설정 UI | 미적용 |
| 🟠 P1 | **모델 목록 동적 조회** (`/model` PTY) | `backendModelPoller.ts` → 드롭다운 자동 갱신 | 미적용 |
| 🟠 P1 | 시스템 프롬프트 주입 (`--append-system-prompt`) | Agent 시스템 프롬프트 → CLI 플래그 매핑 | 미적용 |
| 🟠 P1 | 권한 모드 (`--permission-mode`) | Agent 실행 안전 설정 | 미적용 |
| 🟠 P1 | Hooks (`PreToolUse`, `PostToolUse`) | Worker 에이전트 격리 패턴 | 미적용 |
| 🟡 P2 | Skills 포맷 (`.claude/skills/<name>/SKILL.md`) | AgentCanvas Skill 생성 구조 정렬 | 부분 |
| 🟡 P2 | Subagents (`.claude/agents/<name>.md`) | AgentProfile → claude agent 파일 변환 | 미적용 |
| 🟡 P2 | 세션 이어가기 (`--continue`, `--resume`) | Agent 실행 세션 재사용 | 미적용 |
| 🟢 P3 | Git Worktree (`-w`) | Agent 격리 실행 환경 | 미적용 |
| 🟢 P3 | CLAUDE.md | 에이전트별 컨텍스트 파일 자동 생성 | 미적용 |
| 🟢 P3 | MCP 범위 (`--scope project`) | MCP 설정 공유 방식 | 부분 |

---

## 1. Headless 모드 — CLI 실행 출력 구조화

**출처**: `cluade_summary.md §3`

### 현재 문제

`extension/src/services/cliExecutor.ts`에서 Claude Code를 실행할 때 stdout을 단순 문자열로 수집.
- BUG-3(사용량 0)의 근본 원인: 토큰/비용 정보를 JSON으로 파싱하지 않음
- FEAT-6(터미널 스타일 Chat)의 전제: 스트리밍 청크가 구조화된 형태로 와야 함

### 적용할 Claude Code CLI 플래그

```bash
# 구조화 JSON 출력 (단발 쿼리)
claude -p "..." --output-format json

# 스트리밍 (실시간 처리, Chat에 적합)
claude -p "..." --output-format stream-json --include-partial-messages
```

### 구현 방향

**파일**: `extension/src/services/cliExecutor.ts`

```ts
// BEFORE: 단순 stdout 수집
const result = await exec(`claude -p "${prompt}"`);

// AFTER: stream-json 파싱
const proc = spawn("claude", [
  "-p", prompt,
  "--output-format", "stream-json",
  "--include-partial-messages",
  "--model", modelId,
]);

proc.stdout.on("data", (chunk) => {
  const lines = chunk.toString().split("\n").filter(Boolean);
  for (const line of lines) {
    const msg = JSON.parse(line);
    if (msg.type === "assistant") {
      // 스트리밍 청크 → CHAT_STREAM_CHUNK 이벤트 발행
      panel.webview.postMessage({ type: "CHAT_STREAM_CHUNK", payload: msg });
    }
    if (msg.type === "result") {
      // 완료 + usage 정보 추출
      backendUsageTracker.recordCall(backendId, {
        inputTokens: msg.usage?.input_tokens ?? 0,
        outputTokens: msg.usage?.output_tokens ?? 0,
        cost: msg.cost_usd ?? 0,
      });
    }
  }
});
```

**연관 버그**: BUG-2 (메시지 미표시), BUG-3 (사용량 0)
**연관 기능**: FEAT-6 (터미널 스타일 스트리밍)

---

## 2. 예산 / 턴 제한 — Agent 실행 제어

**출처**: `cluade_summary.md §3`

### 적용 내용

```bash
claude -p "..." --max-turns 3 --max-budget-usd 5.00
```

### 구현 방향

**`webview-ui/src/messaging/protocol.ts`에 필드 추가**:

```ts
export type AgentRuntime = {
  kind: "cli";
  backendId: CliBackendId;
  modelId?: string;
  maxTurns?: number;        // 추가 — claude --max-turns
  maxBudgetUsd?: number;    // 추가 — claude --max-budget-usd
};
```

**`AgentCreationModal.tsx` / `AgentPreviewModal.tsx`**:
- "Max Turns" 숫자 입력 필드 추가
- "Budget (USD)" 숫자 입력 필드 추가

**`cliExecutor.ts` 실행 시**:

```ts
const args = ["-p", prompt, "--model", modelId];
if (runtime.maxTurns) args.push("--max-turns", String(runtime.maxTurns));
if (runtime.maxBudgetUsd) args.push("--max-budget-usd", String(runtime.maxBudgetUsd));
```

**BUG-3 연관**: `BuildPromptBar` 사용량 섹션에 "Budget 설정 없음" / "Budget: $5.00 한도" 표시 가능

---

## 3. 시스템 프롬프트 주입 — AgentProfile.systemPrompt → CLI 플래그

**출처**: `cluade_summary.md §4`

### 현재 상태

`AgentProfile.systemPrompt` 필드가 있으나 실제 CLI 실행 시 `--append-system-prompt`로 전달되는지 불확실.

### 적용 내용

```bash
# 기본 Claude Code 프롬프트를 유지하면서 추가 (권장)
claude -p "..." --append-system-prompt "너는 TypeScript 전문가야. 항상 타입을 명시해."

# 완전 교체 (강하게 제어할 때)
claude -p "..." --system-prompt "..."
```

### 구현 방향

**`cliExecutor.ts`**:

```ts
// systemPrompt가 있으면 --append-system-prompt 플래그로 전달
if (agent.systemPrompt) {
  args.push("--append-system-prompt", agent.systemPrompt);
}
```

**주의**: 시스템 프롬프트에 줄바꿈/특수문자가 있을 때는 임시 파일 방식 사용:

```bash
claude -p "..." --system-prompt-file /tmp/agent-prompt-abc123.txt
```

**`AgentProfile`에 `promptMode` 필드 추가 고려**:

```ts
promptMode?: "append" | "replace";  // 기본값: "append"
```

---

## 4. 권한 모드 — Worker 에이전트 안전 실행

**출처**: `cluade_summary.md §5`

### 배경

AgentCanvas에서 Worker 에이전트는 Orchestrator의 지시를 수행.
Worker가 임의로 파일을 수정하거나 명령을 실행하는 것을 제한해야 할 수 있음.

### 적용 내용

```bash
# 읽기/계획 중심 — Worker의 "분석" 역할에 적합
claude -p "..." --permission-mode plan

# 특정 도구만 허용
claude -p "..." --allowedTools "Read" "Glob" "Grep"

# 완전 허용 (Orchestrator 또는 신뢰 환경)
claude -p "..." --dangerously-skip-permissions
```

### 구현 방향

**`AgentRuntime`에 필드 추가**:

```ts
permissionMode?: "default" | "plan" | "skip";
allowedTools?: string[];   // ["Read", "Glob", "Bash(git log *)"]
```

**`AgentCreationModal.tsx`**:
- "Permission Mode" 드롭다운: `default` / `plan` / `bypass`
- "Allowed Tools" 체크리스트 또는 텍스트 입력

**`cliExecutor.ts`**:

```ts
if (runtime.permissionMode === "plan") {
  args.push("--permission-mode", "plan");
} else if (runtime.permissionMode === "skip") {
  args.push("--dangerously-skip-permissions");
}
if (runtime.allowedTools?.length) {
  args.push("--allowedTools", ...runtime.allowedTools);
}
```

---

## 5. Hooks — Worker 에이전트 쓰기 격리 패턴

**출처**: `cluade_summary.md §9`

### 핵심 아이디어

> "오케스트레이터만 메인 수정, 워커는 proposal만"

- **Worker**: `PreToolUse` hook으로 `Edit/Write` 차단 → 워커는 분석/proposal 파일만 생성
- **Orchestrator**: `PostToolUse` hook에서 워커 결과 검토 후 적용

### AgentCanvas 적용 전략

**방법 A — 에이전트 실행 시 `.claude/settings.json` 동적 주입**:

`cliExecutor.ts`가 에이전트별로 임시 `.claude/settings.json` 생성:

```ts
// Worker 에이전트용 settings.json
const workerSettings = {
  hooks: {
    PreToolUse: [{
      matcher: "Edit|Write",
      hooks: [{
        type: "command",
        command: `echo "Worker cannot modify files directly" >&2 && exit 2`
      }]
    }]
  }
};

// 에이전트 실행 디렉토리에 주입
await fs.writeFile(
  path.join(workDir, ".claude/settings.json"),
  JSON.stringify(workerSettings)
);
```

**방법 B — `AgentProfile.hooks` 필드로 UI에서 설정**:

```ts
export type AgentHookConfig = {
  blockFileWrites?: boolean;     // Worker 격리
  autoFormatAfterEdit?: boolean; // Prettier 자동 실행
  notifyOnStop?: boolean;        // 완료 알림
};
```

**`AgentCreationModal.tsx`**:
- "Worker Mode (파일 쓰기 차단)" 토글
- Orchestrator일 때는 비활성화

---

## 6. Skills 포맷 정렬 — AgentCanvas Skill ↔ Claude Code Skill

**출처**: `cluade_summary.md §8`

### Claude Code Skills 구조

```
~/.claude/skills/<skill-name>/SKILL.md
```

```md
---
name: explain-code
description: Explains code with visual diagrams and analogies.
---

When explaining code, always include:
1) Start with an analogy
2) Draw an ASCII diagram
```

### 현재 AgentCanvas Skill 구조

AgentCanvas의 Skill은 `SkillProfile` 타입으로 VSCode extension 내부에 관리됨.
Claude Code CLI에서 `/skill-name`으로 호출 가능한 슬래시 커맨드와 분리되어 있음.

### 적용 방향

**Skill 저장 시 Claude Code 호환 포맷 병행 생성**:

```ts
// SkillWizardModal에서 Skill 저장 시
// 1) AgentCanvas 내부 포맷 저장 (기존)
// 2) Claude Code 호환 파일 생성 (추가)
const skillDir = path.join(workspaceRoot, ".claude", "skills", skill.name);
await fs.mkdir(skillDir, { recursive: true });
await fs.writeFile(
  path.join(skillDir, "SKILL.md"),
  `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.systemPrompt}`
);
```

이를 통해 AgentCanvas에서 만든 Skill을 CLI에서도 `/skill-name`으로 호출 가능.

**`+Skill 버튼` (FEAT-8) 구현 시 반드시 포함**.

---

## 7. Subagents 포맷 — AgentProfile → Claude Code Agent 파일 변환

**출처**: `cluade_summary.md §10`

### Claude Code Subagent 구조

```
.claude/agents/<name>.md
```

```md
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. Provide specific, actionable feedback.
```

### 적용 방향

**AgentCanvas에서 팀을 Apply할 때 `.claude/agents/` 폴더에도 export 옵션 추가**:

```ts
// APPLY_GENERATED_STRUCTURE 처리 시
for (const agent of structure.agents) {
  const agentMd = `---
name: ${agent.name}
description: ${agent.role}
tools: ${agent.allowedTools?.join(", ") ?? "Read, Bash, Edit"}
model: ${agent.preferredModel ?? "sonnet"}
---

${agent.systemPrompt ?? ""}`;

  await fs.writeFile(
    path.join(workspaceRoot, ".claude", "agents", `${agent.name}.md`),
    agentMd
  );
}
```

**효과**:
- AgentCanvas에서 설계한 팀을 Claude Code CLI에서도 `--agents` 플래그나 `/agents` 명령으로 재사용 가능
- 멀티-에이전트 워크플로우를 CLI 환경에서도 동일하게 실행 가능

---

## 8. 세션 관리 — Agent 실행 세션 연속성

**출처**: `cluade_summary.md §2`

### Claude Code CLI 세션 기능

```bash
claude -c                   # 최근 세션 이어가기
claude --resume "session-id"  # 특정 세션 재개
claude -r "session-name" "추가 지시"  # 이름으로 재개 + 프롬프트
```

### 적용 방향

**`AgentRuntime`에 세션 ID 추적 추가**:

```ts
export type AgentRuntime = {
  ...
  sessionId?: string;    // claude --resume <id>로 이어갈 때
  sessionName?: string;  // claude /rename <name> 후 저장
};
```

**`cliExecutor.ts`**:

```ts
// 세션 ID가 있으면 이어가기
if (runtime.sessionId) {
  args.push("--resume", runtime.sessionId);
} else {
  args.push("-c");  // 최근 세션 이어가기 (선택사항)
}
```

**Agent Inspector UI**:
- "Last Session ID" 표시 (읽기 전용)
- "세션 초기화" 버튼 → sessionId 제거 → 새 세션 시작

---

## 9. Git Worktree — Agent 격리 실행 환경

**출처**: `cluade_summary.md §6`

```bash
claude -w feature-auth
# 위치: <repo>/.claude/worktrees/<name>
```

### 적용 방향

AgentCanvas에서 여러 에이전트가 동시에 같은 파일을 수정하는 충돌 방지.

**`AgentProfile.runtime`에 옵션 추가**:

```ts
useWorktree?: boolean;   // 격리 worktree에서 실행
worktreeName?: string;   // 기본값: agent.name
```

**`cliExecutor.ts`**:

```ts
if (runtime.useWorktree) {
  const name = runtime.worktreeName ?? agent.name;
  args.push("-w", name);
}
```

**Orchestrator는 메인 브랜치, Worker들은 각자 worktree에서 실행**하면 파일 충돌 없이 병렬 작업 가능.

---

## 10. CLAUDE.md — 에이전트 컨텍스트 자동 생성

**출처**: `cluade_summary.md §7`

### Claude Code CLAUDE.md 역할

Claude가 세션 시작할 때 자동으로 읽는 규칙 파일.
- `~/.claude/CLAUDE.md`: 전역 공통 규칙
- `./CLAUDE.md`: 프로젝트별 규칙 (팀과 공유)

### 적용 방향

**팀 Apply 시 CLAUDE.md 자동 생성/업데이트**:

```ts
const claudeMd = `# AgentCanvas Team: ${teamName}

## Team Structure
${agents.map((a) => `- **${a.name}** (${a.role}): ${a.description}`).join("\n")}

## Orchestrator
- ${orchestrator.name} runs on ${orchestrator.runtime?.backendId ?? "claude"}

## Rules
- Agents communicate via structured proposals
- Worker agents should not modify files directly
- All changes must be approved by orchestrator

See @.agentcanvas/team.json for full agent profiles
`;

await fs.writeFile(
  path.join(workspaceRoot, "CLAUDE.md"),
  claudeMd
);
```

**효과**: CLI에서 `claude`를 실행하면 팀 구조와 규칙을 자동으로 인식.

---

## 11. /status Usage % — 구독 쿼터 자동 조회 + 백엔드 부하 분산

**출처**: `cluade_summary.md §코드 섹션` + 실측 스크린샷 (2026-02-20)

### 왜 % 데이터가 반드시 필요한가

AgentCanvas가 멀티-백엔드(Claude / Codex / Gemini)를 운영할 때,
**각 백엔드의 남은 구독 쿼터 %를 알아야** 작업 배분이 가능:

```
Claude  세션 32% 사용 → 잔여 68%   ← 무거운 작업 가능
Codex   API 키 기반   → 잔여 무제한  ← 백업 가능
Gemini  주간 50% 사용 → 잔여 50%   ← 중간 작업 가능

→ Orchestrator 지시: 이번 빌드는 Claude 50% + Gemini 50%로 분산
→ Claude가 세션 90% 초과 시 자동으로 Codex로 전환
```

### 실측: `/status` → `→→` (Usage 탭)으로 확인 가능한 정보

```
Current session         ████████████░░░░  32% used   (Resets 12:59am)
Current week (all)      ████████████████  50% used   (Resets Feb 23, 2:59pm)
Current week (Sonnet)   █░░░░░░░░░░░░░░░   3% used   (Resets Feb 24, 11pm)
Extra usage             Extra usage not enabled
```

> 진입 방법: REPL에서 `/status` 입력 → `→` 또는 `Tab` 키로 Usage 탭 이동

### 자동 조회 방법 — node-pty PTY 자동화

`/status` TUI는 대화형이지만, `node-pty`(VSCode Extension이 이미 사용하는 패키지)로
PTY(가상 터미널)를 생성해 자동으로 명령을 보내고 출력을 파싱할 수 있음.

**`extension/src/services/claudeQuotaPoller.ts` (신규 파일)**:

```ts
import * as pty from "node-pty";

export interface ClaudeQuotaSnapshot {
  sessionUsedPct: number;       // 0~100
  weekAllUsedPct: number;
  weekSonnetUsedPct: number;
  sessionResetsAt: string;      // "12:59am"
  weekResetsAt: string;         // "Feb 23, 2:59pm"
  fetchedAt: number;            // Date.now()
}

export async function fetchClaudeQuota(): Promise<ClaudeQuotaSnapshot> {
  return new Promise((resolve, reject) => {
    const proc = pty.spawn("claude", [], {
      name: "xterm-color",
      cols: 120,
      rows: 30,
      env: { ...process.env, TERM: "xterm-256color" },
    });

    let output = "";
    let step = 0;

    proc.onData((data) => {
      output += data;

      // 단계별 자동 입력
      if (step === 0 && output.includes(">")) {
        proc.write("/status\r");
        step = 1;
      } else if (step === 1 && output.includes("Settings")) {
        // Usage 탭으로 이동 (→ → 두 번)
        proc.write("\x1b[C\x1b[C");
        step = 2;
      } else if (step === 2 && output.includes("Current session")) {
        // Usage 탭 렌더링 완료 → 파싱 후 종료
        const snapshot = parseQuotaOutput(output);
        proc.kill();
        resolve(snapshot);
      }
    });

    // 10초 타임아웃
    setTimeout(() => {
      proc.kill();
      reject(new Error("Claude quota fetch timeout"));
    }, 10_000);
  });
}

function parseQuotaOutput(raw: string): ClaudeQuotaSnapshot {
  // ANSI 코드 제거
  const clean = raw.replace(/\x1b\[[0-9;]*m/g, "");

  const sessionMatch = clean.match(/Current session\s+(\d+)%\s+used.*?Resets\s+([^\n]+)/);
  const weekAllMatch = clean.match(/Current week \(all models\)\s+(\d+)%\s+used.*?Resets\s+([^\n]+)/);
  const weekSonnetMatch = clean.match(/Current week \(Sonnet only\)\s+(\d+)%\s+used/);

  return {
    sessionUsedPct: Number(sessionMatch?.[1] ?? 0),
    weekAllUsedPct: Number(weekAllMatch?.[1] ?? 0),
    weekSonnetUsedPct: Number(weekSonnetMatch?.[1] ?? 0),
    sessionResetsAt: sessionMatch?.[2]?.trim() ?? "",
    weekResetsAt: weekAllMatch?.[2]?.trim() ?? "",
    fetchedAt: Date.now(),
  };
}
```

### 쿼터 % → 백엔드 배분 로직

**`extension/src/services/backendAllocator.ts` (신규 파일)**:

```ts
export interface BackendQuota {
  backendId: string;
  remainingPct: number;    // 100 - usedPct
  resetsAt: string;
}

export function selectBackendForTask(
  quotas: BackendQuota[],
  taskWeight: "light" | "medium" | "heavy"
): string {
  const THRESHOLD = { light: 10, medium: 25, heavy: 40 };
  const required = THRESHOLD[taskWeight];

  // 잔여 쿼터가 충분한 백엔드 중 가장 여유로운 것 선택
  const available = quotas
    .filter((q) => q.remainingPct >= required)
    .sort((a, b) => b.remainingPct - a.remainingPct);

  return available[0]?.backendId ?? "codex"; // fallback: API 키 기반
}
```

**팀 빌드 전 / Orchestrator 배정 전에 호출**:

```ts
// AgentCanvas extension이 시작할 때 + 팀 Confirm 전에
const claudeQuota = await fetchClaudeQuota();
const quotas: BackendQuota[] = [
  { backendId: "claude", remainingPct: 100 - claudeQuota.sessionUsedPct, resetsAt: claudeQuota.sessionResetsAt },
  { backendId: "codex",  remainingPct: 100, resetsAt: "API key" },   // 별도 조회
  { backendId: "gemini", remainingPct: 100 - claudeQuota.weekAllUsedPct, resetsAt: claudeQuota.weekResetsAt },
];

const bestBackend = selectBackendForTask(quotas, "heavy");
```

### AgentPreviewModal / BuildPromptBar UI 업데이트

팀 Confirm 시 **실제 쿼터 %를 Progress Bar로 표시**:

```tsx
// AgentPreviewModal의 "Backend usage snapshot" 섹션
<div className="quota-bar">
  <label>Claude 세션 잔여</label>
  <progress value={100 - quota.sessionUsedPct} max={100} />
  <span>{100 - quota.sessionUsedPct}% 남음 (리셋: {quota.sessionResetsAt})</span>
</div>
<div className="quota-bar">
  <label>주간 (전체 모델)</label>
  <progress value={100 - quota.weekAllUsedPct} max={100} />
  <span>{100 - quota.weekAllUsedPct}% 남음</span>
</div>
```

쿼터가 25% 미만이면 `⚠️ 경고` 표시 + 대안 백엔드 추천.

### 폴링 전략

| 시점 | 동작 |
|------|------|
| Extension 활성화 시 | 최초 1회 조회 |
| 팀 Confirm 모달 열릴 때 | 최신 값으로 갱신 |
| 세션 리셋 시각 도래 시 | 자동 갱신 (sessionResetsAt 파싱하여 setTimeout) |
| 수동 새로고침 버튼 | BuildPromptBar / AgentPreviewModal에 🔄 버튼 |
| 캐시 TTL | 5분 (5분 이내 재호출 시 캐시 반환) |

### 연관 파일

| 파일 (신규/수정) | 역할 |
|----------------|------|
| `extension/src/services/claudeQuotaPoller.ts` | PTY 자동화 + 파싱 (신규) |
| `extension/src/services/backendAllocator.ts` | 쿼터 기반 백엔드 선택 로직 (신규) |
| `extension/src/services/backendUsageTracker.ts` | 개별 호출 토큰/비용 누적 (기존 유지) |
| `webview-ui/src/panels/AgentPreviewModal.tsx` | 쿼터 Progress Bar 표시 (수정) |
| `webview-ui/src/panels/BuildPromptBar.tsx` | 쿼터 요약 + 🔄 버튼 (수정) |
| `webview-ui/src/messaging/protocol.ts` | `BACKEND_QUOTA_UPDATE` 메시지 타입 추가 |

---

## 12. MCP 프로젝트 범위 — 팀 공유 설정

**출처**: `cluade_summary.md §11`

```bash
# --scope project → .mcp.json 파일로 저장 → 팀 공유
claude mcp add --scope project --transport stdio myserver -- npx server
```

### 적용 방향

AgentCanvas에서 MCP 서버를 팀에 등록할 때 `.mcp.json` 파일에 저장하도록:

```ts
// MCP 서버 등록 시 scope 선택 UI 추가
mcpScope?: "local" | "project" | "user";
```

`project` scope면 `.mcp.json`에 저장 → git으로 공유 가능.

---

## 13. 모델 목록 동적 조회 — `/model` PTY 파싱

### 왜 하드코딩이 안 되는가

- `claude --help`의 `--model` 설명: "Provide an alias (e.g. 'sonnet') or full name (e.g. 'claude-sonnet-4-5-20250929')" → **모델 목록 미포함**
- 잘못된 모델 지정 시 에러: "It may not exist or you may not have access to it" → **유효 목록 미출력**
- 새 모델은 수시로 추가/변경됨 → `backendProfiles.ts` 정적 목록은 즉시 낡음

### 방법 — `/model` REPL 명령을 PTY로 자동 파싱

`claude`의 `/model` 명령은 TUI 선택기를 띄워 사용 가능한 모델 목록을 보여줌.
`claudeQuotaPoller.ts`와 동일한 PTY 패턴으로 파싱 가능.

**`extension/src/services/backendModelPoller.ts` (신규 파일)**:

```ts
import * as pty from "node-pty";

export interface BackendModelList {
  backendId: string;
  models: { id: string; label: string; tier?: string }[];
  fetchedAt: number;
}

export async function fetchClaudeModels(): Promise<BackendModelList> {
  return new Promise((resolve, reject) => {
    const proc = pty.spawn("claude", [], {
      name: "xterm-color", cols: 120, rows: 40,
    });

    let output = "";
    let step = 0;

    proc.onData((data) => {
      output += data;

      if (step === 0 && output.includes(">")) {
        proc.write("/model\r");
        step = 1;
      } else if (step === 1 && (output.includes("sonnet") || output.includes("opus") || output.includes("haiku"))) {
        // 모델 선택기 렌더링 완료
        const models = parseModelList(output);
        proc.kill();
        resolve({ backendId: "claude", models, fetchedAt: Date.now() });
      }
    });

    setTimeout(() => { proc.kill(); reject(new Error("Model fetch timeout")); }, 10_000);
  });
}

function parseModelList(raw: string): { id: string; label: string }[] {
  // ANSI 제거 후 claude-* 패턴 추출
  const clean = raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  const matches = clean.match(/claude-[\w.-]+/g) ?? [];
  const unique = [...new Set(matches)];
  return unique.map((id) => ({
    id,
    label: id.replace("claude-", "").replace(/-\d{8}$/, ""), // "sonnet-4-5"
  }));
}
```

### 다른 백엔드 모델 조회

| 백엔드 | 조회 방법 | 비고 |
|--------|---------|------|
| Claude Code | `/model` PTY 파싱 | 위 구현 |
| Codex CLI | `/model` TUI PTY 파싱 | Codex도 동일한 `/model` 명령 있음 |
| Gemini CLI | `gemini models list --json` (CLI 서브커맨드) | 직접 exec 가능, PTY 불필요 |
| Aider | `aider --list-models` | 직접 exec 가능 |

### AgentCanvas UI 연동

- Extension 활성화 시 각 백엔드 모델 목록 조회 (병렬, 5분 캐시)
- `BACKEND_MODELS_UPDATE` 메시지로 webview에 전달
- `AgentCreationModal`, `ChatInput`, `AgentPreviewModal`의 model `<select>` 옵션 동적 교체
- 조회 실패 시 `backendProfiles.ts` 정적 목록을 fallback으로 사용

---

## 구현 로드맵

### Phase 1 — P0 (즉시 적용 필요)

| 항목 | 파일 | 작업 |
|------|------|------|
| stream-json 파싱 | `cliExecutor.ts` | spawn 방식 전환 + 청크 파싱 |
| usage 추출 | `cliExecutor.ts` | `result` 타입에서 `cost_usd`, `usage` 파싱 |
| CHAT_STREAM_CHUNK 발행 | `cliExecutor.ts` → `panel` | 실시간 청크 webview 전송 |

### Phase 2 — P1 (이번 스프린트)

| 항목 | 파일 | 작업 |
|------|------|------|
| **모델 목록 동적 조회** | `backendModelPoller.ts` (신규) | `/model` PTY 파싱 + fallback |
| **구독 쿼터 % 조회** | `claudeQuotaPoller.ts` (신규) | `/status` PTY 파싱 |
| **백엔드 배분** | `backendAllocator.ts` (신규) | 쿼터 기반 최적 백엔드 선택 |
| systemPrompt → `--append-system-prompt` | `cliExecutor.ts` | 플래그 매핑 |
| maxTurns / maxBudgetUsd | `protocol.ts`, `cliExecutor.ts`, `AgentCreationModal.tsx` | 필드 추가 + 플래그 전달 |
| permissionMode / allowedTools | `protocol.ts`, `cliExecutor.ts`, `AgentCreationModal.tsx` | 필드 추가 + 플래그 전달 |

### Phase 3 — P2 (다음 스프린트)

| 항목 | 파일 | 작업 |
|------|------|------|
| Skills → `.claude/skills/` 호환 | `SkillWizardModal.tsx` + extension | SKILL.md 동시 생성 |
| Agents → `.claude/agents/` export | extension `applyGeneratedStructure` | agent .md 파일 생성 |
| Worker hook 격리 | `cliExecutor.ts` | 동적 `.claude/settings.json` 생성 |

### Phase 4 — P3 (향후)

| 항목 | 파일 | 작업 |
|------|------|------|
| 세션 ID 추적 (`--resume`) | `AgentRuntime`, `cliExecutor.ts`, Inspector UI | 세션 연속성 |
| Git worktree 격리 (`-w`) | `AgentRuntime`, `cliExecutor.ts` | 충돌 방지 실행 |
| CLAUDE.md 자동 생성 | extension `applyGeneratedStructure` | 팀 Apply 시 컨텍스트 파일 생성 |
| MCP scope 설정 | MCP 등록 UI | `.mcp.json` 기반 공유 |

---

## 관련 문서

| 문서 | 연관 항목 |
|------|---------|
| `BUG_FIX_SPEC.md` | BUG-2, BUG-3 → 섹션 1 (stream-json) |
| `AGENT_TEAM_BUILD_SPEC.md` | LAYOUT-2 + Subagents export (섹션 7) |
| `CHAT_WORKFLOW_SPEC.md` | FEAT-6 터미널 UI + 스트리밍 (섹션 1) |
| `UI_REVISION_WORKORDER.md` | FEAT-7 (섹션 2, 4) + FEAT-8 (섹션 6) |
| `CODE_REVIEW2.md` | NEW-1~9 이슈 → Phase 1~2 구현 대상 |
| `coder resource/cluade_summary.md` | 원본 Claude Code CLI 기능 문서 |
