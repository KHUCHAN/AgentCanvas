# Codex CLI 기능 정리 (OpenAI Developers 문서 기준)

> 기준 문서: OpenAI Developers의 Codex CLI 섹션  
> 확인일: 2026-02-19 (America/Los_Angeles)

## 한눈에 보기

Codex CLI는 터미널에서 실행하는 코딩 에이전트로, **선택한 디렉토리(워크스페이스) 안의 코드를 읽고/수정하고/커맨드를 실행**하면서 작업할 수 있습니다. 또한:
- **대화형 TUI(전체 화면) 모드**
- **세션(대화) 로컬 저장 및 재개(resume)**
- **모델/추론(Reasoning) 설정 변경**
- **이미지 입력(스크린샷/디자인 스펙)**
- **로컬 코드 리뷰(/review)**
- **웹 검색(캐시/라이브)**
- **비대화형 자동화 실행(codex exec) + JSONL 출력**
- **Codex Cloud 작업 실행/목록/패치 적용**
- **MCP(Model Context Protocol)로 외부 도구 연결**
- **승인(approval)·샌드박스(sandbox) 정책으로 안전 제어**
를 지원합니다.

---

## 1) 설치, 실행, 업그레이드, 지원 OS

### 설치 (npm)
```bash
npm i -g @openai/codex
```

### 실행
```bash
codex
```

- 첫 실행 시 **ChatGPT 계정 로그인** 또는 **API 키**로 인증합니다.

### 업그레이드 (npm)
```bash
npm i -g @openai/codex@latest
```

### 지원 OS
- macOS, Linux: 정식 지원
- Windows: 실험적(권장: WSL 워크스페이스에서 사용)

---

## 2) 기본 사용 흐름

### 2.1 대화형(Interactive) 모드 — TUI
```bash
codex
```

- 전체 화면 TUI가 열리고, 리포지토리를 읽고 파일을 수정하며 커맨드를 실행하는 흐름에 적합합니다.
- 세션을 닫을 때는 `Ctrl+C` 또는 `/exit`(또는 `/quit`)을 사용합니다.
- 입력창(composer)에서 `Up/Down`으로 **이전 초안(draft) 히스토리**를 탐색할 수 있습니다(텍스트 및 이미지 플레이스홀더 포함).

### 2.2 한 번 질문하고 종료(One-shot)
```bash
codex "explain this codebase"
```
- TUI를 띄우지 않고, 작업 디렉토리를 읽고 답변을 스트리밍한 뒤 종료합니다.

### 2.3 세션 재개(Resume)
Codex는 **트랜스크립트를 로컬에 저장**하므로, 동일 프로젝트에서 컨텍스트를 반복 입력하지 않고 이어서 작업할 수 있습니다.

#### 최근 세션 재개(선택 UI)
```bash
codex resume
```

#### 현재 디렉토리 기준 가장 최근 세션 즉시 재개
```bash
codex resume --last
```

#### 현재 디렉토리 밖 세션까지 포함
```bash
codex resume --all
```

#### 특정 세션 ID로 재개
```bash
codex resume <SESSION_ID>
```

> 세션 ID는 세션 선택 UI, `/status`, 또는 `~/.codex/sessions/` 아래 파일들에서 확인할 수 있습니다.

---

## 3) 모델 및 추론(Reasoning) 제어

### 3.1 모델 선택
- 일반적으로 `gpt-5.3-codex`가 기본 추천 모델로 안내됩니다.
- 세션 중에는 `/model`로 모델을 바꿀 수 있고, 실행 시에는 `--model`로 지정할 수 있습니다.

```bash
codex --model gpt-5.3-codex
```

### 3.2 추론 강도(Reasoning effort) 등
일부 모델/설정에서는 **추론 강도**(예: low/medium/high)를 조절할 수 있습니다.  
슬래시 커맨드 `/model`이 “가능한 경우 reasoning effort도” 함께 설정할 수 있다고 문서에 명시됩니다.

(참고: 구성 파일 `config.toml`에는 `model_reasoning_effort`, `model_reasoning_summary`, `model_verbosity` 같은 키가 존재합니다.)

---

## 4) 기능 플래그(feature flags) & 실험 기능 토글

### 4.1 feature flags 관리 (CLI)
```bash
codex features list
codex features enable <feature>
codex features disable <feature>
```

