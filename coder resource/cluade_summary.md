좋아. **“터미널(CLI)에서만”** 쓰는 전제로, Claude Code 문서 핵심을 **기능 → (어디에/어떻게 설정) → 예제**까지 한 번에 정리해줄게.
(엔터프라이즈/웹/데스크탑 관련은 뺐어.)

---

## 1) 시작/업데이트/버전

### 실행

```bash
claude
claude "이 프로젝트 설명해줘"   # REPL 시작 + 첫 프롬프트
```

### 업데이트 / 버전

```bash
claude update
claude -v     # 또는 claude --version
```

---

## 2) 세션(대화) 이어가기: continue / resume / rename / fork

Claude는 **로컬에 세션을 저장**해서, 다음날 다시 이어갈 수 있음. 문서에서 추천하는 패턴은 “세션을 브랜치처럼 다루기”.

### 이어가기

```bash
claude -c                 # 현재 디렉토리의 최근 세션 이어가기
claude --continue         # 동일
```

### 세션 선택/재개

```bash
claude --resume           # 최근 세션 중 선택
claude -r "auth-refactor" "이 PR 마무리해줘"   # 이름/ID로 재개하며 프롬프트
```

### 세션 이름 붙이기 (REPL 안에서)

```text
/rename oauth-migration
```

### 분기(fork)

```bash
claude --resume abc123 --fork-session
```

---

## 3) Headless(스크립트/자동화) 모드: `-p` + 출력 포맷

터미널 자동화는 사실상 이게 핵심이야.

### 한 번 질의하고 종료

```bash
claude -p "이 프로젝트가 뭐 하는지 요약해줘"
```

### 파이프 입력도 가능

```bash
cat logs.txt | claude -p "에러 원인 분석하고 해결책 제안해줘"
```

### 구조화 출력(JSON)

```bash
claude -p "API 엔드포인트 목록을 뽑아줘" --output-format json
```

### 스트리밍(JSON) (실시간 처리)

```bash
claude -p "이 로그 분석해줘" --output-format stream-json --include-partial-messages
```

### 예산/턴 제한

```bash
claude -p "테스트 실패 원인만 딱 찾아줘" --max-turns 3 --max-budget-usd 5.00
```

### JSON 스키마 강제(자동화에서 매우 유용)

```bash
claude -p \
  --json-schema '{"type":"object","properties":{"files":{"type":"array","items":{"type":"string"}}},"required":["files"]}' \
  "수정이 필요한 파일 경로만 files 배열로 출력해줘"
```

---

## 4) 시스템 프롬프트/룰 주입: system-prompt / append-system-prompt

CLI에서 “기본 Claude Code 시스템 프롬프트”를 건드리는 방법 4가지.

### 기본 프롬프트를 완전히 교체(강함)

```bash
claude --system-prompt "너는 타입힌트 강제 Python 전문가야"
```

### 파일로 교체(재현성/버전관리 좋음, print 모드)

```bash
claude -p --system-prompt-file ./prompts/reviewer.txt "이 코드 리뷰해줘"
```

### 기본 프롬프트 뒤에 덧붙이기(권장)

```bash
claude --append-system-prompt "항상 TypeScript로 작성해"
claude -p --append-system-prompt-file ./extra-rules.txt "질문"
```

---

## 5) 권한/안전: permission-mode / allowedTools / tools

Claude Code는 기본적으로 **파일쓰기/명령실행/MCP 툴 등 위험 행동마다 승인 요청**함.

### 권한 모드(대표)

```bash
claude --permission-mode plan          # 읽기/계획 중심 (변경 최소화)
claude --dangerously-skip-permissions  # 모든 승인 스킵(주의)
```

### “스킵 옵션만” 열어두고 모드랑 조합(안전한 편)

```bash
claude --permission-mode plan --allow-dangerously-skip-permissions
```

### 허용 도구 allowlist (승인 없이 실행)

```bash
claude --allowedTools "Bash(git diff *)" "Bash(git log *)" "Read"
```

### 아예 사용 가능한 도구를 제한

```bash
claude --tools "Bash,Edit,Read"
claude --tools ""          # 모든 툴 비활성(완전 대화형만)
claude --tools "default"   # 기본 전체
```

---

## 6) Git worktree로 격리 세션 만들기: `-w / --worktree`

여러 작업을 병렬로 할 때 충돌을 줄이는 핵심 기능.

```bash
claude -w feature-auth
# worktree 위치: <repo>/.claude/worktrees/<name>
```

---

## 7) 프로젝트 “기억/규칙” 넣기: `CLAUDE.md` + `/init`

Claude가 **세션 시작할 때 항상 읽는 규칙 파일**.

### 자동 생성

```text
/init
```

### 어디에 두나(중요)

* `~/.claude/CLAUDE.md` : 모든 프로젝트 공통
* `./CLAUDE.md` : 프로젝트 루트(깃에 커밋해서 팀 공유)
* 하위 디렉토리에도 둘 수 있음(모노레포에서 해당 폴더 작업 시 on-demand 로딩)

