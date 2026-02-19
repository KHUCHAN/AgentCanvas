# Gemini CLI 기능 정리 (공식 문서 기반)

> 기준: 2026-02-19 (문서 내용은 버전에 따라 달라질 수 있음)

## 1) 한눈에 보는 Gemini CLI
- **터미널 중심(terminal-first) AI 에이전트**로, 로컬 프로젝트 컨텍스트와 시스템 도구(파일/쉘/웹 등)를 결합해 작업을 수행합니다.
- 대화형(REPL)으로 쓰거나, **비대화형(Headless/one-shot)**으로 스크립트에 넣어 자동화할 수 있습니다.
- 기본 도구 외에도 **MCP(Model Context Protocol) 서버**, **확장(Extensions)**, **커스텀 커맨드**, **Agent Skills**, **(실험) Subagents/Remote subagents**, **Hooks** 등으로 확장 가능합니다.

---

## 2) 실행 모드 & CLI 사용 패턴

### 2.1 대화형(Interactive REPL)
- `gemini` 실행 후 대화하면서 작업.
- 입력 중 `/`로 슬래시 커맨드, `@`로 파일/리소스 참조, `!`로 쉘 실행.

### 2.2 비대화형(Headless/one-shot)
- **TTY가 아닌 환경**이거나, **인터랙티브 플래그 없이 positional query를 주면** Headless로 동작할 수 있습니다.
- `--output-format`으로 텍스트/JSON 등 구조화 출력 지정 가능.
- 파이프 입력(`cat file | gemini`)으로 로그/텍스트를 넘겨 요약/분석 자동화 가능.


## 2.3 자주 쓰는 CLI 명령(터미널에서 실행)
> 아래는 “터미널에서 gemini 명령 자체를 실행”하는 레벨의 사용 패턴입니다.

- `gemini` : 대화형 REPL 시작
- `gemini "질문"` : 한 번 질의하고 종료(Headless/one-shot)
- `gemini -i "질문"` : 한 번 질의 후 대화형으로 계속
- `gemini -r "latest"` : 가장 최근 세션 이어서
- `gemini -r "<session-id>" "추가 질문"` : 특정 세션 ID로 재개
- `gemini update` : CLI 업데이트
- `gemini extensions ...` : 확장 관리(설치/업데이트/연결 등)
- `gemini mcp ...` : MCP 서버 관리(추가/목록/삭제 등)

---

## 3) 프롬프트에서 바로 쓰는 특수 문법

### 3.1 `@` 파일/디렉터리/리소스 참조
- `@path/to/file` 또는 `@path/to/dir` 형태로 **파일 내용/디렉터리 트리**를 프롬프트에 포함시킵니다.
- 사용자 트리거 툴 `read_many_files`로 동작합니다.
- MCP 리소스도 같은 문법으로 참조할 수 있습니다: `@server://resource/path`

### 3.2 `!` 쉘 실행 & Shell mode
- 한 줄 실행: `!<shell_command>`
- 토글: 입력창이 비어 있을 때 `!`만 입력하면 **Shell mode**를 토글합니다.
  - Shell mode에서는 입력이 곧바로 쉘 커맨드로 해석됩니다.
- `!`로 실행된 서브프로세스 환경에는 `GEMINI_CLI=1`이 설정됩니다(스크립트가 “Gemini CLI에서 실행됨”을 감지 가능).

> 주의: `!`로 실행하는 커맨드는 실제 터미널에서 실행하는 것과 동일한 권한/영향을 가집니다.

---

## 4) 도구(Tools) 시스템

### 4.1 사용자 트리거 도구(User-triggered tools)
- 파일 참조 `@` → `read_many_files`
- 쉘 실행 `!` → `run_shell_command`

### 4.2 모델 트리거 도구(Model-triggered tools)
**파일 관리(File management)**
- `list_directory` : 디렉터리 목록
- `read_file` : 파일 읽기
- `write_file` : 파일 생성/덮어쓰기
- `glob` : 글롭 패턴 파일 찾기
- `search_file_content` : 파일 내용 검색(grep/ripgrep)
- `replace` : 파일 내 정밀 치환/편집

