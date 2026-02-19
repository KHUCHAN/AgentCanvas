# AgentCanvas — Agent Communication Protocol

**Date**: 2026-02-19
**Purpose**: 에이전트 간 소통 방식, 메시지 구조, 핸드오프 프로토콜, 상호작용 패턴, 샌드박스 워크플로우를 정의한다.

---

## 1. 설계 원칙

AgentCanvas에서 에이전트 간 소통은 다음 원칙을 따른다.

**File-first**: 지속적인 지시/규칙은 마크다운 파일에 기록한다. 채팅 컨텍스트는 compaction으로 소실될 수 있으므로 안정적인 규칙은 반드시 파일로 유지한다.

**Deterministic enforcement**: 메모리 기반 가이드보다 파일 기반 규칙을 우선한다. 실행 가능한 제약조건은 코드/설정으로 강제한다.

**Least context**: 활성 MCP 서버와 스킬 컨텍스트를 최소화한다. 에이전트가 알아야 할 정보만 전달한다.

**Isolation by default**: 사용자/채널 간 컨텍스트가 유출되지 않도록 세션을 격리한다. 워커는 샌드박스 내에서만 작업한다.

**Explicit termination**: 모든 상호작용은 반드시 종료 조건을 가진다. 무한 루프를 원천 차단한다.

---

## 2. 메시지 구조

### 2.1 Standard Message Format

모든 에이전트 간 메시지는 다음 5단계 구조를 따른다.

```
1. Intent        — 한 줄 목표 (무엇을 하려는가)
2. Inputs        — 파일, 경로, 제약조건, 가정사항
3. Plan          — 3~7개 순서 있는 실행 단계
4. Actions       — 변경된 파일, 명령 실행 결과, 생성된 아티팩트
5. Open Questions — 최대 1~3개 구체적 질문 (해결 필요한 것만)
```

### 2.2 Standard Response Format (Orchestrator ↔ Worker)

```
1. Intent              — 한 줄 목표
2. Assumptions/Inputs  — 전달받은 파일, 환경, 제약
3. Plan                — 실행 계획
4. Actions/Artifacts   — 수행 결과, 변경 파일 목록
5. Risks/Safety Notes  — 잠재 위험 요소
6. Next Steps or DONE  — 후속 작업 또는 완료 선언
```

### 2.3 톤 & 스타일

- 직접적, 기술적, 간결하게 작성
- 불릿 리스트와 체크리스트 활용
- 실패와 차단 요소(blockers)는 명시적으로 보고
- 추측하지 않고, 확인할 수 없는 것은 질문으로 남김

---

## 3. 핸드오프 프로토콜 (Handoff Protocol)

에이전트 간 작업을 이관할 때 사용하는 표준 블록이다.

### 3.1 Handoff Block

```
HANDOFF
Context:        [현재 상황/배경 요약]
Goal:           [이관 대상 작업의 목표]
DoD:            [완료 정의 — 무엇이 되어야 끝인가]
SandboxWorkDir: .agentcanvas/sandboxes/<runId>/<agentId>/work
ProposalJson:   .agentcanvas/sandboxes/<runId>/<agentId>/proposal/proposal.json
ChangedFiles:
  - path/to/file1
  - path/to/file2
Tests:
  - (선택) npm test ...
  - (선택) pytest ...
Next:
  - Orchestrator: review + apply or request changes
```

### 3.2 Handoff 필수 규칙

- `SandboxWorkDir`은 반드시 포함 — 워커가 어디서 작업했는지 명시
- `ProposalJson`은 반드시 포함 — 오케스트레이터가 리뷰할 메타데이터 위치
- `ChangedFiles`는 최소 1개 이상 — 변경 없는 핸드오프는 의미 없음
- `DoD`는 검증 가능한 형태 — "잘 작동함" 대신 "테스트 통과, 빌드 성공, 린트 에러 0"

---

## 4. Interaction Taxonomy (상호작용 분류 체계)

멀티에이전트 연구(2023~2025)에서 반복 등장하는 협업 메커니즘을 표준화한 분류 체계다.

### 4.1 분류 축

