# AgentCanvas — 에이전트 메모리 공유 개발 지시서

**Date**: 2026-02-19
**목적**: 멀티 에이전트가 공유 가능한 지속 메모리(Shared + Persistent Memory)를 AgentCanvas에 구현

---

## 1. 현재 상태

AgentCanvas는 이미 다음을 갖추고 있다:

- `runStore.ts` — RunEvent JSONL 저장 (`.agentcanvas/runs/<flow>/<runId>.jsonl`)
- `pinStore.ts` — 노드별 출력 고정 (`.agentcanvas/pins/<flow>/<nodeId>.json`)
- `sandboxService.ts` — 에이전트별 격리 작업 공간 (input/work/proposal)
- `promptBuilder.ts` — static/dynamic 블록 분리 + 캐시 마커
- `executeRunLoop` — 태스크 간 `taskOutputs: Map<taskId, unknown>` 으로 의존성 출력 전달
- `ScheduleService` — 인메모리 태스크 상태 관리 + 이벤트 스트림

**없는 것**: 런 간 지속 메모리, 에이전트 간 지식 공유, 학습/결정 축적, 컨텍스트 패킷 생성, 메모리 버전 관리

---

## 2. 설계 원칙

1. **File + Git 기반**: 기존 `.agentcanvas/` 디렉터리 패턴을 확장. DB 없이 마크다운 + JSONL로 시작
2. **기존 파이프라인에 최소 침습**: executeRunLoop, promptBuilder에 훅만 추가
3. **네임스페이스 분리**: 프로젝트 공유 / 에이전트 개인 / 플로우별 범위
4. **토큰 예산 준수**: 메모리 조회 시 항상 budget 제한 적용
5. **버전 관리**: git commit 기반 변경 이력 + 롤백

---

## 3. 디렉터리 구조

```
.agentcanvas/
├── memory/                           # 신규: 공유 메모리 저장소
│   ├── system/                       # 항상 주입되는 프로젝트 컨텍스트
│   │   ├── project.md               # 프로젝트 개요/목표/제약
│   │   └── conventions.md           # 코딩/아키텍처 규칙
│   ├── shared/                       # 프로젝트 공용 메모리
│   │   ├── decisions/               # ADR (Architecture Decision Records)
│   │   ├── learnings/               # 학습/교훈
│   │   └── facts/                   # 축적된 사실
│   ├── agents/                       # 에이전트별 개인 메모리
│   │   └── <agentId>/
│   │       ├── learnings/
│   │       └── preferences/
│   ├── flows/                        # 플로우별 메모리
│   │   └── <flowName>/
│   │       └── sessions/            # 런 세션 요약
│   └── index.jsonl                  # 메모리 항목 인덱스 (검색용)
├── runs/                             # 기존 유지
├── pins/                             # 기존 유지
├── sandboxes/                        # 기존 유지
└── ...
```

---

## 4. 타입 추가

**파일**: `extension/src/types.ts`

```typescript
// 메모리 항목 타입
export type MemoryItemType =
  | "fact"           // 축적된 사실
  | "decision"       // ADR (결정 + 근거 + 대안)
  | "learning"       // 학습/교훈 (성공/실패 경험)
  | "summary"        // 세션/런 요약
  | "preference"     // 에이전트/사용자 선호
  | "artifact";      // 재사용 가능한 산출물 참조

// 메모리 네임스페이스
export type MemoryNamespace =
  | "system"                     // 항상 주입 (project.md, conventions.md)
  | "shared"                     // 프로젝트 공용
  | `agent/${string}`            // 에이전트 개인
  | `flow/${string}`;            // 플로우별

// 메모리 항목
export interface MemoryItem {
  id: string;                    // UUID
  namespace: MemoryNamespace;
  type: MemoryItemType;
  title: string;
  content: string;               // 마크다운 본문
  source: {
    agentId?: string;            // 생성한 에이전트
    runId?: string;              // 생성된 런
    taskId?: string;             // 생성된 태스크
    flowName?: string;
  };
  tags: string[];
  importance: number;            // 0~1 (1이 가장 중요)
  createdAt: number;             // Unix timestamp (ms)
  updatedAt: number;
  ttlMs?: number;                // 만료 시간 (optional)
  supersededBy?: string;         // 이 항목을 대체한 새 항목 ID (정정용)
}

// 메모리 조회 결과
export interface MemoryQueryResult {
  items: MemoryItem[];
  totalCount: number;
  budgetUsed: number;            // 사용된 토큰 수 (추정)
  budgetLimit: number;
}

// 컨텍스트 패킷
export interface ContextPacket {
  systemContext: string;          // system/ 폴더 내용 (항상 포함)
  relevantMemories: string;      // 검색 결과 마크다운
  totalTokens: number;           // 추정 토큰 수
  sources: Array<{               // 출처 추적
    memoryId: string;
    title: string;
    relevanceScore: number;
  }>;
}

// 메모리 커밋 (버전 관리)
export interface MemoryCommit {
  commitId: string;
  parentId?: string;
  author: string;                // agentId 또는 "user"
  message: string;
  itemsAdded: string[];          // MemoryItem.id[]
  itemsUpdated: string[];
  itemsSuperseded: string[];
  timestamp: number;
}
```

