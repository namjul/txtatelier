import * as readline from "node:readline";
import { createConsole, createConsoleWithTime } from "@evolu/common";
import pc from "picocolors";
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

export type Logger = {
  readonly debug: (...args: unknown[]) => void;
  readonly info: (...args: unknown[]) => void;
  readonly warn: (...args: unknown[]) => void;
  readonly error: (...args: unknown[]) => void;
};

export const logger: Logger = {
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
  /**
   * Pause readline before writing to stdout so Node's readline state stays
   * consistent (clearLine/cursorTo fight the internal line editor).
   */
  const syncWithPrompt = (write: () => void): void => {
    if (rl) {
      rl.pause();
    }
    write();
    if (rl) {
      rl.resume();
      rl.prompt(true);
    }
  };

  const createSyncMethod = (
    baseFn: (...args: unknown[]) => void,
  ): ((...args: unknown[]) => void) => {
    return (...args: unknown[]): void => {
      if (rl) {
        syncWithPrompt(() => {
          baseFn(...args);
        });
      } else {
        baseFn(...args);
      }
    };
  };

  // Banner, shortcuts, and help must show even when TXTATELIER_LOG_LEVEL=ERROR
  // (default in env.ts); those lines are CLI UX, not noisy sync logs.
  const uxConsoleInfo = (...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    console.info(...args);
  };
  const uxConsoleWarn = (...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    console.warn(...args);
  };

  const syncedInfo = createSyncMethod(uxConsoleInfo);
  const syncedWarn = createSyncMethod(uxConsoleWarn);
  const syncedError = createSyncMethod((...args: unknown[]) =>
    logger.error(...args),
  );
  const syncedDebug = createSyncMethod((...args: unknown[]) =>
    logger.debug(...args),
  );

  return {
    debug: (...args: unknown[]): void => {
      if (!shouldLog("DEBUG")) {
        return;
      }
      syncedDebug(...args);
    },
    info: syncedInfo,
    warn: syncedWarn,
    error: syncedError,
    clearScreen: (): void => {
      if (rl) {
        rl.pause();
      }
      clearViewportPreservingScrollback();
      if (rl) {
        rl.resume();
        rl.prompt(true);
      }
    },
    printStartupBanner: (opts): void => {
      if (opts.clear) {
        if (rl) {
          rl.pause();
        }
        clearViewportPreservingScrollback();
        if (rl) {
          rl.resume();
        }
      }
      const line = `${pc.green("TXTAELIER")} ${pc.dim(`v${opts.version}`)}  ${pc.green(`ready in ${formatReadyDuration(opts.durationMs)}`)}`;
      syncedInfo(line);
    },
  };
};
