import { isValidMcpServerName } from "@cocurdex/shared";
import { z } from "zod";
import {
  boundedTextSchema,
  exact,
  idSchema,
  noNullByte,
  type Payload,
} from "./primitives";

const serverNameSchema = z
  .string()
  .min(1)
  .max(128)
  .refine(isValidMcpServerName, "invalid MCP server name");

const serverConfigSchema = z
  .record(z.string().max(256), z.unknown())
  .refine(
    (config) => JSON.stringify(config).length <= 200_000,
    "MCP server config is too large",
  );

const loginIdPayload = z.object({
  loginId: z.string().min(1).max(512).refine(noNullByte, "null byte"),
});

const optionalWorkspace = { workspaceId: idSchema.optional() };

export const mcpPayloadSchemas = {
  "mcp.saveConfig": exact<Payload<"mcp.saveConfig">>()(
    z.object({ content: boundedTextSchema(1_000_000).min(1) }),
  ),
  "mcp.readProjectConfig": exact<Payload<"mcp.readProjectConfig">>()(
    z.object({ workspaceId: idSchema }),
  ),
  "mcp.server.save": exact<Payload<"mcp.server.save">>()(
    z.object({
      name: serverNameSchema,
      config: serverConfigSchema,
      previousName: serverNameSchema.optional(),
    }),
  ),
  "mcp.server.remove": exact<Payload<"mcp.server.remove">>()(
    z.object({ name: serverNameSchema }),
  ),
  "mcp.server.setEnabled": exact<Payload<"mcp.server.setEnabled">>()(
    z.object({ name: serverNameSchema, enabled: z.boolean() }),
  ),
  "mcp.servers.merge": exact<Payload<"mcp.servers.merge">>()(
    z.object({
      servers: z
        .record(serverNameSchema, serverConfigSchema)
        .refine(
          (servers) => Object.keys(servers).length <= 256,
          "too many servers",
        ),
    }),
  ),
  "mcp.status": exact<Payload<"mcp.status">>()(
    z.object({
      ...optionalWorkspace,
      names: z.array(serverNameSchema).max(256).optional(),
    }),
  ),
  "mcp.server.test": exact<Payload<"mcp.server.test">>()(
    z.object({
      name: serverNameSchema,
      config: serverConfigSchema,
      ...optionalWorkspace,
    }),
  ),
  "mcp.login.start": exact<Payload<"mcp.login.start">>()(
    z.object({ name: serverNameSchema, ...optionalWorkspace }),
  ),
  "mcp.login.wait": exact<Payload<"mcp.login.wait">>()(loginIdPayload),
  "mcp.login.cancel": exact<Payload<"mcp.login.cancel">>()(loginIdPayload),
  "mcp.logout": exact<Payload<"mcp.logout">>()(
    z.object({ name: serverNameSchema, ...optionalWorkspace }),
  ),
  "mcp.import.scan": exact<Payload<"mcp.import.scan">>()(
    z.object(optionalWorkspace),
  ),
};