### 예시(CLAUDE.md)

```md
# Code style
- Use ES modules (import/export), not CommonJS
- Prefer destructured imports (import { foo } from 'bar')

# Workflow
- Run typecheck after a series of changes
- Prefer single tests instead of full suite
```

### 다른 파일 끌어오기(문서/규칙 분리)

```md
See @README.md and @docs/git-instructions.md
```

---

## 8) Skills(슬래시 커맨드): `.claude/skills/<name>/SKILL.md`

“필요할 때만 로딩되는” 재사용 워크플로우/규칙.
CLAUDE.md가 무거워지는 걸 막는 핵심 도구.

### 만들기

```bash
mkdir -p ~/.claude/skills/explain-code
```

### 예시: `~/.claude/skills/explain-code/SKILL.md`

```md
---
name: explain-code
description: Explains code with visual diagrams and analogies.
---

When explaining code, always include:
1) Start with an analogy
2) Draw an ASCII diagram
3) Walk step-by-step
4) Highlight a gotcha
```

### 호출

```text
/explain-code src/auth/login.ts
```

---

## 9) Hooks(자동 강제 실행): `.claude/settings.json` / `~/.claude/settings.json`

Hook은 “LLM이 알아서 하길 기대하는 것”이 아니라
**특정 이벤트에 쉘 커맨드를 *무조건* 실행**시키는 장치야. (가드레일/자동화 핵심)

### 9.1 예제 1) 파일 편집 후 자동 포맷(Prettier)

`PostToolUse` + `Edit|Write` 매처로 “Claude가 편집한 뒤”만 실행.

**`.claude/settings.json`**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

> 참고: 예제는 `jq`를 사용하니 로컬에 설치 필요.

### 9.2 예제 2) 민감 파일 수정 차단(PreToolUse에서 exit 2)

**1) 스크립트 작성:** `.claude/hooks/protect-files.sh`

```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROTECTED_PATTERNS=(".env" "package-lock.json" ".git/")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH matches protected pattern '$pattern'" >&2
    exit 2   # <- 이 코드가 “차단”
  fi
done
exit 0
```

```bash
chmod +x .claude/hooks/protect-files.sh
```

**2) hook 등록:** `.claude/settings.json`

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh"
          }
        ]
      }
    ]
  }
}
```

### 9.3 예제 3) compaction(요약) 후 컨텍스트 재주입(SessionStart matcher=compact)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Reminder: use Bun, not npm. Run bun test before committing.'"
          }
        ]
      }
    ]
  }
}
```

### 9.4 예제 4) 알림(Notification)

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude needs input\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

### Hook을 UI로 만들기(터미널 내)

```text
/hooks
```

---

## 10) Subagents(서브에이전트): `.claude/agents/<name>.md` 또는 `--agents JSON`

“읽기 많이 하는 조사/리서치”를 메인 컨텍스트에서 분리해서
**요약만 가져오는 워커**로 쓰는 게 핵심 가치.

### 10.1 파일로 정의: `.claude/agents/code-reviewer.md`

```md
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. Provide specific, actionable feedback on quality, security, and best practices.
```

