# AGENT_TEAM_BUILD_SPEC — 지능형 팀 빌드 & 백엔드 할당 시스템

> **작성일**: 2026-02-19
> **목적**: 사용자의 작업 의도를 분석하여 최적의 Agent 팀을 구성하고, 각 Agent에 Codex/Claude/Gemini를 명시적으로 할당하며, 실시간 사용량을 기반으로 균형 잡힌 백엔드 배분을 수행하는 시스템 설계
> **대상 파일**: `extension/src/`, `webview-ui/src/`

---

## 0. 핵심 용어

| 용어 | 정의 |
|------|------|
| **Backend** | CLI 기반 AI 런타임 (Claude Code, Codex CLI, Gemini CLI) |
| **Backend Assignment** | Agent 1개에 Backend 1개를 명시적으로 매핑하는 것 |
| **Usage Budget** | 각 Backend의 일/주/월 사용량 한도 (토큰·비용·호출 수) |
| **Work Intent** | 사용자가 Build Prompt에 입력한 작업 의도를 분석한 카테고리 |
| **Backend Affinity** | 특정 작업 유형에 대한 Backend의 적합도 점수 |

---

## 1. 현재 시스템 분석

### 1.1 현재 Build Team 플로우

```
사용자 → BuildPromptBar (프롬프트 입력 + Backend 1개 선택)
  → generateAgentStructure() [App.tsx:850]
    → GENERATE_AGENT_STRUCTURE 메시지 [extension]
      → GeneratedAgentStructure 반환
        { teamName, agents[], suggestedSkills[], suggestedMcps[] }
  → 프리뷰 → APPLY_GENERATED_STRUCTURE → 에이전트 생성
```

### 1.2 현재 문제점

| # | 문제 | 상세 |
|---|------|------|
| P1 | **Backend 단일 선택** | BuildPromptBar에서 Backend을 1개만 선택 → 전체 팀이 같은 Backend 사용 |
| P2 | **"auto" 모드 존재** | `CliBackendId`에 "auto" 포함 → 어떤 Backend이 실행되는지 불투명 |
| P3 | **Agent별 Runtime 미포함** | `GeneratedAgent` 타입에 `runtime` 필드 없음 → 생성 후 별도 할당 필요 |
| P4 | **사용량 추적 부재** | `TokenTracker`는 flow 단위 세션 토큰만 추적, Backend별 일/주/월 사용량 없음 |
| P5 | **작업 의도 미분석** | 프롬프트를 그대로 Backend에 전달 → 작업 유형별 최적 팀 구성 없음 |
| P6 | **Backend 능력 미참조** | `coder resource/` 폴더의 CLI 기능 문서가 팀 빌드에 활용되지 않음 |

### 1.3 관련 파일

```
extension/src/
├── services/
│   ├── cliDetector.ts      ← Backend 탐지 (claude/gemini/codex/aider 4종)
│   ├── cliExecutor.ts      ← CLI 실행
│   ├── costCalculator.ts   ← 토큰 비용 계산 (Claude 모델 전용)
│   ├── tokenTracker.ts     ← 세션 토큰 추적 (Backend별 아님)
│   └── agentProfileService.ts ← Agent 프로필 CRUD
├── types.ts                ← CliBackendId, AgentRuntime, GeneratedAgent 등
└── extension.ts            ← 메시지 핸들러

webview-ui/src/
├── App.tsx                 ← generateAgentStructure(), buildTeamFromPromptBar()
├── components/
│   └── BuildPromptBar.tsx  ← Backend 선택 UI (단일)
└── messaging/protocol.ts   ← 동일 타입 정의
```

---

## 2. 설계: Backend Capability Profile

### 2.1 `coder resource/` 파일 기반 능력 매핑

`coder resource/` 폴더에는 각 CLI의 기능 문서가 있음:

| 파일 | Backend | 핵심 특성 |
|------|---------|----------|
| `claude_cli_features_ko.md` | Claude Code | MCP 지원, 훅/플러그인, 1M 컨텍스트, 프롬프트 캐싱, Fast mode |
| `codex-cli-features_ko.md` | Codex CLI | Cloud 작업, 코드 리뷰(/review), 이미지 입력, 승인 정책, exec 모드 |
| `gemini-cli-features-ko.md` | Gemini CLI | Agent Skills, Subagents, Google 검색, Extensions, 장기 메모리 |

### 2.2 신규 타입: `BackendCapabilityProfile`

**파일**: `extension/src/types.ts`

```typescript
export interface BackendCapabilityProfile {
  backendId: Exclude<CliBackendId, "auto">;
  displayName: string;

  // 강점 카테고리 (0.0~1.0 점수)
  strengths: {
    coding: number;        // 코드 작성/리팩토링
    review: number;        // 코드 리뷰/분석
    testing: number;       // 테스트 생성/실행
    research: number;      // 웹 검색/자료 수집
    writing: number;       // 문서 작성
    planning: number;      // 아키텍처/설계
    multimodal: number;    // 이미지/스크린샷 처리
    toolUse: number;       // MCP/외부 도구 활용
    longContext: number;   // 대규모 컨텍스트 처리
    costEfficiency: number; // 비용 효율성
  };

  // 제한 사항
  limitations: string[];

  // 지원 모델
  models: Array<{
    id: string;
    tier: "fast" | "standard" | "advanced";
    contextWindow: number;
    costPer1MInput: number;
    costPer1MOutput: number;
  }>;

  // 실행 모드 지원
  features: {
    stdinPrompt: boolean;
    streaming: boolean;
    mcpSupport: boolean;
    imageInput: boolean;
    webSearch: boolean;
    codeExecution: boolean;
    sessionResume: boolean;
  };
}
```

### 2.3 기본 프로필 정의

**파일**: `extension/src/services/backendProfiles.ts` (신규)