각 Interaction(에이전트 간 상호작용)은 6개 축으로 정의된다.

| 축 | 설명 | 값 |
|---|---|---|
| **Intent** | 목적 | solve, verify, negotiate, explore, simulate, align |
| **Topology** | 구조 | p2p, manager_worker, pipeline, blackboard, market_auction, debate_judge, broker, router_targeted, broadcast |
| **Message Form** | 메시지 형태 | nl_text(자연어), structured_json, acl_performative, multimodal |
| **Sync** | 동기화 | turn_based, req_res, async, streaming |
| **Termination** | 종료 조건 | max_rounds, timeout_ms, judge_decision, consensus_threshold, quality_gate |
| **Verification** | 검증 | critic_loop, cross_check_vote, tool_based, sandbox_constraints, audit_log |

### 4.2 TypeScript 스키마

```typescript
// src/types.ts 또는 src/webview/bridge/types.ts

export type InteractionTopology =
  | "p2p"
  | "manager_worker"
  | "pipeline"
  | "blackboard"
  | "market_auction"
  | "debate_judge"
  | "broker"
  | "router_targeted"
  | "broadcast";

export type MessageForm =
  | "nl_text"
  | "structured_json"
  | "acl_performative"
  | "multimodal";

export type SyncMode =
  | "turn_based"
  | "req_res"
  | "async"
  | "streaming";

export type Termination =
  | { type: "max_rounds"; rounds: number }
  | { type: "timeout_ms"; ms: number }
  | { type: "judge_decision" }
  | { type: "consensus_threshold"; threshold: number }
  | { type: "quality_gate"; metric: string; op: ">=" | "<="; value: number };

export type Observability = {
  logs: boolean;          // 기본 true
  traces: boolean;        // 기본 false (MVP)
  retain_days?: number;
};

export type InteractionEdgeData = {
  patternId: string;            // e.g. "debate_judge"
  topology: InteractionTopology;
  messageForm: MessageForm;
  sync: SyncMode;
  termination: Termination;
  params: Record<string, unknown>;
  observability: Observability;
  sources?: Array<{ kind: "paper" | "spec"; ref: string; note?: string }>;
};
```

### 4.3 UI 표현 원칙

- Interaction은 단순 "엣지"가 아니라, 패턴 삽입 시 **서브그래프**(여러 에이전트/시스템 노드 + 엣지 묶음)로 생성될 수 있다
- 모든 패턴은 반드시 **종료 조건**을 가진다 (무한 루프 방지)
- 엣지 라벨에 최소 `patternId (핵심 파라미터)` 표시 — 예: `debate_judge (3r)`
- 시스템 노드(Judge, Blackboard, Router, Broker)는 아이콘/배지로 시각 구분

---

## 5. 20개 상호작용 패턴 (Pattern Library)

논문 기반으로 검증된 20개 표준 패턴이다. 각 패턴은 문서(`.md`)와 템플릿(`.json`)을 가진다.

### P01 — Manager-Worker (AutoGen 계열)

- **Topology**: manager_worker
- **Roles**: Manager(system 또는 agent) + Worker agents
- **Steps**: Manager가 작업 분해 → Worker에 할당 → Worker 보고 → Manager 통합 → quality gate
- **Default termination**: `max_rounds=2` + `quality_gate("tests_passed")`
- **UI**: Manager는 system node 또는 `agent role=Manager`로 표시

### P02 — Role-Play Pair (CAMEL)

- **Topology**: p2p
- **Roles**: "User/Client" agent + "Assistant/Executor" agent
- **Steps**: Inception prompt로 역할 고정 → 협업 → deliverable 생성
- **Default termination**: `max_rounds=6`

### P03 — Chat Chain Pipeline (ChatDev)

- **Topology**: pipeline
- **Roles**: Planner → Designer → Coder → Tester → DocWriter
- **Steps**: 워터폴 체인 + 각 단계 출력 검증
- **Default termination**: 각 단계 1~2 turn + gate

### P04 — SOP Assembly Line (MetaGPT)

