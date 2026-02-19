# CODEx IMPLEMENTATION SPEC (논문 기반): Agent Interaction Layer + Pattern Library + VS Code Canvas 적용
프로젝트(가칭): AgentCanvas / OpenClaw Studio Extension  
목표: “Agent(노드) + 상호작용(엣지/서브그래프)”을 **논문 기반 상호작용 패턴**으로 표준화하고, VS Code extension에서 UI로 설계/관리/공유 가능하게 만든다.

---

## 0) 배경: 왜 “논문 기반 상호작용 패턴”이 필요한가
LLM 기반 멀티에이전트 연구는 2023~2025에 폭발적으로 늘었고, 서베이들은 공통적으로 다음을 강조한다:
- 협업 메커니즘은 “구조(centralized/peer/distributed) + 역할(role) + 프로토콜(protocol) + 종료(termination) + 검증(verification)”이 명시되어야 성능/안정성이 좋다.
- 단순 “에이전트끼리 채팅만 연결”하면, 환각/오류가 연쇄(cascading hallucination)될 수 있다.
- 따라서 “역할·턴·검증·종료”를 UI에서 설계/가시화해야 한다.

이 문서는 연구에서 반복 등장하는 상호작용 방법들을 **Pattern Library**로 정리하고,
너희 VS Code 캔버스에 “드래그해서 실행 설계”가 가능하도록 구현 지시를 제공한다.

---

## 1) Research → Product: Interaction Taxonomy (분류 체계)
### 1.1 분류 축 (캔버스 UI/데이터 모델에 그대로 반영)
각 Interaction(엣지/패턴)은 아래 축을 가진다.

1) 목적(Intent)
- solve / verify / negotiate / explore / simulate / align

2) 구조(Topology)
- peer-to-peer
- manager-worker (centralized)
- pipeline/assembly-line
- blackboard(shared state)
- market/auction
- debate/judge
- broker/facilitator
- router/targeted

3) 메시지 형태(Message Form)
- natural language (chat)
- structured JSON (schema)
- speech-act/performatives (ACL)
- learned vector(참고용; 제품에는 개념만)
- multimodal(이미지/파일 포함)

4) 동기화(Sync)
- strict turn-taking (round-based)
- request/response
- async event-driven
- streaming

5) 종료(Termination)
- max_rounds
- consensus_threshold
- judge_decision
- timeouts
- quality_gate(pass/fail)

6) 신뢰성/검증(Verification & Safety)
- critic loop
- cross-check/vote
- tool-based verification
- sandbox constraints
- audit log

### 1.2 UI 원칙(반드시)
- Interaction은 “엣지”로만 표현하지 말고,
  **패턴 삽입 시 서브그래프(여러 에이전트/시스템 노드 + 엣지 묶음)**로 생성될 수 있어야 함.
- 모든 패턴은 반드시 **종료 조건**을 갖는다(무한 루프 방지).

---

## 2) 우리 프로그램의 Interaction 모델(데이터/그래프)
### 2.1 새로운 Graph 요소(추가)
- Node types
  - `agent` (기존) : 기본 노드
  - `system` (신규) : Judge / Blackboard / Router / Broker / Registry / Timer 등
  - `note` (기존) : sticky note

- Edge types
  - `interaction` (신규): agent↔agent, agent↔system 간 상호작용 엣지
  - `dependsOn` (기존/유지): skill→mcp 의존성
  - `overrides` (기존/유지): ruleDoc 체인