**에이전트 협업/조정(Agent coordination)**
- `ask_user` : 사용자에게 확인/질문
- `save_memory` : 장기 메모리(`GEMINI.md`)에 저장
- `write_todos` : 할 일(todo) 목록 관리
- `activate_skill` : Agent Skill 활성화
- `get_internal_docs` : CLI 내부 문서 조회

**정보 수집(Information gathering)**
- `web_fetch` : 특정 URL 내용 가져오기/가공
- `google_web_search` : 최신 정보 검색

### 4.3 보안/확인(Confirmation)
- 파일 수정/쉘 실행 같은 민감 작업은 기본적으로 **사용자 확인**(diff/명령 표시 후 승인)을 요구합니다.
- 필요하면 **Sandboxing**과 **Trusted folders**로 위험을 줄일 수 있습니다.

---

## 5) 프로젝트 컨텍스트 & 메모리

### 5.1 계층형 컨텍스트 파일(GEMINI.md 등)
- `GEMINI.md` 같은 컨텍스트 파일을 통해 프로젝트/워크스페이스 지침을 제공할 수 있습니다.
- 컨텍스트 파일 이름은 설정에서 `contextFileName`으로 바꿀 수 있고(단일/배열), 루트/상위 디렉터리/하위 디렉터리 스캔 등 계층적으로 로드될 수 있습니다.

### 5.2 Memory 도구
- `save_memory` 도구는 중요한 사실을 장기 메모리(`GEMINI.md`)에 저장합니다.
- 신뢰/보안 설정(Trusted folders 등)에 따라 자동 로드가 제한될 수 있습니다.

---

## 6) 세션/히스토리 & 롤백 안전장치

### 6.1 Checkpointing + `/restore`
- AI 도구가 파일을 수정하기 전, **프로젝트 상태 스냅샷(체크포인트)**을 자동 생성하는 기능입니다.
- 체크포인트에는:
  1) 홈 디렉터리의 “shadow git repo”에 커밋된 스냅샷(`~/.gemini/history/<project_hash>`)
  2) 대화 히스토리
  3) 실행 예정이던 tool call
  가 포함될 수 있습니다.
- `/restore`로 파일 상태/대화 상태를 체크포인트 시점으로 되돌릴 수 있습니다.
- 체크포인트 기능은 기본 꺼져 있으며 `settings.json`에서 활성화합니다.

### 6.2 Rewind + `/rewind`
- `/rewind`는 대화의 과거 시점으로 돌아가고, 필요하면 해당 구간에서 AI가 만든 파일 변경도 되돌릴 수 있습니다.

---

## 7) 작업 계획 & 자동화

### 7.1 Todos
- 복잡한 작업을 “할 일 목록”으로 쪼개고 진행 상황을 관리합니다(`write_todos`).

### 7.2 Plan Mode (실험 기능)
- **읽기 전용(read-only) 계획 모드**로, 구현 전에 안전하게 설계를 다듬는 워크플로우입니다.
- 진입 방법:
  - `Shift+Tab`로 승인 모드 순환(Default → Auto-Edit → Plan)
  - `/plan`
  - 자연어로 “start a plan…” 요청(에이전트가 `enter_plan_mode` 호출)
- Plan Mode에서 허용되는 툴이 제한됩니다(예: `read_file`, `list_directory`, `glob`, `grep_search`, `google_web_search`, `ask_user` 등).
- 기본 시작 모드로 설정하려면 `defaultApprovalMode`를 `plan`으로 설정하거나 `gemini --approval-mode=plan` 사용 가능.

### 7.3 Headless 모드로 자동화
- Headless 모드는 인터랙티브 UI 없이 구조화 출력(JSON 등)으로 결과를 반환할 수 있어 스크립트/CI 자동화에 적합합니다.

---

## 8) 모델 선택/라우팅/고급 생성 설정

### 8.1 모델 선택 `/model`
- `/model`로 모델 선택 UI를 열고:
  - Auto (Gemini 3)
  - Auto (Gemini 2.5)
  - Manual(특정 모델)
  을 선택할 수 있습니다.
- `/model`(또는 `--model`)은 **sub-agents가 쓰는 모델을 덮어쓰지 않습니다**.