---

## 5. 서비스 구현

### 5.1 memoryStore.ts (신규)

**파일**: `extension/src/services/memoryStore.ts`

```
역할: 메모리 항목의 CRUD + 파일 기반 영속화

경로 규칙:
  namespace "system"        → .agentcanvas/memory/system/<title>.md
  namespace "shared"        → .agentcanvas/memory/shared/<type>/<id>.md
  namespace "agent/<id>"    → .agentcanvas/memory/agents/<agentId>/<type>/<id>.md
  namespace "flow/<name>"   → .agentcanvas/memory/flows/<flowName>/<type>/<id>.md

addItem(item: MemoryItem) → void
  - 마크다운 파일 생성 (frontmatter + content)
  - index.jsonl에 append
  - MemoryCommit 기록

updateItem(id: string, patch: Partial<MemoryItem>) → void
  - 파일 수정 + index 업데이트 + commit 기록

supersede(oldId: string, newItem: MemoryItem) → void
  - 기존 항목에 supersededBy 설정
  - 새 항목 생성
  - "정정" 커밋 기록

getItem(id: string) → MemoryItem | undefined
  - index.jsonl에서 조회 → 파일 읽기

listItems(filters: {
  namespace?: MemoryNamespace;
  type?: MemoryItemType;
  tags?: string[];
  agentId?: string;
  since?: number;
}) → MemoryItem[]

deleteExpired() → number
  - ttlMs 기반 만료 항목 정리
```

### 5.2 memoryQuery.ts (신규)

**파일**: `extension/src/services/memoryQuery.ts`

```
역할: 메모리 검색 + 관련성 랭킹 + 토큰 예산 기반 선별

query(input: {
  text: string;                  // 검색 키워드 또는 태스크 설명
  namespaces: MemoryNamespace[]; // 검색 범위
  budgetTokens: number;          // 최대 토큰 수
  agentId?: string;              // 에이전트별 필터
  types?: MemoryItemType[];      // 타입 필터
  minImportance?: number;        // 최소 중요도
}) → MemoryQueryResult

검색 알고리즘 (Phase 1 — 키워드 기반):
  1. index.jsonl 로드 + 필터 적용
  2. 키워드 매칭 점수 계산 (title + tags + content)
  3. 최종 점수 = keyword_score × 0.4 + importance × 0.3 + recency × 0.3
  4. 점수 순 정렬
  5. 토큰 예산까지 상위 항목 선택

추후 확장 (Phase 2):
  - 임베딩 기반 시맨틱 검색 추가
  - BM25 + vector 하이브리드
```

### 5.3 contextPacker.ts (신규)

**파일**: `extension/src/services/contextPacker.ts`

```
역할: 태스크 실행 전 메모리에서 컨텍스트 패킷을 생성하여 프롬프트에 주입

buildContextPacket(input: {
  taskInstruction: string;       // 태스크 설명 (검색 쿼리로 사용)
  agentId: string;
  flowName: string;
  budgetTokens: number;          // 기본값: 2000
}) → ContextPacket

로직:
  1. system 네임스페이스 항상 포함 (project.md, conventions.md)
     → systemContext에 할당
     → 사용 토큰 차감
  2. 남은 예산으로 관련 메모리 검색:
     - 네임스페이스: ["shared", `agent/${agentId}`, `flow/${flowName}`]
     - 쿼리: taskInstruction
  3. 결과를 마크다운으로 포맷:
     → relevantMemories에 할당

출력 마크다운 형식:
  ## Project Context
  (project.md 내용)

  ## Relevant Memory
  ### [decision] API 구조 결정 (importance: 0.9)
  (content)
  ---
  ### [learning] 캐시 무효화 실패 교훈 (importance: 0.7)
  (content)
```

