# AgentCanvas — Codex CLI 기능 적용 명세

> 원본: `coder resource/codex_cli_terminal_summary.md` (Codex CLI 기능 요약)
> 작성일: 2026-02-20
> 목적: Codex CLI(`@openai/codex`)의 기능 중 AgentCanvas 시스템에 실제로 적용 가능한 항목을 추출하여 구체적인 구현 방향으로 정리
> 참고: Claude Code CLI 적용 명세와 함께 읽을 것 → `CLAUDE_CLI_APPLY_SPEC.md`

---

## Claude Code vs Codex CLI 핵심 차이

| 기능 | Claude Code | Codex CLI |
|------|-------------|-----------|
| 비인터랙티브 실행 | `claude -p "..."` | `codex exec "..."` |
| 구조화 출력 | `--output-format stream-json` | `codex exec --json` (JSONL) |
| 권한 제어 | `--permission-mode plan` | `--ask-for-approval on-request` + `--sandbox` |
| Worker 격리 프리셋 | 없음 (조합 필요) | `--ask-for-approval never --sandbox workspace-write` |
| 완전 자동화 프리셋 | `--dangerously-skip-permissions` | `--full-auto` / `--yolo` |
| 프로젝트 기억 파일 | `CLAUDE.md` | `AGENTS.md` |
| 세션 재개 | `claude --resume <id>` | `codex resume <SESSION_ID>` |
| 원격 실행 | 없음 | `codex cloud exec` + `codex apply` |
| 모델 선택 | `/model` (TUI) | `/model` (TUI) |
| 스크립트 출력 저장 | `--output-format json` | `codex exec -o file.txt` |
| **사용량 단위** | **% used** (세션 + 주간) | **% left** (5h 롤링 + 주간) |
| **모델 티어 한도** | Sonnet only 분리 | gpt-5.3-codex / Spark 분리 |
| **세션 ID 위치** | 별도 조회 필요 | `/status`에 직접 표시 |
| **현재 모델 (실측)** | claude-sonnet-4-5 등 | `gpt-5.3-codex` (v0.104.0 기준) |

---

## 적용 우선순위 요약

| 순위 | 기능 | 적용 영역 | 상태 |
|------|------|-----------|------|
| 🔴 P0 | `codex exec --json` (JSONL 스트리밍) | `cliExecutor.ts` Codex 실행 경로 | 미적용 |
| 🔴 P0 | `--ask-for-approval` + `--sandbox` 정책 | Agent 권한 설정 → CLI 플래그 매핑 | 미적용 |
| 🟠 P1 | **`/status` PTY 파싱** — 5h/주간 % left + 세션 ID | `codexQuotaPoller.ts` (신규) | 미적용 |
| 🟠 P1 | `/model` PTY 파싱 — 모델 목록 동적 조회 | `backendModelPoller.ts` Codex 경로 | 미적용 |
| 🟠 P1 | `codex resume <SESSION_ID>` 세션 재개 | `/status`에서 UUID 자동 추출 → resume | 미적용 |
| 🟠 P1 | `AGENTS.md` 자동 생성 | 팀 Apply 시 Codex 컨텍스트 파일 생성 | 미적용 |
| 🟡 P2 | `--image` 멀티모달 입력 | 에이전트에 이미지/스크린샷 전달 | 미적용 |
| 🟡 P2 | `--search` 웹 검색 | 에이전트 능력 플래그 | 미적용 |
| 🟡 P2 | `codex exec --output-schema` | 구조화 응답 강제 | 미적용 |
| 🟡 P2 | `codex mcp add` | MCP 서버 등록 UI 통합 | 부분 |
| 🟢 P3 | `codex cloud exec` + `codex apply` | 원격 에이전트 실행 | 미적용 |
| 🟢 P3 | `codex fork` 세션 분기 | 실험적 agent 브랜칭 | 미적용 |
| 🟢 P3 | `/skills` Codex 스킬 | AgentCanvas Skill과 호환 | 미적용 |

---

## 1. exec 모드 + JSONL 출력 — Codex 실행 핵심

**출처**: `codex_cli_terminal_summary.md §4, §13`

### 현재 문제

AgentCanvas의 `cliExecutor.ts`가 Codex를 실행할 때 아마도 `codex "..."` (TUI) 형태를 쓰거나
stdout을 단순 문자열로 수집하고 있을 가능성이 높음.

