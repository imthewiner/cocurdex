import { describe, expect, it } from "vitest";
import {
  DAEMON_WEBSOCKET_PROTOCOL,
  daemonWebSocketProtocols,
  readDaemonWebSocketToken,
} from "./websocket-protocol";

describe("daemon WebSocket protocols", () => {
  it("round-trips the token next to the protocol version", () => {
    const protocols = daemonWebSocketProtocols("abc123");
    expect(protocols[0]).toBe(DAEMON_WEBSOCKET_PROTOCOL);
    expect(readDaemonWebSocketToken(protocols)).toBe("abc123");
  });

  it("reads no token when none was offered", () => {
    expect(readDaemonWebSocketToken([DAEMON_WEBSOCKET_PROTOCOL])).toBeNull();
    expect(readDaemonWebSocketToken([])).toBeNull();
  });
});
