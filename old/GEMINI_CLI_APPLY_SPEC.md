# AgentCanvas — Gemini CLI 기능 적용 명세

> 원본: `gemini_cli_terminal_summary.md` + `gemini_cli_key_summary.md` (Gemini CLI 기능 요약)
> 작성일: 2026-02-20
> 목적: Gemini CLI(`@google/gemini-cli`)의 기능 중 AgentCanvas 시스템에 실제로 적용 가능한 항목을 추출하여 구체적인 구현 방향으로 정리
> 참고: Claude Code / Codex CLI 적용 명세와 함께 읽을 것 → `CLAUDE_CLI_APPLY_SPEC.md`, `CODEX_CLI_APPLY_SPEC.md`

---

## Claude Code vs Codex vs Gemini CLI 3-way 핵심 차이

| 기능 | Claude Code | Codex CLI | Gemini CLI |
|------|-------------|-----------|------------|
| 비인터랙티브 실행 | `claude -p "..."` | `codex exec "..."` | `gemini "..."` (non-TTY 자동) |
| 구조화 출력 | `--output-format stream-json` | `codex exec --json` (JSONL) | `--output-format stream-json` / `json` |
| 권한/승인 제어 | `--permission-mode` | `--ask-for-approval` + `--sandbox` | `--approval-mode default/auto_edit/yolo` |
| 샌드박스 격리 | 없음 | `--sandbox` (workspace-write 등) | `--sandbox` (Docker 기반) |
| 프로젝트 기억 파일 | `CLAUDE.md` | `AGENTS.md` | `GEMINI.md` |
| 세션 재개 | `claude --resume <id>` | `codex resume <SESSION_ID>` | `gemini -r <session-id>` |
| 모델 지정 | `/model` (TUI) | `/model` (TUI) | `/model` (TUI) + `--model pro/flash` |
| 모델 alias | 없음 (full id) | 없음 (full id) | `auto`, `pro`, `flash`, `flash-lite` |
| **사용량 조회** | **`/status` → `→→` Usage** | **`/status` (% left)** | **`/stats` (세션 통계)** |
| **사용량 단위** | **% used (세션/주간)** | **% left (5h 롤링/주간)** | **토큰 수 + 요청 수 (추정)** |
| Skill 시스템 | `.claude/skills/<name>/SKILL.md` | `/skills` (TUI) | `.gemini/skills/<name>/SKILL.md` |
| Extension 시스템 | 없음 | 없음 | `gemini-extension.json` 패키지 |
| Hooks | `PreToolUse`, `PostToolUse` | 없음 | `BeforeTool`, `AfterTool` (settings.json) |
| 웹 검색 | 없음 (MCP 통해) | `--search` 플래그 | `google_web_search` 자동 도구 |
| URL 가져오기 | 없음 (MCP 통해) | 없음 | `web_fetch` 자동 도구 |
| Sub-agents | `.claude/agents/<name>.md` | 없음 | `experimental.enableAgents` |
| Plan Mode | 없음 | 없음 | `/plan` REPL 명령 |
| 대화 되돌리기 | 없음 | 없음 | `/rewind`, `/restore` |
| 대화 태그 저장 | 없음 | 없음 | `/chat save/resume` |
| IDE 연동 | VSCode 확장 + MCP | 없음 | VSCode 확장 (네이티브 diff) |
| 인증 방식 | Claude.ai OAuth | OpenAI API key | Google OAuth / API key / Vertex AI |

---

## 적용 우선순위 요약

| 순위 | 기능 | 적용 영역 | 상태 |
|------|------|-----------|------|
| 🔴 P0 | Headless + `--output-format stream-json` | `cliExecutor.ts` Gemini 실행 경로 | 미적용 |
| 🔴 P0 | `--approval-mode` 권한 정책 | Agent 권한 설정 → CLI 플래그 매핑 | 미적용 |
| 🟠 P1 | **`/stats` PTY 파싱** — 세션 토큰/요청 수 → 쿼터 추정 | `geminiQuotaPoller.ts` (신규) | 미적용 |
| 🟠 P1 | `/model` PTY 파싱 — 모델 목록 동적 조회 | `backendModelPoller.ts` Gemini 경로 | 미적용 |
| 🟠 P1 | `GEMINI.md` 자동 생성 | 팀 Apply 시 Gemini 컨텍스트 파일 생성 | 미적용 |
| 🟠 P1 | Plan Mode (`/plan`) → Agent 분석 전용 모드 | AgentProfile "plan-only" 실행 옵션 | 미적용 |
| 🟡 P2 | Skills (`.gemini/skills/`) ↔ AgentCanvas Skill 포맷 정렬 | AgentCanvas Skill → Gemini SKILL.md 변환 | 부분 |
| 🟡 P2 | Sessions (`gemini -r`, `/rewind`, `/chat save`) | AgentRuntime 세션 재사용/되돌리기 | 미적용 |
| 🟡 P2 | Hooks (`BeforeTool`/`AfterTool`) → 워커 에이전트 정책 | settings.json hook 생성 자동화 | 미적용 |
| 🟡 P2 | Google Search + Web Fetch 자동 활성화 | 에이전트 능력 플래그 `enableWebSearch` | 미적용 |
| 🟡 P2 | `--sandbox` Docker 격리 | Worker 에이전트 안전 실행 | 미적용 |
| 🟢 P3 | Extensions (`gemini-extension.json`) | AgentCanvas 플러그인 패키지 구조 참고 | 미적용 |
| 🟢 P3 | MCP 서버 (`settings.json` mcpServers) | MCP 설정 UI 통합 | 부분 |
| 🟢 P3 | Sub-agents (experimental) | 내부 에이전트 계층 구조 | 미적용 |
| 🟢 P3 | IDE 연동 (네이티브 diff) | AgentCanvas = VSCode 확장이므로 이미 내부 | 기존 |