### Codex 비인터랙티브 실행 방법

```bash
# 기본 exec (비인터랙티브)
codex exec "테스트 깨지는 원인 찾아서 고쳐줘"

# 단축 별칭
codex e "README에 사용법 추가해줘"

# stdin 파이프라인
echo "현재 디렉토리 구조를 요약해줘" | codex exec -

# JSONL 이벤트 출력 (Claude Code의 stream-json에 해당)
codex exec --json "변경 사항을 단계별 이벤트로 보고해줘"

# 마지막 메시지를 파일로 저장
codex exec -o result.txt "방금 수정한 내용 요약해줘"

# 구조화 JSON 출력 강제
codex exec --output-schema schema.json "결과를 JSON으로만 출력해줘"
```

### cliExecutor.ts Codex 실행 경로 구현

**Claude Code와 Codex 실행 인터페이스 통일**:

```ts
// cliExecutor.ts — Codex 경로
function buildCodexArgs(prompt: string, runtime: AgentRuntime): string[] {
  const args = ["exec"];

  // 비인터랙티브 JSONL 출력
  args.push("--json");

  // 모델 지정
  if (runtime.modelId) args.push("--model", runtime.modelId);

  // 권한/샌드박스 (섹션 2에서 상세)
  args.push(...buildApprovalFlags(runtime));

  // 추가 작업 디렉토리
  if (runtime.additionalDirs?.length) {
    runtime.additionalDirs.forEach((d) => args.push("--add-dir", d));
  }

  // 웹 검색
  if (runtime.enableWebSearch) args.push("--search");

  // 프롬프트 (마지막)
  args.push(prompt);

  return args;
}
```

**JSONL 파싱 (Claude Code stream-json과 유사)**:

```ts
proc.stdout.on("data", (chunk) => {
  const lines = chunk.toString().split("\n").filter(Boolean);
  for (const line of lines) {
    const event = JSON.parse(line);
    switch (event.type) {
      case "message":    // 텍스트 응답 청크
        panel.webview.postMessage({ type: "CHAT_STREAM_CHUNK", payload: event });
        break;
      case "action":     // 파일 수정 / 명령 실행 이벤트
        panel.webview.postMessage({ type: "AGENT_ACTION", payload: event });
        break;
      case "result":     // 완료 (토큰 사용량 포함)
        backendUsageTracker.recordCall("codex", {
          inputTokens: event.usage?.prompt_tokens ?? 0,
          outputTokens: event.usage?.completion_tokens ?? 0,
        });
        break;
    }
  }
});
```

---

## 2. 권한/샌드박스 정책 — Codex Worker 격리

**출처**: `codex_cli_terminal_summary.md §6`

### Codex 권한 모델 (Claude Code와 다름)

Codex는 `--ask-for-approval`(언제 멈출지)과 `--sandbox`(파일/네트워크 범위)를 **조합**해서 사용.

```bash
# 읽기 전용 (분석 Agent에 적합)
codex exec --sandbox read-only "이 코드베이스 구조 분석해줘"

# 작업 디렉토리만 쓰기 (Worker Agent 표준)
codex exec --ask-for-approval on-request --sandbox workspace-write "버그 수정해줘"

# 완전 자동 (Orchestrator 또는 CI 환경)
codex exec --full-auto "lint + 테스트 실패 전부 고쳐줘"

# 완전 허용 (매우 위험 — 격리 환경에서만)
codex exec --yolo "..."
```

### AgentRuntime 매핑

**`protocol.ts`에 Codex 전용 권한 필드 추가**:

```ts
export type CodexApprovalPolicy = "on-request" | "untrusted" | "never";
export type CodexSandboxPolicy = "read-only" | "workspace-write" | "danger-full-access";

export type AgentRuntime = {
  kind: "cli";
  backendId: CliBackendId;
  modelId?: string;
  // Claude Code 권한
  permissionMode?: "default" | "plan" | "skip";
  allowedTools?: string[];
  // Codex 권한 (backendId === "codex"일 때 사용)
  codexApproval?: CodexApprovalPolicy;
  codexSandbox?: CodexSandboxPolicy;
  additionalDirs?: string[];   // --add-dir
};
```

**`cliExecutor.ts` 플래그 생성**:

