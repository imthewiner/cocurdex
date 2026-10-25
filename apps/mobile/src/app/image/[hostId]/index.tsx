import { router, useLocalSearchParams } from "expo-router";
import { ImageViewerScreen } from "@/session-detail";

export default function ImageRoute() {
  const { hostId, filePath, name } = useLocalSearchParams<{
    hostId: string;
    filePath: string;
    name: string;
  }>();
  return (
    <ImageViewerScreen
      hostId={hostId}
      filePath={filePath}
      name={name ?? ""}
      onClose={() => router.back()}
    />
  );
}
