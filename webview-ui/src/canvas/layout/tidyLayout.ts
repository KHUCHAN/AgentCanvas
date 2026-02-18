import type { Edge, Node } from "reactflow";

type ScopeKey = "project" | "personal" | "shared" | "global" | "unknown";

const NODE_SIZE: Record<string, { w: number; h: number }> = {
  agent: { w: 230, h: 120 },
  provider: { w: 230, h: 140 },
  commonRules: { w: 320, h: 230 },
  ruleDoc: { w: 230, h: 150 },
  skill: { w: 230, h: 190 },
  folder: { w: 230, h: 140 },
  note: { w: 230, h: 220 }
};

const X = {
  agent: 90,
  provider: 360,
  rule: 360,
  skill: 680,
  folder: 520,
  note: 980
};

const GAP = {
  row: 24,
  column: 24,
  section: 46
};

export function applyTidyLayout(nodes: Node[], edges: Edge[]): Node[] {
  const nextNodes = nodes.map((node) => ({
    ...node,
    position: { x: node.position.x, y: node.position.y }
  }));
  const assignedNodeIds = new Set<string>();
  const pinnedNodeIds = new Set(
    nextNodes
      .filter((node) => Boolean((node.data as Record<string, unknown>)?.pinned))
      .map((node) => node.id)
  );

  const byId = new Map(nextNodes.map((node) => [node.id, node]));
  const agents = sortByTitle(nextNodes.filter((node) => node.type === "agent" && !pinnedNodeIds.has(node.id)));
  const providers = sortByTitle(nextNodes.filter((node) => node.type === "provider" && !pinnedNodeIds.has(node.id)));
  const rules = nextNodes.filter((node) => node.type === "ruleDoc" && !pinnedNodeIds.has(node.id));
  const skills = nextNodes.filter((node) => node.type === "skill" && !pinnedNodeIds.has(node.id));
  const folders = sortByTitle(nextNodes.filter((node) => node.type === "folder" && !pinnedNodeIds.has(node.id)));
  const notes = nextNodes.filter((node) => node.type === "note" && !pinnedNodeIds.has(node.id));

  let agentY = 80;
  for (const agent of agents) {
    setNodePosition(agent, X.agent, agentY, assignedNodeIds);
    agentY += sizeOf(agent).h + GAP.section;
  }

  let providerY = 80;
  for (const provider of providers) {
    setNodePosition(provider, X.provider, providerY, assignedNodeIds);
    providerY += sizeOf(provider).h + GAP.section;
  }

  const skillsByProvider = new Map<string, Node[]>();
  for (const provider of providers) {
    const skillChildren = getChildrenByType(provider.id, "skill", edges, byId);
    skillsByProvider.set(provider.id, sortByTitle(skillChildren));
  }

  const rulesByProvider = new Map<string, Node[]>();
  for (const provider of providers) {
    const ruleChildren = getChildrenByType(provider.id, "ruleDoc", edges, byId).sort((left, right) => {
      const leftOrder = Number((left.data as Record<string, unknown>).orderIndex ?? 0);
      const rightOrder = Number((right.data as Record<string, unknown>).orderIndex ?? 0);
      return leftOrder - rightOrder;
    });
    rulesByProvider.set(provider.id, ruleChildren);
  }

  let fallbackRuleY = 80;
  for (const provider of providers) {
    const providerRules = rulesByProvider.get(provider.id) ?? [];
    let ruleY = provider.position.y + sizeOf(provider).h + GAP.row;
    if (providerRules.length === 0) {
      ruleY = fallbackRuleY;
    }

    for (const rule of providerRules) {
      setNodePosition(rule, X.rule, ruleY, assignedNodeIds);
      ruleY += sizeOf(rule).h + GAP.row;
    }

    fallbackRuleY = Math.max(fallbackRuleY, ruleY + GAP.section);
  }

  for (const provider of providers) {
    const providerSkills = skillsByProvider.get(provider.id) ?? [];
    const groups = groupByScope(providerSkills);
    let groupStartY = provider.position.y;
    const scopes: ScopeKey[] = ["project", "personal", "shared", "global", "unknown"];

    for (const scope of scopes) {
      const scopedSkills = groups[scope];
      if (!scopedSkills.length) {
        continue;
      }

      const columns = 2;
      for (let index = 0; index < scopedSkills.length; index += 1) {
        const skill = scopedSkills[index];
        const column = index % columns;
        const row = Math.floor(index / columns);
        const nodeSize = sizeOf(skill);
        setNodePosition(
          skill,
          X.skill + column * (nodeSize.w + GAP.column),
          groupStartY + row * (nodeSize.h + GAP.row),
          assignedNodeIds
        );
      }

      const rowCount = Math.ceil(scopedSkills.length / columns);
      const sample = sizeOf(scopedSkills[0]);
      groupStartY += rowCount * (sample.h + GAP.row) + GAP.section;
    }
  }

  // Rules or skills disconnected from providers fall back to deterministic stacks.
  let looseRuleY = fallbackRuleY;
  for (const rule of rules) {
    if (isPositionAssigned(rule, assignedNodeIds)) {
      continue;
    }
    setNodePosition(rule, X.rule, looseRuleY, assignedNodeIds);
    looseRuleY += sizeOf(rule).h + GAP.row;
  }

  let looseSkillY = 80;
  for (const skill of skills) {
    if (isPositionAssigned(skill, assignedNodeIds)) {
      continue;
    }
    setNodePosition(skill, X.skill, looseSkillY, assignedNodeIds);
    looseSkillY += sizeOf(skill).h + GAP.row;
  }

  const folderAnchor = mapFolderAnchorY(folders, skills, edges);
  let looseFolderY = 80;
  for (const folder of folders) {
    const anchoredY = folderAnchor.get(folder.id);
    setNodePosition(folder, X.folder, anchoredY ?? looseFolderY, assignedNodeIds);
    if (anchoredY === undefined) {
      looseFolderY += sizeOf(folder).h + GAP.row;
    }
  }

  let noteY = 80;
  for (const note of notes) {
    if (note.position.x !== 0 || note.position.y !== 0) {
      continue;
    }
    setNodePosition(note, X.note, noteY, assignedNodeIds);
    noteY += sizeOf(note).h + GAP.row;
  }

  return nextNodes;
}

