import type { EntityLink, EntityRef } from "@cocurdex/shared";

export interface EntityLinksRepository {
  resolve(ref: EntityRef): Promise<EntityRef | null>;
  list(ref: EntityRef): Promise<EntityLink[]>;
  add(source: EntityRef, target: EntityRef): Promise<boolean>;
  remove(source: EntityRef, target: EntityRef): Promise<boolean>;
}
