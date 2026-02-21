# Codex (Developers 문서 기준) — 터미널(Codex CLI) 중심 요약
> 범위: **터미널에서 Codex CLI만 사용**하는 관점으로 정리  
> 제외: Enterprise 관련 설명/운영(관리/거버넌스 등) 섹션은 제외  
> 형식: **기능 → 어떤 명령(코드) 쓰는지 → 예제** 중심 + 마지막에 **모든 `/슬래시 명령`** 정리

---

## 0) Codex CLI 한 줄 정의
Codex CLI는 터미널에서 로컬로 실행되는 코딩 에이전트로, **선택한 디렉토리에서 코드를 읽고/수정하고/명령까지 실행**할 수 있습니다. 또한 오픈소스이며 Rust로 구현되어 빠르게 동작합니다.

---

## 1) 설치 / 실행 / 업그레이드

### 기능: 설치
```bash
npm i -g @openai/codex
```

### 기능: 실행(TUI)
```bash
codex
```
- 첫 실행 시 로그인 안내가 뜨며, ChatGPT 계정(OAuth) 또는 API 키로 인증합니다.

### 기능: 업그레이드
```bash
npm i -g @openai/codex@latest
```

> OS: macOS/Linux 지원. Windows는 실험적(WSL 권장)

---

## 2) 로그인(인증) — ChatGPT OAuth / API 키

### 기능: 브라우저 OAuth 로그인
```bash
codex login
```

### 기능: 디바이스 코드 OAuth
```bash
codex login --device-auth
```

### 기능: API 키를 stdin으로 주입
```bash
printenv OPENAI_API_KEY | codex login --with-api-key
```

### 기능: 로그인 상태 확인(자동화에 유용)
```bash
codex login status
```
- credentials가 있으면 **exit code 0**으로 종료됩니다.

### 기능: 로그아웃
```bash
codex logout
```

---

## 3) 기본 사용 모드 3가지

### 3.1 인터랙티브(TUI) 모드
```bash
codex
```
- 대화하면서 계획 → 파일 편집 → 커맨드 실행을 반복
- 세션 중 설정/모델/권한 변경은 `/슬래시 명령`으로 빠르게 수행

### 3.2 원샷(프롬프트 1개 → 처리 → 종료)
```bash
codex "이 저장소에서 빌드가 어떻게 되는지 설명해줘"
```

### 3.3 비인터랙티브(exec) 모드 (자동화/스크립팅)
```bash
codex exec "테스트 돌리고 실패한 것만 고쳐줘"
```
- 별칭: `codex e`

> 팁: 전역 플래그는 서브커맨드 뒤에 두는 게 권장됩니다.  
> 예) `codex exec --oss ...` (서브커맨드 뒤에 `--oss`)

---

## 4) 작업 범위(워크스페이스) 지정

### 기능: 시작 경로 지정(= workspace root)
```bash
codex --cd path/to/repo
# 단축
codex -C path/to/repo
```

### 기능: 추가 쓰기 디렉토리 허용
```bash
codex --add-dir ../shared
codex --add-dir /absolute/path/to/another-root
```

---

## 5) 안전 핵심: 승인(Approval) / 샌드박스(Sandbox) / 프리셋

Codex가 “명령 실행”이나 “파일 수정”을 할 때, 언제 멈춰서 승인받을지/어디까지 허용할지 정하는 장치입니다.

### 5.1 기능: 승인 정책(언제 승인 받을지)
```bash
codex --ask-for-approval on-request
codex --ask-for-approval untrusted
codex --ask-for-approval never
```
- `on-failure`는 deprecated, `on-request` 권장(문서 표기)

### 5.2 기능: 샌드박스 모드(어디까지 실행/접근 허용할지)
```bash
codex --sandbox read-only
codex --sandbox workspace-write
codex --sandbox danger-full-access
```

### 5.3 기능: “로컬 저마찰” 프리셋
```bash
codex --full-auto
```
- 문서상 의미: `--ask-for-approval on-request` + `--sandbox workspace-write`

### 5.4 기능: YOLO(승인/샌드박스 우회 — 매우 위험)
```bash
codex --yolo
# 정식 플래그명
codex --dangerously-bypass-approvals-and-sandbox
```
- 문서에서 “격리된 환경에서만” 사용을 강하게 권장합니다.

### 5.5 (TUI) 기능: 세션 중 권한을 바꾸기
- `/permissions` : 승인/권한 프리셋 변경  
- 필요 시 Windows에서는 `/sandbox-add-read-dir`로 추가 읽기 경로 부여

---

## 6) 웹 검색(Web search) — cached vs live

