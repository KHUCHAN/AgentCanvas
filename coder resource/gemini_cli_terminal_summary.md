# Gemini CLI (geminicli.com/docs 기준) — 터미널 전용 “기능 → 명령(코드) → 예제” 요약

> 범위: **Gemini CLI를 터미널에서만** 쓴다는 전제  
> 제외: “Enterprise 전용 운영/설정” 섹션(예: Enterprise configuration)  
> 목표: **어떤 기능에 어떤 명령/코드 쓰는지** 한눈에 보이게 + 예제 포함  
> 출처: Gemini CLI 공식 문서(geminicli.com/docs)

---

## 0) 한 줄 정의
Gemini CLI는 Gemini 모델을 **터미널에서** 쓰기 위한 오픈소스 에이전트로, 프로젝트 폴더를 컨텍스트로 사용해 **파일 읽기/편집**, **셸 명령 실행**, **웹 검색/URL fetch**, **MCP 서버로 외부 도구 연결**, **Agent Skills/Extensions/Hooks** 등을 지원합니다.

---

## 1) 설치 / 실행 / 업데이트 / 릴리즈 채널

### 1.1 설치(권장: npm)
```bash
npm install -g @google/gemini-cli
```

### 1.2 실행(인터랙티브 REPL/TUI)
```bash
gemini
```

### 1.3 npx로 “설치 없이” 실행
```bash
npx @google/gemini-cli
# 또는 main 브랜치 직접 실행(개발/테스트 용도)
npx https://github.com/google-gemini/gemini-cli
```

### 1.4 업데이트
```bash
gemini update
```

### 1.5 릴리즈 채널(Stable / Preview / Nightly)
```bash
npm install -g @google/gemini-cli@latest   # stable
npm install -g @google/gemini-cli@preview  # preview
npm install -g @google/gemini-cli@nightly  # nightly
```

---

## 2) 인증(로그인) — 터미널에서 가장 간단한 2가지

> Enterprise/조직 계정 시나리오 세부는 생략하고, 개인/터미널 중심으로 정리합니다.

### 2.1 (권장) Google 로그인(OAuth)
```bash
gemini
# 실행 후 UI에서 "Login with Google" 선택 → 브라우저 로그인
```

### 2.2 API Key(Google AI Studio)로 사용
```bash
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
gemini
# 실행 후 UI에서 "Use Gemini API key" 선택
```

---

## 3) 실행 모드 3가지 (기능 ↔ 명령)

### 3.1 인터랙티브 모드(대화형 세션)
```bash
gemini
```
- 세션 내 제어는 `/슬래시 명령`으로 수행(예: `/model`, `/settings`, `/mcp`, `/skills` 등)

### 3.2 원샷(Headless) 모드: “한 번 실행 → 출력 → 종료”
```bash
gemini "이 프로젝트 구조를 설명해줘"
```
- **non-TTY** 환경(파이프/CI) 또는 **쿼리를 인자로 주면** 자동으로 headless로 동작합니다.

### 3.3 파이프 입력(로그/파일/명령 출력물을 컨텍스트로)
```bash
cat error.log | gemini "왜 실패했는지 설명해줘"
git diff | gemini "이 변경으로 커밋 메시지 써줘"
```

---

## 4) “파일/디렉토리 컨텍스트” 넣는 법 (핵심 문법 3종)

Gemini CLI는 입력창에서 **/ (슬래시)**, **@ (파일 포함)**, **! (셸 실행)** 세 가지를 핵심 문법으로 씁니다.

### 4.1 `@path` : 파일/폴더 내용을 현재 프롬프트에 주입
```text
@README.md 이 프로젝트 요약해줘
@src/ 이 디렉토리의 핵심 모듈 관계를 설명해줘
What is this file about? @package.json
```
- 내부적으로 `read_many_files` 도구로 내용을 읽어 프롬프트에 삽입합니다.
- 기본적으로 git-ignore 대상(node_modules, dist, .env 등)은 제외되며, 설정으로 변경할 수 있습니다.

### 4.2 `.geminiignore` : “Gemini가 볼 파일”을 Git처럼 제외
**프로젝트 루트에 `.geminiignore` 파일**을 만들어 패턴을 적으면, `@` 같은 컨텍스트 공유에서 자동 제외됩니다.

