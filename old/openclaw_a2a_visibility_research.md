# OpenClaw에서 “에이전트끼리 소통(A2A)”을 사용자에게 **보이게** 만드는 방식 리서치 (요약 + 구현 가이드)

> 목적: **Codex에게 작업 지시**로 바로 넣을 수 있도록, OpenClaw가 멀티에이전트(서브에이전트/에이전트↔에이전트) 협업을 **사용자에게 어떻게 노출**하는지 정리하고,
> 이를 AgentCanvas 같은 “오케스트레이터/워커 + proposal(패치+요약)” 구조에 **어떻게 이식할지**까지 구체적인 구현 체크리스트로 제공한다.  
> 기준 시점: 2026-02-19 (문서/코드 기반)

---

## 1) OpenClaw의 A2A(Agent-to-Agent) 가시화 UX는 “3겹”으로 되어있다

OpenClaw는 단순히 “에이전트가 서로 메시지 주고받는다”가 아니라, **사용자가 납득 가능한 형태로** 그 과정을 보여주기 위해 다음 3개의 레이어를 사용한다.

### (A) **도구(툴) 카드**로 “누가 무엇을 시켰는지”를 UI에서 스트리밍 표시
- Control UI(브라우저)와 TUI(터미널 UI)는 **tool call / tool output을 카드 형태**로 채팅 로그에 표시한다.
- 즉, `sessions_spawn`, `sessions_send` 같은 A2A 툴을 호출하면 **사용자는 채팅 UI에서 “spawn/send가 호출되었고 어떤 인자가 들어갔는지 + 결과가 무엇인지”**를 볼 수 있다.

**근거**
- Control UI 기능: “Stream tool calls + live tool output cards in Chat” (docs)  
- TUI: “Tool calls show as cards with args + results… partial updates stream into the same card” (docs)

### (B) **Announce(발표/보고) 단계**로 “서브에이전트 결과를 사용자 채널로 요약 전달”
OpenClaw의 핵심은 “서브에이전트가 끝나면 **자동으로** 상위(요청자)에게 결과를 ‘announce step’으로 보내는 것”이다.

- `sessions_spawn`:
  - 새 세션(`agent:<id>:subagent:<uuid>`)에서 작업시키고,
  - 완료 후 **announce step**을 실행해 요청자 채널로 결과를 포스트한다.
- `sessions_send`:
  - 다른 세션으로 메시지를 보내고,
  - optional로 “reply-back ping-pong” 후,
  - 마지막에 target agent가 **announce step**을 실행해서 (원하면) 채널에 발표한다.

여기서 “사용자에게 보여주기”의 포인트는:
1) **서브에이전트 내부 대화 전체를 사용자에게 그대로 보여주는 게 아니라**,  
2) 기본은 “announce로 결과를 요약해 올려주고”,  
3) 사용자가 원하면 “세션/트랜스크립트를 열어” 상세를 볼 수 있게 한다는 점이다.

### (C) **세션/트랜스크립트 탐색**으로 “필요하면 내부 대화를 펼쳐 볼 수 있게”
- OpenClaw는 모든 대화(툴 호출/결과 포함)를 **세션별 JSONL 트랜스크립트**로 저장한다.
- `sessions_list` 결과에는 `transcriptPath`가 포함되며, `sessions_history`로 특정 세션의 메시지들을 가져올 수 있다(툴 메시지 포함 옵션도 있음).
- UI(세션 picker / 세션 목록)를 통해 사용자가 **서브에이전트 세션 자체를 열어서** 내부 로그를 볼 수 있다.

---

## 2) OpenClaw의 “A2A를 사용자에게 보여주기” 핵심 메커니즘

### 2.1 sessions_spawn: “격리된 세션에서 실행 + announce로 상위에게 보고”
**문서의 정의(핵심)**
- “Spawn a sub-agent run in an isolated session and announce the result back to the requester chat channel.”
- child sessionKey 형태: `agent:<agentId>:subagent:<uuid>`
- non-blocking: 즉시 accepted 반환 후 백그라운드 실행, 완료되면 announce 수행.

**Nested(2단계) 오케스트레이터 패턴**
- depth-2 worker → depth-1 orchestrator → main 으로 **announce chain**이 흐른다.
- 각 레벨은 “직계 자식 announce만” 보며, 상위는 이를 종합한다.

**announce 템플릿**
- docs에 따르면 “Status / Result / Notes + stats line + sessionKey/sessionId/transcript path” 형태로 정규화된 결과가 올라온다.

> AgentCanvas 관점에서 중요한 벤치마크:  
> “워커가 작업을 끝내면 오케스트레이터에게 ‘결과(요약+근거+산출물 포인터)’를 push 하고, 오케스트레이터가 사용자에게 보여줄지/적용할지 결정”  
> → 이 흐름이 OpenClaw의 `announce chain`과 거의 동일.

