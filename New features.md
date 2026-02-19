1) 현재 AgentCanvas의 “확장 포인트” 정리 (AS-IS)
저장 구조(이미 구현됨)

커스텀 에이전트: .agentcanvas/agents/*.json에 저장/CRUD

플로우: .agentcanvas/flows/*.yaml (실제로는 “JSON을 YAML로 저장”)

상호작용 이벤트 로그: .agentcanvas/logs/<flow>/<date>.jsonl (행 단위 JSONL)

CLI 백엔드(이미 구현됨)

감지 대상: claude, gemini, codex, aider + custom, 그리고 auto

실행: spawn으로 실행하고 stdinPrompt 여부에 따라 prompt를 stdin 또는 argv로 전달

VS Code 설정도 이미 존재:

agentCanvas.promptBackend (auto/claude-code/gemini-cli/codex-cli/aider/custom)

agentCanvas.customCliCommand, agentCanvas.customCliArgs

데이터 모델(확장 설계에 유리함)

AgentProfile에 role/systemPrompt/delegates/assignedSkillIds/assignedMcpServerIds가 이미 있다.

StudioNode/StudioEdge 타입이 안정적으로 잡혀 있고, edge type에 delegates, interaction이 이미 포함됨.

결론:
이 위에 “멀티 런타임 설정(Claude/Gemini/Codex) + 실행/디버깅(런 히스토리/노드 단위 재실행/핀 데이터) + OpenClaw 연동”을 올리기 좋다.

2) 목표 상태(TO-BE): 너의 제품 포지션을 명확히 잡자

너의 AgentCanvas를 한 문장으로 정의하면:

VS Code 안에서 “멀티 런타임(Claude/Gemini/Codex/OpenClaw) 멀티에이전트”를 설계하고, 실행/디버깅/재현(Replay)까지 하는 Agent IDE

이 방향에서 경쟁 제품들이 강한 지점은 아래고, 그걸 AgentCanvas식으로 “흡수”하면 된다:

n8n: 실행 히스토리에서 가져와 디버그, 데이터 핀(고정)

Dify: Run History + 노드 단위 “Single node testing”, “Last run”, “Variable Inspect”

LangGraph Studio: 프로덕션 trace를 내려받아 로컬에서 재실행/디버그(“time travel”류)

VS Code AI Toolkit(Agent Inspector): F5 디버깅, 변수/스텝/툴콜/멀티에이전트 워크플로 시각화

CopilotKit Open Multi-Agent Canvas: 한 대화에서 여러 agent 관리 + MCP 서버 붙여 “deep research”

OpenClaw: 로컬 게이트웨이(control plane) + 멀티 채널 inbox + 멀티 agent routing + workspace 기반 skills

3) 핵심 설계: “Provider / Runtime / Observability” 3계층으로 나누기

지금 AgentCanvas는 “발견/편집/저장”이 강해. 여기에 “실행/재현”을 붙이려면 아래 3개 레이어로 분리하는 게 유지보수에 가장 좋다.

A. Provider Layer (발견 + 파일/설정 반영)

역할: 워크스페이스/홈에서 에이전트/스킬/룰/MCP를 “읽고/쓰기”

예:

Custom provider: .agentcanvas/agents/*.json 기반

Codex/VSCode MCP provider: .codex/config.toml, .vscode/mcp.json 읽기

(추가) OpenClaw provider: ~/.openclaw/workspace의 skills/프롬프트 파일 구조를 읽어 매핑

B. Runtime Layer (LLM 호출/툴 실행/세션)

역할: “이 에이전트는 어떤 런타임으로 실행할지” + “세션/로그”

런타임 종류:

CLI Runtime: claude/gemini/codex/aider/custom (이미 있음)

OpenClaw Runtime:

방법1: openclaw agent --message "..." 같은 CLI로 호출

방법2(고급): OpenClaw Gateway(ws://127.0.0.1:18789)에 붙어 세션/이벤트를 실시간 구독

C. Observability Layer (Run/Trace/Replay)

역할: 실행 이력 저장, 노드별 I/O 캐시, 재현(replay), 핀 데이터

여기서 n8n/Dify/LangGraph Studio의 강점을 흡수한다.

4) “Claude/Gemini/Codex 셋 다 설정”을 위한 구체 데이터/설정 설계
4.1 설정 우선순위(중요)

실제로 제품에서 제일 편한 우선순위는 이거야:

AgentProfile 단위 override (이 agent는 항상 codex-cli로)

Flow 단위 override (이 플로우는 gemini-cli로)

Workspace default (현재 agentCanvas.promptBackend)

Global default (홈 디렉터리 설정)

Auto(가용한 것 중 첫 번째)

4.2 AgentProfile 확장(추천)

현재 AgentProfile은 providerId가 있고, CLI backend 선택은 프롬프트 생성에서만 쓰이는 구조야.

여기서 실행까지 붙이려면, AgentProfile에 runtime 설정을 명시하는 게 깔끔해:

// extension/src/types.ts & webview-ui/src/messaging/protocol.ts에 동일 반영
type AgentRuntime =
  | { kind: "cli"; backendId: CliBackend["id"]; cwdMode?: "workspace" | "agentHome" }
  | { kind: "openclaw"; gatewayUrl?: string; agentKey?: string };

interface AgentProfile {
  // ...existing fields
  runtime?: AgentRuntime; // NEW
}


기존 파일 호환성: runtime이 없으면 “workspace default”를 적용.

4.3 백엔드 설정(경로/args/env) 구조

지금은 custom만 command/args가 설정 가능하고, 나머지는 코드에 박혀있어.
셋 다 “설정 가능”하게 하려면 다음 2단계를 추천:

(1) VS Code Settings에 “backendOverrides” 추가
"agentCanvas.cliBackendOverrides": {
  "claude-code": { "command": "claude", "args": ["-p"], "env": { "ANTHROPIC_API_KEY": "${env:ANTHROPIC_API_KEY}" } },
  "gemini-cli":  { "command": "gemini", "args": [], "env": { "GEMINI_API_KEY": "${env:GEMINI_API_KEY}" } },
  "codex-cli":   { "command": "codex", "args": ["--quiet"], "env": { "OPENAI_API_KEY": "${env:OPENAI_API_KEY}" } }
}

(2) 내부적으로는 “detected preset + override merge”

cliDetector.ts의 DEFAULT_BACKENDS를 “base”로 두고

settings override가 있으면 command/args/env를 덮어쓴다.

AI Toolkit이 MCP server 연결에서도 “기존 서버 연결(stdio/http) + 환경 검증”을 제공하듯이
AgentCanvas도 “CLI 백엔드/환경 검증”을 제공하면 사용자 만족도가 확 올라간다.

5) 실행/디버깅 설계: Dify + n8n + LangGraph Studio 좋은 것만 가져오기
5.1 Run(실행) 개념 도입

Dify는 “워크플로가 돌 때마다 Run History를 남기고, 노드별로도 확인”이 된다.
AgentCanvas도 동일한 UX를 만들면 된다.

저장 경로(추천)

기존 interaction log는 유지: .agentcanvas/logs/<flow>/<date>.jsonl

실행 로그는 별도: .agentcanvas/runs/<flow>/<runId>.jsonl

인덱스: .agentcanvas/runs/<flow>/index.json

RunEvent(JSONL) 스키마(예시)
{ "ts": 1730000000000, "runId": "run_abc", "type": "run_started", "flow": "default", "meta": { "backend": "codex-cli" } }
{ "ts": 1730000000123, "runId": "run_abc", "type": "node_started", "nodeId": "agent:lead", "input": { ... } }
{ "ts": 1730000000456, "runId": "run_abc", "type": "node_output", "nodeId": "agent:lead", "output": { ... }, "usage": { "tokens": 1234 } }
{ "ts": 1730000000500, "runId": "run_abc", "type": "edge_fired", "edgeId": "interaction:1", "payload": { ... } }
{ "ts": 1730000000900, "runId": "run_abc", "type": "run_finished", "status": "success" }

5.2 “노드 단위 실행(Step Run) + Last Run + Variable Inspect”

Dify는

노드 하나만 테스트 실행(Single node testing)

실행 후 “Last run”에서 입력/출력/에러 확인

Variable Inspect로 노드 출력 변수를 보고/수정하면서 downstream 영향 확인

을 제공한다.

AgentCanvas UI에서는 이렇게 매핑하면 된다:

Inspector 패널에 탭 추가:

Run: “이 노드만 실행”, “Last run”, “핀/언핀”

Variables: (해당 runId 기준) 이 노드 output JSON 트리 + “Edit pinned output”

5.3 “핀 데이터(Data pinning) + 부분 재실행”

n8n의 데이터 핀은 “노드 출력 고정 → 다음 실행에 외부 호출 없이 downstream만 재실행”에 핵심이 있다.
그리고 과거 실행을 편집기에 복사해 디버그도 한다.

AgentCanvas 구현은 더 단순하게 가능:

.agentcanvas/pins/<flow>/<nodeId>.json 저장

Runner는 실행 시:

pinned output이 있으면 그 노드는 스킵하고 output을 주입

없으면 실제 실행

5.4 “Replay / Time-travel”

LangGraph Studio는 “프로덕션 trace를 내려받아 로컬에서 재실행하며 디버그”를 강조한다.
AgentCanvas도 RunEvent를 표준화하면 동일한 효과를 만들 수 있어:

RunEvent(JSONL) = 재현 가능한 “실행 기록”

“Replay run” 버튼:

동일 입력/동일 pinned/동일 설정으로 재실행

또는 “Prompt만 수정하고 재실행”(prompt hotfix)

6) OpenClaw 연결 설계 (네가 원한 “연결”의 2가지 모드)

OpenClaw은

메시징 채널(WhatsApp/Telegram/Slack/Discord 등)에서 들어온 요청을

로컬 Gateway(control plane)가 받고

멀티 agent routing / 세션 / tools / 이벤트를 관리하는 구조야.

또 workspace/skills 구조도 명확히 있다: ~/.openclaw/workspace, skills/<skill>/SKILL.md, 주입 프롬프트 파일(AGENTS.md/SOUL.md/TOOLS.md).

그래서 AgentCanvas ↔ OpenClaw 연결은 “양방향”으로 설계할 수 있다.

모드 A: AgentCanvas가 OpenClaw “Workspace Editor”가 된다 (추천 시작점)

OpenClaw workspace를 Provider로 추가

AgentCanvas의 Skill/Rule 편집 기능으로 OpenClaw workspace의 파일들을 직접 관리

장점: 실행 API 몰라도 됨(파일 시스템 기반이라 단단함)

구현 포인트:

Provider: OpenClawWorkspaceProvider

root: ~/.openclaw/workspace (configurable)

skills: skills/*/SKILL.md 를 기존 Skill 노드로 매핑

