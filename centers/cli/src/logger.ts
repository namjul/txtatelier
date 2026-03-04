import { createConsole } from "@evolu/common";
import { env } from "./env";

export const logger = createConsole({
  enableLogging: env.enableLogging,
});
