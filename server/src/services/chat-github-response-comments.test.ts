import { describe, expect, it } from "vitest";
import { holdsPublishedResponse } from "./chat-github-response-comments.js";

const markers = "\n\n<!-- andrecomp-pr-response:a -->\n<!-- andrecomp-response:b -->\n<!-- andrecomp-response-version:2026-11-23T00:00:00.000Z -->";
const final = "\n<!-- andrecomp-response-state:final -->";

describe("holdsPublishedResponse", () => {
  it("protects a final review, even one that starts with a status sentence", () => {
    expect(holdsPublishedResponse(`## Review — 4/5\n\nLooks good.${markers}${final}`)).toBe(true);
    expect(holdsPublishedResponse(`This turn ended without publishing a final response. The fix landed later.${markers}${final}`)).toBe(true);
  });
  it("treats placeholders and status notices as replaceable", () => {
    expect(holdsPublishedResponse(`Working on this…${markers}`)).toBe(false);
    expect(holdsPublishedResponse(`Anything${markers}\n<!-- andrecomp-response-kind:status -->${final}`)).toBe(false);
    expect(holdsPublishedResponse(`This turn ended without publishing a final response. See the Andrecomp task for details.${markers}${final}`)).toBe(false);
    expect(holdsPublishedResponse(`Work is paused. Your request is saved. See the Andrecomp task for details.${markers}`)).toBe(false);
  });
});
