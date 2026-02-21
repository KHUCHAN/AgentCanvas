# Open Claw Task Execution Analysis

## 1. UI Sync Issue: Tasks Not Reflecting in Kanban/Schedule
**문제점:** `ChatPanel`에서 사용자가 "Start Work Plan"을 클릭하여 태스크 실행을 확정(`confirmChatPlan`)할 때, 백엔드 서버(익스텐션)에서는 태스크가 정상적으로 실행되고 상태가 변하지만, 프론트엔드 UI(Kanban 및 Schedule)에서는 업데이트가 실시간으로 반영되지 않는 현상이 발생합니다.

**원인 분석:** 
- Open Claw의 아키텍처는 태스크 상태 수신을 위해 각 Run 단위로 웹소켓 구독(Subscription) 방식을 사용합니다 (`SCHEDULE_SUBSCRIBE` 이벤트).
- `TaskPanel` 쪽에서 직접 작업을 실행(`runFlowFromPanel`)하는 경우에는 UI가 리턴받은 `runId`를 이용해 `subscribeScheduleRun(result.runId)` 함수를 호출하여 정상적으로 상태 변경(TaskEvent)을 수신합니다.
- 그러나 **채팅 패널에서 계획을 확정한 경우(`confirmChatPlan` 함수)**, 익스텐션으로 `WORK_PLAN_CONFIRM` 메시지를 전송하기만 하고, 응답으로 돌아온 `runId`를 사용해 스케줄 이벤트 구독(`subscribeScheduleRun`)을 호출하는 로직이 누락되어 있습니다. 이로 인해 백엔드는 돌아가고 있지만 프론트엔드는 업데이트를 받지 못합니다.

**해결 방안:**
`webview-ui/src/App.tsx`의 `confirmChatPlan` 함수 안에 이벤트 리스너 구독 로직을 추가해야 합니다.
```typescript
const confirmChatPlan = async (planId: string) => {
  const result = await requestToExtension<{ runId: string }>({
    type: "WORK_PLAN_CONFIRM",
    payload: { planId }
  });
  setCanvasMode("kanban");
  // ... 생략 ...
  if (result.runId) {
    setActiveRunId(result.runId);
    setSelectedRunId(result.runId);
    await subscribeScheduleRun(result.runId); // <-- 누락된 구독 로직 추가
  }
};
```

---

## 2. Parallel Processing Issue: 태스크가 병렬적으로 처리되지 않는 현상
**문제점:** 여러 에이전트에게 할당된 독립적인 태스크들이라도 동시에 병렬로(Parallel) 실행되지 않고 무조건 하나씩 직렬로(Sequential) 실행되는 현상입니다.

**원인 분석:**
- `extension/src/extension.ts`의 메인 실행 루프인 `executeRunLoop` 함수를 살펴보면, 코드가 단일 `while(true)` 루프로 작성되어 있습니다.
- 루프 안에서 **종속성(Dependencies)이 해결된 단 1개의 태스크만 찾아서(`tasks.find(...)`)** 실행을 지시합니다.
- 실행 지시 후 `await executeCliPrompt(...)` 코드를 만나면서 해당 태스크가 **완벽히 끝날 때까지 전체 실행 루프(Thread)가 블로킹(Blocking)**됩니다.
- 한 태스크가 10분이 걸린다면, 그 10분 동안 루프가 멈춰있기 때문에 다른 시작 가능한 태스크가 있더라도 다음 루프로 진입하여 평가를 진행하지 못합니다. 즉, 구조적으로 병렬 처리를 지원하지 않는 상태입니다.

**해결 방안:**
이 문제를 근본적으로 해결하려면 `executeRunLoop`를 비동기 이벤트 기반의 태스크 매니저로 리팩토링해야 합니다.
1. **Fire and Forget 방식**: `await executeCliPrompt`를 기다리지 않고 `Promise` 형태로 백그라운드 스레드로 던진 다음, `while` 루프는 곧바로 다음 `nextTask`를 찾도록 해야 합니다.
2. **이벤트 드리븐 상태 처리**: 백그라운드로 실행 중인 태스크가 끝났을 때 콜백이나 이벤트를 발생시켜 `TaskEvent(status: "done")`을 발생시키고 `this.scheduleService.recompute(runId)`를 호출하게 하여 새로운 종속성 해결을 트리거해야 합니다.

*현재 태스크 실행 엔진의 핵심 구조를 뜯어고치는 Major 업데이트가 필요하며, 당장 가벼운 버그 수정이 아닌 워크플로우 엔진의 리빌딩 스코프입니다.*