### 2.2 sessions_send: “다른 세션에 메시지 + ping-pong + announce”
OpenClaw는 `sessions_send`를 단순 send가 아니라 **A2A 프로토콜**처럼 정의한다.

문서 요약:
- timeoutSeconds=0이면 fire-and-forget (accepted)
- timeoutSeconds>0이면 기다렸다가 reply를 돌려줄 수 있음
- inter-session 메시지는 트랜스크립트에서 구분할 수 있도록 provenance를 찍는다
- 그리고 “reply-back loop(핑퐁)”을 수행하고, 마지막에 announce step을 수행할 수 있다.

코드 상으로도 `inputProvenance.kind = "inter_session"`가 들어간다(즉 transcript consumer가 “이건 유저 입력이 아니라 에이전트 간 라우팅된 메시지”라고 구분 가능).

---

## 3) OpenClaw UI에서 A2A가 보이는 지점들

### 3.1 Control UI (브라우저)
- 채팅 탭: tool call / tool output 카드 스트리밍(= sessions_spawn/send가 UI에 그대로 나타남)
- 세션 탭: sessions.list 기반으로 세션 목록 조회 및 세션별 토글/설정
- 로그 탭: gateway 로그를 tail 하며 상태/에러 추적

### 3.2 TUI (터미널)
- 채팅 로그에서 tool card를 토글로 펼치고/접을 수 있음
- agent picker / session picker 로 세션 전환 가능 (기본적으로 “현재 agent의 세션들” 중심)

---

## 4) 코드에서 드러나는 “사용자에게 보여주기” 설계 포인트 (구현 디테일)

> 아래는 OpenClaw 공식 repo `openclaw/openclaw`의 소스(raw)에서 확인되는 동작을, “왜 UX적으로 중요한가” 관점으로 뽑은 것이다.

### 4.1 transcript에서 “에이전트↔에이전트 메시지”를 구분하는 provenance
`sessions_send`가 gateway `agent` 호출 시 `inputProvenance.kind = "inter_session"` + source 정보를 넣는다.

**의미**
- transcript를 렌더링할 때:
  - user message vs agent-to-agent message를 구분 표시 가능
  - UI에서 “내가 입력한 메시지”와 “오케스트레이터가 워커에게 보낸 명령”이 섞이는 혼란을 줄임

### 4.2 announce 메시지를 “두 개”로 분리: 내부용(triggerMessage) vs 사용자용(completionMessage)
`subagent-announce.ts`를 보면:
- 내부용: `[System Message] ... Result: ... Stats: ...` + “이걸 바탕으로 정상적인 톤으로 사용자에게 업데이트를 보내라” 같은 instruction을 붙여서 **상위 세션에게 inject**한다.
- 사용자용(Completion-mode): `✅ Subagent <name> finished

<findings>` 같이 “그대로 send 해도 되는” 메시지를 별도로 만든다.

**의미**
- “내부 디버그/추적 정보”와 “사용자에게 보여줄 메시지”를 분리해서,
  - 사용자에게 노이즈(세션ID/로그/통계)가 보이지 않게 하면서도
  - 시스템은 추적가능한 정보를 유지한다.

### 4.3 요청자 세션이 바쁘면 announce를 **queue/steer**해서 전달 순서를 안정화
`subagent-announce.ts`에는 “embedded run active면 큐잉” 로직이 있다(steer/followup/interrupt 모드 등).

**의미**
- 멀티에이전트가 병렬로 끝날 때,
  - 메시지가 섞여서 도착하거나,
  - 사용자 채널에 스팸처럼 쏟아지는 것을 완화한다.

---

## 5) AgentCanvas/당신의 목표 구조에 바로 적용할 수 있는 구현 제안 (OpenClaw 패턴 이식)

> 당신이 말한 목표:  
> - 오케스트레이터만 전체 프로젝트 폴더 접근  
> - 워커는 하위 폴더(샌드박스)에서 작업  
> - 워커는 메인 파일 직접 편집 X  
> - 워커는 “proposal(패치+요약)”만 제출  
> - 오케스트레이터가 검토 후 메인 코드에 적용  
> - 에이전트 간 소통을 사용자에게 보여주는 방법이 필요

OpenClaw 패턴을 그대로 가져오면 다음이 “정답에 가깝다”:

### 5.1 “세션”을 워커 단위로 만들고, **모든 통신을 이벤트 로그로 남긴다**
OpenClaw처럼:
- orchestrator session
- worker session N개 (각각 별도 transcript)
- 각 session transcript는 JSONL(append-only)로 저장

추가로, 당신의 요구(“proposal만 제출”)에 맞게:
- worker→orchestrator 통신은 **반드시** `proposal` 이벤트(패치+요약+검증결과)로만 허용
- worker가 파일을 직접 수정하지 않도록:
  - orchestrator가 필요한 파일만 sandbox에 복사
  - worker는 그 복사본 위에서 diff/patch 생성
  - orchestrator가 patch를 적용

