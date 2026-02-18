# AgentCanvas Quick Read

AgentCanvas는 VS Code 확장으로 멀티 에이전트 설계를 캔버스에서 시각적으로 구성하고 운영할 수 있도록 만든 도구입니다.

## 핵심 기능
- n8n 스타일 Canvas UI
- Agent 노드 생성/수정/삭제
- Agent Role/Delegation(Orchestrator -> Worker) 설정
- Skill/MCP 드래그 앤 드롭 할당
- Common Rule 관리
- AI Prompt 기반 팀 자동 생성(Claude/Gemini/Codex/Aider/Custom)
- Interaction Pattern 라이브러리(20개) 삽입
- Flow 저장/로드: `.agentcanvas/flows/*.yaml`
- Interaction 이벤트 로그: `.agentcanvas/logs/<flow>/<date>.jsonl`

## 실행 방법
```bash
npm install
npm --prefix webview-ui install
npm run check
```

VS Code에서:
1. 이 폴더 열기
2. `F5`로 Extension Development Host 실행
3. 명령 팔레트에서 `AgentCanvas: Open`

## 통합 테스트
```bash
npm run test:integration
```

현재 통합 테스트는 다음 시나리오를 검증합니다.
- 빌드/타입체크
- 패턴 문서/템플릿 정합성
- Prompt 파서/히스토리
- Agent 프로필 CRUD
- CLI 백엔드 감지
- Flow 저장/로드
- Interaction 로그 기록

## 참고 문서
- `README.md`
- `INTEGRATION_TEST_SCENARIOS.md`
- `AGENT_SYSTEM.md`
- `PROMPT_TO_AGENTS.md`
- `agent communication.md`
