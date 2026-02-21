# Agent 메모리 공유(Shared Memory) 구현/적용 작업 지시서

> 대상: 멀티 에이전트(또는 여러 세션/디바이스를 오가는 단일 에이전트)에서 **공유 가능한 지속 메모리(Shared + Persistent Memory)** 를 실제 프로그램에 적용하려는 개발팀  
> 목적: 유튜브 영상(“Manage memory like Git” 컨셉)에서 말한 **컨텍스트/메모리 공유**를 실전 구현 사례·논문·코드 기반으로 재현/도입하고, 기존 Agent 프로그램에 안전하게 통합한다.

---

## 0) 한 줄 요약

- **대화창에 갇힌 컨텍스트**를 **“시스템(파일/DB)로 승격”**시키고, 여러 에이전트가 **동일한 메모리 레이어를 읽고/쓰게** 만든다.
- Git처럼 **버전 관리(커밋/브랜치/머지/롤백)** 를 제공하면 “세션이 끊겨도 이어서 작업” + “여러 에이전트 병렬 작업”이 가능해진다.
- 구현은 3가지 레일 중 하나(또는 혼합)로 접근한다:
  1) **File + Git 기반**(가장 빠르고 Dev 친화적)  
  2) **중앙 Memory Service(DB+Vector+ACL)** 기반(프로덕션/스케일)  
  3) **프레임워크 내장 메모리**(CrewAI/AutoGen/LangGraph/Letta 등) 활용(최단시간)

---

## 1) 참고 자료(실제 구현 사례 / 논문 / 코드)

### 1.1 실제 구현 사례(제품/툴) — “메모리를 시스템으로”
아래 사례들은 “세션이 끝나도 이어지는 컨텍스트” 혹은 “여러 에이전트가 동일 컨텍스트를 공유”하는 실전 접근을 보여준다.

- **OneContext (Agent Self‑Managed Context layer)**
  - 핵심: 에이전트 실행 트래젝터리 기록, 컨텍스트 공유 링크/Slack, 공유 컨텍스트 로드 후 이어서 작업  
  - 참고:
    - GitHub: https://github.com/TheAgentContextLab/OneContext
    - 설치: `npm i -g onecontext-ai` 후 `onecontext` 실행
  - 이 작업지시서에서는 OneContext를 “요구사항 체크리스트”의 기준 사례로 사용한다.

- **ctx (Context is a system, not a prompt)**
  - 핵심: 프로젝트 안에 **파일 기반 컨텍스트 디렉터리**를 만들고(`ctx init`), 에이전트가 읽을 “컨텍스트 패킷”을 생성(`ctx agent --budget 4000`)하는 접근  
  - 참고: https://github.com/ActiveMemory/ctx

- **OpenContext (MCP + CLI + GUI로 개인/프로젝트 컨텍스트 저장소)**
  - 핵심: `oc` CLI로 전역 컨텍스트 라이브러리 운영 + **MCP 서버**로 다양한 에이전트/IDE가 컨텍스트를 “툴 호출”로 읽고 쓰게 함  
  - 참고: https://github.com/0xranx/OpenContext

- **Letta Code – MemFS (git-backed memory filesystem)**
  - 핵심: 에이전트 메모리를 **git-backed markdown repo**로 유지하고, 에이전트가 스스로 파일을 수정한 뒤 **커밋/푸시**하여 메모리를 “저장”  
  - 병렬 subagent 수정은 **git worktrees**로 처리(동시성)  
  - 참고: https://docs.letta.com/letta-code/memory/

> 위 4개는 “메모리 공유/지속성”을 제품 수준으로 구현한 레퍼런스다.  
> 본 프로젝트는 이들의 공통 아이디어를 가져오되, **우리 Agent 프로그램 구조/보안 요건/운영 환경**에 맞게 구현한다.

---

### 1.2 프레임워크/라이브러리 기반 구현(코드 레퍼런스)

- **CrewAI — 공유 메모리(crew memory)**
  - `memory=True` 시 crew memory를 생성하고 기본적으로 모든 에이전트가 공유, 태스크 출력에서 사실을 추출해 저장하고 태스크 시작 전 recall로 주입  
  - Docs: https://docs.crewai.com/en/concepts/memory