- `enable/disable`은 `~/.codex/config.toml`에 **영구 반영**됩니다.
- `--profile`로 프로파일을 선택해 실행한 경우, 변경이 해당 프로파일에 저장됩니다.

### 4.2 `/experimental` (슬래시 커맨드)
대화형 세션 안에서 `/experimental`로 실험 기능을 켜고 끌 수 있습니다(예: 서브 에이전트/멀티 에이전트).

---

## 5) 멀티 에이전트(Multi-agents, experimental)

Codex CLI는 실험적으로 **여러 에이전트를 병렬로 띄워** 작업을 분담하고 결과를 합치는 워크플로를 지원합니다.

### 활성화
- 대화형 CLI에서 `/experimental` → Multi-agents 활성화 → Codex 재시작
- 또는 `~/.codex/config.toml`의 feature flag로 활성화:
```toml
[features]
multi_agent = true
```

### 사용/관리
- Codex가 자동으로 서브 에이전트를 띄울 수도 있고, 명시적으로 “포인트별로 에이전트 하나씩” 같은 프롬프트로 유도할 수도 있습니다.
- `/agent`로 실행 중인 에이전트(스레드) 사이를 전환/조회합니다.
- 서브 에이전트는 현재 샌드박스 정책을 상속하지만, **비대화형 승인 방식**으로 동작합니다(추가 승인이 필요한 액션은 실패하고 오류가 상위 워크플로에 노출).

### 에이전트 역할(Role) 구성(요약)
- `[agents]` 섹션에 역할(role)을 정의할 수 있으며, 역할별로 모델/샌드박스/지침 등을 오버라이드할 수 있습니다.
- 기본 제공 role 예시: `default`, `worker`, `explorer`

---

## 6) 이미지 입력(Image inputs)

스크린샷/디자인 스펙 이미지를 함께 넘겨서, Codex가 이미지 내용을 읽고 작업하도록 할 수 있습니다.

### CLI에서 파일 첨부
```bash
codex -i screenshot.png "Explain this error"
codex --image img1.png,img2.jpg "Summarize these diagrams"
```

- PNG/JPEG 등 일반 포맷을 지원합니다.
- 여러 장은 콤마로 구분하거나 플래그를 반복합니다.
- 대화형 TUI에서는 composer에 이미지를 “붙여넣기”로 넣을 수도 있습니다.

---

## 7) 로컬 코드 리뷰(/review)

대화형 CLI에서 `/review`를 입력하면 리뷰 프리셋을 열어,
선택한 diff를 기반으로 **별도의 리뷰어가 우선순위 높은 피드백**을 제공합니다.

- 기본적으로 현재 세션 모델을 사용
- `config.toml`의 `review_model`로 리뷰 전용 모델 오버라이드 가능
- 워킹 트리를 수정하지 않음(리뷰 전용)

리뷰 프리셋 예:
- base branch 기준 리뷰(머지 베이스 계산 후 diff 분석)
- uncommitted changes 리뷰(스테이징/언스테이징/미추적 포함)
- 특정 커밋 리뷰(SHA 선택)
- 커스텀 리뷰 지침(예: “접근성 회귀에 집중”)

---

## 8) 웹 검색(Web search)

Codex CLI에는 1st-party 웹 검색 도구가 있습니다.

- 로컬 작업에서는 기본적으로 **캐시된 웹 검색 결과**를 사용합니다(라이브 페이지를 즉시 긁지 않고, OpenAI가 유지하는 인덱스에서 결과 제공).
- 이는 임의의 라이브 콘텐츠로부터의 프롬프트 인젝션 노출을 줄이기 위한 설계지만, 결과는 여전히 “untrusted”로 취급하는 것이 권장됩니다.
- 최신 정보가 필요하면:
  - 단일 실행에 `--search`를 붙여 “live” 검색을 켜거나
  - `config.toml`에서 `web_search = "live"`로 설정할 수 있습니다.
- `web_search = "disabled"`로 완전히 끌 수도 있습니다.
- `--yolo`(full access에 준하는 위험 설정) 또는 full access 샌드박스 설정을 쓰면, 웹 검색이 기본적으로 live로 전환될 수 있습니다.
- 웹 검색을 수행하면 transcript 또는 `codex exec --json` 출력에서 `web_search` 아이템이 나타납니다.

---

## 9) 승인(Approvals) & 샌드박스(Sandbox) 정책

