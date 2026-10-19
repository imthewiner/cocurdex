import type {
  CreateDeckDownloadPayload,
  DeleteDeckPayload,
  EditDeckPayload,
  GetDeckPayload,
  UpdateDeckPayload,
} from "@cocurdex/shared";
import { requestDaemon } from "@/lib";

export const decksApi = {
  list: () => requestDaemon("deck.list"),
  get: (payload: GetDeckPayload) => requestDaemon("deck.get", payload),
  update: (payload: UpdateDeckPayload) => requestDaemon("deck.update", payload),
  edit: (payload: EditDeckPayload) => requestDaemon("deck.edit", payload),
  delete: async (payload: DeleteDeckPayload) => {
    await requestDaemon("deck.delete", payload);
  },
  createDownload: (payload: CreateDeckDownloadPayload) =>
    requestDaemon("deck.createDownload", payload),
};
