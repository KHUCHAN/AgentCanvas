공통 개념: SKILL(Agent Skill)이란?

공식 “Agent Skills” 표준 문서 기준으로, **Skill은 최소 1개의 SKILL.md 파일을 포함한 ‘폴더’**입니다. SKILL.md는:

YAML frontmatter(필수): name, description 등 “이 Skill이 무엇이고 언제 써야 하는지”를 나타내는 메타데이터

Markdown 본문: 실제로 에이전트가 따라야 할 절차/규칙/예시/주의사항 같은 “업무 지침”

으로 구성됩니다.

그리고 표준은 (그리고 각 제품도) 보통 다음과 같은 구조를 권장합니다:

SKILL.md (필수)

scripts/ (선택: 실행 가능한 코드)

references/ (선택: 참고 문서)

assets/ (선택: 템플릿/정적 리소스)

왜 “Skill”이 필요한가?

요지는 “프롬프트를 매번 길게 쓰지 말고, 팀/조직의 규칙·워크플로를 패키징해서 필요할 때만 로드하자” 입니다.
표준 문서도 Skill을 “instructions/scripts/resources가 들어있는 폴더”로 정의하고, 여러 에이전트 제품에서 재사용할 수 있는 포맷이라고 설명합니다.

Claude의 SKILL: Agent Skills + Claude Code Skills
1) Claude(Anthropic) “Agent Skills” 정의

Anthropic 공식 문서에서 Agent Skills는 Claude의 기능을 확장하는 모듈형 능력이며, 각 Skill은

instructions(지침),

metadata(메타데이터),

optional resources(스크립트, 템플릿 등)

를 패키징한 것이라고 설명합니다.

또한 Claude는 VM(가상 머신) 환경 + 파일시스템 접근을 통해 Skill을 디렉터리로 다루며, 점진적 로딩(Progressive disclosure) 을 강조합니다:

Level 1 (항상 로드): name/description 같은 메타데이터는 시작 시 시스템 프롬프트에 들어감

Level 2 (트리거 시 로드): SKILL.md 본문(워크플로/베스트프랙티스)이 필요할 때만 읽혀 컨텍스트에 들어감

Level 3 (필요 시 로드): 추가 파일/스크립트는 참조될 때만 읽거나 실행(실행 결과만 사용)

즉, Claude Skill은 “지침 문서 + (옵션) 실행 코드/리소스”를 파일로 묶어두고 필요할 때만 읽고 실행하는 방식입니다.

2) Claude Code에서의 “Skills”

Claude Code 문서에서는 SKILL.md를 만들면 Claude가 툴킷에 추가하고,

관련한 요청이면 자동으로 사용하거나

직접 /skill-name 슬래시 커맨드로 호출할 수 있다고 명시합니다.

또한 기존 “custom slash commands”가 skills로 통합되었고, skills가 supporting files, frontmatter로 호출 정책 제어 등 추가 기능을 제공한다고 설명합니다.

3) Claude API에서의 Skills(요약)

Claude API에서는 Skills가 코드 실행 환경과 함께 붙어서 동작하며, 요청에서 container에 skill_id, type, version 등을 지정해 사용합니다(Anthropic 제공 skill과 사용자가 업로드한 custom skill 모두 동일한 형태).

Gemini의 SKILL: Gemini CLI의 Agent Skills

먼저 전제: Google “Gemini” 전체(모델/API)에서 ‘Skill’이 보편 용어라기보다는, 공식 문서상 Gemini CLI(터미널 에이전트) 의 기능으로 “Agent Skills”가 정리돼 있습니다. Google Developers 문서가 Gemini CLI를 공식적으로 소개하면서 geminicli.com 문서를 연결합니다.

1) Gemini CLI “Agent Skills” 정의

Gemini CLI 문서에서 Agent Skills는 Gemini CLI에 특화된 전문지식/절차형 워크플로/리소스를 추가하는 방법이고,
Skill = instructions + assets를 담은 self-contained directory라고 설명합니다(Agent Skills 오픈 표준 기반).

2) Gemini CLI에서 Skills가 동작하는 방식

Gemini CLI는 “GEMINI.md(상시 컨텍스트)”와 달리 Skill을 온디맨드(필요할 때) 전문성으로 취급합니다.

핵심은:

시작 시에는 모든 Skill의 name/description만 시스템 프롬프트에 주입

모델이 “이거 Skill 써야겠다”고 판단하면 activate_skill을 호출

사용자에게 승인(Consent) 을 받고

