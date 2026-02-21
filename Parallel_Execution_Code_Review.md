# Parallel Execution Code Review

작성하신 `extension.ts`의 병렬 처리 리팩토링(Parallel Execution) 내역을 분석한 결과입니다. 비동기 IIFE(즉시 실행 함수)를 활용한 논블로킹 실행 구조는 논리적으로 훌륭하게 설계되었으나, 로버스트함(Robustness)을 위해 한 가지 확실한 수정이 필요한 버그가 존재합니다.

## 1. 훌륭한 구현 내용 (Good Improvements)
* **Fire-and-forget 비동기 파이프라인**: 성능을 저하시키던 가장 큰 원인인 `await executeCliPrompt(...)`의 블로킹을 해소하고, `void (async () => { ... })()`를 통해 태스크를 백그라운드로 밀어낸 판단은 정확합니다.
* **`inFlightTaskIds` Set 추적**: 여러 태스크가 병렬로 전개될 때, `allFinished` 상태가 일찍 트리거되거나 루프가 스톨(Stall)로 착각하는 경우를 막기 위해 In-flight Task를 추적한 것은 완성도 높은 동시성 컨트롤 방식입니다.
* **이벤트 루프 양보 (Yield)**: 루프 하단에 배치된 `await sleep(idlePollMs)`는 실행 중인 다른 비동기 Promise들이 Main Thread를 점유하며 진행될 수 있게 만들어 줍니다.

---

## 2. 발견된 문제점 및 버그 (Bugs to Fix)

### [Critical] 예외 발생 시 상태 전이(State Transition) 누락
가장 치명적인 문제점은 백그라운드 스레드로 던져진 IIFE 내부에서 Unhandled Exception이 내부에 구축된 `try / catch / finally` 블록 중 `catch`로 떨어질 때 발생합니다.

기존 코드는 3670번째 줄 부근에서 에러 로그(`proposal_failed` 이벤트)만 남긴 후 리턴합니다.
```typescript
} catch (error) {
  await appendRunEvent({
    // ... run_log: proposal_failed 만 추가 ...
  });
}
```

이렇게 끝날 경우 다음과 같은 치명적인 상태 데드락에 빠집니다.
1. `finally` 블록이 실행되면서 `inFlightTaskIds.delete(nextTask.id)`가 호출됩니다.
2. 하지만 **해당 태스크의 상태는 `ScheduleService` 측면에서 영원히 `"running"` 상태**로 남게 됩니다.
3. 바깥쪽 `while(true)` 루프는 `tasks.some(task => task.status === "failed")` 검사 시 실패한 태스크가 없다고 판단합니다.
4. `inFlightTaskIds.size === 0`이 되므로, 스톨 디텍터(Stall Detector)가 비정상적으로 발동하여 10초 후에 전체 Run을 **"Run stalled: unresolved dependencies"** 에러로 강제 종료시킵니다.
5. 유저는 **실제 발생한 에러를 알지 못한 채 원인 불명의 Stall 에러를 보게 됩니다.**

**🛠 빠른 해결 방안 (Hotfix):**
`catch` 블록 안에 스케줄 서비스(ScheduleService)의 상태 업데이트 로직과 `failedMessage` 설정 코드를 넣어주어야 합니다.

```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  // 1. 전체 실행 루프 중지 신호를 위해 외부 변수 할당
  failedMessage = errorMessage; 
  
  // 2. ScheduleService에 태스크 실패 사실 보고
  this.scheduleService.patchTask(input.runId, nextTask.id, {
    status: "failed",
    actualEndMs: Date.now(),
    blocker: {
      kind: "error",
      message: errorMessage
    }
  });
  this.scheduleService.recompute(input.runId);

  // 3. 기존 이벤트 로깅 이어서 진행
  await appendRunEvent({
    workspaceRoot,
    flowName: input.flowName,
    event: {
      ts: Date.now(),
      flow: input.flowName,
      runId: input.runId,
      type: "run_log",
      message: "proposal_failed",
      meta: {
        agentId: proposalAgentId,
        error: errorMessage
      }
    }
  });
}
```

---

## 3. 향후 개선 검토 사항 (Future Improvements)

* **병렬 실행 제한 (Concurrency Rate Limiting)**
  현재 구조상 의존성(Dependencies)이 없는 `ready` 태스크라면 무한히 전부 동시에 시작해버립니다. OpenAI나 Anthropic API를 쓰신다면 크게 문제 되지 않겠지만, 만약 Local LLM(Ollama 등)을 붙인 Agent 여러 개가 동시에 무거운 모델 연산을 시도하면 로컬 시스템 런타임에 큰 오버헤드가 발생할 수 있습니다. 
  향후 스케줄러 내부에 Semaphore나 Rate Limiter 등을 붙여서 동시 실행 개수를 `agentConcurrency` Config 값 등으로 통제하는 옵션을 추가하는 것이 좋습니다.