---

## 1. Headless 모드 — Gemini CLI 비인터랙티브 실행

**출처**: `gemini_cli_terminal_summary.md §3, §16`

### 현재 문제

`cliExecutor.ts`에서 Gemini를 실행할 때 인터랙티브 TUI(`gemini`)를 열거나 stdout을 단순 문자열로 수집하고 있을 가능성이 높음.

### Gemini CLI 비인터랙티브 실행 방법

```bash
# 원샷 headless (non-TTY 환경에서 자동 headless)
gemini "이 프로젝트 구조를 설명해줘"

# 파이프 입력
cat error.log | gemini "왜 실패했는지 설명해줘"
git diff | gemini "커밋 메시지 써줘"

# 구조화 JSON 출력 (Claude Code의 --output-format json과 동일 개념)
gemini --output-format json "결과를 JSON으로만 출력해줘"

# 스트리밍 JSON (Claude Code의 stream-json에 해당)
gemini --output-format stream-json "단계별로 설명해줘"
```

### exit code

| 코드 | 의미 |
|------|------|
| `0` | 성공 |
| `1` | 일반 오류/API 실패 |
| `42` | 입력 오류(프롬프트/인자) |
| `53` | 턴 제한 초과 |

### 구현 방향

**파일**: `extension/src/services/cliExecutor.ts` — Gemini 실행 분기 추가

```ts
// Gemini headless 실행 (Claude Code의 spawn 패턴과 동일)
const proc = spawn("gemini", [
  "--output-format", "stream-json",
  "--model", modelAlias,       // pro / flash / flash-lite / auto
  "--approval-mode", approvalMode,
  prompt,
]);

proc.stdout.on("data", (chunk) => {
  const lines = chunk.toString().split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === "assistant" || msg.type === "content") {
        panel.webview.postMessage({ type: "CHAT_STREAM_CHUNK", payload: msg });
      }
      if (msg.type === "result") {
        // 완료 + usage 추출
        backendUsageTracker.recordCall("gemini", {
          inputTokens: msg.usage?.input_tokens ?? 0,
          outputTokens: msg.usage?.output_tokens ?? 0,
        });
      }
    } catch { /* 비-JSON 줄 무시 */ }
  }
});
```

> **핵심**: Claude Code / Codex 모두 `spawn()` 기반 stream-json 파싱으로 전환 중 (BUG-2). Gemini도 동일 패턴 적용.

---

## 2. GEMINI.md — 프로젝트 메모리 파일

**출처**: `gemini_cli_terminal_summary.md §1`, `gemini_cli_key_summary.md Extensions 섹션`

### 개념

`GEMINI.md`는 Claude Code의 `CLAUDE.md`, Codex의 `AGENTS.md`에 해당하는 **리포지토리 단위 영구 지침 파일**.
Gemini CLI는 세션 시작 시 자동으로 이 파일을 컨텍스트로 로드함.

### 파일 탐색 우선순위

| 위치 | 적용 범위 |
|------|-----------|
| `$HOME/.gemini/GEMINI.md` | 전역 (모든 프로젝트) |
| `<project-root>/GEMINI.md` | 프로젝트 단위 |
| 하위 디렉토리의 `GEMINI.md` | 해당 디렉토리 컨텍스트 추가 |

### 세션에서 메모리 관리

```text
/init        → GEMINI.md 생성 도우미
/memory      → GEMINI.md 기반 메모리 확인/편집
```

### 구현 방향 — "팀 Apply 시 자동 생성"

**파일**: `extension/src/services/projectContextWriter.ts` (신규 또는 확장)

```ts
export async function writeGeminiMd(
  projectRoot: string,
  teamConfig: AgentTeamConfig
): Promise<void> {
  const content = `# AgentCanvas 프로젝트 컨텍스트

## 팀 구성
${teamConfig.agents.map((a) => `- **${a.name}** (${a.role}): ${a.systemPrompt}`).join("\n")}

## 실행 정책
- 권한 모드: ${teamConfig.approvalMode}
- 샌드박스: ${teamConfig.sandbox ? "활성화" : "비활성화"}
- 웹 검색: ${teamConfig.enableWebSearch ? "활성화" : "비활성화"}

