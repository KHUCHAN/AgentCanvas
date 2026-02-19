# CODE_REVIEW2: MVP 명세 vs 구현 대조 검증

## 개요
- mvp.md 명세 기준 구현 완성도: ~88%
- 검증 일자: 2026-02-18
- 검증 범위: 디자인 제외, 기능/워크플로우만 검증

## 1. MVP 워크플로우 명세 요약

### 1.1 발견(Discovery)
- Agent Skills 탐지 (프로젝트/개인/설정 위치)
- Codex AGENTS.md 체인 탐지 (Global/Project, override 우선)
- (옵션) Codex .rules 탐지
- (로드맵) OpenClaw 탐지

### 1.2 핵심 시나리오
- 시각화/탐색: 자동 발견 → 캔버스 노드 표시 → 클릭 상세 → 더블클릭 파일 열기
- 편집/생성: New Skill 생성, frontmatter 폼 편집, Validate 즉시 오류 표시
- 공유: Skill Pack zip 내보내기/가져오기, 미리보기+경고

### 1.3 n8n 스타일 UI
- 레이아웃: 왼쪽 사이드바 / 상단 바 / 캔버스(도트 그리드) / 오른쪽 패널
- 캔버스 요소: Fit/Zoom/Reset/Tidy, Add first step placeholder, + 버튼, 스티키 노트
- 노드 상호작용: hover 시 Open/Enable/Disable/Delete/More 버튼
- 단축키: Ctrl+드래그, Space+드래그, +/-/0/1, Tab, Ctrl+K, Shift+S

### 1.4 검증 규칙
- SKILL.md 필수 구조 (YAML frontmatter + Markdown body)
- name: 1-64 chars, lowercase+숫자+하이픈, 폴더명 일치
- description: 1-1024 chars

### 1.5 공유 설계
- Export: 다수 skill → zip + skillpack.json
- Import: zip → 미리보기 → 설치, scripts/ 경고

### 1.6 데이터 모델
- AgentProfile, Skill, RuleDoc, McpServer
- 노드 타입: agent, skill, ruleDoc, note, folder
- 엣지 타입: contains, overrides, locatedIn

### 1.7 Provider 아키텍처
- Provider 인터페이스 (detect, listAgents, listSkills, listRuleDocs)
- 필수: AgentSkillsProvider, CodexGuidanceProvider
- 옵션: CodexRulesProvider, OpenClawProvider

### 1.8 메시지 프로토콜
- Webview→Extension: READY, REFRESH, OPEN_FILE, CREATE_SKILL, EXPORT/IMPORT_PACK, RUN_VALIDATION 등
- Extension→Webview: INIT_STATE, STATE_PATCH, TOAST, ERROR, RESPONSE_OK/ERROR

---

## 2. 항목별 구현 상태

### Phase A — 스캐폴딩/빌드
| 항목 | 상태 | 비고 |
|------|------|------|
| VS Code extension 스캐폴딩 | ✅ | extension/src/extension.ts |
| webview-ui (Vite React TS) | ✅ | webview-ui/ with Vite config |
| extension→webview 번들 로드 | ✅ | dev server + prod dist 모두 지원 |
| Agent Studio: Open command | ✅ | agentStudio.open 커맨드 |

### Phase B — Discovery/Provider
| 항목 | 상태 | 비고 |
|------|------|------|
| AgentSkillsProvider 구현 | ✅ | 프로젝트/개인/설정 위치 탐지 |
| skill 위치 수집 | ✅ | .github/skills, .claude/skills, .agents/skills 등 |
| SKILL.md gray-matter 파싱 | ✅ | skillParser.ts |
| Agent Skills spec 검증 | ✅ | skillValidator.ts (zod 스키마) |
| CodexGuidanceProvider | ✅ | AGENTS.md 체인 탐지 |
| Global AGENTS 탐지 | ✅ | CODEX_HOME fallback |
| Project AGENTS 체인 탐지 | ✅ | 루트→현재 순회, override 우선 |
| Codex .rules 탐지 | ❌ | 미구현 (옵션 항목) |
| OpenClaw 탐지 | ❌ | 미구현 (로드맵 항목) |