승인되면 SKILL.md 본문과 폴더 구조가 대화에 주입되고, 해당 디렉터리에 대한 접근 권한이 열려 리소스를 읽을 수 있게 됨

한 번 활성화되면 세션 동안 해당 지침을 우선 적용

3) Skills 위치/관리(Discovery Tiers)

Gemini CLI는 skills를 3개 계층에서 찾고, 우선순위가 있습니다:

Workspace: .gemini/skills/ 또는 .agents/skills/

User: ~/.gemini/skills/ 또는 ~/.agents/skills/

Extension: 설치된 확장(extension)에 포함된 skills

그리고 우선순위는 Workspace > User > Extension 입니다.

관리 방법도 명확히 문서에 나옵니다:

인터랙티브 세션에서 /skills list|link|disable|enable|reload

터미널에서 gemini skills list|link|install|uninstall|enable|disable ...

Codex의 SKILL: Codex Agent Skills + OpenAI API Skills

OpenAI는 “Codex”와 “OpenAI API” 양쪽에서 Skills를 다루는데, 개념은 비슷하고(Agent Skills 표준 기반), 표면(Surface)과 설치/호출 방식이 다릅니다.

1) Codex “Agent Skills” 정의

Codex 문서에서:

Skill은 task-specific capability를 Codex에 추가

instructions/resources/(optional) scripts로 “워크플로를 신뢰성 있게 수행”하도록 패키징

팀/커뮤니티 공유 가능

Agent Skills 오픈 표준 기반

이라고 명시합니다.

2) Codex에서 Skills의 핵심 메커니즘

Codex는 점진적 로딩을 명시적으로 설명합니다:

시작 시: name, description, file path, (옵션) agents/openai.yaml의 메타데이터를 사용

실제로 Skill을 쓰기로 결정했을 때만 SKILL.md 전체 지침을 로드

또한 스킬 폴더 구성으로 SKILL.md(필수) + scripts/, references/, assets/, agents/openai.yaml(옵션) 등을 제시합니다.

3) Codex에서 스킬을 “호출”하는 방식

Codex는 2가지 활성화 방식을 문서화합니다:

명시적 호출: 프롬프트에 스킬을 직접 언급

CLI/IDE에서는 /skills 실행 또는 $를 입력해 스킬을 “멘션/선택”

암시적 호출: 작업이 description과 맞으면 Codex가 자동으로 적절한 스킬을 고름

4) Codex에서 Skills 저장 위치(스캔 위치)

Codex는 skills를 여러 위치에서 읽습니다(레포/유저/관리자/시스템). 특히 레포에서는 현재 디렉터리부터 레포 루트까지 올라가며 .agents/skills를 스캔한다고 문서에 있습니다.

5) OpenAI API에서의 “Skills” 정의(업로드/마운트)

OpenAI API 가이드에서는 Skills를:

버전 관리되는 파일 번들 + SKILL.md 매니페스트(frontmatter + instructions)

회사 스타일가이드부터 멀티스텝 워크플로까지 “프로세스/컨벤션을 모듈화한 지침”

이라고 정의합니다.

그리고 이 번들을 API로 업로드(POST /v1/skills)하고, hosted shell 환경에서 tools[].environment.skills로 마운트해 모델이 필요 시 사용하도록 할 수 있다고 안내합니다.

한눈에 요약 비교

공통: Skill = SKILL.md를 가진 폴더(지침 + 리소스 + (옵션) 실행 스크립트), 메타데이터 기반 자동 선택 + 필요 시 전체 로드(점진적 공개)

Claude: VM+파일시스템 기반, 문서 스킬(pptx/xlsx/docx/pdf 등) 제공, Claude Code에서는 /skill-name로 직접 호출 가능

Gemini: Gemini CLI에서 skills를 “온디맨드 전문성”으로 운영, activate_skill + 사용자 승인 + 세션 동안 우선 적용

Codex: CLI/IDE/App에서 skills 사용, /skills 또는 $로 명시 호출 가능 + description 기반 암시 호출, agents/openai.yaml 같은 추가 메타 파일 지원

OpenAI API: skills를 업로드/버전 관리하고 hosted shell 등에 붙여 재사용

(참고) SKILL.md의 최소 형태 예시

표준/각 문서가 공통으로 요구하는 핵심은 “frontmatter에 name/description”입니다.

---
name: example-skill
description: 어떤 작업을 언제(그리고 언제는 아닌지) 수행하는 스킬인지 구체적으로 설명
---

# Instructions
- 단계별 절차
- 입력/출력 예시
- 엣지 케이스 / 금지 조건