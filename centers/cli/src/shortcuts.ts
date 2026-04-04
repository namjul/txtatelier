import type { Interface as ReadlineInterface } from "node:readline";
import type { FileSyncSession } from "./file-sync/index.js";
import type { Logger } from "./logger.js";

export interface SessionDep {
  readonly session: FileSyncSession;
}

export interface LoggerDep {
  readonly logger: Logger;
}

export interface TTYDep {
  readonly isTTY: boolean;
}

export interface ShortcutOptionsDep {
  readonly options: { readonly print: boolean };
}

export interface ReadlineDep {
  readonly readline: ReadlineInterface | null;
}

export interface CLIShortcut {
  readonly key: string;
  readonly description: string;
}

const exitOnShortcutError = (error: unknown, key: string): never => {
  console.error(`[shortcut] Error on '${key}':`, error);
  process.exit(1);
};

/**
 * Bind readline shortcuts (key + Enter). Dependencies use a single `deps` object (Evolu DI style).
 *
 * @returns Cleanup function (close readline when tearing down the CLI).
 */
export const bindShortcuts = (
  deps: SessionDep &
    LoggerDep &
    TTYDep &
    ShortcutOptionsDep &
    ReadlineDep,
): (() => void) => {
  if (!deps.isTTY || deps.readline == null) {
    if (deps.options.print) {
      deps.logger.info("Running non-interactive (shortcuts disabled)");
    }
    return () => {};
  }

  const rl = deps.readline;
  let actionRunning = false;

  const shortcuts: readonly CLIShortcut[] = [
    { key: "r", description: "restart sync (reconcile; brief capture gap is ok for dev)" },
    { key: "u", description: "show status" },
    { key: "s", description: "show mnemonic (copy manually)" },
    { key: "p", description: "paste / restore mnemonic from prompt" },
    { key: "d", description: "reset owner immediately (restore with p if you saved mnemonic)" },
    { key: "c", description: "clear viewport (scrollback kept)" },
    { key: "q", description: "quit" },
  ];

  const question = (q: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(q, (answer) => {
        resolve(answer);
      });
    });

  const showHelp = (): void => {
    deps.logger.info("");
    deps.logger.info("  Shortcuts (type letter + Enter)");
    for (const s of shortcuts) {
      deps.logger.info(`  ${s.key} + enter  ${s.description}`);
    }
    deps.logger.info("  h + enter  show this help");
    deps.logger.info("");
  };

  const runShortcut = async (
    key: string,
    fn: () => void | Promise<void>,
  ): Promise<void> => {
    if (actionRunning) {
      return;
    }
    actionRunning = true;
    try {
      await fn();
    } catch (error) {
      exitOnShortcutError(error, key);
    } finally {
      actionRunning = false;
    }
  };

  const handleLine = async (line: string): Promise<void> => {
    const trimmed = line.trim().toLowerCase();

    if (trimmed === "h") {
      showHelp();
      return;
    }

    switch (trimmed) {
      case "r":
        await runShortcut("r", () => deps.session.restart());
        return;
      case "u":
        await runShortcut("u", () => deps.session.showStatus());
        return;
      case "s":
        await runShortcut("s", () => deps.session.showMnemonic());
        return;
      case "p":
        await runShortcut("p", () => deps.session.restoreMnemonic(question));
        return;
      case "d":
        await runShortcut("d", () => deps.session.resetOwner());
        return;
      case "c":
        await runShortcut("c", () => {
          deps.session.clearConsole();
        });
        return;
      case "q":
        await runShortcut("q", () => deps.session.quit());
        return;
      default:
        return;
    }
  };

  rl.on("line", (line) => {
    void handleLine(line);
  });

  if (deps.options.print) {
    deps.logger.info("➜  press h + enter to show help");
  }

  rl.prompt(true);

  return () => {
    rl.close();
  };
};

export const computeStdinInteractive = (): boolean => {
  const ci = process.env["CI"];
  return (
    process.stdin.isTTY === true && ci !== "true" && ci !== "1" && ci !== ""
  );
};