- **Microsoft AutoGen — Memory protocol / RAG**
  - `Memory` 프로토콜(`query`, `add`, `update_context` 등)을 통해 단계 직전에 관련 사실을 context에 주입하는 패턴 제공  
  - Docs: https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html

- **LangGraph (LangChain) — State + Checkpointer 기반 공유 상태/지속성**
  - `thread_id`로 상태를 저장/복구, 체크포인터(Postgres 등)로 영속화, “time travel”/fault tolerance 지원  
  - Docs: https://docs.langchain.com/oss/python/langgraph/persistence  
  - Memory: https://docs.langchain.com/oss/python/langgraph/add-memory

- **Letta — Shared memory blocks(멀티 에이전트 공동 작업공간)**
  - 공유 memory block을 여러 에이전트에 붙이면, 한 에이전트가 업데이트한 내용이 다른 에이전트에 즉시 반영  
  - Tutorial: https://docs.letta.com/tutorials/shared-memory-blocks/

- **OpenAI Agents SDK — Session trimming/compression (컨텍스트 관리)**
  - 대화 히스토리 “트리밍(최근 N턴 유지)”과 “압축/요약”으로 비용/정확도/안정성 개선  
  - Cookbook: https://developers.openai.com/cookbook/examples/agents_sdk/session_memory/

---

### 1.3 논문/벤치마크(개념/평가 기준 확보)

- **MemGPT: Towards LLMs as Operating Systems** (가상 메모리/계층형 메모리 개념)  
  https://arxiv.org/abs/2310.08560

- **Generative Agents: Interactive Simulacra of Human Behavior** (경험 저장 → 반성(reflection) → 동적 retrieval로 계획)  
  https://arxiv.org/abs/2304.03442  
  코드(참고): https://github.com/joonspk-research/generative_agents

- **Reflexion: Language Agents with Verbal Reinforcement Learning** (에피소드 메모리에 반성문 저장 → 다음 시도 개선)  
  https://arxiv.org/abs/2303.11366

- **Memory in the Age of AI Agents** (2025~2026 서베이: 메모리 분류/벤치마크/프레임워크 정리)  
  https://arxiv.org/abs/2512.13564

- **MemoryArena** (2026.02: 멀티 세션에서 “기억과 행동의 결합”을 평가하는 벤치마크)  
  https://arxiv.org/abs/2602.16313

- **Blackboard 기반 멀티 에이전트(공유 메모리 패턴)**
  - bMAS/LbMAS: blackboard(공용 저장소)를 공유 메모리로 쓰고 에이전트가 모두 읽고/쓴다  
  - https://arxiv.org/html/2507.01701v1

---

## 2) 구현 목표 정의(요구사항)

### 2.1 기능 요구사항(Functional)
1. **Shared Memory**: 여러 에이전트(또는 여러 세션)가 동일한 메모리 공간을 읽고/쓴다.
2. **Persistence**: 세션/프로세스/디바이스가 바뀌어도 메모리가 유지된다.
3. **Versioning**: Git처럼 변경 이력(커밋), 롤백(checkout), 병렬 작업(브랜치/머지) 개념을 제공한다.
4. **Selective Recall**: 필요한 순간에 필요한 것만(retrieval) 컨텍스트로 주입한다(토큰 예산 준수).
5. **Share/Import**: 특정 “컨텍스트 스냅샷(또는 repo)”를 링크/파일/레포로 공유·가져오기 가능.
6. **Auditability**: “무슨 메모리를 왜 썼는지/어디서 왔는지” 추적 가능(로그/메타데이터).

### 2.2 비기능 요구사항(Non‑Functional)
- **보안/권한**: 공유 메모리의 범위(프로젝트/팀/개인)별 접근 제어(ACL), 민감정보 자동 마스킹.
- **동시성**: 여러 에이전트가 동시에 쓰더라도 충돌/손상이 없거나, 최소한 감지/해결 가능.
- **성능**: 조회는 빠르게(캐시/인덱스), 쓰기는 저렴하게(append/event).
- **품질**: 메모리 오염(잘못된 사실이 축적) 방지(검증/정정/defrag).

---

## 3) 아키텍처 선택 가이드(3가지 레일)

