1) Claude는 “소통 규칙”을 이렇게 운영한다 (Claude Code 기준)
A. 규칙/메모리는 “계층(Hierarchy)”으로 관리

Claude Code는 “세션 시작 때 자동으로 로드되는 규칙/메모리”를 조직 정책 → 프로젝트 → 개인 계층으로 분리해 둠:

조직 정책(Managed policy): OS별 시스템 경로에 CLAUDE.md를 배포 가능

프로젝트 메모리: ./CLAUDE.md 또는 ./.claude/CLAUDE.md

프로젝트 규칙 모듈: ./.claude/rules/*.md (여러 파일로 쪼개서 자동 로드)

개인 메모리: ~/.claude/CLAUDE.md

개인 프로젝트 로컬: ./CLAUDE.local.md (gitignore 자동)

오토 메모리: ~/.claude/projects/<project>/memory/ (MEMORY.md는 200줄만 로드)

우선순위는 “더 구체적인 규칙이 더 넓은 규칙보다 우선”이고, 상위 디렉터리의 CLAUDE.md는 전체 로드, 하위 디렉터리의 CLAUDE.md는 해당 디렉터리 파일을 읽을 때 “온디맨드”로 로드됨.
또 .claude/rules/*.md는 YAML frontmatter로 paths:(glob) 조건을 걸어 경로별 규칙 적용이 가능함.

B. “컨텍스트(compaction)로 대화 초반 지시가 날아갈 수 있다”를 전제로 설계

Claude Code는 컨텍스트가 차면 오래된 tool output을 먼저 버리고, 필요하면 대화 요약(compaction)을 하며, “초반의 상세 지시가 유실될 수 있으니” 영구 규칙은 CLAUDE.md에 넣으라고 명시함. /context, /compact 같은 커맨드도 제공.
또 MCP 서버는 매 요청마다 tool definition이 붙어서 컨텍스트 비용이 커질 수 있으니, /mcp로 서버별 비용 확인을 권장함.

C. “Skills/서브에이전트/훅”으로 소통과 실행을 분리

Skills: 설명은 세션 시작에 보이지만, 전체 내용은 실제 사용 시 로드(온디맨드). 수동 호출 위주 스킬은 disable-model-invocation: true로 컨텍스트에서 완전히 제외 가능.

서브에이전트(Subagents): 메인 컨텍스트와 분리된 “새 컨텍스트”에서 일하고 요약만 가져오므로, 긴 작업에서 컨텍스트 부하를 줄임.

Hooks: LLM이 “기억해서 실행”하는 게 아니라, 특정 이벤트(PreToolUse 등)에서 결정론적으로 쉘 명령/프롬프트를 실행하거나 도구 호출을 차단할 수 있음.

D. 사용자 혼동이 잦은 부분(공식 문서/이슈로 확인됨)

Claude Skills의 user-invocable은 “/ 메뉴 노출”만 제어하고, 실제 모델 자동 호출 차단은 disable-model-invocation이 담당(그리고 이건 컨텍스트에서 스킬 자체를 제거). 이 구분이 혼동을 낳아서 문서 개선 이슈도 있음.

2) OpenClaw는 “소통 규칙”을 이렇게 운영한다
A. “워크스페이스 파일 맵”이 곧 소통 규칙(파일이 시스템 프롬프트 구성의 중심)

OpenClaw는 워크스페이스를 “에이전트의 집”으로 두고, 표준 파일들을 매 세션 로드:

AGENTS.md: 운영 규칙/우선순위/메모리 사용 방식

SOUL.md: 페르소나/톤/경계

USER.md: 사용자 소개/호칭

TOOLS.md: 로컬 도구/컨벤션 노트(도구 가용성 제어가 아니라 가이드)

HEARTBEAT.md, BOOT.md 등 체크리스트성 파일

또 “워크스페이스는 기본 cwd일 뿐 hard sandbox가 아니다”라고 명시(absolute path로 밖에 접근 가능). 샌드박스가 필요하면 sandbox 설정을 켜야 함.

B. 메모리는 “파일 2층 구조 + compaction 직전 자동 flush”가 핵심

memory/YYYY-MM-DD.md: 일일 로그(append-only), “오늘+어제”를 세션 시작에 읽는 구조

MEMORY.md: 장기 기억(안정적인 사실/결정), 그룹 컨텍스트에는 로드하지 않음(프라이버시)
그리고 compaction 임박 시 보이지 않는(silent) agentic turn으로 메모리 flush를 유도하는 설정(agents.defaults.compaction.memoryFlush)이 있음.

C. “대화/세션”을 강하게 분리하는 게 소통 설계의 중심(특히 멀티유저)

OpenClaw는 “대화 bleed(컨텍스트 유출)”를 주요 문제로 보고:

DM은 dmScope를 per-peer / per-channel-peer로 두어 사용자별 컨텍스트를 분리하라고 가이드

그룹 채팅은 별도 session key로 자동 격리

/status, /context list로 프롬프트에 무엇이 들어갔는지 확인

모델이 루프/스턱이면 /stop으로 run을 kill하고 큐를 비우라고 안내

D. 채널 소통(그룹/멘션) 기본 정책이 명확

OpenClaw는 DM/그룹/멀티 채널 라우팅을 기능으로 내세우고, 그룹은 기본 “멘션 기반 활성화” + allowlist 설정 예시를 제공함.

3) 사용자 리뷰/현장 피드백에서 반복되는 “불만/개선 포인트” (합당한 것만 추려서 요약)
Claude 쪽에서 반복되는 피드백 → 우리가 가져와야 할 것

대화 초반 지시가 compaction으로 유실 → “영구 규칙은 파일로” 강제 (CLAUDE.md 철학)

MCP 서버를 여러 개 붙이면 컨텍스트 비용이 급증 → “MCP cost 가시화 + 최소 서버 원칙”

스킬 호출 제어 필드 혼동(user-invocable vs disable-model-invocation) → UI/문서에서 경고/툴팁/프리셋 제공

결정론적 자동화 필요 → hooks 같은 “항상 실행되는 룰 엔진” 패턴 도입

“업무 끝날 때 회고/개선”이 실제로 효율을 올린다는 운영 팁(세션 요약 + CLAUDE.md 개선 루프)

OpenClaw 쪽에서 반복되는 피드백 → 우리가 가져와야 할 것

**컨텍스트 유출(멀티유저)**이 흔함 → dmScope, session key, group isolation을 UI에서 기본값/경고로 강제

스턱/무응답/큐 꼬임 → “/stop(킬 스위치) + 큐 상태 시각화 + 진단 로그 바로가기”

워크스페이스/상태 드리프트(여러 workspace 폴더) → “중복 workspace 탐지 경고”를 UX에 반영

스킬 공급망 보안 이슈가 심각 → 설치 전 diff/리뷰, sandbox 권장, 신뢰 배지/스캔 상태 표시가 필수

메모리 flush/compaction 연동이 강점 → “compaction 전 자동 요약/기록(quiet)” 패턴 채택

4) 위 내용을 “우리 프로젝트 공통 소통 규칙(.md)”에 반영한 최종안

아래를 그대로 AGENT_COMMS_AND_OPS.md로 저장해서 “공통 룰(캔버스 오른쪽 위 Common Rules)”에 넣으면 딱 맞아.

# AGENT_COMMS_AND_OPS.md
AgentCanvas — Communication, Memory, and Ops Rules (Claude/OpenClaw-derived)

## 0) Design principles
- **File-first rules**: anything durable goes into .md files, not chat history.
- **Deterministic > probabilistic** for enforcement: prefer hooks/policies over “please remember”.
- **Least context**: keep MCP servers, skills, and rules minimal; load on demand.
- **Isolation by default**: protect users/sessions from context bleed.

---

## 1) Standard response format (all agents)
Use this structure unless the task is trivial:

1) Intent (1 sentence)
2) Assumptions / Inputs (bullets)
3) Plan (3–7 bullets)
4) Actions / Artifacts
   - files changed
   - commands run + results
5) Risks / Safety notes
6) Next steps (or DONE)

---

## 2) Persistent rules & memory (Claude-inspired + OpenClaw-inspired)

### 2.1 What must be written down
- Decisions, preferences, durable facts → `MEMORY.md` (curated)
- Day-to-day running notes → `memory/YYYY-MM-DD.md` (append-only)

OpenClaw does this explicitly and even triggers a pre-compaction “memory flush” reminder turn; adopt the same discipline here. (The agent should not “keep it in RAM”.)

### 2.2 Compaction / context-loss protection
- Assume early conversation details can be lost when context compacts (Claude Code warns about this).
- Therefore:
  - Put stable instructions in .md files (this file + modular rule files).
  - Add a “Compact Instructions” section to the main rules file if needed.
  - Keep rule files short; prefer modularization over one huge file.

### 2.3 Continuous improvement loop (user feedback → rules update)
At the end of any meaningful task, the agent MUST add a short block to today’s log:
- What went wrong / friction points
- What rule/skill would prevent it next time
- Proposed changes (1–3 bullets)

This mirrors real team practice: end-of-session summaries + suggested documentation improvements.

---

## 3) Skills: invocation + safety (Claude skills lessons)
### 3.1 Two toggles that people confuse
- `user-invocable: false` only hides from the slash menu.
- `disable-model-invocation: true` is the real safety gate:
  - it prevents the model from invoking AND removes the skill from context until a human invokes it.

Rule:
- Any “destructive / secret-touching / deployment / credential” skill MUST set `disable-model-invocation: true`.

### 3.2 Tool permissions
- Prefer read-only skills by default.
- If a skill needs tools, declare/limit them (allowed-tools concept).

---

## 4) MCP: minimal servers + context-cost + secrets
### 4.1 Minimal MCP policy
- Default: 0–2 MCP servers only.
- Add more only when it materially reduces risk or time.
- MCP servers can add large tool definitions to every request; track per-server “context cost”.

### 4.2 Secrets policy
- Never store tokens in config files.
- Store only ENV VAR NAMES (e.g., `BEARER_TOKEN_ENV_VAR`) and require users to set env securely.

### 4.3 Security note (why MCP sometimes beats CLI)
For sensitive systems, prefer MCP-style controlled interfaces over raw CLI access, because it can centralize logging and reduce accidental data exposure.

---

## 5) Session isolation + kill switch (OpenClaw lessons)
### 5.1 Isolation by default
If multiple users or channels exist, do NOT share one big session context.
- Use per-user/per-channel session mapping (conceptually like OpenClaw `dmScope: per-channel-peer`).
- Group chats must be isolated from DMs.

### 5.2 Kill switch / stuck run
If the agent is looping or the UI stops showing progress:
- Provide a “Stop current run” action (equivalent to OpenClaw `/stop`).
- Show a visible queue/status indicator:
  - current task
  - last tool call
  - last error
  - retry count

---

## 6) Image handling
- Request screenshots for UI bugs; do not guess small text.
- Never commit sensitive screenshots (tokens, emails, PII). Ask for redaction.

---

## 7) Handoff format (required)
HANDOFF
Context:
Goal:
DoD:
Files:
Next:

(선택) 최근 “유저 리뷰” 참고 링크

OpenClaw 스킬 공급망/보안 이슈는 최근 기사/리서치가 많아서, “스킬 공유 UX”를 만들 때는 아래 같은 관점(설치 전 리뷰/샌드박스/allowlist)이 왜 필요한지 설득 자료로 쓰기 좋음.