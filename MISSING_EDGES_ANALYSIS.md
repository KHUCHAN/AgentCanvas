# Missing Delegation Edges Analysis

## Problem Overview
During the "Build Team" flow, the user inputs a prompt to auto-generate a team of agents. While the agent profiles (JSON files) are successfully created and appear on the graph canvas, the visual **delegation edges** connecting the Orchestrator agent to its Worker agents are missing.

## Root Cause Analysis
The issue stems from a state-caching bug within the `applyGeneratedStructure` function in `extension/src/extension.ts`. The process of applying a generated structure is divided into multiple phases that sequentially update the new agents' properties. Because the function mutates the agent state across several asynchronous steps but fails to keep its in-memory cache synchronized with the file system, the delegation links are inadvertently overwritten and erased.

### Detailed Breakdown of the Bug

1. **Phase 1 (Creation):** 
   Agents are instantiated and saved to disk. An in-memory Map named `createdBySourceName` caches these newly created `AgentProfile` objects. At this point, the `delegatesTo` array for all agents is naturally empty.
   
2. **Phase 2 (Delegation Assignment):** 
   The function identifies `orchestrator` agents and determines their associated workers. It calls `setAgentDelegation` to assign these workers. `setAgentDelegation` correctly updates the profile and saves the populated `delegatesTo` array to the file system. 
   **The Bug:** The updated `AgentProfile` returned by `setAgentDelegation` is discarded. The `createdBySourceName` cache still holds the original agent profile where `delegatesTo` is empty.

3. **Phase 3 & 4 (Skills and MCP Assignment):** 
   The function assigns suggested Skills and MCP servers to the agents. It retrieves the target agent from the stale `createdBySourceName` map. When it calls `assignSkillToAgent` or `assignMcpToAgent`, these functions merge the new capabilities into the furnished profile and write the result back to disk.
   **The Consequence:** Because the profile passed to these functions is the stale version from Phase 1, it overwrites the JSON file on disk, effectively erasing the `delegatesTo` array that was carefully saved during Phase 2.

4. **Canvas Refresh:**
   Finally, when `refreshState` is called and `discovery.ts` reads the agents from disk to build the graph, the `delegatesTo` fields are empty. Consequently, `ReactFlow` does not receive any `StudioEdge` objects of type `delegates`, resulting in the missing visual connections.

## The Fix
The solution involves capturing the updated `AgentProfile` returned by all state-mutating service functions and updating the `createdBySourceName` map immediately. 

Modifications made in `extension/src/extension.ts`:
- **Phase 2:** Added `const updatedOrchestrator = await setAgentDelegation(...)` and `createdBySourceName.set(..., updatedOrchestrator);`.
- **Phase 3:** Added `const updatedOwner = await assignSkillToAgent(...)` and `createdBySourceName.set(..., updatedOwner);`.
- **Phase 4:** Changed `const targetAgent` to `let targetAgent`, captured the result of `assignSkillToAgent` and `assignMcpToAgent` into `targetAgent`, and updated the cache accordingly.

By ensuring the in-memory cache is continuously synchronized with the incremental changes, the `delegatesTo` array survives the subsequent phases and correctly renders as visual edges on the canvas.
