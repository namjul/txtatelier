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
    // Banner, shortcuts, and help must show even when TXTATELIER_LOG_LEVEL=ERROR
    // (default in env.ts); those lines are CLI UX, not noisy sync logs.
    info: (...args: unknown[]): void => {
      if (rl) {
        syncWithPrompt(() => {
          // eslint-disable-next-line no-console
          console.info(...args);
        });
      } else {
        // eslint-disable-next-line no-console
        console.info(...args);
      }
    },
    warn: (...args: unknown[]): void => {
      if (rl) {
        syncWithPrompt(() => {
          // eslint-disable-next-line no-console
          console.warn(...args);
        });
      } else {
        // eslint-disable-next-line no-console
        console.warn(...args);
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
      if (rl) {
        syncWithPrompt(() => {
          // eslint-disable-next-line no-console
          console.info(line);
        });
      } else {
        // eslint-disable-next-line no-console
        console.info(line);
      }
    },
  };
};