injected prompts: AGENTS.md, SOUL.md, TOOLS.md를 RuleDoc/Note로 매핑

모드 B: AgentCanvas가 OpenClaw “Runtime Controller”가 된다 (고급)

실행 버튼을 누르면 OpenClaw에게 “이 플로우를 실행해줘”를 전달

방법1: OpenClaw CLI 호출(openclaw agent --message ...)

방법2: Gateway WS(control plane)에 붙어서 세션/이벤트를 구독

UI에서 제공할 기능:

“Connect OpenClaw Gateway” (URL + 토큰/인증)

연결되면:

Run 패널에서 “OpenClaw로 실행”

OpenClaw 세션 이벤트를 AgentCanvas RunEvent로 변환해 저장(=리플레이 가능)

7) UI/UX 설계(화면 단위로 “정확히”)

현재도 n8n-style canvas + Inspector + Node Library가 핵심이야.
여기에 아래 4개 화면만 추가하면 “IDE급”으로 올라간다:

7.1 Backends 화면(설정)

목록: Claude / Gemini / Codex / Aider / Custom / OpenClaw

상태: detected(available) + version(있으면)

버튼:

“Test backend”(샘플 프롬프트 1회 실행)

“Set as workspace default”

“Edit command/args/env”

7.2 Run 패널(실행)

