import { describe, expect, it, vi } from "vitest";
import type { Root } from "react-dom/client";
import {
  getOrCreateAndrecompReactRoot,
  type AndrecompReactRootHost,
} from "./react-root";

describe("getOrCreateAndrecompReactRoot", () => {
  it("reuses the existing root when the entry module runs again", () => {
    const host: AndrecompReactRootHost = {};
    const container = {} as Parameters<typeof getOrCreateAndrecompReactRoot>[1];
    const root = { render: vi.fn(), unmount: vi.fn() } as unknown as Root;
    const createRoot = vi.fn(() => root);

    expect(getOrCreateAndrecompReactRoot(host, container, createRoot)).toBe(root);
    expect(getOrCreateAndrecompReactRoot(host, container, createRoot)).toBe(root);
    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(createRoot).toHaveBeenCalledWith(container);
  });
});
