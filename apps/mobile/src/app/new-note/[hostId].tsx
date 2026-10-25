import { useLocalSearchParams } from "expo-router";
import { useSavedHosts } from "@/hosts";
import { NewNoteForm } from "@/notes";

export default function NewNoteRoute() {
  const { hostId } = useLocalSearchParams<{ hostId: string }>();
  const host = useSavedHosts().find((saved) => saved.hostId === hostId);
  if (!host) return null;
  return <NewNoteForm host={host} />;
}
