import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { requestDaemon } from "@cocurdex/daemon/client";
import { installFixtureDb } from "@cocurdex/e2e/fixture-db/install";
import { FIXTURE_WORKSPACE_ID } from "@cocurdex/e2e/fixture-db/recipe";
import { saveStubProvider } from "@cocurdex/e2e/helpers/chat-session";
import {
  bundledDaemonPath,
  daemonLogTail,
  spawnDaemon,
} from "@cocurdex/e2e/helpers/daemon-process";
import { startStubLlmServer } from "@cocurdex/e2e/helpers/llm-stub";
import { type AgentId, buildHostPairingLink } from "@cocurdex/shared";
import type { createTempDirs } from "@cocurdex/shared/testing";
import { EMULATOR_HOST_ALIAS } from "./android";
import type { MobilePlatform } from "./target";

const AGENT_MODEL_ID = "e2e-agent-model";
const AGENT_MODEL_NAME = "E2E Agent Model";
const STUB_REQUEST_TAIL = 6;
const DAEMON_LOG_TAIL = 150;

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("No free port")),
      );
    });
  });
}

export async function startPairingDaemon(
  platform: MobilePlatform,
  tempDirs: ReturnType<typeof createTempDirs>,
) {
  if (!existsSync(bundledDaemonPath)) {
    throw new Error(`Missing ${bundledDaemonPath}; run with --build first`);
  }
  const root = tempDirs.createSync("cocu-m-");
  const userDataPath = path.join(root, "data");
  await installFixtureDb({
    userDataPath,
    workspaceParent: path.join(root, "ws"),
  });
  const daemon = await spawnDaemon({ entry: "bundled", userDataPath });
  const stub = await startStubLlmServer();
  try {
    const providerSnapshot = await saveStubProvider(daemon, stub);
    const now = new Date().toISOString();
    await requestDaemon(
      "provider.model.save",
      {
        model: {
          providerId: providerSnapshot.providerId,
          modelId: AGENT_MODEL_ID,
          name: AGENT_MODEL_NAME,
          api: "openai-completions",
          enabled: true,
          source: "manual",
          capabilities: ["chat", "agent"],
          createdAt: now,
          updatedAt: now,
        },
      },
      daemon.options,
    );
    const port = await freePort();
    const status = await requestDaemon(
      "host.remoteAccess.set",
      { enabled: true, port },
      daemon.options,
    );
    if (!status.listening) {
      throw new Error(`Remote access did not start: ${status.error}`);
    }
    const address =
      status.addresses.find((candidate) => candidate.kind === "lan") ??
      status.addresses[0];
    if (!address) throw new Error("Remote access reported no address");
    const baseUrl = new URL(address.url);
    if (platform === "android") baseUrl.hostname = EMULATOR_HOST_ALIAS;
    return {
      hostAddress: baseUrl.host,
      async createPairingLink() {
        const { code } = await requestDaemon(
          "host.pairing.create",
          {
            label: "Mobile e2e",
            scopes: ["read", "files.read", "interact", "execute"],
          },
          daemon.options,
        );
        return buildHostPairingLink(baseUrl.origin, code);
      },
      agentModelName: AGENT_MODEL_NAME,
      async agentLabel(agentId: AgentId) {
        const agents = await requestDaemon("agent.list", daemon.options);
        const agent = agents.find((candidate) => candidate.id === agentId);
        if (!agent) throw new Error(`The daemon offers no ${agentId} agent`);
        return agent.label;
      },
      sessions: () => requestDaemon("session.list", daemon.options),
      pairedDevices: () => requestDaemon("host.devices.list", daemon.options),
      sessionAttention: () => requestDaemon("attention.list", daemon.options),
      async createReplyingSession(title: string, reply: string) {
        stub.plan = { kind: "stream", chunks: [reply] };
        return requestDaemon(
          "session.configure",
          {
            id: crypto.randomUUID(),
            workspaceId: FIXTURE_WORKSPACE_ID,
            sessionKind: "main",
            title,
            agentType: "pi",
            writeMode: "read-only",
            sessionModeId: null,
            providerSnapshot,
          },
          daemon.options,
        );
      },
      sentPrompts: () =>
        stub.requests.map((request) => JSON.stringify(request.body.messages)),
      async diagnostics() {
        const sessions = await requestDaemon(
          "session.list",
          daemon.options,
        ).catch((error: unknown) => `session.list failed: ${String(error)}`);
        const sessionLines = Array.isArray(sessions)
          ? sessions.map(
              (session) =>
                `${session.id} ${session.status} ${session.agentType} ${session.title}`,
            )
          : [sessions];
        const requestLines = stub.requests
          .slice(-STUB_REQUEST_TAIL)
          .map((request) => JSON.stringify(request.body.messages).slice(-300));
        return [
          "--- daemon sessions",
          ...sessionLines,
          `--- llm stub requests (${stub.requests.length} total, last ${STUB_REQUEST_TAIL})`,
          ...requestLines,
          "--- daemon log",
          await daemonLogTail(daemon.userDataPath, DAEMON_LOG_TAIL),
        ].join("\n");
      },
      async dispose() {
        await daemon.dispose();
        await stub.close();
      },
    };
  } catch (error) {
    await daemon.dispose();
    await stub.close();
    throw error;
  }
}