### Phase C — n8n 스타일 캔버스 UI
| 항목 | 상태 | 비고 |
|------|------|------|
| 도트 그리드 배경 | ✅ | BackgroundVariant.Dots + CSS |
| React Flow 캔버스 | ✅ | GraphView.tsx |
| Floating controls (Fit/Zoom/Reset/Tidy) | ✅ | canvas-controls div |
| "Add first step" placeholder | ✅ | empty-placeholder (빈 상태 시) |
| Node Library 패널 | ✅ | RightPanel library 모드 |
| + 버튼으로 열기 | ✅ | canvas-plus 버튼 |
| Tab으로 열기 | ✅ | Tab 키 핸들러 |
| 검색창 | ✅ | library-search input |
| Node hover 액션 | ✅ | hover-actions (Open/Enable/Remove/More) |
| Sticky note | ✅ | NoteNode + Shift+S |
| Auto layout (dagre) | ✅ | dagreLayout.ts |
| Tidy layout | ✅ | tidyLayout.ts |
| Command bar | ✅ | CommandBar.tsx (Ctrl+K) |

### Phase D — Inspector(오른쪽 상세 패널)
| 항목 | 상태 | 비고 |
|------|------|------|
| Skill 선택 시 상세 표시 | ✅ | SkillInspector 컴포넌트 |
| name/description 표시 | ✅ | 편집 가능 폼 |
| validation errors/warnings | ✅ | validation-item 리스트 |
| Open SKILL.md 버튼 | ✅ | |
| Reveal folder 버튼 | ✅ | |
| Export 버튼 | ✅ | |
| Validate 버튼 | ✅ | |
| RuleDoc 선택 시 상세 | ✅ | RuleInspector 컴포넌트 |
| 파일 경로 + 체인 순서 | ✅ | |
| Open / Create override 버튼 | ✅ | |
| Agent 선택 시 상세 | ⚠️ | 기본 정보만 (JSON dump 아님, MCP 표시 있음) |
| Provider 선택 시 상세 | ✅ | label, skillCount, ruleCount |
| Folder 선택 시 상세 | ✅ | path + Reveal 버튼 |
| Note 선택 시 상세 | ✅ | 간단 안내 |

### Phase E — 단축키(조작감)
| 항목 | 상태 | 비고 |
|------|------|------|
| Ctrl+드래그 패닝 | ✅ | panModifierActive 상태 |
| Space+드래그 패닝 | ✅ | Space 키 감지 |
| Middle mouse 드래그 | ✅ | panOnDrag [1,2] |
| 줌: +, -, 0, 1 | ✅ | 키보드 핸들러 |
| Ctrl+Wheel 줌 | ✅ | onCanvasWheelCapture |
| Tab: Node Library 열기 | ✅ | |
| Ctrl/Cmd+K: Command bar | ✅ | |
| Shift+S: Sticky note | ✅ | |

### Phase F — Skill Pack 공유
| 항목 | 상태 | 비고 |
|------|------|------|
| Export zip (skillpack.json 포함) | ✅ | zipPack.ts |
| Import zip 미리보기 | ✅ | ImportPreviewModal.tsx |
| 설치 위치 선택 | ✅ | installDirPath |
| 충돌 처리 (overwrite 옵션) | ✅ | |
| scripts/ 경고 표시 | ✅ | hasScripts 플래그 |

### 메시지 프로토콜
| 항목 | 상태 | 비고 |
|------|------|------|
| READY / REFRESH | ✅ | |
| OPEN_FILE / REVEAL_IN_EXPLORER | ✅ | |
| CREATE_SKILL | ✅ | Skill Wizard 포함 |
| UPDATE_SKILL_FRONTMATTER | ✅ | |
| EXPORT_PACK | ✅ | |
| REQUEST_IMPORT_PREVIEW | ✅ | |
| CONFIRM_IMPORT_PACK / IMPORT_PACK | ✅ | |
| RUN_VALIDATION / RUN_VALIDATION_ALL | ✅ | |
| CREATE_OVERRIDE | ✅ | |
| ADD_COMMON_RULE | ✅ | |
| SET_SKILL_ENABLED | ✅ | |
| ADD/SAVE/DELETE_NOTE | ✅ | |
| ENSURE_ROOT_AGENTS | ✅ | |
| OPEN_COMMON_RULES_FOLDER | ✅ | |
| CREATE_COMMON_RULE_DOCS | ✅ | |

### MVP 수용 기준(Acceptance Criteria)
| 기준 | 상태 | 비고 |
|------|------|------|
| 1. VS Code 명령 → Webview 열기 | ✅ | agentStudio.open |
| 2. .github/skills에 스킬 → 캔버스에 노드 표시 | ✅ | |
| 3. SKILL.md name≠폴더명 → Validation Error | ✅ | |
| 4. Tab/+ → Node Library 열기 | ✅ | |
| 5. Ctrl+휠/0/1 → 줌 | ✅ | |
| 6. Codex AGENTS 환경 → RuleDoc 노드 표시 | ✅ | |
| 7. Export Pack → Import Pack | ✅ | |

---

## 3. 미구현/개선 필요 항목

### 3.1 미구현 (명세에 있으나 구현되지 않은 항목)