## 주의사항
이 파일은 AgentCanvas에 의해 자동 생성됩니다. 직접 편집 시 AgentCanvas와 동기화가 깨질 수 있습니다.
`;
  await fs.promises.writeFile(path.join(projectRoot, "GEMINI.md"), content, "utf8");
}
```

### 3종 컨텍스트 파일 통합 관리 전략

```
팀 Apply 버튼 클릭
  ├─ writeClaudeMd()   → CLAUDE.md
  ├─ writeAgentsMd()   → AGENTS.md (Codex용)
  └─ writeGeminiMd()   → GEMINI.md (Gemini용)
```

---

## 3. Plan Mode (`/plan`) — 에이전트 분석 전용 모드

**출처**: `gemini_cli_summary.md §2.1`

### 개념

Gemini CLI 전용 기능. 실제 파일 수정 없이 **"계획만 세우고 사용자 컨펌 대기"** 단계.
Claude Code의 `--permission-mode plan`과 유사하지만, REPL 명령으로 진입한다는 차이.

```bash
# REPL 안에서
/plan "이 리포지토리의 인증 로직을 JWT로 바꿔줘"
```

- `Planning` 단계에서 파일 수정 없이 계획 출력
- 사용자 컨펌 후 실행

### 구현 방향 — AgentProfile에 "분석 전용 실행" 옵션 추가

**파일**: `extension/src/types/agentProfile.ts`

```ts
export interface AgentExecutionOptions {
  approvalMode: "default" | "auto_edit" | "yolo";
  sandbox: boolean;
  planOnly: boolean;   // ← 신규: Plan Mode 진입 여부
  model: GeminiModelAlias;
  enableWebSearch: boolean;
}
```

**파일**: `extension/src/services/cliExecutor.ts` — Gemini 실행 분기

```ts
// Plan Mode: PTY로 세션 열고 /plan 명령 전송
if (opts.planOnly) {
  const proc = pty.spawn("gemini", [], { name: "xterm-color", cols: 120, rows: 30 });
  await waitFor(proc, ">");           // REPL 프롬프트 대기
  proc.write(`/plan "${prompt}"\r`);  // plan 명령 전송
  await collectUntil(proc, "Planning complete"); // 계획 출력 완료 대기
  // 결과를 WebView에 표시, 사용자 "실행" 클릭 시 실제 실행
}
```

> **AgentCanvas UI**: 에이전트 카드에 "분석만" / "실행" 토글 버튼 추가 (LAYOUT-1 관련)

---

## 4. 샌드박스 격리 (`--sandbox`) — Docker 기반 Worker 격리

**출처**: `gemini_cli_summary.md §2.2`, `gemini_cli_terminal_summary.md §8`

### Gemini sandbox vs Codex sandbox 비교

| 항목 | Codex CLI | Gemini CLI |
|------|-----------|------------|
| 격리 기술 | OS-level sandbox (macOS sandbox-exec / Linux namespaces) | Docker 컨테이너 |
| 활성화 | `--sandbox workspace-write` | `--sandbox` |
| 네트워크 차단 | 지원 | Docker 네트워크 정책으로 제어 |
| 전제 조건 | 없음 | Docker 설치 필요 |

### 구현 방향

**파일**: `extension/src/services/cliExecutor.ts`

```ts
function buildGeminiArgs(opts: AgentExecutionOptions): string[] {
  const args: string[] = [];

  // 승인 모드
  args.push("--approval-mode", opts.approvalMode);

  // 샌드박스 (Docker 필요 — 실행 전 Docker 설치 여부 체크)
  if (opts.sandbox) {
    args.push("--sandbox");
  }

  // 모델
  if (opts.model) {
    args.push("--model", opts.model);
  }

  // 프롬프트 (headless)
  args.push(opts.prompt);
  return args;
}
```

**Docker 사전 확인**:

```ts
async function checkDockerAvailable(): Promise<boolean> {
  try {
    await execAsync("docker info --format '{{.ServerVersion}}'");
    return true;
  } catch {
    return false;
  }
}

// sandbox 옵션 선택 시 Docker 없으면 경고
if (opts.sandbox && !(await checkDockerAvailable())) {
  vscode.window.showWarningMessage(
    "Gemini sandbox는 Docker가 필요합니다. Docker를 설치하거나 sandbox를 비활성화하세요."
  );
}
```

---

## 5. Agent Skills — `.gemini/skills/` 포맷 정렬

**출처**: `gemini_cli_terminal_summary.md §12`, `gemini_cli_key_summary.md Skills 섹션`

### Gemini Skill 구조

```
.gemini/skills/<skill-name>/
├── SKILL.md          (필수) 이름, 설명, 지침
├── scripts/          (선택) 실행 스크립트
├── references/       (선택) 참고 문서
└── assets/           (선택) 기타 리소스
```

**SKILL.md 형식 (YAML frontmatter 필수)**:

