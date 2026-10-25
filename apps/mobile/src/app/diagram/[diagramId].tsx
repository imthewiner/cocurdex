import { router, useLocalSearchParams } from "expo-router";
import { MermaidViewerScreen } from "@/markdown";

export default function DiagramRoute() {
  const { diagramId } = useLocalSearchParams<{ diagramId: string }>();
  return (
    <MermaidViewerScreen diagramId={diagramId} onClose={() => router.back()} />
  );
}