Run 버튼:

Run Flow

Run Selected Node

Stop

옵션:

backend 선택(auto 포함)

run name / tags

“use pinned outputs”

출력:

스트리밍 로그

edge fired 이벤트

tool calls(가능하면)

VS Code AI Toolkit이 “툴콜/스트리밍/멀티에이전트 워크플로를 실시간 시각화”를 강조하는데
AgentCanvas도 Run 패널에서 같은 느낌을 최소구현으로 낼 수 있어.

7.3 Run History(이력)

리스트: 최근 runId, 시간, 성공/실패, 사용 backend

선택 시:

전체 타임라인

노드별 I/O

Replay / Copy inputs to editor / Pin outputs

(Dify의 Run History/로그 UX를 참고)

7.4 Inspector 확장(노드/엣지)

Node Inspector 탭:

Details(기존)

Skills/MCP(기존)

Run(신규): Single node testing + Last run

Variables(신규): Variable Inspect

Edge Inspector:

interaction config + termination validation(기존 방향 유지)

8) 구현 작업 리스트(파일/메시지 단위로 쪼갠 “실행 가능한” 설계)
8.1 타입/프로토콜 확장

extension/src/types.ts + webview-ui/src/messaging/protocol.ts 동기 확장

AgentRuntime 추가

RunSummary, RunEvent 추가

PinnedOutput 추가

8.2 extension 서비스 추가

extension/src/services/runStore.ts

startRun(), appendRunEvent(), listRuns(), loadRunEvents()

extension/src/services/pinStore.ts

getPin(nodeId), setPin(nodeId, output), clearPin(nodeId)

extension/src/services/runtime/cliRuntime.ts

기존 executeCliPrompt를 감싸서 “세션/컨텍스트/로그 표준화”

(필요 시) backend별 프롬프트 템플릿 분기

extension/src/services/runtime/openclawRuntime.ts

CLI 방식부터(가장 단단)

8.3 메시지 추가(webview ↔ extension)

webview-ui/src/messaging/protocol.ts에 아래 추가(예시):

RUN_FLOW

RUN_NODE

STOP_RUN

LIST_RUNS

LOAD_RUN

PIN_OUTPUT

UNPIN_OUTPUT

SET_AGENT_RUNTIME

SET_BACKEND_OVERRIDES

(현재도 request/response 패턴이 이미 있어서 붙이기 쉬움)

8.4 webview UI 추가

RunPanel.tsx, RunHistoryPanel.tsx

Inspector에 탭 추가

Canvas에 “실행 중 상태” 오버레이(노드별 running/success/error 뱃지)

9) 우선순위(“무조건 성공하는” 순서)

백엔드 설정 3종(Claude/Gemini/Codex) 완전 설정 가능화

backendOverrides + per-agent runtime 저장

Run History + Last run(노드 I/O 저장)

Dify 스타일의 최소구현부터

핀 데이터 + 부분 재실행(n8n식)

Replay(Trace 기반 재현) (LangGraph Studio 방향)

OpenClaw Provider(워크스페이스 편집) → OpenClaw Runtime(게이트웨이/CLI 제어)