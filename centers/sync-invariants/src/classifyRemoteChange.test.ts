import { describe, expect, test } from "vitest";
import { classifyRemoteChange } from "./classifyRemoteChange.ts";

describe("classifyRemoteChange", () => {
  test("rule 1: no disk → no_change", () => {
    expect(
      classifyRemoteChange({
        diskHash: null,
        lastAppliedHash: "A",
        remoteHash: "B",
        lastPersistedHash: null,
      }),
    ).toBe("no_change");
  });

  test("rule 1: no base → no_change", () => {
    expect(
      classifyRemoteChange({
        diskHash: "B",
        lastAppliedHash: null,
        remoteHash: "C",
        lastPersistedHash: null,
      }),
    ).toBe("no_change");
  });

  test("rule 2: remote === disk → no_change", () => {
    expect(
      classifyRemoteChange({
        diskHash: "X",
        lastAppliedHash: "A",
        remoteHash: "X",
        lastPersistedHash: null,
      }),
    ).toBe("no_change");
  });

  test("rule 3: remote === lastPersisted → self_echo", () => {
    expect(
      classifyRemoteChange({
        diskHash: "B",
        lastAppliedHash: "A",
        remoteHash: "P",
        lastPersistedHash: "P",
      }),
    ).toBe("self_echo");
  });

  test("rule 3: skipped when lastPersisted is null", () => {
    expect(
      classifyRemoteChange({
        diskHash: "B",
        lastAppliedHash: "A",
        remoteHash: "B",
        lastPersistedHash: null,
      }),
    ).toBe("no_change");
  });

  test("rule 4: remote === lastApplied → remote_behind", () => {
    expect(
      classifyRemoteChange({
        diskHash: "B",
        lastAppliedHash: "A",
        remoteHash: "A",
        lastPersistedHash: null,
      }),
    ).toBe("remote_behind");
  });

  test("rule 5: true_divergence when detectConflict holds", () => {
    expect(
      classifyRemoteChange({
        diskHash: "B",
        lastAppliedHash: "A",
        remoteHash: "C",
        lastPersistedHash: null,
      }),
    ).toBe("true_divergence");
  });

  test("rule 6: otherwise no_change", () => {
    expect(
      classifyRemoteChange({
        diskHash: "A",
        lastAppliedHash: "A",
        remoteHash: "B",
        lastPersistedHash: null,
      }),
    ).toBe("no_change");
  });

  test("order: self_echo before remote_behind when both could apply", () => {
    const lastApplied = "A";
    const lastPersisted = "A";
    expect(
      classifyRemoteChange({
        diskHash: "B",
        lastAppliedHash: lastApplied,
        remoteHash: "A",
        lastPersistedHash: lastPersisted,
      }),
    ).toBe("self_echo");
  });
});