```typescript
export const BACKEND_PROFILES: BackendCapabilityProfile[] = [
  {
    backendId: "claude",
    displayName: "Claude Code",
    strengths: {
      coding: 0.95,
      review: 0.90,
      testing: 0.85,
      research: 0.70,
      writing: 0.92,
      planning: 0.93,
      multimodal: 0.80,
      toolUse: 0.95,     // MCP + 플러그인
      longContext: 0.95,  // 1M 컨텍스트
      costEfficiency: 0.60
    },
    limitations: [
      "API 비용 상대적으로 높음",
      "Google 전용 서비스 접근 제한"
    ],
    models: [
      { id: "sonnet-4.5", tier: "standard", contextWindow: 200_000, costPer1MInput: 3.0, costPer1MOutput: 15.0 },
      { id: "haiku-4.5", tier: "fast", contextWindow: 200_000, costPer1MInput: 0.8, costPer1MOutput: 4.0 },
      { id: "opus-4.5", tier: "advanced", contextWindow: 200_000, costPer1MInput: 15.0, costPer1MOutput: 75.0 }
    ],
    features: {
      stdinPrompt: true,
      streaming: true,
      mcpSupport: true,
      imageInput: true,
      webSearch: true,
      codeExecution: true,
      sessionResume: true
    }
  },
  {
    backendId: "codex",
    displayName: "Codex CLI",
    strengths: {
      coding: 0.92,
      review: 0.88,       // 전용 /review 기능
      testing: 0.80,
      research: 0.75,
      writing: 0.78,
      planning: 0.82,
      multimodal: 0.85,   // 이미지 입력 지원
      toolUse: 0.75,      // MCP 지원
      longContext: 0.80,
      costEfficiency: 0.75
    },
    limitations: [
      "Codex Cloud 별도 요금",
      "플러그인 시스템 미지원"
    ],
    models: [
      { id: "o3-mini", tier: "fast", contextWindow: 200_000, costPer1MInput: 1.1, costPer1MOutput: 4.4 },
      { id: "o3", tier: "standard", contextWindow: 200_000, costPer1MInput: 10.0, costPer1MOutput: 40.0 },
      { id: "codex-1", tier: "advanced", contextWindow: 1_000_000, costPer1MInput: 5.0, costPer1MOutput: 20.0 }
    ],
    features: {
      stdinPrompt: true,
      streaming: true,
      mcpSupport: true,
      imageInput: true,
      webSearch: true,
      codeExecution: true,
      sessionResume: true
    }
  },
  {
    backendId: "gemini",
    displayName: "Gemini CLI",
    strengths: {
      coding: 0.88,
      review: 0.82,
      testing: 0.78,
      research: 0.95,     // Google 검색 네이티브
      writing: 0.85,
      planning: 0.80,
      multimodal: 0.90,
      toolUse: 0.80,      // Extensions + MCP
      longContext: 0.90,   // 1M 컨텍스트
      costEfficiency: 0.90 // 무료 티어 존재
    },
    limitations: [
      "코드 수정 정확도 상대적으로 낮음",
      "복잡한 리팩토링에 약함"
    ],
    models: [
      { id: "gemini-2.5-flash", tier: "fast", contextWindow: 1_000_000, costPer1MInput: 0.15, costPer1MOutput: 0.6 },
      { id: "gemini-2.5-pro", tier: "standard", contextWindow: 1_000_000, costPer1MInput: 1.25, costPer1MOutput: 10.0 }
    ],
    features: {
      stdinPrompt: true,
      streaming: true,
      mcpSupport: true,
      imageInput: true,
      webSearch: true,
      codeExecution: true,
      sessionResume: true
    }
  }
];
```

---

## 3. 설계: Usage Tracking Service

### 3.1 현재 상태

- `TokenTracker`: 세션 내 flow별 토큰만 추적 → 세션 종료 시 사라짐
- `costCalculator.ts`: Claude 모델 가격만 하드코딩됨
- Backend별 일/주/월 단위 사용량 추적 없음

### 3.2 신규 타입: `BackendUsageRecord`

**파일**: `extension/src/types.ts`

```typescript
export interface BackendUsageRecord {
  backendId: Exclude<CliBackendId, "auto">;
  date: string;  // "YYYY-MM-DD"

  // 호출 수
  callCount: number;

  // 토큰
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;

  // 비용 (USD)
  estimatedCost: number;

  // 성능
  avgLatencyMs: number;
  errorCount: number;
  successRate: number;
}

export interface BackendUsageSummary {
  backendId: Exclude<CliBackendId, "auto">;

  today: BackendUsagePeriod;
  thisWeek: BackendUsagePeriod;
  thisMonth: BackendUsagePeriod;

  // 사용자 설정 한도
  budget?: BackendBudget;

  // 잔여 여유율 (0.0~1.0, 높을수록 여유)
  availabilityScore: number;
}

export interface BackendUsagePeriod {
  callCount: number;
  totalTokens: number;
  estimatedCost: number;
  avgLatencyMs: number;
  successRate: number;
}

export interface BackendBudget {
  dailyMaxCost?: number;      // USD
  weeklyMaxCost?: number;
  monthlyMaxCost?: number;
  dailyMaxCalls?: number;
  weeklyMaxCalls?: number;
  monthlyMaxCalls?: number;
}
```

### 3.3 신규 서비스: `BackendUsageTracker`

**파일**: `extension/src/services/backendUsageTracker.ts` (신규)

```typescript
export class BackendUsageTracker {
  private storePath: string;  // .agentcanvas/usage/ 디렉토리

  // === 기록 ===

  /** 매 CLI 호출 완료 시 기록 */
  recordCall(input: {
    backendId: Exclude<CliBackendId, "auto">;
    usage?: UsageMetrics;
    latencyMs: number;
    success: boolean;
    modelHint?: string;
  }): void;

  // === 조회 ===

  /** 특정 Backend의 오늘/이번주/이번달 사용량 요약 */
  getSummary(backendId: Exclude<CliBackendId, "auto">): BackendUsageSummary;

  /** 활성 Backend 전체의 사용량 요약 (팀 빌드 시 사용) */
  getAllSummaries(): BackendUsageSummary[];

  /** 특정 기간의 상세 기록 */
  getRecords(input: {
    backendId?: Exclude<CliBackendId, "auto">;
    from: string;  // "YYYY-MM-DD"
    to: string;
  }): BackendUsageRecord[];

  // === 예산 ===

  /** Backend별 사용 한도 설정 */
  setBudget(backendId: Exclude<CliBackendId, "auto">, budget: BackendBudget): void;

  /** 현재 한도 초과 여부 확인 */
  isOverBudget(backendId: Exclude<CliBackendId, "auto">): {
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
  };

  /** 잔여 여유율 계산 (0.0=한도초과, 1.0=전혀 안씀) */
  calculateAvailability(backendId: Exclude<CliBackendId, "auto">): number;
}
```

