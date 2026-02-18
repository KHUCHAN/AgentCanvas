import iconAgent from "../../assets/icon_agent.svg";
import iconFolder from "../../assets/icon_folder.svg";
import iconNote from "../../assets/icon_note.svg";
import iconProvider from "../../assets/icon_provider.svg";
import iconRule from "../../assets/icon_rule.svg";
import iconSkill from "../../assets/icon_skill.svg";

type NodeTypeIconProps = {
  kind: "skill" | "rule" | "agent" | "provider" | "folder" | "note" | "commonRules" | "system";
};

const iconByKind: Record<NodeTypeIconProps["kind"], string> = {
  skill: iconSkill,
  rule: iconRule,
  agent: iconAgent,
  provider: iconProvider,
  folder: iconFolder,
  note: iconNote,
  commonRules: iconRule,
  system: iconProvider
};

export default function NodeTypeIcon({ kind }: NodeTypeIconProps) {
  return <img className={`node-type-icon node-type-icon-${kind}`} src={iconByKind[kind]} alt="" />;
}
