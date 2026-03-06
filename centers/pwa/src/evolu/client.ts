import { createEvolu, SimpleName } from "@evolu/common";
import { evoluWebDeps } from "@evolu/web";
import { Schema } from "./schema";

const transports = [
  {
    type: "WebSocket" as const,
    url: "ws://localhost:4000",
  },
];

export const evolu = createEvolu(evoluWebDeps)(Schema, {
  name: SimpleName.orThrow("txtatelier-pwa"),
  transports,
});