### 2.2 TypeScript 스키마(필수)
파일: `src/webview/bridge/types.ts` (또는 `src/webview/graph/types.ts`)
```ts
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

export type MessageForm = "nl_text" | "structured_json" | "acl_performative" | "multimodal";

export type SyncMode = "turn_based" | "req_res" | "async" | "streaming";

export type Termination =
  | { type: "max_rounds"; rounds: number }
  | { type: "timeout_ms"; ms: number }
  | { type: "judge_decision" }
  | { type: "consensus_threshold"; threshold: number }
  | { type: "quality_gate"; metric: string; op: ">=" | "<="; value: number };

export type Observability = {
  logs: boolean;          // 기본 true
  traces: boolean;        // 기본 false(MVP)
  retain_days?: number;   // 팀 플랜에서 유료화 가능
};

export type InteractionParams = Record<string, unknown>;

export type InteractionEdgeData = {
  patternId: string;            // e.g. "debate_judge"
  topology: InteractionTopology;
  messageForm: MessageForm;
  sync: SyncMode;
  termination: Termination;
  params: InteractionParams;    // rounds, roles, scoring, etc
  observability: Observability;
  // Evidence / traceability
  sources?: Array<{ kind: "paper" | "spec"; ref: string; note?: string }>;
};
3) UI/UX 요구사항 (n8n 스타일 + 너희 요구 반영)
3.1 화면 레이아웃(이미 확정된 요구)
Canvas 기본 노드 = Agent
Canvas 우상단 = Common Rules(공통 룰) 패널(항상 접근 가능)
Agent 클릭 = Skill / MCP / Rule 관리 인스펙터
Left panel(Node Library) = Agent / Skill / MCP + (신규) Interaction Patterns 섹션
Right panel(Inspector) = 선택한 노드/엣지의 상세 편집
3.2 신규 UX (Interaction 중심)
Interaction Edge 클릭 시:
patternId, topology, sync, termination, params 편집 폼 제공
“종료 조건 없음”이면 저장 불가(Validation)
Pattern Library에서 패턴 클릭/드래그 시:
서브그래프 템플릿 삽입(노드+엣지+기본 파라미터)
삽입 직후 “Quick Configure” 모달:
rounds / timeout / judge / blackboard 등 핵심 파라미터만 빠르게 설정
3.3 가시화(중요)
엣지 라벨에 최소 표시:
patternId (핵심 파라미터) 예: debate_judge (3r)
시스템 노드는 시각적으로 구분(아이콘/배지):
Judge, Blackboard, Router, Broker 등
4) Pattern Library (최소 20개) — 논문 기반 상호작용 템플릿
각 패턴은 (A) 문서(MD) + (B) 템플릿(JSON/YAML)을 가진다.
4.1 패턴 문서 템플릿
파일: docs/interaction-patterns/patterns/<patternId>.md
필수 섹션:
Intent / When to use
Roles (agent/system)
Protocol Steps (step-by-step)
Defaults (params/termination)
Failure modes & mitigations
UI mapping (어떤 노드/엣지로 표현하는지)
Sources (paper/spec reference list)
4.2 패턴 템플릿 스키마
파일: resources/patterns/<patternId>.json
{
  "id": "debate_judge",
  "name": "Debate + Judge",
  "nodes": [
    {"type": "agent", "id": "debater_a", "data": {"role": "Debater"}},
    {"type": "agent", "id": "debater_b", "data": {"role": "Debater"}},
    {"type": "system", "id": "judge", "data": {"role": "Judge"}}
  ],
  "edges": [
    {"type": "interaction", "id": "e1", "source": "debater_a", "target": "judge",
      "data": {"patternId":"debate_judge","topology":"debate_judge","messageForm":"nl_text","sync":"turn_based",
               "termination":{"type":"max_rounds","rounds":3},"params":{"rounds":3},"observability":{"logs":true,"traces":false}}}
  ],
  "sources": [
    {"kind":"paper","ref":"arXiv:1805.00899","note":"AI safety via debate"},
    {"kind":"paper","ref":"arXiv:2305.14325","note":"Multiagent debate improves factuality/reasoning"}
  ]
}
5) 필수 패턴 목록(20개) + 제품 적용 포인트
Codex는 아래 20개에 대해 (1) patterns/.md (2) resources/patterns/.json 를 생성하고, 확장 UI에서 삽입 가능하게 구현한다.
P01) manager_worker (AutoGen 계열)
Roles: Manager(system or agent), Worker agents
Steps: manager decomposes → assigns → workers report → manager integrates → quality gate
Default termination: max_rounds=2 + quality_gate(“tests_passed”)
UI: Manager는 system node 또는 “agent role=Manager”로 표시
P02) role_play_pair (CAMEL)
Roles: “User/Client” agent + “Assistant/Executor” agent
Steps: inception prompt로 역할 고정 → 협업 → deliverable 생성
Default: max_rounds=6
P03) chat_chain_pipeline (ChatDev)
Roles: Planner → Designer → Coder → Tester → DocWriter (agents)
Steps: waterfall chat chain + 각 단계 출력 검증
Default: 각 단계 1~2 turn + gate
P04) sop_assembly_line (MetaGPT)
Roles: PM/Architect/Engineer/QA 등 SOP로 고정
Steps: SOP 단계별 산출물 템플릿 + cross-verify
Default: gate가 핵심(중간 산출물 검증)
P05) debate_judge (Irving + Du)
Roles: Debater A, Debater B, Judge
Steps: A/B 번갈아 주장 → judge decision
Default: rounds=3, termination=judge_decision
P06) critic_refiner_curator (Table-Critic류)
Roles: Judge, Critic, Refiner, Curator
Steps: judge 오류 찾기 → critic 피드백 → refiner 수정 → curator 패턴화 → converge
Default: max_rounds=3 + converge condition
P07) majority_vote_with_tiebreak
Roles: N evaluators + tie-break judge
Steps: independent propose → vote → tie-break
Default: threshold=0.6
P08) self_consistency_ensemble
Roles: same role agent N개(혹은 one agent multiple drafts) + aggregator
Steps: N drafts → score/rank → select
Default: N=5
P09) contract_net_auction (Contract Net Protocol)
Roles: Manager(initiator) + bidders(workers)
Steps: announce task → bids → award → execute → report
Default: timeout + award rule(best bid)
P10) bilateral_negotiation_offer_counteroffer
Roles: Proposer, Responder
Steps: offer/counteroffer 반복 → accept/reject
Default: max_rounds=5, timeout
P11) blackboard_shared_state
Roles: multiple agents + Blackboard(system)
Steps: post observations/partials → others consume → update
Default: async + retention policy
P12) publish_subscribe (ACL subscribe/notify 느낌)
Roles: Publisher, Subscriber(s)
Steps: subscribe → notify updates → unsubscribe/timeout
Default: timeout_ms
P13) broker_facilitator (KQML/FIPA Directory Facilitator 느낌)
Roles: Requester, Provider(s), Broker(system)
Steps: requester query → broker routes/forwards → provider response
Default: router_targeted
P14) router_targeted (TarMAC-inspired)
Roles: Router(system), agents
Steps: agent emits message with “target tags” → router delivers → ack
Default: structured_json + rate limit
P15) hierarchical_tree_of_agents
Roles: Root manager + sub-managers + workers
Steps: recursively decompose/aggregate
Default: termination at each subtree
P16) redteam_defender_judge
Roles: Red team, Defender, Judge
Steps: red proposes failure/exploit → defender mitigates → judge scores
Default: max_rounds=2, gate by score
P17) factcheck_tool_verifier
Roles: Producer agent + Verifier agent (tool-using) + Judge
Steps: produce answer → verifier tool-check → judge accept/revise
Default: gate: citations_count >= k or tool_check_pass
P18) plan_execute_observe_reflect
Roles: Planner, Executor(tool), Observer, Reflector
Steps: plan → act → observe → reflect(요약/규칙 업데이트)
Default: 1 loop, optional repeat
P19) memory_sync_daily_summary
Roles: agents + memory curator(system)
Steps: 각 agent private log → curator summary → shared blackboard update
Default: once per session end
P20) protocol_bridge_mcp_acp_a2a_anp
Roles: Local agent + Bridge(system)
Steps: 내부 interaction을 외부 프로토콜(ACP/A2A/ANP)에 맞게 serialize하여 노출(“설계만; MVP는 실행 X”)
Default: N/A
6) 코드 구현 작업(필수): 확장에 Pattern/Interaction 추가
6.1 Webview(React Flow) 변경
edgeTypes에 interaction 추가
nodeTypes에 system 추가
Inspector에 “Edge Editor” 탭 추가
Left panel에 “Interaction Patterns” 섹션 추가:
resources/patterns/*.json 로드 후 리스트 표시
drag/drop 삽입(서브그래프 생성)
6.2 저장/로드 포맷(필수)
경로: .agentcanvas/flows/<flowName>.yaml 스키마(초안):
version: 0.2
commonRules:
  # 우상단 공통 룰 패널에서 관리되는 항목
  ruleChainRefs:
    - "CODEX_GLOBAL:~/.codex/AGENTS.md"
    - "PROJECT:./AGENTS.md"
agents:
  - id: a1
    name: "Planner"
    rules: []
    skills: ["requirements_refine"]
    mcp: ["jira"]
  - id: a2
    name: "Coder"
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
          termination: { type: "max_rounds", rounds: 2 }
          params: { task_template: "Implement feature X" }
          observability: { logs: true, traces: false }
layout:
  nodes: {}
  edges: {}
6.3 MCP 연결(기존 설계 유지 + interaction과 분리)
MCP는 “tool invocation” 레이어로 유지한다.
interaction은 “agent-to-agent coordination” 레이어(내부)로 유지한다.
MCP 디스커버리/시각화:
.vscode/mcp.json
codex config.toml [mcp_servers.*]
Skill의 dependencies.tools(type=mcp) → skill→mcp edge
MVP 실행 엔진은 제외. 대신 “설계(그래프)+검증(리스크/termination/의존성)”에 집중.
7) Validation(필수): 무한루프/오류/리스크 방지 규칙
interaction은 termination 없으면 저장/실행 금지
debate/critic/negotiation 패턴은 기본 timeout_ms 반드시 설정
blackboard는 retention policy(최소 keep_last_n 또는 keep_last_days) 필수
broker/router는 rate limit 옵션 필수(기본 10 msg/min)
8) 관측성(Observability) MVP 요구
모든 interaction step을 이벤트 로그로 기록(로컬 JSONL)
저장 위치: .agentcanvas/logs/<flow>/<date>.jsonl
이벤트 스키마(초안):
{"ts": 0, "flow":"...", "interactionId":"i1", "edgeId":"e1", "event":"configured", "data":{...}}
{"ts": 1, "flow":"...", "interactionId":"i1", "edgeId":"e1", "event":"simulated_step", "step":1, "note":"..."}
9) Deliverables / DoD
9.1 패턴 산출물
 docs/interaction-patterns/patterns/에 20개 패턴 문서
 resources/patterns/에 20개 템플릿(JSON)
9.2 확장 기능
 Interaction edge + system node 렌더링
 패턴 드래그/삽입 가능
 edge inspector로 파라미터 편집 가능
 flows YAML 저장/로드 가능
 validation(termination 필수) 동작