```markdown
---
name: api-auditor
description: |
  Expertise in auditing and testing API endpoints.
  Use when the user asks to "check", "test", or "audit" a URL or API.
---

# API Auditor Instructions
...
```

### Claude Code Skills vs Gemini Skills 비교

| 항목 | Claude Code (`.claude/skills/`) | Gemini (`.gemini/skills/`) |
|------|-------------------------------|--------------------------|
| 구조 | `SKILL.md` + 자유 파일 | `SKILL.md` + `scripts/references/assets/` |
| YAML frontmatter | `name`, `description` | `name`, `description` |
| 활성화 방식 | 자동 (컨텍스트 주입) | `activate_skill` 도구 자동 호출 |
| 스코프 | workspace / user | workspace > user > extension |
| 설치 명령 | `claude skills install <url>` | `gemini skills install <url>` |

### 구현 방향 — AgentCanvas Skill → Gemini SKILL.md 변환

**파일**: `extension/src/services/skillExporter.ts` (신규)

```ts
export async function exportSkillToGemini(
  skill: AgentCanvasSkill,
  projectRoot: string
): Promise<void> {
  const skillDir = path.join(projectRoot, ".gemini", "skills", skill.name);
  await fs.promises.mkdir(path.join(skillDir, "scripts"), { recursive: true });
  await fs.promises.mkdir(path.join(skillDir, "references"), { recursive: true });

  const skillMdContent = `---
name: ${skill.name}
description: |
  ${skill.description}
---

# ${skill.name}

${skill.instructions}
`;
  await fs.promises.writeFile(path.join(skillDir, "SKILL.md"), skillMdContent, "utf8");
}
```

### Skills 검색 우선순위 (AgentCanvas 적용)

```
1. .gemini/skills/   (워크스페이스) ← AgentCanvas가 자동 생성
2. .agents/skills/   (워크스페이스, 우선순위 더 높음)
3. ~/.gemini/skills/ (사용자 전역)
4. Extension 내 포함된 skills
```

---

## 6. 세션 관리 — Resume / Rewind / Chat 태그

**출처**: `gemini_cli_terminal_summary.md §5`

### 세션 관련 명령 전체

```bash
# 터미널 플래그
gemini -r "latest"                          # 최신 세션 재개
gemini -r "latest" "남은 작업 마무리해줘"    # 재개 + 즉시 쿼리
gemini -r "<session-id>" "계속해줘"          # 특정 세션 재개

# REPL 내 명령
/resume                   # 세션 재개 선택
/rewind                   # 이전 단계로 되감기 (Esc Esc)
/restore                  # 체크포인트 파일 복구
/restore <tool_call_id>   # 특정 tool 실행 직전 상태 복구
/chat save <tag>          # 현재 대화를 태그로 저장
/chat list                # 저장된 대화 목록
/chat resume <tag>        # 저장된 대화 재개
/chat share file.md       # 대화를 md/json으로 내보내기
```

### Claude Code vs Codex vs Gemini 세션 재개 비교

| 항목 | Claude Code | Codex | Gemini |
|------|------------|-------|--------|
| 재개 방법 | `claude --resume <id>` | `codex resume <SESSION_ID>` | `gemini -r <session-id>` |
| 최신 자동 재개 | `claude --continue` | 없음 | `gemini -r "latest"` |
| 세션 ID 위치 | 별도 조회 필요 | `/status`에 직접 표시 | `gemini sessions list` (추정) |
| 대화 되돌리기 | 없음 | 없음 | `/rewind` (Esc Esc) |
| 체크포인트 저장 | 없음 | 없음 | `/chat save <tag>` |

### 구현 방향 — AgentRuntime 세션 추적

**파일**: `extension/src/runtime/agentRuntime.ts`

```ts
export interface GeminiSessionState {
  sessionId: string;          // gemini 세션 ID
  chatTag?: string;           // /chat save로 저장된 태그
  lastResumeFlag: string;     // "latest" | "<session-id>"
}

export class AgentRuntime {
  private geminiSession: GeminiSessionState = {
    sessionId: "",
    lastResumeFlag: "latest",
  };

  // 세션 재개 실행
  resumeGeminiSession(sessionId?: string): void {
    const flag = sessionId ?? "latest";
    this.geminiSession.lastResumeFlag = flag;
    // cliExecutor에 -r 플래그 추가
    this.cliExecutor.setGeminiResumeFlag(flag);
  }

  // 채팅 태그 저장 (PTY로 /chat save <tag> 전송)
  async saveGeminiChatTag(tag: string): Promise<void> {
    await this.ptyController.sendCommand(`/chat save ${tag}\r`);
    this.geminiSession.chatTag = tag;
  }
}
```

---

## 7. Google Search + Web Fetch — 에이전트 웹 능력 활성화

**출처**: `gemini_cli_summary.md §2.5`, `gemini_cli_terminal_summary.md §9`

### Gemini의 웹 능력 (Claude/Codex 대비 차별점)