### 3.4 데이터 저장 구조

```
.agentcanvas/
└── usage/
    ├── claude/
    │   ├── 2026-02-19.json    ← 일별 기록
    │   ├── 2026-02-18.json
    │   └── ...
    ├── codex/
    │   └── ...
    ├── gemini/
    │   └── ...
    └── budgets.json           ← 사용자 한도 설정
```

**일별 JSON 구조**:
```json
{
  "backendId": "claude",
  "date": "2026-02-19",
  "callCount": 47,
  "inputTokens": 1250000,
  "outputTokens": 320000,
  "cacheReadTokens": 850000,
  "cacheWriteTokens": 200000,
  "estimatedCost": 12.45,
  "avgLatencyMs": 2340,
  "errorCount": 2,
  "successRate": 0.957,
  "calls": [
    {
      "timestamp": "2026-02-19T14:30:22Z",
      "flowName": "my-project",
      "agentId": "coder-1",
      "inputTokens": 28000,
      "outputTokens": 5200,
      "latencyMs": 1840,
      "model": "sonnet-4.5",
      "success": true,
      "cost": 0.162
    }
  ]
}
```

---

## 4. 설계: Work Intent Analyzer

### 4.1 개요

사용자의 Build Prompt를 분석하여 "이 팀이 주로 해야 할 작업"의 유형을 식별하고, 그에 맞는 팀 구성과 Backend 배분을 결정하는 분석기.

### 4.2 Work Intent 카테고리

```typescript
export type WorkCategory =
  | "new_feature"       // 새 기능 구현
  | "bug_fix"           // 버그 수정
  | "refactor"          // 리팩토링/코드 개선
  | "code_review"       // 코드 리뷰/품질 감사
  | "testing"           // 테스트 작성/QA
  | "documentation"     // 문서 작성
  | "research"          // 조사/분석
  | "devops"            // CI/CD/배포
  | "design"            // UI/UX 디자인
  | "data_pipeline"     // 데이터 처리
  | "full_stack"        // 종합 개발
  | "mixed";            // 복합 작업

export interface WorkIntentAnalysis {
  primaryCategory: WorkCategory;
  secondaryCategories: WorkCategory[];

  // 각 카테고리별 비중 (합계 1.0)
  categoryWeights: Partial<Record<WorkCategory, number>>;

  // 추천 팀 구성
  suggestedRoles: Array<{
    role: AgentRole;
    count: number;
    reason: string;
    preferredBackend: Exclude<CliBackendId, "auto">;
    backendReason: string;
  }>;

  // 예상 리소스 규모
  estimatedComplexity: "light" | "medium" | "heavy";
  estimatedDuration: "minutes" | "hours" | "days";
}
```

### 4.3 카테고리별 Backend Affinity Matrix

각 Backend가 어떤 작업 유형에 강한지를 정의하는 행렬:

```
                  Claude    Codex     Gemini
──────────────────────────────────────────────
new_feature       0.95      0.90      0.82
bug_fix           0.92      0.88      0.80
refactor          0.93      0.85      0.78
code_review       0.90      0.92 ★    0.80
testing           0.85      0.82      0.78
documentation     0.92      0.78      0.85
research          0.70      0.75      0.95 ★
devops            0.80      0.85      0.82
design            0.82      0.85      0.88
data_pipeline     0.80      0.82      0.88
full_stack        0.94 ★    0.88      0.82
mixed             0.90      0.85      0.85
```

**★ = 해당 카테고리 최적 Backend**

### 4.4 분석 로직

```typescript
export function analyzeWorkIntent(input: {
  prompt: string;
  existingAgents: AgentProfile[];
  availableBackends: CliBackend[];
  usageSummaries: BackendUsageSummary[];
  profiles: BackendCapabilityProfile[];
}): WorkIntentAnalysis {
  // 1단계: 프롬프트에서 키워드/패턴 추출 → 카테고리 가중치
  const weights = extractCategoryWeights(input.prompt);

  // 2단계: 카테고리 가중치 → 팀 역할 결정
  const roles = determineRoles(weights, input.existingAgents);

  // 3단계: 각 역할에 최적 Backend 할당 (affinity × availability)
  const assignments = assignBackends(roles, {
    affinityMatrix: AFFINITY_MATRIX,
    profiles: input.profiles,
    usage: input.usageSummaries,
    available: input.availableBackends
  });

  return { ... };
}
```

---

## 5. 설계: Smart Backend Assignment

### 5.1 할당 알고리즘

각 Agent에 Backend을 할당할 때 아래 3가지 요소를 가중 합산:

```
최종 점수 = (Affinity × 0.4) + (Availability × 0.35) + (CostEfficiency × 0.25)
```

| 요소 | 가중치 | 설명 |
|------|--------|------|
| **Affinity** | 40% | 해당 Agent 역할 + 작업 유형에 대한 Backend 적합도 |
| **Availability** | 35% | 현재 사용량 대비 남은 여유 (예산 고려) |
| **CostEfficiency** | 25% | 토큰당 비용 효율 (저비용 우선) |

### 5.2 할당 흐름

