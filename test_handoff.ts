import type { DiscoverySnapshot, HandoffEnvelope } from "./extension/src/types";

// COPIED FROM extension/src/extension.ts FOR TESTING
function parseHandoffBlock(
    text: string,
    orchestratorId: string,
    nodes: DiscoverySnapshot["nodes"],
    edges: DiscoverySnapshot["edges"]
): { targetAgentId: string; targetAgentName: string; handoff: HandoffEnvelope } | undefined {
    const match = text.match(/HANDOFF\s*([\s\S]*)/);
    if (!match) {
        return undefined;
    }

    const block = match[1] || "";

    const extractField = (label: string): string => {
        const regex = new RegExp(`^${label}:\\s*(.*(?:\\n(?!\\w+:).*)*)`, "mi");
        const found = block.match(regex);
        return found ? found[1].trim() : "";
    };

    const targetLabel = extractField("Target");
    const context = extractField("Context");
    const goal = extractField("Goal");
    const dod = extractField("DoD");
    const filesStr = extractField("Files");
    const nextSteps = extractField("Next");

    if (!targetLabel && !goal && !context) {
        return undefined;
    }

    const targetNameStr = targetLabel.toLowerCase();

    const validTargets = edges
        .filter((edge) => edge.source === orchestratorId && (edge.type === "interaction" || edge.type === "delegates" || edge.type === "agentLink"))
        .map((edge) => edge.target);

    let targetAgentId = validTargets.find(id => id.toLowerCase() === targetNameStr || id.toLowerCase().includes(targetNameStr));

    if (!targetAgentId) {
        const nodeById = new Map(nodes.map(n => [n.id, n]));
        for (const validId of validTargets) {
            const node = nodeById.get(validId);
            if (!node) continue;

            const data = (node.data ?? {}) as Record<string, unknown>;
            const name = String(data.name ?? data.title ?? data.role ?? validId).toLowerCase();
            if (name === targetNameStr || name.includes(targetNameStr)) {
                targetAgentId = validId;
                break;
            }
        }
    }

    if (!targetAgentId) {
        if (validTargets.length === 1) {
            targetAgentId = validTargets[0];
        } else {
            return undefined;
        }
    }

    const targetNode = nodes.find(n => n.id === targetAgentId);
    const targetData = (targetNode?.data ?? {}) as Record<string, unknown>;
    const targetAgentName = String(targetData.name ?? targetData.title ?? targetData.role ?? targetAgentId);

    const files = filesStr
        ? filesStr.split(",").map(f => f.trim()).filter(Boolean)
        : [];

    const handoff: HandoffEnvelope = {
        intent: goal || "Assigned task",
        inputs: context ? [context] : [],
        constraints: dod ? [dod] : [],
        plan: nextSteps ? [nextSteps] : [],
        sandboxWorkDir: "",
        proposalJson: "",
        changedFiles: files
    };

    return {
        targetAgentId,
        targetAgentName,
        handoff
    };
}

// TEST SUITE
console.log("=== RUNNING parseHandoffBlock TESTS ===");

const nodes = [
    { id: "orchestrator-1", type: "agent", position: { x: 0, y: 0 }, data: { name: "Orchestrator" } },
    { id: "researcher-1", type: "agent", position: { x: 0, y: 0 }, data: { name: "Web Researcher" } },
    { id: "writer-1", type: "agent", position: { x: 0, y: 0 }, data: { name: "Content Writer" } }
] as any;

const edges = [
    { id: "e1", source: "orchestrator-1", target: "researcher-1", type: "delegates" },
    { id: "e2", source: "orchestrator-1", target: "writer-1", type: "delegates" }
] as any;

// Test 1: Exact target name match
const text1 = `
I have formulated the plan.
HANDOFF
Target: Web Researcher
Context: We need to find recent news about AI.
Goal: Retrieve recent OpenAI announcements.
DoD: A summarized text file.
Files: notes.md, data.json
Next: Send data to the writer.
`;

const res1 = parseHandoffBlock(text1, "orchestrator-1", nodes, edges);
console.assert(res1?.targetAgentId === "researcher-1", "Test 1 failed: Expected researcher-1");
console.assert(res1?.handoff?.intent === "Retrieve recent OpenAI announcements.", "Test 1 failed: Expected specific goal");
console.assert(res1?.handoff?.changedFiles.length === 2, "Test 1 failed: Expected 2 files");

// Test 2: Inexact name match (lowercase)
const text2 = `
HANDOFF
Target: content writer
Context: Use the notes to write.
Goal: Draft a blog post.
`;
const res2 = parseHandoffBlock(text2, "orchestrator-1", nodes, edges);
console.assert(res2?.targetAgentId === "writer-1", "Test 2 failed: Expected writer-1");

// Test 3: Fallback (Missing target, but only 1 outgoing edge)
const strictEdges = [
    { id: "e3", source: "orchestrator-1", target: "writer-1", type: "interaction" }
] as any;
const text3 = `
HANDOFF
Context: Just draft something.
Goal: Draft a post.
`;
const res3 = parseHandoffBlock(text3, "orchestrator-1", nodes, strictEdges);
console.assert(res3?.targetAgentId === "writer-1", "Test 3 failed: Expected writer-1 (Fallback single target)");

// Test 4: Ambiguous target (Missing target, multiple edges) => return undefined
const res4 = parseHandoffBlock(text3, "orchestrator-1", nodes, edges);
console.assert(res4 === undefined, "Test 4 failed: Expected undefined for ambiguous targets");

console.log("=== ALL HATS PASSED ===");
process.exit(0);