```ts
function buildApprovalFlags(runtime: AgentRuntime): string[] {
  const flags: string[] = [];
  if (runtime.codexApproval) {
    flags.push("--ask-for-approval", runtime.codexApproval);
  }
  if (runtime.codexSandbox) {
    flags.push("--sandbox", runtime.codexSandbox);
  }
  return flags;
}
```

**AgentCreationModal Codex 권한 UI**:

```tsx
{backendId === "codex" && (
  <>
    <div className="inspector-field">
      <label>승인 정책</label>
      <select value={codexApproval} onChange={(e) => setCodexApproval(e.target.value)}>
        <option value="on-request">요청 시 승인 (기본)</option>
        <option value="untrusted">비신뢰 상황에서 승인</option>
        <option value="never">자동 진행 (CI용)</option>
      </select>
    </div>
    <div className="inspector-field">
      <label>샌드박스</label>
      <select value={codexSandbox} onChange={(e) => setCodexSandbox(e.target.value)}>
        <option value="read-only">읽기 전용 (분석)</option>
        <option value="workspace-write">작업 폴더 쓰기 (표준)</option>
        <option value="danger-full-access">전체 접근 (위험)</option>
      </select>
    </div>
  </>
)}
```

**Agent 역할별 권장 프리셋**:

| Agent 역할 | 권장 설정 |
|-----------|---------|
| Orchestrator | `--full-auto` (팀 전체 제어) |
| Worker (코드 수정) | `on-request` + `workspace-write` |
| Analyst (분석 전용) | `never` + `read-only` |
| CI/자동화 | `never` + `workspace-write` |

---

## 3. 모델 목록 동적 조회 — `/model` PTY 파싱

**출처**: `codex_cli_terminal_summary.md §18 (/model 커맨드)`

### `/model` 명령

Codex TUI에서 `/model` → 모델 + reasoning effort 선택기 표시.
Claude Code와 동일한 PTY 파싱 패턴으로 자동 조회 가능.

**`backendModelPoller.ts`에 Codex 경로 추가**:

```ts
export async function fetchCodexModels(): Promise<BackendModelList> {
  return new Promise((resolve, reject) => {
    const proc = pty.spawn("codex", [], {
      name: "xterm-color", cols: 120, rows: 40,
    });

    let output = "";
    let step = 0;

    proc.onData((data) => {
      output += data;

      if (step === 0 && (output.includes(">") || output.includes("$"))) {
        proc.write("/model\r");
        step = 1;
      } else if (step === 1 && (output.includes("gpt") || output.includes("o3") || output.includes("codex"))) {
        const models = parseCodexModelList(output);
        proc.kill();
        resolve({ backendId: "codex", models, fetchedAt: Date.now() });
      }
    });

    setTimeout(() => { proc.kill(); reject(new Error("Codex model fetch timeout")); }, 10_000);
  });
}

function parseCodexModelList(raw: string): { id: string; label: string }[] {
  const clean = raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  // gpt-*, o3*, o4*, codex-* 패턴 추출 (실측: gpt-5.3-codex, GPT-5.3-Codex-Spark 등)
  const matches = clean.match(/(gpt-[\w.-]+|o[34][\w.-]*|codex-[\w.-]+)/gi) ?? [];
  const unique = [...new Set(matches.map((m) => m.toLowerCase()))];
  return unique.map((id) => ({ id, label: id }));
}

// 참고: /status 출력에서도 현재 모델 확인 가능
// "Model: gpt-5.3-codex (reasoning xhigh, summaries auto)"
// → parseCodexStatus().currentModel = "gpt-5.3-codex"
```

---

## 4. 세션 재개 — `codex resume`

**출처**: `codex_cli_terminal_summary.md §5`

```bash
codex resume --last           # 마지막 세션 이어가기
codex resume <SESSION_ID>     # 특정 세션 재개
codex exec resume --last "남은 작업 마무리"   # exec 모드로 재개 + 프롬프트
codex fork <SESSION_ID>       # 세션 분기 (실험적 시도에 유용)
```

### AgentRuntime 세션 추적

Claude Code와 동일한 `sessionId` 필드 활용:

```ts
// cliExecutor.ts — Codex 실행 시
if (runtime.sessionId) {
  args.splice(1, 0, "resume", runtime.sessionId);
  // codex exec resume <id> "..."
}
```

**에이전트 Inspector UI**: "Last Codex Session" + "Fork" 버튼 추가.
Fork를 클릭하면 현재 세션의 분기점에서 다른 접근을 실험 가능.

---