```
[사용자 프롬프트]
    │
    ▼
[Work Intent Analyzer] → 카테고리 분석 → 역할 목록
    │
    ▼
[Backend Usage Tracker] → 일/주/월 사용량 조회
    │
    ▼
[Backend Capability Profile] → 능력치 + 비용 정보
    │
    ▼
[Assignment Engine] ← Affinity Matrix
    │
    각 역할(Agent)별:
    │  1) 활성 Backend 3종의 점수 계산
    │  2) 예산 초과 Backend 제외
    │  3) 최고 점수 Backend 할당
    │
    ▼
[GeneratedAgentStructure + backendAssignments]
```

### 5.3 예산 초과 시 Fallback 전략

```
1차: 해당 Backend의 저비용 모델로 다운그레이드
     예) Claude sonnet-4.5 → haiku-4.5

2차: 차선 Backend으로 전환
     예) Claude 예산 초과 → Codex로 전환

3차: 전체 Backend 예산 초과 → 사용자에게 경고
     "현재 일일 사용량이 한도에 근접했습니다. 계속하시겠습니까?"
```

### 5.4 예시 시나리오

**프롬프트**: "프론트엔드 리팩토링하고, API 문서 업데이트하고, E2E 테스트 추가해줘"

```
Work Intent Analysis:
  primaryCategory: "mixed"
  weights: { refactor: 0.4, documentation: 0.3, testing: 0.3 }

Backend Usage (today):
  claude:  $8.20 / $15.00 daily limit  → availability: 0.45
  codex:   $2.10 / $10.00 daily limit  → availability: 0.79
  gemini:  $0.30 / $5.00 daily limit   → availability: 0.94

Team Assignment:
┌──────────────┬──────────┬─────────┬────────────────────────────┐
│ Agent        │ Role     │ Backend │ 이유                        │
├──────────────┼──────────┼─────────┼────────────────────────────┤
│ Orchestrator │ planner  │ Claude  │ 복잡한 조율, 높은 계획 능력    │
│ Frontend Dev │ coder    │ Codex   │ 리팩토링 적합 + Claude 여유↓  │
│ Doc Writer   │ writer   │ Gemini  │ 문서 작성 + 비용 효율 최고    │
│ QA Tester    │ tester   │ Codex   │ 테스트 생성 + 여유 높음       │
└──────────────┴──────────┴─────────┴────────────────────────────┘
```

---

## 6. 타입 변경 사항

### 6.1 `GeneratedAgent` 확장

**파일**: `extension/src/types.ts` + `webview-ui/src/messaging/protocol.ts`

```typescript
// 기존
export interface GeneratedAgent {
  name: string;
  role: AgentRole;
  roleLabel?: string;
  description?: string;
  systemPrompt?: string;
  isOrchestrator: boolean;
  delegatesTo: string[];
  assignedSkillIds: string[];
  assignedMcpServerIds: string[];
  color?: string;
  avatar?: string;
}

// 변경 (추가 필드)
export interface GeneratedAgent {
  // ... 기존 필드 유지 ...

  // ➕ 신규: 명시적 Backend 할당
  assignedBackend: Exclude<CliBackendId, "auto">;
  assignedModel?: string;        // 해당 Backend의 모델 ID
  backendAssignReason?: string;  // "Affinity 0.93 × Availability 0.79"
}
```

### 6.2 `GeneratedAgentStructure` 확장

```typescript
export interface GeneratedAgentStructure {
  // ... 기존 필드 유지 ...

  // ➕ 신규
  workIntent: WorkIntentAnalysis;
  backendUsageAtBuild: BackendUsageSummary[];  // 빌드 시점 사용량 스냅샷
}
```

### 6.3 `GENERATE_AGENT_STRUCTURE` 메시지 확장

```typescript
// 기존
RequestMessage<"GENERATE_AGENT_STRUCTURE", {
  prompt: string;
  backendId: CliBackend["id"];            // 단일 Backend
  includeExistingAgents: boolean;
  includeExistingSkills: boolean;
  includeExistingMcpServers: boolean;
}>

// 변경
RequestMessage<"GENERATE_AGENT_STRUCTURE", {
  prompt: string;
  // backendId 삭제 → 자동 분배
  preferredBackends?: Exclude<CliBackendId, "auto">[];  // 사용자가 선호 지정 (선택)
  includeExistingAgents: boolean;
  includeExistingSkills: boolean;
  includeExistingMcpServers: boolean;
  // ➕ 신규
  useSmartAssignment: boolean;            // 지능형 할당 활성화
  budgetConstraint?: "strict" | "soft";   // 예산 제약 수준
}>
```

### 6.4 신규 메시지 타입

```typescript
// 사용량 관련
| RequestMessage<"GET_BACKEND_USAGE", {
    backendId?: Exclude<CliBackendId, "auto">;
    period?: "today" | "week" | "month";
  }>
| RequestMessage<"SET_BACKEND_BUDGET", {
    backendId: Exclude<CliBackendId, "auto">;
    budget: BackendBudget;
  }>
| RequestMessage<"GET_BACKEND_BUDGETS">

// Inbound (extension → webview)
| { type: "BACKEND_USAGE_UPDATE"; payload: { summaries: BackendUsageSummary[] } }
| { type: "BUDGET_WARNING"; payload: { backendId: string; type: "approaching" | "exceeded"; detail: string } }
```

---

## 7. UI 변경 사항

### 7.1 BuildPromptBar 개편

**기존**: Backend 단일 select → 팀 전체 적용

**변경**:

```
┌─────────────────────────────────────────────────┐
│  Build Your Agent Team                          │
│                                                 │
│  [프롬프트 입력 textarea]                         │
│                                                 │
│  ┌─ Backend Strategy ─────────────────────────┐ │
│  │ ◉ Smart (작업에 맞게 자동 분배) ← 기본값      │ │
│  │ ○ Manual (Agent별 직접 지정)                 │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Usage Dashboard (축소 가능) ──────────────┐ │
│  │ Claude  ████████░░ 72%  $10.8/$15 today   │ │
│  │ Codex   ███░░░░░░░ 21%  $2.1/$10 today    │ │
│  │ Gemini  █░░░░░░░░░  6%  $0.3/$5 today     │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  [Build Team]                                   │
└─────────────────────────────────────────────────┘
```