### 기능: 이번 실행에서만 live 검색 켜기
```bash
codex --search "최신 릴리즈 노트를 읽고 업그레이드 계획을 제안해줘"
```
- 의미: `web_search="live"`로 설정 (기본은 `"cached"`)

### 기능: (자동화) JSONL 출력에서 검색 이벤트 확인
```bash
codex exec --json "검색도 하면서 근거와 함께 정리해줘"
```

---

## 7) 이미지 입력(스크린샷/다이어그램)

### 기능: 이미지 1장
```bash
codex -i screenshot.png "이 에러를 분석해줘"
```

### 기능: 이미지 여러 장
```bash
codex --image img1.png,img2.jpg "두 다이어그램 차이를 요약해줘"
```

---

## 8) 로컬 코드 리뷰(변경사항 점검)

### 기능: 리뷰 실행(TUI)
```
/review
```
- 리뷰 전용 에이전트가 diff를 읽고 “우선순위 높은 이슈/누락된 테스트” 중심으로 피드백  
- 기본은 현재 세션 모델, `config.toml`의 `review_model`로 오버라이드 가능

### 기능: 변경사항 직접 확인(TUI)
```
/diff
```

---

## 9) 세션 관리: resume / fork / status

### 9.1 기능: 세션 재개(인터랙티브)
```bash
codex resume
codex resume --all
codex resume --last
codex resume <SESSION_ID>
```
- 세션 ID는 picker, `/status`, 또는 `~/.codex/sessions/`에서 확인 가능

### 9.2 기능: exec 세션 재개
```bash
codex exec resume --last "아까 계획대로 계속 진행"
codex exec resume <SESSION_ID> "남은 작업 마무리"
```

### 9.3 기능: 세션 분기
```bash
codex fork
codex fork --last
codex fork <SESSION_ID>
```

### 9.4 (TUI) 기능: 상태 확인
```
/status
```
- 모델/승인정책/쓰기루트/토큰 사용량 등의 요약 확인

---

## 10) 자동화(exec) — JSONL, 결과 파일 저장, 스키마 강제

### 10.1 기능: 표준 비인터랙티브 실행
```bash
codex exec "CI 실패 원인을 찾아 수정해"
```

### 10.2 기능: stdin으로 PROMPT 전달
```bash
echo "이 저장소 구조를 요약해줘" | codex exec -
```

### 10.3 기능: JSONL 이벤트 출력
```bash
codex exec --json "각 단계별 이벤트를 JSONL로 출력해줘"
```

### 10.4 기능: 최종 답변을 파일로 저장
```bash
codex exec -o last_message.txt "변경 요약만 출력해줘"
# (동일 옵션) --output-last-message last_message.txt
```

### 10.5 기능: 출력 형태를 JSON Schema로 강제
```bash
codex exec --output-schema schema.json "최종 답을 JSON 객체로만 내줘"
```

---

## 11) Codex Cloud tasks → 로컬에 diff 적용(apply)
> 터미널에서 “원격 태스크”를 돌리고, 결과 diff를 로컬에 적용할 수 있습니다.

### 11.1 기능: 클라우드 태스크 실행
```bash
codex cloud exec --env ENV_ID "리팩터링하고 테스트 추가해줘"
```

### 11.2 기능: 최근 태스크 목록(JSON)
```bash
codex cloud list --env ENV_ID --json --limit 20
```

### 11.3 기능: 태스크 diff를 로컬에 적용
```bash
codex apply <TASK_ID>
# 별칭: codex a <TASK_ID>
```
- `git apply` 충돌 등으로 실패하면 non-zero로 종료됩니다.

---

## 12) MCP(Model Context Protocol) — 외부 도구 붙이기

### 12.1 MCP의 핵심
- MCP 서버 설정은 `~/.codex/config.toml`에 저장됩니다.
- 프로젝트별로는 **trusted projects에 한해** `.codex/config.toml`에 스코프를 둘 수도 있습니다.
- **CLI와 IDE 확장은 같은 설정을 공유**하므로 한 번만 설정하면 됩니다.

### 12.2 기능: CLI로 MCP 서버 추가(stdio)
```bash
codex mcp add context7 -- npx -y @upstash/context7-mcp
```

### 12.3 기능: CLI로 MCP 서버 추가(HTTP)
```bash
codex mcp add myserver --url https://example.com/mcp
```

### 12.4 기능: 목록 보기 / 특정 서버 보기(JSON)
```bash
codex mcp list --json
codex mcp get myserver --json
```

### 12.5 기능: OAuth가 필요한 HTTP MCP 서버 로그인(서버 지원 시)
```bash
codex mcp login myserver --scopes scope1,scope2
codex mcp logout myserver
```