| 능력 | Claude Code | Codex CLI | Gemini CLI |
|------|------------|-----------|------------|
| 웹 검색 | MCP 서버 필요 | `--search` 플래그 | `google_web_search` 내장 자동 |
| URL 가져오기 | MCP 서버 필요 | 없음 | `web_fetch` 내장 자동 |
| 활성화 방법 | MCP 설정 | 플래그 1개 | 기본 활성화 (추가 설정 불필요) |

```text
# 세션 안에서 자동 사용 (사용자가 명시적으로 요청하지 않아도 모델이 판단)
"최신 React 문서에서 useEffect 변경사항 찾아줘"
→ 자동으로 google_web_search 호출

"이 두 글 차이 비교해줘: https://example.com/a https://example.com/b"
→ 자동으로 web_fetch 두 번 호출
```

### 구현 방향 — AgentProfile에 `enableWebSearch` 플래그 추가

**파일**: `extension/src/types/agentProfile.ts`

```ts
export interface AgentProfile {
  // ... 기존 필드들
  enableWebSearch: boolean;    // Gemini: google_web_search/web_fetch 허용 여부
  webSearchDomainAllowlist?: string[];  // 특정 도메인만 허용 (enterprise 제어)
}
```

**AgentCanvas UI**: 에이전트 카드에 🌐 웹 검색 토글 버튼 추가

---

## 8. MCP 서버 연결 — `settings.json` mcpServers 블록

**출처**: `gemini_cli_terminal_summary.md §11`, `gemini_cli_key_summary.md MCP 섹션`

### MCP 서버 설정 방법 (CLI + settings.json)

```bash
# 터미널에서 직접 추가
gemini mcp add github npx -y @modelcontextprotocol/server-github
gemini mcp add api-server http://localhost:3000 --transport http
gemini mcp add slack node server.js --env SLACK_TOKEN=xoxb-xxx

# Docker 컨테이너 방식 (settings.json)
```

```json
// ~/.gemini/settings.json 또는 .gemini/settings.json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/modelcontextprotocol/servers/github:latest"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  },
  "mcp": {
    "allowed": ["corp-internal-api"],
    "includeTools": ["read_only_access"]
  }
}
```

### MCP 보안 제어 (Enterprise)

```json
{
  "mcp": {
    "allowed": ["corp-internal-api"],           // 허용된 서버만 작동
    "includeTools": ["read_only_access"]         // 위험한 툴 차단
  }
}
```

### 세션 내 MCP 관리

```text
/mcp list       → 연결된 MCP 서버 목록
/mcp desc       → 서버 설명
/mcp schema     → 툴 스키마 확인
/mcp refresh    → 서버 재연결
/mcp auth       → 인증 재설정
```

### 구현 방향 — settings.json 생성 자동화

**파일**: `extension/src/services/geminiSettingsWriter.ts` (신규)

```ts
export async function writeGeminiSettings(
  projectRoot: string,
  mcpServers: McpServerConfig[],
  approvalMode: string
): Promise<void> {
  const settings = {
    mcpServers: Object.fromEntries(
      mcpServers.map((s) => [s.name, {
        command: s.command,
        args: s.args,
        env: s.env,
      }])
    ),
    mcp: {
      allowed: mcpServers.map((s) => s.name),
    },
    // Gemini 설정 레이어 중 project 레이어에 해당
  };
  const settingsPath = path.join(projectRoot, ".gemini", "settings.json");
  await fs.promises.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
}
```

---

## 9. Hooks — 에이전트 루프 정책 끼워넣기

**출처**: `gemini_cli_terminal_summary.md §14`

### Hooks 설정 (settings.json)

```json
{
  "hooks": {
    "BeforeTool": [
      {
        "matcher": "write_file|replace",
        "hooks": [
          {
            "name": "security-check",
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.gemini/hooks/security.sh",
            "timeout": 5000
          }
        ]
      }
    ],
    "AfterTool": [
      {
        "matcher": "run_shell_command",
        "hooks": [
          {
            "name": "output-logger",
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.gemini/hooks/log.sh"
          }
        ]
      }
    ]
  }
}
```

### Claude Code Hooks vs Gemini Hooks 비교

| 항목 | Claude Code | Gemini CLI |
|------|------------|------------|
| Hook 이름 | `PreToolUse`, `PostToolUse` | `BeforeTool`, `AfterTool` |
| 설정 위치 | `settings.json` / `.claude/settings.json` | `settings.json` hooks 블록 |
| matcher 패턴 | 정규식 | 파이프(`|`) 구분 문자열 |
| 환경변수 | `CLAUDE_PROJECT_DIR` 등 | `GEMINI_PROJECT_DIR` |
| 세션 제어 | 없음 | `/hooks panel/enable/disable` |

### 구현 방향 — 워커 에이전트 보안 hook 자동 생성

**파일**: `extension/src/services/geminiSettingsWriter.ts` (§8 확장)