### 7.2 Build 결과 프리뷰 개편

기존 프리뷰에 Backend 할당 정보 추가:

```
┌─ Team Preview ────────────────────────────────────┐
│                                                   │
│  Team: Full Stack Refactor Squad                  │
│  Intent: refactor (40%) + docs (30%) + test (30%) │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ 👑 Orchestrator      │ Claude (sonnet-4.5)  │  │
│  │    "복잡한 조율, 높은 계획 능력"              │  │
│  ├─────────────────────────────────────────────┤  │
│  │ 💻 Frontend Coder    │ Codex (codex-1)      │  │
│  │    "리팩토링 적합 + Claude 여유 부족"         │  │
│  ├─────────────────────────────────────────────┤  │
│  │ 📝 Doc Writer        │ Gemini (2.5-flash)   │  │
│  │    "문서 작성 + 비용 효율 최고"              │  │
│  ├─────────────────────────────────────────────┤  │
│  │ 🧪 QA Tester         │ Codex (o3-mini)      │  │
│  │    "테스트 생성 + 여유 높음"                 │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  예상 비용: ~$2.40                                │
│  [Agent별 Backend 변경 ▾]  [Apply]  [Cancel]     │
│                                                   │
└───────────────────────────────────────────────────┘
```

### 7.3 Agent 노드에 Backend 표시

Graph 뷰의 AgentNode에 Backend 뱃지 추가:

```
┌──────────────────────────┐
│ CODER                    │
│ Frontend Dev             │
│                          │
│ ┌────────┐ ┌──────────┐ │
│ │ Codex  │ │ codex-1  │ │
│ └────────┘ └──────────┘ │
│ Skills: 3  MCP: 1       │
└──────────────────────────┘
```

### 7.4 Settings에 Usage & Budget 탭 추가

Settings 모달에 신규 탭: "Usage & Budget"

```
┌─ Usage & Budget ─────────────────────────────────┐
│                                                  │
│  ┌─ Claude Code ──────────────────────────────┐  │
│  │ Today:  $10.80  (47 calls, 1.57M tokens)  │  │
│  │ Week:   $52.30  (312 calls)               │  │
│  │ Month:  $180.50 (1,240 calls)             │  │
│  │                                            │  │
│  │ Budget:  Daily $15 │ Weekly $80 │ Month $  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Codex CLI ────────────────────────────────┐  │
│  │ Today:  $2.10   (23 calls, 450K tokens)   │  │
│  │ Week:   $12.50  (145 calls)               │  │
│  │ Month:  $48.20  (580 calls)               │  │
│  │                                            │  │
│  │ Budget:  Daily $10 │ Weekly $50 │ Month $  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Gemini CLI ───────────────────────────────┐  │
│  │ Today:  $0.30   (15 calls, 200K tokens)   │  │
│  │ ...                                        │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 8. cliExecutor 연동

### 8.1 호출 시 Usage 기록

**파일**: `extension/src/services/cliExecutor.ts`

매 CLI 호출 완료 시 `BackendUsageTracker.recordCall()` 호출:

```typescript
// cliExecutor.ts — executeCliPrompt() 내부
const startMs = Date.now();
const result = await runCliProcess(...);
const latencyMs = Date.now() - startMs;