- **Topology**: pipeline
- **Roles**: PM / Architect / Engineer / QA (SOP로 고정)
- **Steps**: SOP 단계별 산출물 템플릿 + cross-verify
- **Default termination**: quality gate (중간 산출물 검증)

### P05 — Debate + Judge (Irving + Du)

- **Topology**: debate_judge
- **Roles**: Debater A, Debater B, Judge
- **Steps**: A/B 번갈아 주장 → Judge decision
- **Default termination**: `rounds=3`, `judge_decision`
- **Sources**: arXiv:1805.00899, arXiv:2305.14325

### P06 — Critic-Refiner-Curator (Table-Critic류)

- **Topology**: p2p (multi-role)
- **Roles**: Judge, Critic, Refiner, Curator
- **Steps**: Judge 오류 탐지 → Critic 피드백 → Refiner 수정 → Curator 패턴화 → converge
- **Default termination**: `max_rounds=3` + converge condition

### P07 — Majority Vote with Tiebreak

- **Topology**: broadcast → aggregation
- **Roles**: N evaluators + tie-break judge
- **Steps**: 독립 제안 → 투표 → tie-break
- **Default termination**: `consensus_threshold=0.6`

### P08 — Self-Consistency Ensemble

- **Topology**: broadcast → aggregation
- **Roles**: 동일 역할 agent N개 (또는 1 agent multiple drafts) + aggregator
- **Steps**: N drafts → score/rank → select
- **Default termination**: N=5 (fixed)

### P09 — Contract Net Auction (Contract Net Protocol)

- **Topology**: market_auction
- **Roles**: Manager(initiator) + Bidders(workers)
- **Steps**: 작업 공고 → 입찰 → 낙찰 → 실행 → 보고
- **Default termination**: `timeout_ms` + award rule (best bid)

### P10 — Bilateral Negotiation (Offer-Counteroffer)

- **Topology**: p2p
- **Roles**: Proposer, Responder
- **Steps**: offer/counteroffer 반복 → accept/reject
- **Default termination**: `max_rounds=5`, `timeout_ms`

### P11 — Blackboard (Shared State)

- **Topology**: blackboard
- **Roles**: Multiple agents + Blackboard(system)
- **Steps**: 관찰/부분 결과 게시 → 다른 에이전트 소비 → 업데이트
- **Default sync**: async + retention policy

### P12 — Publish-Subscribe

- **Topology**: broker (pub/sub)
- **Roles**: Publisher, Subscriber(s)
- **Steps**: subscribe → notify updates → unsubscribe/timeout
- **Default termination**: `timeout_ms`

### P13 — Broker/Facilitator (FIPA Directory Facilitator)

- **Topology**: broker
- **Roles**: Requester, Provider(s), Broker(system)
- **Steps**: requester query → broker routes/forwards → provider response
- **Default topology**: router_targeted

### P14 — Router Targeted (TarMAC-inspired)

- **Topology**: router_targeted
- **Roles**: Router(system), agents
- **Steps**: agent emits message with "target tags" → router delivers → ack
- **Default**: structured_json + rate limit

### P15 — Hierarchical Tree of Agents

- **Topology**: manager_worker (recursive)
- **Roles**: Root manager + sub-managers + workers
- **Steps**: 재귀적 분해/집계
- **Default termination**: 각 서브트리 단위

### P16 — Red Team + Defender + Judge

- **Topology**: debate_judge
- **Roles**: Red team, Defender, Judge
- **Steps**: Red가 실패/취약점 제시 → Defender 대응 → Judge 점수화
- **Default termination**: `max_rounds=2`, quality gate by score

### P17 — Fact-Check Tool Verifier

- **Topology**: pipeline
- **Roles**: Producer agent + Verifier agent (tool-using) + Judge
- **Steps**: produce answer → verifier tool-check → judge accept/revise
- **Default termination**: quality gate (`citations_count >= k` or `tool_check_pass`)

### P18 — Plan-Execute-Observe-Reflect

- **Topology**: pipeline (cyclic)
- **Roles**: Planner, Executor(tool), Observer, Reflector
- **Steps**: plan → act → observe → reflect (요약/규칙 업데이트)
- **Default termination**: 1 loop, optional repeat

