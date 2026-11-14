import { expect, it } from "vitest";
import { andrecompCloudEnrollmentPrincipal } from "./andrecomp-cloud-connector-principal.js";

it("uses the same enrollment principal namespace for users and local board actors", () => {
  expect(andrecompCloudEnrollmentPrincipal({ userId: "fixture-user", source: "session" })).toBe("user:fixture-user");
  expect(andrecompCloudEnrollmentPrincipal({ source: "local_implicit" })).toBe("source:local_implicit");
  expect(andrecompCloudEnrollmentPrincipal({ userId: "source:local_implicit" })).toBe("user:source:local_implicit");
  expect(andrecompCloudEnrollmentPrincipal({})).toBe("source:board");
});