## 5. AGENTS.md — Codex 프로젝트 기억 파일

**출처**: `codex_cli_terminal_summary.md §16`

```
/init   → 인터랙티브에서 실행 → AGENTS.md 스캐폴드 생성
```

`AGENTS.md`는 Codex의 `CLAUDE.md` 동등 파일. 레포/서브디렉토리별로 둘 수 있음.

### 팀 Apply 시 AGENTS.md 자동 생성

```ts
const agentsMd = `# AgentCanvas Team: ${teamName}

## Codex Agents
${agents.filter(a => a.runtime?.backendId === "codex").map((a) =>
  `- **${a.name}** (${a.role}): ${a.description}`
).join("\n")}

## Approval Policy
All worker agents operate with sandbox: workspace-write.
Orchestrator may use --full-auto.

## Working Directory Scope
Primary workspace + any --add-dir paths configured per agent.

See @.agentcanvas/team.json for full agent profiles.
`;

await fs.writeFile(path.join(workspaceRoot, "AGENTS.md"), agentsMd);
```

**CLAUDE.md vs AGENTS.md 공존 전략**:
- 팀에 Claude Code 에이전트가 있으면 → `CLAUDE.md` 생성
- 팀에 Codex 에이전트가 있으면 → `AGENTS.md` 생성
- 둘 다 있으면 → 두 파일 모두 생성 (서로 `@AGENTS.md` / `@CLAUDE.md`로 참조)

---

## 6. 이미지 입력 — 멀티모달 에이전트

**출처**: `codex_cli_terminal_summary.md §9`

```bash
codex -i screenshot.png "이 에러 로그를 분석하고 해결책 제시해줘"
codex --image img1.png,img2.jpg "두 다이어그램 차이를 요약해줘"
```

### AgentCanvas 적용

**멀티모달 태스크 지원**:

```ts
export type ChatMessage = {
  role: "user" | "orchestrator" | "system";
  content: Array<
    | { kind: "text"; text: string }
    | { kind: "image"; path: string }    // 추가
  >;
};
```

**Chat 입력창**에 이미지 첨부 버튼 추가 (Codex 백엔드 선택 시 활성화):

```tsx
{chatBackendId === "codex" && (
  <button onClick={handleImageAttach}>📎 이미지 첨부</button>
)}
```

**cliExecutor.ts Codex 실행 시**:

```ts
const imageArgs = message.content
  .filter((c) => c.kind === "image")
  .flatMap((c) => ["--image", c.path]);
args.push(...imageArgs);
```

---

## 7. 웹 검색 — 에이전트 능력 플래그

**출처**: `codex_cli_terminal_summary.md §8`

```bash
# 단발 live 검색
codex --search "최신 릴리즈 노트 기반으로 업그레이드 방법 알려줘"

# config로 기본값 설정
# ~/.codex/config.toml
web_search = "live"   # 또는 "disabled"
```

### AgentRuntime에 웹 검색 플래그 추가

```ts
enableWebSearch?: boolean;    // --search 플래그 활성화
```

**AgentCreationModal**에 "웹 검색 허용" 토글 (Codex 백엔드일 때):

- 분석/리서치 에이전트: ON
- 코드 수정 에이전트: OFF (불필요한 외부 참조 방지)

---

## 8. 구조화 출력 스키마 — 에이전트 응답 포맷 강제

**출처**: `codex_cli_terminal_summary.md §13.5`

```bash
codex exec --output-schema schema.json "결과를 JSON으로만 출력해줘"
```

### AgentCanvas Orchestrator 응답 파싱에 활용

팀 빌드 시 Orchestrator에게 구조화된 계획을 요청할 때:

```ts
// 팀 빌드 프롬프트에 JSON Schema 강제
const schema = {
  type: "object",
  properties: {
    agents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          backendId: { type: "string" },
          tasks: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

await fs.writeFile("/tmp/team-schema.json", JSON.stringify(schema));
args.push("--output-schema", "/tmp/team-schema.json");
```

**팀 생성 안정성 개선**: Orchestrator의 응답이 스키마를 벗어나면 재시도.

---

## 9. Codex Cloud + apply — 원격 에이전트 실행

**출처**: `codex_cli_terminal_summary.md §14`