### 9.1 Approval modes (대화형)
대화형 세션에서 `/permissions`로 승인 모드를 바꿀 수 있습니다.

- **Auto (기본)**: 워크스페이스 안에서 읽기/편집/커맨드 실행 가능. 범위 밖 접근·네트워크 사용 등은 추가 확인.
- **Read-only**: 컨설팅 모드에 가깝게 동작(편집/커맨드 실행은 더 보수적으로)
- **Full Access**: 네트워크 포함, 머신 전반에서 더 광범위하게 실행(권장: 신뢰 가능한 상황에서만)

### 9.2 글로벌 플래그로 제어 (요약)
대표적인 글로벌 플래그:
- `--ask-for-approval, -a`: `untrusted | on-request | never`
- `--sandbox, -s`: `read-only | workspace-write | danger-full-access`
- `--full-auto`: 로컬 작업 프리셋(승인 `on-request` + 샌드박스 `workspace-write`)
- `--yolo`: 승인/샌드박스 우회(매우 위험)

---

## 10) 스크립팅/자동화 (codex exec + Non-interactive mode)

### 10.1 `codex exec` (비대화형 실행)
```bash
codex exec "fix the CI failure"
```

- TUI 없이 실행되고, 결과를 표준 출력으로 내보내 스크립트/CI에 연결할 수 있습니다.
- 세션은 로컬에 저장될 수 있으며 `codex exec resume ...`으로 이어서 실행 가능합니다.

### 10.2 출력 스트림 설계(파이프라인 친화)
- 비대화형 모드에서 **스트리밍 로그는 stderr**, 최종 결과는 stdout으로 내보내는 형태로 설명됩니다.
- 따라서 `stdout`만 캡처해 후처리하고, 진행 로그는 터미널에 남기는 파이프라인을 만들기 쉽습니다.

### 10.3 JSONL 이벤트 스트림 출력
```bash
codex exec --json "..."
# (또는) --experimental-json
```
- 사람이 읽는 텍스트 대신, newline-delimited JSON 이벤트를 출력합니다.

### 10.4 결과를 파일로 저장 / 스키마 검증
- `--output-last-message, -o <path>`: 최종 메시지를 파일로 저장
- `--output-schema <path>`: 최종 응답이 따라야 할 JSON Schema를 주면, Codex가 검증합니다.

### 10.5 세션 저장 억제(ephemeral)
- `--ephemeral`: 세션 롤아웃 파일을 디스크에 남기지 않음

### 10.6 Git repo 체크
- 비대화형 실행은 기본적으로 Git 리포지토리에서 실행되는 것을 가정할 수 있으며,
  필요 시 `--skip-git-repo-check`로 우회할 수 있습니다.

### 10.7 인증 (CI에서)
- CI에서 비대화형 실행을 위해 `CODEX_API_KEY` 환경변수를 사용하는 예가 문서에 등장합니다.

---

## 11) Codex Cloud 작업 (codex cloud / codex apply)

### 11.1 클라우드 작업 실행
```bash
codex cloud
```
- 인자 없이 실행하면 **인터랙티브 피커**로 작업을 탐색/실행하고, 완료된 작업의 diff를 로컬 프로젝트에 적용할 수 있습니다.

직접 실행:
```bash
codex cloud exec --env ENV_ID "Summarize open bugs"
```

- `--env ENV_ID`는 필수
- `--attempts 1-4`로 best-of-N 시도를 요청 가능
- 제출 실패 시 non-zero 종료 코드로 끝나도록 설계되어 자동화에 연결 가능

### 11.2 작업 목록
```bash
codex cloud list --limit 20
```

옵션:
- `--cursor <string>`: 페이지네이션 커서
- `--env ENV_ID`: 환경 필터
- `--json`: 기계 판독용 JSON 출력
- `--limit 1-20`: 반환 개수

### 11.3 작업 diff 적용
```bash
codex apply <TASK_ID>
```
- Codex Cloud task의 최신 diff를 로컬 repo에 적용합니다.
- `git apply`가 충돌 등으로 실패하면 non-zero로 종료합니다.

---

## 12) MCP(Model Context Protocol) 통합

MCP는 모델이 “도구/컨텍스트”에 접근할 수 있도록 연결하는 프로토콜입니다. Codex는 CLI와 IDE 확장에서 MCP 서버를 지원합니다.