예시:
```gitignore
# /packages 디렉토리 제외
/packages/

# 특정 파일 제외
apikeys.txt

# 모든 md 제외(단 README.md는 예외)
*.md
!README.md
```
- 수정 후 **세션 재시작**이 필요합니다.

### 4.3 `!command` : Gemini CLI 안에서 즉시 셸 명령 실행(출력은 터미널에)
```text
!ls -la
!git status
```
- `!`만 단독 입력하면 **shell mode 토글**(이후 입력은 전부 셸로 해석)  
- 실행된 subprocess에는 `GEMINI_CLI=1` 환경변수가 설정됩니다.

---

## 5) 세션/히스토리/되돌리기(체크포인트 포함)

### 5.1 세션 이어하기(Resume)
- CLI 플래그:
```bash
gemini -r "latest"
gemini -r "latest" "타입 에러 있는지 확인해줘"
gemini -r "<session-id>" "남은 작업 마무리해줘"
```
- 세션 안에서:
```text
/resume
```

### 5.2 “대화 상태”를 태그로 저장/복원(브랜치용) — `/chat`
```text
/chat save mytag
/chat list
/chat resume mytag
/chat delete mytag
/chat share file.md   # 대화를 md 또는 json으로 내보내기
```
- 체크포인트는 프로젝트 스코프(실행한 폴더 기준)로 저장됩니다.

### 5.3 화면만 싹 지우기 — `/clear`
```text
/clear
```
- 단축키: `Ctrl+L`

### 5.4 대화/코드 되돌리기
- `/rewind`: 대화 히스토리를 거슬러 올라가며 “대화/파일 변경”을 되돌릴지 선택(단축키: `Esc` 두 번)
```text
/rewind
```
- `/restore`: 특정 tool 실행 직전 상태로 파일을 복구(체크포인트 필요)
```text
/restore
/restore <tool_call_id>
```

---

## 6) 계획/작업 진행 표시(Todos)

Gemini CLI는 복잡한 작업에서 `write_todos` 도구로 **할 일 목록**을 만들고 진행상태를 표시합니다.
- 토글: `Ctrl+T`
- 비활성화: `settings.json`에서 `"useWriteTodos": false`

(내부 표현 예)
```json
{
  "todos": [
    {"description": "Initialize project", "status": "completed"},
    {"description": "Implement feature X", "status": "in_progress"},
    {"description": "Add tests", "status": "pending"}
  ]
}
```

---

## 7) 모델 선택/플래그

### 7.1 세션에서 모델 변경 — `/model`
```text
/model
```

### 7.2 실행 시 모델 지정 — `--model / -m`
```bash
gemini --model pro "이 코드에서 경쟁 조건 찾아줘"
gemini -m flash "빠르게 요약만"
```

### 7.3 모델 alias(대표)
- `auto`(기본), `pro`, `flash`, `flash-lite`

---

## 8) 안전/승인/샌드박스

### 8.1 승인 모드(도구 실행 승인 정책) — `--approval-mode`
```bash
gemini --approval-mode default "..."
gemini --approval-mode auto_edit "..."   # edit 계열 도구 자동 승인
gemini --approval-mode yolo "..."        # 매우 위험: 자동 승인(주의)
```
- `--yolo/-y` 플래그는 deprecated: `--approval-mode=yolo` 권장

### 8.2 샌드박스 실행 — `--sandbox / -s`
```bash
gemini --sandbox "안전하게 수정 계획만 세워줘"
```

### 8.3 Trusted Folders(프로젝트 신뢰/안전모드)
- 설정에서 기능을 켠 뒤, 처음 실행한 폴더에서 **Trust/Don’t trust**를 선택
- untrusted(안전모드)에서는 프로젝트 설정/확장/명령/자동 승인 등이 제한됩니다.

---

## 9) 웹 검색 & URL 가져오기

### 9.1 웹 검색 — `google_web_search` 도구
- 검색이 필요하면 모델이 도구를 호출(세션에서 자연어로 “검색해서 근거 포함” 요청)

