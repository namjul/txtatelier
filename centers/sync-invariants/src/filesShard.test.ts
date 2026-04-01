import { describe, expect, it } from "vitest";
import { FILES_SHARD } from "./filesShard.ts";

describe("FILES_SHARD", () => {
  it("is the canonical file-table Evolu shard path", () => {
    expect([...FILES_SHARD]).toEqual(["files", 1]);
  });
});