### 12.1 지원하는 MCP 서버 형태
- **STDIO 서버**: 로컬 프로세스로 실행(커맨드로 시작)
  - 환경 변수 전달 가능
- **Streamable HTTP 서버**: URL로 접속
  - Bearer token 인증
  - OAuth 인증(지원 서버에 한해 `codex mcp login <server-name>`)

### 12.2 CLI에서 MCP 서버 관리 (`codex mcp`)
MCP 서버 설정은 `~/.codex/config.toml`에 저장됩니다.

```bash
codex mcp list
codex mcp add <name> -- <stdio-command...>
codex mcp add <name> --url https://...   # streamable HTTP
codex mcp get <name>
codex mcp login <name> --scopes scope1,scope2
codex mcp logout <name>
codex mcp remove <name>
```

`add` 주요 옵션:
- `--env KEY=VALUE` (repeatable): stdio 서버 실행 시 환경 변수
- `--url <value>`: streamable HTTP 서버 등록(stdio COMMAND와 상호 배타)
- `--bearer-token-env-var ENV_VAR`: HTTP 접속 시 Authorization bearer token을 환경변수에서 읽기

### 12.3 대화형에서 MCP 확인
- 대화형 TUI에서 `/mcp`로 활성 MCP 도구를 확인할 수 있습니다.

### 12.4 config.toml에서 MCP 서버 직접 설정(개념)
`[mcp_servers.<server-name>]` 테이블로 stdio/HTTP 서버를 정의할 수 있으며,
startup timeout, tool timeout, enabled/required, tool allow/deny list 등 옵션을 줄 수 있습니다.

---

## 13) Slash commands (대화형 TUI 내 명령)

### 13.1 Built-in slash commands 목록 (요약)
아래는 문서에 정리된 built-in 커맨드들입니다(일부는 alias/동의어 포함).

- `/permissions` : 승인/권한(approval) 모드 변경
- `/approvals` : `/permissions`와 동일한 의미로 안내됨(대체 이름)
- `/sandbox-add-read-dir` : 읽기 전용 디렉토리 추가
- `/agent` : 멀티 에이전트 스레드 전환/조회
- `/apps` : 앱(커넥터) 브라우즈 후 프롬프트에 삽입(`$app-slug`)
- `/compact` : 현재 보이는 대화를 요약해 토큰 절약
- `/diff` : Git diff 표시(미추적 파일 포함)
- `/review` : 로컬 코드 리뷰 프리셋 실행
- `/model` : 모델(및 가능한 경우 reasoning effort) 선택
- `/mcp` : 구성된 MCP 도구 목록 확인
- `/mention` : 파일/폴더를 대화에 첨부/지정
- `/plan` : 계획(Plan) 관련 워크플로
- `/personality` : 응답 톤/스타일 조정
- `/status` : 세션 상태 확인
- `/statusline` : 상태줄 표시 관련
- `/debug-config` : 현재 설정/구성 디버그 출력
- `/experimental` : 실험 기능 토글(예: 서브 에이전트)
- `/init` : 현재 디렉토리에 `AGENTS.md` 스캐폴드 생성
- `/feedback` : 로그를 maintainers에 전송(이슈/진단 공유)
- `/logout` : 로그아웃(공용 머신에서 자격 증명 제거 용도)
- `/exit` 또는 `/quit` : CLI 종료
- `/help` : 도움말

### 13.2 커스텀 slash commands
문서에 따르면 팀/개인용으로 재사용 가능한 커맨드를 만들 수 있으며,
로컬 디스크에 **Markdown 파일로 커맨드를 저장**해 불러오는 방식이 안내됩니다.

---

## 14) CLI 명령어 레퍼런스 (요약)

### 14.1 전역(Global) 플래그
> 아래 플래그들은 `codex` 기본 명령과 대부분의 서브커맨드에 적용됩니다.  
> (서브커맨드 사용 시 전역 플래그는 `codex exec --oss ...`처럼 **서브커맨드 뒤에** 두는 것이 권장됩니다.)

