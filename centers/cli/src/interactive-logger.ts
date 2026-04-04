import * as readline from "node:readline";
import pc from "picocolors";
import { env, type LogLevel } from "./env";
import { logger as baseLogger, type Logger } from "./logger.js";

const LogLevelPriority: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  ERROR: 2,
};

const shouldLog = (messageLevel: LogLevel): boolean => {
  return LogLevelPriority[messageLevel] >= LogLevelPriority[env.logLevel];
};

const canClearViewport = (): boolean =>
  process.stdout.isTTY === true &&
  (process.stdout.bytesWritten ?? 0) === 0 &&
  (process.stderr.bytesWritten ?? 0) === 0;

const clearViewportPreservingScrollback = (): void => {
  if (!canClearViewport()) {
    return;
  }
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
};

const formatReadyDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.max(0, Math.round(ms))} ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
};

export type InteractiveLogger = Logger & {
  readonly clearScreen: () => void;
  readonly printStartupBanner: (opts: {
    readonly clear: boolean;
    readonly version: string;
    readonly durationMs: number;
  }) => void;
};

export const createInteractiveLogger = (
  rl: readline.Interface | null,
): InteractiveLogger => {
  const syncWithPrompt = (write: () => void): void => {
    if (rl) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    }
    write();
    if (rl) {
      rl.prompt(true);
    }
  };

  return {
    debug: (...args: unknown[]): void => {
      if (!shouldLog("DEBUG")) {
        return;
      }
      if (rl) {
        syncWithPrompt(() => {
          baseLogger.debug(...args);
        });
      } else {
        baseLogger.debug(...args);
      }
    },
    info: (...args: unknown[]): void => {
      if (!shouldLog("INFO")) {
        return;
      }
      if (rl) {
        syncWithPrompt(() => {
          baseLogger.info(...args);
        });
      } else {
        baseLogger.info(...args);
      }
    },
    warn: (...args: unknown[]): void => {
      if (!shouldLog("ERROR")) {
        return;
      }
      if (rl) {
        syncWithPrompt(() => {
          baseLogger.warn(...args);
        });
      } else {
        baseLogger.warn(...args);
      }
    },
    error: (...args: unknown[]): void => {
      if (rl) {
        syncWithPrompt(() => {
          baseLogger.error(...args);
        });
      } else {
        baseLogger.error(...args);
      }
    },
    clearScreen: (): void => {
      clearViewportPreservingScrollback();
    },
    printStartupBanner: (opts): void => {
      if (opts.clear) {
        clearViewportPreservingScrollback();
      }
      const line = `${pc.green("TXTAELIER")} ${pc.dim(`v${opts.version}`)}  ${pc.green(`ready in ${formatReadyDuration(opts.durationMs)}`)}`;
      if (rl) {
        syncWithPrompt(() => {
          baseLogger.info(line);
        });
      } else {
        baseLogger.info(line);
      }
    },
  };
};