### 레일 A: File + Git 기반(추천: 가장 빠른 시작)
**적합한 경우**
- “코딩 에이전트/프로젝트 협업” 중심
- Git 인프라가 이미 있음(팀/CI)
- 운영 복잡도를 낮추고 싶음

**핵심 아이디어**
- 메모리를 `memory/` 폴더(마크다운 + frontmatter)로 저장
- 에이전트가 파일을 수정하면 `git commit`으로 버전화
- 공유는 `git remote` 또는 “스냅샷 zip / 링크”로 해결

**참고 구현**: ctx, Letta MemFS, (컨셉) OneContext

---

### 레일 B: 중앙 Memory Service(DB + Vector Search + ACL)
**적합한 경우**
- 사용자/프로젝트 수가 많고, 에이전트가 많아져도 안정적으로 운영해야 함
- 실시간 공유(팀/다중 에이전트) + 권한 + 감사 로그가 중요
- 링크 공유 시 만료/권한 부여/감사 등이 필요

**핵심 아이디어**
- Memory API 서버: `add`, `query`, `commit`, `checkout`, `share` 등 제공
- 저장소(권장):
  - 구조화 메타: Postgres
  - 검색: pgvector(하이브리드 BM25+vector 가능)
  - 원본: S3/FS
  - 캐시: Redis(선택)
- 버전 관리: event-sourcing 또는 commit graph를 DB로 모델링

---

### 레일 C: 프레임워크 내장 메모리(빠른 도입)
**적합한 경우**
- 이미 CrewAI/AutoGen/LangGraph/Letta 중 하나를 주 프레임워크로 사용 중
- “먼저 돌아가게 만들고” 점진적으로 고도화하려는 경우

**주의**
- 프레임워크 메모리는 “공유/영속/버전 관리”가 제한적일 수 있음 → 레일 A/B와 혼합 권장

---

## 4) 표준 데이터 모델(권장)

### 4.1 메모리 엔트리(MemoryItem) 스키마
- `id`: UUID
- `namespace`: 예) `/shared/project`, `/agent/{agent_id}`, `/team/{team_id}`, `/user/{user_id}`
- `type`: `fact | decision | task | learning | artifact | message | summary`
- `content`: 원문(마크다운 권장)
- `source`: `(agent_name, tool_name, url, file_path, commit_hash, session_id 등)`
- `timestamp`: ISO8601
- `tags`: 키워드/토픽
- `importance`: 0~1 (또는 1~5)
- `ttl`(optional): 만료
- `embedding`(optional): semantic search용

### 4.2 버전 관리 모델(Commit Graph)
- `commit_id`
- `parents[]`
- `author`(agent/human)
- `message`(요약)
- `diff`(파일 기반이면 git diff, DB면 change-set)
- `snapshot_ref`(스냅샷 위치)

---

## 5) “Git처럼” 동작하는 메모리 오퍼레이션 정의

### 5.1 최소 커맨드/툴 API
- `memory.add(item)` : 사실/결정/학습 추가(append)
- `memory.query(q, namespace, k, filters)` : 검색(키워드+벡터)
- `memory.commit(message)` : 변경 확정(버전 생성)
- `memory.checkout(commit_id)` : 특정 시점으로 복원(롤백/재현)
- `memory.branch(name)` : 병렬 작업 공간
- `memory.merge(branch_a, branch_b, strategy)` : 머지 + 충돌 해결
- `memory.summarize(scope, budget)` : 컨텍스트 패킷 생성(토큰 예산 기반)
- `memory.share(ref, policy)` : 링크/토큰 기반 공유(만료/권한)

### 5.2 충돌(Conflict) 처리 전략
- 텍스트 충돌: git 3-way merge + conflict markers → “conflict-resolver agent”로 해결(blackboard 논문 패턴 활용)
- 사실 충돌: `fact`는 최신값 우선이 아니라 **근거/출처 기반**으로 병렬 보관 후 “정정 엔트리(Errata)”로 해결

---

## 6) 통합 설계(Agent 프로그램에 붙이는 방법)

### 6.1 에이전트가 메모리를 쓰는 시점(Write Policy)
- 태스크 완료 시: 결과에서 **“재사용 가능한 사실/결정/교훈”** 만 추출하여 저장  
  - (참고) CrewAI는 태스크 출력에서 discrete facts를 추출해 저장하는 흐름을 제공  