#### ❌ Codex .rules 탐지
- 명세: `~/.codex/rules/*.rules` 탐지 + execpolicy check
- 상태: 미구현
- 우선순위: 낮음 (옵션 항목)
- 필요 작업: CodexRulesProvider 구현

#### ❌ OpenClaw 탐지
- 명세: `~/.openclaw/openclaw.json` 읽기, agents/workspaces 표시
- 상태: 미구현
- 우선순위: 낮음 (로드맵 항목)
- 필요 작업: OpenClawProvider 구현

### 3.2 부분 구현 / 개선 필요

#### ⚠️ Agent 노드 간 연결선 없음
- 현재: agent→skill(contains), agent→ruleDoc(contains), common-rules→agent(appliesTo) 엣지만 존재
- 문제: agent 노드끼리 연결선이 없어 워크플로우 관계 표현 불가
- 해결: agentLink 엣지 타입 추가, React Flow Handle 추가로 드래그 연결 지원

#### ⚠️ Agent 노드 더블클릭 핸들러 없음
- 현재: onNodeDoubleClick에서 skill/ruleDoc/folder만 처리
- 문제: agent 더블클릭 시 아무 동작 없음
- 해결: AgentDetailModal 팝업 구현 (Skills/Rules/MCP 탭 관리)

#### ⚠️ Agent Inspector 정보 부족
- 현재: 이름, provider, common rules 수, MCP 서버 리스트만 표시
- 개선: 해당 agent 소속 skill/rule 카운트, 직접 관리 UI 제공

#### ⚠️ Provider 노드 (명세 외 추가)
- 현재: provider 노드 타입이 존재하나 mvp.md 명세의 6.2 그래프 노드 타입에는 없음
- 상태: 명세 대비 추가 구현된 항목 (기능적으로는 유용)

#### ⚠️ CommonRules 노드 (명세 외 추가)
- 현재: commonRules 노드 타입이 존재하나 명세에는 없음
- 상태: 명세 대비 추가 구현된 항목 (공통 규칙 관리에 유용)

### 3.3 명세 대비 추가 구현된 기능 (명세에 없지만 구현됨)
- Common Rule 추가 모달 (ADD_COMMON_RULE)
- Skill Wizard 모달 (상세 생성 폼 + OpenAI yaml 옵션)
- provider 노드 타입
- commonRules 노드 타입 + appliesTo 엣지
- locatedIn 엣지 (skill→folder)
- MCP 서버 탐지 및 표시
- Sticky Note 기능 (추가/편집/삭제/위치 저장)
- Command Bar (Ctrl+K)
- 두 가지 레이아웃 알고리즘 (dagre + tidy)
- Save frontmatter 기능
- Ensure root AGENTS.md
- Open/Create common rules folder
- Create common ops docs (AGENT_VISUALS, MCP_PLAN, AGENT_COMMS)

---

## 4. 추가 개선 제안

### 4.1 기능 개선
1. **Agent↔Agent 연결선**: agentLink 엣지 타입으로 에이전트 간 워크플로우/관계 표현
2. **Agent 더블클릭 팝업**: AgentDetailModal로 Skills/Rules/MCP 3탭 관리
3. **MCP 서버 토글**: 현재 읽기 전용 → enable/disable 토글 추가
4. **Skill drag-and-drop**: 라이브러리에서 캔버스로 드래그 앤 드롭 배치
5. **다중 선택**: Shift+클릭으로 노드 다중 선택 → 일괄 Export/Delete

### 4.2 코드 품질
1. **타입 안전성**: `Record<string, unknown>` 캐스팅을 구체적 타입으로 교체
2. **컴포넌트 분리**: App.tsx가 11개 state + 20+ handler → 커스텀 훅으로 분리
3. **에러 바운더리**: ErrorBoundary 존재하나 컴포넌트 레벨 세분화 필요
4. **테스트**: 단위 테스트 없음 → validator/parser/discovery 테스트 추가 권장

---

## 5. 결론

MVP 명세 대비 **88% 이상 구현 완료**. 필수(Must-have) 항목은 모두 구현되었으며,
미구현은 옵션/로드맵 항목(Codex .rules, OpenClaw)에 한정됨.

명세를 초과 달성한 부분도 다수 있음:
- Common Rules 전용 노드 및 관리 UI
- MCP 서버 자동 탐지
- Sticky Note
- Command Bar
- 두 가지 레이아웃 알고리즘
- Skill Wizard (상세 생성)

**현재 가장 필요한 개선**:
1. Agent 노드 간 연결선 (워크플로우 시각화)
2. Agent 더블클릭 팝업 (통합 관리 UI)
