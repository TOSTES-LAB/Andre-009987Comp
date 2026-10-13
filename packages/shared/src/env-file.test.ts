import { describe, expect, it } from "vitest";
import { encodeEnvValue, updateEnvFileContents } from "./env-file.js";

describe("env file editor", () => {
  it("pins minimal and JSON value encoding", () => {
    expect(encodeEnvValue("plain-value", "minimal")).toBe("plain-value");
    expect(encodeEnvValue("#439edb", "minimal")).toBe('"#439edb"');
    expect(encodeEnvValue("plain-value", "json")).toBe('"plain-value"');
  });

  it("preserves unrelated content and CRLF while updating every stale duplicate", () => {
    const original = [
      "# operator comment",
      "UNKNOWN='keep this encoding'",
      "",
      "export ANDRECOMP_HOME = '/old path'  # managed path",
      "ANDRECOMP_DUPLICATE=stale",
      'ANDRECOMP_DUPLICATE="current"',
      "TRAILING=untouched",
      "",
    ].join("\r\n");

    const updated = updateEnvFileContents(
      original,
      {
        ANDRECOMP_HOME: "/new path",
        ANDRECOMP_DUPLICATE: "current",
        ANDRECOMP_WORKTREE_COLOR: "#439edb",
      },
      { valueEncoding: "minimal" },
    );

    expect(updated).toBe([
      "# operator comment",
      "UNKNOWN='keep this encoding'",
      "",
      'export ANDRECOMP_HOME = "/new path"  # managed path',
      "ANDRECOMP_DUPLICATE=current",
      'ANDRECOMP_DUPLICATE="current"',
      "TRAILING=untouched",
      'ANDRECOMP_WORKTREE_COLOR="#439edb"',
      "",
    ].join("\r\n"));
    expect(updated.replaceAll("\r\n", "")).not.toContain("\n");
  });

  it("uses JSON encoding for changed values without re-encoding current assignments", () => {
    const original = [
      "ANDRECOMP_CURRENT=plain-value",
      "ANDRECOMP_CHANGED=old",
      "UNKNOWN=\"operator value\"",
      "",
    ].join("\n");

    expect(
      updateEnvFileContents(
        original,
        {
          ANDRECOMP_CURRENT: "plain-value",
          ANDRECOMP_CHANGED: "new",
          ANDRECOMP_ADDED: "added",
        },
        { valueEncoding: "json" },
      ),
    ).toBe([
      "ANDRECOMP_CURRENT=plain-value",
      'ANDRECOMP_CHANGED="new"',
      'UNKNOWN="operator value"',
      'ANDRECOMP_ADDED="added"',
      "",
    ].join("\n"));
  });

  it("does not treat an unquoted dotenv comment as the managed value", () => {
    expect(
      updateEnvFileContents(
        ["ANDRECOMP_COLOR=#439edb", "ANDRECOMP_HOME=old# keep this comment"].join("\n"),
        {
          ANDRECOMP_COLOR: "#439edb",
          ANDRECOMP_HOME: "new",
        },
        { valueEncoding: "minimal" },
      ),
    ).toBe(
      ['ANDRECOMP_COLOR="#439edb"#439edb', "ANDRECOMP_HOME=new# keep this comment"].join("\n"),
    );
  });

  it("is a no-op when every managed duplicate is already current", () => {
    const original = [
      "export ANDRECOMP_HOME = '/same path' # first",
      'ANDRECOMP_HOME="/same path"',
      "UNKNOWN=value",
    ].join("\n");

    expect(updateEnvFileContents(original, { ANDRECOMP_HOME: "/same path" })).toBe(original);
  });
});
