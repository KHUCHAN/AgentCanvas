import type { DiscoverySnapshot } from "../messaging/protocol";
import logo from "../assets/agentcanvas_icon_28.png";

type LeftSidebarProps = {
  snapshot?: DiscoverySnapshot;
};

export default function LeftSidebar({ snapshot }: LeftSidebarProps) {
  const providers = (snapshot?.nodes ?? [])
    .filter((node) => node.type === "provider")
    .map((node) => {
      const data = node.data as Record<string, unknown>;
      const label = String(data.label ?? "Provider");
      const skills = Number(data.skillCount ?? 0);
      const rules = Number(data.ruleCount ?? 0);
      return `${label} · ${skills}S/${rules}R`;
    });

  return (
    <div className="left-sidebar-inner" role="navigation" aria-label="Canvas navigation">
      <div className="brand-block">
        <div className="brand-header">
          <img src={logo} className="brand-logo" alt="AgentCanvas Logo" />
          <div className="brand-title">AgentCanvas</div>
        </div>
        <div className="brand-subtitle">Design · Connect · Deploy</div>
      </div>

      <SidebarSection
        title="Providers"
        items={providers.length > 0 ? providers : ["GPT / Codex", "Claude", "Gemini"]}
      />
      <SidebarSection title="Agents" items={[snapshot?.agent.name ?? "Local Agent"]} />
      <SidebarSection title="Skills" items={[`${snapshot?.skills.length ?? 0} discovered`]} />
      <SidebarSection
        title="Ops"
        items={[
          `Common rules ${snapshot?.commonRules.length ?? 0}`,
          `MCP servers ${snapshot?.mcpServers.length ?? 0}`
        ]}
      />
      <SidebarSection title="Packs" items={["Export zip", "Import zip"]} />
      <SidebarSection title="Settings" items={["Locations", "Validation"]} />
    </div>
  );
}

function SidebarSection(props: { title: string; items: string[] }) {
  return (
    <div className="sidebar-section">
      <div className="sidebar-title">{props.title}</div>
      {props.items.map((item) => (
        <div key={item} className="sidebar-item">
          {item}
        </div>
      ))}
    </div>
  );
}