- 에러/실패 시: Reflexion처럼 “반성/회고”를 에피소드 메모리에 저장
- 중요한 의사결정 시: ADR 형태(결정/근거/대안/영향)를 별도 타입으로 저장

### 6.2 에이전트가 메모리를 읽는 시점(Read/Recall Policy)
- 태스크 시작 전: `query`로 관련 메모리 top‑k를 가져와 system/developer prompt에 주입
- 긴 대화/다중 툴 실행 시: OpenAI Agents SDK의 trimming+compression을 적용해 “최근 턴 + 요약”으로 컨텍스트를 안정화

### 6.3 공유 범위(Namespaces)
- `/shared/project`: 프로젝트 공용
- `/agent/<id>`: 개인 에이전트만
- `/team/<id>`: 팀 단위 공유
- `/user/<id>`: 유저별 개인화(선호/제약)

---

## 7) 구현 작업 계획(WBS)

아래는 “레일 A(파일+git) → 레일 B(서비스)”로 점진 고도화하는 기본 플랜이다.  
(이미 CrewAI/AutoGen/LangGraph/Letta를 쓰면 레일 C 단계를 중간에 삽입)

### Phase 0 — 리서치/스파이크(짧은 단위로 쪼개서 수행)
**목표**: 우리 시스템에 가장 잘 맞는 레일(A/B/C) 결정 + PoC 범위 확정

#### 0-A. 레퍼런스 재현(실제 돌려보기)
- [ ] 유튜브 영상에서 말하는 기능/요구사항을 **체크리스트로 추출**(예: 공유 링크, 세션 resume, 컨텍스트 요약, multi-agent 동시 작업)

- [ ] OneContext / ctx / OpenContext 중 최소 1개는 **직접 설치/사용**해서 UX를 체감
- [ ] Letta Code(MemFS) 또는 Letta shared memory blocks 문서 정독(“git-backed 메모리”/“공유 블록” 개념)

#### 0-B. 우리 코드베이스 분석
- [ ] 에이전트 오케스트레이션 구조(멀티 에이전트 vs 단일)
- [ ] 세션/로그 저장 방식(없으면 반드시 추가)
- [ ] 모델/툴 호출 방식(OpenAI Agents SDK / LangChain / 자체 등)
- [ ] 보안 요구사항(프로젝트/팀/개인 범위)

#### 0-C. PoC 요구사항 5개 확정(예시)
- [ ] 에이전트 2개가 동일 project memory 공유
- [ ] 세션 재시작 후 “이전 결정”을 자동으로 회수/주입
- [ ] 롤백(checkout)으로 “잘못된 메모리”를 되돌릴 수 있음
- [ ] 컨텍스트 패킷을 토큰 예산 4k로 생성
- [ ] 공유(파일/레포)로 다른 환경에서 import 가능

**산출물**
- `decision.md`: 레일 선택 + 이유 + PoC 스코프
- `risk.md`: 메모리 오염/보안/동시성 리스크와 완화책

---

### Phase 1 — PoC: File+Git 기반 Shared Memory(권장 시작점)
**목표**: 가장 단순한 형태로 “공유 + 지속 + 재주입”을 구현

1) **프로젝트에 memory repo 구조 생성**
- [ ] `memory/` 디렉터리 생성 및 git init(혹은 기존 repo에 포함)
- [ ] 아래 템플릿 파일 생성(최소):
  - `memory/system/project.md` : 프로젝트 개요/목표/제약(중요 → 항상 주입)
  - `memory/system/conventions.md` : 코딩/아키텍처 컨벤션
  - `memory/decisions/ADR-0001-....md`
  - `memory/learnings/....md`
  - `memory/tasks/....md`
  - `memory/sessions/YYYY-MM-DD-session-01.md` (에이전트 트래젝터리 요약)

2) **컨텍스트 패킷 생성기(context packer) 구현**
- [ ] 입력: `query`, `budget_tokens`, `namespaces`
- [ ] 출력: `context_packet.md` (요약 + top‑k 근거 링크/출처 포함)
- [ ] 규칙:
  - `memory/system/**` 파일은 항상 포함
  - 나머지는 검색/태그 기반으로 포함
  - budget 초과 시 요약(또는 상위만)

