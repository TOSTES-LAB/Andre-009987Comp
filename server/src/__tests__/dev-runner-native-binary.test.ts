import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  andrecompRunnerBinaryNeedsBuild,
  resolveNativeRunnerDevBinary,
  resolveNativeRunnerRequirement,
} from "../../../scripts/dev-runner-native-binary.mjs";

const tempRoots = new Set<string>();
const initialPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
const initialArchitecture = Object.getOwnPropertyDescriptor(process, "arch")!;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(process, "platform", initialPlatform);
  Object.defineProperty(process, "arch", initialArchitecture);
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

function createRunnerCheckout(): { root: string; source: string; binary: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "andrecomp-dev-runner-binary-"));
  tempRoots.add(root);

  const runnerRoot = path.join(root, "packages", "andrecomp-runner", "runner");
  const source = path.join(runnerRoot, "crates", "runner-core", "src", "main.rs");
  const binary = path.join(
    root,
    "packages",
    "andrecomp-runner",
    "dist",
    "bin",
    process.platform === "win32" ? "andrecomp-runnerd.exe" : "andrecomp-runnerd",
  );
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(path.join(runnerRoot, "Cargo.toml"), "[workspace]\n", "utf8");
  fs.writeFileSync(path.join(runnerRoot, "Cargo.lock"), "", "utf8");
  fs.writeFileSync(source, "fn main() {}\n", "utf8");
  fs.writeFileSync(binary, nativeHeader(process.platform, process.arch));
  return { root, source, binary };
}

function nativeHeader(platform: string, architecture: string): Buffer {
  const bytes = Buffer.alloc(128);
  if (platform === "darwin") {
    bytes.writeUInt32LE(0xfeedfacf);
    bytes.writeUInt32LE(architecture === "x64" ? 0x01000007 : 0x0100000c, 4);
  } else if (platform === "win32") {
    bytes.set([0x4d, 0x5a]); bytes.writeUInt32LE(64, 60);
    bytes.writeUInt32LE(0x00004550, 64); bytes.writeUInt16LE(architecture === "x64" ? 0x8664 : 0xaa64, 68);
  } else {
    bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1]); bytes.writeUInt16LE(architecture === "x64" ? 62 : 183, 18);
  }
  return bytes;
}

