0) 너가 하려는 방식의 “계약(Contract)” 먼저 고정
샌드박스 디렉터리 규약(추천)

워크스페이스 루트 기준:

.agentcanvas/
  sandboxes/
    <runId>/
      <agentIdSanitized>/
        input/         # 오케스트레이터가 복사해준 기준본(읽기 전용 취급)
        work/          # 워커가 실제 수정하는 공간 (워커 homeDir)
        proposal/
          proposal.json
          changes.patch
          summary.md
          test.log      # 선택


워커는 work/만 수정

input/은 baseline(기준본)

오케스트레이터는 proposal/*를 읽고, OK면 메인 워크스페이스에 apply

1) AgentCanvas에서 “반드시” 바꿔야 하는 1순위: 워커 cwd 격리

AgentCanvas 타입에 이미 AgentRuntime.cwdMode?: "workspace" | "agentHome"가 있고, AgentProfile에 homeDir도 있어. 즉 “워커는 homeDir에서만 실행”이 모델링 가능해.

그런데 현재는 새 커스텀 에이전트 만들 때 runtime 기본값이 항상 cwdMode: "workspace" 로 박혀있어.
그리고 CLI 실행은 spawn(..., { cwd: input.workspacePath })로 cwd를 그대로 쓰고 있음.

✅ 고쳐야 할 것 (핵심)

오케스트레이터: cwdMode: "workspace"

워커: cwdMode: "agentHome" + homeDir = .../sandboxes/<runId>/<agentId>/work

(A) createCustomAgentProfile 기본값 수정 (최소 패치)

extension/src/services/agentProfileService.ts에서 지금 runtime을 항상 workspace로 두고 있으니
아래처럼 role/isOrchestrator에 따라 기본값을 갈라줘.

// agentProfileService.ts 내부 createCustomAgentProfile(...)
const isOrchestrator = input.isOrchestrator ?? role === "orchestrator";

runtime: {
  kind: "cli",
  backendId: "auto",
  cwdMode: isOrchestrator ? "workspace" : "agentHome",
},


이렇게만 해도 “워커 CLI가 기본적으로 메인 루트에서 도는” 사고 확률이 확 줄어.

(B) CLI 실행 호출부에서 cwd를 “에이전트 기준”으로 resolve

executeCliPrompt는 workspacePath를 cwd로 바로 쓰니까
호출부에 아래 함수 하나 두고 무조건 이걸 통해 cwd를 결정해.

import type { AgentProfile } from "../types";

export function resolveAgentCwd(agent: AgentProfile, workspaceRoot: string): string {
  const runtime = agent.runtime;
  if (runtime?.kind === "cli" && runtime.cwdMode === "agentHome") {
    return agent.homeDir;
  }
  return workspaceRoot;
}

2) 오케스트레이터가 “파일 스냅샷 복사” 해주는 SandboxService 추가
목표

오케스트레이터가 선택한 파일 목록(예: src/foo.ts, package.json 등)을

input/ 과 work/에 동일하게 복사

워커는 work/만 건드림

최소 API(추천)

extension/src/services/sandboxService.ts 같은 파일 하나 만들고:

prepareSandbox({ workspaceRoot, runId, agentId, files: string[] })

getSandboxPaths({ workspaceRoot, runId, agentId })

구현 시 꼭 넣을 방어 로직

files는 반드시 워크스페이스 루트 기준 상대경로만 허용

.. 포함 금지

절대경로 금지

.agentcanvas/, .git/, node_modules/, dist/ 같은 건 기본 차단(원하면 allow)

이거 안 하면 워커가 “복사 대상 파일 목록”에 민감 파일을 끼워넣는 식으로도 흐트러질 수 있음.

3) 워커가 제출할 Proposal 포맷 고정

현재 AGENT_COMMS의 HANDOFF는 필드가 너무 짧아서( Context/Goal/DoD/Files/Next 정도 ) “메인 반영”에 필요한 정보가 부족해.

✅ HANDOFF에 최소한 아래를 추가해 (강추)
HANDOFF
Context:
Goal:
DoD:
SandboxWorkDir: .agentcanvas/sandboxes/<runId>/<agentId>/work
ProposalJson:   .agentcanvas/sandboxes/<runId>/<agentId>/proposal/proposal.json
ChangedFiles:
- src/...
Tests:
- (선택) ...
Next:
- Orchestrator: review + apply or request changes

proposal.json (권장 스키마)
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
    { "path": "src/foo.ts", "status": "modified" }
  ],
  "notes": "..."
}


base.gitHead는 오케스트레이터가 prepareSandbox 할 때 git rev-parse HEAD로 저장해두면 좋아.
(나중에 “기준 버전이 바뀌었는데 apply하려는” 문제를 잡아줌)

4) Proposal 생성(패치 만들기): “input vs work” 디프를 표준화
제일 쉬운 방법(추천): git diff --no-index로 patch 생성

샌드박스는 git repo 아니어도 됨

통합 diff(unified diff) 형태로 나와서 리뷰/적용이 쉬움

다만 git diff --no-index input work 하면 패치 안에 경로가 a/input/... b/work/...로 나오기 쉬워서,
apply 전에 경로 prefix를 제거해야 함.

흐름

git diff --no-index --binary <inputDir> <workDir> 실행

diff 텍스트에서 a/input/ → a/, b/work/ → b/ 변환

proposal/changes.patch로 저장

이 “prefix strip”을 표준화하면, 오케스트레이터는 워크스페이스 루트에서 git apply로 바로 반영 가능.

5) 오케스트레이터 Apply 단계: “검토 → check → apply” 3단계로 고정
apply 함수에서 무조건 해야 하는 것

git apply --check 로 먼저 적용 가능 여부 확인

실제 적용 (git apply)

실패 시: 에러 출력 + 메인 파일은 건드리지 않음(원자성)

--check가 있으면, 리뷰는 통과했는데 적용 단계에서 깨지는 케이스를 초기에 잡음.

apply 시 필수 안전검사(자동)

patch가 건드리는 파일 경로가:

.. 포함하는지

절대경로인지

.agentcanvas/ 같은 내부 폴더인지

허용 리스트/허용 디렉터리 밖인지

이 검사 덕분에
“워커가 복사받지 않은 파일을 새로 만들어서(동일 경로) 메인 파일을 덮어쓰는” 사고도 줄일 수 있어.

6) (권장) 로그/추적까지 AgentCanvas 방식에 맞게 남기기

AgentCanvas는 이미 .agentcanvas/logs/... JSONL 로깅이 있고
런 단위로 .agentcanvas/runs/... 저장도 있어.

Proposal 워크플로우도 최소한 다음 이벤트는 남기는 게 좋아:

proposal_created

proposal_reviewed

proposal_applied / proposal_rejected

RunEvent 타입을 확장하기 싫으면, 기존 run_log나 node_output에 meta로 넣어도 충분히 추적 가능해.

7) 최종적으로 너 시스템이 “깔끔하게 굴러가는” 실행 순서 예시

오케스트레이터가 run 시작(runId 생성)

오케스트레이터가 작업 범위 파일 선정 (예: src/a.ts, src/b.ts, package.json)

prepareSandbox()로 input/ + work/ 생성 및 복사

워커 agent:

homeDir = .../work

cwdMode = agentHome

work/만 수정

워커가 proposal/summary.md 작성 + changes.patch 생성 + proposal.json 작성

워커가 HANDOFF로 ProposalJson 경로 전달

오케스트레이터:

patch 리뷰

git apply --check

OK면 git apply

메인에서 테스트/빌드

결과 로그 기록

바로 적용 가능한 “최소 구현 체크리스트”

 워커 기본 cwdMode를 agentHome로 변경 (createCustomAgentProfile)

 CLI 실행 시 cwd를 resolveAgentCwd()로 결정

 sandboxService.prepareSandbox() 구현 (input/work 복사)

 proposalService.createProposal() 구현 (git diff --no-index + prefix strip)

 proposalService.applyProposal() 구현 (git apply --check → apply + 경로검사)

 AGENT_COMMS.md HANDOFF 확장