### 8.2 모델 라우팅(Model routing)
- 기본 모델이 실패(쿼터/서버 오류 등)하면 **fallback 모델로 자동 전환**할 수 있습니다(기본 활성).
- 모델 선택 우선순위:
  1) `--model` 플래그
  2) `GEMINI_MODEL` 환경 변수
  3) `settings.json`의 `model.name`

### 8.3 고급 모델 설정(Generation settings)
- `ModelConfigService` 기반의 **Model Configuration** 시스템으로 `temperature`, `topP`, `thinkingBudget` 같은 파라미터를 정밀 제어할 수 있습니다.
- **Aliases(프리셋)**와 **Overrides(상황별 덮어쓰기)**로 환경/에이전트별 세밀한 튜닝이 가능합니다.

---

## 9) 사용량/비용/캐시

### 9.1 `/stats`
- 현재 세션의 토큰 사용량, (가능한 경우) **캐시된 토큰 절감**, 세션 시간 등을 보여줍니다.
- 캐시 토큰 정보는 **API key 인증에서만** 표시되고, OAuth 인증에서는 현재 표시되지 않을 수 있습니다.

### 9.2 Token caching (비용 최적화)
- 캐시된 토큰을 활용해 비용/지연을 줄이는 기능을 제공합니다.
- `/stats`에서 캐시 절감량을 확인할 수 있습니다.
- OAuth 사용자(개인/기업 계정)의 일부 API는 “cached content creation”을 지원하지 않을 수 있습니다.

---

## 10) Telemetry (OpenTelemetry 관측성)
- Gemini CLI는 **OpenTelemetry 기반 텔레메트리(관측성)** 문서를 제공합니다.
- 환경/조직 요구에 따라 메트릭/추적을 내보내는 구성이 가능합니다(세부는 텔레메트리 문서 참고).

---

## 11) IDE 연동

- `/ide enable` / `/ide disable` : IDE 연결 on/off
- `/ide status` : 연결 상태 및 IDE에서 전달된 컨텍스트(최근 파일 등) 확인
- 파일 수정 시 IDE에서 diff 뷰를 열고 수락/거절할 수 있습니다.
- Sandbox 환경에서 사용 시:
  - macOS Seatbelt 프로필은 네트워크 접근 허용 필요
  - Docker/Podman 컨테이너에서는 `host.docker.internal`로 호스트 IDE 확장에 연결 가능

---

## 12) Extensions (확장)

### 12.1 Extensions로 할 수 있는 것
Extensions는 아래를 “묶어서” 배포/공유할 수 있습니다:
- MCP 서버(툴) 정의
- Custom commands
- Context 파일
- Agent Skills
- Hooks
- Custom themes
- Subagents(확장에 포함 가능)

### 12.2 확장 생성/로컬 개발
- `gemini extensions new <my-extension>`
- 로컬 개발 중엔 link 방식으로 워크스페이스에 연결해 테스트할 수 있습니다.

### 12.3 확장 매니페스트(예: gemini-extension.json) 주요 요소
- `name`, `version`, `description`
- `mcpServers` : 확장에서 추가할 MCP 서버(툴)
- `contextFileName`
- `excludeTools` : 특정 툴(또는 특정 인자 패턴)을 차단 가능 (예: `run_shell_command(rm -rf)`)
- `themes`
- `settings` : 설치 시 사용자에게 받을 설정값
  - `sensitive: true`로 지정한 값은 시스템 키체인에 저장되고 가려질 수 있음
  - 설정값은 MCP 서버 프로세스에 **환경변수로 주입**될 수 있음

---

## 13) Custom commands (TOML) — 개인/팀용 프롬프트 단축키

### 13.1 위치/우선순위
- 유저 전역: `~/.gemini/commands/`
- 프로젝트 로컬: `<project>/.gemini/commands/`
- 같은 이름이면 **프로젝트 로컬이 전역을 덮어씀**

### 13.2 네이밍/네임스페이스
- 파일 경로가 커맨드 이름이 됩니다.
  - `~/.gemini/commands/test.toml` → `/test`
  - `<project>/.gemini/commands/git/commit.toml` → `/git:commit`

