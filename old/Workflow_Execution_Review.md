# Workflow 및 병렬 처리 진행 로직 검토 결과

프론트엔드 UI의 노드 그래프 연결(Edges) 및 워크플랜(Work Plan)의 종속성이 수정한 병렬 루프에서 논리적으로 올바르게 동작하는지 소스 코드를 심층 분석한 결과입니다.

## 1. 워크플로우 종속성(Dependencies) 분석: 🟢 정상
사용자가 GraphView나 Chat을 통해 구성한 워크플로우(A -> B 형태의 태스크 파이프라인)는 백엔드에서 정상적으로 존중되며 스케줄링되고 있습니다.

* **동작 원리**: 
  1. `buildTasksFromFlow` 및 `buildTasksFromWorkPlan` 함수에서 이전 노드(Edge Source)를 `task.deps` 배열에 ID 형태로 정확히 매핑하여 부여합니다.
  2. 병렬 루프 내부에서 `readyTasks` 필터링 시 `task.deps.every((depId) => statusById.get(depId) === "done")` 구문을 통과해야만 다음 루프로 진입합니다.
* **결론**: **선행 태스크가 완료(`done`)되지 않으면 후행 태스크는 절대 비동기 파이프라인(in-flight)으로 진입하지 않으므로, 워크플로우 파이프라인 순서는 완벽하게 보장됩니다.**

---

## 2. 병렬 루프의 조기 종료(Early Termination) 버그: 🔴 수정 필요

의존성대로 순서는 잘 지켜지지만, **병렬로 실행 중인 태스크들 중 하나가 실패(Failure)하거나 사용자가 강제 중지(Stop)를 눌렀을 때** 치명적인 생명 주기(Lifecycle) 누수가 발생합니다.

### 🐛 문제 상황 (Dangling Background Tasks)
기존 구조를 비동기 IIFE (`void (async () => { ... })()`)로 변경하면서 태스크들이 백그라운드 스레드에서 돌아가게 되었습니다. 하지만, 메인 `while(true)` 루프의 에러 감지 및 중지 조건은 현재 다음과 같이 작성되어 있습니다.

```typescript
// 1. 강제 중지 시
if (stopped) {
  // ... 남은 태스크 cancel 처리 후 ...
  break; // 🚨 IIFE 종료를 기다리지 않고 루프 즉시 탈출
}

// 2. 태스크 실패 시 
const hasFailure = tasks.some((task) => task.status === "failed");
if (hasFailure) {
  failedMessage = "One or more tasks failed";
  break; // 🚨 IIFE 종료를 기다리지 않고 루프 즉시 탈출
}
```

### 💣 파급 효과 (Side Effects)
가령 3개의 태스크(A, B, C)가 병렬로 처리 중이라 가정해 보겠습니다.
1. A 태스크에서 에러가 발생하여 `status: "failed"`가 됩니다.
2. 다음 500ms Tick에 Main 루프가 `hasFailure`를 감지하고 즉시 `break` 하여 루프를 탈출합니다.
3. 이로 인해 이 실행(Run)은 `finishRun`이 호출되어 UI 상으로는 완전히 종료된 것으로 처리됩니다.
4. **문제는 B와 C 태스크의 IIFE는 아직 Background에서 남아서 계속 실행 중이라는 점입니다.**
5. B, C가 뒤늦게 완료되어 이미 끝난 상태의 `App.tsx`나 DB에 이벤트를 전송하게 되며, 이는 무거운 모델 구동 자원(토큰/메모리)을 낭비하게 되고 예상치 못한 런타임 충돌이나 상태 꼬임(Data Corruption)을 유발할 수 있습니다.

---

## 3. 🛠 개선 솔루션 제안

루프를 아예 빠져나가기(`break`) 전에, 남은 워크플로우 태스크들을 모두 취소(Canceled) 상태로 돌린 뒤, **`inFlightTaskIds.size === 0`이 될 때까지 대기(Wait)하는 로직**으로 변경해야 합니다.

`src/extension/extension.ts`의 메인 루프를 다음 논리로 리팩토링하시길 권장드립니다:

**수정 방향 (가이드)**:
```typescript
// 에러나 중지가 감지되었다면,
// 1. 아직 시작 안 한 planned/ready 태스크만 전부 canceled 처리
// 2. 즉시 break 하지 않고 대기!

if (stopped || hasFailure) {
  const currentTasks = this.scheduleService.getTasks(input.runId);
  for (const task of currentTasks) {
    if (task.status === "planned" || task.status === "ready") {
      this.scheduleService.patchTask(input.runId, task.id, {
        status: "canceled",
        actualEndMs: Date.now()
      });
    }
  }
  this.scheduleService.recompute(input.runId);
  
  // 🔥 핵심: 아직 In-flight 중인 태스크가 남아있다면 break 하지 않고 루프를 계속 돌게 둠
  if (inFlightTaskIds.size > 0) {
    await sleep(idlePollMs);
    continue;
  } else {
    // 모든 백그라운드 작업이 끝났을 때 비로소 루프 탈출
    break;
  }
}
```
위와 같이 수정하시면 병렬로 여러 에이전트가 돌아가는 중단/에러 상황에서도 백그라운드 프로세스가 안정적으로 수습된 후 안전하게 세션이 종료(Graceful Shutdown)되게 됩니다. 

정리하자면 워크플로우 순서 자체는 아주 훌륭하게 설계되어 동작 중이며, 조기 종료 시의 생명주기(Lifecycle) 핸들링만 보강하시면 됩니다!