| 플래그 | 값/타입 | 설명 |
|---|---|---|
| `--add-dir <path>` | path | 워크스페이스 외 추가 쓰기 권한 디렉토리 허용(반복 가능) |
| `--ask-for-approval, -a` | `untrusted \| on-request \| never` | 커맨드 실행 전 승인 요청 정책 (`on-failure`는 deprecated) |
| `--cd, -C <path>` | path | 시작 전 작업 디렉토리 변경 |
| `--config, -c key=value` | key=value | config override(가능하면 JSON으로 파싱, 아니면 문자열) |
| `--dangerously-bypass-approvals-and-sandbox, --yolo` | bool | 승인/샌드박스 완전 우회(매우 위험) |
| `--disable <feature>` | feature | feature flag 강제 비활성화(`-c features.<name>=false`) |
| `--enable <feature>` | feature | feature flag 강제 활성화(`-c features.<name>=true`) |
| `--full-auto` | bool | 로컬 작업 프리셋(승인 on-request + 샌드박스 workspace-write) |
| `--image, -i <paths>` | path[,path...] | 초기 프롬프트에 이미지 첨부 |
| `--model, -m <string>` | string | 모델 오버라이드 |
| `--no-alt-screen` | bool | TUI alternate screen 비활성화 |
| `--oss` | bool | 로컬 오픈소스 모델 provider 사용(실행 중인 Ollama 필요) |
| `--profile, -p <string>` | string | config.toml 프로파일 선택 |
| `--sandbox, -s` | `read-only \| workspace-write \| danger-full-access` | 모델이 생성한 커맨드의 샌드박스 정책 |
| `--search` | bool | 웹 검색을 live로(`web_search="live"`) |
| `PROMPT` | string | 시작 시 보낼 프롬프트(없으면 TUI만 실행) |

### 14.2 주요 서브커맨드
| 커맨드 | 용도(요약) |
|---|---|
| `codex` | 대화형 TUI(또는 one-shot prompt) |
| `codex exec` (alias `codex e`) | 비대화형 실행(자동화/스크립팅), JSONL 출력/스키마 검증/세션 재개 등 |
| `codex resume` | 과거 대화형 세션 재개 |
| `codex fork` | 과거 세션을 새 스레드로 fork(원본 보존) |
| `codex features` | feature flags 목록/enable/disable(영구 저장) |
| `codex login` | OAuth(브라우저/디바이스) 또는 stdin API 키로 인증 |
| `codex logout` | 저장된 자격 증명 제거 |
| `codex cloud exec/list` | Codex Cloud 작업 실행/목록 |
| `codex apply` | Cloud 작업 diff를 로컬에 적용 |
| `codex mcp` | MCP 서버 추가/목록/조회/OAuth 로그인 등 |
| `codex mcp-server` | Codex 자체를 MCP 서버로 실행(stdio) |
| `codex completion` | 셸 자동완성 스크립트 생성 |
| `codex app` | macOS에서 Codex Desktop 실행(워크스페이스 열기) |
| `codex app-server` | 로컬 app server 실행(개발/디버깅 목적) |
| `codex sandbox` | Codex와 동일한 정책으로 샌드박스 안에서 임의 커맨드 실행 |
| `codex execpolicy` | execpolicy 룰로 커맨드 허용/차단/프롬프트 여부 평가(프리뷰) |
| `codex debug app-server send-message-v2` | app-server 테스트 클라이언트로 메시지 송신(디버그) |

---

## 15) 예시 모음

### 안전한 로컬 작업(승인 최소화 프리셋)
```bash
codex --full-auto
```

### 라이브 웹 검색이 필요한 경우(단일 실행)
```bash
codex --search "최신 릴리즈 노트 요약해줘"
```

### 비대화형 + JSONL 이벤트 출력
```bash
codex exec --json "fix the CI failure"
```

### Cloud 작업 best-of-N 시도
```bash
codex cloud exec --env ENV_ID --attempts 3 "Summarize open bugs"
```

### MCP 서버 추가(stdio)
```bash
codex mcp add context7 -- npx -y @upstash/context7-mcp
```

---

## 16) (부록) codex sandbox 명령 요약

`codex sandbox`는 Codex가 내부적으로 사용하는 정책(샌드박스)을 재사용해,
임의 커맨드를 별도로 실행해보는 “헬퍼”입니다.

### macOS seatbelt
- `--config, -c key=value` (repeatable)
- `--full-auto`
- `COMMAND...` ( `--` 뒤에 전달)

### Linux Landlock
- `--config, -c key=value` (repeatable)
- `--full-auto`
- `COMMAND...` ( `--` 뒤에 executable 전달)

---

끝.
