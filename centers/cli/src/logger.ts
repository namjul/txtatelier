import { createConsole, createConsoleWithTime } from "@evolu/common";
import { env, type LogLevel } from "./env";

const LogLevelPriority: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  ERROR: 2,
};

const cleanLogger = createConsole({
  enableLogging: true, // We handle level filtering via shouldLog()
});

const debugLogger = createConsoleWithTime({
  enableLogging: true, // We handle level filtering via shouldLog()
  timestampType: "relative",
});

const shouldLog = (messageLevel: LogLevel): boolean => {
  return LogLevelPriority[messageLevel] >= LogLevelPriority[env.logLevel];
};

export const logger = {
  debug: (...args: unknown[]): void => {
    if (shouldLog("DEBUG")) {
      debugLogger.debug(...args);
    }
  },
  info: (...args: unknown[]): void => {
    if (shouldLog("INFO")) {
      cleanLogger.info(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    if (shouldLog("ERROR")) {
      cleanLogger.warn(...args);
    }
  },
  error: (...args: unknown[]): void => {
    cleanLogger.error(...args);
  },
};