### P19 — Memory Sync Daily Summary

- **Topology**: blackboard
- **Roles**: Agents + Memory Curator(system)
- **Steps**: 각 agent private log → curator summary → shared blackboard update
- **Default termination**: once per session end

### P20 — Protocol Bridge (MCP/ACP/A2A/ANP)

- **Topology**: broker
- **Roles**: Local agent + Bridge(system)
- **Steps**: 내부 interaction을 외부 프로토콜에 맞게 serialize하여 노출
- **Note**: 설계만; MVP에서는 실행 제외

---

## 6. 샌드박스 격리 & Proposal 워크플로우

### 6.1 샌드박스 디렉터리 규약

```
.agentcanvas/
  sandboxes/
    <runId>/
      <agentIdSanitized>/
        input/            ← 오케스트레이터가 복사한 기준본 (읽기 전용)
        work/             ← 워커가 실제 수정하는 공간 (워커 homeDir)
        proposal/
          proposal.json   ← 변경 메타데이터
          changes.patch   ← unified diff
          summary.md      ← 변경 요약
          test.log        ← (선택) 테스트 결과
```

핵심 규칙:
- **워커**: `work/`만 수정한다. `input/`은 절대 건드리지 않는다.
- **오케스트레이터**: `proposal/*`을 읽고, OK면 메인 워크스페이스에 apply한다.
- `input/`은 baseline으로, diff의 기준점이 된다.

### 6.2 워커 CWD 격리

에이전트의 실행 디렉터리를 역할에 따라 분리한다.

```typescript
// 기본값 설정 (agentProfileService.ts)
const isOrchestrator = input.isOrchestrator ?? role === "orchestrator";

runtime: {
  kind: "cli",
  backendId: "auto",
  cwdMode: isOrchestrator ? "workspace" : "agentHome",
}
```

```typescript
// CWD 결정 함수 (resolveAgentCwd.ts)
export function resolveAgentCwd(
  agent: AgentProfile,
  workspaceRoot: string
): string {
  const runtime = agent.runtime;
  if (runtime?.kind === "cli" && runtime.cwdMode === "agentHome") {
    return agent.homeDir;
  }
  return workspaceRoot;
}
```

- **Orchestrator**: `cwdMode: "workspace"` → 메인 워크스페이스 루트에서 실행
- **Worker**: `cwdMode: "agentHome"` → `homeDir = .../sandboxes/<runId>/<agentId>/work`에서 실행

### 6.3 Sandbox Service

```typescript
// extension/src/services/sandboxService.ts

prepareSandbox({
  workspaceRoot: string,
  runId: string,
  agentId: string,
  files: string[]        // 워크스페이스 기준 상대경로
}): Promise<SandboxPaths>

getSandboxPaths({
  workspaceRoot: string,
  runId: string,
  agentId: string
}): { inputDir: string; workDir: string; proposalDir: string }
```

방어 로직 (필수):
- `files`는 반드시 워크스페이스 루트 기준 **상대경로**만 허용
- `..` 포함 금지
- 절대경로 금지
- `.agentcanvas/`, `.git/`, `node_modules/`, `dist/` 기본 차단

### 6.4 Proposal Format

```json
{
  "version": "1",
  "runId": "run_xxx",
  "agentId": "custom:coder-1",
  "createdAt": "2026-02-19T00:00:00.000Z",
  "base": {
    "gitHead": "abc123"
  },
  "paths": {
    "inputDir": "input",
    "workDir": "work",
    "patchFile": "proposal/changes.patch",
    "summaryFile": "proposal/summary.md"
  },
  "changedFiles": [
    { "path": "src/foo.ts", "status": "modified" },
    { "path": "src/bar.ts", "status": "added" }
  ],
  "notes": "..."
}
```

`base.gitHead`는 `prepareSandbox` 시 `git rev-parse HEAD`로 기록하여, 기준 버전 변경 감지에 사용한다.

### 6.5 Proposal 생성 (Diff 표준화)

`git diff --no-index`를 사용해 `input/` vs `work/` 차이를 unified diff로 추출한다.