### 10.2 CLI에서 즉석 정의(세션 한정)

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer. Focus on code quality, security, and best practices.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  }
}'
```

> `--agents` JSON 필드는 서브에이전트 frontmatter와 동일한 개념(도구 제한, 모델 지정, maxTurns 등).

---

## 11) MCP(외부 툴 연결): `claude mcp add/list/get/remove` + `/mcp`

터미널에서 외부 도구(깃허브/DB/노션/슬랙 등)를 연결하는 표준.

### 추가(중요: 옵션은 서버명 **앞에**, `--` 뒤는 실행 커맨드)

```bash
claude mcp add --transport stdio myserver -- npx server
claude mcp add --transport stdio --env KEY=value myserver -- python server.py --port 8080
```

### 관리

```bash
claude mcp list
claude mcp get github
claude mcp remove github
```

### 세션 안에서 상태/인증 확인

```text
/mcp
```

### scope 팁

* `--scope local`(기본): 현재 프로젝트에서 나만
* `--scope project`: `.mcp.json`로 프로젝트 공유
* `--scope user`: 모든 프로젝트에서 나만

---

## 12) 디버깅/로그

```bash
claude --verbose
claude --debug "api,mcp"
```

---

# 추천 “터미널-only” 기본 세팅(실전 템플릿)

### (A) 프로젝트 루트에 최소 3개만 깔면 생산성 급상승

1. `./CLAUDE.md` : 빌드/테스트/스타일(짧게)
2. `./.claude/settings.json` : hooks(포맷/차단/테스트)
3. `./.claude/agents/` : code-reviewer / debugger 같은 서브에이전트

### (B) 예시: 안전한 자동화 조합

* 위험 파일 차단(PreToolUse)
* 편집 후 prettier(PostToolUse)
* “Stop(응답 끝)”에서 테스트 돌리게(원하면 추가 가능)

---

원하면 내가 네가 쓰는 워크플로우(“오케스트레이터만 메인 수정, 워커는 proposal만”)에 맞춰서:

* **PreToolUse**로 워커의 `Edit/Write` 전부 차단하고,
* 워커는 **patch/proposal 파일만 생성**하게 유도하고,
* 오케스트레이터가 **Stop/TaskCompleted 훅**에서 “patch 적용 + 테스트 + git diff 리뷰”를 강제

이렇게 **바로 복붙 가능한 `.claude/settings.json` + 서브에이전트 2~3개 템플릿**으로 묶어서 만들어줄게.

## 코드

A) 기본 내장 커맨드 (Built-in)

/clear
현재 대화 히스토리(컨텍스트)를 비움.

/compact [instructions]
대화를 요약/압축(compact)해서 컨텍스트를 줄임. 필요하면 요약의 “초점 지시문”을 함께 전달.

/config
설정 UI(Config 탭) 열기.

/context
현재 컨텍스트 사용량을 시각화(그리드 형태).

/cost
현재 세션의 토큰 사용/비용 통계 표시(주로 API 사용자용).

/debug [description]
세션 디버그 로그를 읽어서 문제를 진단. (원하면 증상을 텍스트로 덧붙여 진단 정확도↑)

/doctor
Claude Code 설치/환경 상태 점검(헬스 체크).

/exit
REPL 종료.

/export [filename]
현재 대화를 파일 또는 클립보드로 내보내기.

/help
사용 도움말.

/init
프로젝트에 CLAUDE.md 가이드/초기 구성을 생성.

/mcp
MCP 서버 연결 관리 + OAuth 인증 관리.

/memory
CLAUDE.md 메모리 파일 편집 흐름(프로젝트 규칙/기억 관리).

/model
모델 선택/변경(변경은 즉시 적용).

/permissions
권한(도구/파일/도메인 등) 규칙을 확인/갱신.

/plan
즉시 Plan 모드로 전환(보통 “계획/분석 중심, 변경 최소화”에 유리).

/rename `<name>`
현재 세션 이름 변경.

/resume [session]
세션 ID/이름으로 재개하거나 세션 피커 열기.

/rewind
체크포인트를 이용해 대화/코드를 되돌리거나, 특정 지점부터 요약 상태로 재구성.

/stats
일별 사용 패턴, 세션 히스토리, streak, 모델 선호 등을 시각화(구독 플랜 사용자용).

/status
설정 UI(Status 탭) 열기: 버전/모델/계정/연결 상태 등.

/statusline
상태줄 UI 설정.

/copy
직전 assistant 응답을 클립보드로 복사.

/tasks
백그라운드 작업 목록/관리.

/teleport
claude.ai 쪽 원격 세션을 CLI로 가져오기(구독자 기능으로 안내됨).

/desktop
CLI 세션을 Claude Code Desktop 앱으로 넘김(※ 너는 터미널만 쓴다 했으니 “존재만” 알면 됨).

/theme
색 테마 변경.

/todos
현재 TODO 목록 표시.

/usage
(구독 플랜용) 사용 한도/레이트리밋 상태 표시.

B) 문서 다른 곳에서 “추가로 설명된” CLI 슬래시 커맨드

/chrome
Chrome 연동 상태 확인/권한 관리/연결(브라우저 자동화 관련). --chrome 플래그와 연동되는 기능.

/ide
외부 터미널에서 실행 중이어도 JetBrains IDE 통합 기능을 붙이기 위한 연결 커맨드.

/add-dir
현재 세션에서 “추가 디렉토리”를 작업 범위(읽기/권한 규칙 적용 범위)로 확장.

/allowed-tools
도구별 권한 규칙(예: 어떤 Bash/Read/Edit/MCP 호출을 자동 허용할지)을 설정/관리하는 진입점.

/agents
서브에이전트(subagent) 관리 UI 열기(생성/편집/도구 제한/모델 지정 등).

/agent
서브에이전트 생성/워크플로우 진입(문서에서 /agents와 함께 설명됨).

/vim
입력창을 vim 스타일 편집 모드로 토글(또는 /config에서 영구 설정).

C) “동적으로 나타나는” / 커맨드 규칙 (설치/연결 상태에 따라 목록이 늘어남)

/`<skill-name>`
네가 만든 커스텀 skill(예: .claude/skills/...) 또는 플러그인이 제공하는 skill이 / 목록에 커맨드처럼 노출됨.

/mcp__`<server>`__`<prompt>`
MCP 서버가 prompt를 커맨드처럼 노출하는 경우 자동으로 생기는 형태(연결된 MCP 서버에 따라 동적으로 추가/삭제됨).

/`<plugin-namespace>`:`<skill>` (플러그인/마켓플레이스 구조에 따라)
플러그인에서 노출하는 커맨드가 네임스페이스를 붙여 나타날 수 있음.