### 13.3 인자 처리 & 동적 주입
- `{{args}}` 플레이스홀더:
  - 프롬프트 본문에선 raw로 주입
  - `!{...}` 내부에서는 **자동 shell-escape**되어 커맨드 인젝션 위험을 줄임
- 기본 인자 처리:
  - `{{args}}`가 없으면, 사용자가 입력한 원문 커맨드를 프롬프트 끝에 붙여 모델이 파싱하게 할 수 있음
- `!{...}`:
  - 프롬프트 안에서 쉘 커맨드를 실행해 결과를 삽입
  - 실행 전 사용자 확인(보안)
- `@{...}`:
  - 파일 내용/디렉터리 목록을 프롬프트에 삽입
  - 이미지/오디오/비디오/PDF 등 멀티모달 파일도 인코딩해 주입 가능
  - `.gitignore`/`.geminiignore`를 존중하도록 설정 가능

---

## 14) Agent Skills

- Skills는 “상시 로드되는 배경 지침(GEMINI.md)”과 달리, **필요할 때만 호출되는 온디맨드 전문 지식 패키지**입니다.
- 모델이 필요하다고 판단하면 `activate_skill` 도구로 스킬의 전체 지침/리소스를 로드합니다.
- 발견(Discovery) 위치(예):
  - 워크스페이스: `.gemini/skills/` 또는 `.agents/skills/`
  - 유저 전역: `~/.gemini/skills/` 또는 `~/.agents/skills/`

---

## 15) Subagents & Remote subagents (실험)

### 15.1 Subagents
- 메인 세션과 분리된 컨텍스트/툴셋으로 특정 작업(코드베이스 분석 등)을 위임하는 “전문가 에이전트”입니다.
- 커스텀 subagent 사용은 `settings.json`에서 `experimental.enableAgents: true`로 활성화가 필요합니다.
- built-in 예:
  - `codebase_investigator`
  - `cli_help`
  - `generalist_agent`
- 커스텀 에이전트 정의:
  - `.gemini/agents/*.md` 또는 `~/.gemini/agents/*.md`
  - YAML frontmatter로 `name`, `description`, `tools`, `model`, `temperature`, `max_turns` 등 정의
  - 본문은 system prompt 역할

> 경고: Subagents는 실험 기능이며, “YOLO mode”로 동작해 도구 실행이 더 공격적일 수 있습니다(강력한 툴 부여 시 주의).

### 15.2 Remote subagents (A2A)
- Agent-to-Agent(A2A) 프로토콜로 원격 에이전트에 위임할 수 있습니다.
- `.md` + YAML frontmatter로 `kind: remote`, `name`, `agent_card_url` 등을 지정.
- CLI에서 `/agents list|refresh|enable|disable`로 관리할 수 있습니다.

---

## 16) MCP(Model Context Protocol) 서버

### 16.1 MCP 서버 개요
- MCP 서버는 외부 시스템/데이터(예: DB, GitHub, Slack 등)와 상호작용하는 **툴/리소스**를 CLI에 노출하는 애플리케이션입니다.

### 16.2 설정 & 전송(Transport)
- `settings.json`의 `mcpServers`에 서버를 정의해 연결합니다.
- 전송 방식:
  - Stdio (서브프로세스 stdin/stdout)
  - SSE
  - Streamable HTTP
- 서버별 옵션:
  - `command`/`args` 또는 `url`/`httpUrl`
  - `env`, `cwd`, `timeout`
  - `trust: true`면 해당 서버의 툴 실행 확인을 우회(주의)
  - `includeTools`로 서버에서 가져올 툴 allowlist 가능
- 전역 설정으로 `mcp.allowed` / `mcp.excluded` 같은 allow/denylist를 둘 수 있습니다.

### 16.3 MCP 리소스 참조
- 서버가 resources를 제공하면 `/mcp`에서 Tools/Prompts/Resources를 함께 볼 수 있습니다.
- `@server://resource/path`로 리소스를 프롬프트에 주입할 수 있습니다.

---

## 17) 보안 기능 모음

