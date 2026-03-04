import { createConsole } from "@evolu/common";

const enableLogging = process.env["TXTATELIER_LOGGING"] !== "0";

export const logger = createConsole({
  enableLogging,
});