### 12.6 (TUI) 기능: 현재 세션에서 MCP 서버/툴 확인
```
/mcp
```

### 12.7 config.toml로 MCP 서버를 직접 정의(고급)
```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_OAUTH_TOKEN"

[mcp_servers.chrome_devtools]
url = "http://localhost:3000/mcp"
enabled_tools = ["open", "screenshot"]
disabled_tools = ["screenshot"]  # enabled_tools 이후 적용
startup_timeout_sec = 20
tool_timeout_sec = 45
enabled = true
```

---

## 13) Skills(에이전트 스킬) — “재사용 워크플로/툴+지침 패키지”

### 13.1 Skills가 뭔가?
스킬은 “지침+리소스(+선택적 스크립트)”를 하나의 폴더로 묶어 Codex가 특정 작업을 **일관된 워크플로로 수행**하게 해줍니다.

스킬은 **progressive disclosure**를 사용: Codex는 기본적으로 `name/description/path` 등 메타데이터만 보고 있다가, 실제로 쓰기로 결정했을 때 `SKILL.md` 전체를 로드합니다.

### 13.2 스킬 폴더 구조(최소/권장)
```text
my-skill/
  SKILL.md          # 필수: name/description + 지침
  scripts/          # 선택: 실행 스크립트
  references/       # 선택: 참고 문서
  assets/           # 선택: 템플릿/리소스
  agents/openai.yaml# 선택: UI/정책/의존도(툴) 메타데이터
```

### 13.3 스킬 실행 방식(2가지)
1) **명시적 실행**: 프롬프트에 스킬을 직접 포함  
   - CLI/IDE에서 **`/skills` 실행** 또는 **`$`로 스킬을 멘션**해서 선택 가능  
2) **암묵적 실행**: 작업이 스킬의 `description`과 잘 맞으면 Codex가 스스로 선택

### 13.4 스킬 생성(빠른 방법)
- 빌트인 스킬 생성기:
```text
$skill-creator
```

- 수동 생성(최소 예시: front matter 필수)
```markdown
---
name: my-skill
description: 이 스킬이 언제/언제는 절대 트리거되면 안되는지 명확히 써라.
---

여기부터 Codex가 따라야 할 단계별 지침.
```

### 13.5 스킬 저장 위치(스캔 경로)
- 레포/디렉토리: `$CWD/.agents/skills` 부터 레포 루트까지 상향 스캔
- 유저 전역: `$HOME/.agents/skills`
- 머신 공용(관리): `/etc/codex/skills`
- 시스템 번들: Codex에 기본 포함(예: `skill-creator`, plan 관련)

### 13.6 스킬 설치(빌트인 설치기)
```text
$skill-installer install the linear skill from the .experimental folder
```

### 13.7 스킬 비활성화(삭제 없이 끄기)
`~/.codex/config.toml`:
```toml
[[skills.config]]
path = "/path/to/skill/SKILL.md"
enabled = false
```
- 변경 후 Codex 재시작이 필요할 수 있습니다.

### 13.8 (고급) openai.yaml로 “툴 의존도(MCP 등)” 선언
```yaml
policy:
  allow_implicit_invocation: false

dependencies:
  tools:
    - type: "mcp"
      value: "openaiDeveloperDocs"
      description: "OpenAI Docs MCP server"
      transport: "streamable_http"
      url: "https://developers.openai.com/mcp"
```
- `allow_implicit_invocation: false`면 암묵적 실행을 막고, **명시적 `$skill` 호출만 허용**합니다.

> ⚠️ 주의: “스킬 멘션(/skills, $…)”은 Skills 문서에서 정의되며, CLI의 “Built-in slash commands 목록”에는 `/skills`가 별도로 안 보일 수 있습니다(빌드/클라이언트에 따라 노출 차이 가능). 그래도 문서상 CLI/IDE에서 `/skills` 또는 `$` 멘션을 지원한다고 안내합니다.

---

## 14) Apps(커넥터) — 터미널에서 바로 붙이기

### 기능: 앱 목록 탐색/삽입(TUI)
```
/apps
```
- 선택하면 입력창에 `$app-slug` 형태로 삽입되고, 이후 “이 앱을 써라”라고 지시할 수 있습니다.

---

## 15) 프롬프트 편집기(긴 입력에 유용)

### 기능: 입력 중 편집기 열기
- 프롬프트 입력창에서 `Ctrl+G`  
- `VISUAL` 환경변수(없으면 `EDITOR`)에 지정된 편집기를 엽니다.

---

## 16) Feature flags (기능 플래그)

### 기능: 목록/활성화/비활성화
```bash
codex features list
codex features enable unified_exec
codex features disable shell_snapshot
```
- 변경은 `~/.codex/config.toml`(또는 `--profile` 사용 시 해당 프로필)에 저장됩니다.

