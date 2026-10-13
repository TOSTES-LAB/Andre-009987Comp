import { describe, expect, it } from "vitest";
import { sanitizeInheritedAndrecompEnv } from "./server-utils.js";

describe("sanitizeInheritedAndrecompEnv", () => {
  it("drops the host-only Andrecomp CLI command pointer", () => {
    expect(sanitizeInheritedAndrecompEnv({
      ANDRECOMP_CMD: "node /missing/andrecomp/dist/index.js",
      ANDRECOMP_RUNTIME_API_URL: "http://127.0.0.1:3100",
      PATH: "/usr/bin",
    })).toEqual({
      ANDRECOMP_RUNTIME_API_URL: "http://127.0.0.1:3100",
      PATH: "/usr/bin",
    });
  });
});