```ts
export function buildGeminiHooks(workerPolicy: WorkerPolicy): GeminiHooksConfig {
  return {
    BeforeTool: [
      {
        matcher: "write_file|replace|run_shell_command",
        hooks: [
          {
            name: "agentcanvas-pre-check",
            type: "command",
            command: "$GEMINI_PROJECT_DIR/.gemini/hooks/pre-check.sh",
            timeout: 3000,
          },
        ],
      },
    ],
    AfterTool: [
      {
        matcher: "*",
        hooks: [
          {
            name: "agentcanvas-logger",
            type: "command",
            command: "$GEMINI_PROJECT_DIR/.gemini/hooks/logger.sh",
          },
        ],
      },
    ],
  };
}
```

---

## 10. 사용량 조회 (`/stats`) → `geminiQuotaPoller.ts`

**출처**: `gemini_cli_terminal_summary.md §17` (`/stats` 슬래시 명령 목록에 포함)

### ⚠️ 주의: Gemini /stats 출력 포맷 미확인

Claude Code(`/status` → Usage 탭)와 Codex(`/status` 직접 % left 표시)는 실측 데이터가 있음.
Gemini의 `/stats`는 **출력 포맷 미확인** — PTY 파싱 로직은 실제 출력 확인 후 정규식 조정 필요.

### 예상 정보 구조 (추정)

Gemini는 구독 티어에 따라 다름:
- **Google AI Pro**: 요청 수/시간 제한 (분당 요청 등)
- **Google AI Ultra**: 더 높은 한도
- **API Key (AI Studio)**: RPM(분당 요청), TPM(분당 토큰) 제한

### `geminiQuotaPoller.ts` 구현 방향 (PTY 기반)

**파일**: `extension/src/services/geminiQuotaPoller.ts` (신규)

```ts
import * as pty from "node-pty";

export interface GeminiQuotaSnapshot {
  // /stats 실제 출력 확인 후 필드 확정 필요
  sessionTokensUsed?: number;       // 현재 세션 사용 토큰
  sessionRequestCount?: number;     // 현재 세션 요청 수
  remainingPct?: number;            // 추정 잔여 % (확인 후 보완)
  model: string;                    // 현재 모델
  timestamp: number;
}

export async function fetchGeminiStats(): Promise<GeminiQuotaSnapshot> {
  return new Promise((resolve, reject) => {
    const proc = pty.spawn("gemini", [], {
      name: "xterm-color",
      cols: 120,
      rows: 30,
      cwd: process.cwd(),
    });

    let buffer = "";
    let step = 0;

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("gemini /stats timeout"));
    }, 15_000);

    proc.onData((data) => {
      buffer += data;
      const clean = buffer.replace(/\x1b\[[0-9;]*m/g, "").replace(/\r/g, "");

      if (step === 0 && clean.includes(">")) {
        // REPL 준비 완료 → /stats 전송
        proc.write("/stats\r");
        step = 1;
      } else if (step === 1 && clean.includes("Session")) {
        // stats 출력 캡처 시작
        // TODO: 실제 /stats 출력 확인 후 정규식 보완
        const tokenMatch = clean.match(/Tokens[:\s]+(\d+)/i);
        const requestMatch = clean.match(/Requests[:\s]+(\d+)/i);
        const modelMatch = clean.match(/Model[:\s]+([^\n(]+)/i);

        clearTimeout(timer);
        proc.kill();

        resolve({
          sessionTokensUsed: tokenMatch ? parseInt(tokenMatch[1]) : undefined,
          sessionRequestCount: requestMatch ? parseInt(requestMatch[1]) : undefined,
          remainingPct: undefined,       // /stats 실측 후 계산식 추가
          model: modelMatch?.[1]?.trim() ?? "unknown",
          timestamp: Date.now(),
        });
      }
    });
  });
}
```

> **액션 아이템**: 실제 Gemini CLI REPL에서 `/stats` 실행 후 출력 내용 공유 필요
> → Claude Code의 `/status` Usage탭 처럼 실측 후 정규식 확정

### `backendAllocator.ts` 통합 (잠정)

```ts
// Gemini remainingPct가 확인되기 전까지는
// sessionTokensUsed 기반 추정치 사용
function geminiRemainingPct(snapshot: GeminiQuotaSnapshot): number {
  if (snapshot.remainingPct !== undefined) return snapshot.remainingPct;
  // 임시: 100,000 토큰 기준 추정
  const TOKEN_LIMIT = 100_000;
  return Math.max(0, 100 - ((snapshot.sessionTokensUsed ?? 0) / TOKEN_LIMIT) * 100);
}
```

---

## 11. 모델 선택 — alias 기반 동적 지정

**출처**: `gemini_cli_terminal_summary.md §7`

### Gemini 모델 alias (Claude/Codex와 차별점)

```bash
gemini --model pro    "이 코드에서 경쟁 조건 찾아줘"
gemini --model flash  "빠르게 요약만"
gemini -m flash-lite  "간단한 질문"
gemini -m auto        "자동 선택 (기본)"
```