### 5.4 memoryExtractor.ts (신규)

**파일**: `extension/src/services/memoryExtractor.ts`

```
역할: 태스크 완료 후 출력에서 재사용 가능한 메모리 항목 자동 추출

extractMemories(input: {
  taskOutput: string;            // CLI 실행 결과
  taskTitle: string;
  agentId: string;
  runId: string;
  taskId: string;
  flowName: string;
  success: boolean;
}) → MemoryItem[]

추출 규칙 (규칙 기반, Phase 1):
  1. 성공 시:
     - 변경된 파일 목록 → fact 타입
     - "결정했다/선택했다" 패턴 → decision 타입
     - 테스트 결과 요약 → fact 타입
  2. 실패 시:
     - 에러 메시지 + 원인 → learning 타입 (Reflexion 패턴)
     - "다음에는 ~해야" 패턴 → learning 타입
  3. 공통:
     - importance 자동 산정: decision=0.8, learning(실패)=0.9, fact=0.5
     - namespace: "shared" (기본) 또는 `agent/${agentId}` (에이전트 전용 학습)

추후 확장 (Phase 2):
  - LLM 기반 추출: 태스크 출력을 별도 프롬프트로 분석하여 structured facts 추출
```

---

## 6. promptBuilder.ts 수정

**파일**: `extension/src/services/promptBuilder.ts`

기존 `buildCachedPrompt`의 staticBlock에 메모리 컨텍스트 섹션 추가:

```
기존 staticBlock 구조:
  Agent profile → Common rules → Assigned skills → Assigned MCP servers

변경 staticBlock 구조:
  Agent profile → Common rules → Assigned skills → Assigned MCP servers
  → **Project Context** (system/ 메모리)

dynamicBlock에 추가:
  Runtime task → Dependency outputs → **Relevant Memory** → Runtime state
```

`CachedPromptInput` 타입 확장:

```typescript
type CachedPromptInput = {
  // ... 기존 필드 유지 ...
  contextPacket?: ContextPacket;  // 신규: 메모리 컨텍스트
};
```

---

## 7. executeRunLoop 수정

**파일**: `extension/src/extension.ts`

executeRunLoop 내부 태스크 실행 흐름에 메모리 읽기/쓰기 삽입:

```
기존:
  태스크 선택 → sandbox 준비 → 프롬프트 빌드 → CLI 실행 → 결과 저장 → 다음 태스크

변경:
  태스크 선택
  → sandbox 준비
  → **contextPacker.buildContextPacket()** (메모리 읽기)
  → 프롬프트 빌드 (contextPacket 포함)
  → CLI 실행
  → 결과 저장
  → **memoryExtractor.extractMemories()** (메모리 쓰기)
  → **memoryStore.addItem()** (추출된 항목 저장)
  → **git commit** (메모리 변경 커밋)
  → 다음 태스크
```

### 메모리 토큰 예산 설정

```typescript
// 기본 예산: 전체 컨텍스트의 ~15%
const MEMORY_BUDGET_TOKENS = 2000;

// AgentProfile에 override 가능
// agent.metadata?.memoryBudgetTokens
```

---

## 8. 버전 관리 (Git 연동)

### 8.1 자동 커밋

메모리 변경 시 자동 git commit:

```
git add .agentcanvas/memory/
git commit -m "memory: <type> - <title> [agent:<agentId>]"
```

커밋 주체별 prefix:
- `memory: fact` — 사실 추가
- `memory: decision` — 결정 기록
- `memory: learning` — 학습/교훈
- `memory: supersede` — 기존 항목 정정
- `memory: defrag` — 정리/압축

### 8.2 롤백

```
memoryStore.checkout(commitId: string) → void
  1. git stash (현재 변경 보호)
  2. git checkout <commitId> -- .agentcanvas/memory/
  3. index.jsonl 재구축
```

### 8.3 에이전트별 브랜치 (멀티 에이전트 병렬)

