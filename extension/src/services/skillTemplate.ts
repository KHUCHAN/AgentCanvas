type Primitive = string | number | boolean | null;

export function renderSkillMarkdown(input: {
  name: string;
  description: string;
  scope?: "project" | "personal" | "shared" | "global";
  extraFrontmatter?: Record<string, unknown>;
}): string {
  const frontmatter: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    ...(input.scope ? { scope: input.scope } : {}),
    ...(input.extraFrontmatter ?? {})
  };

  const yaml = toYaml(frontmatter);
  const body = `# ${input.name}

## When to use
- Use this skill when: **(fill in)**
- Keywords/triggers: **(fill in)**

## What you will produce
- Output: **(files changed / commands / report format)**

## Steps
1) Gather context
2) Plan
3) Execute
4) Verify
5) Report

## Notes / Safety
- Never hardcode credentials. Use environment variables.
`;

  return `${yaml}\n${body}`;
}

export function renderOpenAiYaml(): string {
  return `# Optional metadata for Codex skill runtime
disable-model-invocation: false
# allowed-tools: ["Read", "Grep"]
`;
}

function toYaml(value: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [key, raw] of Object.entries(value)) {
    lines.push(renderYamlLine(key, raw));
  }
  lines.push("---");
  return `${lines.join("\n")}\n`;
}

function renderYamlLine(key: string, raw: unknown): string {
  if (isPrimitive(raw)) {
    return `${key}: ${renderYamlPrimitive(raw)}`;
  }

  return `${key}: ${JSON.stringify(raw)}`;
}

function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function renderYamlPrimitive(value: Primitive): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return String(value);
}