3) **Agent 런타임 통합**
- [ ] 에이전트가 작업 시작 전 `context_packet.md`를 읽고 프롬프트에 포함
- [ ] 작업 종료 후 “저장할 것”을 추출해 memory 파일에 반영
- [ ] 반영 후 `git commit`(자동화)

4) **멀티 에이전트 동시 작업(기본)**
- [ ] 에이전트별 브랜치 전략: `agent/<name>/<topic>`
- [ ] 머지는 사람이 또는 merge-agent가 수행

**검증 시나리오(필수)**
- [ ] Agent A가 “결정(ADR)” 저장 → Agent B가 새 세션에서 검색/주입으로 활용
- [ ] 잘못된 결정 저장 후 롤백(이전 커밋 checkout) 후 재실행

**산출물**
- PoC 데모 스크립트 + 샘플 memory repo + 간단한 README

---

### Phase 2 — 검색 품질 향상(벡터/하이브리드)
**목표**: “찾아야 할 메모리를 잘 찾는 것”이 성능의 핵심이므로 retrieval을 강화

- [ ] 임베딩 생성(로컬/서버) + 벡터 인덱스 구축(pgvector 추천)
- [ ] 하이브리드 검색(BM25 + vector) 적용
- [ ] 중요도/최근성/신뢰도 가중치 적용(예: CrewAI의 recency/semantic/importance weight 개념 참고)
- [ ] “요약/압축” 파이프라인 추가(컨텍스트 예산 유지)

**산출물**
- `memory_query.py` (CLI/모듈)
- 검색 평가 리포트(정확도/재현율 간이 측정)

---

### Phase 3 — 중앙 Memory Service(선택; 운영/팀 확장 시)
**목표**: 링크 공유/권한/감사/다중 프로젝트를 안정적으로 지원

- [ ] Memory API 서버 설계(OpenAPI):
  - `POST /memories`
  - `POST /query`
  - `POST /commit`
  - `POST /share`
  - `POST /checkout`
- [ ] ACL/tenant 분리(`/team`, `/project`, `/user`)
- [ ] 감사 로그(누가/언제/무엇을 read/write)
- [ ] 공유 링크: 만료/권한/레이트리밋

**산출물**
- `memory-service`(Docker) + `client SDK`

---

### Phase 4 — 품질 유지(Defrag / 정정 / 오염 방지)
**목표**: 메모리가 쌓일수록 “잘못된 사실 축적”이 가장 큰 위험

- [ ] 정정(Errata) 메커니즘: 잘못된 사실은 삭제보다 “정정 엔트리”로 교정
- [ ] Defrag 작업: 중복/모순/낡은 정보 정리(주기적 subagent)
- [ ] 회고(Reflection) 파이프라인: Reflexion 스타일의 실패/교훈 저장
- [ ] 컨텍스트 오염 감지(요약 편향/환각 유입) 체크리스트

---

### Phase 5 — 평가/벤치마킹(선택)
**목표**: “메모리가 실제로 성능을 올리는가?”를 정량 확인

- [ ] 내부 태스크 10개 정의(멀티 세션으로 이어지는 작업)
- [ ] MemoryArena 같은 멀티 세션 메모리‑행동 결합 벤치마크를 참고해 평가 항목 설계
- [ ] 지표:
  - 성공률(완료/오류)
  - 재작업 횟수(“다시 설명” 감소)
  - 토큰/비용(컨텍스트 주입 비용)
  - 회귀(메모리 오염으로 잘못된 행동)

---

## 8) 코드 스켈레톤(레일 A PoC 예시)

> 아래는 “우리 코드베이스가 파이썬 기반”이라는 가정의 예시다.  
> Node/TS 기반이면 동일한 개념으로 포팅한다.

### 8.1 메모리 디렉터리 템플릿
```text
memory/
  system/
    project.md
    conventions.md
  decisions/
    ADR-0001-architecture.md
  learnings/
    2026-02-19-mistake-foo.md
  tasks/
    2026-02-19-task-bar.md
  sessions/
    2026-02-19-session-01.md
  context_packet.md   # (생성물)
```