function getChildrenByType(
  sourceId: string,
  nodeType: string,
  edges: Edge[],
  byId: Map<string, Node>
): Node[] {
  return edges
    .filter((edge) => edge.source === sourceId && edge.type === "contains")
    .map((edge) => byId.get(edge.target))
    .filter((node): node is Node => Boolean(node && node.type === nodeType));
}

function groupByScope(skills: Node[]): Record<ScopeKey, Node[]> {
  const grouped: Record<ScopeKey, Node[]> = {
    project: [],
    personal: [],
    shared: [],
    global: [],
    unknown: []
  };

  for (const skill of skills) {
    const data = skill.data as Record<string, unknown>;
    const rawScope = String(data.scope ?? "unknown") as ScopeKey;
    const scope: ScopeKey = grouped[rawScope] ? rawScope : "unknown";
    grouped[scope].push(skill);
  }

  return grouped;
}

function mapFolderAnchorY(folders: Node[], skills: Node[], edges: Edge[]): Map<string, number> {
  const folderById = new Set(folders.map((folder) => folder.id));
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const anchor = new Map<string, number>();

  for (const edge of edges) {
    if (edge.type !== "locatedIn") {
      continue;
    }
    if (!folderById.has(edge.target)) {
      continue;
    }
    const skill = skillById.get(edge.source);
    if (!skill) {
      continue;
    }
    if (!anchor.has(edge.target)) {
      anchor.set(edge.target, skill.position.y);
    }
  }

  return anchor;
}

function sortByTitle(nodes: Node[]): Node[] {
  return [...nodes].sort((left, right) => {
    const leftData = left.data as Record<string, unknown>;
    const rightData = right.data as Record<string, unknown>;
    const leftTitle = String(leftData.name ?? leftData.label ?? leftData.title ?? left.id);
    const rightTitle = String(rightData.name ?? rightData.label ?? rightData.title ?? right.id);
    return leftTitle.localeCompare(rightTitle);
  });
}

function sizeOf(node: Node): { w: number; h: number } {
  return NODE_SIZE[node.type ?? ""] ?? { w: 230, h: 140 };
}

function setNodePosition(node: Node, x: number, y: number, assignedNodeIds: Set<string>): void {
  node.position = { x, y };
  assignedNodeIds.add(node.id);
}

function isPositionAssigned(node: Node, assignedNodeIds: Set<string>): boolean {
  return assignedNodeIds.has(node.id);
}