```
1. git diff --no-index --binary <inputDir> <workDir> 실행
2. diff 텍스트에서 a/input/ → a/, b/work/ → b/ 경로 prefix 변환
3. proposal/changes.patch로 저장
```

경로 prefix strip을 표준화하면, 오케스트레이터가 워크스페이스 루트에서 `git apply`로 바로 반영 가능하다.

### 6.6 Proposal Apply (검토 → 검사 → 적용)

오케스트레이터의 apply 프로세스는 3단계로 고정한다.

```
1. patch 리뷰        — 변경 파일 목록과 내용 확인
2. git apply --check — 적용 가능 여부 사전 검증
3. git apply         — 실제 적용 (실패 시 원자적 롤백)
```

Apply 시 필수 안전검사:
- patch가 건드리는 파일 경로에 `..`가 포함되는지 확인
- 절대경로인지 확인
- `.agentcanvas/` 같은 내부 폴더를 건드리는지 확인
- 허용 디렉터리 밖의 파일인지 확인

### 6.7 전체 실행 흐름 요약

```
┌─ Orchestrator ─────────────────────────────────────────┐
│                                                         │
│  1. Run 시작 (runId 생성)                               │
│  2. 작업 범위 파일 선정 (src/a.ts, package.json 등)       │
│  3. prepareSandbox() → input/ + work/ 생성 및 복사        │
│                                                         │
│  ┌─ Worker ──────────────────────────────┐              │
│  │ homeDir = .../work                    │              │
│  │ cwdMode = agentHome                   │              │
│  │                                       │              │
│  │ 4. work/ 내에서 파일 수정              │              │
│  │ 5. proposal/summary.md 작성            │              │
│  │ 6. changes.patch 생성 (git diff)       │              │
│  │ 7. proposal.json 작성                  │              │
│  │ 8. HANDOFF로 ProposalJson 경로 전달    │              │
│  └────────────────────────────────────────┘              │
│                                                         │
│  9. Proposal 리뷰 (patch 내용 확인)                      │
│ 10. git apply --check (사전 검증)                        │
│ 11. git apply (실제 적용)                                │
│ 12. 메인에서 테스트/빌드                                  │
│ 13. 결과 로그 기록                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 7. 메모리 & 운영 정책

### 7.1 메모리 정책

- 지속적 결정사항과 선호는 `MEMORY.md`에 기록한다
- 일일 실행 노트는 `memory/YYYY-MM-DD.md`에 기록한다
- Compaction으로 초기 대화 내용이 소실될 수 있으므로, 안정적 규칙은 반드시 파일로 유지한다

### 7.2 스킬 안전

- `user-invocable`: 메뉴 가시성에만 영향 (UI 표시 여부)
- `disable-model-invocation`: 실제 실행 차단 게이트 (하드 안전장치)
- 파괴적이거나 시크릿을 다루는 스킬은 반드시 명시적 사용자 호출(human invocation)을 요구한다

### 7.3 MCP 정책

- MCP 서버는 최소로 유지한다 (기본 0~2개)
- 환경변수 **이름**만 저장한다 — raw token은 저장하지 않는다
- Allowlist 기반 tool access를 우선한다
- MCP는 "tool invocation" 레이어이며, interaction은 "agent-to-agent coordination" 레이어로 분리한다

### 7.4 격리 & 정지 제어

- 세션은 사용자/채널 간 격리한다
- 루프가 멈추지 않을 때를 위한 가시적인 **Stop 액션**을 제공한다
- 워커의 cwdMode 격리로 메인 워크스페이스 보호

---

## 8. Validation 규칙

무한루프, 오류 전파, 리스크를 방지하기 위한 필수 규칙이다.

| 규칙 | 대상 | 설명 |
|------|------|------|
| **종료 조건 필수** | 모든 interaction | termination 없으면 저장/실행 금지 |
| **Timeout 필수** | debate, critic, negotiation | 기본 timeout_ms 반드시 설정 |
| **Retention 필수** | blackboard | keep_last_n 또는 keep_last_days 필수 |
| **Rate limit 필수** | broker, router | 기본 10 msg/min |
| **경로 검증** | sandbox, proposal | `..`, 절대경로, 내부폴더 접근 차단 |
| **Git head 확인** | proposal apply | base.gitHead vs 현재 HEAD 불일치 시 경고 |

---

## 9. 관측성 (Observability)

### 9.1 이벤트 로깅

모든 interaction step을 로컬 JSONL로 기록한다.

**저장 위치**: `.agentcanvas/logs/<flow>/<date>.jsonl`

**이벤트 스키마**:
```json
{"ts": 0, "flow": "team-alpha", "interactionId": "i1", "edgeId": "e1", "event": "configured", "data": {...}}
{"ts": 1, "flow": "team-alpha", "interactionId": "i1", "edgeId": "e1", "event": "step", "step": 1, "from": "debater_a", "to": "judge", "note": "..."}
{"ts": 2, "flow": "team-alpha", "interactionId": "i1", "edgeId": "e1", "event": "terminated", "reason": "judge_decision"}
```

### 9.2 Proposal 이벤트

Proposal 워크플로우도 다음 이벤트를 기록한다:

- `proposal_created` — 워커가 proposal 생성 완료
- `proposal_reviewed` — 오케스트레이터가 리뷰 수행
- `proposal_applied` — 메인 워크스페이스에 적용 성공
- `proposal_rejected` — 리뷰 결과 반려

---

## 10. Flow 저장/로드 포맷

상호작용이 포함된 Flow는 YAML로 저장한다.

**경로**: `.agentcanvas/flows/<flowName>.yaml`

```yaml
version: 0.2