// ➕ 사용량 기록
backendUsageTracker.recordCall({
  backendId: backend.id,
  usage: result.usage,
  latencyMs,
  success: result.success,
  modelHint: backend.preferredModel
});
```

### 8.2 costCalculator 확장

현재 Claude 모델만 가격 정보가 있음 → Codex, Gemini 모델도 추가:

```typescript
const DEFAULT_PRICING: Record<string, PricingEntry> = {
  // Claude
  "sonnet-4.5": { input: 3.0, cacheWrite: 3.75, cacheRead: 0.3, output: 15.0 },
  "haiku-4.5":  { input: 0.8, cacheWrite: 1.0, cacheRead: 0.08, output: 4.0 },
  "opus-4.5":   { input: 15.0, cacheWrite: 18.75, cacheRead: 1.5, output: 75.0 },

  // Codex (➕ 추가)
  "o3-mini":    { input: 1.1, cacheWrite: 0, cacheRead: 0, output: 4.4 },
  "o3":         { input: 10.0, cacheWrite: 0, cacheRead: 0, output: 40.0 },
  "codex-1":    { input: 5.0, cacheWrite: 0, cacheRead: 0, output: 20.0 },

  // Gemini (➕ 추가)
  "gemini-2.5-flash": { input: 0.15, cacheWrite: 0.0375, cacheRead: 0.015, output: 0.6 },
  "gemini-2.5-pro":   { input: 1.25, cacheWrite: 0.3125, cacheRead: 0.125, output: 10.0 },
};
```

---

## 9. 구현 순서 (우선순위)

### Phase 1: 기반 인프라 (P0)

| # | 작업 | 파일 | 예상 |
|---|------|------|------|
| 1-1 | `BackendCapabilityProfile` 타입 + 기본 프로필 정의 | `types.ts`, `backendProfiles.ts` (신규) | 2h |
| 1-2 | `BackendUsageTracker` 서비스 구현 | `backendUsageTracker.ts` (신규) | 4h |
| 1-3 | `cliExecutor.ts`에 usage 기록 연동 | `cliExecutor.ts` | 1h |
| 1-4 | `costCalculator.ts` Codex/Gemini 가격 추가 | `costCalculator.ts` | 1h |
| 1-5 | Usage 관련 메시지 타입 추가 | `types.ts`, `protocol.ts` (양쪽) | 1h |

### Phase 2: 지능형 할당 엔진 (P0)

| # | 작업 | 파일 | 예상 |
|---|------|------|------|
| 2-1 | `WorkCategory` 타입 + Affinity Matrix 정의 | `types.ts`, `affinityMatrix.ts` (신규) | 2h |
| 2-2 | `analyzeWorkIntent()` 함수 구현 | `workIntentAnalyzer.ts` (신규) | 4h |
| 2-3 | `assignBackends()` 할당 알고리즘 구현 | `backendAssigner.ts` (신규) | 3h |
| 2-4 | `GeneratedAgent`에 `assignedBackend` 필드 추가 | `types.ts`, `protocol.ts` (양쪽) | 1h |
| 2-5 | `GENERATE_AGENT_STRUCTURE` 핸들러 개편 | `extension.ts` | 3h |

### Phase 3: UI 개편 (P1)

| # | 작업 | 파일 | 예상 |
|---|------|------|------|
| 3-1 | BuildPromptBar에 "Smart/Manual" 라디오 + Usage Dashboard | `BuildPromptBar.tsx`, `styles.css` | 4h |
| 3-2 | Build 결과 프리뷰에 Backend 할당 표시 + 변경 UI | `App.tsx` (프리뷰 영역) | 3h |
| 3-3 | AgentNode에 Backend 뱃지 추가 | `AgentNode.tsx`, `styles.css` | 2h |
| 3-4 | Settings에 "Usage & Budget" 탭 추가 | `SettingsModal.tsx` (신규 또는 기존), `styles.css` | 4h |
| 3-5 | Status Bar에 실시간 사용량 미니 표시 | `App.tsx`, `styles.css` | 2h |

### Phase 4: 고도화 (P2)

| # | 작업 | 파일 | 예상 |
|---|------|------|------|
| 4-1 | 예산 초과 Fallback 로직 (모델 다운그레이드 → Backend 전환) | `backendAssigner.ts` | 3h |
| 4-2 | 예산 경고 토스트 + 확인 다이얼로그 | `App.tsx`, `styles.css` | 2h |
| 4-3 | Usage 히스토리 차트 (일별 추세) | `UsageChart.tsx` (신규) | 4h |
| 4-4 | `coder resource/` 파일 자동 파싱 → 프로필 업데이트 | `backendProfiles.ts` | 3h |

---

## 10. "auto" 제거 전략

### 10.1 단계적 마이그레이션

| 단계 | 내용 |
|------|------|
| Step 1 | `CliBackendId`에서 "auto" 유지하되, Build Team에서는 미사용 |
| Step 2 | Build 결과의 모든 Agent에 명시적 Backend 할당 강제 |
| Step 3 | UI에서 "Auto (best available)" 옵션 숨기기 (수동 모드에서도) |
| Step 4 | `CliBackendId`에서 "auto" 완전 제거 + deprecated 경고 |

### 10.2 `pickPromptBackend`의 "auto" 처리 변경

```typescript
// 기존 (cliDetector.ts:158)
export function pickPromptBackend(backends, backendId) {
  if (backendId === "auto") {
    // 첫 번째 available Backend 반환 → 불투명
    return backends.find(b => b.available && b.id !== "auto");
  }
}

// 변경: auto를 Usage 기반으로 결정
export function pickPromptBackend(backends, backendId, usageTracker?) {
  if (backendId === "auto" && usageTracker) {
    // 여유가 가장 많은 Backend 선택
    const summaries = usageTracker.getAllSummaries();
    const best = summaries
      .filter(s => backends.find(b => b.id === s.backendId)?.available)
      .sort((a, b) => b.availabilityScore - a.availabilityScore)[0];
    if (best) {
      return backends.find(b => b.id === best.backendId)!;
    }
  }
  // ... 기존 로직
}
```

---

## 11. 검증 체크리스트

- [ ] `GeneratedAgent`에 `assignedBackend` 필드가 필수값으로 추가되었는가
- [ ] Build Team 시 모든 Agent에 "auto"가 아닌 명시적 Backend이 할당되는가
- [ ] `cliExecutor` 호출마다 `BackendUsageTracker.recordCall()` 이 실행되는가
- [ ] 일별 사용량 JSON이 `.agentcanvas/usage/{backend}/` 에 올바르게 저장되는가
- [ ] Budget 초과 시 경고 토스트가 표시되는가
- [ ] BuildPromptBar의 Usage Dashboard가 실시간 갱신되는가
- [ ] Build 프리뷰에서 Agent별 Backend을 수동으로 변경할 수 있는가
- [ ] `coder resource/` 파일 내용이 `BackendCapabilityProfile` 에 반영되었는가
- [ ] Codex/Gemini 모델의 비용 계산이 정확한가
- [ ] Settings "Usage & Budget" 탭에서 한도를 설정할 수 있는가

---

## 12. 2차 개정 — 구현 검증 결과 & 수정 스펙 (2026-02-20)

### 12.1 현재 구현 검증

| 항목 | 상태 | 파일 | 확인 내용 |
|------|------|------|----------|
| `BackendCapabilityProfile` 타입 | ✅ 구현됨 | `extension/src/types.ts` line 224 | 강점, 모델, features 완비 |
| `BackendUsageTracker` 클래스 | ✅ 구현됨 | `backendUsageTracker.ts` line 24 | recordCall, getSummary 구현 |
| `GeneratedAgent.assignedBackend` | ✅ 구현됨 | `protocol.ts` line 224 | CanonicalBackendId 타입 |
| `backendProfiles.ts` 모델 목록 | ⚠️ 부분구현 | `backendProfiles.ts` | Claude: 단축 ID 사용, Codex: gpt-4.1 계열 누락 |
| Rebuild 시 overwriteExisting | ❌ 미구현 | `AgentPreviewModal.tsx` line 37 | 기본값 false 고정 |
| ChatBackendId 동기화 | ❌ 미구현 | `App.tsx` line 136 | 하드코딩 "claude" |

### 12.2 [BUG-1] Rebuild overwriteExisting 스펙

팀을 Rebuild할 때(이미 Agent가 존재하는 상태에서 재생성) 기존 Agent가 삭제되어야 한다.

**설계 원칙:**
> 기존 팀이 있는 상태(hasTeamReady=true)에서 팀을 다시 빌드하면, Apply 시 기본으로 기존 Agent를 덮어쓴다.
> 사용자가 명시적으로 "기존 유지 + 추가" 방식을 원하면 체크박스를 해제한다.

```
팀 빌드 흐름 (Rebuild 케이스):
hasTeamReady = true → BuildPromptBar (compact Rebuild 버튼)
→ generatedPreview 생성 → AgentPreviewModal 오픈
  → rebuildMode=true → overwriteExisting 기본값 true