### 8.2 MemoryItem frontmatter 예시(결정/ADR)
```markdown
---
type: decision
id: ADR-0001
title: "Vector DB는 pgvector 사용"
status: accepted
date: 2026-02-19
tags: ["memory", "vector", "postgres"]
source:
  author: "agent:planner"
  session_id: "s-001"
---
## 결정
- pgvector를 사용한다.

## 근거
- 운영 단순성(기존 Postgres 활용)
- 하이브리드 검색 구성 용이

## 대안
- Weaviate / Pinecone

## 영향
- 마이그레이션/인덱싱 작업 필요
```

### 8.3 컨텍스트 패킷 생성기(의사코드)
```python
def build_context_packet(query: str, budget_tokens: int) -> str:
    always = read_all("memory/system/**/*.md")
    candidates = search_hybrid(query, in_paths=["memory/decisions", "memory/learnings", "memory/tasks"])
    ranked = rerank(always + candidates)
    packed = pack_to_budget(ranked, budget_tokens)
    return render_markdown(packed)
```

### 8.4 저장(Write) 파이프라인(권장)
```python
def persist_after_task(task_output: str):
    facts = extract_reusable_facts(task_output)   # LLM or rule-based
    for f in facts:
        write_md_file(f, folder="memory/learnings")
    git_commit("memory: add learnings from task")
```

---

## 9) 프레임워크별 “빠른 적용” 코드 조각(참고)

> 아래 코드는 “개념 도입을 빠르게 이해하기 위한 최소 예시”다.  
> 실제 적용 시 버전/의존성/실행 방식은 각 프로젝트에 맞춰 조정한다.

### 9.1 CrewAI: 공유 메모리 켜기
```python
from crewai import Crew, Memory

memory = Memory()
crew = Crew(
    agents=[...],
    tasks=[...],
    memory=memory,   # 또는 memory=True
)
```

### 9.2 AutoGen: ListMemory로 간단한 메모리 뱅크
```python
from autogen_core.memory import ListMemory, MemoryContent, MemoryMimeType

user_memory = ListMemory()
await user_memory.add(
    MemoryContent(content="단위는 metric으로 답변", mime_type=MemoryMimeType.TEXT)
)
```

### 9.3 LangGraph: thread_id + Postgres checkpointer로 상태 영속화
```python
from langgraph.checkpoint.postgres import PostgresSaver

DB_URI = "postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable"
with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    graph = builder.compile(checkpointer=checkpointer)
    graph.invoke(
        {"messages": [{"role": "user", "content": "hi!"}]},
        {"configurable": {"thread_id": "1"}},
    )
```

### 9.4 Letta: shared memory block 생성 후 여러 에이전트에 붙이기(개념)
```python
from letta_client import Letta
client = Letta(api_key="...")

block = client.blocks.create(label="organization", value="Organization: ACME", limit=4000)
# block.id 를 여러 agent에 attach 해서 공동 작업공간으로 사용
```

---

## 10) 보안/운영 체크리스트(최소)

- [ ] 메모리에 저장되는 데이터 분류(PII/비밀키/내부정보) 정의
- [ ] 저장 전 마스킹/필터링 룰(예: API 키/토큰 정규식)
- [ ] 공유 링크에 만료/권한/감사 로그 적용(레일 B 권장)
- [ ] “정정/삭제” 정책(법/정책 준수)
- [ ] 백업/복구 전략(레일 A: git remote, 레일 B: DB backup)

---

## 11) Done 정의(완료 기준)

최소 완료(MVP) 기준:
- [ ] 2개 이상의 에이전트가 `/shared/project` 메모리를 공유한다.
- [ ] 세션 종료 후 재시작해도 이전 결정/학습이 자동으로 주입되어 **같은 실수 반복이 줄어든다**.
- [ ] 메모리 변경은 버전화되어 롤백 가능하다.
- [ ] 컨텍스트 패킷이 토큰 예산 내에서 생성된다.
- [ ] 공유 범위/권한 정책(최소한 “프로젝트 내부만”)이 문서화되어 있다.

---

## 12) 부록: “바로 해보기” 체크리스트(30분)

1) `memory/` 폴더 만들고 기본 파일 2개 작성
2) 에이전트 시작 시 `context_packet.md`를 읽어 system prompt에 포함
3) 태스크 종료 시 “사실/결정/학습”을 1개 이상 `memory/`에 기록
4) git commit으로 버전화
5) 다른 에이전트(또는 새 세션)에서 query로 해당 항목을 찾아 주입