```
병렬 실행 시:
  에이전트 A → memory/agent-a 브랜치에서 작업
  에이전트 B → memory/agent-b 브랜치에서 작업
  런 완료 → main으로 머지

충돌 처리:
  1. 동일 파일 수정 시 → 양쪽 모두 보존 (append 방식)
  2. 사실 충돌 → supersede 체인으로 관리
```

---

## 9. 프로토콜 메시지

**파일**: `extension/src/messages/protocol.ts` + `webview-ui/src/messaging/protocol.ts`

```typescript
// Extension → Webview
| { type: "MEMORY_UPDATED"; payload: {
    item: MemoryItem;
    action: "added" | "updated" | "superseded" | "deleted";
  }}
| { type: "MEMORY_QUERY_RESULT"; payload: MemoryQueryResult }
| { type: "CONTEXT_PACKET_BUILT"; payload: {
    taskId: string;
    packet: ContextPacket;
  }}

// Webview → Extension
| RequestMessage<"GET_MEMORY_ITEMS", {
    namespace?: MemoryNamespace;
    type?: MemoryItemType;
    limit?: number;
  }>
| RequestMessage<"SEARCH_MEMORY", {
    query: string;
    namespaces?: MemoryNamespace[];
    budgetTokens?: number;
  }>
| RequestMessage<"ADD_MEMORY_ITEM", {
    item: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">;
  }>
| RequestMessage<"SUPERSEDE_MEMORY", {
    oldItemId: string;
    newContent: string;
    reason: string;
  }>
| RequestMessage<"MEMORY_CHECKOUT", { commitId: string }>
| RequestMessage<"GET_MEMORY_COMMITS", { limit?: number }>
```

---

## 10. UI 구현

### 10.1 MemoryPanel (신규 탭)

**파일**: `webview-ui/src/panels/MemoryPanel.tsx`

기존 RightPanel 또는 CommandBar에 "Memory" 탭 추가:

```
┌─ Memory ──────────────────────────────────┐
│ 🔍 [검색...]                [+ 수동 추가]  │
│                                            │
│ ── system ──────────────────────────────── │
│ 📋 project.md          | 항상 주입         │
│ 📋 conventions.md      | 항상 주입         │
│                                            │
│ ── shared (12 items) ──────────────────── │
│ 🎯 [decision] API 구조 결정    0.9  2/19   │
│ 📘 [learning] 캐시 무효화 교훈  0.7  2/19   │
│ 📌 [fact] 테스트 커버리지 85%   0.5  2/18   │
│                                            │
│ ── agent/coder (3 items) ────────────────  │
│ 📘 [learning] ESLint 룰 예외   0.6  2/19   │
│                                            │
│ [버전 이력]  [정리(Defrag)]  [내보내기]     │
└────────────────────────────────────────────┘
```

### 10.2 런 실행 시 메모리 주입 표시

RunPanel 카드에 메모리 주입 정보 표시:

```
┌─ memory_injected ────────────────────────┐
│ 🧠 컨텍스트 패킷 주입                      │
│ system: 2 files (320 tokens)              │
│ shared: 3 items (1,200 tokens)            │
│ agent: 1 item (480 tokens)                │
│ total: 2,000 / 2,000 tokens               │
│ [상세 보기]                                │
└────────────────────────────────────────────┘
```

### 10.3 CSS

**파일**: `webview-ui/src/styles.css`

```css
.memory-panel { padding: 12px; }
.memory-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.memory-item:hover { background: var(--bg-elevated); }
.memory-item[data-type="decision"] .memory-badge { color: var(--accent); }
.memory-item[data-type="learning"] .memory-badge { color: var(--warn); }
.memory-item[data-type="fact"] .memory-badge { color: var(--secondary); }
.memory-importance {
  font-size: 11px;
  opacity: 0.7;
  min-width: 24px;
  text-align: right;
}
```

---

## 11. 마크다운 파일 포맷

### 메모리 항목 파일 (.md)

```markdown
---
id: "mem-abc123"
type: decision
namespace: shared
title: "Vector DB는 pgvector 사용"
importance: 0.8
tags: ["database", "vector", "search"]
source:
  agentId: "planner-01"
  runId: "run_20260219_100000"
  taskId: "task-db-selection"
  flowName: "backend-setup"
createdAt: 1708300800000
updatedAt: 1708300800000
---

## 결정
pgvector를 사용한다.

## 근거
- 운영 단순성 (기존 Postgres 활용)
- 하이브리드 검색 구성 용이

## 대안
- Weaviate, Pinecone

## 영향
- 마이그레이션/인덱싱 작업 필요
```

