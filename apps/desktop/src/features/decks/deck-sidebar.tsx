import type { DeckSummary } from "@cocurdex/shared";
import { useAtomValue, useSetAtom } from "jotai";
import { FileUp, Presentation } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SidebarPanelHeader } from "@/app/layout/sidebar-panel-header";
import {
  TITLEBAR_ICON_GLYPH_CLASS,
  TitlebarIconButton,
} from "@/app/layout/titlebar-icon-button";
import { EmptyState, ScrollArea } from "@/components/ui";
import { exportDeckWithFeedback, reportImportWarnings } from "./deck-actions";
import { DeckDeleteDialog } from "./deck-delete-dialog";
import { DeckRow } from "./deck-row";
import { canPickLocalFiles, pickLocalFilePath } from "./local-file-picker";

const PPTX_ACCEPT =
  ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";

import {
  activeDeckIdAtom,
  deckSummariesAtom,
  deleteDeckAtom,
  importDeckAtom,
  openDeckAtom,
  renameDeckAtom,
} from "./decks-store";

export function DeckSidebar({ onCollapse }: { onCollapse: () => void }) {
  const { t } = useTranslation("decks");
  const decks = useAtomValue(deckSummariesAtom);
  const activeDeckId = useAtomValue(activeDeckIdAtom);
  const openDeck = useSetAtom(openDeckAtom);
  const renameDeck = useSetAtom(renameDeckAtom);
  const deleteDeck = useSetAtom(deleteDeckAtom);
  const importDeck = useSetAtom(importDeckAtom);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeckSummary | null>(null);

  const commitRename = async (deck: DeckSummary, title: string) => {
    const next = title.trim();
    try {
      if (next && next !== deck.title)
        await renameDeck({ id: deck.id, title: next });
    } finally {
      setRenamingId(null);
    }
  };

  const importPptx = async () => {
    try {
      const path = await pickLocalFilePath(PPTX_ACCEPT);
      if (!path) return;
      const { warnings } = await importDeck(path);
      reportImportWarnings(warnings, t("import.warnings"));
    } catch (error) {
      toast.error(t("errors.import"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-2 px-2 pb-2">
      <SidebarPanelHeader
        title={t("sidebar.title")}
        collapseLabel={t("sidebar.collapse")}
        onCollapse={onCollapse}
        action={
          canPickLocalFiles() ? (
            <TitlebarIconButton
              aria-label={t("sidebar.importPptx")}
              onClick={() => void importPptx()}
            >
              <FileUp className={TITLEBAR_ICON_GLYPH_CLASS} />
            </TitlebarIconButton>
          ) : null
        }
      />
      {decks.length === 0 ? (
        <EmptyState
          icon={<Presentation />}
          title={t("sidebar.empty.title")}
          description={t("sidebar.empty.description")}
        />
      ) : (
        <ScrollArea className="min-h-0 min-w-0 w-full flex-1">
          <div className="flex w-full min-w-0 flex-col gap-0.5">
            {decks.map((deck) => (
              <DeckRow
                key={deck.id}
                deck={deck}
                isActive={deck.id === activeDeckId}
                isRenaming={deck.id === renamingId}
                onOpen={() => {
                  if (!renamingId) void openDeck(deck.id);
                }}
                onStartRename={() => setRenamingId(deck.id)}
                onCancelRename={() => setRenamingId(null)}
                onCommitRename={(title) => commitRename(deck, title)}
                onExport={(format) =>
                  void exportDeckWithFeedback(
                    deck.id,
                    format,
                    t("errors.export"),
                  )
                }
                onDelete={() => setPendingDelete(deck)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
      <DeckDeleteDialog
        deck={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={(id) => {
          void deleteDeck(id);
        }}
      />
    </div>
  );
}