```bash
# 원격 환경에서 태스크 실행
codex cloud exec --env ENV_ID "오픈 이슈 요약하고 우선순위 제안해줘"

# best-of-N: 3번 시도 후 최선 선택
codex cloud exec --env ENV_ID --attempts 3 "같은 작업을 3번 시도하고 가장 좋은 답"

# 태스크 목록 조회
codex cloud list --env ENV_ID --json --limit 20

# 원격 결과 diff를 로컬에 적용
codex apply <TASK_ID>
```

### AgentCanvas 적용 방향 (P3)

로컬 vs 원격 실행 모드를 `AgentRuntime`에 추가:

```ts
executionMode?: "local" | "cloud";   // 기본값: "local"
cloudEnvId?: string;                 // Codex Cloud ENV_ID
cloudAttempts?: number;              // best-of-N (기본: 1)
```

**"Cloud" 토글**이 켜진 에이전트는 `codex cloud exec --env <envId>`로 실행.
결과는 `codex apply <taskId>`로 로컬에 적용.

---

## 10. MCP 연결 — Codex MCP 관리

**출처**: `codex_cli_terminal_summary.md §15`

```bash
# 등록
codex mcp add mytool -- ./my-mcp-server --flag1
codex mcp add myhttp --url https://example.com/mcp

# env 변수 주입
codex mcp add mytool --env KEY=VALUE -- ./server

# 목록
codex mcp list --json

# Codex 자체를 MCP 서버로 실행
codex mcp-server
```

### 주목: `codex mcp-server`

Codex 자체를 MCP 서버로 실행할 수 있음.
AgentCanvas의 Claude Code Orchestrator가 Codex를 MCP 도구로 연결하는 구조 가능:

```
Claude Code (Orchestrator)
  → MCP 연결 → Codex (MCP 서버로 동작)
  → Codex가 코드 수정 작업 처리
  → 결과 반환
```

구현 방향: AgentCanvas에서 "Codex as MCP tool" 옵션 추가 → Claude Orchestrator가 Codex를 직접 도구로 호출 가능.

---

## 11. /skills — Codex 스킬 시스템

**출처**: `codex_cli_terminal_summary.md §18 (/skills 커맨드)`

```
/skills   → use skills to improve how Codex performs specific tasks
```

AgentCanvas의 `SkillProfile` ↔ Codex `/skills` 연동:
- AgentCanvas에서 생성한 Skill을 Codex의 skills 디렉토리에 저장
- Codex 에이전트가 실행 시 해당 skill을 자동으로 참조

Claude Code의 `.claude/skills/` 포맷과 Codex의 skills 포맷이 동일하면 공유 가능.

---

## 12. 사용량 조회 — `/status` 실측 포맷 + PTY 파싱

**출처**: `codex_cli_terminal_summary.md §7.3` + 실측 스크린샷 (2026-02-20)

### 실측: Codex `/status` 출력 포맷

```
╭──────────────────────────────────────────────────────────╮
│  >_ OpenAI Codex (v0.104.0)                              │
│                                                           │
│ Visit https://chatgpt.com/codex/settings/usage           │
│                                                           │
│  Model:      gpt-5.3-codex (reasoning xhigh, summaries auto) │
│  Directory:  ~/Desktop/Open Claw                          │
│  Account:    cksdud985@naver.com (Pro)                    │
│  Session:    019c7a1b-30cc-7dc3-b8e1-cb124acc38d0         │
│                                                           │
│  5h limit:     [███████████████████░] 97% left (resets 01:18) │
│  Weekly limit: [████████████████████] 99% left (resets 19:42 on 26 Feb) │
│                                                           │
│  GPT-5.3-Codex-Spark limit:                              │
│  5h limit:     [████████████████████] 100% left           │
│  Weekly limit: [████████████████████] 100% left           │
╰──────────────────────────────────────────────────────────╯
```

### Claude Code vs Codex `/status` 비교

| 항목 | Claude Code | Codex |
|------|-------------|-------|
| 단위 | % used (쓴 만큼) | **% left (남은 만큼)** |
| 시간 윈도우 | 세션 + 주간 | **5h 롤링 + 주간** |
| 모델별 분리 한도 | 있음 (Sonnet only) | **있음 (gpt-5.3-codex / Spark 별도)** |
| 세션 ID 직접 표시 | ❌ | **✅ Session: UUID** |
| 계정 정보 | ❌ | **✅ Account + Plan** |

### 핵심 발견