### 9.2 URL fetch/요약/비교 — `web_fetch` 도구
```text
이 두 글 차이 비교해줘: https://example.com/a https://example.com/b
```

---

## 10) 셸 실행(도구 레벨) — `run_shell_command` (고급)
`!`는 “사용자 주도” 셸 실행이라면, `run_shell_command`는 **에이전트가 도구로 셸을 실행**합니다.

`settings.json` 예:
```json
{
  "tools": {
    "shell": {
      "enableInteractiveShell": true,
      "showColor": true,
      "pager": "less"
    }
  }
}
```

---

## 11) MCP 서버 연결(외부 서비스/도구 붙이기)

### 11.1 (튜토리얼 예) GitHub MCP 서버를 Docker로 붙이기
```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="github_pat_..."
```

`settings.json` 예(발췌):
```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/modelcontextprotocol/servers/github:latest"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

연결 확인:
```text
/mcp list
```

### 11.2 CLI로 MCP 서버 관리(cheatsheet 기준)
```bash
gemini mcp add github npx -y @modelcontextprotocol/server-github
gemini mcp add api-server http://localhost:3000 --transport http
gemini mcp add slack node server.js --env SLACK_TOKEN=xoxb-xxx
gemini mcp list
gemini mcp remove github
```

### 11.3 세션 안에서 MCP 관리 — `/mcp`
```text
/mcp
/mcp list
/mcp desc
/mcp schema
/mcp refresh
/mcp auth <server-name>
```

---

## 12) Agent Skills(스킬): “필요할 때만 켜지는 전문 워크플로 패키지”

### 12.1 스킬 발견(Discovery) 위치/우선순위
- Workspace: `.gemini/skills/` 또는 `.agents/skills/`
- User: `~/.gemini/skills/` 또는 `~/.agents/skills/`
- Extensions: 설치된 extension에 포함  
우선순위: Workspace > User > Extension (동일 tier에서 `.agents/skills`가 `.gemini/skills`보다 우선)

### 12.2 스킬 만들기(튜토리얼 예: api-auditor)
```bash
mkdir -p .gemini/skills/api-auditor/scripts
```

`.gemini/skills/api-auditor/SKILL.md` 예(핵심만):
```markdown
---
name: api-auditor
description: |
  Expertise in auditing and testing API endpoints. Use when the user asks to
  "check", "test", or "audit" a URL or API.
---
```

번들 스크립트 예: `.gemini/skills/api-auditor/scripts/audit.js`
```js
const url = process.argv[2];
if (!url) { console.error('Usage: node audit.js <url>'); process.exit(1); }
console.log(`Auditing ${url}...`);
fetch(url, { method: 'HEAD' })
  .then((r) => console.log(`Result: Success (Status ${r.status})`))
  .catch((e) => console.error(`Result: Failed (${e.message})`));
