# AgentCanvas — 비즈니스 워크플로우 구현 검증 결과

**Date**: 2026-02-19
**기준**: WORKFLOW.md + FRAMEWORK.md 명세 vs 실제 소스코드 1:1 대조
**결과**: 8개 핵심 워크플로우 + 5개 추가 워크플로우 = **전부 구현 완료 (100%)**

---

## 검증 요약

| # | 워크플로우 | 상태 | 핵심 파일 | 핸들러 |
|---|-----------|------|----------|--------|
| 1 | Discovery (자동 탐지) | ✅ | discovery.ts, agentSkillsProvider.ts, codexAgentsDiscovery.ts, mcpDiscovery.ts | REFRESH |
| 2 | Prompt → Agent 생성 | ✅ | cliDetector.ts, cliExecutor.ts, promptBuilder.ts, agentStructureParser.ts | GENERATE_AGENT_STRUCTURE, APPLY_GENERATED_STRUCTURE |
| 3 | Schedule 실행 | ✅ | scheduleService.ts, scheduler.ts, extension.ts(executeRunLoop) | RUN_FLOW, SCHEDULE_SUBSCRIBE |
| 4 | Skill Pack 공유 | ✅ | zipPack.ts | EXPORT_PACK, REQUEST_IMPORT_PREVIEW, CONFIRM_IMPORT_PACK |
| 5 | Run History & Pin | ✅ | runStore.ts, pinStore.ts | LIST_RUNS, PIN_OUTPUT, UNPIN_OUTPUT |
| 6 | Memory 공유 | ✅ | memoryStore.ts, memoryQuery.ts, contextPacker.ts, memoryExtractor.ts | GET_MEMORY_ITEMS, SEARCH_MEMORY |
| 7 | A2A Visibility | ✅ | announceService.ts, collaborationLogger.ts, reviewGate.ts | COLLAB_EVENT |
| 8 | Prompt Caching | ✅ | promptBuilder.ts, modelRouter.ts, tokenTracker.ts, cacheDiagnostics.ts, costCalculator.ts | — (내부 파이프라인) |

---

## 워크플로우 1: Discovery (자동 탐지) ✅

### 문서 정의
```
Skills 탐지 → Codex AGENTS.md 체인 탐지 → MCP 서버 탐지 → 그래프 빌드
```

### 코드 추적

| 단계 | 문서 | 구현 파일 (함수) | 상태 |
|------|------|------------------|------|
| 프로젝트 스킬 탐지 | `.github/skills/`, `.claude/skills/` | agentSkillsProvider.ts → `discoverSkills()` | ✅ |
| 개인 스킬 탐지 | `~/.copilot/skills/`, `~/.claude/skills/` | agentSkillsProvider.ts → personal dirs | ✅ |
| VS Code 설정 위치 | `chat.agentSkillsLocations` | agentSkillsProvider.ts → config merge | ✅ |
| Codex Global AGENTS | `CODEX_HOME/AGENTS.override.md` > `AGENTS.md` | codexAgentsDiscovery.ts → `discoverCodexAgentsChain()` | ✅ |
| Codex Project AGENTS | 루트→cwd 순회 | codexAgentsDiscovery.ts → directory walk | ✅ |
| MCP Codex | `~/.codex/config.toml` | mcpDiscovery.ts → `discoverCodexMcp()` | ✅ |
| MCP VS Code | `.vscode/mcp.json` | mcpDiscovery.ts → `discoverVsCodeMcp()` | ✅ |
| 통합 | DiscoverySnapshot 반환 | discovery.ts → `runDiscovery()` | ✅ |

---

## 워크플로우 2: Prompt → Agent 생성 ✅

### 문서 정의
```
사용자 Prompt 입력 → 컨텍스트 수집 → System Prompt 조합 → CLI 실행 → JSON 파싱 → Preview → Apply → Canvas 반영
```

### 코드 추적