1. **"% left"** — Claude Code는 "% used"이지만 Codex는 반대. 파싱 시 `(100 - pctLeft)` 아니고 그대로 `remainingPct = pctLeft`
2. **5h 롤링 윈도우** — 세션이 아닌 5시간 롤링. 리셋 시각도 다름
3. **모델 티어별 분리 한도** — gpt-5.3-codex (main)과 GPT-5.3-Codex-Spark가 각각 독립 한도 보유
4. **Session ID가 여기 있음** — `codex resume <SESSION_ID>` 재개에 필요한 ID를 `/status`에서 직접 파싱 가능
5. **현재 모델 확인** — `/status`에서 현재 적용 중인 모델명 확인 가능 (`gpt-5.3-codex`)

### PTY 자동 파싱 — `codexQuotaPoller.ts` (신규)

`claudeQuotaPoller.ts`와 동일한 PTY 패턴, 단 파싱 정규식이 다름:

```ts
import * as pty from "node-pty";

export interface CodexQuotaSnapshot {
  // 메인 모델 (gpt-5.3-codex 등)
  main5hLeftPct: number;        // "97% left"
  mainWeeklyLeftPct: number;
  main5hResetsAt: string;       // "01:18"
  mainWeeklyResetsAt: string;   // "19:42 on 26 Feb"
  // Spark 티어 (별도)
  spark5hLeftPct: number;
  sparkWeeklyLeftPct: number;
  // 기타
  currentModel: string;         // "gpt-5.3-codex"
  sessionId: string;            // UUID — resume에 활용
  accountEmail: string;
  fetchedAt: number;
}

export async function fetchCodexQuota(): Promise<CodexQuotaSnapshot> {
  return new Promise((resolve, reject) => {
    const proc = pty.spawn("codex", [], {
      name: "xterm-color", cols: 120, rows: 30,
    });

    let output = "";
    let step = 0;

    proc.onData((data) => {
      output += data;

      if (step === 0 && (output.includes(">") || output.includes("$"))) {
        proc.write("/status\r");
        step = 1;
      } else if (step === 1 && output.includes("5h limit")) {
        // status 렌더링 완료
        const snapshot = parseCodexStatus(output);
        proc.kill();
        resolve(snapshot);
      }
    });

    setTimeout(() => { proc.kill(); reject(new Error("Codex status timeout")); }, 10_000);
  });
}

function parseCodexStatus(raw: string): CodexQuotaSnapshot {
  const clean = raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/[█░│╭╰]/g, "");

  // "97% left (resets 01:18)"
  const main5h     = clean.match(/5h limit[^%]*(\d+)%\s+left.*?resets\s+([^)\n]+)/);
  const mainWeekly = clean.match(/Weekly limit[^%]*(\d+)%\s+left.*?resets\s+([^)\n]+)/);

  // Spark 섹션 (두 번째 등장하는 5h/Weekly)
  const spark5h     = [...clean.matchAll(/5h limit[^%]*(\d+)%\s+left/g)][1];
  const sparkWeekly = [...clean.matchAll(/Weekly limit[^%]*(\d+)%\s+left/g)][1];

  return {
    main5hLeftPct:        Number(main5h?.[1] ?? 100),
    mainWeeklyLeftPct:    Number(mainWeekly?.[1] ?? 100),
    main5hResetsAt:       main5h?.[2]?.trim() ?? "",
    mainWeeklyResetsAt:   mainWeekly?.[2]?.trim() ?? "",
    spark5hLeftPct:       Number(spark5h?.[1] ?? 100),
    sparkWeeklyLeftPct:   Number(sparkWeekly?.[1] ?? 100),
    currentModel:  clean.match(/Model:\s+([^\n(]+)/)?.[1]?.trim() ?? "",
    sessionId:     clean.match(/Session:\s+([\w-]{36})/)?.[1] ?? "",
    accountEmail:  clean.match(/Account:\s+(\S+)/)?.[1] ?? "",
    fetchedAt: Date.now(),
  };
}
```

### backendAllocator.ts Codex 쿼터 통합

`CLAUDE_CLI_APPLY_SPEC.md §11`의 `BackendQuota` 타입에 Codex 쿼터 연결:

```ts
const codexQuota = await fetchCodexQuota();
const quotas: BackendQuota[] = [
  // Claude: 세션 남은 % (100 - usedPct)
  { backendId: "claude", remainingPct: 100 - claudeQuota.sessionUsedPct, resetsAt: claudeQuota.sessionResetsAt },
  // Codex: 5h 윈도우 남은 % (이미 % left)
  { backendId: "codex",  remainingPct: codexQuota.main5hLeftPct, resetsAt: codexQuota.main5hResetsAt },
  // Gemini: 별도 조회
  { backendId: "gemini", remainingPct: geminiQuota.remainingPct, resetsAt: geminiQuota.resetsAt },
];
```

### AgentPreviewModal Codex 쿼터 표시

```tsx
// Codex 5h 롤링 윈도우 표시
<div className="quota-bar">
  <label>Codex 5h 잔여</label>
  <progress value={codexQuota.main5hLeftPct} max={100} />
  <span>{codexQuota.main5hLeftPct}% 남음 (리셋: {codexQuota.main5hResetsAt})</span>
</div>
<div className="quota-bar">
  <label>Codex 주간 잔여</label>
  <progress value={codexQuota.mainWeeklyLeftPct} max={100} />
  <span>{codexQuota.mainWeeklyLeftPct}% 남음 (리셋: {codexQuota.mainWeeklyResetsAt})</span>
</div>
```

### Session ID 자동 추출 → resume 활용

`/status` 파싱으로 얻은 `sessionId`를 `AgentRuntime.sessionId`에 자동 저장:

```ts
// 에이전트 실행 후 status 조회 → 세션 ID 추출
const status = await fetchCodexQuota();
if (status.sessionId) {
  await updateAgentRuntime(agent.id, { sessionId: status.sessionId });
}
// 다음 실행 시 자동으로 resume
```

---

## 구현 로드맵

### Phase 1 — P0 (즉시 적용)

| 항목 | 파일 | 작업 |
|------|------|------|
| `codex exec --json` 경로 구현 | `cliExecutor.ts` | Codex 분기 + JSONL 파싱 |
| `--ask-for-approval` + `--sandbox` 플래그 | `cliExecutor.ts` | `buildApprovalFlags()` 함수 |

### Phase 2 — P1 (이번 스프린트)

| 항목 | 파일 | 작업 |
|------|------|------|
| **Codex `/status` PTY 파싱** | `codexQuotaPoller.ts` (신규) | 5h / 주간 % left + 모델 티어별 분리 파싱 |
| **Session ID 자동 추출** | `codexQuotaPoller.ts` → `AgentRuntime` | `/status`에서 UUID 파싱 → resume 활용 |
| **backendAllocator Codex 연결** | `backendAllocator.ts` | `codex.main5hLeftPct` → `remainingPct` 매핑 |
| Codex `/model` PTY 파싱 | `backendModelPoller.ts` | `fetchCodexModels()` 추가 |
| `codexApproval` / `codexSandbox` UI | `AgentCreationModal.tsx` | Codex 전용 권한 드롭다운 |
| `AGENTS.md` 자동 생성 | extension `applyGeneratedStructure` | Codex 에이전트 있을 때 |

### Phase 3 — P2 (다음 스프린트)

| 항목 | 파일 | 작업 |
|------|------|------|
| 이미지 첨부 | `ChatInput.tsx` + `cliExecutor.ts` | `--image` 플래그 |
| 웹 검색 토글 | `AgentCreationModal.tsx` + `cliExecutor.ts` | `--search` 플래그 |
| 출력 스키마 | 팀 빌드 프롬프트 | `--output-schema` 임시 파일 |

### Phase 4 — P3 (향후)

| 항목 | 파일 | 작업 |
|------|------|------|
| Codex Cloud + apply | `AgentRuntime` + `cliExecutor.ts` | 원격 실행 모드 |
| `codex mcp-server` 통합 | extension MCP 설정 | Codex as MCP tool |
| 세션 Fork | Inspector UI | `codex fork <id>` |

---

## 관련 문서

| 문서 | 연관 항목 |
|------|---------|
| `CLAUDE_CLI_APPLY_SPEC.md` | Claude Code 동등 기능 비교 |
| `BUG_FIX_SPEC.md` | BUG-3 쿼터 조회, BUG-4 backend 동기화 |
| `AGENT_TEAM_BUILD_SPEC.md` | 팀 Apply 시 AGENTS.md 생성 |
| `UI_REVISION_WORKORDER.md` | FEAT-7 (Agent 모달 Codex 권한 UI) |
| `coder resource/codex_cli_terminal_summary.md` | 원본 Codex CLI 기능 문서 |