commonRules:
  ruleChainRefs:
    - "CODEX_GLOBAL:~/.codex/AGENTS.md"
    - "PROJECT:./AGENTS.md"

agents:
  - id: a1
    name: "Planner"
    role: orchestrator
    rules: []
    skills: ["requirements_refine"]
    mcp: ["jira"]
  - id: a2
    name: "Coder"
    role: worker

interactions:
  - id: i1
    patternId: "manager_worker"
    edges:
      - source: "a1"
        target: "a2"
        data:
          topology: "manager_worker"
          messageForm: "nl_text"
          sync: "req_res"
          termination:
            type: "max_rounds"
            rounds: 2
          params:
            task_template: "Implement feature X"
          observability:
            logs: true
            traces: false

layout:
  nodes: {}
  edges: {}
```

---

## 11. Definition of Done (완료 정의) 템플릿

### UI 작업

- [ ] Canvas 에러 없이 렌더링
- [ ] Tidy/Auto layout 안정적 배치
- [ ] 키보드 단축키 동작 (Tab, +/-, 0, 1, Space+drag, Shift+S)
- [ ] Inspector 데이터가 선택 노드와 일치
- [ ] 테마 색상이 VS Code 변수 준수

### Skill 작업

- [ ] `SKILL.md` validation 통과 (name/description)
- [ ] 폴더명과 frontmatter `name` 일치
- [ ] Export/Import conflict handling 동작

### Interaction 작업

- [ ] 종료 조건 설정 확인 (termination 필수)
- [ ] 엣지 라벨에 patternId 표시
- [ ] 시스템 노드 시각 구분 (아이콘/배지)
- [ ] JSONL 이벤트 로그 기록

### Proposal 작업

- [ ] Sandbox 디렉터리 올바르게 생성
- [ ] input/ 읽기 전용 유지
- [ ] changes.patch 경로 prefix 정규화
- [ ] git apply --check 통과
- [ ] 경로 안전검사 통과 (..금지, 절대경로 금지, 내부폴더 금지)

---

## 12. 이미지 처리 규칙

시각적 작업(레이아웃, 간격, hover/focus 상태)에서는 스크린샷을 요청한다.

- 이미지에서 읽을 수 없는 텍스트는 추측하지 않고, 더 선명한 이미지를 요청
- Codex CLI 이미지 첨부: `codex -i ./screenshots/ui.png "Analyze this UI issue."`
- 민감한 스크린샷(토큰, 이메일, 개인 데이터)은 커밋하지 않는다

---

*AgentCanvas Agent Communication Protocol v2.0 — 2026-02-19*