describe("andrecomp runner native dev prerequisite", () => {
  it("uses an explicit status response and fails safe when status is unknown", () => {
    expect(
      resolveNativeRunnerRequirement({
        exitCode: 0,
        stdout: "pnpm warning\n{\"nativeRunnerRequired\":false}\n",
      }),
    ).toEqual({ nativeRunnerRequired: false, valid: true });
    expect(
      resolveNativeRunnerRequirement({
        exitCode: 0,
        stdout: "{\"nativeRunnerRequired\":true}\n",
      }),
    ).toEqual({ nativeRunnerRequired: true, valid: true });
    expect(
      resolveNativeRunnerRequirement({
        exitCode: 1,
        stdout: "",
      }),
    ).toEqual({ nativeRunnerRequired: true, valid: false });
    expect(
      resolveNativeRunnerRequirement({
        exitCode: 0,
        stdout: "{\"unexpected\":true}\n",
      }),
    ).toEqual({ nativeRunnerRequired: true, valid: false });
  });

  it("builds only when the staged binary is missing or older than Rust inputs", () => {
    const checkout = createRunnerCheckout();
    const now = Date.now();
    const old = new Date(now - 2_000);
    const current = new Date(now + 2_000);
    const next = new Date(now + 4_000);

    fs.utimesSync(checkout.source, old, old);
    fs.utimesSync(checkout.binary, current, current);
    expect(
      andrecompRunnerBinaryNeedsBuild({
        repoRoot: checkout.root,
        nativeRunnerRequired: true,
      }),
    ).toBe(false);

    fs.utimesSync(checkout.source, next, next);
    expect(
      andrecompRunnerBinaryNeedsBuild({
        repoRoot: checkout.root,
        nativeRunnerRequired: true,
      }),
    ).toBe(true);

    fs.rmSync(checkout.binary);
    expect(
      andrecompRunnerBinaryNeedsBuild({
        repoRoot: checkout.root,
        nativeRunnerRequired: true,
      }),
    ).toBe(true);
  });

  it("keeps default-off legacy development Node-only", () => {
    expect(
      andrecompRunnerBinaryNeedsBuild({
        repoRoot: "/checkout/without/a/staged/binary",
        nativeRunnerRequired: false,
      }),
    ).toBe(false);
  });

  it.each(["arm64", "x64"])("uses the staged Mac %s target before the flat build output", architecture => {
    const checkout = createRunnerCheckout();
    const target = path.join(path.dirname(checkout.binary), `darwin-${architecture}`, "andrecomp-runnerd");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, nativeHeader("darwin", architecture));
    const old = new Date(Date.now() - 2000), current = new Date(Date.now() + 2000);
    fs.utimesSync(checkout.binary, old, old);
    fs.utimesSync(target, current, current);
    const input = { repoRoot: checkout.root, nativeRunnerRequired: true, platform: "darwin", architecture };
    expect(andrecompRunnerBinaryNeedsBuild(input)).toBe(false);
    fs.writeFileSync(checkout.binary, nativeHeader("linux", "x64"));
    const wrongHostNewer = new Date(Date.now() + 4000);
    fs.utimesSync(checkout.binary, wrongHostNewer, wrongHostNewer);
    expect(resolveNativeRunnerDevBinary(input)).toEqual({ binary: target, sourceBuild: false });
    expect(andrecompRunnerBinaryNeedsBuild(input)).toBe(false);
    fs.rmSync(checkout.binary);
    expect(andrecompRunnerBinaryNeedsBuild(input)).toBe(false);
    fs.utimesSync(target, old, old);
    expect(andrecompRunnerBinaryNeedsBuild(input)).toBe(true);
    fs.rmSync(target);
    expect(andrecompRunnerBinaryNeedsBuild(input)).toBe(true);
  });

  it.each(["arm64", "x64"])("uses only a newer matching Mac %s source build without changing release selection", architecture => {
    const checkout = createRunnerCheckout();
    const target = path.join(path.dirname(checkout.binary), `darwin-${architecture}`, "andrecomp-runnerd");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, nativeHeader("darwin", architecture));
    fs.writeFileSync(checkout.binary, nativeHeader("darwin", architecture));
    const old = new Date(Date.now() - 2000), fresh = new Date(Date.now() + 2000), changed = new Date(Date.now() + 4000);
    fs.utimesSync(target, old, old); fs.utimesSync(checkout.binary, fresh, fresh);
    const input = { repoRoot: checkout.root, nativeRunnerRequired: true, platform: "darwin", architecture };
    expect(resolveNativeRunnerDevBinary(input)).toEqual({ binary: checkout.binary, sourceBuild: true });
    expect(andrecompRunnerBinaryNeedsBuild(input)).toBe(false);
    fs.utimesSync(checkout.source, changed, changed);
    expect(andrecompRunnerBinaryNeedsBuild(input)).toBe(true);
    fs.writeFileSync(checkout.binary, nativeHeader("darwin", architecture === "x64" ? "arm64" : "x64"));
    expect(resolveNativeRunnerDevBinary(input)).toEqual({ binary: target, sourceBuild: false });
    fs.rmSync(target);
    expect(resolveNativeRunnerDevBinary(input)).toBeNull();
    expect(andrecompRunnerBinaryNeedsBuild(input)).toBe(true);
  });

  it("does not build a workspace binary when an explicit binary is configured", () => {
    expect(
      andrecompRunnerBinaryNeedsBuild({
        repoRoot: "/checkout/without/a/staged/binary",
        nativeRunnerRequired: true,
        configuredBinary: "/opt/andrecomp/andrecomp-runnerd",
      }),
    ).toBe(false);
  });
});