### 5.2 OpenClaw의 announce를 “승인 게이트”가 있는 2단계로 바꾼다
OpenClaw는 기본이 “완료되면 자동 announce → 사용자 채널로 바로 포스트”인데,
당신은 “오케스트레이터 검토 후 적용”을 원하므로:

- Worker finished → **announce to orchestrator only** (internal)
- Orchestrator review:
  - patch 적용 여부 결정
  - 안전/테스트/빌드 확인
  - 최종 사용자 메시지 작성
- Orchestrator → user: “승인된 변경사항”만 공유

즉, OpenClaw의 announce chain은 유지하되,
**deliver=true를 사용자 채널로 보내기 전에 오케스트레이터 승인 단계를 강제**한다.

### 5.3 UI/문서(.md)로 사용자에게 “에이전트 협업”을 보여주는 최소 스펙
OpenClaw에서 사용자가 보는 것은 사실상:
1) tool card(=spawn/send/proposal 제출 이벤트)
2) announce 메시지(=요약 결과)
3) 필요 시 세션 탐색(=세부 로그)

AgentCanvas에서도 같은 3종을 제공하면 된다:

#### (1) “타임라인형 협업 로그” (사용자 노출)
- run id / worker id / start~end / status
- worker가 한 일 요약
- 제출된 proposal 링크(패치)
- orchestrator의 결정(적용/거절/수정요청)
- 최종 적용 결과(커밋/파일 변경 목록)

#### (2) “세션별 상세 로그” (내부지만 사용자 열람 가능)
- orchestrator session transcript
- worker session transcript (sandbox 내부 작업 로그)
- inter-agent 메시지는 provenance로 표시:
  - user_input / orchestrator_to_worker / worker_proposal / system

#### (3) “export to markdown” (요청하신 .md 형태)
- 위 타임라인과 주요 메시지를 자동으로 markdown으로 렌더링
- 첨부: patch diff(요약만, 전체 diff는 별도 파일 링크)

---

## 6) Codex 작업 지시 체크리스트 (이 문서를 그대로 넣어도 됨)

### 목표
- OpenClaw의 A2A 가시화 패턴을 참고하여,
- AgentCanvas에서 “오케스트레이터/워커” 협업을 사용자에게 투명하게 보여주는 `.md` 기반 리포트/로그 시스템을 설계·구현하라.

### 해야 할 일
1) **세션/런 모델링**
   - orchestrator run (root)
   - worker run (child) 생성 시 childRunId, workerId, sandboxPath 기록
   - 상태: accepted/running/ok/error/timeout

2) **이벤트/트랜스크립트 저장**
   - JSONL 기반으로 append-only 이벤트 로그 저장
   - 각 이벤트에 공통 필드:
     - ts, runId, parentRunId, actor(orchestrator/worker), kind, payload, provenance
   - provenance는 최소 4종:
     - user_input
     - inter_agent_request
     - proposal
     - system

3) **proposal 스키마(필수)**
   - patch (unified diff)
   - summary (무엇을/왜/어떻게)
   - touched_files
   - tests_run + 결과
   - risks/limitations

4) **오케스트레이터 승인 게이트**
   - worker proposal은 자동 적용 금지
   - orchestrator가 검토 후:
     - 적용(apply patch)
     - 수정 요청(추가 작업 spawn/send)
     - 거절(사유 기록)

5) **사용자 노출 .md 생성기**
   - run 종료 시, 협업 로그를 markdown으로 렌더링:
     - “무슨 일이 있었는지” 타임라인
     - 각 worker proposal 요약
     - orchestrator 결정
     - 최종 변경 요약

6) **UI(선택)**
   - 최소한: markdown을 사용자에게 보여줄 수 있는 화면/패널
   - 가능하면 OpenClaw처럼:
     - tool/proposal 카드(접기/펼치기)
     - 세션/런 picker

---

## 7) 참고 링크 (원문)

> 아래 링크들은 Codex가 원문을 확인하면서 구현 디테일을 맞추기 위한 레퍼런스다.

### OpenClaw 공식 문서
- Session tools: https://docs.openclaw.ai/concepts/session-tool
- Sub-agents: https://docs.openclaw.ai/tools/subagents
- Control UI: https://docs.openclaw.ai/web/control-ui
- TUI: https://docs.openclaw.ai/web/tui
- Session management deep dive (transcript JSONL 등): https://docs.openclaw.ai/reference/session-management-compaction
- Logging: https://docs.openclaw.ai/logging

### OpenClaw GitHub (구현 코드)
- sessions_send tool (provenance/inter_session 등): https://raw.githubusercontent.com/openclaw/openclaw/main/src/agents/tools/sessions-send-tool.ts
- subagent announce flow (내부/외부 메시지 분리): https://raw.githubusercontent.com/openclaw/openclaw/main/src/agents/subagent-announce.ts
