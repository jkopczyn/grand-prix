import { describe, it, expect, beforeEach, vi } from "vitest";

async function freshRegistry() {
    vi.resetModules();
    return import("./registry.js");
}

describe("registry", () => {
    it("stores and retrieves a contribution by ID", async () => {
        const { registerContribution, getContribution } = await freshRegistry();
        const instance = { name: "test" };
        registerContribution("foo", instance);
        expect(getContribution("foo")).toBe(instance);
    });

    it("returns undefined for unknown ID", async () => {
        const { getContribution } = await freshRegistry();
        expect(getContribution("unknown")).toBeUndefined();
    });

    it("overwrites a previous registration for the same ID", async () => {
        const { registerContribution, getContribution } = await freshRegistry();
        const first = { v: 1 };
        const second = { v: 2 };
        registerContribution("same", first);
        registerContribution("same", second);
        expect(getContribution("same")).toBe(second);
    });

    it("keeps multiple IDs independent", async () => {
        const { registerContribution, getContribution } = await freshRegistry();
        const a = { n: "a" };
        const b = { n: "b" };
        registerContribution("a", a);
        registerContribution("b", b);
        expect(getContribution("a")).toBe(a);
        expect(getContribution("b")).toBe(b);
    });
});
