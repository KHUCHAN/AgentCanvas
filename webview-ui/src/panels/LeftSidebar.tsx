import type { DiscoverySnapshot } from "../messaging/protocol";
import logo from "../assets/agentcanvas_icon_28.png";

type LeftSidebarProps = {
  snapshot?: DiscoverySnapshot;
  onOpenBuildPrompt: () => void;
  onRefreshDiscovery: () => void;
  onOpenSettings: () => void;
  onOpenCommandBar: () => void;
  onOpenCommonRuleModal: () => void;
  onOpenSkillWizard: () => void;
  onOpenAgentCreation: () => void;
};

export default function LeftSidebar({
  snapshot,
  onOpenBuildPrompt,
  onRefreshDiscovery,
  onOpenSettings,
  onOpenCommandBar,
  onOpenCommonRuleModal,
  onOpenSkillWizard,
  onOpenAgentCreation
}: LeftSidebarProps) {
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
      <SidebarSection
        title="Agents"
        items={[snapshot?.agent.name ?? "Local Agent", "Create agent"]}
        onItemClick={(item) => {
          if (item === "Create agent") {
            onOpenAgentCreation();
          }
        }}
      />
      <SidebarSection
        title="Skills"
        items={[`${snapshot?.skills.length ?? 0} discovered`, "New skill"]}
        onItemClick={(item) => {
          if (item === "New skill") {
            onOpenSkillWizard();
          }
        }}
      />
      <SidebarSection
        title="Ops"
        items={[
          `Common rules ${snapshot?.commonRules.length ?? 0}`,
          `MCP servers ${snapshot?.mcpServers.length ?? 0}`,
          "Add common rule"
        ]}
        onItemClick={(item) => {
          if (item === "Add common rule") {
            onOpenCommonRuleModal();
          }
        }}
      />
      <SidebarSection
        title="Packs"
        items={["Build Team", "Export zip", "Import zip"]}
        onItemClick={(item) => {
          if (item === "Build Team") {
            onOpenBuildPrompt();
          }
          if (item === "Export zip" || item === "Import zip") {
            onOpenCommandBar();
          }
        }}
      />
      <SidebarSection
        title="Settings"
        items={["Refresh", "Settings", "Command Bar"]}
        onItemClick={(item) => {
          if (item === "Refresh") {
            onRefreshDiscovery();
          }
          if (item === "Settings") {
            onOpenSettings();
          }
          if (item === "Command Bar") {
            onOpenCommandBar();
          }
        }}
      />
    </div>
  );
}

function SidebarSection(props: { title: string; items: string[]; onItemClick?: (item: string) => void }) {
  return (
    <div className="sidebar-section">
      <div className="sidebar-title">{props.title}</div>
      {props.items.map((item) => (
        props.onItemClick ? (
          <button
            type="button"
            key={item}
            className="sidebar-item button-like"
            onClick={() => props.onItemClick?.(item)}
          >
            {item}
          </button>
        ) : (
          <div key={item} className="sidebar-item">
            {item}
          </div>
        )
      ))}
    </div>
  );
}