```

### 12.3 스킬 확인/사용
```text
/skills list
```

### 12.4 스킬 관리(터미널/세션)
- 세션:
```text
/skills list
/skills enable <name>
/skills disable <name>
/skills reload
```
- 터미널:
```bash
gemini skills list
gemini skills link /path/to/my-skills-repo
gemini skills install https://github.com/user/repo.git
gemini skills enable my-skill
gemini skills disable my-skill --scope workspace
```

---

## 13) Extensions(확장): “배포 가능한 패키지”로 Skills/MCP/Commands/Hooks/Subagents 묶기

### 13.1 확장 관리
- 세션:
```text
/extensions list
```
- 터미널:
```bash
gemini extensions list
gemini extensions install https://github.com/gemini-cli-extensions/workspace
gemini extensions update --all
gemini extensions enable my-extension
gemini extensions disable my-extension
gemini extensions uninstall my-extension
```

### 13.2 확장 만들기(템플릿 기반)
```bash
gemini extensions new my-first-extension mcp-server
cd my-first-extension
npm install
gemini extensions link .
# 이후 gemini 재시작
```

---

## 14) Hooks: 에이전트 루프에 “검증/로깅/정책”을 끼워넣는 스크립트

예시 설정(발췌):
```json
{
  "hooks": {
    "BeforeTool": [
      {
        "matcher": "write_file|replace",
        "hooks": [
          {
            "name": "security-check",
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.gemini/hooks/security.sh",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

세션에서 hooks 관리:
```text
/hooks panel
/hooks enable-all
/hooks disable-all
/hooks enable <name>
/hooks disable <name>
```

---

## 15) Sub-agents(실험): 전문 에이전트를 “세션 안에서” 고용
- settings에서 활성화 필요:
```json
{
  "experimental": { "enableAgents": true }
}
```
- 문서상 경고: 현재 sub-agent는 “YOLO 모드”로 도구를 실행할 수 있으니 주의

---

## 16) Headless(자동화) — JSON/JSONL 출력 + exit code

### 16.1 출력 포맷
```bash
gemini --output-format text  "..."
gemini --output-format json  "..."
gemini --output-format stream-json "..."
```

### 16.2 exit code(문서 기준)
- `0`: 성공
- `1`: 일반 오류/API 실패
- `42`: 입력 오류(프롬프트/인자)
- `53`: 턴 제한 초과

### 16.3 자동화 예시(발췌)

(A) *.py마다 요약 md 생성
```bash
#!/bin/bash
for file in *.py; do
  gemini "Generate a Markdown documentation summary for @$file. Print the result to standard output." > "${file%.py}.md"
done
```

(B) JSON만 뽑아 jq로 후처리
```bash
gemini --output-format json "Return a raw JSON object with keys 'version' and 'deps' from @package.json" | jq -r '.response' > data.json
```

---

# 17) 전체 `/슬래시 명령` 목록(공식 Command reference 기반)

| 명령 | 설명(요약) |
|---|---|
| `/about` | 버전 정보 출력 |
| `/auth` | 인증 방식 변경 |
| `/bug` | 이슈 파일링 |
| `/chat` | 대화 상태 저장/복원/공유 |
| `/clear` | 화면 클리어(Ctrl+L) |
| `/commands` | 커스텀 .toml 명령 관리 |
| `/compress` | 컨텍스트 요약 치환 |
| `/copy` | 마지막 출력 클립보드 복사 |
| `/directory`(=`/dir`) | 워크스페이스 디렉토리 추가/조회 |
| `/docs` | 문서 열기 |
| `/editor` | 에디터 선택 |
| `/extensions` | 활성 확장 리스트 |
| `/help`(=`/?`) | 도움말 |
| `/hooks` | hooks 관리 |
| `/ide` | IDE 연동 관리 |
| `/init` | GEMINI.md 생성 도우미 |
| `/mcp` | MCP 서버/툴 관리 |
| `/memory` | GEMINI.md 기반 메모리 관리 |
| `/model` | 모델 선택 |
| `/plan` | Plan Mode 전환 |
| `/policies` | 정책 관리 |
| `/privacy` | 프라이버시 동의 |
| `/quit`(=`/exit`) | 종료 |
| `/restore` | 체크포인트로 파일 복구 |
| `/rewind` | 히스토리/파일 변경 되감기(Esc Esc) |
| `/resume` | 세션 재개 |
| `/settings` | 설정 UI |
| `/shells`(=`/bashes`) | 백그라운드 shells 뷰 토글 |
| `/setup-github` | GitHub Actions 설정 |
| `/skills` | 스킬 관리 |
| `/stats` | 통계 표시 |
| `/terminal-setup` | 멀티라인 입력 키바인딩 설정 |
| `/theme` | 테마 변경 |
| `/tools` | 사용 가능한 도구 목록 |
| `/vim` | 입력창 vim 모드 토글 |

---

# 18) 마지막: `/코드`, `@`, `!` “초간단 사용 설명”

- **`/` (슬래시 명령)**: CLI 자체를 제어(세션/모델/설정/MCP/skills/extensions 등)  
  예) `/model`, `/settings`, `/mcp list`, `/skills list`, `/resume`

- **`@path`**: 파일/폴더 내용을 프롬프트에 삽입  
  예) `@src/ 이 코드 구조를 설명해줘`

- **`!cmd`**: CLI 안에서 즉시 셸 실행(출력은 터미널)  
  예) `!git status`  
  `!` 단독 입력은 shell mode 토글