→ Apply 클릭 → APPLY_GENERATED_STRUCTURE { overwriteExisting: true }
→ Extension: 기존 Agent 전체 삭제 → 새 팀 적용
```

**AgentPreviewModal prop 추가:**
```tsx
rebuildMode?: boolean  // hasTeamReady 값 전달
// overwriteExisting 초기값: rebuildMode ?? false
```

### 12.3 최신 모델 목록 — CLI 조사 결과

#### Claude Code (`claude --model`)
> 현재 코드 기준(2026-02-21), 실제 선택지는 3개만 사용한다.
> `Default(recommended)=Opus 4.6`, `Sonnet=Sonnet 4.6`, `Haiku=Haiku 4.5`.

| 전체 모델 ID | 티어 | 입력 비용/1M | 출력 비용/1M |
|------------|------|------------|------------|
| `claude-opus-4-6` | Advanced | $15.00 | $75.00 |
| `claude-sonnet-4-6` | Standard | $3.00 | $15.00 |
| `claude-haiku-4-5-20251001` | Fast | $0.80 | $4.00 |

#### Codex CLI (`codex --model`)
> 현재 코드 기준(2026-02-21), GPT-5 Codex 계열 + GPT-4 fallback이 반영되어 있음.

| 모델 | 설명 | 컨텍스트 |
|------|------|---------|
| `gpt-5.3-codex` | GPT-5 Codex 주력 고성능 | 1M |
| `gpt-5.3-codex-spark` | GPT-5 Codex 경량/고속 | 200K |
| `gpt-5.2-codex` | GPT-5 Codex 표준 | 200K |
| `gpt-5.1-codex-max` | GPT-5 Codex 고성능 | 1M |
| `gpt-5.2` | GPT-5 일반 표준 | 200K |
| `gpt-5.1-codex-mini` | GPT-5 Codex 미니 | 200K |
| `gpt-4.1` | GPT-4 fallback | 200K |
| `gpt-4o` | 멀티모달 fallback | 200K |
| `o3` | 고급 추론 fallback | 200K |

#### Gemini CLI (`gemini --model`)
> 현재 코드 기준(2026-02-21), 실제 선택지는 5개만 사용한다.

| 모델 | 설명 | 컨텍스트 |
|------|------|---------|
| `gemini-3-pro-preview` | Gemini 3 고성능 preview | 2M |
| `gemini-3-flash-preview` | Gemini 3 고속 preview | 1M |
| `gemini-2.5-pro` | 2.5 고성능 fallback | 1M |
| `gemini-2.5-flash` | 2.5 고속 fallback | 1M |
| `gemini-2.5-flash-lite` | 2.5 초경량 | 1M |

### 12.4 backendProfiles.ts 수정 스펙

**파일:** `extension/src/services/backendProfiles.ts`

```ts
// Claude backend models[] (실제 선택지 3개)
models: [
  { id: "claude-opus-4-6", tier: "advanced", contextWindow: 200_000, costPer1MInput: 15.0, costPer1MOutput: 75.0 },
  { id: "claude-sonnet-4-6", tier: "standard", contextWindow: 200_000, costPer1MInput: 3.0, costPer1MOutput: 15.0 },
  { id: "claude-haiku-4-5-20251001", tier: "fast", contextWindow: 200_000, costPer1MInput: 0.8, costPer1MOutput: 4.0 },
],

// Codex backend models[] (GPT-5 Codex family + GPT-4 fallback)
models: [
  { id: "gpt-5.3-codex", tier: "advanced", contextWindow: 1_000_000, costPer1MInput: 5.0, costPer1MOutput: 20.0 },
  { id: "gpt-5.3-codex-spark", tier: "fast", contextWindow: 200_000, costPer1MInput: 0.5, costPer1MOutput: 2.0 },
  { id: "gpt-5.2-codex", tier: "standard", contextWindow: 200_000, costPer1MInput: 2.0, costPer1MOutput: 8.0 },
  { id: "gpt-5.1-codex-max", tier: "advanced", contextWindow: 1_000_000, costPer1MInput: 10.0, costPer1MOutput: 40.0 },
  { id: "gpt-5.2", tier: "standard", contextWindow: 200_000, costPer1MInput: 2.0, costPer1MOutput: 8.0 },
  { id: "gpt-5.1-codex-mini", tier: "fast", contextWindow: 200_000, costPer1MInput: 0.4, costPer1MOutput: 1.6 },
  { id: "gpt-4.1", tier: "standard", contextWindow: 200_000, costPer1MInput: 2.0, costPer1MOutput: 8.0 },
  { id: "gpt-4o", tier: "standard", contextWindow: 200_000, costPer1MInput: 2.5, costPer1MOutput: 10.0 },
  { id: "o3", tier: "advanced", contextWindow: 200_000, costPer1MInput: 10.0, costPer1MOutput: 40.0 },
],