### index.jsonl 포맷

```jsonl
{"id":"mem-abc123","namespace":"shared","type":"decision","title":"Vector DB는 pgvector 사용","importance":0.8,"tags":["database","vector","search"],"agentId":"planner-01","createdAt":1708300800000,"filePath":"shared/decisions/mem-abc123.md"}
```

---

## 12. 파일 변경 요약

### 신규 (5개)

| 파일 | 역할 |
|------|------|
| `extension/src/services/memoryStore.ts` | 메모리 CRUD + 파일 영속화 |
| `extension/src/services/memoryQuery.ts` | 메모리 검색 + 랭킹 |
| `extension/src/services/contextPacker.ts` | 컨텍스트 패킷 생성 |
| `extension/src/services/memoryExtractor.ts` | 태스크 출력에서 메모리 자동 추출 |
| `webview-ui/src/panels/MemoryPanel.tsx` | 메모리 UI 패널 |

### 수정 (5개)

| 파일 | 수정 |
|------|------|
| `extension/src/types.ts` | MemoryItem, MemoryNamespace, ContextPacket 등 타입 추가 |
| `extension/src/services/promptBuilder.ts` | CachedPromptInput에 contextPacket 추가, 빌드 로직 확장 |
| `extension/src/extension.ts` | executeRunLoop에 메모리 읽기/쓰기 훅 삽입 |
| `extension/src/messages/protocol.ts` | MEMORY_* 메시지 타입 추가 |
| `webview-ui/src/messaging/protocol.ts` | 프로토콜 동기화 |

---

## 13. 구현 순서

| Step | 내용 | 시간 |
|------|------|------|
| 1 | types.ts에 MemoryItem, ContextPacket 등 타입 추가 | 2시간 |
| 2 | memoryStore.ts — 파일 기반 CRUD + index.jsonl | 1일 |
| 3 | memoryQuery.ts — 키워드 검색 + 관련성 랭킹 | 0.5일 |
| 4 | contextPacker.ts — 토큰 예산 기반 패킷 생성 | 0.5일 |
| 5 | memoryExtractor.ts — 규칙 기반 메모리 추출 | 0.5일 |
| 6 | promptBuilder.ts 수정 — contextPacket 통합 | 0.5일 |
| 7 | executeRunLoop 수정 — 메모리 읽기/쓰기 연동 | 1일 |
| 8 | 프로토콜 + MemoryPanel UI | 1일 |
| 9 | Git 자동 커밋 + 롤백 기능 | 0.5일 |

**총 예상: 5~6일**

---

## 14. 검증 기준

- [ ] `.agentcanvas/memory/system/project.md` 생성 후 모든 태스크에 자동 주입됨
- [ ] 태스크 완료 시 learning/fact/decision이 자동 추출되어 `.agentcanvas/memory/shared/`에 저장됨
- [ ] Agent A가 저장한 decision을 Agent B가 다음 런에서 자동으로 검색/주입 받음
- [ ] 컨텍스트 패킷이 budgetTokens(기본 2000) 이내로 생성됨
- [ ] 메모리 변경 시 git commit이 자동 생성됨
- [ ] 잘못된 메모리를 supersede로 정정 가능
- [ ] MemoryPanel에서 네임스페이스별 항목 조회/검색 가능
- [ ] 런 실행 시 "memory_injected" 정보가 RunPanel에 표시됨

---

## 15. 향후 확장 (Phase 2)

- **시맨틱 검색**: 임베딩 생성 + 벡터 인덱스 (pgvector 또는 로컬 HNSW)
- **LLM 기반 추출**: 태스크 출력을 별도 프롬프트로 분석하여 structured facts 추출
- **Defrag 에이전트**: 주기적으로 중복/모순/낡은 정보 정리
- **Reflection 파이프라인**: 실패 시 Reflexion 스타일 회고 자동 생성
- **공유 링크**: 메모리 스냅샷을 zip/링크로 내보내기/가져오기
- **ACL**: 네임스페이스별 접근 권한 (팀/개인 분리)

---

*AgentCanvas Agent Memory Sharing Spec v1.0 — 2026-02-19*