---

# 17) 모든 `/슬래시 명령` 목록 (Codex CLI Built-ins + alias + Skills 문서의 /skills)

> 사용: TUI에서 `/` 입력 → 팝업에서 선택  
> 아래 “Built-in” 목록은 Codex CLI Slash Commands 문서에 명시된 항목입니다.  
> 또한 Skills 문서가 언급하는 `/skills`도 함께 실어둡니다(위 13.3/13.8 참고).

| /명령 | 목적(한 줄) | 언제 쓰나 |
|---|---|---|
| `/permissions` | Codex가 “허가 없이 할 수 있는 범위” 변경 | Auto ↔ Read Only 같은 안전도 조절 |
| `/sandbox-add-read-dir` | (Windows) 샌드박스 읽기 루트 추가 | 워크스페이스 밖 경로 읽기 필요할 때 |
| `/agent` | 활성 agent thread 전환 | 서브 에이전트 결과 확인/이어서 진행 |
| `/apps` | 앱(커넥터) 탐색 후 `$app-slug` 삽입 | 특정 앱/커넥터를 프롬프트에 붙일 때 |
| `/compact` | 보이는 대화를 요약해 컨텍스트 절약 | 긴 세션에서 토큰 아끼고 싶을 때 |
| `/diff` | Git diff 표시(추적 안 된 파일 포함) | 커밋/푸시 전 변경 검토 |
| `/exit` | 종료(`/quit`와 동일) | 세션 종료 |
| `/experimental` | 실험 기능 토글 | 실험 기능 켜고 끄기 |
| `/feedback` | 로그 전송/진단 공유 | 버그 리포트/지원 요청 |
| `/init` | `AGENTS.md` 스캐폴드 생성 | 레포/폴더 지침을 영구 저장 |
| `/logout` | Codex 로그아웃 | 공유 PC 등에서 자격증명 제거 |
| `/mcp` | 현재 세션에서 MCP 서버/툴 목록 | 외부 툴이 제대로 붙었는지 확인 |
| `/mention` | 파일/폴더를 대화에 첨부 | “이 파일을 봐라”로 정확히 찍어주기 |
| `/model` | 모델(+가능하면 reasoning) 선택 | 작업 성격에 따라 모델 변경 |
| `/plan` | Plan mode 전환(옵션으로 프롬프트 포함 가능) | 구현 전에 계획부터 받고 싶을 때 |
| `/personality` | 응답 스타일 변경 | 더 간결/설명형/협업형으로 조절 |
| `/ps` | 백그라운드 터미널 목록/출력 | 오래 도는 명령 진행상황 확인 |
| `/fork` | 현 대화를 새 thread로 분기 | 다른 접근을 병렬로 시도 |
| `/resume` | 세션 리스트에서 재개 | 예전 대화를 이어서 진행 |
| `/new` | 같은 CLI에서 새 대화 시작 | 레포 유지 + 대화 컨텍스트만 초기화 |
| `/quit` | 종료(`/exit`와 동일) | 세션 종료 |
| `/review` | 워킹트리 리뷰 실행 | 작업 완료 후 품질 점검 |
| `/status` | 세션 설정/토큰/루트 등 표시 | 현재 설정/컨텍스트 확인 |
| `/debug-config` | config 레이어/요구사항 진단 출력 | 설정 우선순위/정책 충돌 디버깅 |
| `/statusline` | TUI footer(status line) 구성 | footer 항목 재배치/저장 |
| `/approvals` | **alias** (팝업에는 안 보일 수 있음) | 과거 습관/스크립트 호환용 |
| `/skills` | (Skills 문서 언급) 스킬 선택/멘션 | 스킬을 명시적으로 실행/선택 |

---

## 18) “상황별 추천 명령 조합” (짧은 레시피)

### A) 안전하게 로컬 수정 + 필요할 때만 승인
```bash
codex --full-auto "테스트 깨지는 것만 고쳐줘"
```

### B) 자동화(CI)에서 JSONL + 마지막 메시지 파일 저장
```bash
codex exec --json -o final.txt "실행 로그는 JSONL, 마지막 요약은 final.txt에"
```

### C) MCP 붙여서 최신 문서/외부 도구 사용
```bash
codex mcp add context7 -- npx -y @upstash/context7-mcp
codex
# TUI에서 /mcp 로 확인
```

### D) Skill로 워크플로 표준화(레포에 체크인)
```bash
mkdir -p .agents/skills/my-review-skill
$EDITOR .agents/skills/my-review-skill/SKILL.md
# 이후 Codex에서 /skills 또는 $로 멘션해 실행
```
