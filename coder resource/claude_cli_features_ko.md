# Claude Code CLI 기능 정리 (claude CLI)

> 출처: Claude Code Docs (code.claude.com) — **2026-02-19** 기준으로 문서 내용을 정리  
> 범위: CLI 명령/플래그, 인터랙티브 모드(TUI/REPL), 설정/권한/샌드박싱, 모델/메모리, 훅/플러그인 등 **터미널에서 사용하는 Claude Code(claude) 기능**  
> 참고: 일부 목록(예: `/`로 노출되는 내장 명령)은 문서에서도 “일부만” 표기되는 항목이 있어, 실제 실행 환경에서 `/` 또는 `?`로 전체 목록을 확인할 수 있습니다.

---

## 목차

1. [CLI 한눈에 보기](#cli-한눈에-보기)
2. [CLI 명령어](#cli-명령어)
3. [CLI 플래그(옵션) 전체](#cli-플래그옵션-전체)
4. [Print 모드(비대화형)와 자동화](#print-모드비대화형와-자동화)
5. [인터랙티브 모드 기능](#인터랙티브-모드-기능)
6. [설정 시스템(Scopes/파일/우선순위)](#설정-시스템scopes파일우선순위)
7. [권한(Permissions)과 도구 제한](#권한permissions과-도구-제한)
8. [샌드박싱(Sandboxed bash)](#샌드박싱sandboxed-bash)
9. [모델 설정/별칭/1M 컨텍스트/프롬프트 캐싱](#모델-설정별칭1m-컨텍스트프롬프트-캐싱)
10. [Fast mode](#fast-mode)
11. [메모리 관리(CLAUDE.md & Auto memory)](#메모리-관리claudemd--auto-memory)
12. [Status line 커스터마이징](#status-line-커스터마이징)
13. [키 바인딩(단축키) 커스터마이징](#키-바인딩단축키-커스터마이징)
14. [Hooks(자동화 훅)](#hooks자동화-훅)
15. [Plugins(플러그인) 시스템](#plugins플러그인-시스템)
16. [환경 변수(Environment variables) 전체 목록](#환경-변수environment-variables-전체-목록)
17. [Claude가 사용할 수 있는 기본 도구 목록](#claude가-사용할-수-있는-기본-도구-목록)

---

## CLI 한눈에 보기

Claude Code CLI는 `claude` 명령으로 시작하는 터미널 기반 코딩 에이전트입니다.  
특징적으로:

- **REPL(대화형) 모드**와 **print(비대화형) 모드**를 모두 지원합니다.
- 세션을 디스크에 저장하여 **재개(resume/continue)** 할 수 있고, 세션을 **fork(분기)** 할 수 있습니다.
- 권한(Permissions), 샌드박싱(Sandbox), 훅(Hooks), 플러그인(Plugins), MCP 서버 등을 통해 **보안/자동화/확장성**을 제공합니다.
- 모델 선택(`/model`, `--model`, 환경 변수, settings)과 모델 관련 기능(노력도/1M 컨텍스트/캐싱/fast mode)을 제공합니다.

---

## CLI 명령어

| 명령 | 설명 | 예시 |
|---|---|---|
| `claude` | 인터랙티브 REPL 시작 | `claude` |
| `claude "query"` | REPL 시작 + 첫 프롬프트 전달 | `claude "explain this project"` |
| `claude -p "query"` | **Print 모드**로 실행 후 종료 | `claude -p "explain this function"` |
| `cat file \| claude -p "query"` | 파이프로 들어온 입력을 함께 처리 | `cat logs.txt \| claude -p "explain"` |
| `claude -c` | 현재 디렉터리에서 **가장 최근 대화** 이어가기 | `claude -c` |
| `claude -c -p "query"` | continue + print 모드 | `claude -c -p "Check for type errors"` |
| `claude -r "<session>" "query"` | 세션 ID/이름으로 재개 | `claude -r "auth-refactor" "Finish this PR"` |
| `claude update` | 최신 버전으로 업데이트 | `claude update` |
| `claude mcp` | MCP(Model Context Protocol) 서버 설정/관리 | `claude mcp` |
| `claude plugin <subcommand>` | 플러그인 설치/관리(아래 섹션 참고) | `claude plugin install ...` |

---

## CLI 플래그(옵션) 전체

아래는 문서에 정리된 주요 플래그 전체 목록입니다(설명은 한국어로 요약).

> 표기: `-p`는 `--print`의 별칭, `-c`는 `--continue`, `-r`은 `--resume`입니다.

| 플래그 | 설명 | 예시 |
|---|---|---|
| `--add-dir <dir...>` | Claude가 접근할 **추가 작업 디렉터리**를 추가(존재하는 디렉터리인지 검증) | `claude --add-dir ../apps ../lib` |
| `--agent <name>` | 현재 세션에서 사용할 **agent** 지정(`agent` 설정 override) | `claude --agent my-custom-agent` |
| `--agents <json>` | JSON으로 **서브에이전트(subagents)** 를 동적으로 정의 | `claude --agents '{"reviewer":{...}}'` |
| `--allow-dangerously-skip-permissions` | “권한 프롬프트 완전 스킵”을 **즉시 켜지 않고**, 옵션으로만 활성화 가능하게 함(주의) | `claude --permission-mode plan --allow-dangerously-skip-permissions` |
| `--allowedTools <patterns...>` | **권한 묻지 않고 자동 실행**되는 도구/패턴(도구 자체 제한은 `--tools`) | `"Bash(git log *)" "Read"` |
| `--append-system-prompt <text>` | 기본 시스템 프롬프트 뒤에 텍스트를 **추가**(대화형/print 모두) | `claude --append-system-prompt "Always use TypeScript"` |
| `--append-system-prompt-file <path>` | 파일을 읽어 기본 시스템 프롬프트 뒤에 **추가**(print 전용) | `claude -p --append-system-prompt-file ./extra.txt "query"` |
| `--betas <headers>` | API 요청에 beta 헤더 추가(API 키 사용자) | `claude --betas interleaved-thinking` |
| `--chrome` | Chrome 브라우저 통합 기능 활성화 | `claude --chrome` |
| `--no-chrome` | Chrome 브라우저 통합 기능 비활성화 | `claude --no-chrome` |
| `--continue`, `-c` | 현재 디렉터리의 최근 대화 로드 | `claude --continue` |
| `--dangerously-skip-permissions` | **모든 권한 프롬프트를 스킵**(매우 주의) | `claude --dangerously-skip-permissions` |
| `--debug [filter]` | 디버그 모드(카테고리 필터 가능: `"api,mcp"` 등, `!`로 제외) | `claude --debug "api,mcp"` |
| `--disable-slash-commands` | 세션에서 **스킬/슬래시 커맨드** 전체 비활성화 | `claude --disable-slash-commands` |
| `--disallowedTools <patterns...>` | 도구를 컨텍스트에서 제거하여 **사용 불가**로 만듦 | `"Bash(git diff *)" "Edit"` |
| `--fallback-model <model>` | 기본 모델 과부하 시 지정 모델로 자동 fallback (print 전용) | `claude -p --fallback-model sonnet "query"` |
| `--fork-session` | resume/continue 시 원 세션을 재사용하지 않고 **새 세션 ID로 분기** | `claude --resume abc123 --fork-session` |
| `--from-pr <num\|url>` | 특정 GitHub PR에 연결된 세션을 재개(번호/URL) | `claude --from-pr 123` |
| `--ide` | 시작 시 IDE 자동 연결(가능한 IDE가 1개일 때) | `claude --ide` |
| `--init` | 초기화 훅 실행 후 인터랙티브 모드 시작 | `claude --init` |
| `--init-only` | 초기화 훅만 실행하고 종료 | `claude --init-only` |
| `--include-partial-messages` | 스트리밍 중간 이벤트까지 포함( `--print` + `--output-format=stream-json` 필요) | `claude -p --output-format stream-json --include-partial-messages "q"` |
| `--input-format <text\|stream-json>` | print 모드 입력 형식 | `claude -p --output-format json --input-format stream-json` |
| `--json-schema <schema>` | 워크플로우 종료 후 JSON Schema에 맞춘 **검증된 JSON 출력**(print 전용) | `claude -p --json-schema '{...}' "query"` |
| `--maintenance` | maintenance 훅 실행 후 종료 | `claude --maintenance` |
| `--max-budget-usd <n>` | API 호출에 쓸 최대 비용(USD) 제한(print 전용) | `claude -p --max-budget-usd 5.00 "query"` |
| `--max-turns <n>` | 에이전틱 턴 수 제한(print 전용) | `claude -p --max-turns 3 "query"` |
| `--mcp-config <jsonOrFile...>` | MCP 서버 구성을 JSON 파일/문자열로 로드(공백 구분) | `claude --mcp-config ./mcp.json` |
| `--strict-mcp-config` | `--mcp-config` 에서만 MCP 서버를 로드(기타 설정 무시) | `claude --strict-mcp-config --mcp-config ./mcp.json` |
| `--model <alias\|name>` | 모델 선택(별칭 또는 풀 네임) | `claude --model claude-sonnet-4-6` |
| `--no-session-persistence` | 세션을 디스크에 저장하지 않음(재개 불가, print 전용) | `claude -p --no-session-persistence "query"` |
| `--output-format <text\|json\|stream-json>` | print 모드 출력 형식 | `claude -p "q" --output-format json` |
| `--permission-mode <mode>` | 시작 시 권한 모드 지정 | `claude --permission-mode plan` |
| `--permission-prompt-tool <mcpTool>` | 비대화형 모드에서 권한 프롬프트 처리를 MCP 도구로 위임 | `claude -p --permission-prompt-tool mcp_auth_tool "q"` |
| `--plugin-dir <dir>` | 세션 동안만 특정 디렉터리에서 플러그인 로드(반복 가능) | `claude --plugin-dir ./my-plugins` |
| `--print`, `-p` | 인터랙티브 없이 응답만 출력 | `claude -p "query"` |
| `--remote <task>` | claude.ai에서 새 **웹 세션** 생성 | `claude --remote "Fix the login bug"` |
| `--resume`, `-r` | ID/이름으로 세션 재개(또는 picker) | `claude --resume auth-refactor` |
| `--session-id <uuid>` | 세션 ID를 지정(유효한 UUID) | `claude --session-id "550e8400-e29b-..."` |
| `--setting-sources <list>` | 로드할 설정 소스(`user,project,local`) 제한 | `claude --setting-sources user,project` |
| `--settings <path\|json>` | 추가 settings JSON 파일/문자열 로드 | `claude --settings ./settings.json` |
| `--system-prompt <text>` | 시스템 프롬프트를 **전체 교체**(대화형/print) | `claude --system-prompt "You are a Python expert"` |
| `--system-prompt-file <path>` | 파일로 시스템 프롬프트 **전체 교체**(print 전용) | `claude -p --system-prompt-file ./prompt.txt "q"` |
| `--teleport` | claude.ai 원격 세션을 로컬 터미널로 이어받기 | `claude --teleport` |
| `--teammate-mode <auto\|in-process\|tmux>` | agent team 출력 방식 | `claude --teammate-mode in-process` |
| `--tools "<list>"` | **Claude가 사용할 수 있는 내장 도구**를 제한(대화형/print) | `claude --tools "Bash,Edit,Read"` |
| `--verbose` | verbose 로깅(턴 단위 상세 출력) | `claude --verbose` |
| `--version`, `-v` | 버전 출력 | `claude -v` |

### Agents 플래그(`--agents`) JSON 포맷

`--agents`는 “이름 → 정의 객체” 형태의 JSON 객체입니다.

- `description` (필수): 언제 이 서브에이전트를 호출해야 하는지
- `prompt` (필수): 서브에이전트용 시스템 프롬프트
- `tools` (선택): 사용할 도구 목록(없으면 상속)
- `disallowedTools` (선택): 금지 도구 목록
- `model` (선택): `sonnet|opus|haiku|inherit`
- `skills` (선택): preload 할 스킬 목록
- `mcpServers` (선택): 사용할 MCP 서버들
- `maxTurns` (선택): 턴 제한

예시:

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer. Focus on code quality, security, and best practices.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  },
  "debugger": {
    "description": "Debugging specialist for errors and test failures.",
    "prompt": "You are an expert debugger. Analyze errors, identify root causes, and provide fixes."
  }
}'
```

### 시스템 프롬프트 관련 플래그 4종 정리

| 플래그 | 동작 | 모드 | 용도 |
|---|---|---|---|
| `--system-prompt` | 기본 프롬프트를 **완전히 교체** | 인터랙티브 + print | 완전 커스텀 |
| `--system-prompt-file` | 파일 내용으로 **완전히 교체** | print 전용 | 재현 가능한 프롬프트 |
| `--append-system-prompt` | 기본 프롬프트 **뒤에 추가** | 인터랙티브 + print | 기본 기능 유지 + 규칙 추가 |
| `--append-system-prompt-file` | 파일 내용 **뒤에 추가** | print 전용 | 팀 규칙 파일로 추가 |

---

## Print 모드(비대화형)와 자동화

Print 모드는 `claude -p`로 사용하며, 다음과 같은 자동화/스크립팅 포인트가 있습니다.

- `--output-format json` 또는 `stream-json`으로 파싱 가능한 출력
- `--json-schema`로 **구조화 출력**(JSON Schema 검증)
- `--max-turns`, `--max-budget-usd`로 실행 상한 설정
- `--no-session-persistence`로 디스크 저장 없이 1회성 실행
- `--permission-prompt-tool`로 권한 프롬프트를 비대화형에서 처리(예: MCP 인증/승인 도구)

예시(로그 파일을 요약해서 JSON으로 받기):

```bash
cat logs.txt | claude -p "에러 원인과 재현/해결 단계를 요약해줘" --output-format json
```

---

## 인터랙티브 모드 기능

### 1) 주요 단축키(요약)

- `?` : 현재 환경에서 사용 가능한 단축키/도움말
- `Ctrl+C` : 입력/생성 취소
- `Ctrl+D` : 종료
- `Ctrl+G` : 외부 편집기에서 입력/응답 편집
- `Ctrl+O` : verbose 출력 토글
- `Ctrl+R` : 히스토리 reverse search
- `Esc` `Esc` : rewind/summarize(체크포인트 기반)
- `Ctrl+B` : 실행 중 작업(background)으로 보내기
- `Ctrl+T` : 작업 리스트 토글
- `Shift+Tab` : 권한 모드 토글(환경에 따라 `Alt+M`)
- `Option/Alt+P` : 모델 전환
- `Option/Alt+T` : extended thinking 토글(터미널에 따라 `/terminal-setup` 필요)

### 2) 멀티라인 입력

- `\` + Enter : 모든 터미널에서 줄바꿈
- Shift+Enter : iTerm2/WezTerm/Ghostty/Kitty 기본 지원
- 기타 터미널은 `/terminal-setup`으로 바인딩 설치

### 3) 빠른 입력 프리픽스

- `/` : 내장 명령 또는 스킬 실행
- `!` : Bash 모드(Claude를 거치지 않고 커맨드 실행 + 출력이 대화 컨텍스트에 추가)
- `@` : 파일 경로 멘션(파일 자동완성 트리거)

### 4) 내장 슬래시 명령(문서에 기재된 주요 목록)

> 문서에서도 “자주 쓰는 것만” 표기된 목록입니다. 실제 전체 목록은 `/` 입력 후 필터링으로 확인하세요.

- `/clear` 대화 기록 초기화
- `/compact [instructions]` 대화 압축(포커스 지시 가능)
- `/config` 설정 UI 열기
- `/context` 컨텍스트 사용량 시각화
- `/cost` 토큰/비용 통계
- `/debug [description]` 세션 디버그 로그로 문제 진단
- `/doctor` 설치 상태 점검
- `/exit` 종료
- `/export [filename]` 대화 내보내기(파일/클립보드)
- `/help` 도움말
- `/init` 프로젝트에 `CLAUDE.md` 초기화
- `/mcp` MCP 서버/인증 관리
- `/memory` 메모리 파일 편집(CLAUDE.md/auto memory)
- `/model` 모델 선택/변경(지원 모델에서 effort 조절)
- `/permissions` 권한 보기/수정
- `/plan` plan mode 진입
- `/rename <name>` 세션 이름 변경
- `/resume [session]` 세션 재개/피커
- `/rewind` rewind 메뉴
- `/stats` 사용량/히스토리 등 통계
- `/status` 상태 탭(버전/모델/계정/연결)
- `/statusline` status line 설정
- `/copy` 마지막 응답을 클립보드로 복사
- `/tasks` 백그라운드 작업 관리
- `/teleport` 원격(claude.ai) 세션 이어받기(구독 플랜)
- `/desktop` CLI 세션을 Desktop 앱으로 handoff(macOS/Windows)
- `/theme` 테마 변경
- `/todos` TODO 목록
- `/usage` (구독) 플랜/레이트리밋 표시

### 5) 체크포인트/리와인드(Checkpointing)

- 모든 사용자 프롬프트마다 체크포인트 생성
- 세션 재개 시에도 체크포인트 유지
- `Esc` `Esc` 또는 `/rewind`:
  - 코드+대화 복원 / 대화만 복원 / 코드만 복원
  - 특정 시점 이후를 **요약(summarize)** 해서 컨텍스트 공간 확보
- 제한: Bash 명령으로 바뀐 파일은 체크포인트로 되돌릴 수 없음(편집 도구로 변경된 것만 추적)

### 6) 백그라운드 작업/Task list/Prompt suggestions/PR 상태

- **Background**: Bash 실행 중 `Ctrl+B`로 백그라운드로 전환 → Task ID로 추적, 출력은 TaskOutput 도구로 회수
- **Bash 모드**: `! npm test` 처럼 직접 실행(출력이 대화에 포함), 동일하게 백그라운딩 가능
- **Prompt suggestions**: 시작 시 회색 추천 프롬프트 표시(탭으로 수락). `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false`로 비활성화 가능
- **Task list**: Claude가 다단계 작업을 리스트로 관리, `Ctrl+T`로 토글, `CLAUDE_CODE_TASK_LIST_ID`로 세션 간 공유 가능, `CLAUDE_CODE_ENABLE_TASKS=false`로 비활성화
- **PR review status**: 현재 브랜치에 열린 PR이 있으면 푸터에 PR 링크가 표시되고 리뷰 상태에 따라 색상 언더라인(승인/대기/변경요청/드래프트/머지). `gh` CLI 설치/인증 필요

---

## 설정 시스템(Scopes/파일/우선순위)

### 1) 스코프(적용 범위)

| 스코프 | 위치 | 영향 범위 | 팀 공유 |
|---|---|---|---|
| Managed | `managed-settings.json` (시스템 경로) | 머신의 모든 사용자 | 예(IT 배포) |
| User | `~/.claude/` | 내 모든 프로젝트 | 아니오 |
| Project | 리포지토리의 `.claude/` | 해당 리포 전체 협업자 | 예(git 커밋) |
| Local | `.claude/*.local.*` | 나만(해당 리포) | 아니오(gitignored) |

### 2) 우선순위(Precedence)

동일 설정이 여러 스코프에 존재하면:

1. Managed(최상위, override 불가)
2. CLI 인자(세션 단위 override)
3. Local
4. Project
5. User(기본)

### 3) 주요 설정 파일 위치

- User settings: `~/.claude/settings.json`
- Project settings: `.claude/settings.json`
- Local settings: `.claude/settings.local.json` (생성 시 git ignore 자동 설정)
- Managed settings:
  - macOS: `/Library/Application Support/ClaudeCode/`
  - Linux/WSL: `/etc/claude-code/`
  - Windows: `C:\Program Files\ClaudeCode\`

추가로 `~/.claude.json`에는 테마/알림/에디터/인증(OAuth)/캐시 등 다양한 상태가 저장되며, 프로젝트 MCP 서버는 `.mcp.json`에 저장됩니다.

> 안전장치: Claude Code는 설정 파일의 타임스탬프 백업을 자동 생성하며 최근 5개를 보관합니다.

### 4) `settings.json`에서 자주 쓰는 키(문서 표기 기준)

> 문서에는 매우 많은 키가 존재합니다. 아래는 문서 상단 표에 명시된 주요 키들입니다.

- `apiKeyHelper`: `/bin/sh`에서 실행될 커스텀 스크립트로 auth 값 생성(`X-Api-Key`, `Authorization: Bearer` 헤더로 전송)
- `cleanupPeriodDays`: 비활성 세션 정리 기간(기본 30일)
- `companyAnnouncements`: 시작 시 공지 표시
- `env`: 세션에 적용할 환경 변수
- `attribution`: 커밋/PR에 붙일 attribution 커스터마이즈
- `permissions`: allow/ask/deny 규칙
- `hooks`, `disableAllHooks`, `allowManagedHooksOnly`
- `allowManagedPermissionRulesOnly` (managed 전용)
- `model`, `availableModels`
- `statusLine`
- `fileSuggestion`, `respectGitignore`
- `outputStyle`
- 로그인 관련: `forceLoginMethod`, `forceLoginOrgUUID`
- MCP 관련: `enableAllProjectMcpServers`, `enabledMcpjsonServers`, `disabledMcpjsonServers`, `allowedMcpServers`, `deniedMcpServers`
- 마켓플레이스 제한: `strictKnownMarketplaces`
- AWS 자격증명 고급 설정: `awsAuthRefresh`, `awsCredentialExport`
- thinking/plan: `alwaysThinkingEnabled`, `plansDirectory`
- UI: `showTurnDuration`, `spinnerVerbs`, `spinnerTipsEnabled`, `spinnerTipsOverride`, `terminalProgressBarEnabled`, `prefersReducedMotion`
- 언어/업데이트 채널: `language`, `autoUpdatesChannel`

---

## 권한(Permissions)과 도구 제한

Claude Code는 도구 실행(특히 Bash/파일 쓰기/WebFetch/MCP 등)에 대해 권한 체계를 제공합니다.

- `/permissions` 명령(또는 `/config`)에서 권한 규칙을 보고 수정할 수 있습니다.
- CLI에서도 시작 시 `--permission-mode`, `--allowedTools`, `--disallowedTools`, `--tools`, `--dangerously-skip-permissions` 등으로 제어할 수 있습니다.

### 1) 도구 제한: `--tools` vs allowed/disallowed

- `--tools`: **Claude가 사용할 수 있는 도구 자체**를 제한(화이트리스트). `""`(전부 비활성), `"default"`(기본 전체), `"Bash,Edit,Read"` 처럼 나열.
- `--allowedTools`: 해당 패턴은 권한을 묻지 않고 실행(도구 자체는 여전히 사용 가능)
- `--disallowedTools`: 컨텍스트에서 제거되어 사용 불가

### 2) 위험 옵션

- `--dangerously-skip-permissions`: 모든 권한 프롬프트를 스킵(매우 위험)
- `--allow-dangerously-skip-permissions`: 바로 스킵하지 않고, “스킵 가능 옵션”만 활성화(그래도 주의)

---

## 샌드박싱(Sandboxed bash)

Claude Code는 Bash 도구 실행을 OS 수준 격리로 감싸는 **샌드박싱** 기능을 제공합니다.

- 목적: Bash 권한 프롬프트 남발(approval fatigue)을 줄이면서도 보안을 유지
- OS별 구현:
  - macOS: Seatbelt
  - Linux/WSL2: bubblewrap(WSL1 미지원)

### 동작 개요

- **파일시스템 격리**
  - 기본: 현재 작업 디렉터리(및 하위)에는 읽기/쓰기 가능
  - 기본: 전체 컴퓨터 읽기 가능(단, 특정 deny 디렉터리 제외)
  - 작업 디렉터리 바깥을 수정하려면 권한 필요(또는 정책 설정)
- **네트워크 격리**
  - 샌드박스 밖의 프록시를 통해 도메인 단위로 허용/차단
  - 새로운 도메인은 사용자 확인을 트리거
  - 하위 프로세스에도 동일하게 적용

### 사용 방법

- `/sandbox` 명령으로 활성화(메뉴에서 모드 선택)
  - Auto-allow: 샌드박스 내부에서 실행 가능한 Bash는 자동 승인(단, ask/deny 규칙은 존중)
  - Regular permissions: 샌드박스이더라도 모든 Bash가 일반 권한 플로우를 거침

### “탈출구”와 제어

- 샌드박스 제한으로 실패하면, Claude가 `dangerouslyDisableSandbox`로 **샌드박스 밖에서 재시도**를 제안할 수 있음(이 경우 일반 권한 승인 필요)
- `"allowUnsandboxedCommands": false` 로 이 탈출구를 완전히 비활성화 가능

---

## 모델 설정/별칭/1M 컨텍스트/프롬프트 캐싱

### 1) 모델 별칭(aliases)

문서 기준 별칭과 동작:

- `default`: 계정 타입에 따른 추천 기본값
- `sonnet`: 최신 Sonnet(문서에는 “현재 Sonnet 4.6”으로 표기)
- `opus`: 최신 Opus(문서에는 “현재 Opus 4.6”으로 표기)
- `haiku`: 빠른 Haiku
- `sonnet[1m]`: 1M 컨텍스트 창(베타)
- `opusplan`: plan 모드에서는 `opus`, 실행 모드에서는 자동으로 `sonnet`으로 전환

> 별칭은 항상 “최신 버전”을 가리킵니다. 버전 고정(pinning)이 필요하면 풀 모델명(예: `claude-opus-4-6`) 또는 관련 환경 변수로 고정합니다.

### 2) 모델 설정 우선순위(세션/CLI/env/settings)

1. 세션 중 `/model <alias|name>`
2. 시작 시 `claude --model ...`
3. 환경 변수 `ANTHROPIC_MODEL=<alias|name>`
4. settings의 `"model": "..."`

### 3) 모델 선택 제한(관리자)

- `availableModels`로 사용자가 선택할 수 있는 모델을 제한 가능(Managed/Policy settings에서 enforce 가능)
- Default 옵션은 allowlist의 영향을 받지 않음(계정 티어에 따라 런타임 기본값)

### 4) effort level(노력도)

- Opus 4.6에서 `low|medium|high` 노력도를 제공(문서 기준)
- 설정 방법:
  - `/model` 선택 UI에서 좌/우 화살표로 조절
  - `CLAUDE_CODE_EFFORT_LEVEL=low|medium|high`
  - settings의 `effortLevel`

### 5) 1M 컨텍스트(extended context)

- Opus/Sonnet 4.6에서 1M 컨텍스트 지원(베타)
- `/model sonnet[1m]` 또는 풀 모델명 뒤에 `[1m]` suffix 사용 가능

### 6) 프롬프트 캐싱(prompt caching)

- Claude Code는 성능/비용 최적화를 위해 프롬프트 캐싱을 자동 사용
- 비활성화 환경 변수:
  - `DISABLE_PROMPT_CACHING=1` (전체)
  - `DISABLE_PROMPT_CACHING_HAIKU=1`
  - `DISABLE_PROMPT_CACHING_SONNET=1`
  - `DISABLE_PROMPT_CACHING_OPUS=1`

---

## Fast mode

- `/fast`로 토글
- Opus 4.6을 “더 빠르게” 쓰기 위한 설정(모델이 바뀌는 것이 아니라 API 설정이 달라지는 형태로 문서에 설명)
- fast mode는 별도의 요구사항/과금/레이트리밋이 있을 수 있으며, 토글 시 Opus로 자동 전환되고, 끌 때는 이전 모델로 자동 복귀하지 않음(`/model`로 변경)

---

## 메모리 관리(CLAUDE.md & Auto memory)

Claude Code에는 세션 간 유지되는 메모리가 두 종류 있습니다.

1) **CLAUDE.md 파일들**: 사람이 작성하는 규칙/지침  
2) **Auto memory**: Claude가 작업 중 발견한 패턴/인사이트를 자동 기록

### 1) 메모리 위치/종류(계층)

| 타입 | 위치 | 목적 | 공유 범위 |
|---|---|---|---|
| Managed policy | OS별 시스템 경로의 `CLAUDE.md` | 조직 공통 지침 | 조직 사용자 전체 |
| Project memory | `./CLAUDE.md` 또는 `./.claude/CLAUDE.md` | 팀 공유 지침 | 리포 협업자 |
| Project rules | `./.claude/rules/*.md` | 모듈화된 규칙 | 리포 협업자 |
| User memory | `~/.claude/CLAUDE.md` | 개인 기본 선호 | 나 |
| Project local | `./CLAUDE.local.md` | 개인 프로젝트 선호 | 나(해당 프로젝트) |
| Auto memory | `~/.claude/projects/<project>/memory/` | Claude 자동 노트 | 나(프로젝트별) |

- 시작 시: 상위 디렉터리의 `CLAUDE.md`/`CLAUDE.local.md`를 재귀적으로 읽음
- Auto memory는 `MEMORY.md`의 **첫 200줄만** 시작 시 로드

### 2) Auto memory 구조

`~/.claude/projects/<project>/memory/` 아래에:

- `MEMORY.md` (인덱스, 시작 시 일부 로드)
- `debugging.md`, `api-conventions.md` 같은 토픽 파일(필요 시 on-demand 로드)

켜고 끄기:

```bash
export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1  # 강제 OFF
export CLAUDE_CODE_DISABLE_AUTO_MEMORY=0  # 강제 ON
```

### 3) `/memory`로 편집

세션 중 `/memory`로 CLAUDE.md 및 auto memory 파일을 선택해 에디터로 열어 편집할 수 있습니다.

### 4) `@path` 임포트

CLAUDE.md에서 `@path/to/file` 형태로 추가 파일 임포트 가능.

- 상대 경로는 “현재 작업 디렉터리”가 아니라 **해당 CLAUDE.md가 있는 위치 기준**
- 최초로 외부 임포트를 만나면 프로젝트 단위로 승인 다이얼로그가 뜸(1회성)
- 코드 블록/코드 스팬 안의 `@`는 임포트로 처리되지 않음
- 최대 5단계까지 재귀 임포트 가능

### 5) `.claude/rules/`와 경로 조건부 규칙

`.claude/rules/*.md`는 자동 로드되며, YAML frontmatter로 조건부 적용 가능:

```md
---
paths:
  - "src/api/**/*.ts"
---

# API Development Rules
- ...
```

---

## Status line 커스터마이징

Status line은 터미널 하단에 표시되는 커스터마이즈 가능한 바입니다.

- `/statusline` 명령으로 자연어로 요구사항을 말하면 스크립트를 생성/설정해줌
- 또는 settings의 `statusLine` 필드로 수동 설정

예시:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 2
  }
}
```

동작:

- Claude Code가 세션 데이터를 JSON으로 stdin에 전달 → 스크립트가 stdout으로 출력한 내용을 status line에 표시
- 응답 완료 후, 권한 모드 변경, vim 모드 토글 등에서 갱신
- 300ms 디바운스, 실행 중 새 업데이트가 오면 in-flight 실행 취소

표시 가능한 데이터(요약):

- 모델 정보: `model.id`, `model.display_name`
- 디렉터리: `workspace.current_dir`, `workspace.project_dir`
- 비용/시간: `cost.total_cost_usd`, `cost.total_duration_ms`
- 토큰/컨텍스트: `context_window.*`
- 세션: `session_id`, `transcript_path`, `version`
- vim/agent: `vim.mode`, `agent.name`

---

## 키 바인딩(단축키) 커스터마이징

- `/keybindings` 실행 → `~/.claude/keybindings.json` 생성/열기
- 파일 변경은 재시작 없이 즉시 반영

구조:

```json
{
  "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
  "$docs": "https://code.claude.com/docs/en/keybindings",
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "ctrl+e": "chat:externalEditor",
        "ctrl+u": null
      }
    }
  ]
}
```

- `context` 예: `Global`, `Chat`, `Autocomplete`, `Confirmation`, `Transcript`, `HistorySearch`, `Task`, `Plugin` 등
- 액션은 `namespace:action` 형식(예: `chat:submit`, `app:exit`)
- 키 표기:
  - modifiers: `ctrl|alt|shift|meta`
  - chord: `"ctrl+k ctrl+s"` 형태
  - 기본 바인딩 해제: 값에 `null` 지정

---

## Hooks(자동화 훅)

Hooks는 Claude Code의 라이프사이클 이벤트에 맞춰 자동 실행되는 사용자 정의 핸들러입니다.

- 타입:
  - `command`: 셸 커맨드/스크립트 실행(stdin JSON 입력)
  - `prompt`: LLM 프롬프트로 평가(컨텍스트 플레이스홀더 사용)
  - `agent`: 도구를 가진 “검증/후처리” 에이전트 실행

### 1) 주요 이벤트(문서 표기)

- `SessionStart` / `SessionEnd`
- `UserPromptSubmit`
- `PreToolUse` / `PostToolUse` / `PostToolUseFailure`
- `PermissionRequest`
- `Notification`
- `SubagentStart` / `SubagentStop`
- `Stop`
- `TeammateIdle`
- `TaskCompleted`
- `PreCompact`

### 2) 스코프/정의 위치

| 위치 | 범위 | 공유 |
|---|---|---|
| `~/.claude/settings.json` | 모든 프로젝트 | 로컬 |
| `.claude/settings.json` | 프로젝트 | 공유 가능 |
| `.claude/settings.local.json` | 프로젝트(개인) | 로컬 |
| managed policy settings | 조직 | 관리 |
| 플러그인 `hooks/hooks.json` | 플러그인 활성 시 | 플러그인 포함 |
| 스킬/에이전트 frontmatter | 컴포넌트 활성 시 | 컴포넌트 포함 |

또한 `allowManagedHooksOnly`(managed settings)로 사용자/프로젝트/플러그인 훅을 막고 “관리 훅만” 허용할 수 있습니다.

### 3) matcher(필터)

- `matcher`는 정규식 문자열로 이벤트 발생 시 특정 조건에서만 훅이 실행되게 합니다.
- 예: Tool 이벤트에서는 `tool_name`(예: `Bash`, `Edit|Write`, `mcp__.*`)에 매칭
- MCP 도구는 `mcp__<server>__<tool>` 패턴이므로 정규식으로 그룹 매칭 가능

예: Bash에서 `rm -rf` 차단(PreToolUse):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/block-rm.sh" }
        ]
      }
    ]
  }
}
```

---

## Plugins(플러그인) 시스템

플러그인은 Claude Code를 확장하는 “컴포넌트 디렉터리”입니다.

### 1) 플러그인이 제공할 수 있는 컴포넌트

- **Skills/Commands**: `/name` 형태로 실행되는 스킬( `skills/<name>/SKILL.md` 또는 `commands/*.md` )
- **Agents**: `agents/*.md` 형태의 서브에이전트
- **Hooks**: `hooks/hooks.json` 또는 manifest inline
- **MCP servers**: `.mcp.json` 또는 manifest inline
- **LSP servers**: `.lsp.json` 또는 manifest inline (진단/정의로 이동/참조 찾기 등 코드 인텔리전스)

### 2) 플러그인 manifest: `.claude-plugin/plugin.json`

- manifest는 선택(없으면 디렉터리 구조로 자동 발견)
- 포함한다면 `name`만 필수
- 컴포넌트 경로를 커스텀으로 추가 지정 가능(기본 디렉터리를 “대체”하는 것이 아니라 **추가**로 로드)

### 3) `${CLAUDE_PLUGIN_ROOT}`

플러그인 내부에서 절대경로 의존을 줄이기 위해 `${CLAUDE_PLUGIN_ROOT}` 환경 변수를 제공(설치 위치가 달라도 동작).

예:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/process.sh" }
        ]
      }
    ]
  }
}
```

### 4) 플러그인 캐싱/경로 제한

- 마켓플레이스에서 설치된 플러그인은 보안/검증을 위해 `~/.claude/plugins/cache`에 복사되어 실행됨
- 플러그인은 설치 후 자신의 디렉터리 밖 파일을 참조할 수 없으며, `../`로 루트 밖을 가리키는 경로는 동작하지 않음
- 외부 의존 파일이 필요하면 플러그인 디렉터리 안에 심볼릭 링크를 두는 방식은 복사 과정에서 유지됨

### 5) 플러그인 CLI 명령(비대화형 관리)

#### `claude plugin install`

```bash
claude plugin install <plugin> [options]
```

- `<plugin>`: `plugin-name` 또는 `plugin-name@marketplace-name`
- 옵션:
  - `-s, --scope <scope>`: `user|project|local` (기본 `user`)
  - `-h, --help`

예:

```bash
claude plugin install formatter@my-marketplace
claude plugin install formatter@my-marketplace --scope project
claude plugin install formatter@my-marketplace --scope local
```

#### `claude plugin uninstall` (alias: `remove`, `rm`)

```bash
claude plugin uninstall <plugin> [options]
```

- 옵션: `--scope user|project|local` (기본 `user`)

#### `claude plugin enable` / `disable`

```bash
claude plugin enable <plugin> [options]
claude plugin disable <plugin> [options]
```

- 옵션: `--scope user|project|local` (기본 `user`)

#### `claude plugin update`

```bash
claude plugin update <plugin> [options]
```

- 옵션: `--scope user|project|local|managed` (기본 `user`)

#### 디버깅

- `claude --debug` 또는 `/debug`로 플러그인 로딩/등록/MCP 초기화 로그를 확인
- 문서의 공통 이슈 테이블에 `claude plugin validate` 또는 `/plugin validate` 같은 검증 커맨드가 언급됨

---

## 환경 변수(Environment variables) 전체 목록

> 아래는 settings 문서의 “Environment variables” 표를 기반으로 정리한 목록입니다.  
> (일부는 모델/플랫폼별로만 의미가 있거나, 배포/조직 정책에서 사용됩니다.)

### 1) 인증/요청/모델 공통

- `ANTHROPIC_API_KEY` : Anthropic API 키
- `ANTHROPIC_AUTH_TOKEN` : `Authorization` 헤더로 전송되는 값
- `ANTHROPIC_CUSTOM_HEADERS` : 요청에 포함할 커스텀 헤더(JSON)
- `ANTHROPIC_MODEL` : 기본 모델(별칭 또는 이름)
- `ANTHROPIC_DEFAULT_OPUS_MODEL` / `ANTHROPIC_DEFAULT_SONNET_MODEL` / `ANTHROPIC_DEFAULT_HAIKU_MODEL` : 별칭이 가리키는 모델을 버전 고정(pinning)
- `CLAUDE_CODE_SUBAGENT_MODEL` : 서브에이전트 모델 지정
- `CLAUDE_CODE_EFFORT_LEVEL` : `low|medium|high`

### 2) 클라우드 프로바이더(선택)

- `CLAUDE_CODE_USE_BEDROCK` : Bedrock 사용
- `CLAUDE_CODE_USE_VERTEX` : Vertex 사용
- `CLAUDE_CODE_USE_FOUNDRY` : Foundry 사용
- `AWS_REGION`, `AWS_DEFAULT_REGION`, `AWS_PROFILE` : AWS 설정
- `VERTEX_PROJECT_ID` : GCP 프로젝트 ID
- `VERTEX_REGION_CLAUDE_3_5_SONNET`, `VERTEX_REGION_CLAUDE_3_5_HAIKU`, `VERTEX_REGION_CLAUDE_3_OPUS` : Vertex 지역 설정(레거시/특정 모델)

### 3) 출력/토큰

- `CLAUDE_CODE_DEFAULT_OUTPUT_FORMAT` : 기본 출력 형식(`text|json|stream-json`)
- `CLAUDE_CODE_MAX_OUTPUT_TOKENS` : 최대 출력 토큰
- `CLAUDE_CODE_MAX_TOKENS` : 최대 토큰(일부 기능에서 사용)

### 4) 트래픽/텔레메트리/업데이트

- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` : 비필수 트래픽 차단
- `CLAUDE_CODE_DISABLE_TELEMETRY`, `CLAUDE_CODE_TELEMETRY_OPTOUT` : 텔레메트리 비활성화
- `CLAUDE_CODE_ENABLE_TELEMETRY` : 텔레메트리 활성화
- `CLAUDE_CODE_DISABLE_AUTOUPDATE` : 자동 업데이트 비활성화

### 5) MCP 관련

- `CLAUDE_CODE_SKIP_MCP_SERVER_PROMPT` : MCP 서버 프롬프트 스킵
- `MCP_CONNECT_TIMEOUT_MS`, `MCP_TIMEOUT_MS`, `MCP_TOOL_TIMEOUT_MS`
- `MCP_TOOL_MAX_RETRIES`, `MCP_MAX_TOTAL_TIMEOUT_MS`

### 6) Bash 도구/임시 파일/테마/메모리/작업

- `BASH_DEFAULT_TIMEOUT_MS`, `BASH_MAX_TIMEOUT_MS`
- `CLAUDE_CODE_ALLOW_READ_TEMP`, `CLAUDE_CODE_ALLOW_WRITE_TEMP`
- `CLAUDE_CODE_THEME` : 테마
- `CLAUDE_CODE_DISABLE_AUTO_MEMORY` : auto memory 강제 on/off (double-negative 논리 포함)
- `CLAUDE_CODE_ENABLE_TASKS` : task list 기능
- `CLAUDE_CODE_TASK_LIST_ID` : task list 디렉터리 지정
- `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION` : prompt suggestion 토글
- `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` : background task 기능 비활성화
- `CLAUDE_BASH_MOCK_COMMANDS` : bash mock(테스트/개발용)

### 7) 원격/연동 기능

- `CLAUDE_CODE_ENABLE_TELEPORT`
- `CLAUDE_CODE_ENABLE_DESKTOP_HANDOFF`

### 8) 프롬프트 캐싱

- `DISABLE_PROMPT_CACHING`
- `DISABLE_PROMPT_CACHING_HAIKU`
- `DISABLE_PROMPT_CACHING_SONNET`
- `DISABLE_PROMPT_CACHING_OPUS`

### 9) 기타 토글/시스템

- `DISABLE_BUG_COMMAND` : `/bug` 커맨드 비활성화
- `DISABLE_COST_WARNINGS` : 비용 경고 비활성화
- `DISABLE_ERROR_REPORTING` : 에러 리포팅 비활성화
- `DISABLE_INSTALLATION_CHECKS` : 설치 체크 비활성화
- `SHELL`, `EDITOR`, `VISUAL` : 쉘/에디터 환경 변수
- `CLAUDE_CODE_GIT_BASH_PATH` : Windows Git Bash 경로
- 프록시: `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`

### 10) 추가 디렉터리/기본 스킬/인덱싱/도구 스위치

- `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` : `--add-dir` 경로의 CLAUDE.md도 로드할지
- `CLAUDE_CODE_USE_BUILTIN_DEFAULT_SKILLS`
- `CLAUDE_CODE_DISABLE_DEFAULT_SKILLS`
- 프로젝트 인덱싱:
  - `CLAUDE_CODE_SKIP_PROJECT_INDEXING`
  - `CLAUDE_CODE_DISABLE_PROJECT_INDEXING`
  - `CLAUDE_CODE_PROJECT_INDEXING_WORKERS`
  - `CLAUDE_CODE_PROJECT_INDEXING_MAX_MB`
- 도구 enable 토글:
  - `CLAUDE_CODE_ENABLE_BASH_TOOL`
  - `CLAUDE_CODE_ENABLE_FILE_TOOL`
  - `CLAUDE_CODE_ENABLE_WEBSOCKET`
  - `CLAUDE_CODE_ENABLE_WEBFETCH`
  - `CLAUDE_CODE_ENABLE_EXTERNAL_BROWSER`
  - `CLAUDE_CODE_ENABLE_TASK_TOOL`
  - `CLAUDE_CODE_ENABLE_LSP_TOOL`
  - `CLAUDE_CODE_ENABLE_REMOTE`

### 11) Bash 환경 변수 지속 설정

- `CLAUDE_ENV_FILE` : Bash 도구 실행 전에 읽을 환경 파일을 지정

---

## Claude가 사용할 수 있는 기본 도구 목록

settings 문서에 표기된 기본 도구와 권한 요구 여부(문서 기준):

| 도구 | 권한 필요 | 설명(요약) |
|---|---:|---|
| `Read` | No | 파일 읽기 |
| `Glob` | No | 패턴으로 파일 찾기 |
| `Grep` | No | 파일 내용 검색 |
| `LS` | No | 디렉터리 목록 |
| `NotebookRead` | No | 노트북 읽기 |
| `NotebookEdit` | Yes | 노트북 셀 편집 |
| `Edit` | Yes | 파일 편집 |
| `Write` | Yes | 파일 쓰기/생성 |
| `Bash` | Yes | 쉘 명령 실행 |
| `WebFetch` | Yes | 웹 요청/가져오기 |
| `TodoWrite` | No | TODO 리스트 업데이트 |
| `Task` | Yes | 백그라운드 실행/비동기 작업 |
| `TaskOutput` | No | 백그라운드 작업 출력 읽기 |
| `LspDiagnostics` | No | LSP 진단 |
| `ListMcpResources` | No | MCP 리소스 나열 |
| `ReadMcpResource` | No | MCP 리소스 읽기 |
| `InvokeMcpTool` | Yes | MCP 서버의 도구 호출 |

### Bash 도구 동작(주의점)

- `cwd`는 bash 호출 사이에 유지됨
- 하지만 bash 호출 사이에 설정한 **환경 변수(export 등)는 유지되지 않음**
- 영구 적용이 필요하면:
  - Claude Code 실행 전에 셸에서 환경을 설정하고 시작
  - `CLAUDE_ENV_FILE` 사용
  - `SessionStart` 훅으로 환경을 설정

---

## 원문 링크(참고)

- Overview: https://code.claude.com/docs/en/overview
- CLI reference: https://code.claude.com/docs/en/cli-reference
- Interactive mode: https://code.claude.com/docs/en/interactive-mode
- Settings: https://code.claude.com/docs/en/settings
- Model config: https://code.claude.com/docs/en/model-config
- Fast mode: https://code.claude.com/docs/en/fast-mode
- Memory: https://code.claude.com/docs/en/memory
- Status line: https://code.claude.com/docs/en/statusline
- Keybindings: https://code.claude.com/docs/en/keybindings
- Checkpointing: https://code.claude.com/docs/en/checkpointing
- Hooks: https://code.claude.com/docs/en/hooks
- Plugins reference: https://code.claude.com/docs/en/plugins-reference
- Sandboxing: https://code.claude.com/docs/en/sandboxing
