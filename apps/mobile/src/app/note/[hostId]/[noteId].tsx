import { useLocalSearchParams } from "expo-router";
import { useSavedHosts } from "@/hosts";
import { NoteScreen } from "@/notes";

export default function NoteRoute() {
  const { hostId, noteId } = useLocalSearchParams<{
    hostId: string;
    noteId: string;
  }>();
  const host = useSavedHosts().find((saved) => saved.hostId === hostId);
  if (!host) return null;
  return <NoteScreen key={`${hostId}:${noteId}`} host={host} noteId={noteId} />;
}
