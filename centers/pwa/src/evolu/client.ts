import { createEvolu, SimpleName } from "@evolu/common";
import { evoluWebDeps } from "@evolu/web";
import { Schema } from "./schema";

export const createEvoluClient = (transportUrl?: string) => {
  const config =
    transportUrl && transportUrl.trim() !== ""
      ? {
          name: SimpleName.orThrow("txtatelier-pwa"),
          transports: [
            { type: "WebSocket" as const, url: transportUrl.trim() },
          ],
        }
      : {
          name: SimpleName.orThrow("txtatelier-pwa"),
        };

  return createEvolu(evoluWebDeps)(Schema, config);
};

export const evolu = createEvoluClient(
  localStorage.getItem("transportUrl") ?? undefined,
);
