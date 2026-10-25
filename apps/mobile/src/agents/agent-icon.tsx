import {
  ACP_REGISTRY_AGENT_ID_PREFIX,
  type AgentBrandIcon,
  type AgentId,
  BUILT_IN_AGENT_BRAND_ICONS,
  type BuiltInAgentId,
  isAcpRegistryAgentId,
  REGISTRY_AGENT_BRAND_ICONS,
} from "@cocurdex/shared";
import Svg, { Path, Rect, SvgXml } from "react-native-svg";
import { useThemeColors } from "@/theme";
import { useRegistryIcon } from "./registry-icons";

function BrandIcon({
  icon,
  size,
  color,
}: {
  icon: AgentBrandIcon;
  size: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox={icon.viewBox}>
      {icon.paths.map((path) => (
        <Path
          key={path.d}
          d={path.d}
          fill={icon.color ?? color}
          fillRule={path.evenOdd ? "evenodd" : undefined}
          clipRule={path.evenOdd ? "evenodd" : undefined}
          opacity={path.opacity}
        />
      ))}
    </Svg>
  );
}

function FallbackIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 8V4H8" />
      <Rect width={16} height={12} x={4} y={8} rx={2} />
      <Path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
    </Svg>
  );
}

function registryIdOf(agentId: AgentId) {
  return isAcpRegistryAgentId(agentId)
    ? agentId.slice(ACP_REGISTRY_AGENT_ID_PREFIX.length)
    : null;
}

export function AgentIcon({
  agentId,
  size = 14,
  color,
}: {
  agentId: AgentId;
  size?: number;
  color?: string;
}) {
  const colors = useThemeColors();
  const tint = color ?? colors.foreground;
  const registryId = registryIdOf(agentId);
  const brand = registryId
    ? REGISTRY_AGENT_BRAND_ICONS[registryId]
    : BUILT_IN_AGENT_BRAND_ICONS[agentId as BuiltInAgentId];
  const remote = useRegistryIcon(brand ? null : registryId);
  if (brand) return <BrandIcon icon={brand} size={size} color={tint} />;
  if (remote) {
    return <SvgXml xml={remote} width={size} height={size} color={tint} />;
  }
  return <FallbackIcon size={size} color={colors.mutedForeground} />;
}