### 17.1 Trusted folders
- “이 폴더의 설정/확장/도구 사용을 신뢰할지”를 묻고, 신뢰하지 않으면 **safe mode**로 제한합니다.
- safe mode에서 비활성화될 수 있는 예:
  - `.gemini/settings.json` 무시
  - 프로젝트 `.env` 로드 무시
  - 확장 설치/업데이트/삭제 제한
  - 툴 자동 승인 비활성화
  - 자동 메모리 로딩 비활성화
  - MCP 서버 연결 비활성화
  - 커스텀 커맨드 로드 비활성화

### 17.2 Sandboxing
- 쉘 실행/파일 수정 같은 위험 작업을 호스트에서 격리해 실행하는 방식입니다(컨테이너 기반 등).
- 프로젝트 요구에 맞춰 `.gemini/sandbox.Dockerfile` 같은 커스텀 샌드박스 정의도 가능할 수 있습니다.

### 17.3 Policy engine
- 툴 호출을 allow/deny/ask_user(확인 요구)로 제어하는 **정책 엔진**을 제공합니다.
- MCP 툴은 와일드카드(예: `my-server__*`) 같은 매칭으로 규칙 적용 가능.
- 승인 모드(yolo/autoEdit 등)에 따라 기본 규칙이 달라질 수 있습니다.

---

## 18) UI/생산성 기능 (일부)

### 18.1 키보드 단축키(예)
- `Shift+Tab` : 승인 모드 순환 (default → auto_edit → plan)
- `Ctrl+Y` : YOLO(자동 승인) 토글
- `Ctrl+T` : TODO 전체 토글
- `Ctrl+G` : IDE 컨텍스트 상세 표시
- `Alt+M` : 마크다운 렌더링 토글
- `Ctrl+Z` : CLI suspend(백그라운드)

### 18.2 백그라운드 쉘 관리
- `/shells`(또는 `/bashes`)로 백그라운드 쉘/장기 실행 프로세스를 조회/관리할 수 있습니다.

### 18.3 테마/설정/터미널 설정
- `/theme` : 테마 변경
- `/settings` : 설정 UI
- `/terminal-setup` : 멀티라인 입력을 위한 터미널 키바인딩 설정
- `/vim` : Vim 모드 토글

---

## 19) 엔터프라이즈(조직) 운영 관점 (요약)
- 조직에서 보안 강화를 위해:
  - 샌드박스 강제
  - 안전한 쉘/파일 툴 allowlist
  - 특정 MCP 서버만 허용(allowlist)
  - 텔레메트리로 감사(auditing)
  - `/bug`를 내부 티켓 시스템으로 리다이렉트
  - 일반 사용 통계 비활성화
  같은 정책을 적용할 수 있습니다.

---


## 18.4 내장 슬래시 커맨드(요약 목록)
> 실제 동작/옵션은 버전에 따라 달라질 수 있으니, CLI 안에서 `/help` 또는 공식 Command reference를 함께 참고하세요.

- 기본/도움말: `/help`, `/about`, `/docs`
- 인증/계정: `/auth`
- 확장/연동: `/extensions`, `/mcp`, `/ide`, `/hooks`, `/skills`
- 컨텍스트/메모리: `/memory`, `/compress`
- 세션/히스토리: `/chat`, `/resume`, `/rewind`, `/restore`, `/clear`
- 모델/계획: `/model`, `/plan`, `/stats`
- UI/환경: `/settings`, `/theme`, `/terminal-setup`, `/vim`
- 시스템/쉘: `/shells`(또는 `/bashes`), `!<command>`(쉘 실행/쉘 모드 토글)
- 기타: `/commands`, `/copy`, `/directory`, `/editor`, `/setup-github`, `/policies`, `/privacy`
- 종료: `/quit` 또는 `/exit`


## 부록 A) 빠른 체크리스트
- 프로젝트에 들어가서 `gemini` 실행
- 컨텍스트 파일(예: `GEMINI.md`)로 작업 지침 추가
- 필요한 파일은 `@`로 주입, 필요한 커맨드는 `!`로 실행(주의)
- 코드 변경 작업은 Checkpointing/Restore 또는 Rewind로 안전장치 확보
- 반복 프롬프트는 Custom commands(TOML)로 단축키화
- 외부 시스템 연동은 MCP 서버 또는 Extensions로 확장
- 보안이 걱정되면 Trusted folders + Sandboxing + Policy engine 활용
