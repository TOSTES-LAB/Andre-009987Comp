import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveAndrecompHomeDir,
  resolveAndrecompInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.andrecomp and default instance", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "andrecomp-home-paths-"));
    process.env.ANDRECOMP_HOME = home;
    delete process.env.ANDRECOMP_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(home);
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(home, "instances", "default", "config.json"));
  });

  it("supports ANDRECOMP_HOME and explicit instance ids", () => {
    process.env.ANDRECOMP_HOME = "~/andrecomp-home";

    const home = resolveAndrecompHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "andrecomp-home"));
    expect(resolveAndrecompInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveAndrecompInstanceId("bad/id")).toThrow(/Invalid ANDRECOMP_INSTANCE_ID/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