| alias | 의미 | 용도 |
|-------|------|------|
| `auto` | 자동 선택 (기본값) | 일반 |
| `pro` | Gemini Pro 계열 | 복잡한 분석/코딩 |
| `flash` | Gemini Flash 계열 | 빠른 응답 |
| `flash-lite` | Gemini Flash Lite | 경량/저비용 |

### `/model` TUI 명령으로 목록 확인

```text
/model   → 모델 선택 TUI picker 표시
```

### Claude Code / Codex / Gemini 모델 조회 방식 비교

| CLI | 모델 조회 방법 | 방식 |
|-----|--------------|------|
| Claude Code | `/model` PTY → TUI picker 파싱 | PTY 필요 |
| Codex | `/model` PTY → TUI picker 파싱 | PTY 필요 |
| **Gemini** | **`--model alias` 직접 지정** / `/model` TUI | **alias 하드코딩 가능** |

### 구현 방향

**파일**: `extension/src/config/geminiModels.ts` (신규)

```ts
// Gemini는 alias 기반이므로 PTY 없이 정적 목록 관리 가능
export const GEMINI_MODEL_ALIASES: GeminiModelDef[] = [
  { alias: "auto",       label: "Auto (기본)",    tier: "standard" },
  { alias: "pro",        label: "Gemini Pro",     tier: "pro"      },
  { alias: "flash",      label: "Gemini Flash",   tier: "standard" },
  { alias: "flash-lite", label: "Gemini Flash Lite", tier: "lite"  },
];

// 동적 갱신이 필요하면 /model PTY 파싱 fallback
export async function fetchGeminiModelsViaPty(): Promise<string[]> {
  // backendModelPoller.ts Gemini 경로 - /model TUI에서 항목 파싱
  // 기본적으로는 위 정적 목록으로 충분
}
```

> Claude Code / Codex와 달리 Gemini는 alias 기반이라 PTY 없이도 드롭다운 구성 가능. `backendModelPoller.ts`에서 Gemini는 정적 alias 목록을 기본으로, PTY를 optional fallback으로 처리.

---

## 12. 승인 모드 (`--approval-mode`) — 권한 정책 매핑

**출처**: `gemini_cli_terminal_summary.md §8`

### Gemini 승인 모드 3단계

```bash
gemini --approval-mode default   "..."   # 기본: 위험 작업만 확인
gemini --approval-mode auto_edit "..."   # edit 계열 도구 자동 승인
gemini --approval-mode yolo      "..."   # 전체 자동 (위험)
```

> `--yolo/-y` 플래그는 deprecated → `--approval-mode yolo` 권장

### Claude Code vs Codex vs Gemini 권한 모드 매핑

| 모드 수준 | Claude Code | Codex | Gemini |
|----------|------------|-------|--------|
| 안전 (기본) | `--permission-mode default` | `--ask-for-approval on-request` | `--approval-mode default` |
| 편집 자동 승인 | `--permission-mode acceptEdits` | `--ask-for-approval never` (편집만) | `--approval-mode auto_edit` |
| 완전 자동 | `--dangerously-skip-permissions` | `--full-auto` / `--yolo` | `--approval-mode yolo` |
| 샌드박스 격리 | 없음 | `--sandbox` | `--sandbox` (Docker) |

### 구현 방향 — AgentCanvas UI 통합 권한 설정

**파일**: `extension/src/webview/components/AgentPermissionPanel.tsx`

```ts
type UnifiedPermissionLevel = "safe" | "auto-edit" | "full-auto";

function toGeminiApprovalMode(level: UnifiedPermissionLevel): string {
  switch (level) {
    case "safe":      return "--approval-mode default";
    case "auto-edit": return "--approval-mode auto_edit";
    case "full-auto": return "--approval-mode yolo";
  }
}
```

> AgentCanvas에서 통합 권한 슬라이더(안전 ↔ 자동)로 3개 CLI 모두 제어

---

## 13. Extensions — 배포 가능한 패키지 구조 참고

**출처**: `gemini_cli_terminal_summary.md §13`, `gemini_cli_key_summary.md Extensions 섹션`

### Gemini Extension 구성 요소

```
my-extension/
├── gemini-extension.json   (필수) 메타데이터
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   └── tools/
└── dist/
```

**`gemini-extension.json`이 포함할 수 있는 것들**:

| 항목 | 설명 |
|------|------|
| MCP 서버 | 외부 서비스 연결 |
| Custom commands | `/my-cmd` 형태 슬래시 명령 |
| Context file (GEMINI.md) | 확장별 컨텍스트 |
| Themes | UI 테마 |
| Hooks | BeforeTool/AfterTool 정책 |
| Sub-agents | 내부 에이전트 |
| Agent Skills | SKILL.md 패키지 |

### Extension 관리 명령

```bash
gemini extensions list
gemini extensions install https://github.com/user/repo.git
gemini extensions install ./local-path   # 로컬 경로
gemini extensions update --all
gemini extensions enable my-extension
gemini extensions disable my-extension
gemini extensions link .                  # 개발 중 로컬 연결
gemini extensions uninstall my-extension

# REPL 안에서
/extensions list
```

