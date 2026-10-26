import type { ListHeader, ListSearch } from "./list-header-props";
import { useSearchBarOptions } from "./use-search-bar-options";

const IGNORE_QUERY = () => undefined;

export function useListHeader(_title: string, search?: ListSearch): ListHeader {
  const searchBarOptions = useSearchBarOptions(
    search?.placeholder ?? "",
    search?.onQuery ?? IGNORE_QUERY,
  );
  return {
    options: search ? { headerSearchBarOptions: searchBarOptions } : {},
    header: undefined,
  };
}