| 단계 | 문서 | 구현 | 상태 |
|------|------|------|------|
| CLI 감지 | `detectAllCliBackends()` | cliDetector.ts: claude/gemini/codex/aider/custom 감지 | ✅ |
| System Prompt 빌드 | `buildAgentGenerationPrompt()` | promptBuilder.ts: 기존 agent/skill/MCP 컨텍스트 포함 | ✅ |
| CLI 실행 | `executeCliPrompt()` | cliExecutor.ts: spawn + stdin/argv + timeout | ✅ |
| 응답 파싱 | `parseAgentStructure()` | agentStructureParser.ts: JSON/markdown 블록 추출 + 검증 | ✅ |
| Preview UI | Webview에서 미리보기 | AgentPreviewModal.tsx: 생성될 에이전트 목록 표시 | ✅ |
| Apply | `APPLY_GENERATED_STRUCTURE` | extension.ts: createCustomAgentProfile + setDelegation + assignSkill/MCP | ✅ |
| Canvas 반영 | 노드 자동 배치 | discovery refresh → graphBuilder → tidyLayout | ✅ |
| 히스토리 | promptHistory 저장 | promptHistory.ts: `.agentcanvas/prompt-history.json` | ✅ |

---

## 워크플로우 3: Schedule 실행 (executeRunLoop) ✅

### 문서 정의
```
Flow 선택 → 스케줄 생성(DAG) → topological sort → 태스크별 실행:
  sandbox 준비 → 메모리 주입 → 프롬프트 빌드 → CLI 실행 → 결과 저장 → 의존성 전달 → 프로포절 생성/적용 → 다음 태스크
```

### 코드 추적

| 단계 | 문서 | 구현 | 상태 |
|------|------|------|------|
| 런 생성 | `startRun()` | runStore.ts: RunSummary + JSONL 초기화 | ✅ |
| 스케줄 생성 | `createRun()` | scheduleService.ts: 태스크 Map + snapshot | ✅ |
| topological sort | `computeSchedule()` | scheduler.ts: indegree 계산 → 큐 → agent lane 배정 | ✅ |
| 태스크 선택 | deps 완료 확인 | extension.ts(executeRunLoop): `task.deps.every(dep => done)` | ✅ |
| Pinned output 확인 | `usePinnedOutputs` | pinStore.getPin() → 있으면 스킵 | ✅ |
| Sandbox 준비 | `prepareSandbox()` | sandboxService.ts: input/ + work/ 복사 | ✅ |
| 컨텍스트 패킷 | `buildContextPacket()` | contextPacker.ts: system + relevant memory | ✅ |
| 프롬프트 빌드 | `buildTaskPrompt()` | extension.ts: task설명 + deps출력 + contextPacket | ✅ |
| CLI 실행 | `executeCliPrompt()` | cliExecutor.ts: backend별 실행 + usage 파싱 | ✅ |
| 결과 저장 | `appendRunEvent()` | runStore.ts: node_output JSONL 추가 | ✅ |
| 의존성 전달 | `taskOutputs.set()` | extension.ts: Map<taskId, output> | ✅ |
| 프로포절 생성 | `createProposal()` | proposalService.ts: git diff --no-index + prefix strip | ✅ |
| 프로포절 적용 | `applyProposal()` | proposalService.ts: git apply --check → apply | ✅ |
| 실시간 이벤트 | TaskEvent 스트림 | scheduleService.ts: snapshot + task_updated 전파 | ✅ |
| 에러 처리 | 실패 시 런 중단 | extension.ts: node_failed → run_finished(failed) | ✅ |

---

## 워크플로우 4: Skill Pack 공유 ✅

| 단계 | 구현 | 상태 |
|------|------|------|
| Export 선택 | EXPORT_PACK 메시지 → skillIds | ✅ |
| ZIP 생성 | zipPack.ts: `exportSkillPack()` + manifest.json | ✅ |
| Preview | REQUEST_IMPORT_PREVIEW → `previewSkillPack()` | ✅ |
| Import | CONFIRM_IMPORT_PACK → `importSkillPack()` + conflict policy | ✅ |

---

## 워크플로우 5: Run History & Pin ✅