// Gemini backend models[] (실제 선택지 5개)
models: [
  { id: "gemini-3-pro-preview", tier: "advanced", contextWindow: 2_000_000, costPer1MInput: 2.5, costPer1MOutput: 15.0 },
  { id: "gemini-3-flash-preview", tier: "standard", contextWindow: 1_000_000, costPer1MInput: 0.3, costPer1MOutput: 1.2 },
  { id: "gemini-2.5-pro",   tier: "advanced", contextWindow: 1_000_000, costPer1MInput: 1.25, costPer1MOutput: 10.0 },
  { id: "gemini-2.5-flash", tier: "standard", contextWindow: 1_000_000, costPer1MInput: 0.15, costPer1MOutput: 0.6  },
  { id: "gemini-2.5-flash-lite", tier: "fast", contextWindow: 1_000_000, costPer1MInput: 0.075, costPer1MOutput: 0.3 },
],
```

### 12.5 2차 검증 체크리스트

- [ ] `backendProfiles.ts` Claude 모델에 4.6 계열(`claude-opus-4-6`, `claude-sonnet-4-6`)이 반영됐는가
- [ ] `backendProfiles.ts` Claude 모델이 3개 선택지(`Opus 4.6`, `Sonnet 4.6`, `Haiku 4.5`)만 유지되는가
- [ ] `backendProfiles.ts` Codex 모델에 GPT-5 Codex 계열(`gpt-5.3-codex` 등)과 GPT-4 fallback이 반영됐는가
- [ ] `backendProfiles.ts` Gemini 모델이 5개 선택지(`gemini-3-pro-preview`, `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`)로 유지되는가
- [ ] `AgentPreviewModal`에 `rebuildMode` prop이 추가됐는가
- [ ] `hasTeamReady=true` 상태에서 Rebuild 시 `overwriteExisting` 기본 체크됐는가
- [ ] `chatBackendId`가 Orchestrator `runtime.backendId`와 자동 동기화되는가
- [ ] Agent 생성 모달에서 Backend와 Model을 선택할 수 있는가
- [ ] 신규 `modelOptions.ts` 파일이 생성됐는가

---

## 13. 3차 개정 — Orchestrator Human Query & Task Conversation (2026-02-21)

이번 개정은 "사용자와의 질의응답은 Orchestrator만 수행" + "Canvas Task 더블클릭으로 agent↔orchestrator 전체 대화 확인" 요구를 반영한다.

### 13.1 핵심 정책

1. Human input 요청 포맷은 `[NEED_HUMAN: <question>]` 단일 표준으로 통일한다.
2. 해당 규칙은 **Orchestrator 프롬프트에만** 주입한다.
3. 런타임 감지도 Orchestrator 컨텍스트에서만 활성화한다(Worker 출력은 human query 트리거로 승격하지 않음).
4. Task 더블클릭 시 해당 Task의 orchestrator↔agent 전체 turn transcript를 표시한다.
5. Chat의 `human_query` 카드에서 답변 제출 시 `HUMAN_QUERY_RESPONSE`로 정확한 `runId/taskId`에 라우팅한다.

### 13.2 반영된 구현

| 항목 | 상태 | 파일 | 구현 내용 |
|------|------|------|----------|
| Orchestrator 전용 `NEED_HUMAN` 지시문 | ✅ | `extension/src/services/promptBuilder.ts` | `[NEED_HUMAN: <question>]` 정확 포맷 + 대체 태그 금지 문구 반영 |
| 런타임 human query 감지 가드 | ✅ | `extension/src/extension.ts` | `taskAgent.isOrchestrator` 또는 orchestrator task일 때만 `parseHumanQuery` 실행 |
| Human query 파서 서비스화 | ✅ | `extension/src/services/humanQuery.ts` | 표준 태그 + 레거시 fallback 파싱 지원 |
| Task transcript 추출 서비스화 | ✅ | `extension/src/services/taskConversation.ts` | `run_log(task_conversation_turn)` 기반 turn 정규화/시간순 정렬 |
| Task 대화 조회 프로토콜 | ✅ | `extension/src/messages/protocol.ts`, `webview-ui/src/messaging/protocol.ts` | `GET_TASK_CONVERSATION` / `TASK_CONVERSATION` 추가 |
| Role-aware 모델 가이드 주입 | ✅ | `extension/src/services/promptBuilder.ts`, `extension/src/extension.ts` | 팀 빌드 프롬프트에 Claude/Codex/Gemini 모델별 `whenToUse` + `recommendedRoles` 포함 |
| TaskDetail Conversation 탭 | ✅ | `webview-ui/src/panels/TaskDetailModal.tsx` | Task별 전체 대화 표시(Orchestrator/Agent role badge + timestamp) |
| Canvas Task 더블클릭 연결 | ✅ | `webview-ui/src/views/KanbanView.tsx`, `webview-ui/src/canvas/ScheduleView.tsx`, `webview-ui/src/App.tsx` | 더블클릭 → TaskDetailModal 오픈 유지 |
| Chat `human_query` 인라인 응답 카드 | ✅ | `webview-ui/src/components/HumanQueryCard.tsx`, `webview-ui/src/panels/ChatMessageList.tsx` | 질문 표시/답변 입력/전송 + Task 열기 버튼 |
| HUMAN_QUERY_RESPONSE 처리 보강 | ✅ | `extension/src/extension.ts` | 공백 답변 차단, task ready 전이, chat history append, collab 이벤트 기록 |
| Human query lifecycle 이벤트 | ✅ | `extension/src/services/collaborationLogger.ts`, `webview-ui/src/panels/RunPanel.tsx` | `human_query_requested`, `human_query_answered`, `task_resumed_after_human_query` 표시 |

### 13.3 사용자 플로우 (최신)

```
Worker/Orchestrator 실행
  → (Orchestrator 출력) [NEED_HUMAN: ...] 감지
    → Task status: blocked(input)
    → human_query chat card 생성
    → collab event: human_query_requested

사용자 응답 경로
  A) AI Prompt 패널의 human_query 카드에서 답변 전송
  B) TaskDetailModal/Task 동선에서 HUMAN_QUERY_RESPONSE 전송

응답 반영
  → Task status: ready
  → task.meta.humanAnswer 저장
  → collab event: human_query_answered
  → collab event: task_resumed_after_human_query
  → 실행 루프 재개
```

### 13.4 검증 결과

- `npm run check` 통과
- `npm run test:integration` 통과
- 통합 테스트 추가:
  - Orchestrator prompt `NEED_HUMAN` 규칙 검증
  - `parseHumanQuery` 파서 검증
  - Task conversation turn 추출/정렬 검증
  - human query lifecycle(collab log) roundtrip 검증
