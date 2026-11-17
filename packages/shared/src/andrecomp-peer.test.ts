import { describe, expect, it } from "vitest";
import { connectionAgentInstructionsSchema } from "./connection-instructions.js";
import { isSameAndrecompInstance, andrecompPeerAgentInstructions, andrecompPeerFromMcpUrl, andrecompPeerInstructionTemplate } from "./andrecomp-peer.js";

describe("andrecompPeerFromMcpUrl", () => {
  it.each([
    ["https://acme.andrecomp.app/mcp/andrecomp", "acme", "acme Andrecomp"],
    ["https://andrecomp.staging.andrecomp.app/mcp/andrecomp/", "staging", "staging Andrecomp"],
    ["https://pc.example.com/mcp/andrecomp", "pc", "pc Andrecomp"],
    ["https://example.com/mcp/andrecomp", "example", "example Andrecomp"],
    ["http://localhost:3101/mcp/andrecomp", "localhost-3101", "localhost-3101 Andrecomp"],
    ["http://127.0.0.1:3101/mcp/andrecomp", "127-0-0-1-3101", "127-0-0-1-3101 Andrecomp"],
    ["https://andrecomp.app/mcp/andrecomp", "andrecomp", "Andrecomp andrecomp.app"],
  ])("names %s after the instance it reaches", (url, label, name) => {
    expect(andrecompPeerFromMcpUrl(url)).toMatchObject({ label, name });
  });

  it("derives a tool prefix from the address, with the distinctive part first", () => {
    expect(andrecompPeerFromMcpUrl("https://acme.andrecomp.app/mcp/andrecomp")?.toolNamespace).toBe("acme-andrecomp");
    expect(andrecompPeerFromMcpUrl("https://andrecomp.app/mcp/andrecomp")?.toolNamespace).toBe("andrecomp");
  });

  it.each([
    "https://acme.andrecomp.app/mcp",
    "https://acme.andrecomp.app/mcp/andrecomp/extra",
    "https://mcp.example.com/sse",
    "ftp://acme.andrecomp.app/mcp/andrecomp",
    "not a url",
    "",
    null,
  ])("ignores %s", (url) => {
    expect(andrecompPeerFromMcpUrl(url)).toBeNull();
  });
});

describe("isSameAndrecompInstance", () => {
  const peer = (url: string) => andrecompPeerFromMcpUrl(url)!;

  it("matches the instance's own public origin", () => {
    expect(isSameAndrecompInstance(peer("https://acme.andrecomp.app/mcp/andrecomp"), [null, "https://acme.andrecomp.app"])).toBe(true);
  });

  it("treats loopback hostnames on the same port as the same instance", () => {
    expect(isSameAndrecompInstance(peer("http://127.0.0.1:3100/mcp/andrecomp"), ["http://localhost:3100"])).toBe(true);
  });

  it("keeps another local instance on a different port distinct", () => {
    expect(isSameAndrecompInstance(peer("http://localhost:3101/mcp/andrecomp"), ["http://localhost:3100"])).toBe(false);
  });

  it("keeps another hosted instance distinct", () => {
    expect(isSameAndrecompInstance(peer("https://bob.andrecomp.app/mcp/andrecomp"), ["https://acme.andrecomp.app", "not a url"])).toBe(false);
  });
});

describe("andrecompPeerAgentInstructions", () => {
  it("names the other instance, steers own work back home, and fits the instruction limits", () => {
    const instructions = andrecompPeerAgentInstructions(peer());
    expect(connectionAgentInstructionsSchema.parse(instructions)).toEqual(instructions);
    expect(instructions.enabled).toBe(true);
    expect(instructions.template).toEqual({ id: "andrecomp.peer", version: 1 });
    expect(instructions.text).toBe(andrecompPeerInstructionTemplate(peer()).text);
    expect(instructions.text).toContain("https://acme.andrecomp.app");
    expect(instructions.text).toContain("not the Andrecomp you work in");
    expect(instructions.text).toContain("keep using your own Andrecomp tools");
  });

  function peer() {
    return andrecompPeerFromMcpUrl("https://acme.andrecomp.app/mcp/andrecomp")!;
  }
});