| 단계 | 구현 | 상태 |
|------|------|------|
| JSONL 저장 | runStore.ts: `.agentcanvas/runs/<flow>/<runId>.jsonl` | ✅ |
| Index 관리 | runStore.ts: `index.json` RunSummary 배열 | ✅ |
| 런 목록 | `listRuns()` → startedAt 정렬 | ✅ |
| 이벤트 로드 | `loadRunEvents()` → JSONL 파싱 | ✅ |
| Pin 저장 | pinStore.ts: `.agentcanvas/pins/<flow>/<nodeId>.json` | ✅ |
| Pin 스킵 | executeRunLoop: pin 있으면 CLI 실행 생략 | ✅ |

---

## 워크플로우 6: Memory 공유 ✅

| 단계 | 구현 | 상태 |
|------|------|------|
| 메모리 추가 | memoryStore.ts: `addMemoryItem()` → .md 파일 + index.jsonl | ✅ |
| 메모리 검색 | memoryQuery.ts: `queryMemoryRanked()` → 키워드+중요도+최신성 가중치 | ✅ |
| 컨텍스트 패킷 | contextPacker.ts: system 항상 포함 + 관련 메모리 토큰 예산 내 | ✅ |
| 태스크 후 추출 | memoryExtractor.ts: 성공/실패 패턴 감지 → fact/decision/learning | ✅ |
| 네임스페이스 | system / shared / agent/<id> / flow/<name> | ✅ |
| 커밋 기록 | memoryStore.ts: `appendMemoryCommit()` | ✅ |

---

## 워크플로우 7: A2A Visibility ✅

| 단계 | 구현 | 상태 |
|------|------|------|
| Announce 생성 | announceService.ts: `buildAnnounce()` → 완료 요약 | ✅ |
| 이벤트 로깅 | collaborationLogger.ts: `appendCollabEvent()` → JSONL | ✅ |
| 이벤트 종류 | task_dispatched, proposal_submitted, proposal_reviewed, announce | ✅ |
| Review Gate | reviewGate.ts: `reviewProposal()` → approve/revise/block | ✅ |
| 리포트 생성 | collaborationLogger.ts: `generateCollabReport()` | ✅ |

---

## 워크플로우 8: Prompt Caching ✅

| 단계 | 구현 | 상태 |
|------|------|------|
| Static/Dynamic 분리 | promptBuilder.ts: `buildCachedPrompt()` → CachedPromptBlocks | ✅ |
| 캐시 마커 | `composeWithCacheMarkers()`: `<!-- CACHE_STATIC_START/END -->` | ✅ |
| 모델 라우팅 | modelRouter.ts: `resolveModel()` → task type별 모델 선택 | ✅ |
| 토큰 추적 | tokenTracker.ts: inputTokens/outputTokens/cacheRead/cacheWrite 누적 | ✅ |
| 비용 계산 | costCalculator.ts: `calculateUsageCost()` → 모델별 가격 적용 | ✅ |
| 진단 로그 | cacheDiagnostics.ts: `logCacheEvent()` → `.agentcanvas/logs/cache-trace.jsonl` | ✅ |

---

## 추가 워크플로우 (5건) — 모두 구현 완료

| # | 워크플로우 | 핵심 파일 | 상태 |
|---|-----------|----------|------|
| 9 | Agent 시스템 (생성/수정/위임/삭제) | agentProfileService.ts | ✅ |
| 10 | Common Rules (공통 규칙 관리) | commonRulesService.ts + CommonRulesNode.tsx | ✅ |
| 11 | Interaction Patterns (20+ 패턴) | interactionValidation.ts + SystemNode.tsx | ✅ |
| 12 | Flow Persistence (YAML 저장/로드) | flowStore.ts | ✅ |
| 13 | Agent Runtime (CWD 격리/모델 라우팅) | agentRuntimeService.ts | ✅ |

---

## 결론

WORKFLOW.md와 FRAMEWORK.md에 정의된 **모든 비즈니스 워크플로우가 코드에 구현되어 있음**을 확인했습니다.

각 워크플로우의 모든 단계가 해당 서비스 파일의 함수로 존재하고, extension.ts의 메시지 핸들러에서 올바르게 연결되며, Webview UI에서 사용자 인터랙션이 가능합니다.

단, CODE_REVIEW_FINAL.md에서 발견된 **코드 품질 이슈(12 CRITICAL)**는 워크플로우 자체의 존재 여부와 별개로 수정이 필요합니다.

---

*AgentCanvas Workflow Verification — 2026-02-19*
