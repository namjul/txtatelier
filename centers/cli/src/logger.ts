import { createConsole } from "@evolu/common";
import { env, type LogLevel, LogLevelPriority } from "./env";

const evoluLogger = createConsole({
  enableLogging: env.logLevel === "DEBUG" || env.enableLogging,
});

const shouldLog = (messageLevel: LogLevel): boolean => {
  return LogLevelPriority[messageLevel] >= LogLevelPriority[env.logLevel];
};

export const logger = {
  debug: (...args: unknown[]): void => {
    if (shouldLog("DEBUG")) {
      evoluLogger.debug(...args);
    }
  },
  info: (...args: unknown[]): void => {
    if (shouldLog("INFO")) {
      evoluLogger.info(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    if (shouldLog("ERROR")) {
      evoluLogger.warn(...args);
    }
  },
  error: (...args: unknown[]): void => {
    evoluLogger.error(...args);
  },
};