### AgentCanvas 적용 방향

Extension 시스템은 AgentCanvas의 "팀 설정 내보내기" 기능과 개념 유사:
- AgentCanvas 팀 → `gemini-extension.json` 내보내기
- 다른 팀원이 `gemini extensions install <path>` 로 동일 환경 구성

> **P3 구현**: `exportTeamAsGeminiExtension()` 함수로 팀 구성 → Extension 패키지 변환

---

## 14. Configuration 레이어 — 설정 우선순위 활용

**출처**: `gemini_cli_key_summary.md Configuration 섹션`

### Gemini 설정 6단계 레이어 (낮은 숫자 = 낮은 우선순위)

| 순위 | 레이어 | 위치 |
|------|--------|------|
| 1 | Default values | 앱 하드코딩 |
| 2 | System defaults | `/etc/gemini-cli/system-defaults.json` |
| 3 | **User settings** | `~/.gemini/settings.json` |
| 4 | **Project settings** | `<project-root>/.gemini/settings.json` |
| 5 | System settings | `/etc/gemini-cli/settings.json` |
| 6 | Environment variables | `.env` / 환경변수 |
| 7 | **CLI arguments** | `--model`, `--sandbox` 등 |

### AgentCanvas 설정 쓰기 전략

```
AgentCanvas 팀 설정 저장 시
  ├─ 전역 defaults  → ~/.gemini/settings.json (User 레이어)
  └─ 프로젝트 설정  → .gemini/settings.json   (Project 레이어)
     └─ mcpServers, hooks, approval-mode 등 포함
```

```ts
// geminiSettingsWriter.ts
export function getSettingsPath(scope: "user" | "project", projectRoot?: string): string {
  if (scope === "user") return path.join(os.homedir(), ".gemini", "settings.json");
  return path.join(projectRoot!, ".gemini", "settings.json");
}
```

---

## 15. 신규 파일 요약

| 파일 | 역할 | 우선순위 |
|------|------|---------|
| `geminiQuotaPoller.ts` | PTY로 `/stats` 파싱 → 토큰/잔여량 추출 | 🟠 P1 |
| `geminiSettingsWriter.ts` | `.gemini/settings.json` 생성 (MCP + Hooks + 정책) | 🟠 P1 |
| `skillExporter.ts` | AgentCanvas Skill → `.gemini/skills/SKILL.md` 변환 | 🟡 P2 |
| `geminiModels.ts` | Gemini 모델 alias 정의 (정적 목록) | 🟠 P1 |
| `projectContextWriter.ts` | `GEMINI.md` / `CLAUDE.md` / `AGENTS.md` 통합 생성 | 🟠 P1 |
| `geminiHooksGenerator.ts` | BeforeTool/AfterTool 정책 → settings.json hooks 블록 | 🟡 P2 |

### `cliExecutor.ts` 수정 사항

| 수정 항목 | 내용 |
|----------|------|
| Gemini 실행 분기 추가 | `spawn("gemini", [...])` headless 경로 |
| `--approval-mode` 매핑 | UnifiedPermissionLevel → Gemini flag |
| `--sandbox` + Docker 체크 | Docker 없으면 경고 |
| `--model <alias>` 지정 | geminiModels.ts alias 활용 |
| Plan Mode PTY 분기 | `planOnly: true` 시 PTY + `/plan` 명령 |

---

## 16. 3-Backend 통합 적용 로드맵

```
Phase 1 (P0 — 핵심 실행):
  Claude:  spawn() + stream-json 파싱    [CLAUDE_CLI_APPLY_SPEC §1]
  Codex:   codex exec --json 파싱        [CODEX_CLI_APPLY_SPEC §1]
  Gemini:  spawn() + stream-json 파싱    [본 문서 §1]

Phase 2 (P1 — 쿼터 기반 분배):
  Claude:  claudeQuotaPoller.ts (% used PTY)
  Codex:   codexQuotaPoller.ts (% left PTY)
  Gemini:  geminiQuotaPoller.ts (/stats PTY) ← 실측 필요
  All:     backendAllocator.ts → remainingPct 기준 자동 배분

Phase 3 (P1 — 컨텍스트 파일):
  CLAUDE.md + AGENTS.md + GEMINI.md 팀 Apply 시 동시 생성

Phase 4 (P2 — 고급 기능):
  Gemini: Plan Mode, /rewind, /chat save, Skills 내보내기
  Gemini: Hooks (BeforeTool/AfterTool) 자동 생성
  Gemini: --sandbox Docker 격리
```

---

> **다음 액션 아이템**:
> 1. Gemini CLI REPL에서 `/stats` 실행 후 출력 내용 공유 → `geminiQuotaPoller.ts` 정규식 확정
> 2. `cliExecutor.ts` spawn() 전환 완료 (BUG-2 선행) → Gemini 실행 경로 추가
> 3. `projectContextWriter.ts`에서 3종 컨텍스트 파일 동시 생성 구현
