import type {
  InstalledSkill,
  SkillCatalogResult,
  SkillCatalogSearchResult,
  SkillCatalogSource,
} from "@cocurdex/shared";
import { Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input, Spinner, Text } from "@/components/ui";
import { SettingsListItem } from "../settings-list-item";
import { SkillCatalogDetail } from "./skill-catalog-detail";
import { SkillSourceDetail } from "./skill-source-detail";
import { skillsApi } from "./skills-api";
import { useMountRequest } from "./use-mount-request";

type DiscoverSelection =
  | { kind: "source"; source: SkillCatalogSource }
  | { kind: "result"; result: SkillCatalogResult };

function selectionKey(selection: DiscoverSelection) {
  return selection.kind === "source"
    ? `source:${selection.source.source}`
    : `result:${selection.result.id}`;
}

export function SkillDiscoverView({
  installed,
  onInstall,
}: {
  installed: InstalledSkill[];
  onInstall(source: string, skillPaths?: string[]): void;
}) {
  const { t } = useTranslation("settings");
  const sources = useMountRequest(() => skillsApi.catalogSources());
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SkillCatalogSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selection, setSelection] = useState<DiscoverSelection | null>(null);
  const installedNames = new Set(installed.map((skill) => skill.name));
  const sourceList = sources.data?.sources ?? [];
  const active =
    selection ??
    (sourceList[0] ? { kind: "source" as const, source: sourceList[0] } : null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      setSearch(null);
      return;
    }
    setIsSearching(true);
    setSearchError("");
    try {
      setSearch(await skillsApi.search(value));
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-6">
      <div className="flex min-h-0 w-72 shrink-0 flex-col gap-3">
        <form
          className="relative shrink-0"
          onSubmit={(event) => void submit(event)}
        >
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/65" />
          <Input
            aria-busy={isSearching}
            aria-label={t("skills.discover.search")}
            className="h-7 rounded-control border-border/70 bg-background/60 ps-9 pe-9 text-body shadow-none placeholder:text-muted-foreground/70 focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/20"
            placeholder={t("skills.discover.search")}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!event.target.value.trim()) setSearch(null);
            }}
          />
          {isSearching ? (
            <Spinner
              className="absolute end-3 top-1/2 -translate-y-1/2"
              size="sm"
            />
          ) : null}
        </form>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex flex-col gap-2 pe-1">
            {searchError || sources.error ? (
              <Text
                className="px-1"
                role="alert"
                size="meta"
                tone="destructive"
              >
                {searchError || sources.error}
              </Text>
            ) : null}
            <div className="flex h-5 items-center px-1">
              <Text size="meta" tone="muted" weight="medium">
                {search
                  ? t("skills.discover.results", {
                      count: search.results.length,
                    })
                  : t("skills.discover.official")}
              </Text>
            </div>
            {search?.results.map((result) => (
              <SettingsListItem
                dataAttributes={{ "data-skill-catalog-result": result.id }}
                isActive={
                  active?.kind === "result" && active.result.id === result.id
                }
                key={result.id}
                subtitle={t("skills.discover.resultMeta", {
                  source: result.source,
                  count: result.installs,
                })}
                title={result.name}
                onClick={() => setSelection({ kind: "result", result })}
              />
            ))}
            {search
              ? null
              : sourceList.map((source) => (
                  <SettingsListItem
                    dataAttributes={{
                      "data-skill-catalog-source": source.source,
                    }}
                    isActive={
                      active?.kind === "source" &&
                      active.source.source === source.source
                    }
                    key={source.source}
                    subtitle={source.source}
                    title={source.title}
                    onClick={() => setSelection({ kind: "source", source })}
                  />
                ))}
          </div>
        </div>
        <Text className="shrink-0 px-1" size="meta" tone="muted">
          {t("skills.discover.poweredBy")}
        </Text>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <div className="flex min-w-0 flex-col pe-1">
          {active?.kind === "source" ? (
            <SkillSourceDetail
              installed={installed}
              key={selectionKey(active)}
              source={active.source}
              onInstall={onInstall}
            />
          ) : null}
          {active?.kind === "result" ? (
            <SkillCatalogDetail
              installed={installedNames.has(active.result.name)}
              key={selectionKey(active)}
              result={active.result}
              onInstall={onInstall}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
